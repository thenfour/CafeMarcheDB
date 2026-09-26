
import { useMutation } from '@blitzjs/rpc';
import { PushPin } from '@mui/icons-material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { Divider, ListItemIcon, MenuItem, Tooltip } from "@mui/material";
import React from "react";
import { existsInArray, toggleValueInArray } from 'shared/arrayUtils';
import { Permission } from 'shared/permissions';
import type { EventPublicId, EventStatusPublicId, EventTypePublicId, FileEventTagPublicId, FileSongTagPublicId, FileTagPublicId, SongPublicId } from 'shared/publicId';
import { SplitQuickFilter } from 'shared/quickFilter';
import { formatFileSize, SortDirection } from 'shared/rootroot';
import { IsNullOrWhitespace, parseMimeType, smartTruncate } from "shared/utils";
import { SnackbarContext, useSnackbar } from "src/core/components/SnackbarContext";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { gCharMap, gIconMap } from '../db3/components/IconMap';
import { DB3EditObjectDialog } from '../db3/components/db3NewObjectDialog';
import updateSongPinnedRecording from '../db3/mutations/updateSongPinnedRecording';
import { TClientFileUploadTags } from '../db3/shared/fileTypes';
import { EnrichedFile } from '../db3/shared/schema/enrichedFileTypes';
import { AppContextMarker } from './AppContext';
import { CMChip, CMChipContainer, CMStandardDBChip } from './CMChip';
import { InstrumentChip } from "./CMCoreComponents";
import { CMButton, CMSmallButton, DotMenu } from './CMCoreComponents2';
import { CMLink } from './CMLink';
import { SearchInput } from './CMTextField';
import { VisibilityValue } from './VisibilityControl';
import { gGeneralPaletteList, StandardVariationSpec } from './color/palette';
import { useDashboardContext, useFeatureRecorder } from './dashboardContext/DashboardContext';
import { EventChip, EventChipProps } from './event/EventChips';
import { ActivityFeature } from './featureReports/activityTracking';
import { CMDBUploadFile } from './file/CMDBUploadFile';
import { FileDropWrapper, UploadFileComponent } from './file/FileDrop';
import { Markdown } from "./markdown/Markdown";
import { AnimatedFauxEqualizer } from './mediaPlayer/MediaPlayerBar';
import { useMediaPlayer } from './mediaPlayer/MediaPlayerContext';
import { MediaPlayerEventContextPayload, MediaPlayerSongContextPayload } from './mediaPlayer/MediaPlayerTypes';
import { SongChip } from './song/SongChip';
import { UserChip } from './user/userChip';
import { WikiPageChip } from './wiki/WikiPageChip';


type SongDetailFile = NonNullable<
    NonNullable<db3.SongDetailClient["taggedFiles"]>[number]["file"]
>;
type DetailFile = db3.FileDetailClient
    | SongDetailFile
    | EnrichedFile<db3.FileWithTagsClientPayload>;

const getEventChipValue = (event: {
    publicId: string;
    name?: string;
    startsAt?: Date | null;
    statusId?: EventStatusPublicId | null;
    typeId?: EventTypePublicId | null;
}): EventChipProps["value"] | null => {
    if (event.name === undefined
        || event.startsAt === undefined
        || event.statusId === undefined
        || event.typeId === undefined) {
        return null;
    }
    return {
        ...event,
        publicId: db3.xEvent.parseIdentity(event.publicId),
        name: event.name,
        startsAt: event.startsAt,
        statusId: event.statusId,
        typeId: event.typeId,
    };
};

// don't take maximum because it can hide your own instruments. so either handle that specifically or just don't bother hiding tags.
//const gMaximumFilterTagsPerType = 10 as const;

type SortByKey = "uploadedAt" | "uploadedByUserName" | "mimeType" | "sizeBytes" | "fileCreatedAt" | "fileLeafName";

//////////////////////////////////////////////////////////////////

export interface FileTagBase {
    publicId: FileEventTagPublicId | FileSongTagPublicId;
    file: DetailFile;
    fileId?: number;
    // plus a songId, eventId, whatever...
};

//////////////////////////////////////////////////////////////////
interface PinSongRecordingMenuItemProps {
    value: DetailFile;
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
                    songId: props.contextSong.publicId,
                    fileId: props.value.id,
                });
                if (props.refetch) {
                    void props.refetch();
                }
                void recordFeature({
                    feature: ActivityFeature.song_pin_recording,
                    fileId: props.value.id,
                    songId: props.contextSong.publicId,
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
                    songId: props.contextSong.publicId,
                    fileId: null,
                });
                if (props.refetch) {
                    void props.refetch();
                }
                void recordFeature({
                    feature: ActivityFeature.song_pin_recording,
                    songId: props.contextSong.publicId,
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


export const FileExternalLink = ({ file, highlight }: { file: DetailFile, highlight?: boolean }) => {
    const dashboardContext = useDashboardContext();
    const filenameClass = highlight ? "filename highlight" : "filename";
    const fileName = file.fileLeafName || "Restricted file";
    const storedLeafName = file.storedLeafName;

    let href = file.externalURI || undefined;
    if (!href) {
        if (!storedLeafName) {
            return <div className={filenameClass}>{smartTruncate(fileName)}</div>;
        }
        href = dashboardContext.routingApi.getURIForFile({
            storedLeafName,
            fileLeafName: file.fileLeafName || "",
            externalURI: null,
        });
    }

    return <CMLink trackingFeature={ActivityFeature.file_download} target="_empty" className="downloadLink" href={href}>
        {file.externalURI ? gIconMap.Link() : <FileDownloadIcon />}
        <Tooltip title={fileName}>
            <div className={filenameClass}>{smartTruncate(fileName)}</div>
        </Tooltip>
    </CMLink>;

};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface FileViewerHiddenTagIds {
    fileTagIds?: FileTagPublicId[];
    userTagIds?: number[];
    instrumentTagIds?: db3.InstrumentIdentity[];
    songTagIds?: SongPublicId[];
    eventTagIds?: EventPublicId[];
    wikiPageTagIds?: number[]; // wikiPage ids
};

interface FileViewerProps {
    value: DetailFile;
    onEnterEditMode?: () => void; // if undefined, don't allow editing.
    readonly: boolean;
    statHighlight: SortByKey;
    contextEvent?: MediaPlayerEventContextPayload;
    contextSong?: MediaPlayerSongContextPayload;
    hiddenTagIds: FileViewerHiddenTagIds;

    refetch?: () => void;
};

export const FileValueViewer = (props: FileViewerProps) => {
    const endMenuItemRef = React.useRef<() => void>(() => { });
    const dashboardContext = useDashboardContext();
    const snackbar = useSnackbar();
    const file = props.value;
    const tags = file.tags ?? [];
    const taggedEvents = file.taggedEvents ?? [];
    const taggedUsers = file.taggedUsers ?? [];
    const taggedSongs = file.taggedSongs ?? [];
    const taggedInstruments = file.taggedInstruments ?? [];
    const taggedWikiPages = file.taggedWikiPages ?? [];
    const visInfo = dashboardContext.getVisibilityInfo({
        visiblePermissionId: file.visiblePermissionId ?? null,
        visiblePermission: file.visiblePermission ?? null,
    });

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
    const uri = file.externalURI || (file.storedLeafName
        ? dashboardContext.routingApi.getURIForFile({
            storedLeafName: file.storedLeafName,
            fileLeafName: file.fileLeafName || "",
            externalURI: null,
        })
        : undefined);

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

                <DotMenu setCloseMenuProc={(proc) => endMenuItemRef.current = proc}>
                    {!props.readonly && props.onEnterEditMode && <MenuItem
                        onClick={() => {
                            endMenuItemRef.current();
                            props.onEnterEditMode!();
                        }}>
                        <ListItemIcon>{gIconMap.Edit()}</ListItemIcon>
                        Edit
                    </MenuItem>}
                    {uri && <MenuItem
                        onClick={async () => {
                            await snackbar.invokeAsync(async () => {
                                await navigator.clipboard.writeText(uri);
                                endMenuItemRef.current();
                            }, "Link copied to clipboard");
                        }}>
                        <ListItemIcon>{gIconMap.Share()}</ListItemIcon>
                        Copy link
                    </MenuItem>}
                    {uri && <MenuItem
                        onClick={async () => {
                            await snackbar.invokeAsync(async () => {
                                const markdownLink = `[${file.fileLeafName || "Restricted file"}](${uri})`;
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
                    </MenuItem>}
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
                            <CMLink href={dashboardContext.routingApi.getURIForFileLandingPage(file)}>Visit file landing page</CMLink>
                        </MenuItem>
                    }
                </DotMenu>
            </div>
            <div className="content">
                <CMChipContainer>
                    {(tags.length > 0) && (
                        tags
                            .filter(a => !props.hiddenTagIds.fileTagIds || !existsInArray(
                                props.hiddenTagIds.fileTagIds,
                                db3.xFileTag.getIdentity(a.fileTag),
                            ))
                            .map(a => <CMStandardDBChip
                                key={db3.xFileTagAssignment.getIdentity(a)}
                                model={a.fileTag}
                                size="small"
                                variation={variation}
                            />)
                    )}

                    {(taggedEvents.length > 0) && (
                        taggedEvents
                            .filter(a => !props.hiddenTagIds.eventTagIds || !existsInArray(props.hiddenTagIds.eventTagIds, a.event.publicId))
                            .map(a => {
                                const event = getEventChipValue(a.event);
                                return event
                                    ? <EventChip key={db3.xFile.fields.taggedEvents.getForeignIdentity(a)} value={event} size="small" variation={variation} />
                                    : null;
                            })
                    )}

                    {(taggedUsers.length > 0) && (
                        taggedUsers
                            .filter(a => !props.hiddenTagIds.userTagIds || !existsInArray(props.hiddenTagIds.userTagIds, a.user.id))
                            .map(a => <UserChip key={db3.xFile.fields.taggedUsers.getForeignIdentity(a)} value={a.user} size="small" variation={variation} />)
                    )}

                    {(taggedSongs.length > 0) && (
                        taggedSongs
                            .filter(a => !props.hiddenTagIds.songTagIds || !existsInArray(props.hiddenTagIds.songTagIds, a.song.publicId))
                            .map(a => a.song.name === undefined
                                ? null
                                : <SongChip key={db3.xFile.fields.taggedSongs.getForeignIdentity(a)} value={{ publicId: db3.xSong.parseIdentity(a.song.publicId), name: a.song.name }} size="small" variation={variation} />)
                    )}

                    {(taggedInstruments.length > 0) && (
                        taggedInstruments
                            .filter(a => !props.hiddenTagIds.instrumentTagIds || !existsInArray(
                                props.hiddenTagIds.instrumentTagIds,
                                db3.getInstrumentIdentity(a.instrument),
                            ))
                            .map(a => <InstrumentChip key={db3.xFile.fields.taggedInstruments.getForeignIdentity(a)} value={a.instrument} size="small" variation={variation} />)
                    )}

                    {(taggedWikiPages.length > 0) && (
                        taggedWikiPages
                            .filter(a => !props.hiddenTagIds.wikiPageTagIds || !existsInArray(props.hiddenTagIds.wikiPageTagIds, a.wikiPage.id))
                            .map(a => a.wikiPage.slug === undefined
                                ? null
                                : <WikiPageChip key={db3.xFile.fields.taggedWikiPages.getForeignIdentity(a)} slug={a.wikiPage.slug} size="small" variation={variation} />)
                    )}
                </CMChipContainer>


                <div className="descriptionContainer">
                    <Markdown markdown={file.description || ""} />
                </div>

                {/* <div className="preview">
                    {isAudio && <AudioPreviewBehindButton value={file} />}
                </div> */}

                {isAudio && <div className="mediaControls">
                    <AudioPlayerFileControls file={file} song={props.contextSong} event={props.contextEvent} />
                </div>}


                <Tooltip title={<div>
                    {file.uploadedAt && <div>uploaded at {file.uploadedAt.toLocaleString()} by {file.uploadedByUser?.name}</div>}
                    {file.externalURI && <div>{file.externalURI}</div>}
                </div>}>
                    <div className="stats">

                        {file.externalURI &&
                            <div className="stat externalURI">
                                {smartTruncate(file.externalURI)}
                            </div>
                        }

                        {file.sizeBytes != null && <div className={`stat ${props.statHighlight === 'sizeBytes' && "highlight"}`}>{formatFileSize(file.sizeBytes)}</div>}
                        {file.mimeType && <div className={`stat ${props.statHighlight === 'mimeType' && "highlight"}`}>{file.mimeType}</div>}
                        {file.fileCreatedAt && <div className={`stat ${props.statHighlight === 'fileCreatedAt' && "highlight"}`}>created at {file.fileCreatedAt.toLocaleString()}</div>}
                        {props.statHighlight === 'uploadedByUserName' && <div className='stat highlight'>uploaded by {file.uploadedByUser?.name}</div>}
                        {props.statHighlight === 'uploadedAt' && file.uploadedAt && <div className='stat highlight'>uploaded at {file.uploadedAt.toLocaleString()}</div>}
                    </div>
                </Tooltip>
            </div>
        </AppContextMarker>
    </div>;
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface FileEditorProps {
    initialValue: DetailFile;
    onClose: () => void;
    rowMode: db3.DB3RowMode;
};
export const FileEditor = (props: FileEditorProps) => {

    const { showMessage: showSnackbar } = useSnackbar();
    const dashboardContext = useDashboardContext();
    const recordFeature = useFeatureRecorder();



    const tableSpec = DB3Client.defineTableClientSpec({
        view: db3.fileEditorView,
        columns: {
            // Any columns updated by the file CRUD command need to be specified here.
            // if they shouldn't be displayed to users, make a hidden version.
            id: columnName => new DB3Client.PKColumnClient({ columnName }),
            visiblePermission: DB3Client.foreignRefFieldGen({
                selectionView: db3.permissionVisibilityView,
            }),
            fileLeafName: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 150, fieldCaption: "File name" }),
            description: columnName => new DB3Client.MarkdownStringColumnClient({ columnName, cellWidth: 150 }),
            fileCreatedAt: columnName => new DB3Client.DateTimeColumn({ columnName }),

            tags: DB3Client.tagsFieldClientGen<db3.FileTagAssignmentPayload>({ allowDeleteFromCell: false, selectStyle: 'inline', selectionView: db3.fileTagEditorView }),
            taggedInstruments: DB3Client.tagsFieldClientGen<db3.FileInstrumentTagClientPayload>({
                cellWidth: 150, allowDeleteFromCell: false, selectStyle: 'inline',
                overrideRowInfo: (association: db3.FileInstrumentTagClientPayload, rowInfo: db3.RowInfo) => {
                    // because the query doesn't include instrument functional group, get it from global dashboard context
                    const fg = dashboardContext.instrumentFunctionalGroup.getById(association.instrument.functionalGroupId);
                    if (!fg) return rowInfo;
                    return { ...rowInfo, color: gGeneralPaletteList.findEntry(fg.color) };
                }
            }),
            taggedUsers: DB3Client.tagsFieldClientGen<db3.FileUserTagClientPayload>({ allowDeleteFromCell: false }),
            taggedSongs: DB3Client.tagsFieldClientGen<db3.FileSongTagClientPayload>({ allowDeleteFromCell: false }),
            taggedEvents: DB3Client.tagsFieldClientGen<db3.FileEventTagClientPayload>({
                cellWidth: 150,
                allowDeleteFromCell: false,
                renderAsChip: (args) => {
                    if (!args.value) {
                        return <CMChip>--</CMChip>
                    }
                    const event = getEventChipValue(args.value.event);
                    return event ? <EventChip renderAsLink={false} value={event} /> : null;
                },
                renderAsListItem: (props, value, selected) => {
                    const event = getEventChipValue(value.event);
                    return event ? <EventChip renderAsLink={false} value={event} /> : null;
                }
            }),
            taggedWikiPages: DB3Client.tagsFieldClientGen<db3.FileWikiPageTagClientPayload>({ allowDeleteFromCell: false }),
        },
    });
    const tableRenderClient = DB3Client.useTableRenderContext({
        requestedCaps: DB3Client.xTableClientCaps.None,
        tableSpec,
        referenceProvider: dashboardContext.referenceStore,
    });
    const editCommands = DB3Client.useCrudViewCommands({
        view: db3.fileEditorView,
        tableClient: tableRenderClient,
    });
    const editorInitialValue: db3.ClientOf<typeof db3.fileEditorView> = {
        ...props.initialValue,
        visiblePermission: props.initialValue.visiblePermissionId == null
            ? null
            : dashboardContext.referenceStore.require(
                db3.xPermission,
                props.initialValue.visiblePermissionId,
                `File(${props.initialValue.id}).visiblePermission`,
            ),
        tags: props.initialValue.tags.map(association => ({
            ...association,
            fileTag: dashboardContext.referenceStore.require(
                db3.xFileTag,
                association.fileTagId,
                `File(${props.initialValue.id}).tags.fileTag`,
            ),
        })),
        taggedInstruments: props.initialValue.taggedInstruments.map(association => ({
            ...association,
            instrument: dashboardContext.referenceStore.require(
                db3.xInstrument,
                association.instrumentId,
                `File(${props.initialValue.id}).taggedInstruments.instrument`,
            ),
        })),
        taggedEvents: props.initialValue.taggedEvents.map(association => ({
            ...association,
            event: {
                ...association.event,
                type: dashboardContext.eventType.getById(association.event.typeId) ?? null,
                status: dashboardContext.eventStatus.getById(association.event.statusId) ?? null,
            },
        })),
        isDeleted: "isDeleted" in props.initialValue
            ? props.initialValue.isDeleted
            : false,
        customData: undefined,
    };

    return <DB3EditObjectDialog
        initialValue={editorInitialValue}
        onCancel={() => props.onClose()}
        onDelete={() => {
            void recordFeature({
                feature: ActivityFeature.file_delete,
                fileId: props.initialValue.id,
            });
            editCommands.delete(props.initialValue.id).then(() => {
                showSnackbar({ severity: "success", children: "file delete successful" });
            }).catch((e) => {
                console.log(e);
                showSnackbar({ severity: "error", children: "Error; see console" });
            }).finally(() => {
                props.onClose();
            });
        }}
        onOK={(value) => {
            void recordFeature({
                feature: ActivityFeature.file_edit,
                fileId: props.initialValue.id,
            });
            // DB3EditObjectDialog is still a transitional untyped dialog boundary.
            const editorValue = value as db3.ClientOf<typeof db3.fileEditorView>;
            editCommands.update(editorValue, editorInitialValue).then(() => {
                showSnackbar({ severity: "success", children: "file edit successful" });
            }).catch((e) => {
                console.log(e);
                showSnackbar({ severity: "error", children: "Error; see console" });
            }).finally(() => {
                props.onClose();
            });
        }}
        tableRenderClient={tableRenderClient}
    />;
};



//////////////////////////////////////////////////////////////////
// this filtering & sorting is done at runtime, not db fetch time.
interface FileFilterAndSortSpec {
    quickFilter: string;
    tagIds: FileTagPublicId[];
    taggedUserIds: number[];
    taggedInstrumentIds: db3.InstrumentIdentity[];
    taggedSongIds: SongPublicId[];
    taggedEventIds: EventPublicId[];
    taggedWikiPageIds: number[];
    mimeTypes: string[];

    sortBy: SortByKey;
    sortDirection: SortDirection;
};

function sortAndFilter(items: FileTagBase[], spec: FileFilterAndSortSpec): FileTagBase[] {

    // apply filter
    let filteredItems = items.filter(item => {
        const tags = item.file.tags ?? [];
        const taggedUsers = item.file.taggedUsers ?? [];
        const taggedInstruments = item.file.taggedInstruments ?? [];
        const taggedSongs = item.file.taggedSongs ?? [];
        const taggedEvents = item.file.taggedEvents ?? [];
        const taggedWikiPages = item.file.taggedWikiPages ?? [];
        const tagIds = tags.map(tag => db3.xFileTag.getIdentity(tag.fileTag));
        if (spec.tagIds.length && !tagIds.some(id => spec.tagIds.includes(id))) return false;

        const userIds = taggedUsers.map(user => user.user.id);
        if (spec.taggedUserIds.length && !userIds.some(id => spec.taggedUserIds.includes(id))) return false;

        const instrumentIds = taggedInstruments.map(instrument => db3.getInstrumentIdentity(instrument.instrument));
        if (spec.taggedInstrumentIds.length && !instrumentIds.some(id => spec.taggedInstrumentIds.includes(id))) return false;

        const songIds = taggedSongs.map(song => song.song.publicId);
        if (spec.taggedSongIds.length && !songIds.some(id => spec.taggedSongIds.includes(id))) return false;

        const eventIds = taggedEvents.map(event => event.event.publicId);
        if (spec.taggedEventIds.length && !eventIds.some(id => spec.taggedEventIds.includes(id))) return false;

        const wikiPageIds = taggedWikiPages.map(wikiPage => wikiPage.wikiPage.id);
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
            (item.file.description || "").toLocaleLowerCase(),
            (item.file.fileLeafName || "").toLocaleLowerCase(),
            taggedInstruments.map(i => (i.instrument.name || "").toLocaleLowerCase()),
            taggedUsers.map(i => (i.user.name || "").toLocaleLowerCase()),
            taggedEvents.map(i => (i.event.name || "").toLocaleLowerCase()),
            taggedSongs.map(i => (i.song.name || "").toLocaleLowerCase()),
            taggedWikiPages.map(i => (i.wikiPage.slug || "").toLocaleLowerCase()),
            tags.map(i => i.fileTag.text.toLocaleLowerCase()),
        ];

        return filterTokens.every(searchToken => tokensToSearch.flat().some(t => t.includes(searchToken)));
    });

    // sort.
    filteredItems.sort((a, b) => {
        const getSortValue = (file: DetailFile) => spec.sortBy === "uploadedByUserName"
            ? file.uploadedByUser?.name
            : file[spec.sortBy];
        let aValue = getSortValue(a.file);
        let bValue = getSortValue(b.file);

        if (aValue == null && bValue == null) {
            return 0;
        }
        if (aValue == null) {
            return 1;
        }
        if (bValue == null) {
            return -1;
        }

        if (typeof aValue === 'string') {
            aValue = aValue.toLowerCase();
            bValue = (bValue as string).toLowerCase();
        }

        if (aValue === bValue) {
            return 0;
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

const CalculateUniqueTags = <TagPayload,>(props: {
    fileTags: FileTagBase[];
    field: {
        getAssociations: <TAssociation = unknown>(row: DetailFile) => TAssociation[];
        getForeignObject: <TForeignObject>(association: unknown) => TForeignObject;
        getForeignIdentity: (association: unknown) => db3.DB3Identity;
    };
}): CalculateUniqueTagsReturn<TagPayload>[] => {

    const uniqueTags = new Map<db3.DB3Identity, CalculateUniqueTagsReturn<TagPayload>>();

    for (var ift = 0; ift < props.fileTags.length; ++ift) {
        const ft = props.fileTags[ift]!;
        for (const association of props.field.getAssociations(ft.file)) {
            const identity = props.field.getForeignIdentity(association);
            const existing = uniqueTags.get(identity);
            if (existing) {
                existing.count++;
            } else {
                uniqueTags.set(identity, {
                    tag: props.field.getForeignObject<TagPayload>(association),
                    count: 1,
                });
            }
        }
    }

    return [...uniqueTags.values()].sort((a, b) => b.count - a.count);
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
    const dashboardContext = useDashboardContext();

    const getInstrumentColor = (instrument: db3.InstrumentClientPayload) => {
        const fg = dashboardContext.instrumentFunctionalGroup.getById(instrument.functionalGroupId);
        if (!fg) return null;
        return fg.color;
    };

    const uniqueTags = CalculateUniqueTags<db3.FileTagDashboardClient>({ field: db3.xFile.fields.tags, fileTags: props.fileTags });
    const uniqueInstrumentTags = CalculateUniqueTags<db3.InstrumentClientPayload>({ field: db3.xFile.fields.taggedInstruments, fileTags: props.fileTags });
    const uniqueEventTags = CalculateUniqueTags<{ publicId: EventPublicId; name: string }>({ field: db3.xFile.fields.taggedEvents, fileTags: props.fileTags });
    const uniqueUserTags = CalculateUniqueTags<db3.UserPayloadMinimum>({ field: db3.xFile.fields.taggedUsers, fileTags: props.fileTags });
    const uniqueSongTags = CalculateUniqueTags<db3.SongPayloadMinimum>({ field: db3.xFile.fields.taggedSongs, fileTags: props.fileTags });
    const uniqueWikiPageTags = CalculateUniqueTags<db3.WikiPagePayload>({ field: db3.xFile.fields.taggedWikiPages, fileTags: props.fileTags });
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
                                                key={db3.xFileTag.getIdentity(t.tag)}
                                                color={t.tag.color}
                                                tooltip={t.tag.description}
                                                size='small'
                                                variation={{
                                                    ...StandardVariationSpec.Strong,
                                                    selected: existsInArray(
                                                        props.value.tagIds,
                                                        db3.xFileTag.getIdentity(t.tag),
                                                    ),
                                                }}
                                                onClick={() => props.onChange({
                                                    ...props.value,
                                                    tagIds: toggleValueInArray(
                                                        props.value.tagIds,
                                                        db3.xFileTag.getIdentity(t.tag),
                                                    ),
                                                })}
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
                                                key={t.publicId}
                                                color={getInstrumentColor(t)}
                                                //tooltip={t.description}
                                                size={dashboardContext.currentUser?.instruments.some(yi => yi.instrumentId === t.publicId) ? 'big' : 'small'}
                                                variation={{ ...StandardVariationSpec.Strong, selected: existsInArray(props.value.taggedInstrumentIds, t.publicId) }}
                                                onClick={() => props.onChange({ ...props.value, taggedInstrumentIds: toggleValueInArray(props.value.taggedInstrumentIds, t.publicId) })}
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
                                                key={t.tag.publicId}
                                                //color={t.tag.color}
                                                size='small'
                                                tooltip={"Song"}
                                                variation={{ ...StandardVariationSpec.Strong, selected: existsInArray(props.value.taggedSongIds, t.tag.publicId) }}
                                                onClick={() => props.onChange({ ...props.value, taggedSongIds: toggleValueInArray(props.value.taggedSongIds, t.tag.publicId) })}
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
                                                key={t.tag.publicId}
                                                //color={t.tag.color}
                                                //tooltip={t.tag.description}
                                                tooltip={"Event"}
                                                size='small'
                                                variation={{ ...StandardVariationSpec.Strong, selected: existsInArray(props.value.taggedEventIds, t.tag.publicId) }}
                                                onClick={() => props.onChange({ ...props.value, taggedEventIds: toggleValueInArray(props.value.taggedEventIds, t.tag.publicId) })}
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

                                    <CMSmallButton
                                        onClick={() => props.onChange({ ...props.value, sortBy: 'uploadedAt', sortDirection: props.value.sortDirection === 'asc' ? 'desc' : 'asc' })}
                                    >Upload Date {props.value.sortBy === 'uploadedAt' && sortArrow}</CMSmallButton>
                                    <CMSmallButton
                                        onClick={() => props.onChange({ ...props.value, sortBy: 'fileCreatedAt', sortDirection: props.value.sortDirection === 'asc' ? 'desc' : 'asc' })}
                                    >File Date {props.value.sortBy === 'fileCreatedAt' && sortArrow}</CMSmallButton>
                                    <CMSmallButton
                                        onClick={() => props.onChange({ ...props.value, sortBy: 'fileLeafName', sortDirection: props.value.sortDirection === 'asc' ? 'desc' : 'asc' })}
                                    >Filename {props.value.sortBy === 'fileLeafName' && sortArrow}</CMSmallButton>
                                    <CMSmallButton
                                        onClick={() => props.onChange({ ...props.value, sortBy: 'sizeBytes', sortDirection: props.value.sortDirection === 'asc' ? 'desc' : 'asc' })}
                                    >Size {props.value.sortBy === 'sizeBytes' && sortArrow}</CMSmallButton>
                                    <CMSmallButton
                                        onClick={() => props.onChange({ ...props.value, sortBy: 'mimeType', sortDirection: props.value.sortDirection === 'asc' ? 'desc' : 'asc' })}
                                    >Type {props.value.sortBy === 'mimeType' && sortArrow}</CMSmallButton>
                                    <CMSmallButton
                                        onClick={() => props.onChange({ ...props.value, sortBy: 'uploadedByUserName', sortDirection: props.value.sortDirection === 'asc' ? 'desc' : 'asc' })}
                                    >Uploader {props.value.sortBy === 'uploadedByUserName' && sortArrow}</CMSmallButton>
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
    value: DetailFile;
    readonly: boolean;
    refetch: () => void;
    statHighlight: SortByKey;
    contextEvent?: MediaPlayerEventContextPayload;
    contextSong?: MediaPlayerSongContextPayload;
    hiddenTagIds: FileViewerHiddenTagIds;
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
            hiddenTagIds={props.hiddenTagIds}
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
    hiddenTagIds: FileViewerHiddenTagIds;
};

export const FilesTabContent = (props: FilesTabContentProps) => {
    const [progress, setProgress] = React.useState<number | null>(null);
    const [showUpload, setShowUpload] = React.useState<boolean>(false);
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const dashboardContext = useDashboardContext();
    const recordFeature = useFeatureRecorder();

    const permissionId = db3.xPermission.getIdentity(
        dashboardContext.getDefaultVisibilityPermission(),
    );

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
            <CMButton onClick={() => setShowUpload(false)}>Cancel</CMButton>
        </div> :
            <CMButton onClick={() => setShowUpload(true)}>Upload</CMButton>)
        }

        <FileFilterAndSortControls value={filterSpec} onChange={(value) => setFilterSpec(value)} fileTags={props.fileTags} />

        <div className="searchRecordCount">
            {filteredItems.length === 0 ? "No items to show" : <>Displaying {filteredItems.length} items</>}
        </div>

        <div className="EventFilesList">
            {filteredItems.map((fileTag, index) => <FileControl
                key={fileTag.publicId}
                readonly={props.readonly}
                refetch={props.refetch}
                value={fileTag.file}
                statHighlight={filterSpec.sortBy}
                contextEvent={props.contextEvent}
                contextSong={props.contextSong}
                hiddenTagIds={props.hiddenTagIds}
            />)}
        </div>
    </FileDropWrapper>;
};




// File-specific audio controls that use the global media player
type AudioPlayerFileControlsProps = {
    file: DetailFile,
    song?: MediaPlayerSongContextPayload | undefined,
    event?: MediaPlayerEventContextPayload | undefined,
};

export function AudioPlayerFileControls({ file, song, event }: AudioPlayerFileControlsProps) {
    const mediaPlayer = useMediaPlayer();
    const isCurrent = mediaPlayer.isPlayingFile(file.id);
    const isPlaying = isCurrent && mediaPlayer.isPlaying;

    if (file.fileLeafName === undefined
        || file.externalURI === undefined
        || file.mimeType === undefined
        || file.sizeBytes === undefined
        || file.parentFileId === undefined
        || file.previewFileId === undefined
        || file.fileCreatedAt === undefined
        || file.storedLeafName === undefined
        || file.uploadedAt === undefined) {
        return null;
    }

    const playableFile = {
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
    };

    // Play this file via the global player
    const handlePlay = () => {
        if (isCurrent) {
            mediaPlayer.unpause();
        } else {
            mediaPlayer.setPlaylist([
                {
                    file: playableFile,
                    playlistIndex: -1,
                    setlistClientId: undefined, // individual file playback, not from a setlist
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
