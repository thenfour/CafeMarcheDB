
// drag reordering https://www.npmjs.com/package/react-smooth-dnd
// https://codesandbox.io/s/material-ui-sortable-list-with-react-smooth-dnd-swrqx?file=/src/index.js:113-129

import { getAntiCSRFToken } from "@blitzjs/auth";
import { MakeErrorUploadResponsePayload, TClientUploadFileArgs, UploadResponsePayload } from "../db3/shared/apiTypes";

//import dynamic from 'next/dynamic';
//import { API } from '../db3/clientAPI'; // <-- NO; circular dependency


////////////////////////////////////////////////////////////////
export interface CMDBUploadFilesArgs {
    files: FileList | null;
    fields: TClientUploadFileArgs;

    // set this to tell the file processor to generate a smaller version of the file if it's an image and too big.
    // this is used by the markdown editor.
    maxImageDimension?: number;
    onProgress: (progress01: number, uploaded: number, total: number) => void;
};

export async function CMDBUploadFile(args: CMDBUploadFilesArgs): Promise<UploadResponsePayload> {
    const formData = new FormData();
    if (args.files) {
        for (let i = 0; i < args.files.length; ++i) {
            formData.append(`file_${i}`, args.files[i]!);
        }
    }
    if (args.maxImageDimension !== undefined) {
        formData.append("maxImageDimension", args.maxImageDimension.toString());
    }
    const xhr = new XMLHttpRequest();

    return new Promise((resolve, reject) => {
        xhr.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable) {
                args.onProgress(event.loaded / event.total, event.loaded, event.total);
            }
        });
        // for download progress which we don't want...
        //   xhr.addEventListener("progress", (event) => {
        xhr.addEventListener("loadend", () => {
            if (xhr.readyState === 4 && xhr.status === 200) {
                // success
                const resp = JSON.parse(xhr.responseText) as UploadResponsePayload;
                resolve(resp);
            } else {
                reject(MakeErrorUploadResponsePayload(`loadend state error ${xhr.responseText}`));
            }
        });
        xhr.upload.addEventListener("error", (e) => {
            //reject(`upload error`);
            reject(MakeErrorUploadResponsePayload(`upload error event`));
        });
        xhr.addEventListener("error", (e) => {
            reject(MakeErrorUploadResponsePayload(`read response error ${xhr.responseText}`));
        });

        // add form fields
        Object.entries(args.fields).forEach(([key, value]) => {
            formData.append(key, value);
        });

        xhr.open("POST", "/api/files/upload", true);

        // see blitz docs for manually invoking APIs / https://blitzjs.com/docs/session-management#manual-api-requests
        const antiCSRFToken = getAntiCSRFToken();
        if (antiCSRFToken) {
            xhr.setRequestHeader("anti-csrf", antiCSRFToken);
        }

        xhr.send(formData);
    });
}

