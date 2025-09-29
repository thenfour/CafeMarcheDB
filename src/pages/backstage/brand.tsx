import { BlitzPage } from "@blitzjs/next";
import { useMutation, invoke } from "@blitzjs/rpc";
import { Box, Button, Grid, TextField, Typography, MenuItem, Divider } from "@mui/material";
import React from "react";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { Permission } from "shared/permissions";
import getSetting from "@/src/auth/queries/getSetting";
import updateSetting from "@/src/auth/mutations/updateSetting";
import clearBrandCache from "@/src/auth/mutations/clearBrandCache";
import { Setting } from "@/shared/settingKeys";
import { SnackbarContext } from "@/src/core/components/SnackbarContext";
import { DefaultDbBrandConfig } from "@/shared/brandConfig";
import { FileDropWrapper, CollapsableUploadFileComponent } from "@/src/core/components/file/FileDrop";
import { CMDBUploadFile } from "@/src/core/components/file/CMDBUploadFile";
import type { UploadResponsePayload } from "@/src/core/db3/shared/apiTypes";

// Reusable upload control for a string setting that holds a file URL
const UploadSettingControl = (props: {
  settingKey: Setting;
  value: string;
  setValue: (v: string) => void;
  instructions: string;
  previewAlt: string;
  previewStyle: React.CSSProperties;
  containerClassName?: string;
}) => {
  const { showMessage } = React.useContext(SnackbarContext);
  const [progress, setProgress] = React.useState<number | null>(null);

  const handleFiles = (files: FileList) => {
    if (!files || files.length < 1) return;
    setProgress(0);
    CMDBUploadFile({
      files,
      fields: { visiblePermission: Permission.visibility_public },
      onProgress: (p01) => setProgress(p01),
    }).then((resp: UploadResponsePayload) => {
      setProgress(null);
      if (!resp.isSuccess || resp.files.length < 1) {
        showMessage({ severity: "error", children: resp.errorMessage || "Upload failed" });
        return;
      }
      const file = resp.files[0]!;
      const relativeUrl = `/api/files/download/${file.storedLeafName}`;
      props.setValue(relativeUrl);
      showMessage({ severity: "success", children: `Uploaded ${resp.files.length} file(s). URL set.` });
    }).catch((e) => {
      setProgress(null);
      console.log(e);
      showMessage({ severity: "error", children: `Error uploading: ${e}` });
    });
  };

  const handleUrl = (url: string) => {
    props.setValue(url);
    showMessage({ severity: "success", children: `URL set from dropped/pasted URL.` });
  };

  return (
    <Box mt={1}>
      <Divider sx={{ mb: 1 }} />
      <Typography variant="subtitle2" gutterBottom>{props.instructions}</Typography>
      <FileDropWrapper
        className={props.containerClassName || "brandSettingUploadArea"}
        onFileSelect={handleFiles}
        onURLUpload={handleUrl}
        progress={progress}
      >
        <CollapsableUploadFileComponent onFileSelect={handleFiles} onURLUpload={handleUrl} progress={progress} />
      </FileDropWrapper>

      {props.value && (
        <Box mt={1} display="flex" alignItems="center" gap={2}>
          <img
            src={props.value}
            alt={props.previewAlt}
            style={props.previewStyle}
          />
          <Button size="small" onClick={() => props.setValue("")}>Clear</Button>
        </Box>
      )}
    </Box>
  );
};

const fields = [
  { key: Setting.Dashboard_SiteTitle, label: "Site Title" },
  { key: Setting.Dashboard_SiteTitlePrefix, label: "Title Prefix" },
  { key: Setting.Dashboard_SiteFaviconUrl, label: "Favicon URL" },
  { key: Setting.Dashboard_SiteLogoUrl, label: "App Bar Logo URL" },
  { key: Setting.Dashboard_Theme_PrimaryMain, label: "Primary Main" },
  { key: Setting.Dashboard_Theme_SecondaryMain, label: "Secondary Main" },
  { key: Setting.Dashboard_Theme_BackgroundDefault, label: "Background Default" },
  { key: Setting.Dashboard_Theme_BackgroundPaper, label: "Background Paper" },
  { key: Setting.Dashboard_Theme_TextPrimary, label: "Text Primary (optional)" },
  { key: Setting.Dashboard_Theme_ContrastText, label: "Contrast Text (primary/secondary)" },
];

const BrandForm = () => {
  const { showMessage } = React.useContext(SnackbarContext);
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [updateSettingMutation] = useMutation(updateSetting);
  const [clearBrandCacheMutation] = useMutation(clearBrandCache);

  // Load current values
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const entries = await Promise.all(
        fields.map(async f => {
          try {
            const val = await invoke(getSetting, { name: f.key });
            return [String(f.key), String(val ?? "")];
          } catch { return [String(f.key), ""]; }
        })
      );
      if (mounted) setValues(Object.fromEntries(entries));
    })();
    return () => { mounted = false; };
  }, []);

  const onChange = (k: string, v: string) => setValues(s => ({ ...s, [k]: v }));

  const onSave = async () => {
    for (const f of fields) {
      await updateSettingMutation({ name: f.key, value: (values[f.key] ?? "") });
    }
    await clearBrandCacheMutation({});
    showMessage({ severity: "success", children: "Brand settings saved. Cache cleared. Refresh to see changes." });
  };

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Typography variant="h6">Brand Settings</Typography>
      <Grid container spacing={2}>
        {fields.map(f => (
          <Grid item xs={12} md={6} key={f.key}>
            {/* Use native color picker for color-ish fields */}
            {(/Primary|Secondary|Background|TextPrimary|ContrastText/i.test(f.key)) ? (() => {
              const defaults: Record<string, string | undefined> = {
                [String(Setting.Dashboard_Theme_PrimaryMain)]: DefaultDbBrandConfig.theme?.primaryMain,
                [String(Setting.Dashboard_Theme_SecondaryMain)]: DefaultDbBrandConfig.theme?.secondaryMain,
                [String(Setting.Dashboard_Theme_BackgroundDefault)]: DefaultDbBrandConfig.theme?.backgroundDefault,
                [String(Setting.Dashboard_Theme_BackgroundPaper)]: DefaultDbBrandConfig.theme?.backgroundPaper,
                [String(Setting.Dashboard_Theme_TextPrimary)]: DefaultDbBrandConfig.theme?.textPrimary,
                [String(Setting.Dashboard_Theme_ContrastText)]: DefaultDbBrandConfig.theme?.contrastText,
              };
              const defVal = defaults[String(f.key)] ?? "";
              const current = (values[f.key] ?? "").toString();
              const onReset = () => onChange(f.key, defVal || "");
              return (
                <Box display="flex" alignItems="center" gap={1}>
                  <TextField
                    fullWidth
                    type="color"
                    label={f.label}
                    value={current || "#000000"}
                    onChange={e => onChange(f.key, e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                  <Button size="small" variant="outlined" onClick={onReset} disabled={current === (defVal || "")}>Reset</Button>
                </Box>
              );
            })() : (
              <TextField fullWidth label={f.label} value={values[f.key] ?? ""} onChange={e => onChange(f.key, e.target.value)} />
            )}

            {/* Specialized upload UI for the Favicon field */}
            {f.key === Setting.Dashboard_SiteFaviconUrl && (
              <UploadSettingControl
                settingKey={Setting.Dashboard_SiteFaviconUrl}
                value={values[Setting.Dashboard_SiteFaviconUrl] ?? ""}
                setValue={(v) => onChange(String(Setting.Dashboard_SiteFaviconUrl), v)}
                instructions="Upload a favicon (drag/drop/paste or click):"
                previewAlt="Favicon Preview"
                previewStyle={{ height: 32, width: 32, objectFit: "contain", background: "#fff", padding: 2, borderRadius: 4 }}
                containerClassName="brandFaviconUploadArea"
              />
            )}

            {/* Specialized upload UI for the App Bar Logo field */}
            {f.key === Setting.Dashboard_SiteLogoUrl && (
              <UploadSettingControl
                settingKey={Setting.Dashboard_SiteLogoUrl}
                value={values[Setting.Dashboard_SiteLogoUrl] ?? ""}
                setValue={(v) => onChange(String(Setting.Dashboard_SiteLogoUrl), v)}
                instructions="Upload a logo (drag/drop/paste or click):"
                previewAlt="App Bar Logo Preview"
                previewStyle={{ maxHeight: 48, maxWidth: 200, objectFit: "contain", background: "#fff", padding: 4, borderRadius: 4 }}
                containerClassName="brandLogoUploadArea"
              />
            )}
          </Grid>
        ))}
      </Grid>
      <Box>
        <Button variant="contained" onClick={onSave}>Save</Button>
      </Box>
    </Box>
  );
};

const BrandPage: BlitzPage = () => {
  return (
    <DashboardLayout title="Brand" basePermission={Permission.sysadmin}>
      <BrandForm />
    </DashboardLayout>
  );
};

export default BrandPage;
