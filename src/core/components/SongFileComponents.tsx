
import { useMutation } from '@blitzjs/rpc';
import { PushPin } from '@mui/icons-material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { Button, Divider, ListItemIcon, MenuItem, Tooltip } from "@mui/material";
import React from "react";
import { existsInArray, toggleValueInArray } from 'shared/arrayUtils';
import { Permission } from 'shared/permissions';
import { SplitQuickFilter } from 'shared/quickFilter';
import { SortDirection, formatFileSize } from 'shared/rootroot';
import { IsNullOrWhitespace, parseMimeType, smartTruncate } from "shared/utils";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { SnackbarContext, useSnackbar } from "src/core/components/SnackbarContext";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { getURIForFile, getURIForFileLandingPage } from '../db3/clientAPILL';
import { gCharMap, gIconMap } from '../db3/components/IconMap';
import { DB3EditObjectDialog } from '../db3/components/db3NewObjectDialog';
import updateSongPinnedRecording from '../db3/mutations/updateSongPinnedRecording';
import { TClientFileUploadTags } from '../db3/shared/apiTypes';
import { AppContextMarker } from './AppContext';
import { CMChip, CMChipContainer, CMStandardDBChip } from './CMChip';
import { InstrumentChip, SongChip, WikiPageChip } from "./CMCoreComponents";
import { DotMenu } from './CMCoreComponents2';
import { CMLink } from './CMLink';
import { SearchInput } from './CMTextField';
import { DashboardContext, useDashboardContext, useFeatureRecorder } from './DashboardContext';
import { VisibilityValue } from './VisibilityControl';
import { EventChip } from './event/EventChips';
import { ActivityFeature } from './featureReports/activityTracking';
import { CMDBUploadFile } from './file/CMDBUploadFile';
import { FileDropWrapper, UploadFileComponent } from './file/FileDrop';
import { Markdown } from "./markdown/Markdown";
import { AnimatedFauxEqualizer } from './mediaPlayer/MediaPlayerBar';
import { useMediaPlayer } from './mediaPlayer/MediaPlayerContext';
import { MediaPlayerEventContextPayload, MediaPlayerSongContextPayload } from './mediaPlayer/MediaPlayerTypes';
import { UserChip } from './user/userChip';
import { gGeneralPaletteList, StandardVariationSpec } from './color/palette';


type EnrichedFile = db3.EnrichedFile<db3.FileWithTagsPayload>;

// don't take maximum because it can hide your own instruments. so either handle that specifically or just don't bother hiding tags.
//const gMaximumFilterTagsPerType = 10 as const;

type SortByKey = "uploadedAt" | "uploadedByUserId" | "mimeType" | "sizeBytes" | "fileCreatedAt" | "fileLeafName"; // keyof File
type TagKey = "tags" | "taggedUsers" | "taggedSongs" | "taggedEvents" | "taggedInstruments" | "taggedWikiPages";

//////////////////////////////////////////////////////////////////

export interface FileTagBase {
    id: number;
    file: EnrichedFile;
    fileId: number;
    // plus a songId, eventId, whatever...
};

//////////////////////////////////////////////////////////////////
interface PinSongRecordingMenuItemProps {
    value: EnrichedFile;
    contextSong: MediaPlayerSongContextPayload;
    closeProc: () => void; // proc to close the menu.
    refetch?: () => void; // optional, if provided, will be called after pinning the file.
};

export const PinSongRecordingMenuItem = (props: PinSongRecordingMenuItemProps) => {
    const dashboardContext = useDashboardContext();
    const snackbar = useSnackbar();
    const [pinMutation] = useMutation(updateSongPinnedRecording);
    const recordFeature = useFeatureRecorder();

    if (!dashboardContext.isAuthorized(Permission.pin_song_recordings)) {
        return null;
    }

    return <MenuItem
        onClick={async () => {
            await snackbar.invokeAsync(async () => {
                await pinMutation({
                    songId: props.contextSong.id,
                    fileId: props.value.id,
                });
                if (props.refetch) {
                    void props.refetch();
                }
                void recordFeature({
                    feature: ActivityFeature.song_pin_recording,
                    fileId: props.value.id,
                    songId: props.contextSong.id,
                });
                props.closeProc();
            },
                "File pinned successfully");
        }}
    >
        <ListItemIcon><PushPin /></ListItemIcon>
        Pin as song recording
    </MenuItem>;
}

export const UnpinSongRecordingMenuItem = (props: Omit<PinSongRecordingMenuItemProps, "value">) => {
    const dashboardContext = useDashboardContext();
    const snackbar = useSnackbar();
    const [pinMutation] = useMutation(updateSongPinnedRecording);
    const recordFeature = useFeatureRecorder();

    if (!dashboardContext.isAuthorized(Permission.pin_song_recordings)) {
        return null;
    }

    return <MenuItem
        onClick={async () => {
            await snackbar.invokeAsync(async () => {
                await pinMutation({
                    songId: props.contextSong.id,
                    fileId: null,
                });
                if (props.refetch) {
                    void props.refetch();
                }
                void recordFeature({
                    feature: ActivityFeature.song_pin_recording,
                    songId: props.contextSong.id,
                });
                props.closeProc();
            },
                "File unpinned successfully");
        }}
    >
        {/* <ListItemIcon><PushPin /></ListItemIcon> */}
        Unpin as song recording
    </MenuItem>;
}


export const FileExternalLink = ({ file, highlight }: { file: EnrichedFile, highlight?: boolean }) => {
    const filenameClass = highlight ? "filename highlight" : "filename";

    return file.externalURI ? (
        <CMLink trackingFeature={ActivityFeature.file_download} target="_empty" className="downloadLink" href={file.externalURI}>
            {gIconMap.Link()}
            <Tooltip title={file.fileLeafName}>
                <div className={filenameClass}>{smartTruncate(file.fileLeafName)}</div>
            </Tooltip>
        </CMLink>
    ) : (
        <CMLink trackingFeature={ActivityFeature.file_download} target="_empty" className="downloadLink" href={getURIForFile(file)}>
            <FileDownloadIcon />
            <Tooltip title={file.fileLeafName}>
                <div className={filenameClass}>{smartTruncate(file.fileLeafName)}</div>
            </Tooltip>
        </CMLink>)

};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface FileViewerProps {
    value: EnrichedFile;
    onEnterEditMode?: () => void; // if undefined, don't allow editing.
    readonly: boolean;
    statHighlight: SortByKey;
    contextEvent?: MediaPlayerEventContextPayload;
    contextSong?: MediaPlayerSongContextPayload;
    refetch?: () => void;
};

export const FileValueViewer = (props: FileViewerProps) => {
    const endMenuItemRef = React.useRef<() => void>(() => { });
    const dashboardContext = useDashboardContext();
    const snackbar = useSnackbar();
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
    const uri = file.externalURI || getURIForFile(file);

    const isPinned = props.contextSong?.pinnedRecordingId === file.id;

    return <div className={classes.join(" ")}>
        <AppContextMarker fileId={props.value.id}>

            <div className="header">

                <FileExternalLink file={file} highlight={props.statHighlight === 'fileLeafName'} />

                <div className="flex-spacer"></div>

                <VisibilityValue permissionId={file.visiblePermissionId} variant="minimal" />

                {isPinned && <Tooltip title="This file is pinned as the song recording for this song">
                    <PushPin className='pinnedFile' />
                </Tooltip>}
                {/* {!props.readonly && <Button onClick={props.onEnterEditMode} startIcon={gIconMap.Edit()}>Edit</Button>} */}

                <DotMenu setCloseMenuProc={(proc) => endMenuItemRef.current = proc}>
                    {!props.readonly && props.onEnterEditMode && <MenuItem
                        onClick={() => {
                            endMenuItemRef.current();
                            props.onEnterEditMode!();
                        }}>
                        <ListItemIcon>{gIconMap.Edit()}</ListItemIcon>
                        Edit
                    </MenuItem>}
                    <MenuItem
                        onClick={async () => {
                            await snackbar.invokeAsync(async () => {
                                await navigator.clipboard.writeText(uri);
                                endMenuItemRef.current();
                            }, "Link copied to clipboard");
                        }}>
                        <ListItemIcon>{gIconMap.Share()}</ListItemIcon>
                        Copy link
                    </MenuItem>
                    <MenuItem
                        onClick={async () => {
                            await snackbar.invokeAsync(async () => {
                                const markdownLink = `[${file.fileLeafName}](${uri})`;
                                await navigator.clipboard.writeText(markdownLink);
                                endMenuItemRef.current();
                            }, "Link copied to clipboard");
                        }}>
                        <ListItemIcon>{gIconMap.Share()}</ListItemIcon>
                        <div>
                            <div>Copy markdown link</div>
                            <div style={{ fontSize: '0.8em', color: '#666', marginTop: '2px' }}>
                                can be pasted in a markdown text field
                            </div>
                        </div>
                    </MenuItem>
                    <Divider />
                    {!isPinned && isAudio && props.contextSong &&
                        <PinSongRecordingMenuItem contextSong={props.contextSong} value={props.value} closeProc={() => {
                            endMenuItemRef.current();
                        }} refetch={props.refetch} />}
                    {isPinned &&
                        <UnpinSongRecordingMenuItem contextSong={props.contextSong!} closeProc={() => {
                            endMenuItemRef.current();
                        }} refetch={props.refetch} />}
                    <Divider />
                    {dashboardContext.isAuthorized(Permission.access_file_landing_page) &&
                        <MenuItem>
                            <ListItemIcon>{gIconMap.Link()}</ListItemIcon>
                            <CMLink href={getURIForFileLandingPage(file)}>Visit file landing page</CMLink>
                        </MenuItem>
                    }
                </DotMenu>
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

                    {(file.taggedWikiPages.length > 0) && (
                        file.taggedWikiPages.map(a => <WikiPageChip key={a.id} slug={a.wikiPage.slug} size="small" variation={variation} />)
                    )}
                </CMChipContainer>


                <div className="descriptionContainer">
                    <Markdown markdown={file.description} />
                </div>

                {/* <div className="preview">
                    {isAudio && <AudioPreviewBehindButton value={file} />}
                </div> */}

                {isAudio && <div className="mediaControls">
                    <AudioPlayerFileControls file={file} song={props.contextSong} event={props.contextEvent} />
                </div>}


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
        </AppContextMarker>
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
    const recordFeature = useFeatureRecorder();

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
            new DB3Client.TagsFieldClient<db3.FileEventTagPayload>({
                columnName: "taggedEvents",
                cellWidth: 150,
                allowDeleteFromCell: false,
                renderAsChip: (args) => {
                    if (!args.value) {
                        return <CMChip>--</CMChip>
                    }
                    return <EventChip value={args.value.event} />;
                },
                renderAsListItem: (props, value, selected) => {
                    return <EventChip value={value.event} />;
                }
            }),
            new DB3Client.TagsFieldClient<db3.FileWikiPageTagPayload>({ columnName: "taggedWikiPages", cellWidth: 150, allowDeleteFromCell: false }),
        ],
    });

    return <DB3EditObjectDialog
        initialValue={props.initialValue}
        onCancel={() => props.onClose()}
        onDelete={(tableClient) => {
            void recordFeature({
                feature: ActivityFeature.file_delete,
                fileId: props.initialValue.id,
            });
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
            void recordFeature({
                feature: ActivityFeature.file_edit,
                fileId: props.initialValue.id,
            });
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
    taggedWikiPageIds: number[];
    mimeTypes: string[];

    sortBy: SortByKey;
    sortDirection: SortDirection;
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

        const wikiPageIds = item.file.taggedWikiPages.map(wikiPage => wikiPage.wikiPage.id);
        if (spec.taggedWikiPageIds.length && !wikiPageIds.some(id => spec.taggedWikiPageIds.includes(id))) return false;

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
            item.file.taggedWikiPages.map(i => i.wikiPage.slug.toLocaleLowerCase()),
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
        filteredItems = filteredItems.reverse();
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
    const uniqueWikiPageTags = CalculateUniqueTags<db3.WikiPagePayload>({ selector: 'taggedWikiPages', foreignSelector: "wikiPage", fileTags: props.fileTags });
    const uniqueMimeTypes = CalculateUniqueMimeTypes({ fileTags: props.fileTags });

    const sortedInstrumentTags = dashboardContext.sortInstruments(uniqueInstrumentTags.map(t => ({ count: t.count, ...t.tag })));

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
                                //autoFocus={true} // see #408
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
                                    {sortedInstrumentTags.length > 1 && <CMChipContainer>
                                        {sortedInstrumentTags.map(t => (
                                            <CMChip
                                                key={t.id}
                                                color={getInstrumentColor(t)}
                                                //tooltip={t.description}
                                                size={dashboardContext.currentUser?.instruments.some(yi => yi.instrumentId === t.id) ? 'big' : 'small'}
                                                variation={{ ...StandardVariationSpec.Strong, selected: existsInArray(props.value.taggedInstrumentIds, t.id) }}
                                                onClick={() => props.onChange({ ...props.value, taggedInstrumentIds: toggleValueInArray(props.value.taggedInstrumentIds, t.id) })}
                                            >
                                                {t.name} ({t.count})
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

                            <div className={`EventsFilterControlsValue`}>
                                <div className="row">
                                    {uniqueWikiPageTags.length > 1 && <CMChipContainer>
                                        {uniqueWikiPageTags.map(t => (
                                            <CMChip
                                                key={t.tag.id}
                                                tooltip={"Wiki Page"}
                                                size='small'
                                                variation={{ ...StandardVariationSpec.Strong, selected: existsInArray(props.value.taggedWikiPageIds, t.tag.id) }}
                                                onClick={() => props.onChange({ ...props.value, taggedWikiPageIds: toggleValueInArray(props.value.taggedWikiPageIds, t.tag.id) })}
                                            >
                                                {t.tag.slug} ({t.count})
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
                                        onClick={() => props.onChange({ ...props.value, sortBy: 'fileLeafName', sortDirection: props.value.sortDirection === 'asc' ? 'desc' : 'asc' })}
                                        variation={{ ...StandardVariationSpec.Strong, selected: props.value.sortBy === 'fileLeafName' }}
                                    >Filename {props.value.sortBy === 'fileLeafName' && sortArrow}</CMChip>
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
    contextEvent?: MediaPlayerEventContextPayload;
    contextSong?: MediaPlayerSongContextPayload;
};

export const FileControl = (props: FileControlProps) => {
    //const dashboardContext = React.useContext(DashboardContext);

    const [editMode, setEditMode] = React.useState<boolean>(false);

    return <>
        {!props.readonly && editMode &&
            <FileEditor initialValue={props.value} onClose={() => { setEditMode(false); props.refetch() }} rowMode="update" />
        }
        <FileValueViewer
            value={props.value}
            onEnterEditMode={() => setEditMode(true)}
            readonly={props.readonly}
            statHighlight={props.statHighlight}
            contextEvent={props.contextEvent}
            contextSong={props.contextSong}
            refetch={props.refetch}
        />
    </>;
};

////////////////////////////////////////////////////////////////
export interface FilesTabContentProps {
    fileTags: FileTagBase[];
    refetch: () => void;
    readonly: boolean;
    uploadTags: TClientFileUploadTags;
    contextEvent?: MediaPlayerEventContextPayload;
    contextSong?: MediaPlayerSongContextPayload;
};

export const FilesTabContent = (props: FilesTabContentProps) => {
    const [progress, setProgress] = React.useState<number | null>(null);
    const [showUpload, setShowUpload] = React.useState<boolean>(false);
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const dashboardContext = React.useContext(DashboardContext);
    const recordFeature = useFeatureRecorder();

    const permissionId = dashboardContext.getDefaultVisibilityPermission().id;

    //const user = useCurrentUser()[0]!;

    const [filterSpec, setFilterSpec] = React.useState<FileFilterAndSortSpec>({
        quickFilter: "",
        tagIds: [],
        taggedEventIds: [],
        taggedInstrumentIds: [],
        taggedSongIds: [],
        taggedUserIds: [],
        taggedWikiPageIds: [],
        mimeTypes: [],
        sortBy: "uploadedAt",
        sortDirection: "desc",
    });

    const canUploadFiles = dashboardContext.isAuthorized(Permission.upload_files);

    const handleFileSelect = (files: FileList) => {
        if (files.length > 0) {
            setProgress(0);

            void recordFeature({
                feature: ActivityFeature.file_upload,
            });

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

        void recordFeature({
            feature: ActivityFeature.file_upload_url,
        });

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

        <div className="EventFilesList">
            {filteredItems.map((fileTag, index) => <FileControl
                key={fileTag.id}
                readonly={props.readonly}
                refetch={props.refetch}
                value={fileTag.file}
                statHighlight={filterSpec.sortBy}
                contextEvent={props.contextEvent}
                contextSong={props.contextSong}
            />)}
        </div>
    </FileDropWrapper>;
};




// File-specific audio controls that use the global media player
type AudioPlayerFileControlsProps = {
    file: db3.FileWithTagsPayload,
    song?: MediaPlayerSongContextPayload | undefined,
    event?: MediaPlayerEventContextPayload | undefined,
};

export function AudioPlayerFileControls({ file, song, event }: AudioPlayerFileControlsProps) {
    const mediaPlayer = useMediaPlayer();
    const isCurrent = mediaPlayer.isPlayingFile(file.id);
    const isPlaying = isCurrent && mediaPlayer.isPlaying;

    // Play this file via the global player
    const handlePlay = () => {
        if (isCurrent) {
            mediaPlayer.unpause();
        } else {
            mediaPlayer.setPlaylist([
                {
                    file: {
                        id: file.id,
                        fileLeafName: file.fileLeafName,
                        externalURI: file.externalURI,
                        mimeType: file.mimeType,
                        sizeBytes: file.sizeBytes,
                        parentFileId: file.parentFileId,
                        previewFileId: file.previewFileId,
                        fileCreatedAt: file.fileCreatedAt,
                        storedLeafName: file.storedLeafName,
                        uploadedAt: file.uploadedAt,
                    },
                    playlistIndex: -1,
                    setlistId: undefined, // individual file playback, not from a setlist
                    //url: file.externalURI || undefined,
                    songContext: song,
                    eventContext: event,
                }
            ], 0);
        }
    };

    const handlePause = () => {
        if (isCurrent) {
            mediaPlayer.pause();
        }
    };

    return (
        <div className="audioPreviewGatewayContainer">
            {isPlaying ? (
                <div className='audioPreviewGatewayButton freeButton' onClick={handlePause}>
                    {gIconMap.PauseCircleOutline()}
                    <AnimatedFauxEqualizer enabled={isCurrent && isPlaying} />
                </div>
            ) : (
                <div className='audioPreviewGatewayButton freeButton' onClick={handlePlay}>
                    {gIconMap.PlayCircleOutline()}
                    <AnimatedFauxEqualizer enabled={isCurrent && isPlaying} style={{
                        //"--equalizer-bar-color": "#888",
                        visibility: "hidden"
                    } as any} />
                </div>
            )}
        </div>
    );
}
