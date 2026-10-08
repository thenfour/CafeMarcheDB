import React from "react";
import { DeferredFileCreationNotice } from "./FileCreationRecoveryControls";

interface FileDropWrapperProps {
    className?: string;
    onFileSelect: (files: FileList) => void;
    onURLUpload: (url: string) => void;
    progress: number | null;
}

function preventDeferredDrop(event: React.DragEvent<HTMLDivElement>): void {
    // Keep dropping a local file from navigating away from unsaved content.
    event.preventDefault();
    event.stopPropagation();
}

export function FileDropWrapper(props: React.PropsWithChildren<FileDropWrapperProps>) {
    return <div className={`${props.className ?? ""} fileDropWrapper`} onDragOver={preventDeferredDrop} onDrop={preventDeferredDrop}>
        {props.children}
    </div>;
}

interface UploadFileComponentProps {
    onFileSelect: (files: FileList) => void;
    onURLUpload?: (url: string) => void;
    progress: number | null;
    enablePaste?: boolean;
}

export function UploadFileComponent(_props: UploadFileComponentProps) {
    return <DeferredFileCreationNotice />;
}

export function CollapsableUploadFileComponent(_props: UploadFileComponentProps) {
    return <DeferredFileCreationNotice />;
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
