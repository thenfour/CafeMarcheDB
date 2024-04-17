
import { useAuthenticatedSession } from '@blitzjs/auth';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import { Button, Tooltip } from "@mui/material";
import React from "react";
import { StandardVariationSpec } from 'shared/color';
import { Permission } from 'shared/permissions';
import { IsNullOrWhitespace, existsInArray, formatFileSize, isValidURL, parseMimeType, smartTruncate, toggleValueInArray } from "shared/utils";
import { useAuthorization } from 'src/auth/hooks/useAuthorization';
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { API } from '../db3/clientAPI';
import { gCharMap, gIconMap } from "../db3/components/IconSelectDialog";
import { DB3EditObjectDialog } from '../db3/components/db3NewObjectDialog';
import { TClientFileUploadTags } from '../db3/shared/apiTypes';
import { AudioPreviewBehindButton } from './AudioPreview';
import { CMChip, CMChipContainer, CMDBUploadFile, CMStandardDBChip, CircularProgressWithLabel, EventChip, InstrumentChip, SongChip, UserChip } from "./CMCoreComponents";
import { CMTextInputBase } from './CMTextField';
import { Markdown } from "./RichTextEditor";
import { VisibilityValue } from './VisibilityControl';
import { CMSmallButton } from './CMCoreComponents2';

const gMaximumFilterTagsPerType = 3 as const;

type SortByKey = "uploadedAt" | "uploadedByUserId" | "mimeType" | "sizeBytes" | "fileCreatedAt"; // keyof File
type TagKey = "tags" | "taggedUsers" | "taggedSongs" | "taggedEvents" | "taggedInstruments";

//////////////////////////////////////////////////////////////////

export interface FileTagBase {
    id: number;
    file: db3.FileWithTagsPayload;
    fileId: number;
    // plus a songId, eventId, whatever...
};


////////////////////////////////////////////////////////////////
interface UploadFileComponentProps {
    onFileSelect: (files: FileList) => void;
    onURLUpload: (url: string) => void;
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
            if (!e.clipboardData) return;
            e.preventDefault();

            // pasting a URL- comes in as text/plain
            const txt = e.clipboardData.getData("text");
            if (isValidURL(txt)) {
                props.onURLUpload(txt);
                return;
            }

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
        else if (e.dataTransfer.types.includes('text/uri-list') || e.dataTransfer.types.includes('text/plain')) {
            const droppedURL = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
            if (isValidURL(droppedURL)) {
                console.log('Dropped URL:', droppedURL);
                props.onURLUpload(droppedURL);
            }
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


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface FileViewerProps {
    value: db3.FileWithTagsPayload;
    onEnterEditMode?: () => void; // if undefined, don't allow editing.
    readonly: boolean;
    statHighlight: SortByKey;
};

export const FileValueViewer = (props: FileViewerProps) => {
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

    const variation = StandardVariationSpec.Weak;

    return <div className={classes.join(" ")}>

        <div className="header">

            {file.externalURI ? (
                <a target="_empty" className="downloadLink" href={file.externalURI}>
                    {gIconMap.Link()}
                    <Tooltip title={file.fileLeafName}>
                        <div className="filename">{smartTruncate(file.fileLeafName)}</div>
                    </Tooltip>
                </a>
            ) : (
                <a target="_empty" className="downloadLink" href={API.files.getURIForFile(file)}>
                    <FileDownloadIcon />
                    <Tooltip title={file.fileLeafName}>
                        <div className="filename">{smartTruncate(file.fileLeafName)}</div>
                    </Tooltip>
                </a>)
            }

            <div className="flex-spacer"></div>
            <VisibilityValue permission={file.visiblePermission} variant="minimal" />
            {!props.readonly && <Button onClick={props.onEnterEditMode} startIcon={gIconMap.Edit()}>Edit</Button>}
        </div>
        <div className="content">
            <CMChipContainer>
                {(file.tags.length > 0) && (
                    file.tags.map(a => <CMStandardDBChip key={a.id} model={a.fileTag} size="small" variation={variation} />)
                )}

                {(file.taggedEvents.length > 0) && (
                    file.taggedEvents.map(a => <EventChip key={a.id} value={a.event} size="small" variation={variation} />)
                )}

                {(file.taggedUsers.length > 0) && (
                    file.taggedUsers.map(a => <UserChip key={a.id} value={a.user} size="small" variation={variation} />)
                )}

                {(file.taggedSongs.length > 0) && (
                    file.taggedSongs.map(a => <SongChip key={a.id} value={a.song} size="small" variation={variation} />)
                )}

                {(file.taggedInstruments.length > 0) && (
                    file.taggedInstruments.map(a => <InstrumentChip key={a.id} value={a.instrument} size="small" variation={variation} />)
                )}
            </CMChipContainer>


            <div className="descriptionContainer">
                <Markdown markdown={file.description} />
            </div>
            <div className="preview">
                {isAudio && <AudioPreviewBehindButton value={file} />}
            </div>

            <Tooltip title={<div>
                <div>uploaded at {file.uploadedAt.toLocaleString()} by {file.uploadedByUser?.name}</div>
                {file.externalURI && <div>{file.externalURI}</div>}
            </div>}>
                <div className="stats">

                    {file.externalURI &&
                        <div className="stat externalURI">
                            {smartTruncate(file.externalURI)}
                        </div>
                    }

                    {file.sizeBytes !== null && <div className={`stat ${props.statHighlight === 'sizeBytes' && "highlight"}`}>{formatFileSize(file.sizeBytes)}</div>}
                    {file.mimeType && <div className={`stat ${props.statHighlight === 'mimeType' && "highlight"}`}>{file.mimeType}</div>}
                    {file.fileCreatedAt && <div className={`stat ${props.statHighlight === 'fileCreatedAt' && "highlight"}`}>created at {file.fileCreatedAt.toLocaleString()}</div>}
                    {props.statHighlight === 'uploadedByUserId' && <div className='stat highlight'>uploaded by {file.uploadedByUser?.name}</div>}
                    {props.statHighlight === 'uploadedAt' && <div className='stat highlight'>uploaded at {file.uploadedAt.toLocaleString()}</div>}
                </div>
            </Tooltip>
        </div>
    </div>;
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface FileEditorProps {
    initialValue: db3.FileWithTagsPayload;
    onClose: () => void;
    rowMode: db3.DB3RowMode;
};
export const FileEditor = (props: FileEditorProps) => {

    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const currentUser = useCurrentUser()[0]!;
    const clientIntention: db3.xTableClientUsageContext = { intention: "user", mode: "primary", currentUser };

    const tableSpec = new DB3Client.xTableClientSpec({
        table: db3.xFile,
        columns: [
            // any columns that I intend to update via doUpdateMutation need to be specified here.
            // if they shouldn't be displayed to users, make a hidden version.
            new DB3Client.PKColumnClient({ columnName: "id" }),
            new DB3Client.ForeignSingleFieldClient({ columnName: "visiblePermission", cellWidth: 120 }),
            new DB3Client.GenericStringColumnClient({ columnName: "fileLeafName", cellWidth: 150, fieldCaption: "File name" }),
            new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 150 }),
            new DB3Client.DateTimeColumn({ columnName: "fileCreatedAt" }),
            new DB3Client.TagsFieldClient<db3.FileTagAssignmentPayload>({ columnName: "tags", cellWidth: 150, allowDeleteFromCell: false }),
            new DB3Client.TagsFieldClient<db3.FileUserTagPayload>({ columnName: "taggedUsers", cellWidth: 150, allowDeleteFromCell: false }),
            new DB3Client.TagsFieldClient<db3.FileSongTagPayload>({ columnName: "taggedSongs", cellWidth: 150, allowDeleteFromCell: false }),
            new DB3Client.TagsFieldClient<db3.FileEventTagPayload>({ columnName: "taggedEvents", cellWidth: 150, allowDeleteFromCell: false }),
            new DB3Client.TagsFieldClient<db3.FileInstrumentTagPayload>({ columnName: "taggedInstruments", cellWidth: 150, allowDeleteFromCell: false }),
        ],
    });

    return <DB3EditObjectDialog
        initialValue={props.initialValue}
        onCancel={() => props.onClose()}
        onDelete={(tableClient) => {
            tableClient.doDeleteMutation(props.initialValue.id, "softWhenPossible").then(() => {
                showSnackbar({ severity: "success", children: "file delete successful" });
            }).catch((e) => {
                console.log(e);
                showSnackbar({ severity: "error", children: "Error; see console" });
            }).finally(() => {
                props.onClose();
            });
        }}
        onOK={(value, tableClient) => {
            tableClient.doUpdateMutation(value).then(() => {
                showSnackbar({ severity: "success", children: "file edit successful" });
            }).catch((e) => {
                console.log(e);
                showSnackbar({ severity: "error", children: "Error; see console" });
            }).finally(() => {
                props.onClose();
            });
        }}
        clientIntention={clientIntention}
        table={tableSpec}
    />;
};



//////////////////////////////////////////////////////////////////
// this filtering & sorting is done at runtime, not db fetch time.
interface FileFilterAndSortSpec {
    quickFilter: string;
    tagIds: number[];
    taggedUserIds: number[];
    taggedInstrumentIds: number[];
    taggedSongIds: number[];
    taggedEventIds: number[];
    mimeTypes: string[];

    sortBy: SortByKey;
    sortDirection: "asc" | "desc";
};

function sortAndFilter(items: FileTagBase[], spec: FileFilterAndSortSpec): FileTagBase[] {

    // apply filter
    let filteredItems = items.filter(item => {
        const tagIds = item.file.tags.map(tag => tag.fileTag.id);
        if (spec.tagIds.length && !tagIds.some(id => spec.tagIds.includes(id))) return false;

        const userIds = item.file.taggedUsers.map(user => user.user.id);
        if (spec.taggedUserIds.length && !userIds.some(id => spec.taggedUserIds.includes(id))) return false;

        const instrumentIds = item.file.taggedInstruments.map(instrument => instrument.instrument.id);
        if (spec.taggedInstrumentIds.length && !instrumentIds.some(id => spec.taggedInstrumentIds.includes(id))) return false;

        const songIds = item.file.taggedSongs.map(song => song.song.id);
        if (spec.taggedSongIds.length && !songIds.some(id => spec.taggedSongIds.includes(id))) return false;

        const eventIds = item.file.taggedEvents.map(event => event.event.id);
        if (spec.taggedEventIds.length && !eventIds.some(id => spec.taggedEventIds.includes(id))) return false;

        if (spec.mimeTypes.length) {
            if (!item.file.mimeType) return false; // we're filtering mime types but this file has none.
            const parsedMimeType = parseMimeType(item.file.mimeType);
            if (!spec.mimeTypes.includes(parsedMimeType?.type || "")) { // assumes mime type is the filter (no partial match or subtypes etc)
                return false;
            }
        }

        // quick filter
        if (IsNullOrWhitespace(spec.quickFilter)) return true;

        const filterTokens = spec.quickFilter.toLocaleLowerCase().split(/\s+/).filter(token => token.length > 0);

        const tokensToSearch = [
            item.file.description.toLocaleLowerCase(),
            item.file.fileLeafName.toLocaleLowerCase(),
            item.file.taggedInstruments.map(i => i.instrument.name.toLocaleLowerCase()),
            item.file.taggedUsers.map(i => i.user.name.toLocaleLowerCase()),
            item.file.taggedEvents.map(i => i.event.name.toLocaleLowerCase()),
            item.file.taggedSongs.map(i => i.song.name.toLocaleLowerCase()),
            item.file.tags.map(i => i.fileTag.text.toLocaleLowerCase()),
        ];

        return filterTokens.every(searchToken => tokensToSearch.flat().some(t => t.includes(searchToken)));
    });

    // sort.
    filteredItems.sort((a, b) => {
        let aValue = a.file[spec.sortBy];
        let bValue = b.file[spec.sortBy];

        if (aValue === null || bValue === null) {
            if (spec.sortDirection === 'asc') {
                return aValue === null ? 1 : -1;
            }
            return aValue === null ? -1 : 1;
        }

        if (typeof aValue === 'string') {
            aValue = aValue.toLowerCase();
            bValue = (bValue as string).toLowerCase();
        }

        if (spec.sortDirection === 'asc') {
            return aValue > bValue ? 1 : (aValue < bValue ? -1 : 0);
        }
        return aValue < bValue ? 1 : (aValue > bValue ? -1 : 0);
    });

    return filteredItems;
}





interface FileFilterAndSortControlsProps {
    fileTags: FileTagBase[];
    value: FileFilterAndSortSpec;
    onChange: (value: FileFilterAndSortSpec) => void;
};

interface CalculateUniqueTagsReturn<TagPayload> {
    count: number,
    tag: TagPayload,
};

const CalculateUniqueTags = <TagPayload extends { id: number },>(props: { fileTags: FileTagBase[], selector: TagKey, foreignSelector: string }): CalculateUniqueTagsReturn<TagPayload>[] => {

    const uniqueTags: { count: number, tag: TagPayload }[] = [];

    for (var ift = 0; ift < props.fileTags.length; ++ift) {
        const ft = props.fileTags[ift]!;
        const tagsArray = ft.file[props.selector];
        if (tagsArray) {
            for (var it = 0; it < tagsArray.length; ++it) {
                const tag = tagsArray[it]!;
                const xit = uniqueTags.findIndex(ut => ut.tag.id === tag[props.foreignSelector].id);
                if (xit === -1) {
                    uniqueTags.push({
                        tag: tag[props.foreignSelector],
                        count: 1,
                    });
                } else {
                    uniqueTags[xit]!.count++;
                }
            }
        }
    }

    uniqueTags.sort((a, b) => b.count - a.count); // sort by count desc

    return uniqueTags.slice(0, gMaximumFilterTagsPerType);
};

const CalculateUniqueMimeTypes = (props: { fileTags: FileTagBase[] }): CalculateUniqueTagsReturn<string>[] => {

    const uniqueTags: { count: number, tag: string }[] = [];

    for (var ift = 0; ift < props.fileTags.length; ++ift) {
        const ft = props.fileTags[ift]!;
        const tag = ft.file.mimeType;
        const mimeInfo = parseMimeType(tag);
        const key = mimeInfo?.type;
        if (!key) continue;
        const xit = uniqueTags.findIndex(ut => ut.tag === key);
        if (xit === -1) {
            uniqueTags.push({
                tag: key,
                count: 1,
            });
        } else {
            uniqueTags[xit]!.count++;
        }
    }

    uniqueTags.sort((a, b) => b.count - a.count); // sort by count desc

    return uniqueTags.slice(0, gMaximumFilterTagsPerType);
};

export const FileFilterAndSortControls = (props: FileFilterAndSortControlsProps) => {

    const uniqueTags = CalculateUniqueTags<db3.FileTagPayloadMinimum>({ selector: 'tags', foreignSelector: "fileTag", fileTags: props.fileTags });
    const uniqueInstrumentTags = CalculateUniqueTags<db3.InstrumentPayloadMinimum>({ selector: 'taggedInstruments', foreignSelector: "instrument", fileTags: props.fileTags });
    const uniqueEventTags = CalculateUniqueTags<db3.InstrumentPayloadMinimum>({ selector: 'taggedEvents', foreignSelector: "event", fileTags: props.fileTags });
    const uniqueUserTags = CalculateUniqueTags<db3.UserPayloadMinimum>({ selector: 'taggedUsers', foreignSelector: "user", fileTags: props.fileTags });
    const uniqueSongTags = CalculateUniqueTags<db3.SongPayloadMinimum>({ selector: 'taggedSongs', foreignSelector: "song", fileTags: props.fileTags });
    const uniqueMimeTypes = CalculateUniqueMimeTypes({ fileTags: props.fileTags });

    const sortArrow = props.value.sortDirection === 'asc' ? gCharMap.DownArrow() : gCharMap.UpArrow();

    return <div className='filterAndSortControls'>
        <span className='HalfOpacity'>{gIconMap.Search()}</span>
        <CMTextInputBase value={props.value.quickFilter} onChange={(e, value) => props.onChange({ ...props.value, quickFilter: value })} />
        {!IsNullOrWhitespace(props.value.quickFilter) && <CMSmallButton onClick={() => props.onChange({ ...props.value, quickFilter: "" })}>{gIconMap.Close()}</CMSmallButton>}
        <CMChipContainer>
            {uniqueMimeTypes.map(t => (
                <CMChip
                    key={t.tag}
                    variation={{ ...StandardVariationSpec.Strong, selected: existsInArray(props.value.mimeTypes, t.tag) }}
                    tooltip={"File type"}
                    size='small'
                    onClick={() => props.onChange({ ...props.value, mimeTypes: toggleValueInArray(props.value.mimeTypes, t.tag) })}
                >
                    {t.tag} ({t.count})
                </CMChip>))}
        </CMChipContainer>

        <CMChipContainer>
            {uniqueTags.map(t => (
                <CMChip
                    key={t.tag.id}
                    color={t.tag.color}
                    tooltip={t.tag.description}
                    size='small'
                    variation={{ ...StandardVariationSpec.Strong, selected: existsInArray(props.value.tagIds, t.tag.id) }}
                    onClick={() => props.onChange({ ...props.value, tagIds: toggleValueInArray(props.value.tagIds, t.tag.id) })}
                >
                    {t.tag.text} ({t.count})
                </CMChip>))}
        </CMChipContainer>
        {<CMChipContainer>
            {uniqueInstrumentTags.map(t => (
                <CMChip
                    key={t.tag.id}
                    //color={t.tag.color}
                    tooltip={t.tag.description}
                    size='small'
                    variation={{ ...StandardVariationSpec.Strong, selected: existsInArray(props.value.taggedInstrumentIds, t.tag.id) }}
                    onClick={() => props.onChange({ ...props.value, taggedInstrumentIds: toggleValueInArray(props.value.taggedInstrumentIds, t.tag.id) })}
                >
                    {t.tag.name} ({t.count})
                </CMChip>))}

        </CMChipContainer>}
        <CMChipContainer>
            {uniqueEventTags.map(t => (
                <CMChip
                    key={t.tag.id}
                    //color={t.tag.color}
                    //tooltip={t.tag.description}
                    tooltip={"Event"}
                    size='small'
                    variation={{ ...StandardVariationSpec.Strong, selected: existsInArray(props.value.taggedEventIds, t.tag.id) }}
                    onClick={() => props.onChange({ ...props.value, taggedEventIds: toggleValueInArray(props.value.taggedEventIds, t.tag.id) })}
                >
                    {t.tag.name} ({t.count})
                </CMChip>))}
        </CMChipContainer>
        <CMChipContainer>
            {uniqueUserTags.map(t => (
                <CMChip
                    key={t.tag.id}
                    //color={t.tag.color}
                    tooltip={"User"}
                    size='small'
                    variation={{ ...StandardVariationSpec.Strong, selected: existsInArray(props.value.taggedUserIds, t.tag.id) }}
                    onClick={() => props.onChange({ ...props.value, taggedUserIds: toggleValueInArray(props.value.taggedUserIds, t.tag.id) })}
                >
                    {t.tag.name} ({t.count})
                </CMChip>))}
        </CMChipContainer>
        <CMChipContainer>
            {uniqueSongTags.map(t => (
                <CMChip
                    key={t.tag.id}
                    //color={t.tag.color}
                    size='small'
                    tooltip={"Song"}
                    variation={{ ...StandardVariationSpec.Strong, selected: existsInArray(props.value.taggedSongIds, t.tag.id) }}
                    onClick={() => props.onChange({ ...props.value, taggedSongIds: toggleValueInArray(props.value.taggedSongIds, t.tag.id) })}
                >
                    {t.tag.name} ({t.count})
                </CMChip>))}
        </CMChipContainer>
        Sort by:
        <CMChipContainer>
            <CMChip
                size='small'
                onClick={() => props.onChange({ ...props.value, sortBy: 'uploadedAt', sortDirection: props.value.sortDirection === 'asc' ? 'desc' : 'asc' })}
                variation={{ ...StandardVariationSpec.Strong, selected: props.value.sortBy === 'uploadedAt' }}
            >Upload Date {props.value.sortBy === 'uploadedAt' && sortArrow}</CMChip>
            <CMChip
                size='small'
                onClick={() => props.onChange({ ...props.value, sortBy: 'fileCreatedAt', sortDirection: props.value.sortDirection === 'asc' ? 'desc' : 'asc' })}
                variation={{ ...StandardVariationSpec.Strong, selected: props.value.sortBy === 'fileCreatedAt' }}
            >File Date {props.value.sortBy === 'fileCreatedAt' && sortArrow}</CMChip>
            <CMChip
                size='small'
                onClick={() => props.onChange({ ...props.value, sortBy: 'sizeBytes', sortDirection: props.value.sortDirection === 'asc' ? 'desc' : 'asc' })}
                variation={{ ...StandardVariationSpec.Strong, selected: props.value.sortBy === 'sizeBytes' }}
            >Size {props.value.sortBy === 'sizeBytes' && sortArrow}</CMChip>
            <CMChip
                size='small'
                onClick={() => props.onChange({ ...props.value, sortBy: 'mimeType', sortDirection: props.value.sortDirection === 'asc' ? 'desc' : 'asc' })}
                variation={{ ...StandardVariationSpec.Strong, selected: props.value.sortBy === 'mimeType' }}
            >Type {props.value.sortBy === 'mimeType' && sortArrow}</CMChip>
            <CMChip
                size='small'
                onClick={() => props.onChange({ ...props.value, sortBy: 'uploadedByUserId', sortDirection: props.value.sortDirection === 'asc' ? 'desc' : 'asc' })}
                variation={{ ...StandardVariationSpec.Strong, selected: props.value.sortBy === 'uploadedByUserId' }}
            >Uploader {props.value.sortBy === 'uploadedByUserId' && sortArrow}</CMChip>
        </CMChipContainer>
    </div>;
};




////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface FileControlProps {
    value: db3.FileWithTagsPayload;
    readonly: boolean;
    refetch: () => void;
    statHighlight: SortByKey;
};

export const FileControl = (props: FileControlProps) => {

    const [editMode, setEditMode] = React.useState<boolean>(false);

    return <>
        {!props.readonly && editMode &&
            <FileEditor initialValue={props.value} onClose={() => { setEditMode(false); props.refetch() }} rowMode="update" />
        }
        <FileValueViewer value={props.value} onEnterEditMode={() => setEditMode(true)} readonly={props.readonly} statHighlight={props.statHighlight} />
    </>;
};

////////////////////////////////////////////////////////////////
export interface FilesTabContentProps {
    fileTags: FileTagBase[];
    refetch: () => void;
    readonly: boolean;
    uploadTags: TClientFileUploadTags;
};

export const FilesTabContent = (props: FilesTabContentProps) => {
    const [progress, setProgress] = React.useState<number | null>(null);
    const [showUpload, setShowUpload] = React.useState<boolean>(false);
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const permissionId = API.users.getDefaultVisibilityPermission().id;

    const user = useCurrentUser()[0]!;
    const publicData = useAuthenticatedSession();
    const clientIntention: db3.xTableClientUsageContext = { intention: 'user', mode: 'primary', currentUser: user };

    const [filterSpec, setFilterSpec] = React.useState<FileFilterAndSortSpec>({
        quickFilter: "",
        tagIds: [],
        taggedEventIds: [],
        taggedInstrumentIds: [],
        taggedSongIds: [],
        taggedUserIds: [],
        mimeTypes: [],
        sortBy: "uploadedAt",
        sortDirection: "desc",
    });

    const canUploadFiles = useAuthorization("FilesTabContent", Permission.upload_files);

    const handleFileSelect = (files: FileList) => {
        if (files.length > 0) {
            setProgress(0);
            CMDBUploadFile({
                fields: {
                    ...props.uploadTags,
                    visiblePermissionId: permissionId,
                    externalURI: null,
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

    const handleURLSelect = (uri: string) => {
        setProgress(0);
        CMDBUploadFile({
            fields: {
                ...props.uploadTags,
                //taggedEventId: props.event.id,
                visiblePermissionId: permissionId,
                externalURI: uri,
            },
            files: null,
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
    };

    const filteredItems = sortAndFilter(props.fileTags, filterSpec);

    return <>
        {!props.readonly && canUploadFiles && (showUpload ? <div className="uploadControlContainer">
            <UploadFileComponent onFileSelect={handleFileSelect} progress={progress} onURLUpload={handleURLSelect} />
            <Button onClick={() => setShowUpload(false)}>Cancel</Button>
        </div> :
            <Button onClick={() => setShowUpload(true)}>Upload</Button>)
        }

        <DB3Client.NameValuePair
            isReadOnly={false}
            name={""}
            value={<FileFilterAndSortControls value={filterSpec} onChange={(value) => setFilterSpec(value)} fileTags={props.fileTags} />}
        />

        <div className="EventFilesList">
            {filteredItems.map((fileTag, index) => <FileControl key={fileTag.id} readonly={props.readonly} refetch={props.refetch} value={fileTag.file} statHighlight={filterSpec.sortBy} />)}
        </div>
    </>;
};

