// todo: 
// - delete
// - edit

// - preview viedos
// - preview pdf (pdf-poppler)
// - preview images (+ thumbnail)
// - avoid downloading all media just for preview. i'm thinking pre-render the peaks as a thumbnail, and only download when clicked

import React, { DragEventHandler, FC, Suspense } from "react"
import db, { Prisma } from "db";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import { API, APIQueryResult } from '../db3/clientAPI';
import { SnackbarContext } from "src/core/components/SnackbarContext";
import { RenderMuiIcon, gIconMap } from "../db3/components/IconSelectDialog";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { AudioPreview, CMChip, CMChipContainer, CMDBUploadFile, CMStandardDBChip, CMTagList, CircularProgressWithLabel, EditTextField, EventChip, InspectObject, InstrumentChip, ReactiveInputDialog, SongChip, UserChip, VisibilityControl, VisibilityValue } from "./CMCoreComponents";
import { Markdown } from "./RichTextEditor";
import { Box, Button, Checkbox, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel, InputBase, Menu, MenuItem, TextField, Typography } from "@mui/material";
import Autocomplete, { AutocompleteRenderInputParams, createFilterOptions } from '@mui/material/Autocomplete';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import { CMTextField } from "./CMTextField";
import { TAnyModel, formatSongLength, getUniqueNegativeID, moveItemInArray, parseMimeType } from "shared/utils";
import { Container, Draggable, DropResult } from "react-smooth-dnd";
import FileUploadIcon from '@mui/icons-material/FileUpload';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { getAntiCSRFToken } from "@blitzjs/auth"
import { TClientUploadFileArgs } from "../db3/shared/apiTypes";
import CircularProgress, { CircularProgressProps } from '@mui/material/CircularProgress';


/*

for the uploader, during uploads there should be a cancel button plus progress

<EventFileViewer> (no db, edit button)
<EventFileEditor> (does db work, dialog)
<EventFileControl> (delegates to viewer or editor)
<EventFilesList>
<UploadFileComponent> (add new)
<EventFilesTabContent>

*/



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface EventFileViewerProps {
    value: db3.FileWithTagsPayload;
    onEnterEditMode?: () => void; // if undefined, don't allow editing.
};

export const EventFileValueViewer = (props: EventFileViewerProps) => {
    //const [currentUser] = useCurrentUser();
    const file = props.value;
    const visInfo = API.users.getVisibilityInfo(file);

    const classes: string[] = [
        `EventFileValue EventFileValueViewer ${visInfo.className}`
    ];
    const mimeInfo = parseMimeType(file.mimeType);
    const isAudio = mimeInfo?.type === 'audio';
    if (mimeInfo) {
        if (mimeInfo.type) {
            classes.push(`mime-type-${mimeInfo.type}`);
        }
        if (mimeInfo.subtype) {
            classes.push(`mime-subtype-${mimeInfo.subtype}`);
        }
    }

    return <div className={classes.join(" ")}>

        <div className="header">
            <a target="_empty" className="downloadLink" href={API.files.getURIForFile(file)}>
                <FileDownloadIcon />
                <div className="filename">{file.fileLeafName}</div>
            </a>

            <div className="flex-spacer"></div>
            <VisibilityValue permission={file.visiblePermission} variant="minimal" />
            <Button onClick={props.onEnterEditMode} startIcon={gIconMap.Edit()}>Edit</Button>
        </div>
        <div className="content">
            <CMChipContainer>
                {(file.tags.length > 0) && (
                    file.tags.map(a => <CMStandardDBChip key={a.id} model={a.fileTag} size="small" variant="weak" />)
                )}

                {(file.taggedEvents.length > 0) && (
                    file.taggedEvents.map(a => <EventChip key={a.id} value={a.event} size="small" variant="weak" />)
                )}

                {(file.taggedUsers.length > 0) && (
                    file.taggedUsers.map(a => <UserChip key={a.id} value={a.user} size="small" variant="weak" />)
                )}

                {(file.taggedSongs.length > 0) && (
                    file.taggedSongs.map(a => <SongChip key={a.id} value={a.song} size="small" variant="weak" />)
                )}

                {(file.taggedInstruments.length > 0) && (
                    file.taggedInstruments.map(a => <InstrumentChip key={a.id} value={a.instrument} size="small" variant="weak" />)
                )}
            </CMChipContainer>


            <div className="descriptionContainer">
                <Markdown markdown={file.description} />
            </div>
            <div className="preview">
                {isAudio && <AudioPreview value={file} />}
            </div>
            <div className="stats">
                {file.sizeBytes} bytes,
                uploaded at {file.uploadedAt.toISOString()},
                {file.mimeType && <>type: {file.mimeType}</>}
            </div>
        </div>
    </div>;
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface EventFileEditorProps {
    initialValue: db3.FileWithTagsPayload;
    onClose: () => void;
    rowMode: db3.DB3RowMode;
};
export const EventFileEditor = (props: EventFileEditorProps) => {

    // make sure the caller's object doesn't get modified. esp. create a copy of the songs array so we can manipulate it. any refs we modify should not leak outside of this component.
    const initialValueCopy = { ...props.initialValue };
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const [value, setValue] = React.useState<db3.FileWithTagsPayload>(initialValueCopy);
    const currentUser = useCurrentUser()[0]!;
    const clientIntention: db3.xTableClientUsageContext = { intention: "user", mode: "primary", currentUser };

    const tableSpec = new DB3Client.xTableClientSpec({
        table: db3.xFile,
        columns: [
            // any columns that I intend to update via doUpdateMutation need to be specified here.
            // if they shouldn't be displayed to users, make a hidden version.
            new DB3Client.PKColumnClient({ columnName: "id" }),
            new DB3Client.GenericStringColumnClient({ columnName: "fileLeafName", cellWidth: 150 }),
            new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 150 }),
            new DB3Client.BoolColumnClient({ columnName: "isDeleted" }), // todo: hide this.

            new DB3Client.ForeignSingleFieldClient({ columnName: "visiblePermission", cellWidth: 120, clientIntention }),

            new DB3Client.TagsFieldClient<db3.FileTagAssignmentPayload>({ columnName: "tags", cellWidth: 150, allowDeleteFromCell: false }),
            new DB3Client.TagsFieldClient<db3.FileUserTagPayload>({ columnName: "taggedUsers", cellWidth: 150, allowDeleteFromCell: false }),
            new DB3Client.TagsFieldClient<db3.FileSongTagPayload>({ columnName: "taggedSongs", cellWidth: 150, allowDeleteFromCell: false }),
            new DB3Client.TagsFieldClient<db3.FileEventTagPayload>({ columnName: "taggedEvents", cellWidth: 150, allowDeleteFromCell: false }),
        ],
    });

    // required to initialize columns properly.
    const renderContext = DB3Client.useTableRenderContext({
        clientIntention,
        requestedCaps: DB3Client.xTableClientCaps.Mutation,
        tableSpec,
    });

    const api: DB3Client.NewDialogAPI = {
        setFieldValues: (fieldValues: TAnyModel) => {
            const newValue = { ...value, ...fieldValues };
            setValue(newValue);
        },
    };

    const validationResult = tableSpec.args.table.ValidateAndComputeDiff(value, value, props.rowMode);

    const handleSave = () => {
        renderContext.doUpdateMutation(value).then(() => {
            showSnackbar({ severity: "success", children: "file edit successful" });
        }).catch((e) => {
            console.log(e);
            showSnackbar({ severity: "error", children: "Error; see console" });
        }).finally(() => {
            props.onClose();
        });
    };

    const handleDelete = () => {
        renderContext.doUpdateMutation({ id: value.id, isDeleted: true }).then(() => {
            showSnackbar({ severity: "success", children: "file delete successful" });
        }).catch((e) => {
            console.log(e);
            showSnackbar({ severity: "error", children: "Error; see console" });
        }).finally(() => {
            props.onClose();
        });
    };

    return <>
        <ReactiveInputDialog onCancel={props.onClose} className="EventFileEditor EventFileEditor">

            <DialogTitle>
                edit file
            </DialogTitle>
            <DialogContent dividers>
                <DialogContentText>
                    description of file
                </DialogContentText>

                <div className="EventFileValue">
                    <div className="content">

                        <VisibilityControl variant="verbose" value={value.visiblePermission} onChange={(newVisiblePermission) => {
                            const newValue: db3.FileWithTagsPayload = { ...value, visiblePermission: newVisiblePermission, visiblePermissionId: newVisiblePermission?.id || null };
                            setValue(newValue);
                        }} />

                        <Button onClick={handleDelete}>{gIconMap.Delete()}Delete</Button>

                        {
                            tableSpec.args.columns.map(clientColumn => {
                                return <React.Fragment key={clientColumn.columnName}>{
                                    clientColumn.renderForNewDialog && clientColumn.renderForNewDialog({ api, key: clientColumn.columnName, validationResult, value: value[clientColumn.columnName], row: value })
                                }</React.Fragment>;
                            })
                        }
                    </div>

                </div>
            </DialogContent>
            <DialogActions>
                <Button onClick={props.onClose} startIcon={gIconMap.Cancel()}>Cancel</Button>
                <Button onClick={handleSave} startIcon={gIconMap.Save()}>OK</Button>
            </DialogActions>

        </ReactiveInputDialog>
    </>;
};







////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface EventFileControlProps {
    value: db3.FileWithTagsPayload;
    readonly: boolean;
    refetch: () => void;
};

export const EventFileControl = (props: EventFileControlProps) => {

    const [editMode, setEditMode] = React.useState<boolean>(false);

    return <>
        {editMode &&
            <EventFileEditor initialValue={props.value} onClose={() => { setEditMode(false); props.refetch() }} rowMode="update" />
        }
        <EventFileValueViewer value={props.value} onEnterEditMode={() => setEditMode(true)} />
    </>;
};


////////////////////////////////////////////////////////////////
interface UploadFileComponentProps {
    onFileSelect: (files: FileList) => void;
    progress: number | null; // 0-1 progress, or null if no upload in progress.
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
    const isBusy = props.progress !== null;

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);

        const { files } = e.dataTransfer;
        if (files.length > 0) {
            props.onFileSelect(files);
        }
    };

    const classes: string[] = [
        `UploadFileComponent interactable interactableWithBorder`,
        (!isBusy && isDragging) ? "dragging" : "notDragging",
        isBusy ? "busy" : "notBusy",
    ];

    return <div className="UploadFileComponentContainer">
        <div
            className={classes.join(" ")}
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
                {isBusy ? <CircularProgressWithLabel value={(props.progress! * 100) | 0} /> : (
                    <>
                        <FileUploadIcon />
                        <div className="instructions">
                            To upload files,
                            <ul>
                                <li>Drag & drop files here</li>
                                <li>or, Click to select files</li>
                                <li>or, Paste content</li>
                            </ul>
                        </div>
                    </>
                )}
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
    return <div className="EventFilesList">
        {props.event.fileTags.map((file, index) => <EventFileControl key={file.id} readonly={false} refetch={props.refetch} value={file.file} />)}
    </div>;
};


////////////////////////////////////////////////////////////////
export interface EventFilesTabContentProps {
    event: db3.EventClientPayload_Verbose;
    refetch: () => void;
};

export const EventFilesTabContent = (props: EventFilesTabContentProps) => {
    const [progress, setProgress] = React.useState<number | null>(null);
    const [showUpload, setShowUpload] = React.useState<boolean>(false);
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const publicPermissionId = API.users.getPublicPermission().id;

    const handleFileSelect = (files: FileList) => {
        if (files.length > 0) {
            setProgress(0);
            CMDBUploadFile({
                fields: {
                    taggedEventId: props.event.id,
                    visiblePermissionId: publicPermissionId,
                },
                files,
                onProgress: (prog01, uploaded, total) => {
                    //console.log(`progress:${prog}, uploaded:${uploaded}, total:${total}`);
                    setProgress(prog01);
                },
            }).then(() => {
                showSnackbar({ severity: "success", children: "file(s) uploaded" });
                setProgress(null);
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
        {showUpload ? <div className="uploadControlContainer">
            <UploadFileComponent onFileSelect={handleFileSelect} progress={progress} />
            <Button onClick={() => setShowUpload(false)}>Cancel</Button>
        </div> :
            <Button onClick={() => setShowUpload(true)}>Upload</Button>
        }

        <EventFilesList event={props.event} refetch={props.refetch} />
    </>;
};
