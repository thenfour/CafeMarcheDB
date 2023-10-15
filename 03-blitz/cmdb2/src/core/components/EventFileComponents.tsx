
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


////////////////////////////////////////////////////////////////
interface UploadFilesArgs {
    files: FileList;
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
                //console.log("upload progress:", event.loaded / event.total);
                //uploadProgress.value = event.loaded / event.total;
            }
        });
        // for download progress which we don't want...
        //   xhr.addEventListener("progress", (event) => {
        xhr.addEventListener("loadend", () => {
            //console.log(`loadend, readystate:${xhr.readyState}, status=${xhr.status}`);
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
interface FilePasteProps {
    onFileSelect: (files: FileList) => void;
}

const FileUploadPaste = (props: FilePasteProps) => {
    React.useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            e.preventDefault();

            if (e.clipboardData && e.clipboardData.items.length > 0) {
                props.onFileSelect(e.clipboardData.files);
            }
        };

        // Attach the onPaste event listener to the entire document
        document.addEventListener('paste', handlePaste);

        return () => {
            // Remove the event listener when the component is unmounted
            document.removeEventListener('paste', handlePaste);
        };
    }, []);

    return (
        <div className={`UploadFileComponent interactable`}>
            paste files to upload
        </div>
    );
};


////////////////////////////////////////////////////////////////
interface FileDropZoneProps {
    onFileSelect: (files: FileList) => void;
    onDragStateChange?: (isDragging: boolean) => void;
    className?: string;
}

const FileDropZone = (props: FileDropZoneProps) => {
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

    return (
        <div
            className={`UploadFileComponent interactable ${props.className}`}
            onDragEnter={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
            onDrop={handleDrop}
        >
            Drop file(s) here to upload
        </div>
    );
};




////////////////////////////////////////////////////////////////
interface UploadFileComponentProps {
    onFileSelect: (files: FileList) => void;
    onDragStateChange?: (isDragging: boolean) => void;
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

    return <div className="UploadFileComponent interactable" onClick={openFileDialog}>
        <input
            type="file"
            multiple
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileSelect}
        />
        <FileUploadIcon />Drop files here or click to select...
    </div>
};


////////////////////////////////////////////////////////////////
export interface EventFilesTabContentProps {
    event: db3.EventWithStatusPayload;
    refetch: () => void;
};

export const EventFilesTabContent = (props: EventFilesTabContentProps) => {
    const [progress, setProgress] = React.useState<string[]>([]);
    const [dragging, setDragging] = React.useState<boolean>(false);
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const handleFileSelect = (files: FileList) => {
        if (files.length > 0) {
            setProgress([...progress, `beginning upload.`]);
            UploadFile({
                files,
                onProgress: (prog, uploaded, total) => {
                    //console.log(`progress:${prog}, uploaded:${uploaded}, total:${total}`);
                    setProgress([...progress, `${prog}`]);
                },
            }).then(() => {
                showSnackbar({ severity: "success", children: "file(s) uploaded" });
                setProgress([...progress, `complete.`]);
            }).catch((e: string) => {
                console.log(e);
                showSnackbar({ severity: "error", children: `error uploading file(s) : ${e}` });
                setProgress([...progress, `catch`]);
            });
        }
    };
    return <>
        <div>progress: [{progress.map((n, index) => <span key={index}>{n}</span>)}]</div>
        <FileDropZone className={dragging ? "dragging" : "notDragging"} onFileSelect={handleFileSelect} onDragStateChange={(isDragging) => setDragging(isDragging)} />
        <UploadFileComponent onFileSelect={handleFileSelect} />
        <FileUploadPaste onFileSelect={handleFileSelect} />
    </>;
};

