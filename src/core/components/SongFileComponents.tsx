
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { Button, Tooltip } from "@mui/material";
import React from "react";
import { StandardVariationSpec, gGeneralPaletteList } from 'shared/color';
import { Permission } from 'shared/permissions';
import { IsNullOrWhitespace, SplitQuickFilter, existsInArray, parseMimeType, smartTruncate, toggleValueInArray } from "shared/utils";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { API } from '../db3/clientAPI';
import { gCharMap, gIconMap } from "../db3/components/IconSelectDialog";
import { DB3EditObjectDialog } from '../db3/components/db3NewObjectDialog';
import { TClientFileUploadTags } from '../db3/shared/apiTypes';
import { AudioPreviewBehindButton } from './AudioPreview';
import { CMChip, CMChipContainer, CMStandardDBChip, EventChip, InstrumentChip, SongChip, UserChip } from "./CMCoreComponents";
import { CMSmallButton, NameValuePair } from './CMCoreComponents2';
import { CMDBUploadFile } from './CMDBUploadFile';
import { CMTextInputBase, SearchInput } from './CMTextField';
import { DashboardContext } from './DashboardContext';
import { FileDropWrapper, UploadFileComponent } from './FileDrop';
import { Markdown } from "./RichTextEditor";
import { VisibilityValue } from './VisibilityControl';
import { formatFileSize } from 'shared/rootroot';


type EnrichedFile = db3.EnrichedFile<db3.FileWithTagsPayload>;

// don't take maximum because it can hide your own instruments. so either handle that specifically or just don't bother hiding tags.
//const gMaximumFilterTagsPerType = 10 as const;

type SortByKey = "uploadedAt" | "uploadedByUserId" | "mimeType" | "sizeBytes" | "fileCreatedAt"; // keyof File
type TagKey = "tags" | "taggedUsers" | "taggedSongs" | "taggedEvents" | "taggedInstruments";

//////////////////////////////////////////////////////////////////

export interface FileTagBase {
    id: number;
    file: EnrichedFile;
    fileId: number;
    // plus a songId, eventId, whatever...
};




////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface FileViewerProps {
    value: EnrichedFile;
    onEnterEditMode?: () => void; // if undefined, don't allow editing.
    readonly: boolean;
    statHighlight: SortByKey;
};

export const FileValueViewer = (props: FileViewerProps) => {
    const dashboardContext = React.useContext(DashboardContext);
    //const [currentUser] = useCurrentUser();
    const file = props.value;
    const visInfo = dashboardContext.getVisibilityInfo(file);

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
            <VisibilityValue permissionId={file.visiblePermissionId} variant="minimal" />
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
    const dashboardContext = React.useContext(DashboardContext);

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

            new DB3Client.TagsFieldClient<db3.FileTagAssignmentPayload>({ columnName: "tags", cellWidth: 150, allowDeleteFromCell: false, selectStyle: 'inline' }),
            new DB3Client.TagsFieldClient<db3.FileInstrumentTagPayload>({
                columnName: "taggedInstruments", cellWidth: 150, allowDeleteFromCell: false, selectStyle: 'inline',
                overrideRowInfo: (association: db3.FileInstrumentTagPayload, rowInfo: db3.RowInfo) => {
                    // because the query doesn't include instrument functional group, get it from global dashboard context
                    const fg = dashboardContext.instrumentFunctionalGroup.getById(association.instrument.functionalGroupId);
                    if (!fg) return rowInfo;
                    return { ...rowInfo, color: gGeneralPaletteList.findEntry(fg.color) };
                }
            }),
            new DB3Client.TagsFieldClient<db3.FileUserTagPayload>({ columnName: "taggedUsers", cellWidth: 150, allowDeleteFromCell: false }),
            new DB3Client.TagsFieldClient<db3.FileSongTagPayload>({ columnName: "taggedSongs", cellWidth: 150, allowDeleteFromCell: false }),
            new DB3Client.TagsFieldClient<db3.FileEventTagPayload>({ columnName: "taggedEvents", cellWidth: 150, allowDeleteFromCell: false }),
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
            if (!spec.mimeTypes.includes(parsedMimeType?.forDisplay || "")) { // assumes mime type is the filter (no partial match or subtypes etc)
                return false;
            }
        }

        // quick filter
        if (IsNullOrWhitespace(spec.quickFilter)) return true;

        const filterTokens = SplitQuickFilter(spec.quickFilter);

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

        if (aValue === bValue) {
            return a.file.id - b.file.id;
        }
        if (aValue === null) {
            return 1;
        }
        if (bValue === null) {
            return -1;
        }

        if (typeof aValue === 'string') {
            aValue = aValue.toLowerCase();
            bValue = (bValue as string).toLowerCase();
        }

        if (aValue === bValue) {
            return a.file.id - b.file.id;
        }

        return aValue > bValue ? 1 : -1;
    });

    if (spec.sortDirection === 'desc') {
        filteredItems = filteredItems.toReversed();
    }

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

    return uniqueTags;// .slice(0, gMaximumFilterTagsPerType);
};

const CalculateUniqueMimeTypes = (props: { fileTags: FileTagBase[] }): CalculateUniqueTagsReturn<string>[] => {

    const uniqueTags: { count: number, tag: string }[] = [];

    for (var ift = 0; ift < props.fileTags.length; ++ift) {
        const ft = props.fileTags[ift]!;
        const tag = ft.file.mimeType;
        const mimeInfo = parseMimeType(tag);
        const key = mimeInfo?.forDisplay;
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

    return uniqueTags;//.slice(0, gMaximumFilterTagsPerType);
};

export const FileFilterAndSortControls = (props: FileFilterAndSortControlsProps) => {
    const dashboardContext = React.useContext(DashboardContext);

    const getInstrumentColor = (instrument: db3.InstrumentPayloadMinimum) => {
        const fg = dashboardContext.instrumentFunctionalGroup.getById(instrument.functionalGroupId);
        if (!fg) return null;
        return fg.color;
    };

    const uniqueTags = CalculateUniqueTags<db3.FileTagPayloadMinimum>({ selector: 'tags', foreignSelector: "fileTag", fileTags: props.fileTags });
    const uniqueInstrumentTags = CalculateUniqueTags<db3.InstrumentPayloadMinimum>({ selector: 'taggedInstruments', foreignSelector: "instrument", fileTags: props.fileTags });
    const uniqueEventTags = CalculateUniqueTags<db3.InstrumentPayloadMinimum>({ selector: 'taggedEvents', foreignSelector: "event", fileTags: props.fileTags });
    const uniqueUserTags = CalculateUniqueTags<db3.UserPayloadMinimum>({ selector: 'taggedUsers', foreignSelector: "user", fileTags: props.fileTags });
    const uniqueSongTags = CalculateUniqueTags<db3.SongPayloadMinimum>({ selector: 'taggedSongs', foreignSelector: "song", fileTags: props.fileTags });
    const uniqueMimeTypes = CalculateUniqueMimeTypes({ fileTags: props.fileTags });

    const sortArrow = props.value.sortDirection === 'asc' ? gCharMap.DownArrow() : gCharMap.UpArrow();

    return <div className="contentSection filterControls">
        <div className="content">
            <div className="filterControlsContainer">
                <div className="content">
                    <div className="row">
                        <div className="filterControls">

                            <div className="row quickFilter">

                                <SearchInput
                                    onChange={(value) => props.onChange({ ...props.value, quickFilter: value })}
                                    value={props.value.quickFilter}
                                    autoFocus={true}
                                />
                            </div>

                            <div className={`EventsFilterControlsValue`}>
                                <div className="row">
                                    {uniqueMimeTypes.length > 1 && <CMChipContainer>
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
                                    </CMChipContainer>}
                                </div>
                            </div>

                            <div className={`EventsFilterControlsValue`}>
                                <div className="row">
                                    {uniqueTags.length > 1 && <CMChipContainer>
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
                                    </CMChipContainer>}
                                </div>
                            </div>

                            <div className={`EventsFilterControlsValue`}>
                                <div className="row">
                                    {uniqueInstrumentTags.length > 1 && <CMChipContainer>
                                        {uniqueInstrumentTags.map(t => (
                                            <CMChip
                                                key={t.tag.id}
                                                color={getInstrumentColor(t.tag)}
                                                tooltip={t.tag.description}
                                                size='small'
                                                variation={{ ...StandardVariationSpec.Strong, selected: existsInArray(props.value.taggedInstrumentIds, t.tag.id) }}
                                                onClick={() => props.onChange({ ...props.value, taggedInstrumentIds: toggleValueInArray(props.value.taggedInstrumentIds, t.tag.id) })}
                                            >
                                                {t.tag.name} ({t.count})
                                            </CMChip>))}

                                    </CMChipContainer>}
                                </div>
                            </div>

                            <div className={`EventsFilterControlsValue`}>
                                <div className="row">
                                    {uniqueUserTags.length > 1 && <CMChipContainer>
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
                                    </CMChipContainer>}
                                </div>
                            </div>

                            <div className={`EventsFilterControlsValue`}>
                                <div className="row">
                                    {uniqueSongTags.length > 1 && <CMChipContainer>
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
                                    </CMChipContainer>}
                                </div>
                            </div>

                            <div className={`EventsFilterControlsValue`}>
                                <div className="row">
                                    {uniqueEventTags.length > 1 && <CMChipContainer>
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
                                    </CMChipContainer>}

                                </div>
                            </div>

                            <div className="divider"></div>

                            <div className="row">
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
                            </div>


                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div className="queryProgressLine idle"></div>
    </div>

};




////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface FileControlProps {
    value: EnrichedFile;
    readonly: boolean;
    refetch: () => void;
    statHighlight: SortByKey;
};

export const FileControl = (props: FileControlProps) => {
    const dashboardContext = React.useContext(DashboardContext);

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
    const dashboardContext = React.useContext(DashboardContext);

    const permissionId = dashboardContext.getDefaultVisibilityPermission().id;

    const user = useCurrentUser()[0]!;

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

    const canUploadFiles = dashboardContext.isAuthorized(Permission.upload_files);

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

    return <FileDropWrapper onFileSelect={handleFileSelect} onURLUpload={handleURLSelect} progress={progress}>
        {!props.readonly && canUploadFiles && (showUpload ? <div className="uploadControlContainer">
            <UploadFileComponent onFileSelect={handleFileSelect} progress={progress} onURLUpload={handleURLSelect} />
            <Button onClick={() => setShowUpload(false)}>Cancel</Button>
        </div> :
            <Button onClick={() => setShowUpload(true)}>Upload</Button>)
        }

        <FileFilterAndSortControls value={filterSpec} onChange={(value) => setFilterSpec(value)} fileTags={props.fileTags} />


        <div className="searchRecordCount">
            {filteredItems.length === 0 ? "No items to show" : <>Displaying {filteredItems.length} items</>}
        </div>

        {/* <NameValuePair
            isReadOnly={false}
            name={""}
            value={}
        /> */}

        <div className="EventFilesList">
            {filteredItems.map((fileTag, index) => <FileControl key={fileTag.id} readonly={props.readonly} refetch={props.refetch} value={fileTag.file} statHighlight={filterSpec.sortBy} />)}
        </div>
    </FileDropWrapper>;
};

