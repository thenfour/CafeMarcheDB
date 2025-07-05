// drag reordering https://www.npmjs.com/package/react-smooth-dnd
// https://codesandbox.io/s/material-ui-sortable-list-with-react-smooth-dnd-swrqx?file=/src/index.js:113-129

// clipboard custom formats
// https://developer.chrome.com/blog/web-custom-formats-for-the-async-clipboard-api/

import { useAuthenticatedSession } from '@blitzjs/auth';
import { ArrowBack, ArrowForward } from '@mui/icons-material';
import { Button, DialogContent, DialogTitle, Divider, FormControlLabel, InputBase, ListItemIcon, Menu, MenuItem, Select, Switch, Tooltip } from "@mui/material";
import { assert } from 'blitz';
import React from "react";
import * as ReactSmoothDnd /*{ Container, Draggable, DropResult }*/ from "react-smooth-dnd";
import { moveItemInArray, sortBy } from 'shared/arrayUtils';
import { gSwatchColors, StandardVariationSpec } from 'shared/color';
import { formatSongLength } from 'shared/time';
import { CoalesceBool, getHashedColor, getUniqueNegativeID, IsNullOrWhitespace } from "shared/utils";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { SnackbarContext, SnackbarContextType } from "src/core/components/SnackbarContext";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import { API } from '../db3/clientAPI';
import { gCharMap, gIconMap } from '../db3/components/IconMap';
import { TAnyModel } from '../db3/shared/apiTypes';
import * as SetlistAPI from '../db3/shared/setlistApi';
import { AppContextMarker } from './AppContext';
import { ReactSmoothDndContainer, ReactSmoothDndDraggable } from "./CMCoreComponents";
import { AdminInspectObject, CMDialogContentText, CMSmallButton, CMTextarea, DialogActionsCM, NameValuePair } from './CMCoreComponents2';
import { CMLink } from './CMLink';
import { CMTextInputBase, SongLengthInput } from './CMTextField';
import { GetStyleVariablesForColor } from './Color';
import { ColorPick } from './ColorPick';
import { useMessageBox } from './MessageBoxContext';
import { DashboardContext, useFeatureRecorder } from './DashboardContext';
import { ActivityFeature } from './featureReports/activityTracking';
import { Markdown } from "./markdown/Markdown";
import { MetronomeButton } from './Metronome';
import { ReactiveInputDialog } from './ReactiveInputDialog';
import { SettingMarkdown } from './SettingMarkdown';
import { SongAutocomplete } from './SongAutocomplete';
import { useMediaPlayer } from './mediaPlayer/MediaPlayerContext';
import { AnimatedFauxEqualizer } from './mediaPlayer/MediaPlayerBar';
import { useQuery } from '@blitzjs/rpc';
import getSongPinnedRecording from '../db3/queries/getSongPinnedRecording';
import { getURIForFile } from '../db3/clientAPILL';

export const SongTagIndicatorContainer = ({ tagIds }: { tagIds: number[] }) => {
    const dashboardContext = React.useContext(DashboardContext);
    const allSongTags = tagIds.map(tagId => dashboardContext.songTag.getById(tagId)).filter(t => !!t);
    const tagsWithIndicators = allSongTags.filter(t => !IsNullOrWhitespace(t.indicator));
    if (!tagsWithIndicators.length) return null;
    const sortedTags = sortBy(tagsWithIndicators, t => t.sortOrder);
    return <div className='songTagIndicatorContainer'>
        {sortedTags.map((tag, i) => {
            const style = GetStyleVariablesForColor({ color: tag.color, ...StandardVariationSpec.Strong });
            return <Tooltip title={tag.text} key={i} disableInteractive>
                <div key={i} className={`songTagIndicator ${tag.indicatorCssClass} ${style.cssClass}`} style={style.style}>{tag.indicator}</div>
            </Tooltip>;
        })}
    </div>;
};

// Aligned version that shows all possible tags with consistent spacing
export const SongTagIndicatorContainerAligned = ({ tagIds, allPossibleTags }: {
    tagIds: number[],
    allPossibleTags: number[]
}) => {
    const dashboardContext = React.useContext(DashboardContext);

    // Get all possible tags that have indicators, sorted by sortOrder
    const allTags = allPossibleTags
        .map(tagId => dashboardContext.songTag.getById(tagId))
        .filter(t => !!t && !IsNullOrWhitespace(t.indicator)) as db3.SongTagPayload[];

    const sortedAllTags = sortBy(allTags, t => t.sortOrder);

    // Create a set of current song's tag IDs for quick lookup
    const currentTagIds = new Set(tagIds);

    if (!sortedAllTags.length) return null;

    return <div className='songTagIndicatorContainer aligned'>
        {sortedAllTags.map((tag, i) => {
            const style = GetStyleVariablesForColor({ color: tag.color, ...StandardVariationSpec.Strong });
            const isVisible = currentTagIds.has(tag.id);
            return <Tooltip title={tag.text} key={i} disableInteractive>
                <div
                    key={i}
                    className={`songTagIndicator ${tag.indicatorCssClass} ${style.cssClass}`}
                    style={{
                        ...style.style,
                        visibility: isVisible ? 'visible' : 'hidden'
                    }}
                >
                    {tag.indicator}
                </div>
            </Tooltip>;
        })}
    </div>;
};

const DividerEditInDialogDialog = ({ sortOrder, value, onClick, songList, onClose }: {
    sortOrder: number,
    value: SetlistAPI.EventSongListDividerItem,
    onClick: (x: SetlistAPI.EventSongListDividerItem) => void,
    songList: db3.EventSongListPayload,
    onClose: () => void,
}) => {
    //const [open, setOpen] = React.useState<boolean>(false);
    const [controlledValue, setControlledValue] = React.useState<SetlistAPI.EventSongListDividerItem>({ ...value });

    React.useEffect(() => {
        // Only reset the controlled value if we're editing a different divider (different ID)
        // This prevents the form from resetting when the user makes changes
        setControlledValue({ ...value });
    }, [value.id]);

    const makeFakeSongList = (testFormat: db3.EventSongListDividerTextStyle): db3.EventSongListPayload => {

        const ret = {
            ...songList,
            isOrdered: songList.isOrdered,
            isActuallyPlayed: songList.isActuallyPlayed,
            dividers: songList.dividers.filter(item => Math.abs(item.sortOrder - sortOrder) <= 2).map(d => ({ ...d })),
            songs: songList.songs.filter(item => Math.abs(item.sortOrder - sortOrder) <= 2).map(d => ({ ...d })),
        };
        const d = ret.dividers.find(x => x.sortOrder === sortOrder);
        if (!d) throw new Error();
        Object.assign(d, controlledValue);
        d.textStyle = testFormat;
        return ret;
    };

    return <ReactiveInputDialog
        onCancel={onClose}
    >
        <DialogTitle style={{ display: "flex", alignItems: "center" }}>Setlist <ArrowForward /> Edit setlist divider</DialogTitle>
        <DialogContent style={{ width: "var(--content-max-width)" }}>
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
                                <EventSongListValueViewerTable readonly={true} value={makeFakeSongList(option)} event={undefined} showHeader={false} disableInteraction />
                            </MenuItem>)}
                        </Select>
                    </div>
                }
            />
            <DialogActionsCM>
                <Button onClick={() => { onClick(controlledValue); onClose(); }} startIcon={gIconMap.Save()}>Ok</Button>
                <Button onClick={onClose} startIcon={gIconMap.Cancel()}>Cancel</Button>
            </DialogActionsCM>
        </DialogContent>
    </ReactiveInputDialog >
};


const DividerEditInDialogButton = ({ sortOrder, value, onClick, songList }: { sortOrder: number, value: SetlistAPI.EventSongListDividerItem, onClick: (x: SetlistAPI.EventSongListDividerItem) => void, songList: db3.EventSongListPayload }) => {
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
    songList: db3.EventSongListPayload;
};

export const EventSongListValueViewerDividerRow = (props: Pick<EventSongListValueViewerRowProps, "value">) => {
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

export const EventSongListValueViewerDividerSongRow = (props: Pick<EventSongListValueViewerRowProps, "value">) => {
    if (props.value.type !== 'divider') throw new Error(`wrongtype`);

    const colorInfo = GetStyleVariablesForColor({
        color: props.value.color || gSwatchColors.lighter_gray,// gAppColors.attendance_yes,
        enabled: true,
        fillOption: 'filled',
        selected: false,
        variation: 'strong',
    });

    return <div className={`SongListValueViewerRow tr existingItem item validItem type_divider ${colorInfo.cssClass}`} style={colorInfo.style}>
        <div className="td songIndex">
            {props.value.index != null && props.value.index + 1}
        </div>
        <div className="td play"></div>
        <div className="td songName">{props.value.subtitle}</div>
        <div className="td length">{props.value.lengthSeconds && formatSongLength(props.value.lengthSeconds)}</div>
        <div className="td runningLength">{props.value.runningTimeSeconds && <>{formatSongLength(props.value.runningTimeSeconds)}{props.value.songsWithUnknownLength ? <>+</> : <>&nbsp;</>}</>}</div>
        <div className="td tempo">
        </div>
        <div className="td comment">{props.value.subtitleIfSong}</div>
    </div>

};






// File-specific audio controls that use the global media player
type SongPlayButtonProps = {
    songList: db3.EventSongListPayload;
    songIndex: number;
};

export function SongPlayButton({ songList, songIndex }: SongPlayButtonProps) {
    const mediaPlayer = useMediaPlayer();
    const song = songList.songs[songIndex]?.song;
    const [matchingFile] = useQuery(getSongPinnedRecording, {
        songId: song?.id || -1, // avoid hook errors
    });

    if (!song) {
        return null;
    }

    if (!matchingFile?.pinnedRecording) return null;
    const file = matchingFile.pinnedRecording;
    const isCurrent = mediaPlayer.isPlayingFile(file.id);
    const isPlaying = isCurrent && mediaPlayer.isPlaying;

    // Play this file via the global player
    const handlePlay = () => {
        if (isCurrent) {
            mediaPlayer.unpause();
        } else {
            mediaPlayer.setPlaylist([
                {
                    file,
                    url: getURIForFile(file),
                    songContext: song,
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
                        visibility: "hidden"
                    }} />
                </div>
            )}
        </div>
    );
}





export const EventSongListValueViewerRow = (props: EventSongListValueViewerRowProps) => {
    if (props.value.type === 'divider') {
        if (props.value.isSong) {
            return <EventSongListValueViewerDividerSongRow {...props} />;
        }
        else {
            return <EventSongListValueViewerDividerRow {...props} />;
        }
    }
    const dashboardContext = React.useContext(DashboardContext);
    const enrichedSong = props.value.type === 'song' ? db3.enrichSong(props.value.song, dashboardContext) : null;

    // Collect all unique tag IDs from all songs in the song list
    const allTagIds = React.useMemo(() => {
        const tagIds = new Set<number>();
        props.songList.songs.forEach(songListItem => {
            songListItem.song.tags.forEach(tag => tagIds.add(tag.tagId));
        });
        return Array.from(tagIds);
    }, [props.songList.songs]);

    // const formattedBPM = props.value.type === 'song' ? API.songs.getFormattedBPM(props.value.song) : "";

    return <div className={`SongListValueViewerRow tr ${props.value.id <= 0 ? 'newItem' : 'existingItem'} item ${props.value.type === 'new' ? 'invalidItem' : 'validItem'} type_${props.value.type}`}>
        <AppContextMarker songId={enrichedSong?.id || undefined}>
            <div className="td songIndex">
                {props.songList.isOrdered && props.value.type === 'song' && (props.value.index + 1)}
            </div>
            <div className="td play">{enrichedSong?.pinnedRecordingId && props.value.type === 'song' && <SongPlayButton
                songList={props.songList}
                songIndex={props.value.songArrayIndex}
            />}</div>
            <div className="td songName">
                {props.value.type === 'song' && <>
                    <CMLink target='_blank' rel="noreferrer" href={API.songs.getURIForSong(props.value.song)} trackingFeature={ActivityFeature.link_follow_internal} >{props.value.song.name}</CMLink>
                    <SongTagIndicatorContainerAligned
                        tagIds={props.value.song.tags.map(tag => tag.tagId)}
                        allPossibleTags={allTagIds}
                    />
                </>}
            </div>
            <div className="td length">{props.value.type === 'song' && props.value.song.lengthSeconds && formatSongLength(props.value.song.lengthSeconds)}</div>
            <div className="td runningLength">{props.value.type === 'song' && props.value.runningTimeSeconds && <>{formatSongLength(props.value.runningTimeSeconds)}{props.value.songsWithUnknownLength ? <>+</> : <>&nbsp;</>}</>}</div>
            <div className="td tempo">
                {enrichedSong?.startBPM && <MetronomeButton bpm={enrichedSong.startBPM} isTapping={false} onSyncClick={() => { }} tapTrigger={0} variant='tiny' />}
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

async function CopySongListNames(setlist: db3.EventSongListPayload, snackbarContext: SnackbarContextType) {
    const txt = SetlistAPI.SongListNamesToString(setlist);
    await navigator.clipboard.writeText(txt);
    snackbarContext.showMessage({ severity: "success", children: `Copied ${txt.length} characters` });
}

async function CopySongListIndexAndNames(snackbarContext: SnackbarContextType, setlist: db3.EventSongListPayload) {
    const txt = SetlistAPI.SongListIndexAndNamesToString(setlist);
    await navigator.clipboard.writeText(txt);
    snackbarContext.showMessage({ severity: "success", children: `Copied ${txt.length} characters` });
}

export type PortableSongListSong = {
    sortOrder: number;
    comment: string;
    song: db3.SongPayload;
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

async function CopySongListJSON(snackbarContext: SnackbarContextType, value: db3.EventSongListPayload) {
    const obj: PortableSongList = value.songs.map((s, i): PortableSongListSong => ({
        sortOrder: s.sortOrder,
        song: s.song,
        comment: s.subtitle || "",
        type: 'song'
    }));

    obj.push(...value.dividers.map(d => {
        const x: PortableSongListDivider = {
            type: 'divider',
            color: d.color,
            isInterruption: d.isInterruption,
            isSong: d.isSong,
            subtitleIfSong: d.subtitleIfSong,
            lengthSeconds: d.lengthSeconds,
            textStyle: d.textStyle,
            sortOrder: d.sortOrder,
            comment: d.subtitle || "",
        };
        return x;
    }));

    obj.sort((a, b) => a.sortOrder - b.sortOrder);

    const txt = JSON.stringify(obj, null, 2);
    await navigator.clipboard.writeText(txt);
    snackbarContext.showMessage({ severity: "success", children: `copied ${txt.length} chars` });
}


async function CopySongListCSV(snackbarContext: SnackbarContextType, setlist: db3.EventSongListPayload) {
    const txt = SetlistAPI.SongListToCSV(setlist);
    await navigator.clipboard.writeText(txt);
    snackbarContext.showMessage({ severity: "success", children: `Copied ${txt.length} characters` });
}

async function CopySongListMarkdown(snackbarContext: SnackbarContextType, setlist: db3.EventSongListPayload) {
    const txt = SetlistAPI.SongListToMarkdown(setlist);
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
    handleCopyCSV: () => Promise<void>;
    handleCopyJSON: () => Promise<void>;

    handleCopyCombinedSongNames: () => Promise<void>;
    handleCopyCombinedMarkdown: () => Promise<void>;
    handleCopyCombinedCSV: () => Promise<void>;
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
        <MenuItem key={++k} onClick={async () => { await props.handleCopyCSV(); setAnchorEl(null); }}>
            <ListItemIcon>
                {gIconMap.ContentCopy()}
            </ListItemIcon>
            Copy as CSV
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
            <MenuItem key={++k} onClick={async () => { await props.handleCopyCombinedCSV(); setAnchorEl(null); }}>
                <ListItemIcon>
                    {gIconMap.ContentCopy()}
                </ListItemIcon>
                Copy unique songs from all lists as CSV
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
    value: db3.EventSongListPayload;
    event: db3.EventClientPayload_Verbose | undefined;
    readonly: boolean;
    onEnterEditMode?: () => void; // if undefined, don't allow editing.
};

type SongListSortSpec = "sortOrderAsc" | "sortOrderDesc" | "nameAsc" | "nameDesc" | "bpmAsc" | "bpmDesc";

export const EventSongListValueViewerTable = ({ showHeader = true, disableInteraction = false, ...props }: EventSongListValueViewerProps & { showHeader?: boolean | undefined, disableInteraction?: boolean | undefined }) => {
    const [sortSpec, setSortSpec] = React.useState<SongListSortSpec>("sortOrderAsc");
    const snackbarContext = React.useContext(SnackbarContext);

    const user = useCurrentUser()[0]!;
    const publicData = useAuthenticatedSession();
    const clientIntention: db3.xTableClientUsageContext = { intention: 'user', mode: 'primary', currentUser: user };

    const editAuthorized = db3.xEventSongList.authorizeRowForEdit({
        clientIntention,
        publicData,
        model: props.value,
    });

    const rowItems = SetlistAPI.GetRowItems(props.value);

    const stats = API.events.getSongListStats(props.value);

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

    // create a id -> index map.
    // the list is already sorted by sortorder
    const indexMap = new Map<number, number>();
    props.value.songs.forEach((s, i) => {
        indexMap.set(s.id, i + 1);
    });

    let sortedSongs = [...props.value.songs];
    sortedSongs.sort((a, b) => {
        switch (sortSpec) {
            case 'nameAsc':
                return a.song.name < b.song.name ? -1 : 1;
            case 'nameDesc':
                return a.song.name > b.song.name ? -1 : 1;
            case 'bpmAsc': {
                const aBpm = a.song.startBPM || 0;
                const bBpm = b.song.startBPM || 0;
                if (aBpm === bBpm) return a.song.name.localeCompare(b.song.name);
                return aBpm - bBpm;
            }
            case 'bpmDesc': {
                const aBpm = a.song.startBPM || 0;
                const bBpm = b.song.startBPM || 0;
                if (aBpm === bBpm) return a.song.name.localeCompare(b.song.name);
                return bBpm - aBpm;
            }
            default:
            case 'sortOrderAsc':
                return a.sortOrder < b.sortOrder ? -1 : 1;
            case 'sortOrderDesc':
                return a.sortOrder > b.sortOrder ? -1 : 1;
        }
    });

    const getCombinedList = (): db3.EventSongListPayload => {
        if (!props.event) throw new Error();

        const t: db3.EventSongListPayload = { ...props.event.songLists[0]!, songs: [] }; // create a copy of any random list
        // replace its song lists with a new array of combined
        const d = new Map<number, db3.EventSongListSongPayload>();
        props.event.songLists.forEach(sl => {
            sl.songs.forEach(sls => {
                d.set(sls.songId, sls);
            });
        });

        t.songs = [...d.values()];
        t.songs.sort((a, b) => {
            return a.song.name < b.song.name ? -1 : 1;
        });
        return t;
    };

    return <div className="songListSongTable" style={{ pointerEvents: disableInteraction ? "none" : undefined }}>
        {showHeader && <div className="thead">
            <div className="tr">
                <div className="th songIndex interactable" onClick={handleClickSortOrderTH}># {sortSpec === 'sortOrderAsc' && gCharMap.DownArrow()} {sortSpec === 'sortOrderDesc' && gCharMap.UpArrow()}</div>
                <div className="th play">{gIconMap.PlayCircleOutline()}</div>
                <div className="th songName interactable" onClick={handleClickSongNameTH}>Song {sortSpec === 'nameAsc' && gCharMap.DownArrow()} {sortSpec === 'nameDesc' && gCharMap.UpArrow()}</div>
                <div className="th length">Len</div>
                <div className="th runningLength">∑T</div>
                <div className="th tempo interactable" onClick={handleClickBpmTH}>Bpm {sortSpec === 'bpmAsc' && gCharMap.DownArrow()} {sortSpec === 'bpmDesc' && gCharMap.UpArrow()}</div>
                <div className="th comment">
                    Comment
                    {props.event &&
                        <EventSongListDotMenu
                            readonly={true}
                            multipleLists={props.event.songLists.length > 1}
                            handleCopySongNames={async () => await CopySongListNames(props.value, snackbarContext)}
                            handleCopyIndexSongNames={async () => await CopySongListIndexAndNames(snackbarContext, props.value)}
                            handleCopyCSV={async () => await CopySongListCSV(snackbarContext, props.value)}
                            handleCopyJSON={async () => await CopySongListJSON(snackbarContext, props.value)}
                            handleCopyMarkdown={async () => await CopySongListMarkdown(snackbarContext, props.value)}

                            handleCopyCombinedSongNames={async () => await CopySongListNames(getCombinedList(), snackbarContext)}
                            handleCopyCombinedMarkdown={async () => await CopySongListMarkdown(snackbarContext, getCombinedList())}
                            handleCopyCombinedCSV={async () => await CopySongListCSV(snackbarContext, getCombinedList())}
                            handleCopyCombinedJSON={async () => await CopySongListJSON(snackbarContext, getCombinedList())}

                            handlePasteAppend={async () => { }}
                            handlePasteReplace={async () => { }}
                        />}
                </div>
            </div>
        </div>}

        <div className="tbody">
            {
                rowItems.map((s, index) => <EventSongListValueViewerRow key={index} value={s} songList={props.value} />)
            }

        </div>
    </div>;
};



export const EventSongListValueViewer = (props: EventSongListValueViewerProps) => {
    const [sortSpec, setSortSpec] = React.useState<SongListSortSpec>("sortOrderAsc");
    const snackbarContext = React.useContext(SnackbarContext);

    const user = useCurrentUser()[0]!;
    const publicData = useAuthenticatedSession();
    const clientIntention: db3.xTableClientUsageContext = { intention: 'user', mode: 'primary', currentUser: user };

    const editAuthorized = db3.xEventSongList.authorizeRowForEdit({
        clientIntention,
        publicData,
        model: props.value,
    });

    //const rowItems = SetlistAPI.GetRowItems(props.value);

    const stats = API.events.getSongListStats(props.value);

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

    // create a id -> index map.
    // the list is already sorted by sortorder
    const indexMap = new Map<number, number>();
    props.value.songs.forEach((s, i) => {
        indexMap.set(s.id, i + 1);
    });

    let sortedSongs = [...props.value.songs];
    sortedSongs.sort((a, b) => {
        switch (sortSpec) {
            case 'nameAsc':
                return a.song.name < b.song.name ? -1 : 1;
            case 'nameDesc':
                return a.song.name > b.song.name ? -1 : 1;
            case 'bpmAsc': {
                const aBpm = a.song.startBPM || 0;
                const bBpm = b.song.startBPM || 0;
                if (aBpm === bBpm) return a.song.name.localeCompare(b.song.name);
                return aBpm - bBpm;
            }
            case 'bpmDesc': {
                const aBpm = a.song.startBPM || 0;
                const bBpm = b.song.startBPM || 0;
                if (aBpm === bBpm) return a.song.name.localeCompare(b.song.name);
                return bBpm - aBpm;
            }
            default:
            case 'sortOrderAsc':
                return a.sortOrder < b.sortOrder ? -1 : 1;
            case 'sortOrderDesc':
                return a.sortOrder > b.sortOrder ? -1 : 1;
        }
    });

    const getCombinedList = (): db3.EventSongListPayload => {
        if (!props.event) throw new Error();

        const t: db3.EventSongListPayload = { ...props.event.songLists[0]!, songs: [] }; // create a copy of any random list
        // replace its song lists with a new array of combined
        const d = new Map<number, db3.EventSongListSongPayload>();
        props.event.songLists.forEach(sl => {
            sl.songs.forEach(sls => {
                d.set(sls.songId, sls);
            });
        });

        t.songs = [...d.values()];
        t.songs.sort((a, b) => {
            return a.song.name < b.song.name ? -1 : 1;
        });
        return t;
    };

    return <div className={`EventSongListValue EventSongListValueViewer`}>

        <div className="header">

            <div className={`columnName-name ${editAuthorized && "draggable dragHandle"}`}>
                {editAuthorized && <div className="dragHandleIcon ">{gCharMap.Hamburger()}</div>}
                {props.value.name}
                {props.value.isActuallyPlayed && <Tooltip disableInteractive title={`This is the playlist that was actually played or will be played`}><span className='verified songListVerified'>{gIconMap.Check()}</span></Tooltip>}
            </div>
            {!props.readonly && editAuthorized && <Button onClick={props.onEnterEditMode}>{gIconMap.Edit()}Edit</Button>}

        </div>
        <div className="content">
            {/* 
            <CMChipContainer>
                {props.value.isActuallyPlayed && <CMChip tooltip={"This setlist will be/was actually played; it's complete and in order"} size='small' color={gSwatchColors.green}>As performed</CMChip>}
            </CMChipContainer> */}

            <Markdown markdown={props.value.description} />

            <EventSongListValueViewerTable {...props} />

            <div className="stats CMSidenote">
                {stats.songCount} songs,
                length: {formatSongLength(stats.durationSeconds)}
                {stats.songsOfUnknownDuration > 0 && <> (with {stats.songsOfUnknownDuration} song(s) of unknown length)</>}
            </div>
        </div>
    </div>;
};






////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface EventSongListValueEditorRowProps {
    value: SetlistAPI.EventSongListItem;
    songList: db3.EventSongListPayload;
    showDragHandle?: boolean;
    onChange: (newValue: SetlistAPI.EventSongListItem) => void;
    onDelete?: () => void;
};

// Editor component for song-like dividers (when isSong is true)
export const EventSongListValueEditorDividerSongRow = (props: EventSongListValueEditorRowProps) => {
    if (props.value.type !== 'divider') throw new Error(`wrongtype`);

    const showDragHandle = CoalesceBool(props.showDragHandle, true);

    const colorInfo = GetStyleVariablesForColor({
        color: props.value.color || gSwatchColors.lighter_gray,
        enabled: true,
        fillOption: 'filled',
        selected: false,
        variation: 'strong',
    });

    const handleSubtitleChange = (newText: string) => {
        const item = { ...props.value, subtitle: newText };
        props.onChange(item);
    };

    const handleSubtitleIfSongChange = (newText: string) => {
        const item = { ...props.value, subtitleIfSong: newText };
        props.onChange(item);
    };

    const textStyle = SetlistAPI.StringToEventSongListDividerTextStyle(props.value.textStyle);
    const styleClasses = SetlistAPI.GetCssClassForEventSongListDividerTextStyle(textStyle);

    const style = {
        "--song-hash-color": getHashedColor(""),
        ...colorInfo.style,
    };

    return <div
        className={`tr ${props.value.id <= 0 ? 'newItem' : 'existingItem'} item validItem type_divider ${styleClasses} ${colorInfo.cssClass}`}
        style={style as any}
    >
        <div className="td icon">{props.onDelete && <div className="freeButton" onClick={props.onDelete}>{gIconMap.Delete()}</div>}</div>
        <div className="td songIndex">{props.value.index != null && (props.value.index + 1)}</div>
        <div className="td dragHandle draggable">{showDragHandle && gCharMap.Hamburger()}</div>
        <div className="td songName">
            <CMTextInputBase
                className="cmdbSimpleInput"
                placeholder="Divider name"
                value={props.value.subtitle || ""}
                onChange={(e) => handleSubtitleChange(e.target.value)}
            />
        </div>
        <div className="td length">{props.value.lengthSeconds && formatSongLength(props.value.lengthSeconds)}</div>
        <div className="td runningLength">{props.value.runningTimeSeconds && <>{formatSongLength(props.value.runningTimeSeconds)}{props.value.songsWithUnknownLength ? <>+</> : <>&nbsp;</>}</>}</div>
        <div className="td tempo"></div>
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
    </div>;
};

export const EventSongListValueEditorRow = (props: EventSongListValueEditorRowProps) => {
    const dashboardContext = React.useContext(DashboardContext);
    const enrichedSong = (props.value.type === 'song') ? db3.enrichSong(props.value.song, dashboardContext) : null;
    const showDragHandle = CoalesceBool(props.showDragHandle, true);

    // Collect all unique tag IDs from all songs in the song list
    const allTagIds = React.useMemo(() => {
        const tagIds = new Set<number>();
        props.songList.songs.forEach(songListItem => {
            songListItem.song.tags.forEach(tag => tagIds.add(tag.tagId));
        });
        return Array.from(tagIds);
    }, [props.songList.songs]);

    const colorInfo = props.value.type === 'divider' ? GetStyleVariablesForColor({
        color: props.value.color || gSwatchColors.lighter_gray,// gAppColors.attendance_yes,
        enabled: true,
        fillOption: 'filled',
        selected: false,
        variation: 'strong',
    }) : {
        cssClass: "",
        style: {},
    };

    const handleAutocompleteChange = (song: db3.SongPayload | null) => {
        if (!song) return;
        const { id, eventSongListId, sortOrder } = props.value;
        const item: SetlistAPI.EventSongListSongItem = {
            type: "song",
            eventSongListId,
            id,
            sortOrder,
            subtitle: "",
            songId: song.id,
            song: song,
            index: 0, // will be set later
            songArrayIndex: 0, // will be set later by GetRowItems
            runningTimeSeconds: null, // populated later
            songsWithUnknownLength: 0, // populated later
        }
        props.onChange(item);
    }

    const handleCommentChange = (newText: string) => {
        if (props.value.type === 'new') return;
        const item = { ...props.value, subtitle: newText };
        props.onChange(item);
    };

    let occurrences = 0;
    if (props.value.type === 'song') {
        const songId = props.value.songId;
        occurrences = props.songList.songs.reduce((acc, val) => acc + (val.songId === songId ? 1 : 0), 0);
    }
    const isDupeWarning = occurrences > 1;

    const style = {
        "--song-hash-color": getHashedColor(props.value.type === "song" ? props.value.song.name : ""),
        ...colorInfo.style,
    };

    const handleNewDivider = () => {
        props.onChange({
            type: 'divider',
            color: null,
            eventSongListId: props.value.eventSongListId,
            id: getUniqueNegativeID(),
            textStyle: db3.EventSongListDividerTextStyle.Default,
            isInterruption: false,
            runningTimeSeconds: null,
            songsWithUnknownLength: 0,
            index: -1,
            isSong: false,
            subtitleIfSong: null,
            lengthSeconds: null,
            sortOrder: props.value.sortOrder,
            subtitle: "",
        });
    }

    const textStyle = SetlistAPI.StringToEventSongListDividerTextStyle(props.value.type === 'divider' ? props.value.textStyle : null);
    const styleClasses = SetlistAPI.GetCssClassForEventSongListDividerTextStyle(textStyle);

    // Handle different divider types
    if (props.value.type === 'divider') {
        if (props.value.isSong) {
            return <EventSongListValueEditorDividerSongRow {...props} />;
        } else {
            // Regular break-style divider
            return <div
                className={`tr ${props.value.id <= 0 ? 'newItem' : 'existingItem'} item validItem type_${props.value.type} ${styleClasses} ${colorInfo.cssClass}`}
                style={style as any}
            >
                <div className="td icon">{props.onDelete && <div className="freeButton" onClick={props.onDelete}>{gIconMap.Delete()}</div>}</div>
                <div className="td songIndex"></div>
                <div className="td dragHandle draggable">{showDragHandle && gCharMap.Hamburger()}</div>
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
                            onClick={(newVals) => {
                                props.onChange(newVals);
                            }}
                        />
                    </div>
                </div>
            </div>;
        }
    }

    // Regular song or new item row
    return <div
        className={`tr ${props.value.id <= 0 ? 'newItem' : 'existingItem'} item ${props.value.type === "new" ? 'invalidItem' : 'validItem'} type_${props.value.type} ${styleClasses} ${colorInfo.cssClass}`}
        style={style as any}
    >
        <div className="td icon">{props.onDelete && <div className="freeButton" onClick={props.onDelete}>{gIconMap.Delete()}</div>}</div>
        <div className="td songIndex">{props.value.type === 'song' && (props.value.index + 1)}
        </div>
        <div className="td dragHandle draggable">{showDragHandle && gCharMap.Hamburger()}
        </div>
        {/* while it's tempting to make song names draggable themselves for very fast sorting, it interferes with
        pinch zooming and if you try to pinch zoom but accidentally drag songs around, you'll be sad. 
        ${props.value.type === 'song' && "dragHandle draggable"}*/}
        <div className={`td songName `}>
            {props.value.type === 'song' && <>
                <div>{props.value.song.name}</div>
                <SongTagIndicatorContainerAligned
                    tagIds={props.value.song.tags.map(tag => tag.tagId)}
                    allPossibleTags={allTagIds}
                />
            </>}

            {/* value used to be props.value.song || null */}
            {props.value.type === 'new' && <SongAutocomplete onChange={handleAutocompleteChange} value={null} fadedSongIds={props.songList.songs.map(s => s.songId)} />}
        </div>
        <div className="td length">
            {props.value.type === 'song' && props.value.song.lengthSeconds && formatSongLength(props.value.song.lengthSeconds)}
        </div>
        <div className="td runningLength">{props.value.type === 'song' && props.value.runningTimeSeconds && <>{formatSongLength(props.value.runningTimeSeconds)}{props.value.songsWithUnknownLength ? <>+</> : <>&nbsp;</>}</>}</div>
        <div className="td tempo">
            {enrichedSong?.startBPM && <MetronomeButton bpm={enrichedSong.startBPM} isTapping={false} onSyncClick={() => { }} tapTrigger={0} variant='tiny' />}
            {(props.value.type === 'new') && <Tooltip title="Add a divider"><span><CMSmallButton onClick={handleNewDivider}>+Divider</CMSmallButton></span></Tooltip>}
        </div>
        <div className="td comment">
            <div className="comment">
                {isDupeWarning && <Tooltip title={`This song occurs ${occurrences} times in this set list. Is that right?`}><div className='warnIndicator'>!{occurrences}</div></Tooltip>}
                {props.value.type !== 'new' &&
                    <InputBase
                        className="cmdbSimpleInput"
                        placeholder="Comment"
                        value={props.value.subtitle || ""}
                        onChange={(e) => handleCommentChange(e.target.value)}
                    />}
            </div>
        </div>
    </div>;
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
    initialValue: db3.EventSongListPayload;
    event: db3.EventClientPayload_Verbose;
    onSave: (newValue: db3.EventSongListPayload) => void;
    onCancel: () => void;
    onDelete?: () => void;
    rowMode: db3.DB3RowMode;
};

export const EventSongListValueEditor = ({ value, setValue, ...props }: EventSongListValueEditorProps & {
    value: db3.EventSongListPayload,
    setValue: (x: db3.EventSongListPayload) => void,
}) => {
    const snackbarContext = React.useContext(SnackbarContext);
    const currentUser = useCurrentUser()[0]!;
    const clientIntention: db3.xTableClientUsageContext = { intention: "user", mode: "primary", currentUser };
    const newRowId = React.useMemo(() => getUniqueNegativeID(), []);

    const rowItems = SetlistAPI.GetRowItems(value);

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
        clientIntention,
        requestedCaps: DB3Client.xTableClientCaps.None, // i don't think it's necessary to do this when i'm just connecting columns.
        tableSpec: tableSpec,
    });

    const api: DB3Client.NewDialogAPI = {
        setFieldValues: (fieldValues: TAnyModel) => {
            const newValue = { ...value, ...fieldValues };
            setValue(newValue);
        },
    };

    const validationResult = tableSpec.args.table.ValidateAndComputeDiff(value, value, props.rowMode, clientIntention);

    const stats = API.events.getSongListStats(value);

    const itemToEventSongListSong = (x: SetlistAPI.EventSongListSongItem) => {
        const { type, songId, song, ...rest } = x;
        if (!songId) throw new Error(`expected songId here`);
        if (!song) throw new Error(`expected song here`);
        const id = x.id === newRowId ? getUniqueNegativeID() : x.id;
        const p: SetlistAPI.EventSongListSongItemWithSong = { ...rest, songId, song, id };
        return p;
    };

    // after you mutate rowItems (ordering, data, whatever), call this to apply to the setlist object
    const handleRowsUpdated = (rows: SetlistAPI.EventSongListItem[]) => {
        const newValue = JSON.parse(JSON.stringify(value));
        newValue.songs = rows.filter(r => r.type === 'song').map(item => itemToEventSongListSong(item));
        newValue.dividers = rows.filter(r => r.type === "divider");
        setValue(newValue);
    };

    const handleRowChange = (newValue: SetlistAPI.EventSongListItem) => {
        handleRowsUpdated([...rowItems.filter(row => row.id !== newValue.id), newValue]);
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

    const appendPortableSongList = (list: db3.EventSongListPayload, obj: PortableSongList) => {
        const newItems: SetlistAPI.EventSongListItem[] = [...rowItems.filter(item => item.type !== 'new')];
        const highestSortOrder = 1 + newItems.reduce((acc, val) => Math.max(acc, val.sortOrder), 0);

        newItems.push(...obj.map(p => {
            switch (p.type) {
                case 'divider':
                    const div: SetlistAPI.EventSongListDividerItem = {
                        type: 'divider',
                        id: getUniqueNegativeID(),
                        color: p.color,
                        isInterruption: p.isInterruption,
                        isSong: p.isSong,
                        subtitleIfSong: p.subtitleIfSong,
                        lengthSeconds: p.lengthSeconds,
                        textStyle: p.textStyle,
                        eventSongListId: list.id,
                        sortOrder: highestSortOrder + p.sortOrder,// assumes non-zero sort orders
                        subtitle: p.comment,
                        runningTimeSeconds: null, // populated later
                        songsWithUnknownLength: -1, // populated later
                        index: -1, // populated later
                    };
                    return div;
                case 'song':
                    const song: SetlistAPI.EventSongListSongItem = {
                        type: 'song',
                        id: getUniqueNegativeID(),
                        eventSongListId: list.id,
                        sortOrder: highestSortOrder + p.sortOrder,// assumes non-zero sort orders
                        subtitle: p.comment,
                        songId: p.song.id,
                        song: p.song,
                        index: 0, // it doesn't matter; it will get populated later
                        songArrayIndex: 0, // will be set later by GetRowItems
                        runningTimeSeconds: null, // populated later
                        songsWithUnknownLength: 0, // populated later
                    }
                    return song;
            }
            throw new Error(`unknown type?`);
        }));

        handleRowsUpdated(newItems);
    };

    const handlePasteAppend = async () => {
        const obj = await getClipboardSongList2();
        if (!obj) return;
        const newList = { ...value };
        appendPortableSongList(newList, obj);
        //setValue(newList);
    };

    const handlePasteReplace = async () => {
        const obj = await getClipboardSongList2();
        if (!obj) return;
        const newList = { ...value, dividers: [], songs: [] };
        appendPortableSongList(newList, obj);
        //setValue(newList);
    };

    const nameColumn = tableSpec.getColumn("name");
    const nameField = nameColumn.renderForNewDialog!({ key: "name", row: value, validationResult, api, value: value.name, clientIntention, autoFocus: true });

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

        {/* {tableSpec.getColumn("sortOrder").renderForNewDialog!({ key: "sortOrder", row: value, validationResult, api, value: value.sortOrder, clientIntention, autoFocus: false })} */}

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
                    <div className="th dragHandle"></div>
                    <div className="th songIndex">#</div>
                    <div className="th icon"></div>
                    <div className="th songName">Song</div>
                    <div className="th length">Len</div>
                    <div className="th runningLength">∑T</div>
                    <div className="th tempo">bpm</div>
                    <div className="th comment">
                        Comment
                        <EventSongListDotMenu
                            readonly={false}
                            multipleLists={false} // don't bother with this from the editor
                            handleCopySongNames={async () => await CopySongListNames(value, snackbarContext)}
                            handleCopyIndexSongNames={async () => await CopySongListIndexAndNames(snackbarContext, value)}
                            handleCopyCSV={async () => await CopySongListCSV(snackbarContext, value)}
                            handleCopyJSON={async () => await CopySongListJSON(snackbarContext, value)}
                            handleCopyMarkdown={async () => await CopySongListMarkdown(snackbarContext, value)}
                            handleCopyCombinedSongNames={async () => { }}
                            handleCopyCombinedMarkdown={async () => { }}
                            handleCopyCombinedCSV={async () => { }}
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
                        <EventSongListValueEditorRow key={s.id} value={s} onChange={handleRowChange} songList={value} onDelete={() => handleRowDelete(s)} />
                    </ReactSmoothDndDraggable>
                    )
                }
                <EventSongListValueEditorRow
                    key={"newRow"}
                    //index={rowItems.length}
                    showDragHandle={false}
                    value={{
                        type: 'new',
                        id: newRowId,
                        eventSongListId: value.id,
                        sortOrder: rowItems.length,
                    }}
                    onChange={handleRowChange}
                    songList={value} />
            </ReactSmoothDndContainer>
        </div>

        <div className="stats">
            {stats.songCount} songs, length: {formatSongLength(stats.durationSeconds)}
            {stats.songsOfUnknownDuration > 0 && <div>(with {stats.songsOfUnknownDuration} songs of unknown length)</div>}
        </div>

        {tableSpec.getColumn("description").renderForNewDialog!({ key: "description", row: value, validationResult, api, value: value.description, clientIntention, autoFocus: false })}
    </div>;
};



export const EventSongListValueEditorDialog = (props: EventSongListValueEditorProps) => {
    const [grayed, setGrayed] = React.useState<boolean>(false);
    const [preview, setPreview] = React.useState<boolean>(false);
    const messageBox = useMessageBox();
    const [value, setValue] = React.useState<db3.EventSongListPayload>(JSON.parse(JSON.stringify(props.initialValue)));

    const rowItems = SetlistAPI.GetRowItems(value);

    const stats = API.events.getSongListStats(value);

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
        <ReactiveInputDialog onCancel={props.onCancel} className="EventSongListValueEditor" style={{ minHeight: "100vh" }}>

            <DialogTitle>
                <div>Edit setlist</div>
                <SettingMarkdown setting='EditEventSongListDialogTitle' />
                <div style={{ display: "flex" }}>
                    {preview ? (<Button onClick={() => setPreview(false)} startIcon={<ArrowBack />}>Continue editing</Button>)
                        : (<Button onClick={() => setPreview(true)} startIcon={gIconMap.Visibility()}>Preview</Button>)}
                    <div className='flex-spacer'></div>
                    {props.onDelete && <Button onClick={handleDeleteClick}>
                        {gIconMap.Delete()}
                        Delete
                    </Button>}
                </div>
            </DialogTitle>
            <DialogContent dividers>
                <CMDialogContentText>
                    <SettingMarkdown setting='EditEventSongListDialogDescription' />
                    <AdminInspectObject src={props.initialValue} label="initial value" />
                    <AdminInspectObject src={value} label="value" />
                    <AdminInspectObject src={stats} label="stats" />
                    <AdminInspectObject src={rowItems} label="rowitems" />
                </CMDialogContentText>

                {preview ? (
                    <div style={{ pointerEvents: "none" }}>
                        <EventSongListValueViewer readonly={true} value={value} event={props.event} />
                    </div>
                ) : (
                    <EventSongListValueEditor {...props} value={value} setValue={setValue} />
                )}



                <DialogActionsCM>

                    <Button onClick={() => {
                        setGrayed(true);
                        props.onSave(value);
                    }} startIcon={gIconMap.Save()} disabled={grayed}>OK</Button>
                    <Button onClick={props.onCancel} startIcon={gIconMap.Cancel()} disabled={grayed}>Cancel</Button>

                </DialogActionsCM>

            </DialogContent>

        </ReactiveInputDialog>
    </>;
};





////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// editor for existing song lists, handles db mutations & parent refetching; rendering delegated to either EventSongListValueEditor or VIewer.
//         <EventSongListControl>
//             <EventSongListValueViewer> - has an edit button to switch modes
//             <EventSongListValueEditor>
interface EventSongListControlProps {
    value: db3.EventSongListPayload;
    event: db3.EventClientPayload_Verbose;
    readonly: boolean;
    refetch: () => void;
};

export const EventSongListControl = (props: EventSongListControlProps) => {

    const [editMode, setEditMode] = React.useState<boolean>(false);
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const user = useCurrentUser()[0]!;
    const publicData = useAuthenticatedSession();
    const clientIntention: db3.xTableClientUsageContext = { intention: 'user', mode: 'primary', currentUser: user };

    const editAuthorized = db3.xEventSongList.authorizeRowForEdit({
        clientIntention,
        publicData,
        model: props.value,
    });

    const recordFeature = useFeatureRecorder();
    const deleteMutation = API.events.deleteEventSongListx.useToken();
    const updateMutation = API.events.updateEventSongListx.useToken();

    const handleSave = (newValue: db3.EventSongListPayload) => {
        void recordFeature({
            feature: ActivityFeature.setlist_edit,
            eventSongListId: newValue.id,
        });
        updateMutation.invoke({
            id: newValue.id,
            //visiblePermissionId: newValue.visiblePermissionId,
            eventId: newValue.eventId,
            description: newValue.description,
            isActuallyPlayed: newValue.isActuallyPlayed,
            isOrdered: newValue.isOrdered,
            name: newValue.name,
            sortOrder: newValue.sortOrder,
            songs: newValue.songs.filter(s => !!s.song).map(s => ({ // new (blank) items might be in the list; filter them.
                songId: s.songId,
                sortOrder: s.sortOrder,
                subtitle: s.subtitle || "",
            })),
            dividers: newValue.dividers.map(d => ({
                sortOrder: d.sortOrder,
                isInterruption: d.isInterruption,
                subtitleIfSong: d.subtitleIfSong,
                isSong: d.isSong,
                lengthSeconds: d.lengthSeconds,
                textStyle: d.textStyle,
                color: d.color,
                subtitle: d.subtitle || "",
            })),
        }).then(() => {
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
        {!props.readonly && editAuthorized && editMode && <EventSongListValueEditorDialog
            initialValue={props.value}
            onSave={handleSave}
            onDelete={handleDelete}
            event={props.event}
            onCancel={() => setEditMode(false)} rowMode="update"
        />}
        <EventSongListValueViewer
            readonly={props.readonly}
            value={props.value}
            onEnterEditMode={() => setEditMode(true)}
            event={props.event}
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
    const [currentUser] = useCurrentUser();
    const clientIntention: db3.xTableClientUsageContext = {
        intention: 'user',
        mode: 'primary',
        currentUser: currentUser!,
    };
    const initialValue = db3.xEventSongList.createNew(clientIntention) as db3.EventSongListPayload;
    initialValue.dividers = []; // because it's just not created (i would need to create like a db3.ArrayColumnType or something)
    initialValue.name = `Setlist`;
    if (props.event.songLists.length > 0) {
        initialValue.name = `Set ${props.event.songLists.length + 1}`;
    }

    const handleSave = (value: db3.EventSongListPayload) => {
        void recordFeature({
            feature: ActivityFeature.setlist_create,
            eventId: props.event.id,
        });
        insertMutation.invoke({
            eventId: props.event.id,
            description: value.description,
            name: value.name,
            isActuallyPlayed: value.isActuallyPlayed,
            isOrdered: value.isOrdered,
            sortOrder: value.sortOrder,
            songs: value.songs.filter(s => !!s.song).map(s => ({ // new (blank) items might be in the list; filter them.
                songId: s.songId,
                sortOrder: s.sortOrder,
                subtitle: s.subtitle || "",
            })),
            dividers: value.dividers.map(d => ({
                sortOrder: d.sortOrder,
                color: d.color,
                isInterruption: d.isInterruption,
                subtitleIfSong: d.subtitleIfSong,
                isSong: d.isSong,
                lengthSeconds: d.lengthSeconds,
                textStyle: d.textStyle,
                subtitle: d.subtitle || "",
            })),
        }).then(() => {
            showSnackbar({ severity: "success", children: "added new song list" });
            props.onSuccess();
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: "Error; see console" });
        });
    };

    return <EventSongListValueEditorDialog
        onSave={handleSave}
        event={props.event}
        initialValue={initialValue}
        onCancel={props.onCancel}
        rowMode="new"
    />
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const EventSongListList = ({ event, tableClient, readonly, refetch }: { event: db3.EventClientPayload_Verbose, tableClient: DB3Client.xTableRenderClient, readonly: boolean, refetch: () => void }) => {
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
        const movingItemId = event.songLists[args.removedIndex]!.id;
        const newPositionItemId = event.songLists[args.addedIndex]!.id;
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
            {event.songLists.map(c => (
                <ReactSmoothDndDraggable key={c.id}>
                    <AppContextMarker name="EventSongListControl">
                        <EventSongListControl key={c.id} value={c} readonly={false} refetch={refetch} event={event} />
                    </AppContextMarker>
                </ReactSmoothDndDraggable>
            ))}
        </ReactSmoothDndContainer>
    </div>;
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const EventSongListTabContent = ({ event, tableClient, readonly, refetch }: { event: db3.EventClientPayload_Verbose, tableClient: DB3Client.xTableRenderClient, readonly: boolean, refetch: () => void }) => {
    const [newOpen, setNewOpen] = React.useState<boolean>(false);
    const user = useCurrentUser()[0]!;
    const publicData = useAuthenticatedSession();
    const clientIntention: db3.xTableClientUsageContext = { intention: 'user', mode: 'primary', currentUser: user };

    const insertAuthorized = db3.xEventSongList.authorizeRowBeforeInsert({
        clientIntention,
        publicData,
    });

    return <div className="EventSongListTabContent">
        <SettingMarkdown setting='EventSongListTabDescription' />
        {insertAuthorized && !readonly && <Button className='addNewSongListButton' onClick={() => setNewOpen(true)}>{gIconMap.Add()} Add new song list</Button>}
        {newOpen && !readonly && insertAuthorized && (
            <AppContextMarker name="EventSongListNewEditor">
                <EventSongListNewEditor event={event} onCancel={() => setNewOpen(false)} onSuccess={() => { setNewOpen(false); refetch(); }} />
            </AppContextMarker>
        )}
        <EventSongListList event={event} tableClient={tableClient} readonly={readonly} refetch={refetch} />
    </div>;
};

