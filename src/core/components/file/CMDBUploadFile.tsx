import type { TClientUploadFileArgs, UploadResponsePayload } from "../../db3/shared/fileTypes";
import { requireRestoredApplicationFeature } from "src/core/shared/applicationRecovery";

export interface CMDBUploadFilesArgs {
    files: FileList | null;
    fields: TClientUploadFileArgs;
    maxImageDimension?: number;
    onProgress: (progress01: number, uploaded: number, total: number) => void;
}

// Direct callers also stop before constructing multipart data or opening a request.
export async function CMDBUploadFile(_args: CMDBUploadFilesArgs): Promise<UploadResponsePayload> {
    return requireRestoredApplicationFeature("fileCreation");
}

// MIGRATION_RESTORE: file-creation
// Source: 1bea5a730d2f3a8c20b490681360e1c698403523:src/core/components/file/CMDBUploadFile.tsx:1-76
// Reason: Upload and image-creation paths omit band ownership, use removed global tag/instrument models and person associations, and depend on unfinished File row contracts.
// Restore: Restore multipart/external-URL uploads, public-ID band-owned associations, automatic Partition/Recording and instrument matching, image crop/rotate/resize, metadata processing, gallery bake and generic File creation with fresh transactional authorization, filesystem cleanup and localized controls; retain download behavior.
// Verification: Reactivate image authorization specifications; verify two bands, independent grants and revocation, hidden/foreign parents and associations, inactive memberships/catalogs, multipart failures and limits, file/URL/paste/drop uploads, image transforms/metadata, rollback and storage cleanup, public DTOs and built-browser workflows.
// SHA256: 72cdf3aa843ad8484748b6eb146e73154e1f2b9b17b737f3a24deddb80072ae3
// MIGRATION_REFERENCE_BEGIN
//
// // drag reordering https://www.npmjs.com/package/react-smooth-dnd
// // https://codesandbox.io/s/material-ui-sortable-list-with-react-smooth-dnd-swrqx?file=/src/index.js:113-129
//
// import { getAntiCSRFToken } from "@blitzjs/auth";
// import { TClientUploadFileArgs, UploadResponsePayload } from "../../db3/shared/fileTypes";
// import { MakeErrorUploadResponsePayload } from "../../db3/shared/fileAPI";
//
// //import dynamic from 'next/dynamic';
// //import { API } from '../db3/clientAPI'; // <-- NO; circular dependency
//
//
// ////////////////////////////////////////////////////////////////
// export interface CMDBUploadFilesArgs {
//     files: FileList | null;
//     fields: TClientUploadFileArgs;
//
//     // set this to tell the file processor to generate a smaller version of the file if it's an image and too big.
//     // this is used by the markdown editor.
//     maxImageDimension?: number;
//     onProgress: (progress01: number, uploaded: number, total: number) => void;
// };
//
// export async function CMDBUploadFile(args: CMDBUploadFilesArgs): Promise<UploadResponsePayload> {
//     const formData = new FormData();
//     if (args.files) {
//         for (let i = 0; i < args.files.length; ++i) {
//             formData.append(`file_${i}`, args.files[i]!);
//         }
//     }
//     if (args.maxImageDimension !== undefined) {
//         formData.append("maxImageDimension", args.maxImageDimension.toString());
//     }
//     const xhr = new XMLHttpRequest();
//
//     return new Promise((resolve, reject) => {
//         xhr.upload.addEventListener("progress", (event) => {
//             if (event.lengthComputable) {
//                 args.onProgress(event.loaded / event.total, event.loaded, event.total);
//             }
//         });
//         // for download progress which we don't want...
//         //   xhr.addEventListener("progress", (event) => {
//         xhr.addEventListener("loadend", () => {
//             if (xhr.readyState === 4 && xhr.status === 200) {
//                 // success
//                 const resp = JSON.parse(xhr.responseText) as UploadResponsePayload;
//                 resolve(resp);
//             } else {
//                 reject(MakeErrorUploadResponsePayload(`loadend state error ${xhr.responseText}`));
//             }
//         });
//         xhr.upload.addEventListener("error", (e) => {
//             //reject(`upload error`);
//             reject(MakeErrorUploadResponsePayload(`upload error event`));
//         });
//         xhr.addEventListener("error", (e) => {
//             reject(MakeErrorUploadResponsePayload(`read response error ${xhr.responseText}`));
//         });
//
//         // add form fields
//         Object.entries(args.fields).forEach(([key, value]) => {
//             formData.append(key, value);
//         });
//
//         xhr.open("POST", "/api/files/upload", true);
//
//         // see blitz docs for manually invoking APIs / https://blitzjs.com/docs/session-management#manual-api-requests
//         const antiCSRFToken = getAntiCSRFToken();
//         if (antiCSRFToken) {
//             xhr.setRequestHeader("anti-csrf", antiCSRFToken);
//         }
//
//         xhr.send(formData);
//     });
// }
// MIGRATION_REFERENCE_END
