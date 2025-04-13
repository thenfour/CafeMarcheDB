
import { Button, Modal } from "@mui/material";
import FileUploadIcon from '@mui/icons-material/FileUpload';
import React from "react";

import { CoerceToBoolean, isValidURL } from "shared/utils";
import { CircularProgressWithLabel } from "./CMCoreComponents2";
import { AppContextMarker } from "./AppContext";

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface FileDropWrapperProps {
    className?: string;
    onFileSelect: (files: FileList) => void;
    onURLUpload: (url: string) => void;
    progress: number | null;
};

export const FileDropWrapper = (props: React.PropsWithChildren<FileDropWrapperProps>) => {
    let [isDragging, setIsDragging] = React.useState(false);

    //isDragging = true;

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const { files } = e.dataTransfer;
        if (files.length > 0) {
            props.onFileSelect(files);
        }
        else if (e.dataTransfer.types.includes('text/uri-list') || e.dataTransfer.types.includes('text/plain')) {
            const droppedURL = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
            if (isValidURL(droppedURL)) {
                console.log('Dropped URL:', droppedURL);
                props.onURLUpload(droppedURL);
            }
        }
    };

    return <div
        className={`${props.className} ${isDragging ? "dragging" : "notDragging"} fileDropWrapper`}
        onDragEnter={(e) => {
            e.preventDefault(); e.stopPropagation();
            setIsDragging(true);
        }}
        onDragOver={(e) => {
            e.preventDefault(); e.stopPropagation();
            setIsDragging(true);
        }}
        onDragLeave={(e) => {
            e.preventDefault(); e.stopPropagation();
            setIsDragging(false);
        }}
        onDrop={handleDrop}
    >
        {(isDragging) && <div className='dragOverlay'>Upload files... {props.progress}</div>}

        <Modal
            open={!!props.progress}
            className='uploadProgressModal'
        >
            <div className='progressContainer'>
                <CircularProgressWithLabel
                    variant='determinate'
                    value={100 * (props.progress || 0)}
                    className='progressIndicator'
                    size={200}
                />
            </div>
        </Modal>
        {props.children}
    </div>;
};


////////////////////////////////////////////////////////////////
interface UploadFileComponentProps {
    onFileSelect: (files: FileList) => void;
    onURLUpload?: (url: string) => void;
    progress: number | null; // 0-1 progress, or null if no upload in progress.
    enablePaste?: boolean;
}

export const UploadFileComponent = (props: UploadFileComponentProps) => {
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);
    const enablePaste = CoerceToBoolean(props.enablePaste, true);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            props.onFileSelect(e.target.files);
            e.target.files = null; // clear
            e.target.value = ""; // clear
        }
    };
    //const [isBusy, setIsBusy] = React.useState(false);

    const openFileDialog = () => {
        //setIsBusy(!isBusy);
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    // for paste support
    React.useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            if (!e.clipboardData) return;
            e.preventDefault();

            // pasting a URL- comes in as text/plain
            if (props.onURLUpload) {
                const txt = e.clipboardData.getData("text");
                if (isValidURL(txt)) {
                    props.onURLUpload(txt);
                    return;
                }
            }

            if ((e.clipboardData?.files?.length || 0) > 0) {
                props.onFileSelect(e.clipboardData!.files);
            }
            // if ((e.clipboardData?.items?.length || 0) > 0) {
            //     for (let i = 0; i < e.clipboardData!.items.length; ++i) {
            //         const item = e.clipboardData!.items[i]!;
            //         console.log(`item ${i} : ${item.type} ${item.kind}`);
            //         item.getAsString((data) => {
            //             console.log(`  -> ${data}`);
            //         })
            //     }
            // }
        };

        // Attach the onPaste event listener to the entire document
        if (enablePaste) {
            document.addEventListener('paste', handlePaste);
            return () => {
                // Remove the event listener when the component is unmounted
                document.removeEventListener('paste', handlePaste);
            };
        }

    }, [enablePaste]);

    // drag & drop support
    //const [isDragging, setIsDragging] = React.useState(false);
    const isBusy = props.progress !== null;

    // const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    //     e.preventDefault();
    //     setIsDragging(false);

    //     const { files } = e.dataTransfer;
    //     if (files.length > 0) {
    //         props.onFileSelect(files);
    //     }
    //     else if (e.dataTransfer.types.includes('text/uri-list') || e.dataTransfer.types.includes('text/plain')) {
    //         const droppedURL = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    //         if (isValidURL(droppedURL)) {
    //             console.log('Dropped URL:', droppedURL);
    //             props.onURLUpload(droppedURL);
    //         }
    //     }
    // };

    const classes: string[] = [
        `UploadFileComponent interactable interactableWithBorder`,
        //(!isBusy && isDragging) ? "dragging" : "notDragging",
        isBusy ? "busy" : "notBusy",
    ];

    return <div className="UploadFileComponentContainer">
        <div
            className={classes.join(" ")}
            onClick={openFileDialog}
        // onDragEnter={(e) => { e.preventDefault(); setIsDragging(true) }}
        // onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        // onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
        // onDrop={handleDrop}
        >
            <div className="UploadFileComponentInterior">
                <input
                    type="file"
                    multiple
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleFileSelect}
                />
                {isBusy ? <CircularProgressWithLabel value={(props.progress! * 100) | 0} /> : (
                    <>
                        <FileUploadIcon />
                        <div className="instructions">
                            To upload files,
                            <ul>
                                <li>Drag & drop files or URLs here</li>
                                <li>or, Click to select files</li>
                                <li>or, Paste files/images/URLs</li>
                            </ul>
                        </div>
                    </>
                )}
            </div>
        </div>
    </div>
};

// does NOT have the file upload wrapper.
export const CollapsableUploadFileComponent = (props: UploadFileComponentProps) => {
    const [showUpload, setShowUpload] = React.useState<boolean>(false);

    return (showUpload ? <div className="uploadControlContainer">
        <AppContextMarker name="CollapsableUploadFileComponent">
            <UploadFileComponent {...props} />
        </AppContextMarker>
        <Button onClick={() => setShowUpload(false)}>Cancel</Button>
    </div> :
        <Button onClick={() => setShowUpload(true)}>Upload</Button>)

};

