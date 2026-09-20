import { useDB3Authorization } from "src/core/db3/components/useDB3Authorization";
// drag reordering https://www.npmjs.com/package/react-smooth-dnd
// https://codesandbox.io/s/material-ui-sortable-list-with-react-smooth-dnd-swrqx?file=/src/index.js:113-129

// clipboard custom formats
// https://developer.chrome.com/blog/web-custom-formats-for-the-async-clipboard-api/

import { TAnyModel } from '@/shared/rootroot';
import { useQuery } from '@blitzjs/rpc';
import { ArrowBack, ArrowForward } from '@mui/icons-material';
import { Divider, FormControlLabel, InputBase, ListItemIcon, Menu, MenuItem, Select, Switch, Tooltip } from "@mui/material";
import { assert } from 'blitz';
import React, { useCallback, useRef } from "react";
import * as ReactSmoothDnd /*{ Container, Draggable, DropResult }*/ from "react-smooth-dnd";
import { moveItemInArray } from 'shared/arrayUtils';
import { formatSongLength } from 'shared/time';
import { CoalesceBool, getHashedColor, getUniqueNegativeID } from "shared/utils";
import { SnackbarContext, SnackbarContextType } from "src/core/components/SnackbarContext";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import { API } from '../db3/clientAPI';
import { gCharMap, gIconMap } from '../db3/components/IconMap';
import getSongPinnedRecording from '../db3/queries/getSongPinnedRecording';
import { TSongPinnedRecording } from '../db3/shared/apiTypes';
import { enrichSong } from '../db3/shared/schema/enrichedSongTypes';
import * as SetlistAPI from '../db3/shared/setlistApi';
import { AppContextMarker } from './AppContext';
import { ReactSmoothDndContainer, ReactSmoothDndDraggable } from "./CMCoreComponents";
import { CMDialog } from './CMDialog';
import { AdminInspectObject, CMButton, CMDialogContentText, CMSmallButton, CMTextarea, NameValuePair } from './CMCoreComponents2';
import { CMLink } from './CMLink';
import { CMTextInputBase, SongLengthInput } from './CMTextField';
import { GetStyleVariablesForColor } from './color/ColorClientUtils';
import { ColorPick } from './color/ColorPick';
import { gSwatchColors } from './color/palette';
import { useDashboardContext, useFeatureRecorder } from './dashboardContext/DashboardContext';
import { ActivityFeature } from './featureReports/activityTracking';
import { Markdown } from "./markdown/Markdown";
import { useMediaPlayer } from './mediaPlayer/MediaPlayerContext';
import { MediaPlayerTrack } from './mediaPlayer/MediaPlayerTypes';
import { SongPlayButton } from './mediaPlayer/SongPlayButton';
import { useMessageBox } from './MessageBoxContext';
import { MetronomeButton } from './Metronome';
import { SettingMarkdown } from './SettingMarkdown';
import { SongAutocomplete } from './SongAutocomplete';
import { SongTagIndicatorContainer } from './SongTagIndicatorContainer';

const RowItemToMediaPlayerTrack = (args: { allPinnedRecordings: Record<number, TSongPinnedRecording>, rowIndex: number, rowItem: SetlistAPI.EventSongListItem, songListId: number }): MediaPlayerTrack => {
    if (args.rowItem.type === 'song') {
        const pinnedRecording = args.allPinnedRecordings[args.rowItem.song.id];
        return {
            playlistIndex: args.rowIndex,
            setlistId: args.songListId,
            setListItemContext: args.rowItem,
            songContext: args.rowItem.song,
            file: pinnedRecording,
        };
    }
    else if (args.rowItem.type === 'divider') {
        return {
            playlistIndex: args.rowIndex,
            setlistId: args.songListId,
            setListItemContext: args.rowItem,
        };
    }
    else {
        throw new Error(`Unknown row item type ${args.rowItem.type}`);
    }
}

const DividerEditInDialogDialog = ({ sortOrder, value, onClick, songList, onClose }: {
    sortOrder: number,
    value: SetlistAPI.EventSongListDividerItem,
    onClick: (x: SetlistAPI.EventSongListDividerItem) => void,
    songList: db3.EventSongListDraft,
    onClose: () => void,
}) => {
    //const [open, setOpen] = React.useState<boolean>(false);
    const [controlledValue, setControlledValue] = React.useState<SetlistAPI.EventSongListDividerItem>({ ...value });

    React.useEffect(() => {
        // Only reset the controlled value if we're editing a different divider (different ID)
        // This prevents the form from resetting when the user makes changes
        setControlledValue({ ...value });
    }, [value.id]);

    const makePreview = (testFormat: db3.EventSongListDividerTextStyle): db3.EventSongListDetailClient => {
        const ret = db3.cloneEventSongListDraft(songList);
        ret.items = ret.items.slice(Math.max(0, sortOrder - 2), sortOrder + 3);
        const divider = ret.items.find(item => item.clientId === value.id);
        if (!divider || divider.type !== "divider") throw new Error("Divider is missing from preview.");
        Object.assign(divider, db3.eventSongListDividerRowToDraftItem(controlledValue));
        divider.textStyle = testFormat;
        return db3.eventSongListDraftToClient(ret);
    };

    return <CMDialog
        open
        onClose={onClose}
        fullWidth
        maxWidth="md"
        title={<>Setlist <ArrowForward /> Edit setlist divider</>}
        titleProps={{ style: { display: "flex", alignItems: "center" } }}
        contentProps={{ style: { width: "var(--content-max-width)" } }}
        actions={<>
            <CMButton onClick={() => { onClick(controlledValue); onClose(); }} startIcon={gIconMap.Save()}>Ok</CMButton>
            <CMButton onClick={onClose} startIcon={gIconMap.Cancel()}>Cancel</CMButton>
        </>}
    >
        {/* <Markdown3Editor
                onChange={(v) => setControlledValue({ ...controlledValue, subtitle: v })}
                nominalHeight={100}
                value={controlledValue.subtitle || ""}
                autoFocus
                handleSave={() => onClick(controlledValue)}
                startWithPreviewOpen={false}
            /> */}
        <NameValuePair
            name={"Options"}
            value={
                <>
                    <FormControlLabel
                        label={"Text"}
                        control={
                            <CMTextInputBase
                                style={{ backgroundColor: "white", margin: "8px" }}
                                onChange={(e) => setControlledValue({ ...controlledValue, subtitle: e.target.value })}
                                value={controlledValue.subtitle || ""}
                            />
                        } />

                    <div>
                        <FormControlLabel
                            label={"Color"}
                            control={
                                <ColorPick
                                    onChange={(value) => setControlledValue({ ...controlledValue, color: value?.id || null })}
                                    value={controlledValue.color}
                                    allowNull
                                />} />
                    </div>
                    <FormControlLabel
                        label={"This is a break, and resets the running time"}
                        control={
                            <Switch
                                checked={controlledValue.isInterruption}
                                onChange={(e) => setControlledValue({ ...controlledValue, isInterruption: e.target.checked })}
                            />
                        } />
                    <FormControlLabel
                        label={"This is considered a song, with ordinal number and duration"}
                        control={
                            <Switch
                                checked={controlledValue.isSong}
                                onChange={(e) => setControlledValue({ ...controlledValue, isSong: e.target.checked })}
                            />
                        } />

                    <FormControlLabel
                        label={"Subtitle"}
                        control={
                            <CMTextInputBase
                                readOnly={!controlledValue.isSong}
                                style={{ backgroundColor: "white", margin: "8px" }}
                                onChange={(e) => setControlledValue({ ...controlledValue, subtitleIfSong: e.target.value })}
                                value={controlledValue.subtitleIfSong || ""}
                            />
                        } />

                    <FormControlLabel
                        label={"Length / duration"}
                        control={
                            <SongLengthInput
                                readonly={!controlledValue.isSong}
                                inputStyle={{ backgroundColor: "white", margin: "8px" }}
                                initialValue={controlledValue.lengthSeconds || null}
                                onChange={(v) => setControlledValue({ ...controlledValue, lengthSeconds: v })}
                            />
                        } />
                </>}
        />
        <NameValuePair
            name={"Style"}
            value={
                <div style={{ backgroundColor: "white" }}>
                    <Select value={controlledValue.textStyle} onChange={(v) => setControlledValue({ ...controlledValue, textStyle: v.target.value as db3.EventSongListDividerTextStyle })}>
                        {Object.values(db3.EventSongListDividerTextStyle).map(option => <MenuItem key={option} value={option} style={{ display: "flex", flexDirection: "column" }}>
                            <h3>{option}</h3>
                            <EventSongListValueViewerTable
                                readonly={true}
                                value={makePreview(option)}
                                showHeader={false}
                                disableInteraction
                            />
                        </MenuItem>)}
                    </Select>
                </div>
            }
        />
    </CMDialog>
};


const DividerEditInDialogButton = ({ sortOrder, value, onClick, songList }: { sortOrder: number, value: SetlistAPI.EventSongListDividerItem, onClick: (x: SetlistAPI.EventSongListDividerItem) => void, songList: db3.EventSongListDraft }) => {
    const [open, setOpen] = React.useState<boolean>(false);

    return <>
        <div
            className={`interactable dividerButton`}
            onClick={(e) => setOpen(true)}
        >
            {gIconMap.Edit()}
        </div>
        {open && <DividerEditInDialogDialog sortOrder={sortOrder} value={value} onClick={onClick} songList={songList} onClose={() => setOpen(false)} />}
    </>;

};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface EventSongListValueViewerRowProps {
    value: SetlistAPI.EventSongListItem;
    rowIndex: number; // The index of this row in the setlistRowItems array
    setlistRowItems: readonly SetlistAPI.EventSongListItem[];
    songList: db3.EventSongListDetailClient;
    pinnedRecordings: Record<number, TSongPinnedRecording>; // songId -> pinnedRecording
    lengthColumnMode: LengthColumnMode;
    toggleLengthColumnMode: () => void;
    mediaPlayerTrack: MediaPlayerTrack | undefined;
    getPlaylist: () => MediaPlayerTrack[];
    maxBpm: number | null;
};

const getRowStartBpm = (item: SetlistAPI.EventSongListItem): number | null => {
    if (item.type === "song") {
        return item.song.startBPM ?? null;
    }
    if (item.type === "divider") {
        const dividerWithBpm = item as unknown as { startBPM?: number | null };
        if (typeof dividerWithBpm.startBPM === "number") {
            return dividerWithBpm.startBPM;
        }
    }
    return null;
};

const getBpmBarStyle = (bpm: number | null, maxBpm: number | null): React.CSSProperties | undefined => {
    if (maxBpm == null || maxBpm <= 0 || bpm == null) {
        return undefined;
    }
    const fill = Math.max(0, Math.min(1, bpm / maxBpm));
    return { "--event-songlist-bpm-bar-fill": fill } as React.CSSProperties;
};

export const EventSongListValueViewerDividerRow = (props: Pick<EventSongListValueViewerRowProps, "value" | "pinnedRecordings" | "lengthColumnMode" | "toggleLengthColumnMode" | "maxBpm">) => {
    if (props.value.type !== 'divider') throw new Error(`wrongtype`);

    const colorInfo = GetStyleVariablesForColor({
        color: props.value.color || gSwatchColors.lighter_gray,// gAppColors.attendance_yes,
        enabled: true,
        fillOption: 'filled',
        selected: false,
        variation: 'strong',
    });

    const textStyle = SetlistAPI.StringToEventSongListDividerTextStyle(props.value.textStyle);
    const styleClasses = SetlistAPI.GetCssClassForEventSongListDividerTextStyle(textStyle);

    return <div className={`SongListValueViewerRow tr ${props.value.id <= 0 ? 'newItem' : 'existingItem'} item validItem type_divider ${colorInfo.cssClass} ${styleClasses}`} style={colorInfo.style}>
        <div className='divBreak'></div>
        <div className="td songIndex">
            {/* {props.value.index != null && props.value.index + 1} */}
        </div>
        <div className="td comment dividerCommentCell">
            <div className='comment dividerCommentContainer'>
                <div className='dividerBreakDiv'></div>
                <div className='comment dividerCommentText' >{props.value.subtitle}</div>
            </div>
            <div className='dividerButtonGroup'></div>
        </div>
    </div>

};

export const EventSongListValueViewerDividerSongRow = (props: Pick<EventSongListValueViewerRowProps, "value" | "pinnedRecordings" | "lengthColumnMode" | "toggleLengthColumnMode" | "maxBpm">) => {
    if (props.value.type !== 'divider') throw new Error(`wrongtype`);

    const colorInfo = GetStyleVariablesForColor({
        color: props.value.color || gSwatchColors.lighter_gray,// gAppColors.attendance_yes,
        enabled: true,
        fillOption: 'filled',
        selected: false,
        variation: 'strong',
    });

    const bpmValue = getRowStartBpm(props.value);
    const tempoCellStyle = getBpmBarStyle(bpmValue, props.maxBpm);

    return <div className={`SongListValueViewerRow tr existingItem item validItem type_divider ${colorInfo.cssClass}`} style={colorInfo.style}>
        <div className="td songIndex">
            {props.value.index != null && props.value.index + 1}
        </div>
        <div className="td play"></div>
        <div className="td songName">{props.value.subtitle}</div>
        <div className={`td ${props.lengthColumnMode === "length" ? "length" : "runningLength"} interactable`} onClick={props.toggleLengthColumnMode}>
            {props.lengthColumnMode === "length"
                ? (props.value.lengthSeconds && formatSongLength(props.value.lengthSeconds))
                : (props.value.runningTimeSeconds && <>{formatSongLength(props.value.runningTimeSeconds)}{props.value.songsWithUnknownLength ? <>+</> : <>&nbsp;</>}</>)
            }
        </div>
        <div className="td tempo" style={tempoCellStyle}>
        </div>
        <div className="td comment">{props.value.subtitleIfSong}</div>
    </div>

};


export const EventSongListValueViewerRow = (props: EventSongListValueViewerRowProps) => {
    const mediaPlayer = useMediaPlayer();
    if (props.value.type === 'divider') {
        if (props.value.isSong) {
            return <EventSongListValueViewerDividerSongRow {...props} />;
        }
        else {
            return <EventSongListValueViewerDividerRow {...props} />;
        }
    }
    const dashboardContext = useDashboardContext();
    const song = props.value.type === 'song' ? props.value.song : null;
    const bpmValue = getRowStartBpm(props.value);
    const tempoCellStyle = getBpmBarStyle(bpmValue, props.maxBpm);

    const pinnedRecording = props.value.type === "song" && props.pinnedRecordings?.[props.value.songId];
    const isCurrentMediaPlayerTrack = !!pinnedRecording && mediaPlayer.isPlayingSetlistItem({
        fileId: pinnedRecording.id,
        setlistId: props.songList.id,
        setlistItemIndex: props.rowIndex,
    });

    // Collect all unique tag IDs from all songs in the song list
    const allTagIds = React.useMemo(() => {
        const tagIds = new Set<number>();
        props.songList.content?.songItems.forEach(songListItem => {
            songListItem.song.tags.forEach(tag => tagIds.add(tag.tagId));
        });
        return Array.from(tagIds);
    }, [props.songList.content]);

    return <div className={`SongListValueViewerRow tr ${props.value.id <= 0 ? 'newItem' : 'existingItem'} item ${props.value.type === 'new' ? 'invalidItem' : 'validItem'} type_${props.value.type} ${isCurrentMediaPlayerTrack ? 'currentMediaPlayerTrack' : ''}`}>
        <AppContextMarker songId={song?.id || undefined}>
            <div className="td songIndex">
                {props.songList.isOrdered === true && props.value.type === 'song' && (props.value.index + 1)}
            </div>
            <div className="td play">{props.value.type === 'song' && props.mediaPlayerTrack && <SongPlayButton
                rowIndex={props.rowIndex}
                track={props.mediaPlayerTrack}
                getPlaylist={props.getPlaylist}
            />}</div>
            <div className="td songName">
                {props.value.type === 'song' && <>
                    <CMLink target='_blank' rel="noreferrer" href={dashboardContext.routingApi.getURIForSong(props.value.song)} trackingFeature={ActivityFeature.link_follow_internal} >{props.value.song.name}</CMLink>
                    <SongTagIndicatorContainer
                        tagIds={props.value.song.tags.map(tag => tag.tagId)}
                        allPossibleTags={allTagIds}
                    />
                </>}
            </div>
            <div className={`td ${props.lengthColumnMode === 'length' ? "length" : "runningLength"} interactable`} onClick={props.toggleLengthColumnMode}>
                {props.value.type === 'song' && (
                    props.lengthColumnMode === "length"
                        ? (props.value.song.lengthSeconds && formatSongLength(props.value.song.lengthSeconds))
                        : (props.value.runningTimeSeconds && <>{formatSongLength(props.value.runningTimeSeconds)}{props.value.songsWithUnknownLength ? <>+</> : <>&nbsp;</>}</>)
                )}
            </div>
            <div className="td tempo" style={tempoCellStyle}>
                {song?.startBPM && <MetronomeButton bpm={song.startBPM} isTapping={false} onSyncClick={() => { }} tapTrigger={0} variant='tiny' />}
            </div>

            <div className="td comment">
                <div className="comment">{props.value.type !== 'new' && props.value.subtitle}</div>
                {/* <div className="CMChipContainer comment2"></div> */}
            </div>
        </AppContextMarker>
    </div>

};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// function DividerToString(subtitle: string | null | undefined) {
//     return subtitle ? `-- ${subtitle} ------` : `--------`;
// }

async function CopySongListNames(content: db3.EventSongListContent, snackbarContext: SnackbarContextType) {
    const txt = content.toNamesText();
    await navigator.clipboard.writeText(txt);
    snackbarContext.showMessage({ severity: "success", children: `Copied ${txt.length} characters` });
}

async function CopySongListIndexAndNames(snackbarContext: SnackbarContextType, content: db3.EventSongListContent) {
    const txt = content.toIndexedNamesText();
    await navigator.clipboard.writeText(txt);
    snackbarContext.showMessage({ severity: "success", children: `Copied ${txt.length} characters` });
}

export type PortableSongListSong = {
    sortOrder: number;
    comment: string;
    song: SetlistAPI.EventSongListSongItem["song"];
    type: 'song';
};

export type PortableSongListDivider = {
    sortOrder: number;
    comment: string;
    color: string | null;
    isInterruption: boolean;
    isSong: boolean;
    subtitleIfSong: string | null;
    lengthSeconds: number | null;
    textStyle: string | null;
    type: 'divider';
};

export type PortableSongList = (PortableSongListSong | PortableSongListDivider)[];

async function CopySongListJSON(snackbarContext: SnackbarContextType, content: db3.EventSongListContent) {
    const obj: PortableSongList = content.items.flatMap<PortableSongListSong | PortableSongListDivider>((item, sortOrder) => {
        if (item.type === "song") {
            return [{
                sortOrder,
                song: item.song,
                comment: item.subtitle ?? "",
                type: "song" as const,
            }];
        }
        if (item.type === "divider") {
            return [{
                type: "divider" as const,
                color: item.color,
                isInterruption: item.isInterruption,
                isSong: item.isSong,
                subtitleIfSong: item.subtitleIfSong,
                lengthSeconds: item.lengthSeconds,
                textStyle: item.textStyle,
                sortOrder,
                comment: item.subtitle ?? "",
            }];
        }
        return [];
    });

    const txt = JSON.stringify(obj, null, 2);
    await navigator.clipboard.writeText(txt);
    snackbarContext.showMessage({ severity: "success", children: `copied ${txt.length} chars` });
}


async function CopySongListTSV(snackbarContext: SnackbarContextType, content: db3.EventSongListContent) {
    const txt = content.toTSV();
    await navigator.clipboard.writeText(txt);
    snackbarContext.showMessage({ severity: "success", children: `Copied ${txt.length} characters` });
}

async function CopySongListMarkdown(snackbarContext: SnackbarContextType, content: db3.EventSongListContent) {
    const txt = content.toMarkdown();
    await navigator.clipboard.writeText(txt);
    snackbarContext.showMessage({ severity: "success", children: `Copied ${txt.length} characters` });
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface EventSongListDotMenuProps {
    readonly: boolean;
    multipleLists: boolean;
    handleCopySongNames: () => Promise<void>;
    handleCopyIndexSongNames: () => Promise<void>;
    handleCopyMarkdown: () => Promise<void>;
    //handleCopyCSV: () => Promise<void>;
    handleCopyTSV: () => Promise<void>;
    handleCopyJSON: () => Promise<void>;

    handleCopyCombinedSongNames: () => Promise<void>;
    handleCopyCombinedMarkdown: () => Promise<void>;
    //handleCopyCombinedCSV: () => Promise<void>;
    handleCopyCombinedTSV: () => Promise<void>;
    handleCopyCombinedJSON: () => Promise<void>;

    handlePasteReplace: () => Promise<void>;
    handlePasteAppend: () => Promise<void>;
};

export const EventSongListDotMenu = (props: EventSongListDotMenuProps) => {
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    let k = 0;

    const menuItems: React.ReactNode[] = [
        <MenuItem key={++k} onClick={async () => { await props.handleCopySongNames(); setAnchorEl(null); }}>
            <ListItemIcon>
                {gIconMap.ContentCopy()}
            </ListItemIcon>
            Copy song names
        </MenuItem>,
        <MenuItem key={++k} onClick={async () => { await props.handleCopyIndexSongNames(); setAnchorEl(null); }}>
            <ListItemIcon>
                {gIconMap.ContentCopy()}
            </ListItemIcon>
            Copy # + song names
        </MenuItem>,
        <MenuItem key={++k} onClick={async () => { await props.handleCopyMarkdown(); setAnchorEl(null); }}>
            <ListItemIcon>
                {gIconMap.ContentCopy()}
            </ListItemIcon>
            Copy as Markdown
        </MenuItem>,
        <MenuItem key={++k} onClick={async () => { await props.handleCopyTSV(); setAnchorEl(null); }}>
            <ListItemIcon>
                {gIconMap.ContentCopy()}
            </ListItemIcon>
            Copy as TSV
        </MenuItem>,
        <MenuItem key={++k} onClick={async () => { await props.handleCopyJSON(); setAnchorEl(null); }}>
            <ListItemIcon>
                {gIconMap.ContentCopy()}
            </ListItemIcon>
            Copy as JSON (pasteable)
        </MenuItem>,
    ];

    if (props.multipleLists) {
        menuItems.push(
            <Divider key={++k} />,
            <MenuItem key={++k} onClick={async () => { await props.handleCopyCombinedSongNames(); setAnchorEl(null); }}>
                <ListItemIcon>
                    {gIconMap.ContentCopy()}
                </ListItemIcon>
                Copy unique song names from all lists
            </MenuItem>,
            <MenuItem key={++k} onClick={async () => { await props.handleCopyCombinedMarkdown(); setAnchorEl(null); }}>
                <ListItemIcon>
                    {gIconMap.ContentCopy()}
                </ListItemIcon>
                Copy unique song names from all lists as Markdown
            </MenuItem>,
            <MenuItem key={++k} onClick={async () => { await props.handleCopyCombinedTSV(); setAnchorEl(null); }}>
                <ListItemIcon>
                    {gIconMap.ContentCopy()}
                </ListItemIcon>
                Copy unique songs from all lists as TSV
            </MenuItem>,
            <MenuItem key={++k} onClick={async () => { await props.handleCopyCombinedJSON(); setAnchorEl(null); }}>
                <ListItemIcon>
                    {gIconMap.ContentCopy()}
                </ListItemIcon>
                Copy unique songs from all lists as JSON (pasteable)
            </MenuItem>,
        );
    }

    if (!props.readonly) {
        menuItems.push(
            <Divider key={++k} />,

            <MenuItem key={++k} onClick={async () => { await props.handlePasteReplace(); setAnchorEl(null); }}>
                <ListItemIcon>
                    {gIconMap.ContentPaste()}
                </ListItemIcon>
                Replace with clipboard contents
            </MenuItem>,
            <MenuItem key={++k} onClick={async () => { await props.handlePasteAppend(); setAnchorEl(null); }}>
                <ListItemIcon>
                    {gIconMap.ContentPaste()}
                </ListItemIcon>
                Append clipboard contents
            </MenuItem>,
        );
    }

    return <>
        <CMSmallButton className='DotMenu' onClick={(e) => setAnchorEl(anchorEl ? null : e.currentTarget)}>{gCharMap.VerticalEllipses()}</CMSmallButton>
        <Menu
            id="menu-songlist"
            anchorEl={anchorEl}
            keepMounted
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
        >
            {menuItems}
        </Menu >
    </>;
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface EventSongListValueViewerProps {
    value: db3.EventSongListDetailClient;
    allSongLists?: readonly db3.EventSongListDetailClient[];
    readonly: boolean;
    onEnterEditMode?: () => void; // if undefined, don't allow editing.
};

type SongListSortSpec = "sortOrderAsc" | "sortOrderDesc" | "nameAsc" | "nameDesc" | "bpmAsc" | "bpmDesc";
type LengthColumnMode = "length" | "runningTime";

export const EventSongListValueViewerTable = ({ showHeader = true, disableInteraction = false, ...props }: EventSongListValueViewerProps & { showHeader?: boolean | undefined, disableInteraction?: boolean | undefined }) => {
    const [sortSpec, setSortSpec] = React.useState<SongListSortSpec>("sortOrderAsc");
    const [lengthColumnMode, setLengthColumnMode] = React.useState<LengthColumnMode>("length");
    const snackbarContext = React.useContext(SnackbarContext);

    // Fetch all pinned recordings for songs in this list at once
    const songIds = props.value.content?.songItems.map(item => item.song.id) ?? [];
    const [pinnedRecordings] = useQuery(getSongPinnedRecording, {
        songIds: songIds,
    }, {
        enabled: songIds.length > 0
    });

    const rowItems = props.value.content?.items ?? [];
    const stats = props.value.content?.stats ?? {
        songCount: 0,
        durationSeconds: 0,
        songsOfUnknownDuration: 0,
        maxBpm: null,
    };

    const handleClickSortOrderTH = () => {
        if (sortSpec === 'sortOrderAsc') {
            setSortSpec('sortOrderDesc');
        }
        else {
            setSortSpec('sortOrderAsc');
        }
    };

    const handleClickSongNameTH = () => {
        if (sortSpec === 'nameAsc') {
            setSortSpec('nameDesc');
        }
        else {
            setSortSpec('nameAsc');
        }
    };

    const handleClickBpmTH = () => {
        if (sortSpec === 'bpmAsc') {
            setSortSpec('bpmDesc');
        } else {
            setSortSpec('bpmAsc');
        }
    };

    const toggleLengthColumnMode = () => {
        setLengthColumnMode(prev => prev === "length" ? "runningTime" : "length");
    };

    const getCombinedContent = (): db3.EventSongListContent => {
        if (!props.allSongLists) throw new Error("Combined setlists are unavailable.");

        const songsById = new Map<number, SetlistAPI.EventSongListSongItem>();
        props.allSongLists.forEach(songList => {
            songList.content?.songItems.forEach(item => songsById.set(item.songId, item));
        });
        const songs = [...songsById.values()]
            .sort((a, b) => a.song.name.localeCompare(b.song.name))
            .map((item, sortOrder) => ({
                id: item.id,
                eventSongListId: item.eventSongListId,
                subtitle: item.subtitle,
                sortOrder,
                songId: item.songId,
                song: item.song,
            }));
        return new db3.EventSongListContent({ songs, dividers: [] });
    };

    // Store current dependencies in a ref so the playlist function always returns current data
    const playlistDataRef = useRef({ rowItems, pinnedRecordings, songListId: props.value.id });
    playlistDataRef.current = { rowItems, pinnedRecordings, songListId: props.value.id };

    // Use a stable function reference that always reads current data
    const getPlaylist = useCallback(() => {
        //console.log(`getting playlist for song list ${playlistDataRef.current.songListId}`, props.value.songs);
        return playlistDataRef.current.rowItems.map((item, index) => RowItemToMediaPlayerTrack({
            allPinnedRecordings: playlistDataRef.current.pinnedRecordings || {},
            rowItem: item,
            rowIndex: index,
            songListId: playlistDataRef.current.songListId,
        }));
    }, []); // Empty dependency array - this function never changes

    return <div className="songListSongTable" style={{ pointerEvents: disableInteraction ? "none" : undefined }}>
        {showHeader && <div className="thead">
            <div className="tr">
                <div className="th songIndex interactable" onClick={handleClickSortOrderTH}># {sortSpec === 'sortOrderAsc' && gCharMap.DownArrow()} {sortSpec === 'sortOrderDesc' && gCharMap.UpArrow()}</div>
                <div className="th play"></div>
                <div className="th songName interactable" onClick={handleClickSongNameTH}>Song {sortSpec === 'nameAsc' && gCharMap.DownArrow()} {sortSpec === 'nameDesc' && gCharMap.UpArrow()}</div>
                <div className={`th ${lengthColumnMode === "length" ? "length" : "runningLength"} interactable`} onClick={toggleLengthColumnMode}>{lengthColumnMode === "length" ? "Len" : "∑T"}</div>
                <div className="th tempo interactable" onClick={handleClickBpmTH}>Bpm {sortSpec === 'bpmAsc' && gCharMap.DownArrow()} {sortSpec === 'bpmDesc' && gCharMap.UpArrow()}</div>
                <div className="th comment">
                    Comment
                    {props.allSongLists &&
                        <EventSongListDotMenu
                            readonly={true}
                            multipleLists={props.allSongLists.length > 1}
                            handleCopySongNames={async () => await CopySongListNames(props.value.content!, snackbarContext)}
                            handleCopyIndexSongNames={async () => await CopySongListIndexAndNames(snackbarContext, props.value.content!)}
                            handleCopyTSV={async () => await CopySongListTSV(snackbarContext, props.value.content!)}
                            handleCopyJSON={async () => await CopySongListJSON(snackbarContext, props.value.content!)}
                            handleCopyMarkdown={async () => await CopySongListMarkdown(snackbarContext, props.value.content!)}

                            handleCopyCombinedSongNames={async () => await CopySongListNames(getCombinedContent(), snackbarContext)}
                            handleCopyCombinedMarkdown={async () => await CopySongListMarkdown(snackbarContext, getCombinedContent())}
                            handleCopyCombinedTSV={async () => await CopySongListTSV(snackbarContext, getCombinedContent())}
                            handleCopyCombinedJSON={async () => await CopySongListJSON(snackbarContext, getCombinedContent())}

                            handlePasteAppend={async () => { }}
                            handlePasteReplace={async () => { }}
                        />}
                </div>
            </div>
        </div>}

        <div className="tbody">
            {
                rowItems.map((s, index) => <EventSongListValueViewerRow
                    key={index}
                    rowIndex={index}
                    value={s}
                    songList={props.value}
                    pinnedRecordings={pinnedRecordings || {}}
                    setlistRowItems={rowItems}
                    lengthColumnMode={lengthColumnMode}
                    toggleLengthColumnMode={toggleLengthColumnMode}
                    getPlaylist={getPlaylist}
                    mediaPlayerTrack={RowItemToMediaPlayerTrack({
                        allPinnedRecordings: pinnedRecordings || {},
                        rowItem: s,
                        rowIndex: index,
                        songListId: props.value.id,
                    })}
                    maxBpm={stats.maxBpm}
                />)
            }

        </div>
    </div>;
};



export const EventSongListValueViewer = (props: EventSongListValueViewerProps) => {
    const stats = props.value.content?.stats;
    const editAuthorized = !props.readonly && !!props.onEnterEditMode;

    return <div className={`EventSongListValue EventSongListValueViewer`}>

        <div className="header">

            <div className={`columnName-name ${editAuthorized && "draggable dragHandle"}`}>
                {editAuthorized && <div className="dragHandleIcon ">{gCharMap.Hamburger()}</div>}
                {props.value.name ?? ""}
                {props.value.isActuallyPlayed === true && <Tooltip disableInteractive title={`This is the playlist that was actually played or will be played`}><span className='verified songListVerified'>{gIconMap.Check()}</span></Tooltip>}
                <AdminInspectObject src={props.value} />
            </div>
            {!props.readonly && editAuthorized && <CMButton onClick={props.onEnterEditMode}>{gIconMap.Edit()}Edit</CMButton>}
        </div>
        <div className="content">
            {/* 
            <CMChipContainer>
                {props.value.isActuallyPlayed && <CMChip tooltip={"This setlist will be/was actually played; it's complete and in order"} size='small' color={gSwatchColors.green}>As performed</CMChip>}
            </CMChipContainer> */}

            <Markdown markdown={props.value.description ?? ""} />

            {props.value.content
                ? <EventSongListValueViewerTable {...props} />
                : <div className="CMSidenote">Setlist content is not available.</div>}

            {stats && <div className="stats CMSidenote">
                {stats.songCount} songs,
                length: {formatSongLength(stats.durationSeconds)}
                {stats.songsOfUnknownDuration > 0 && <> (with {stats.songsOfUnknownDuration} song(s) of unknown length)</>}
            </div>}
        </div>
    </div>;
};






////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface EventSongListValueEditorRowProps {
    value: SetlistAPI.EventSongListItem;
    rowIndex: number; // The index of this row in the setlistRowItems array
    songList: db3.EventSongListDraft;
    pinnedRecordings: Record<number, TSongPinnedRecording>; // songId -> pinnedRecording
    showDragHandle?: boolean;
    onChange: (newValue: SetlistAPI.EventSongListItem) => void;
    onDelete?: () => void;
    lengthColumnMode: LengthColumnMode;
    toggleLengthColumnMode: () => void;

    mediaPlayerTrack: MediaPlayerTrack | undefined;
    getPlaylist: () => MediaPlayerTrack[];
    maxBpm: number | null;
};

type EventSongListValueEditorRowPropsFor<TValue extends SetlistAPI.EventSongListItem> =
    Omit<EventSongListValueEditorRowProps, "value"> & { value: TValue };

interface EventSongListValueEditorRowShellProps {
    className: string;
    style?: React.CSSProperties;
    onDelete?: () => void;
    songIndex?: React.ReactNode;
    showDragHandle?: boolean;
    playButton?: React.ReactNode;
    children: React.ReactNode;
}

const EventSongListValueEditorRowShell = (props: EventSongListValueEditorRowShellProps) => {
    return <div className={`tr ${props.className}`} style={props.style}>
        <div className="td delete">{props.onDelete && <div className="freeButton" onClick={props.onDelete}>{gIconMap.Delete()}</div>}</div>
        <div className="td songIndex">{props.songIndex}</div>
        <div className="td dragHandle draggable">{CoalesceBool(props.showDragHandle, true) && gCharMap.Hamburger()}</div>
        <div className="td play">{props.playButton}</div>
        {props.children}
    </div>;
};

// Editor component for song-like dividers (when isSong is true)
export const EventSongListValueEditorDividerSongRow = (
    props: EventSongListValueEditorRowPropsFor<SetlistAPI.EventSongListDividerItem>,
) => {

    const colorInfo = GetStyleVariablesForColor({
        color: props.value.color || gSwatchColors.lighter_gray,
        enabled: true,
        fillOption: 'filled',
        selected: false,
        variation: 'strong',
    });

    const handleSubtitleChange = React.useCallback((newText: string) => {
        const item = { ...props.value, subtitle: newText };
        props.onChange(item);
    }, [props.value, props.onChange]);

    const handleSubtitleIfSongChange = React.useCallback((newText: string) => {
        const item = { ...props.value, subtitleIfSong: newText };
        props.onChange(item);
    }, [props.value, props.onChange]);

    const textStyle = SetlistAPI.StringToEventSongListDividerTextStyle(props.value.textStyle);
    const styleClasses = SetlistAPI.GetCssClassForEventSongListDividerTextStyle(textStyle);

    const style = {
        "--song-hash-color": getHashedColor(""),
        ...colorInfo.style,
    };

    const bpmValue = getRowStartBpm(props.value);
    const tempoCellStyle = getBpmBarStyle(bpmValue, props.maxBpm);

    return <EventSongListValueEditorRowShell
        className={`${props.value.id <= 0 ? 'newItem' : 'existingItem'} item validItem type_divider ${styleClasses} ${colorInfo.cssClass}`}
        style={style as any}
        onDelete={props.onDelete}
        songIndex={props.value.index != null && (props.value.index + 1)}
        showDragHandle={props.showDragHandle}
    >
        <div className="td songName">
            <CMTextInputBase
                className="cmdbSimpleInput"
                placeholder="Divider name"
                value={props.value.subtitle || ""}
                onChange={(e) => handleSubtitleChange(e.target.value)}
            />
        </div>
        <div className={`td ${props.lengthColumnMode === "length" ? "length" : "runningLength"} interactable`} onClick={props.toggleLengthColumnMode}>
            {props.lengthColumnMode === "length"
                ? (props.value.lengthSeconds && formatSongLength(props.value.lengthSeconds))
                : (props.value.runningTimeSeconds && <>{formatSongLength(props.value.runningTimeSeconds)}{props.value.songsWithUnknownLength ? <>+</> : <>&nbsp;</>}</>)
            }
        </div>
        <div className="td tempo" style={tempoCellStyle}></div>
        <div className="td comment">
            <CMTextInputBase
                className="cmdbSimpleInput"
                placeholder="Comment"
                value={props.value.subtitleIfSong || ""}
                onChange={(e) => handleSubtitleIfSongChange(e.target.value)}
            />
            <DividerEditInDialogButton
                value={props.value}
                sortOrder={props.value.sortOrder}
                songList={props.songList}
                onClick={(newVals) => {
                    props.onChange(newVals);
                }}
            />
        </div>
    </EventSongListValueEditorRowShell>;
};

const EventSongListValueEditorSongRow = (
    props: EventSongListValueEditorRowPropsFor<SetlistAPI.EventSongListSongItem>,
) => {
    const dashboardContext = useDashboardContext();
    const mediaPlayer = useMediaPlayer();
    const enrichedSong = enrichSong(props.value.song, dashboardContext);
    const bpmValue = getRowStartBpm(props.value);
    const tempoCellStyle = getBpmBarStyle(bpmValue, props.maxBpm);

    // Collect all unique tag IDs from all songs in the song list
    const allTagIds = React.useMemo(() => {
        const tagIds = new Set<number>();
        props.songList.items.forEach(songListItem => {
            if (songListItem.type !== "song") return;
            songListItem.song.tags.forEach(tag => tagIds.add(tag.tagId));
        });
        return Array.from(tagIds);
    }, [props.songList.items]);

    const pinnedRecording = props.pinnedRecordings?.[props.value.songId];
    const isCurrentMediaPlayerTrack = !!pinnedRecording && mediaPlayer.isPlayingSetlistItem({
        fileId: pinnedRecording.id,
        setlistId: props.songList.clientId,
        setlistItemIndex: props.rowIndex,
    });

    const handleCommentChange = React.useCallback((newText: string) => {
        const item = { ...props.value, subtitle: newText };
        props.onChange(item);
    }, [props.value, props.onChange]);

    const occurrences = props.songList.items.reduce(
        (acc, val) => acc + (val.type === "song" && val.songId === props.value.songId ? 1 : 0),
        0,
    );
    const isDupeWarning = occurrences > 1;

    const style = {
        "--song-hash-color": getHashedColor(props.value.song.name),
    };

    return <EventSongListValueEditorRowShell
        className={`${props.value.id <= 0 ? 'newItem' : 'existingItem'} item validItem type_song ${isCurrentMediaPlayerTrack ? 'currentMediaPlayerTrack' : ''}`}
        style={style as any}
        onDelete={props.onDelete}
        songIndex={props.value.index + 1}
        showDragHandle={props.showDragHandle}
        playButton={props.mediaPlayerTrack && <SongPlayButton
            rowIndex={props.rowIndex}
            getPlaylist={props.getPlaylist}
            track={props.mediaPlayerTrack}
        />}
    >
        {/* while it's tempting to make song names draggable themselves for very fast sorting, it interferes with
        pinch zooming and if you try to pinch zoom but accidentally drag songs around, you'll be sad.
        "dragHandle draggable" */}
        <div className="td songName">
            <div>{props.value.song.name}</div>
            <SongTagIndicatorContainer
                tagIds={props.value.song.tags.map(tag => tag.tagId)}
                allPossibleTags={allTagIds}
            />
        </div>
        <div className={`td ${props.lengthColumnMode === "length" ? "length" : "runningLength"} interactable`} onClick={props.toggleLengthColumnMode}>
            {props.lengthColumnMode === "length"
                ? (props.value.song.lengthSeconds && formatSongLength(props.value.song.lengthSeconds))
                : (props.value.runningTimeSeconds && <>{formatSongLength(props.value.runningTimeSeconds)}{props.value.songsWithUnknownLength ? <>+</> : <>&nbsp;</>}</>)}
        </div>
        <div className="td tempo" style={tempoCellStyle}>
            {enrichedSong.startBPM && <MetronomeButton bpm={enrichedSong.startBPM} isTapping={false} onSyncClick={() => { }} tapTrigger={0} variant='tiny' />}
        </div>
        <div className="td comment">
            <div className="comment">
                {isDupeWarning && <Tooltip title={`This song occurs ${occurrences} times in this set list. Is that right?`}><div className='warnIndicator'>!{occurrences}</div></Tooltip>}
                <InputBase
                    className="cmdbSimpleInput"
                    placeholder="Comment"
                    value={props.value.subtitle || ""}
                    onChange={(e) => handleCommentChange(e.target.value)}
                />
            </div>
        </div>
    </EventSongListValueEditorRowShell>;
};

const EventSongListValueEditorDividerRow = (
    props: EventSongListValueEditorRowPropsFor<SetlistAPI.EventSongListDividerItem>,
) => {
    const colorInfo = GetStyleVariablesForColor({
        color: props.value.color || gSwatchColors.lighter_gray,
        enabled: true,
        fillOption: 'filled',
        selected: false,
        variation: 'strong',
    });
    const textStyle = SetlistAPI.StringToEventSongListDividerTextStyle(props.value.textStyle);
    const styleClasses = SetlistAPI.GetCssClassForEventSongListDividerTextStyle(textStyle);
    const style = {
        "--song-hash-color": getHashedColor(""),
        ...colorInfo.style,
    };
    const handleCommentChange = React.useCallback((newText: string) => {
        props.onChange({ ...props.value, subtitle: newText });
    }, [props.value, props.onChange]);

    return <EventSongListValueEditorRowShell
        className={`${props.value.id <= 0 ? 'newItem' : 'existingItem'} item validItem type_divider ${styleClasses} ${colorInfo.cssClass}`}
        style={style as any}
        onDelete={props.onDelete}
        showDragHandle={props.showDragHandle}
    >
        <div className="td comment dividerCommentCell">
            <div className='comment dividerCommentContainer'>
                <div className='dividerBreakDiv before'></div>
                <CMTextarea
                    //autoFocus={true} // see #408
                    className="cmdbSimpleInput dividerCommentText"
                    placeholder="Comment"
                    value={props.value.subtitle || ""}
                    onChange={(e) => handleCommentChange(e.target.value)}
                />
                <div className='dividerBreakDiv after'></div>
            </div>
            <div className='dividerButtonGroup'>
                <DividerEditInDialogButton
                    value={props.value}
                    sortOrder={props.value.sortOrder}
                    songList={props.songList}
                    onClick={props.onChange}
                />
            </div>
        </div>
    </EventSongListValueEditorRowShell>;
};

const EventSongListValueEditorNewRow = (
    props: EventSongListValueEditorRowPropsFor<SetlistAPI.EventSongListNewItem>,
) => {
    const handleAutocompleteChange = (song: db3.SongPayload | null) => {
        if (!song) return;
        props.onChange({
            type: "song",
            eventSongListId: props.value.eventSongListId,
            id: props.value.id,
            sortOrder: props.value.sortOrder,
            subtitle: "",
            songId: song.id,
            song,
            index: 0,
            runningTimeSeconds: null,
            songsWithUnknownLength: 0,
        });
    };

    const handleNewDivider = (type: "break" | "divider") => {
        props.onChange({
            type: 'divider',
            color: null,
            eventSongListId: props.value.eventSongListId,
            id: getUniqueNegativeID(),
            textStyle: db3.EventSongListDividerTextStyle.Default,
            isInterruption: type === "break",
            runningTimeSeconds: null,
            songsWithUnknownLength: 0,
            index: -1,
            isSong: false,
            subtitleIfSong: null,
            lengthSeconds: null,
            sortOrder: props.value.sortOrder,
            subtitle: "",
        });
    };

    return <EventSongListValueEditorRowShell
        className="newItem item invalidItem type_new"
        showDragHandle={false}
    >
        <div className="td songName newItemSong">
            <SongAutocomplete
                onChange={handleAutocompleteChange}
                value={null}
                fadedSongIds={props.songList.items.flatMap(item => item.type === "song" ? [item.songId] : [])}
            />
        </div>
        <div className="td newItemActions">
            <CMSmallButton
                className='SetlistEditorNewDividerButton'
                tooltip="Add a divider"
                onClick={() => handleNewDivider("divider")}
            >+Divider</CMSmallButton>
            <CMSmallButton
                className='SetlistEditorNewDividerButton'
                tooltip="Add a break"
                onClick={() => handleNewDivider("break")}
            >+Break</CMSmallButton>
        </div>
    </EventSongListValueEditorRowShell>;
};

export const EventSongListValueEditorRow = (props: EventSongListValueEditorRowProps) => {
    switch (props.value.type) {
        case "song":
            return <EventSongListValueEditorSongRow {...props} value={props.value} />;
        case "divider":
            return props.value.isSong
                ? <EventSongListValueEditorDividerSongRow {...props} value={props.value} />
                : <EventSongListValueEditorDividerRow {...props} value={props.value} />;
        case "new":
            return <EventSongListValueEditorNewRow {...props} value={props.value} />;
    }
};


export const getClipboardSongList = async (): Promise<PortableSongList | null> => {
    let obj: undefined | PortableSongList = undefined;
    try {
        const txt = await navigator.clipboard.readText();
        obj = JSON.parse(txt) as PortableSongList;
        // sanity check.
        if (!Array.isArray(obj)) throw "not an array";
        if (obj.length < 1) {
            //snackbarContext.showMessage({ severity: 'error', children: "Empty setlist; ignoring." });
            return null;
        }
        if (!Number.isInteger(obj[0]!.sortOrder)) throw "no sort order";
        if (typeof (obj[0]!.type) !== 'string') throw "no type";
        return obj;
    } catch (e) {
        console.log(e);
        console.log(obj);
    }
    return null;
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// song list editor, but doesn't perform saving or db ops. parent component should handle that.
interface EventSongListValueEditorProps {
    initialValue: db3.EventSongListDraft;
    onSave: (newValue: db3.EventSongListDraft) => void;
    onCancel: () => void;
    onDelete?: () => void;
    rowMode: db3.DB3RowMode;
};

export const EventSongListValueEditor = ({ value, setValue, ...props }: EventSongListValueEditorProps & {
    value: db3.EventSongListDraft,
    setValue: (x: db3.EventSongListDraft) => void,
}) => {
    const snackbarContext = React.useContext(SnackbarContext);

    const newRowId = React.useMemo(() => getUniqueNegativeID(), []);
    const [lengthColumnMode, setLengthColumnMode] = React.useState<LengthColumnMode>("length");

    // Fetch all pinned recordings for songs in this list at once
    const songIds = value.items.flatMap(item => item.type === "song" ? [item.songId] : []);
    const [pinnedRecordings] = useQuery(getSongPinnedRecording, {
        songIds: songIds,
    }, {
        enabled: songIds.length > 0,
        suspense: false, // #629
        useErrorBoundary: false,
    });

    const hydratedContent = db3.getEventSongListDraftContent(value);
    const rowItems = [...hydratedContent.items];

    const tableSpec = new DB3Client.xTableClientSpec({
        table: db3.xEventSongList,
        columns: [
            new DB3Client.PKColumnClient({ columnName: "id" }),
            new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 180 }),
            new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 200 }),
        ],
    });

    // necessary to connect columns.
    const ctx__ = DB3Client.useTableRenderContext({
        requestedCaps: DB3Client.xTableClientCaps.None, // i don't think it's necessary to do this when i'm just connecting columns.
        tableSpec: tableSpec,
    });

    const api: DB3Client.NewDialogAPI = {
        setFieldValues: (fieldValues: TAnyModel) => {
            const newValue = { ...value, ...fieldValues };
            setValue(newValue);
        },
    };

    const validationResult = tableSpec.args.table.ValidateAndComputeDiff(value, value, props.rowMode);

    const stats = hydratedContent.stats;

    const toggleLengthColumnMode = () => {
        setLengthColumnMode(prev => prev === "length" ? "runningTime" : "length");
    };

    // after mutating presentation rows, fold them back into the ordered editor model
    const handleRowsUpdated = (rows: SetlistAPI.EventSongListItem[]) => {
        setValue({
            ...value,
            items: rows.flatMap(row => row.type === "new" ? [] : [
                db3.eventSongListRowToDraftItem(
                    row,
                    row.id === newRowId ? getUniqueNegativeID() : row.id,
                ),
            ]),
        });
    };

    const handleRowChange = (sourceRowId: number, newValue: SetlistAPI.EventSongListItem) => {
        const updatedRows = sourceRowId === newRowId
            ? [...rowItems, newValue]
            : db3.replaceEventSongListEditorRow(rowItems, sourceRowId, newValue);
        handleRowsUpdated(updatedRows);
    };

    const handleRowDelete = (row: SetlistAPI.EventSongListItem) => {
        handleRowsUpdated(rowItems.filter(existing => existing.id !== row.id));
    };

    const onDrop = (args: ReactSmoothDnd.DropResult) => {
        // removedIndex is the previous index; the original item to be moved
        // addedIndex is the new index where it should be moved to.
        if (args.addedIndex == null || args.removedIndex == null) throw new Error(`why are these null?`);
        if (args.addedIndex === args.removedIndex) return; // no change
        const newItems = moveItemInArray(rowItems, args.removedIndex, args.addedIndex).map((item, index) => ({ ...item, sortOrder: index }));
        handleRowsUpdated(newItems);
    };

    const getClipboardSongList2 = async (): Promise<PortableSongList | null> => {
        const x = await getClipboardSongList();
        if (!x) {
            snackbarContext.showMessage({ severity: 'error', children: "broken setlist; ignoring." });
        }
        return x;
    };

    const appendPortableSongList = (obj: PortableSongList, replace: boolean) => {
        const newItems: db3.EventSongListDraftItem[] = replace ? [] : [...value.items];
        const orderedPortableItems = [...obj].sort((a, b) => a.sortOrder - b.sortOrder);
        newItems.push(...orderedPortableItems.map(p => {
            switch (p.type) {
                case 'divider':
                    const div: db3.EventSongListDraftDivider = {
                        type: 'divider',
                        clientId: getUniqueNegativeID(),
                        color: p.color,
                        isInterruption: p.isInterruption,
                        isSong: p.isSong,
                        subtitleIfSong: p.subtitleIfSong,
                        lengthSeconds: p.lengthSeconds,
                        textStyle: p.textStyle,
                        subtitle: p.comment,
                    };
                    return div;
                case 'song':
                    const song: db3.EventSongListDraftSong = {
                        type: 'song',
                        clientId: getUniqueNegativeID(),
                        subtitle: p.comment,
                        songId: p.song.id,
                        song: p.song,
                    }
                    return song;
            }
            throw new Error(`unknown type?`);
        }));

        setValue({ ...value, items: newItems });
    };

    const handlePasteAppend = async () => {
        const obj = await getClipboardSongList2();
        if (!obj) return;
        appendPortableSongList(obj, false);
    };

    const handlePasteReplace = async () => {
        const obj = await getClipboardSongList2();
        if (!obj) return;
        appendPortableSongList(obj, true);
    };

    const nameColumn = tableSpec.getColumn("name");
    const nameField = nameColumn.renderForNewDialog!({ key: "name", row: value, validationResult, api, value: value.name, autoFocus: true });

    // Store current dependencies in a ref so the playlist function always returns current data
    const playlistDataRef = useRef({ rowItems, pinnedRecordings, songListId: value.clientId });
    playlistDataRef.current = { rowItems, pinnedRecordings, songListId: value.clientId };

    // Use a stable function reference that always reads current data
    const getPlaylist = useCallback(() => {
        //console.log(`getting playlist for song list ${playlistDataRef.current.songListId}`, value);
        return playlistDataRef.current.rowItems.map((item, index) => RowItemToMediaPlayerTrack({
            allPinnedRecordings: playlistDataRef.current.pinnedRecordings || {},
            rowItem: item,
            rowIndex: index,
            songListId: playlistDataRef.current.songListId,
        }))
    }, []); // Empty dependency array - this function never changes

    return <div className="EventSongListValue">

        {nameField}

        <FormControlLabel
            control={
                <Switch checked={value.isOrdered} onChange={e => {
                    const nv = { ...value };
                    nv.isOrdered = e.target.checked;
                    setValue(nv);
                }} />
            }
            label="Does order matter?"
        />

        <FormControlLabel
            control={
                <Switch checked={value.isActuallyPlayed} onChange={e => {
                    const nv = { ...value };
                    nv.isActuallyPlayed = e.target.checked;
                    setValue(nv);
                }} />
            }
            label="As performed / actually played live?"
        />


        {/*
          TITLE                  DURATION    BPM      Comment
☰ 1. 🗑 Paper Spaceships______   3:54       104 |||   ____________________
☰ 2. 🗑 Jet Begine____________   4:24       120 ||||  ____________________
   + ______________________ <-- autocomplete for new song search

   drag & drop is not supported by HTML tables.
   even though you can technically render the components (<container / draggable>) as table elements, dragging won't work.
   we don't even get the dragstart/end/etc events.

   best to stick to <div>s; fortunately:
   - we have few columns and only the song title is really essential; others can be fixed width
   - this grants us more reactive-friendly behaviors

                 */}

        <div className="songListSongTable">
            <div className="thead">
                <div className="tr">
                    <div className="th delete"></div>
                    <div className="th songIndex">#</div>
                    <div className="th dragHandle"></div>
                    <div className="th play"></div>
                    <div className="th songName">Song</div>
                    <div className={`th ${lengthColumnMode === "length" ? "length" : "runningLength"} interactable`} onClick={toggleLengthColumnMode}>{lengthColumnMode === "length" ? "Len" : "∑T"}</div>
                    <div className="th tempo">bpm</div>
                    <div className="th comment">
                        Comment
                        <EventSongListDotMenu
                            readonly={false}
                            multipleLists={false} // don't bother with this from the editor
                            handleCopySongNames={async () => await CopySongListNames(hydratedContent, snackbarContext)}
                            handleCopyIndexSongNames={async () => await CopySongListIndexAndNames(snackbarContext, hydratedContent)}
                            handleCopyTSV={async () => await CopySongListTSV(snackbarContext, hydratedContent)}
                            handleCopyJSON={async () => await CopySongListJSON(snackbarContext, hydratedContent)}
                            handleCopyMarkdown={async () => await CopySongListMarkdown(snackbarContext, hydratedContent)}
                            handleCopyCombinedSongNames={async () => { }}
                            handleCopyCombinedMarkdown={async () => { }}
                            handleCopyCombinedTSV={async () => { }}
                            handleCopyCombinedJSON={async () => { }}
                            handlePasteAppend={handlePasteAppend}
                            handlePasteReplace={handlePasteReplace}
                        />
                    </div>
                </div>
            </div>
            <ReactSmoothDndContainer
                dragHandleSelector=".dragHandle"
                lockAxis="y"
                onDrop={onDrop}
            >
                {
                    rowItems.map((s, index) => <ReactSmoothDndDraggable key={s.id}>
                        <EventSongListValueEditorRow
                            key={s.id}
                            rowIndex={index}
                            value={s}
                            pinnedRecordings={pinnedRecordings || {}}
                            onChange={(newValue) => handleRowChange(s.id, newValue)}
                            songList={value}
                            onDelete={() => handleRowDelete(s)}
                            lengthColumnMode={lengthColumnMode}
                            toggleLengthColumnMode={toggleLengthColumnMode}
                            getPlaylist={getPlaylist}
                            mediaPlayerTrack={RowItemToMediaPlayerTrack({
                                allPinnedRecordings: pinnedRecordings || {},
                                rowItem: s,
                                rowIndex: index,
                                songListId: value.clientId,
                            })}
                            maxBpm={stats.maxBpm}
                        />
                    </ReactSmoothDndDraggable>
                    )
                }
                <EventSongListValueEditorRow
                    key={"newRow"}
                    rowIndex={rowItems.length}
                    showDragHandle={false}
                    value={{
                        type: 'new',
                        id: newRowId,
                        eventSongListId: value.clientId,
                        sortOrder: rowItems.length,
                        songsWithUnknownLength: 0,
                        runningTimeSeconds: null,
                    }}
                    pinnedRecordings={pinnedRecordings || {}}
                    onChange={(newValue) => handleRowChange(newRowId, newValue)}
                    songList={value}
                    lengthColumnMode={lengthColumnMode}
                    toggleLengthColumnMode={toggleLengthColumnMode}
                    getPlaylist={getPlaylist}
                    mediaPlayerTrack={undefined}
                    maxBpm={stats.maxBpm}
                />
            </ReactSmoothDndContainer>
        </div>

        <div className="stats">
            {stats.songCount} songs, length: {formatSongLength(stats.durationSeconds)}
            {stats.songsOfUnknownDuration > 0 && <div>(with {stats.songsOfUnknownDuration} songs of unknown length)</div>}
        </div>

        {tableSpec.getColumn("description").renderForNewDialog!({ key: "description", row: value, validationResult, api, value: value.description, autoFocus: false })}
    </div>;
};



export const EventSongListValueEditorDialog = (props: EventSongListValueEditorProps) => {
    const [grayed, setGrayed] = React.useState<boolean>(false);
    const [preview, setPreview] = React.useState<boolean>(false);
    const messageBox = useMessageBox();
    const [value, setValue] = React.useState<db3.EventSongListDraft>(
        db3.cloneEventSongListDraft(props.initialValue),
    );

    const content = db3.getEventSongListDraftContent(value);
    const rowItems = content.items;
    const stats = content.stats;

    const handleDeleteClick = async () => {
        if (!props.onDelete) return;

        const result = await messageBox.showMessage({
            title: "Delete setlist?",
            message: "Are you sure you want to delete this setlist?",
            buttons: ['yes', 'cancel'],
        });
        if (result === 'yes') {
            props.onDelete();
        }
    };

    return <>
        <CMDialog
            open
            onClose={props.onCancel}
            className="EventSongListValueEditor"
            fillHeight
            fullWidth
            maxWidth="md"
            title={<>
                <div>Edit setlist</div>
                <SettingMarkdown setting='EditEventSongListDialogTitle' />
                <div style={{ display: "flex" }}>
                    {preview ? (<CMButton onClick={() => setPreview(false)} startIcon={<ArrowBack />}>Continue editing</CMButton>)
                        : (<CMButton onClick={() => setPreview(true)} startIcon={gIconMap.Visibility()}>Preview</CMButton>)}
                    <div className='flex-spacer'></div>
                    {props.onDelete && <CMButton onClick={handleDeleteClick}>
                        {gIconMap.Delete()}
                        Delete
                    </CMButton>}
                </div>
            </>}
            actions={<>
                <CMButton onClick={() => {
                    setGrayed(true);
                    props.onSave(value);
                }} startIcon={gIconMap.Save()} enabled={!grayed}>OK</CMButton>
                <CMButton onClick={props.onCancel} startIcon={gIconMap.Cancel()} enabled={!grayed}>Cancel</CMButton>
            </>}
        >
            <CMDialogContentText>
                <SettingMarkdown setting='EditEventSongListDialogDescription' />
                <AdminInspectObject src={props.initialValue} label="initial value" />
                <AdminInspectObject src={value} label="value" />
                <AdminInspectObject src={stats} label="stats" />
                <AdminInspectObject src={rowItems} label="rowitems" />
            </CMDialogContentText>

            {preview ? (
                <div style={{ pointerEvents: "none" }}>
                    <EventSongListValueViewer
                        readonly={true}
                        value={db3.eventSongListDraftToClient(value)}
                    />
                </div>
            ) : (
                <EventSongListValueEditor {...props} value={value} setValue={setValue} />
            )}
        </CMDialog>
    </>;
};





////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// editor for existing song lists, handles db mutations & parent refetching; rendering delegated to either EventSongListValueEditor or VIewer.
//         <EventSongListControl>
//             <EventSongListValueViewer> - has an edit button to switch modes
//             <EventSongListValueEditor>
interface EventSongListControlProps {
    value: db3.EventSongListDetailClient;
    allSongLists: readonly db3.EventSongListDetailClient[];
    readonly: boolean;
    refetch: () => void;
};

export const EventSongListControl = (props: EventSongListControlProps) => {

    const [editMode, setEditMode] = React.useState<boolean>(false);
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const publicData = useDB3Authorization();


    const draft = db3.eventSongListClientToDraft(props.value);
    const editAuthorized = !!draft && db3.xEventSongList.authorizeRowForEdit({
        publicData,
        model: draft,
    });

    const recordFeature = useFeatureRecorder();
    const deleteMutation = API.events.deleteEventSongListx.useToken();
    const updateMutation = API.events.updateEventSongListx.useToken();

    const handleSave = (newValue: db3.EventSongListDraft) => {
        void recordFeature({
            feature: ActivityFeature.setlist_edit,
            eventSongListId: props.value.id,
        });
        updateMutation.invoke(db3.eventSongListDraftToMutationCommand(newValue)).then(() => {
            showSnackbar({ severity: "success", children: "song list edit successful" });
            props.refetch();
            setEditMode(false);
        }).catch((e) => {
            console.log(e);
            showSnackbar({ severity: "error", children: "Error; see console" });
        });
    };

    const handleDelete = () => {
        void recordFeature({
            feature: ActivityFeature.setlist_delete,
            eventSongListId: props.value.id,
        });
        deleteMutation.invoke({
            id: props.value.id,
        }).then(() => {
            showSnackbar({ severity: "success", children: "song list delete successful" });
            props.refetch();
            setEditMode(false);
        }).catch((e) => {
            console.log(e);
            showSnackbar({ severity: "error", children: "Error; see console" });
        });
    };

    return <>
        {!props.readonly && editAuthorized && editMode && draft && <EventSongListValueEditorDialog
            initialValue={draft}
            onSave={handleSave}
            onDelete={handleDelete}
            onCancel={() => setEditMode(false)} rowMode="update"
        />}
        <EventSongListValueViewer
            readonly={props.readonly}
            value={props.value}
            allSongLists={props.allSongLists}
            onEnterEditMode={editAuthorized ? () => setEditMode(true) : undefined}
        />
    </>;
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// for new song lists. different from the other editor because this doesn't save automatically, it only saves after you click "save"
interface EventSongListNewEditorProps {
    event: db3.EventClientPayload_Verbose;
    onCancel: () => void;
    onSuccess: () => void;
};

export const EventSongListNewEditor = (props: EventSongListNewEditorProps) => {
    const recordFeature = useFeatureRecorder();
    const insertMutation = API.events.insertEventSongListx.useToken();
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const initialValue = React.useMemo(() => db3.createEventSongListDraft({
        clientId: getUniqueNegativeID(),
        eventId: props.event.id,
        name: props.event.songLists.length > 0
            ? `Set ${props.event.songLists.length + 1}`
            : "Setlist",
    }), [props.event.id, props.event.songLists.length]);

    const handleSave = (value: db3.EventSongListDraft) => {
        void recordFeature({
            feature: ActivityFeature.setlist_create,
            eventId: props.event.id,
        });
        insertMutation.invoke(db3.eventSongListDraftToMutationCommand(value)).then(() => {
            showSnackbar({ severity: "success", children: "added new song list" });
            props.onSuccess();
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: "Error; see console" });
        });
    };

    return <EventSongListValueEditorDialog
        onSave={handleSave}
        initialValue={initialValue}
        onCancel={props.onCancel}
        rowMode="new"
    />
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const EventSongListList = ({ values, event, readonly, refetch }: {
    values: readonly db3.EventSongListDetailClient[],
    event: db3.EventClientPayload_Verbose,
    readonly: boolean,
    refetch: () => void,
}) => {
    const [saving, setSaving] = React.useState<boolean>(false);
    const recordFeature = useFeatureRecorder();

    const updateSortOrderMutation = API.other.updateGenericSortOrderMutation.useToken();
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const onDrop = (args: ReactSmoothDnd.DropResult) => {
        if (args.addedIndex === args.removedIndex) return; // no change
        setSaving(true);
        // removedIndex is the previous index; the original item to be moved
        // addedIndex is the new index where it should be moved to.
        if (args.addedIndex == null || args.removedIndex == null) throw new Error(`why are these null?`);
        const movingItemId = values[args.removedIndex]!.id;
        const newPositionItemId = values[args.addedIndex]!.id;
        assert(!!movingItemId && !!newPositionItemId, "moving item not found?");

        void recordFeature({
            feature: ActivityFeature.setlist_reorder,
            eventSongListId: movingItemId,
        });

        updateSortOrderMutation.invoke({
            tableID: db3.xEventSongList.tableID,
            tableName: db3.xEventSongList.tableName,
            movingItemId,
            newPositionItemId,
            scopeRowIds: values.map(item => item.id),
            groupByColumn: "eventId",
            groupValue: event.id,
        }).then(() => {
            showSnackbar({ severity: "success", children: "song list reorder successful" });
            refetch();
        }).catch((e) => {
            console.log(e);
            showSnackbar({ severity: "error", children: "reorder error; see console" });
        }).finally(() => {
            setSaving(false);
        });

    };

    return <div className={`EventSongListList ${saving && "saving"}`}>
        <ReactSmoothDndContainer
            dragHandleSelector=".dragHandle"
            lockAxis="y"
            onDrop={onDrop}
        >
            {values.map(c => (
                <ReactSmoothDndDraggable key={c.id}>
                    <AppContextMarker name="EventSongListControl">
                        <EventSongListControl
                            key={c.id}
                            value={c}
                            allSongLists={values}
                            readonly={readonly}
                            refetch={refetch}
                        />
                    </AppContextMarker>
                </ReactSmoothDndDraggable>
            ))}
        </ReactSmoothDndContainer>
    </div>;
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const EventSongListTabContent = ({ event, readonly, refetch }: { event: db3.EventClientPayload_Verbose, readonly: boolean, refetch: () => void }) => {
    const [newOpen, setNewOpen] = React.useState<boolean>(false);
    const publicData = useDB3Authorization();
    const songListsClient = DB3Client.useDb3Query({
        view: db3.eventSongListDetailView,
        filterSpec: {
            items: [],
            tableParams: { eventId: event.id },
        },
    });

    const refetchAll = () => {
        refetch();
        songListsClient.refetch();
    };


    const insertAuthorized = db3.xEventSongList.authorizeRowBeforeInsert({
        publicData,
    });

    return <div className="EventSongListTabContent">
        <SettingMarkdown setting='EventSongListTabDescription' />
        {insertAuthorized && !readonly && <CMButton className='addNewSongListButton' onClick={() => setNewOpen(true)}>{gIconMap.Add()} Add new song list</CMButton>}
        {newOpen && !readonly && insertAuthorized && (
            <AppContextMarker name="EventSongListNewEditor">
                <EventSongListNewEditor event={event} onCancel={() => setNewOpen(false)} onSuccess={() => { setNewOpen(false); refetchAll(); }} />
            </AppContextMarker>
        )}
        <EventSongListList values={songListsClient.items} event={event} readonly={readonly} refetch={refetchAll} />
    </div>;
};

