import { DefaultDbBrandConfig, HostingMode } from "@/shared/brandConfigBase";
import { BandTimeZoneSchema } from "@/shared/dateTimePolicy";
import type { SiteBrandingSettings } from "@/shared/siteBranding";
import updateSetting from "@/src/auth/mutations/updateSetting";
import updateSiteBrandingSettings from "@/src/auth/mutations/updateSiteBrandingSettings";
import getSetting from "@/src/auth/queries/getSetting";
import getSiteBrandingSettings from "@/src/auth/queries/getSiteBrandingSettings";
import { CMSinglePageSurfaceCard } from "@/src/core/components/CMCoreComponents";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { useDashboardContext } from "@/src/core/components/dashboardContext/DashboardContext";
import { CMDBUploadFile } from "@/src/core/components/file/CMDBUploadFile";
import { CollapsableUploadFileComponent, FileDropWrapper } from "@/src/core/components/file/FileDrop";
import { SnackbarContext } from "@/src/core/components/SnackbarContext";
import type { UploadResponsePayload } from "@/src/core/db3/shared/fileTypes";
import { useSession } from "@blitzjs/auth";
import type { BlitzPage } from "@blitzjs/next";
import { useMutation, useQuery } from "@blitzjs/rpc";
import { Autocomplete, Box, Button, MenuItem, TextField, Typography } from "@mui/material";
import React from "react";
import { Permission } from "shared/permissions";
import { Setting } from "shared/settingKeys";

type BrandingField = {
    key: keyof SiteBrandingSettings;
    label: string;
};

const identityFields: BrandingField[] = [
    { key: "siteTitle", label: "Site Title" },
    { key: "siteTitlePrefix", label: "Page title prefix" },
    { key: "siteFaviconUrl", label: "Favicon URL" },
    { key: "siteLogoUrl", label: "Site Logo URL" },
];

const calendarFields: BrandingField[] = [
    { key: "calendarName", label: "Calendar Name (My Band's Agenda)" },
    { key: "calendarCompany", label: "Calendar Company (My Band)" },
    { key: "calendarProduct", label: "Calendar Product (Backstage)" },
    { key: "calendarEventPrefix", label: "Event Name Prefix (MB:)" },
];

const themeFields: BrandingField[] = [
    { key: "themePrimaryMain", label: "Primary Main" },
    { key: "themeSecondaryMain", label: "Secondary Main" },
    { key: "themeBackgroundDefault", label: "Background Default" },
    { key: "themeBackgroundPaper", label: "Background Paper" },
    { key: "themeTextPrimary", label: "Text Primary (optional)" },
    { key: "themeContrastText", label: "Contrast Text (primary/secondary)" },
];

const themeDefaults: Partial<Record<keyof SiteBrandingSettings, string>> = {
    themePrimaryMain: DefaultDbBrandConfig.theme?.primaryMain,
    themeSecondaryMain: DefaultDbBrandConfig.theme?.secondaryMain,
    themeBackgroundDefault: DefaultDbBrandConfig.theme?.backgroundDefault,
    themeBackgroundPaper: DefaultDbBrandConfig.theme?.backgroundPaper,
    themeTextPrimary: DefaultDbBrandConfig.theme?.textPrimary,
    themeContrastText: DefaultDbBrandConfig.theme?.contrastText,
};

const UploadSettingControl = (props: {
    value: string;
    setValue: (value: string) => void;
    instructions: string;
    previewAlt: string;
    previewStyle: React.CSSProperties;
    containerClassName: string;
}) => {
    const { showMessage } = React.useContext(SnackbarContext);
    const [progress, setProgress] = React.useState<number | null>(null);

    const handleFiles = (files: FileList) => {
        if (files.length < 1) return;
        setProgress(0);
        CMDBUploadFile({
            files,
            fields: { visiblePermission: Permission.visibility_public },
            onProgress: setProgress,
        }).then((response: UploadResponsePayload) => {
            setProgress(null);
            if (!response.isSuccess || response.files.length < 1) {
                showMessage({
                    severity: "error",
                    children: response.errorMessage || "Upload failed",
                });
                return;
            }
            props.setValue(`/api/files/download/${response.files[0]!.storedLeafName}`);
            showMessage({
                severity: "success",
                children: `Uploaded ${response.files.length} file(s). URL set.`,
            });
        }).catch(error => {
            setProgress(null);
            console.error(error);
            showMessage({ severity: "error", children: `Error uploading: ${error}` });
        });
    };

    const handleUrl = (url: string) => {
        props.setValue(url);
        showMessage({ severity: "success", children: "URL set from dropped/pasted URL." });
    };

    return <Box mt={1}>
        <Typography variant="subtitle2" gutterBottom>{props.instructions}</Typography>
        <FileDropWrapper
            className={props.containerClassName}
            onFileSelect={handleFiles}
            onURLUpload={handleUrl}
            progress={progress}
        >
            <CollapsableUploadFileComponent
                onFileSelect={handleFiles}
                onURLUpload={handleUrl}
                progress={progress}
            />
        </FileDropWrapper>
        {props.value && <Box mt={1} display="flex" alignItems="center" gap={2}>
            <img src={props.value} alt={props.previewAlt} style={props.previewStyle} />
            <Button size="small" onClick={() => props.setValue("")}>Clear</Button>
        </Box>}
    </Box>;
};

const BrandingFields = (props: {
    fields: BrandingField[];
    values: SiteBrandingSettings;
    canUpload: boolean;
    onChange: (key: keyof SiteBrandingSettings, value: string) => void;
}) => <>
        {props.fields.map(field => {
            const isThemeColor = field.key.startsWith("theme");
            const current = props.values[field.key];
            const defaultValue = themeDefaults[field.key] ?? "";
            return <Box key={field.key}>
                {isThemeColor
                    ? <Box display="flex" alignItems="center" gap={1}>
                        <TextField
                            fullWidth
                            type="color"
                            label={field.label}
                            value={current || "#000000"}
                            onChange={event => props.onChange(field.key, event.target.value)}
                            InputLabelProps={{ shrink: true }}
                        />
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={() => props.onChange(field.key, defaultValue)}
                            disabled={current === defaultValue}
                        >Reset</Button>
                    </Box>
                    : <TextField
                        fullWidth
                        label={field.label}
                        value={current}
                        onChange={event => props.onChange(field.key, event.target.value)}
                    />}

                {props.canUpload && field.key === "siteFaviconUrl" && <UploadSettingControl
                    value={props.values.siteFaviconUrl}
                    setValue={value => props.onChange("siteFaviconUrl", value)}
                    instructions="Upload a favicon (drag/drop/paste or click):"
                    previewAlt="Favicon Preview"
                    previewStyle={{
                        height: 32,
                        width: 32,
                        objectFit: "contain",
                        background: "#fff",
                        padding: 2,
                        borderRadius: 4,
                    }}
                    containerClassName="brandFaviconUploadArea"
                />}

                {props.canUpload && field.key === "siteLogoUrl" && <UploadSettingControl
                    value={props.values.siteLogoUrl}
                    setValue={value => props.onChange("siteLogoUrl", value)}
                    instructions="Upload a logo (drag/drop/paste or click):"
                    previewAlt="App Bar Logo Preview"
                    previewStyle={{
                        maxHeight: 48,
                        maxWidth: 200,
                        objectFit: "contain",
                        background: "#fff",
                        padding: 4,
                        borderRadius: 4,
                    }}
                    containerClassName="brandLogoUploadArea"
                />}
            </Box>;
        })}
    </>;

const BrandForm = () => {
    const dashboardContext = useDashboardContext();
    const { showMessage } = React.useContext(SnackbarContext);
    const [loadedSettings] = useQuery(getSiteBrandingSettings, {});
    const [values, setValues] = React.useState<SiteBrandingSettings>(loadedSettings);
    const [isSaving, setIsSaving] = React.useState(false);
    const [updateBranding] = useMutation(updateSiteBrandingSettings);
    const bandTimeZoneValidation = BandTimeZoneSchema.safeParse(values.bandTimeZone);
    const bandTimeZoneError = bandTimeZoneValidation.success
        ? undefined
        : bandTimeZoneValidation.error.issues[0]?.message;

    React.useEffect(() => setValues(loadedSettings), [loadedSettings]);

    const onChange = (key: keyof SiteBrandingSettings, value: string) => {
        setValues(current => ({ ...current, [key]: value }));
    };

    const onSave = async () => {
        if (!bandTimeZoneValidation.success) return;
        setIsSaving(true);
        try {
            const saved = await updateBranding({ ...values, bandTimeZone: bandTimeZoneValidation.data });
            setValues(saved);
            await dashboardContext.refetchDashboardData();
            showMessage({
                severity: "success",
                children: "Brand settings saved. Refresh to see application-wide changes.",
            });
        } finally {
            setIsSaving(false);
        }
    };

    const allTimeZones = React.useMemo(() => {
        return Intl.supportedValuesOf("timeZone");
    }, []);

    return <CMSinglePageSurfaceCard>
        <div className="brandFormContainer header" style={{ backgroundColor: "#fff", color: "var(--text-secondary)" }}>
            <h2 style={{ color: "var(--text-primary)" }}>Site identity</h2>
        </div>
        <div className="brandFormContainer content muiCompatible">
            <BrandingFields
                fields={identityFields}
                values={values}
                canUpload={dashboardContext.isAuthorized(Permission.upload_files)}
                onChange={onChange}
            />
            <h2>Event scheduling</h2>
            <Autocomplete
                fullWidth
                options={allTimeZones}
                value={values.bandTimeZone}
                freeSolo
                onChange={(e, newValue) => {
                    if (newValue) onChange("bandTimeZone", newValue)
                }}
                filterOptions={(options, state) => {
                    const q = state.inputValue.toLocaleLowerCase();
                    return options.filter(o => o.toLocaleLowerCase().indexOf(q) != -1);
                }}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        label="Band time zone"
                        error={!!bandTimeZoneError}
                        helperText={bandTimeZoneError || "The band's home time zone, including daylight saving time. Use a named zone, such as Europe/Brussels or Asia/Tokyo."}
                    />
                )}
            />


            <h2>Calendar identity</h2>
            <BrandingFields fields={calendarFields} values={values} canUpload={false} onChange={onChange} />
            <h2>Theme</h2>
            <BrandingFields fields={themeFields} values={values} canUpload={false} onChange={onChange} />
            <Box>
                <Button variant="contained" disabled={isSaving || !bandTimeZoneValidation.success} onClick={onSave}>Save branding</Button>
            </Box>
        </div>
    </CMSinglePageSurfaceCard>;
};

const PlatformBrandForm = () => {
    const { showMessage } = React.useContext(SnackbarContext);
    const [loadedHostingMode] = useQuery(getSetting, { name: Setting.Dashboard_HostingMode });
    const [hostingMode, setHostingMode] = React.useState(
        loadedHostingMode || HostingMode.GenericSingleTenant,
    );
    const [isSaving, setIsSaving] = React.useState(false);
    const [updateGenericSetting] = useMutation(updateSetting);

    React.useEffect(() => {
        setHostingMode(loadedHostingMode || HostingMode.GenericSingleTenant);
    }, [loadedHostingMode]);

    const onSave = async () => {
        setIsSaving(true);
        try {
            await updateGenericSetting({
                name: Setting.Dashboard_HostingMode,
                value: hostingMode,
            });
            showMessage({ severity: "success", children: "Platform hosting mode saved." });
        } finally {
            setIsSaving(false);
        }
    };

    return <CMSinglePageSurfaceCard>
        <div className="brandFormContainer header" style={{ backgroundColor: "#fff", color: "var(--text-secondary)" }}>
            <h2>Platform</h2>
        </div>
        <div className="brandFormContainer content muiCompatible">
            <TextField
                select
                fullWidth
                label="Hosting Mode"
                value={hostingMode}
                onChange={event => setHostingMode(event.target.value)}
            >
                {Object.values(HostingMode).map(mode => <MenuItem key={mode} value={mode}>{mode}</MenuItem>)}
            </TextField>
            <Box>
                <Button variant="contained" disabled={isSaving} onClick={onSave}>Save platform setting</Button>
            </Box>
        </div>
    </CMSinglePageSurfaceCard>;
};

const BrandPageContent = () => {
    const session = useSession();
    const dashboardContext = useDashboardContext();
    return <>
        {dashboardContext.isAuthorized(Permission.manage_site_branding) && <BrandForm />}
        {session.permissionNames?.includes(Permission.sysadmin) && <PlatformBrandForm />}
    </>;
};

const BrandPage: BlitzPage = () => <DashboardLayout
    title="Brand"
>
    <BrandPageContent />
</DashboardLayout>;

export default BrandPage;
