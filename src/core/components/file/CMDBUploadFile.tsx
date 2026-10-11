import { getAntiCSRFToken } from "@blitzjs/auth";
import type { BandPublicId } from "shared/publicId";
import type { TClientUploadFileArgs, UploadResponsePayload } from "../../db3/shared/fileTypes";
import { FileUploadResponseSchema } from "../../db3/shared/fileUpload";

export interface CMDBUploadFilesArgs {
    bandPublicId: BandPublicId;
    files: FileList | null;
    fields: TClientUploadFileArgs;
    maxImageDimension?: number;
    signal?: AbortSignal;
    onProgress: (progress01: number, uploaded: number, total: number) => void;
}

export async function CMDBUploadFile(args: CMDBUploadFilesArgs): Promise<UploadResponsePayload> {
    const formData = new FormData();
    for (const file of Array.from(args.files ?? [])) {
        formData.append("files", file);
    }
    for (const [key, value] of Object.entries(args.fields)) {
        if (value !== null && value !== undefined) {
            formData.append(key, value);
        }
    }
    if (args.maxImageDimension !== undefined) {
        formData.append("maxImageDimension", String(args.maxImageDimension));
    }
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        if (args.signal?.aborted) {
            reject(new Error("Upload cancelled."));
            return;
        }
        const abort = () => xhr.abort();
        const releaseSignal = () => args.signal?.removeEventListener("abort", abort);
        args.signal?.addEventListener("abort", abort, { once: true });
        xhr.upload.addEventListener("progress", event => {
            if (event.lengthComputable) {
                args.onProgress(event.loaded / event.total, event.loaded, event.total);
            }
        });
        xhr.addEventListener("load", () => {
            releaseSignal();
            try {
                const response = FileUploadResponseSchema.parse(JSON.parse(xhr.responseText));
                if (xhr.status !== 200 || !response.isSuccess) {
                    reject(new Error(response.errorMessage ?? "Upload failed."));
                    return;
                }
                resolve(response);
            } catch (error) {
                reject(error);
            }
        });
        xhr.addEventListener("error", () => {
            releaseSignal();
            reject(new Error("Upload request failed."));
        });
        xhr.addEventListener("abort", () => {
            releaseSignal();
            reject(new Error("Upload cancelled."));
        });
        xhr.open("POST", "/api/files/upload?bandPublicId=" + encodeURIComponent(args.bandPublicId), true);
        const token = getAntiCSRFToken();
        if (token) {
            xhr.setRequestHeader("anti-csrf", token);
        }
        xhr.send(formData);
    });
}
