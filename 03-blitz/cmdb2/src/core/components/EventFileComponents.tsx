
import React, { DragEventHandler, FC, Suspense } from "react"
import db, { Prisma } from "db";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import { API, APIQueryResult } from '../db3/clientAPI';
import { SnackbarContext } from "src/core/components/SnackbarContext";
import { RenderMuiIcon, gIconMap } from "../db3/components/IconSelectDialog";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { CMChip, CMChipContainer, CMStandardDBChip, CMTagList, EditTextField, InspectObject, ReactiveInputDialog, VisibilityControl, VisibilityValue } from "./CMCoreComponents";
import { Markdown } from "./RichTextEditor";
import { Button, Checkbox, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel, InputBase, Menu, MenuItem, TextField } from "@mui/material";
import Autocomplete, { AutocompleteRenderInputParams, createFilterOptions } from '@mui/material/Autocomplete';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import { CMTextField } from "./CMTextField";
import { TAnyModel, formatSongLength, getUniqueNegativeID, moveItemInArray } from "shared/utils";
import { Container, Draggable, DropResult } from "react-smooth-dnd";
import FileUploadIcon from '@mui/icons-material/FileUpload';
import { getAntiCSRFToken } from "@blitzjs/auth"
import { TClientUploadFileArgs } from "../db3/shared/apiTypes";


////////////////////////////////////////////////////////////////
interface UploadFilesArgs {
    files: FileList;
    fields: TClientUploadFileArgs;
    onProgress: (progress01: number, uploaded: number, total: number) => void;
};

async function UploadFile(args: UploadFilesArgs) {
    const formData = new FormData();
    for (let i = 0; i < args.files.length; ++i) {
        formData.append(`file_${i}`, args.files[i]!);
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
                resolve(true);
            } else {
                reject(xhr.responseText);
            }
        });
        xhr.upload.addEventListener("error", (e) => {
            reject(`upload error`);
        });
        xhr.addEventListener("error", (e) => {
            reject(xhr.responseText);
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





////////////////////////////////////////////////////////////////
interface UploadFileComponentProps {
    onFileSelect: (files: FileList) => void;
    onDragStateChange?: (isDragging: boolean) => void;
    className?: string;
}

export const UploadFileComponent = (props: UploadFileComponentProps) => {
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            props.onFileSelect(e.target.files);
            e.target.files = null; // clear 
            e.target.value = ""; // clear
        }
    };

    const openFileDialog = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    // for paste support
    React.useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            e.preventDefault();

            if ((e.clipboardData?.files?.length || 0) > 0) {
                props.onFileSelect(e.clipboardData!.files);
            }
            if ((e.clipboardData?.items?.length || 0) > 0) {
                for (let i = 0; i < e.clipboardData!.items.length; ++i) {
                    const item = e.clipboardData!.items[i]!;
                    console.log(`item ${i} : ${item.type} ${item.kind}`);
                    item.getAsString((data) => {
                        console.log(`  -> ${data}`);
                    })
                }
            }
        };

        // Attach the onPaste event listener to the entire document
        document.addEventListener('paste', handlePaste);

        return () => {
            // Remove the event listener when the component is unmounted
            document.removeEventListener('paste', handlePaste);
        };
    }, []);

    // drag & drop support

    const [isDragging, setIsDragging] = React.useState(false);

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);

        const { files } = e.dataTransfer;
        if (files.length > 0) {
            props.onFileSelect(files);
        }
    };

    React.useEffect(() => {
        props.onDragStateChange && props.onDragStateChange(isDragging);
    }, [isDragging]);



    return <div className="UploadFileComponentContainer">
        <div
            className={`UploadFileComponent interactable interactableWithBorder ${props.className}`}
            onClick={openFileDialog}
            onDragEnter={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
            onDrop={handleDrop}
        >
            <div className="UploadFileComponentInterior">
                <input
                    type="file"
                    multiple
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleFileSelect}
                />
                <FileUploadIcon />Click to select files to upload, or drag files here, or paste.
            </div>
        </div>
    </div>
};


////////////////////////////////////////////////////////////////
export interface EventFilesListProps {
    event: db3.EventClientPayload_Verbose;
    refetch: () => void;
};

export const EventFilesList = (props: EventFilesListProps) => {
    return props.event.fileTags.map((file, index) => <div key={file.id}>{file.file.fileLeafName} ({file.file.sizeBytes} bytes)</div>);
};


////////////////////////////////////////////////////////////////
export interface EventFilesTabContentProps {
    event: db3.EventClientPayload_Verbose;
    refetch: () => void;
};

export const EventFilesTabContent = (props: EventFilesTabContentProps) => {
    //const [progress, setProgress] = React.useState<string[]>([]);
    const [dragging, setDragging] = React.useState<boolean>(false);
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const publicPermissionId = API.users.getPublicPermission()!.id;

    const handleFileSelect = (files: FileList) => {
        if (files.length > 0) {
            //setProgress([...progress, `beginning upload.`]);
            UploadFile({
                fields: {
                    taggedEventId: props.event.id,
                    visiblePermissionId: publicPermissionId,
                },
                files,
                onProgress: (prog01, uploaded, total) => {
                    //console.log(`progress:${prog}, uploaded:${uploaded}, total:${total}`);
                    //setProgress([...progress, `${prog}`]);
                },
            }).then(() => {
                showSnackbar({ severity: "success", children: "file(s) uploaded" });
                props.refetch();
                //setProgress([...progress, `complete.`]);
            }).catch((e: string) => {
                console.log(e);
                showSnackbar({ severity: "error", children: `error uploading file(s) : ${e}` });
                //setProgress([...progress, `catch`]);
            });
        }
    };
    return <>
        {/* <div>progress: [{progress.map((n, index) => <span key={index}>{n}</span>)}]</div> */}
        <UploadFileComponent className={dragging ? "dragging" : "notDragging"} onFileSelect={handleFileSelect} onDragStateChange={(isDragging) => setDragging(isDragging)} />
        <EventFilesList event={props.event} refetch={props.refetch} />
        {/* <UploadFileComponent onFileSelect={handleFileSelect} /> */}
    </>;
};

