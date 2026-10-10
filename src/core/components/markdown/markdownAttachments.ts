import type { UploadedFile } from "../../db3/shared/fileTypes";

/** Filenames are literal captions, including brackets or Markdown punctuation. */
function attachmentCaption(filename: string): string {
    return filename.replace(/[\r\n]/g, " ").replace(/[\\`*_[\]{}()#+.!<>|]/g, "\\$&");
}

export function markdownAttachmentLinks(files: readonly UploadedFile[]): string {
    return files.map(file => {
        // External records have no stored bytes; local files use the protected download route.
        // LSMB todo: clean this up, use proper routing mechanism.
        const url = file.externalURI ? new URL(file.externalURI).href.replace(/\(/g, "%28").replace(/\)/g, "%29")
            : `/api/files/download/${encodeURIComponent(file.storedLeafName)}`;
        const prefix = file.mimeType?.startsWith("image/") ? "!" : "";
        return `${prefix}[${attachmentCaption(file.fileLeafName)}](${url})`;
    }).join(" ");
}
