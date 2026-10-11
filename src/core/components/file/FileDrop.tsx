import FileUploadIcon from "@mui/icons-material/FileUpload";
import { Alert, Modal } from "@mui/material";
import React from "react";
import { useLocale } from "src/locale/components/useLocale";
import { AppContextMarker } from "../AppContext";
import { CircularProgressWithLabel, CMButton } from "../CMCoreComponents2";

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

function FileUploadUnavailableNotice() {
    const { getPlainString } = useLocale();
    return <Alert severity="info">{getPlainString("files.uploadUnavailable")}</Alert>;
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
        return <FileUploadUnavailableNotice />;
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
        return <FileUploadUnavailableNotice />;
    }
    return open ? <div className="uploadControlContainer">
        <AppContextMarker name="CollapsableUploadFileComponent"><UploadFileComponent {...props} /></AppContextMarker>
        <CMButton onClick={() => setOpen(false)}>{getPlainString("common.action.cancel")}</CMButton></div>
        : <CMButton onClick={() => setOpen(true)}>{getPlainString("files.upload")}</CMButton>;
}
