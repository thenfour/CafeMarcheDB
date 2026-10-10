import React from "react";
import type { BandPublicId } from "shared/publicId";
import type { TClientUploadFileArgs } from "../../db3/shared/fileTypes";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { useLocale } from "src/locale/components/useLocale";
import { CMDBUploadFile } from "../file/CMDBUploadFile";
import { useFeatureRecorder } from "../dashboardContext/DashboardContext";
import { ActivityFeature } from "../featureReports/activityTracking";
import { useSnackbar } from "../SnackbarContext";
import type { ControlledTextAreaAPI } from "./useControlledTextArea";
import { markdownAttachmentLinks } from "./markdownAttachments";

interface MarkdownAttachmentOptions {
    enabled: boolean;
    bandPublicId: BandPublicId | null;
    /** The editor owns visibility, associations and the image size policy. */
    fields: Omit<TClientUploadFileArgs, "externalURI">;
    maxImageDimension: number;
    scopeKey: string;
    draft: string;
    textarea: React.RefObject<HTMLTextAreaElement>;
    editor: ControlledTextAreaAPI;
}

/** An upload and its eventual insertion belong to one editor draft and authority. */
export function useMarkdownAttachments(options: MarkdownAttachmentOptions) {
    const { data: presentation } = usePresentation();
    const { getPlainString } = useLocale();
    const snackbar = useSnackbar();
    const recordFeature = useFeatureRecorder();
    const [progress, setProgress] = React.useState<number | null>(null);
    const pending = React.useRef<AbortController | null>(null);
    const mounted = React.useRef(false);
    const latest = React.useRef({ options, presentation, draftVersion: 0 });
    const draftVersion = latest.current.draftVersion + (latest.current.options.draft === options.draft ? 0 : 1);
    latest.current = { options, presentation, draftVersion };

    const cancel = React.useCallback(() => {
        const controller = pending.current;
        pending.current = null;
        controller?.abort();
        if (mounted.current) {
            setProgress(null);
        }
    }, []);
    React.useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            cancel();
        };
    }, [cancel]);
    React.useEffect(() => cancel, [options.scopeKey, presentation, options.enabled, cancel]);

    async function upload(files: FileList | null, externalURI: string | null): Promise<void> {
        const textarea = options.textarea.current;
        if (!options.enabled || !options.bandPublicId || !textarea || pending.current) {
            return;
        }
        const controller = new AbortController();
        pending.current = controller;
        const selection = { start: textarea.selectionStart, end: textarea.selectionEnd };
        const originalText = textarea.value;
        const isCurrent = () => mounted.current && pending.current === controller && !controller.signal.aborted
            && latest.current.options.enabled && latest.current.options.scopeKey === options.scopeKey
            && latest.current.presentation === presentation;
        setProgress(0);
        void recordFeature({ feature: externalURI ? ActivityFeature.file_upload_url : ActivityFeature.file_upload, context: "Markdown3Editor" })
            .catch(error => console.error("Error recording Markdown attachment upload", error));
        try {
            const response = await CMDBUploadFile({
                bandPublicId: options.bandPublicId, files, fields: { ...options.fields, externalURI },
                maxImageDimension: options.maxImageDimension, signal: controller.signal,
                onProgress: value => {
                    if (isCurrent()) {
                        setProgress(value);
                    }
                },
            });
            if (!isCurrent()) {
                return;
            }
            if (latest.current.draftVersion !== draftVersion || options.textarea.current !== textarea
                || textarea.value !== originalText) {
                snackbar.showMessage({ severity: "warning", children: getPlainString("markdown.attachment.draftChanged") });
                return;
            }
            await latest.current.options.editor.replaceRange(selection.start, selection.end, markdownAttachmentLinks(response.files), { select: "change" });
            snackbar.showSuccess(getPlainString("markdown.attachment.uploaded"));
        } catch {
            if (isCurrent()) {
                snackbar.showError(getPlainString("markdown.attachment.failed"));
            }
        } finally {
            if (pending.current === controller) {
                pending.current = null;
                if (mounted.current) {
                    setProgress(null);
                }
            }
        }
    }

    function onFileSelect(files: FileList): void {
        if (files.length > 0) {
            void upload(files, null);
        }
    }
    function onURLUpload(url: string): void {
        void upload(null, url);
    }
    return { progress, onFileSelect, onURLUpload };
}
