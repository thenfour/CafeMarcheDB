import { scopedAuthorizationSatisfiesRequirement } from "src/auth/shared/permissionRequirement";
import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import React from "react";
import { Permission } from "shared/permissions";
import type { BandPublicId } from "shared/publicId";
import { BrandAssetUrlSchema } from "shared/brandingValidation";
import { CMButton } from "src/core/components/CMCoreComponents2";
import { useSnackbar } from "src/core/components/SnackbarContext";
import { CMDBUploadFile } from "src/core/components/file/CMDBUploadFile";
import { CollapsableUploadFileComponent, FileDropWrapper } from "src/core/components/file/FileDrop";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { useLocale } from "src/locale/components/useLocale";
import type { SettingDraftToolsProps } from "./RegisteredSettingsEditor";

type BrandingAssetKey = "siteCustomization.faviconUrl" | "siteCustomization.logoUrl";

function brandingDownloadUrl(storedLeafName: string, bandPublicId: BandPublicId): string {
    // Branding is rendered outside member links, so the saved URL must carry its File owner.
    return `/api/files/download/${encodeURIComponent(storedLeafName)}?bandPublicId=${encodeURIComponent(bandPublicId)}`;
}

function useBrandingAssetUpload(props: SettingDraftToolsProps & { readonly draft: string }) {
    const { data: snapshot, bandPublicId } = usePresentation();
    const { getPlainString } = useLocale();
    const snackbar = useSnackbar();
    const enabled = !props.readOnly && !props.saving && !!bandPublicId
        && !!snapshot?.authorization.userPublicId
        && snapshot.authorization.bandPublicId === bandPublicId
        && scopedAuthorizationSatisfiesRequirement(snapshot.authorization, BandPermission.upload_files);
    const [progress, setProgress] = React.useState<number | null>(null);
    const pending = React.useRef<AbortController | null>(null);
    const mounted = React.useRef(false);
    const latest = React.useRef({ props, snapshot, enabled, draftVersion: 0 });
    const draftVersion = latest.current.draftVersion + (latest.current.props.draft === props.draft ? 0 : 1);
    latest.current = { props, snapshot, enabled, draftVersion };

    const cancel = React.useCallback(() => {
        const controller = pending.current;
        pending.current = null;
        controller?.abort();
        if (mounted.current) {
            setProgress(null);
            latest.current.props.onBusyChange(false);
        }
    }, []);
    React.useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            cancel();
        };
    }, [cancel]);
    React.useEffect(() => cancel, [snapshot, enabled, props.settingKey, cancel]);

    async function upload(files: FileList): Promise<void> {
        if (!enabled || !bandPublicId || files.length === 0 || pending.current) {
            return;
        }
        const controller = new AbortController();
        pending.current = controller;
        const isCurrent = () => mounted.current && pending.current === controller && !controller.signal.aborted
            && latest.current.enabled && latest.current.snapshot === snapshot;
        setProgress(0);
        props.onBusyChange(true);
        try {
            const response = await CMDBUploadFile({
                bandPublicId, files, fields: { visiblePermission: Permission.visibility_public },
                // Keep the original bytes, including SVG and ICO favicons; the upload owner records image metadata.
                maxImageDimension: undefined, signal: controller.signal,
                onProgress: value => {
                    if (isCurrent()) {
                        setProgress(value);
                    }
                },
            });
            if (!isCurrent()) {
                return;
            }
            const file = response.files[0];
            if (!file) {
                throw new Error("The upload returned no files.");
            }
            if (latest.current.draftVersion !== draftVersion) {
                snackbar.showMessage({ severity: "warning", children: getPlainString("settings.brand.draftChanged") });
                return;
            }
            // The original batch workflow selects the first URL; all uploaded Files remain available.
            latest.current.props.onChange(brandingDownloadUrl(file.storedLeafName, bandPublicId));
            snackbar.showSuccess(getPlainString("settings.brand.uploaded"));
        } catch {
            if (isCurrent()) {
                snackbar.showError(getPlainString("settings.brand.uploadFailed"));
            }
        } finally {
            if (pending.current === controller) {
                pending.current = null;
                if (mounted.current) {
                    setProgress(null);
                    latest.current.props.onBusyChange(false);
                }
            }
        }
    }

    function onFileSelect(files: FileList): void {
        void upload(files);
    }
    function onURLUpload(url: string): void {
        if (props.readOnly || props.saving || pending.current) {
            return;
        }
        const parsed = BrandAssetUrlSchema.safeParse(url);
        if (!parsed.success) {
            snackbar.showError(getPlainString("settings.brand.invalidUrl"));
            return;
        }
        props.onChange(parsed.data);
        snackbar.showSuccess(getPlainString("settings.brand.urlSet"));
    }
    return { enabled, progress, onFileSelect, onURLUpload };
}

function BrandingAssetControl(props: SettingDraftToolsProps & { readonly settingKey: BrandingAssetKey; readonly draft: string }) {
    const { getPlainString } = useLocale();
    const upload = useBrandingAssetUpload(props);
    const favicon = props.settingKey === "siteCustomization.faviconUrl";
    const label = getPlainString(favicon ? "settings.brand.faviconUpload" : "settings.brand.logoUpload");
    const canSetURL = !props.readOnly && !props.saving && upload.progress === null;
    const validPreview = props.draft !== "" && BrandAssetUrlSchema.safeParse(props.draft).success;
    return <div className={favicon ? "brandFaviconUploadArea" : "brandLogoUploadArea"}
        tabIndex={canSetURL ? 0 : -1} aria-label={label} onPaste={event => {
            if (!canSetURL) {
                return;
            }
            if (event.clipboardData.files.length > 0 && upload.enabled) {
                event.preventDefault();
                upload.onFileSelect(event.clipboardData.files);
                return;
            }
            const url = event.clipboardData.getData("text/plain").trim();
            if (/^https?:\/\//i.test(url)) {
                event.preventDefault();
                upload.onURLUpload(url);
            }
        }}>
        <FileDropWrapper enabled={!props.readOnly && !props.saving} onFileSelect={upload.onFileSelect}
            onURLUpload={upload.onURLUpload} progress={upload.progress}>
            {upload.enabled && <>
                <div>{label}</div>
                <CollapsableUploadFileComponent enabled={upload.enabled} onFileSelect={upload.onFileSelect}
                    onURLUpload={upload.onURLUpload} progress={upload.progress} enablePaste={false} />
            </>}
            {validPreview && <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8 }}>
                <img src={props.draft} alt={getPlainString(favicon ? "settings.brand.faviconPreview" : "settings.brand.logoPreview")}
                    style={favicon ? { height: 32, width: 32, objectFit: "contain" } : { maxHeight: 48, maxWidth: 200, objectFit: "contain" }} />
                {!props.readOnly && <CMButton disabled={!canSetURL} onClick={() => props.onChange("")}>
                    {getPlainString("settings.brand.clear")}
                </CMButton>}
            </div>}
        </FileDropWrapper>
    </div>;
}

export function renderBrandingAssetDraftTools(props: SettingDraftToolsProps): React.ReactNode {
    if (props.hive !== "band" || typeof props.draft !== "string"
        || (props.settingKey !== "siteCustomization.faviconUrl" && props.settingKey !== "siteCustomization.logoUrl")) {
        return null;
    }
    return <BrandingAssetControl {...props} settingKey={props.settingKey} draft={props.draft} />;
}
