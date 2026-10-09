import FileUploadIcon from "@mui/icons-material/FileUpload";
import { Modal } from "@mui/material";
import React from "react";
import { useLocale } from "src/locale/components/useLocale";
import { AppContextMarker } from "../AppContext";
import { CircularProgressWithLabel, CMButton } from "../CMCoreComponents2";
import { DeferredFileCreationNotice } from "./FileCreationRecoveryControls";

interface FileDropWrapperProps {
    enabled: boolean;
    className?: string;
    onFileSelect: (files: FileList) => void;
    onURLUpload: (url: string) => void;
    progress: number | null;
}

function preventDropNavigation(event: React.DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    event.stopPropagation();
}

export function FileDropWrapper(props: React.PropsWithChildren<FileDropWrapperProps>) {
    const [dragging, setDragging] = React.useState(false);
    const dragDepth = React.useRef(0);
    const { getPlainString } = useLocale();
    const available = props.enabled && props.progress === null;
    const clearDrag = React.useCallback(() => {
        dragDepth.current = 0;
        setDragging(false);
    }, []);
    React.useEffect(() => {
        if (!available) {
            clearDrag();
        }
    }, [available, clearDrag]);
    const showDragOverlay = available && dragging;
    return <div className={`${props.className ?? ""} fileDropWrapper ${showDragOverlay ? "dragging" : "notDragging"}`}
        onDragEnter={event => {
            preventDropNavigation(event);
            if (available) {
                // Entering children also emits drag events; only the final leave exits the wrapper.
                dragDepth.current += 1;
                setDragging(true);
            }
        }}
        onDragOver={event => {
            preventDropNavigation(event);
            if (available) {
                // Drag-over also restores feedback if the initial enter was missed.
                dragDepth.current = Math.max(1, dragDepth.current);
                setDragging(true);
            }
        }}
        onDragLeave={event => {
            preventDropNavigation(event);
            dragDepth.current = Math.max(0, dragDepth.current - 1);
            if (dragDepth.current === 0) {
                setDragging(false);
            }
        }}
        onDragEnd={clearDrag}
        onDrop={event => {
            preventDropNavigation(event);
            clearDrag();
            if (!available) {
                return;
            }
            if (event.dataTransfer.files.length > 0) {
                props.onFileSelect(event.dataTransfer.files);
                return;
            }
            const url = externalURL(event.dataTransfer.getData("text/uri-list") || event.dataTransfer.getData("text/plain"));
            if (url) {
                props.onURLUpload(url);
            }
        }}>
        {showDragOverlay && <div className="dragOverlay">{getPlainString("files.drop")}</div>}
        <Modal open={props.enabled && props.progress !== null} className="uploadProgressModal">
            <div className="progressContainer" role="status" aria-label={getPlainString("files.upload")}>
                <CircularProgressWithLabel variant="determinate" value={100 * (props.progress ?? 0)} className="progressIndicator" size={200} />
            </div>
        </Modal>
        {props.children}
    </div>;
}

interface UploadFileComponentProps {
    enabled: boolean;
    onFileSelect: (files: FileList) => void;
    onURLUpload?: (url: string) => void;
    progress: number | null;
    enablePaste?: boolean;
}

function externalURL(text: string): string | null {
    try {
        const url = new URL(text.trim());
        return ["https:", "http:"].includes(url.protocol) ? url.href : null;
    } catch {
        return null;
    }
}

export function UploadFileComponent(props: UploadFileComponentProps) {
    const input = React.useRef<HTMLInputElement>(null);
    const { getPlainString } = useLocale();
    const available = props.enabled && props.progress === null;
    const openFileDialog = () => {
        if (available) {
            input.current?.click();
        }
    };
    const handleFileDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openFileDialog();
        }
    };
    React.useEffect(() => {
        if (!available || props.enablePaste === false) {
            return;
        }
        const paste = (event: ClipboardEvent) => {
            // Preserve ordinary editing in inputs and rich text editors.
            if (event.target instanceof Element && event.target.closest('input, textarea, [contenteditable="true"]')) {
                return;
            }
            const data = event.clipboardData;
            if (!data) {
                return;
            }
            if (data.files.length > 0) {
                event.preventDefault();
                props.onFileSelect(data.files);
                return;
            }
            const url = externalURL(data.getData("text/plain"));
            if (url && props.onURLUpload) {
                event.preventDefault();
                props.onURLUpload(url);
            }
        };
        document.addEventListener("paste", paste);
        return () => document.removeEventListener("paste", paste);
    }, [available, props.enablePaste, props.onFileSelect, props.onURLUpload]);
    if (!props.enabled) {
        return <DeferredFileCreationNotice />;
    }
    return <div className="UploadFileComponentContainer">
        <div className={`UploadFileComponent interactable interactableWithBorder ${available ? "notBusy" : "busy"}`}
            role="button" tabIndex={available ? 0 : -1} aria-label={getPlainString("files.upload")}
            aria-disabled={!available} onClick={openFileDialog} onKeyDown={handleFileDialogKeyDown}>
            <div className="UploadFileComponentInterior">
                <input ref={input} type="file" multiple hidden disabled={!available}
                    onClick={event => event.stopPropagation()} onChange={event => {
                        if (available && event.currentTarget.files?.length) {
                            props.onFileSelect(event.currentTarget.files);
                        }
                        event.currentTarget.value = "";
                    }} />
                {props.progress !== null ? <CircularProgressWithLabel value={100 * props.progress} /> : <>
                    <FileUploadIcon />
                    <div className="instructions">
                        {getPlainString("files.uploadInstructions")}
                        <ul>
                            <li>{getPlainString("files.uploadInstructions.dragDrop")}</li>
                            <li>{getPlainString("files.uploadInstructions.choose")}</li>
                            <li>{getPlainString("files.uploadInstructions.paste")}</li>
                        </ul>
                    </div>
                </>}
            </div>
        </div>
    </div>;
}

export function CollapsableUploadFileComponent(props: UploadFileComponentProps) {
    const [open, setOpen] = React.useState(false);
    const { getPlainString } = useLocale();
    if (!props.enabled) {
        return <DeferredFileCreationNotice />;
    }
    return open ? <div className="uploadControlContainer">
        <AppContextMarker name="CollapsableUploadFileComponent"><UploadFileComponent {...props} /></AppContextMarker>
        <CMButton onClick={() => setOpen(false)}>{getPlainString("common.action.cancel")}</CMButton></div>
        : <CMButton onClick={() => setOpen(true)}>{getPlainString("files.upload")}</CMButton>;
}

// MIGRATION_RESTORE: file-creation
// Source: 1bea5a730d2f3a8c20b490681360e1c698403523:src/core/components/file/FileDrop.tsx:1-219
// Reason: Upload and image-creation paths omit band ownership, use removed global tag/instrument models and person associations, and depend on unfinished File row contracts.
// Restore: Restore multipart/external-URL uploads, public-ID band-owned associations, automatic Partition/Recording and instrument matching, image crop/rotate/resize, metadata processing, gallery bake and generic File creation with fresh transactional authorization, filesystem cleanup and localized controls; retain download behavior.
// Verification: Reactivate image authorization specifications; verify two bands, independent grants and revocation, hidden/foreign parents and associations, inactive memberships/catalogs, multipart failures and limits, file/URL/paste/drop uploads, image transforms/metadata, rollback and storage cleanup, public DTOs and built-browser workflows.
// SHA256: 4a3e6adef8c362a6799a356d2c675c9e0bb5937684f8588c916540161c3f63c4
// MIGRATION_REFERENCE_BEGIN
//
// import { Modal } from "@mui/material";
// import FileUploadIcon from '@mui/icons-material/FileUpload';
// import React from "react";
//
// import { CoerceToBoolean, isValidURL } from "shared/utils";
// import { CircularProgressWithLabel, CMButton } from "../CMCoreComponents2";
// import { AppContextMarker } from "../AppContext";
//
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// interface FileDropWrapperProps {
//     className?: string;
//     onFileSelect: (files: FileList) => void;
//     onURLUpload: (url: string) => void;
//     progress: number | null;
// };
//
// export const FileDropWrapper = (props: React.PropsWithChildren<FileDropWrapperProps>) => {
//     let [isDragging, setIsDragging] = React.useState(false);
//
//     //isDragging = true;
//
//     const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
//         e.preventDefault();
//         e.stopPropagation();
//         setIsDragging(false);
//
//         const { files } = e.dataTransfer;
//         if (files.length > 0) {
//             props.onFileSelect(files);
//         }
//         else if (e.dataTransfer.types.includes('text/uri-list') || e.dataTransfer.types.includes('text/plain')) {
//             const droppedURL = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
//             if (isValidURL(droppedURL)) {
//                 console.log('Dropped URL:', droppedURL);
//                 props.onURLUpload(droppedURL);
//             }
//         }
//     };
//
//     return <div
//         className={`${props.className} ${isDragging ? "dragging" : "notDragging"} fileDropWrapper`}
//         onDragEnter={(e) => {
//             e.preventDefault(); e.stopPropagation();
//             setIsDragging(true);
//         }}
//         onDragOver={(e) => {
//             e.preventDefault(); e.stopPropagation();
//             setIsDragging(true);
//         }}
//         onDragLeave={(e) => {
//             e.preventDefault(); e.stopPropagation();
//             setIsDragging(false);
//         }}
//         onDrop={handleDrop}
//     >
//         {(isDragging) && <div className='dragOverlay'>Upload files... {props.progress}</div>}
//
//         <Modal
//             open={!!props.progress}
//             className='uploadProgressModal'
//         >
//             <div className='progressContainer'>
//                 <CircularProgressWithLabel
//                     variant='determinate'
//                     value={100 * (props.progress || 0)}
//                     className='progressIndicator'
//                     size={200}
//                 />
//             </div>
//         </Modal>
//         {props.children}
//     </div>;
// };
//
//
// ////////////////////////////////////////////////////////////////
// interface UploadFileComponentProps {
//     onFileSelect: (files: FileList) => void;
//     onURLUpload?: (url: string) => void;
//     progress: number | null; // 0-1 progress, or null if no upload in progress.
//     enablePaste?: boolean;
// }
//
// export const UploadFileComponent = (props: UploadFileComponentProps) => {
//     const fileInputRef = React.useRef<HTMLInputElement | null>(null);
//     const enablePaste = CoerceToBoolean(props.enablePaste, true);
//
//     const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
//         if (e.target.files) {
//             props.onFileSelect(e.target.files);
//             e.target.files = null; // clear
//             e.target.value = ""; // clear
//         }
//     };
//     //const [isBusy, setIsBusy] = React.useState(false);
//
//     const openFileDialog = () => {
//         //setIsBusy(!isBusy);
//         if (fileInputRef.current) {
//             fileInputRef.current.click();
//         }
//     };
//
//     // for paste support
//     React.useEffect(() => {
//         const handlePaste = (e: ClipboardEvent) => {
//             if (!e.clipboardData) return;
//             e.preventDefault();
//
//             // pasting a URL- comes in as text/plain
//             if (props.onURLUpload) {
//                 const txt = e.clipboardData.getData("text");
//                 if (isValidURL(txt)) {
//                     props.onURLUpload(txt);
//                     return;
//                 }
//             }
//
//             if ((e.clipboardData?.files?.length || 0) > 0) {
//                 props.onFileSelect(e.clipboardData!.files);
//             }
//             // if ((e.clipboardData?.items?.length || 0) > 0) {
//             //     for (let i = 0; i < e.clipboardData!.items.length; ++i) {
//             //         const item = e.clipboardData!.items[i]!;
//             //         console.log(`item ${i} : ${item.type} ${item.kind}`);
//             //         item.getAsString((data) => {
//             //             console.log(`  -> ${data}`);
//             //         })
//             //     }
//             // }
//         };
//
//         // Attach the onPaste event listener to the entire document
//         if (enablePaste) {
//             document.addEventListener('paste', handlePaste);
//             return () => {
//                 // Remove the event listener when the component is unmounted
//                 document.removeEventListener('paste', handlePaste);
//             };
//         }
//
//     }, [enablePaste]);
//
//     // drag & drop support
//     //const [isDragging, setIsDragging] = React.useState(false);
//     const isBusy = props.progress !== null;
//
//     // const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
//     //     e.preventDefault();
//     //     setIsDragging(false);
//
//     //     const { files } = e.dataTransfer;
//     //     if (files.length > 0) {
//     //         props.onFileSelect(files);
//     //     }
//     //     else if (e.dataTransfer.types.includes('text/uri-list') || e.dataTransfer.types.includes('text/plain')) {
//     //         const droppedURL = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
//     //         if (isValidURL(droppedURL)) {
//     //             console.log('Dropped URL:', droppedURL);
//     //             props.onURLUpload(droppedURL);
//     //         }
//     //     }
//     // };
//
//     const classes: string[] = [
//         `UploadFileComponent interactable interactableWithBorder`,
//         //(!isBusy && isDragging) ? "dragging" : "notDragging",
//         isBusy ? "busy" : "notBusy",
//     ];
//
//     return <div className="UploadFileComponentContainer">
//         <div
//             className={classes.join(" ")}
//             onClick={openFileDialog}
//         // onDragEnter={(e) => { e.preventDefault(); setIsDragging(true) }}
//         // onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
//         // onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
//         // onDrop={handleDrop}
//         >
//             <div className="UploadFileComponentInterior">
//                 <input
//                     type="file"
//                     multiple
//                     ref={fileInputRef}
//                     style={{ display: 'none' }}
//                     onChange={handleFileSelect}
//                 />
//                 {isBusy ? <CircularProgressWithLabel value={(props.progress! * 100) | 0} /> : (
//                     <>
//                         <FileUploadIcon />
//                         <div className="instructions">
//                             To upload files,
//                             <ul>
//                                 <li>Drag & drop files or URLs here</li>
//                                 <li>or, Click to select files</li>
//                                 <li>or, Paste files/images/URLs</li>
//                             </ul>
//                         </div>
//                     </>
//                 )}
//             </div>
//         </div>
//     </div>
// };
//
// // does NOT have the file upload wrapper.
// export const CollapsableUploadFileComponent = (props: UploadFileComponentProps) => {
//     const [showUpload, setShowUpload] = React.useState<boolean>(false);
//
//     return (showUpload ? <div className="uploadControlContainer">
//         <AppContextMarker name="CollapsableUploadFileComponent">
//             <UploadFileComponent {...props} />
//         </AppContextMarker>
//         <CMButton onClick={() => setShowUpload(false)}>Cancel</CMButton>
//     </div> :
//         <CMButton onClick={() => setShowUpload(true)}>Upload</CMButton>)
//
// };
// MIGRATION_REFERENCE_END
