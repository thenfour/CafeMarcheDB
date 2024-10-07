// drag reordering https://www.npmjs.com/package/react-smooth-dnd
// https://codesandbox.io/s/material-ui-sortable-list-with-react-smooth-dnd-swrqx?file=/src/index.js:113-129

// clipboard custom formats
// https://developer.chrome.com/blog/web-custom-formats-for-the-async-clipboard-api/

import { useAuthenticatedSession } from '@blitzjs/auth';
import { Button, Checkbox, DialogActions, DialogContent, DialogTitle, Divider, FormControlLabel, InputBase, ListItemIcon, Menu, MenuItem, Switch, Tooltip } from "@mui/material";
import { assert } from 'blitz';
import { EventSongListSong, Prisma } from "db";
import React from "react";
import * as ReactSmoothDnd /*{ Container, Draggable, DropResult }*/ from "react-smooth-dnd";
import { gAppColors, gSwatchColors, StandardVariationSpec } from 'shared/color';
import { formatSongLength } from 'shared/time';
import { CoalesceBool, IsNullOrWhitespace, arrayToTSV, getExcelColumnName, getHashedColor, getUniqueNegativeID, moveItemInArray } from "shared/utils";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { SnackbarContext, SnackbarContextType } from "src/core/components/SnackbarContext";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { API } from '../db3/clientAPI';
import { TAnyModel } from '../db3/shared/apiTypes';
import { AdminInspectObject, ReactSmoothDndContainer, ReactSmoothDndDraggable, ReactiveInputDialog } from "./CMCoreComponents";
import { CMDialogContentText, CMSmallButton } from './CMCoreComponents2';
import { Markdown } from "./RichTextEditor";
import { SettingMarkdown } from './SettingMarkdown';
import { SongAutocomplete } from './SongAutocomplete';
import { DashboardContext } from './DashboardContext';
import { gCharMap, gIconMap } from '../db3/components/IconMap';
import { CMChip, CMChipContainer, CMStandardDBChip } from './CMChip';
import { MetronomeButton } from './Metronome';

const gDividerText = <>&nbsp;</>;

type LocalSongPayload = Prisma.SongGetPayload<{}>;

// make song nullable for "add new item" support
type EventSongListSongItem = Prisma.EventSongListSongGetPayload<{
    select: {
        eventSongListId: true,
        subtitle: true,
        id: true,
        sortOrder: true,
    }
}> & {
    songId: number;
    song: LocalSongPayload;
    type: "song";
    index: number;
    runningTimeSeconds: number | null; // the setlist time AFTER this song is played (no point in the 1st entry always having a 0)
    songsWithUnknownLength: number;
};

type EventSongListDividerItem = Prisma.EventSongListDividerGetPayload<{}> & { type: "divider" };

type EventSongListNewItem = {
    eventSongListId: number,
    id: number,
    sortOrder: number,
    type: "new";
};

type EventSongListItem = EventSongListSongItem | EventSongListDividerItem | EventSongListNewItem;


function GetRowItems(songList: db3.EventSongListPayload): EventSongListItem[] {
    // row items are a combination of songs + dividers, with a new blank row at the end
    const rowItems: EventSongListItem[] = songList.songs.toSorted((a, b) => a.sortOrder - b.sortOrder).map((s, index) => ({
        ...s,
        type: "song",
        index,
        runningTimeSeconds: null, // populated later
        songsWithUnknownLength: 0,
    }));
    rowItems.push(...songList.dividers.map(s => {
        const x: EventSongListDividerItem = {
            ...s,
            type: 'divider',
        };
        return x;
    }));

    // by some theory this shouldn't be necessary because sortorder is there, but it is.
    rowItems.sort((a, b) => a.sortOrder - b.sortOrder);

    // set indices and runningTime
    let songIndex: number = 0;
    let runningTimeSeconds: number | null = null;
    let songsWithUnknownLength: number = 0;
    for (let i = 0; i < rowItems.length; ++i) {
        const item = rowItems[i]!;
        if (item.type === 'divider') {
            // reset!
            songIndex = 0;
            runningTimeSeconds = null;
            songsWithUnknownLength = 0;
            continue;
        }
        if (item.type !== 'song') throw new Error(`unknown type at this moment`);

        item.index = songIndex;

        if (item.song.lengthSeconds) {
            runningTimeSeconds = item.song.lengthSeconds + (runningTimeSeconds === null ? 0 : runningTimeSeconds); // inc running time.
        } else {
            // don't inc runtime
            songsWithUnknownLength++;
        }

        item.runningTimeSeconds = runningTimeSeconds;
        item.songsWithUnknownLength = songsWithUnknownLength;

        songIndex++;
    }

    return rowItems;
}

/*
similar to other tab contents structures (see also EventSegmentComponents, EventCommentComponents...)

<tab content>
    <button + add song list> => song list editor
    <song list control>
        <song list viewer> - with edit button, maybe delete
        <song list editor>

the song list will be considered a value just like a event comment, et al. that simplifies things
regarding API and mutations etc. so instead of having tons of calls like 
- addSong
- removeSong
- reorderSong

it will just be updateSetList(song list etc.)

*/


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface EventSongListValueViewerRowProps {
    //index: number;
    value: EventSongListItem;
    showTags: boolean;
    songList: db3.EventSongListPayload;
};
export const EventSongListValueViewerRow = (props: EventSongListValueViewerRowProps) => {
    const dashboardContext = React.useContext(DashboardContext);
    const enrichedSong = props.value.type === 'song' ? db3.enrichSong(props.value.song, dashboardContext) : null;
    const formattedBPM = props.value.type === 'song' ? API.songs.getFormattedBPM(props.value.song) : "";

    return <div className={`SongListValueViewerRow tr ${props.value.id <= 0 ? 'newItem' : 'existingItem'} item ${props.value.type === 'new' ? 'invalidItem' : 'validItem'} type_${props.value.type}`}>

        <div className="td songIndex">
            {props.songList.isOrdered && props.value.type === 'song' && (props.value.index + 1)}
        </div>
        <div className="td songName">
            {props.value.type === 'song' && <a target='_blank' rel="noreferrer" href={API.songs.getURIForSong(props.value.song.id, props.value.song.slug)}>{props.value.song.name}</a>}
            {props.value.type === 'divider' && <div className='divider'>{gDividerText}</div>}
        </div>
        <div className="td length">{props.value.type === 'song' && props.value.song.lengthSeconds && formatSongLength(props.value.song.lengthSeconds)}</div>
        <div className="td runningLength">{props.value.type === 'song' && props.value.runningTimeSeconds && <>{formatSongLength(props.value.runningTimeSeconds)}{props.value.songsWithUnknownLength ? <>+</> : <>&nbsp;</>}</>}</div>
        <div className="td tempo">{enrichedSong?.startBPM && <MetronomeButton bpm={enrichedSong.startBPM} isTapping={false} onSyncClick={() => { }} tapTrigger={0} variant='tiny' />} {formattedBPM}</div>

        <div className="td comment">
            <div className="comment">{props.value.type !== 'new' && props.value.subtitle}</div>
            {/* <div className="CMChipContainer comment2"></div> */}
            {props.value.type === 'song' && props.showTags && ((props.value.song as any).tags.length > 0) && (
                <CMChipContainer>
                    {enrichedSong!.tags.filter(a => a.tag.showOnSongLists).map(a => <CMStandardDBChip key={a.id} model={a.tag} size="small" variation={StandardVariationSpec.Weak} />)}
                </CMChipContainer>
            )}
        </div>
    </div>

};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function CopySongListNames(snackbarContext: SnackbarContextType, value: db3.EventSongListPayload) {
    const txt = value.songs.filter(s => !!s.song).map(s => s.song.name).join("\n");
    await navigator.clipboard.writeText(txt);
    snackbarContext.showMessage({ severity: "success", children: `copied ${txt.length} chars` });
}

async function CopySongListIndexAndNames(snackbarContext: SnackbarContextType, value: db3.EventSongListPayload) {
    const txt = value.songs.filter(s => !!s.song).map((s, i) => `${i + 1}. ${s.song.name}`).join("\n");
    await navigator.clipboard.writeText(txt);
    snackbarContext.showMessage({ severity: "success", children: `copied ${txt.length} chars` });
}

type PortableSongListSong = {
    sortOrder: number;
    comment: string;
    song: db3.SongPayload;
    type: 'song';
};

type PortableSongListDivider = {
    sortOrder: number;
    comment: string;
    type: 'divider';
};

type PortableSongList = (PortableSongListSong | PortableSongListDivider)[];

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

async function CopySongListCSV(snackbarContext: SnackbarContextType, value: db3.EventSongListPayload) {
    const obj = value.songs.filter(s => !!s.song).map((s, i) => ({
        Index: (i + 1).toString(),
        Song: s.song.name,
        Length: (s.song.lengthSeconds ? formatSongLength(s.song.lengthSeconds) : "") || "",
        Tempo: API.songs.getFormattedBPM(s.song),
        Comment: s.subtitle || "",
    }));
    const txt = arrayToTSV(obj);
    await navigator.clipboard.writeText(txt);
    snackbarContext.showMessage({ severity: "success", children: `copied ${txt.length} chars` });
}

async function CopySongListMarkdown(snackbarContext: SnackbarContextType, value: db3.EventSongListPayload) {
    const txt = value.songs.filter(s => !!s.song).map((s, i) => {
        // so uh i'm technically putting markdown in markdown so this is not correct but let's go for it anyway.
        const commentTxt = IsNullOrWhitespace(s.subtitle) ? "" : ` *${s.subtitle}*`;
        return `${i + 1}. **${s.song.name}**${commentTxt}`;
    }).join("\n");
    await navigator.clipboard.writeText(txt);
    snackbarContext.showMessage({ severity: "success", children: `copied ${txt.length} chars` });
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface EventSongListDotMenuProps {
    readonly: boolean;
    multipleLists: boolean;
    showTags: boolean;
    setShowTags: (v: boolean) => void;
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
        <MenuItem key={++k} onClick={() => { props.setShowTags(!props.showTags); setAnchorEl(null); }}>
            <ListItemIcon>
                {props.showTags && gIconMap.CheckCircleOutline()}
            </ListItemIcon>
            Show song tags
        </MenuItem>,
        <Divider key={++k} />,
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
    event: db3.EventClientPayload_Verbose;
    readonly: boolean;
    onEnterEditMode?: () => void; // if undefined, don't allow editing.
};

type SongListSortSpec = "sortOrderAsc" | "sortOrderDesc" | "nameAsc" | "nameDesc";

export const EventSongListValueViewer = (props: EventSongListValueViewerProps) => {
    //const [currentUser] = useCurrentUser();
    const [showTags, setShowTags] = React.useState<boolean>(false);
    const [sortSpec, setSortSpec] = React.useState<SongListSortSpec>("sortOrderAsc");
    //const visInfo = API.users.getVisibilityInfo(props.value);
    const snackbarContext = React.useContext(SnackbarContext);

    const user = useCurrentUser()[0]!;
    const publicData = useAuthenticatedSession();
    const clientIntention: db3.xTableClientUsageContext = { intention: 'user', mode: 'primary', currentUser: user };

    const editAuthorized = db3.xEventSongList.authorizeRowForEdit({
        clientIntention,
        publicData,
        model: props.value,
    });

    const rowItems = GetRowItems(props.value);

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
            default:
            case 'sortOrderAsc':
                return a.sortOrder < b.sortOrder ? -1 : 1;
            case 'sortOrderDesc':
                return a.sortOrder > b.sortOrder ? -1 : 1;
        }
    });

    const getCombinedList = () => {
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
            </div>
            {!props.readonly && editAuthorized && <Button onClick={props.onEnterEditMode}>{gIconMap.Edit()}Edit</Button>}

        </div>
        <div className="content">

            <CMChipContainer>
                {props.value.isActuallyPlayed && <CMChip tooltip={"This setlist will be/was actually played; it's complete and in order"} size='small' color={gSwatchColors.green}>As performed</CMChip>}
                {!props.value.isOrdered && <CMChip tooltip={"This setlist is not in order; just a list of songs"} size='small'>Order not important</CMChip>}
            </CMChipContainer>

            <Markdown markdown={props.value.description} />

            <div className="songListSongTable">
                <div className="thead">
                    <div className="tr">
                        <div className="th songIndex interactable" onClick={handleClickSortOrderTH}># {sortSpec === 'sortOrderAsc' && gCharMap.DownArrow()} {sortSpec === 'sortOrderDesc' && gCharMap.UpArrow()}</div>
                        <div className="th songName interactable" onClick={handleClickSongNameTH}>Song {sortSpec === 'nameAsc' && gCharMap.DownArrow()} {sortSpec === 'nameDesc' && gCharMap.UpArrow()}</div>
                        <div className="th length">Len</div>
                        <div className="th runningLength">∑T</div>
                        <div className="th tempo">Bpm</div>
                        <div className="th comment">
                            Comment
                            <EventSongListDotMenu
                                readonly={true}
                                multipleLists={props.event.songLists.length > 1}
                                showTags={showTags}
                                setShowTags={setShowTags}
                                handleCopySongNames={async () => await CopySongListNames(snackbarContext, props.value)}
                                handleCopyIndexSongNames={async () => await CopySongListIndexAndNames(snackbarContext, props.value)}
                                handleCopyCSV={async () => await CopySongListCSV(snackbarContext, props.value)}
                                handleCopyJSON={async () => await CopySongListJSON(snackbarContext, props.value)}
                                handleCopyMarkdown={async () => await CopySongListMarkdown(snackbarContext, props.value)}

                                handleCopyCombinedSongNames={async () => await CopySongListNames(snackbarContext, getCombinedList())}
                                handleCopyCombinedMarkdown={async () => await CopySongListMarkdown(snackbarContext, getCombinedList())}
                                handleCopyCombinedCSV={async () => await CopySongListCSV(snackbarContext, getCombinedList())}
                                handleCopyCombinedJSON={async () => await CopySongListJSON(snackbarContext, getCombinedList())}

                                handlePasteAppend={async () => { }}
                                handlePasteReplace={async () => { }}
                            />
                        </div>
                    </div>
                </div>

                <div className="tbody">
                    {
                        rowItems.map((s, index) => <EventSongListValueViewerRow key={s.id} value={s} songList={props.value} showTags={showTags} />)
                    }

                </div>
            </div>

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
    //index: number;
    value: EventSongListItem;
    songList: db3.EventSongListPayload;
    showTags?: boolean;
    showDragHandle?: boolean;
    onChange: (newValue: EventSongListItem) => void;
    onDelete?: () => void;
};
export const EventSongListValueEditorRow = (props: EventSongListValueEditorRowProps) => {
    const dashboardContext = React.useContext(DashboardContext);
    const enrichedSong = (props.value.type === 'song') ? db3.enrichSong(props.value.song, dashboardContext) : null;
    const showTags = CoalesceBool(props.showTags, false);
    const showDragHandle = CoalesceBool(props.showDragHandle, true);

    const handleAutocompleteChange = (song: db3.SongPayload | null) => {
        if (!song) return;
        const { id, eventSongListId, sortOrder } = props.value;
        const item: EventSongListSongItem = {
            type: "song",
            eventSongListId,
            id,
            sortOrder,
            subtitle: "",
            songId: song.id,
            song: song,
            index: 0, // will be set later
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

    const formattedBPM = enrichedSong ? API.songs.getFormattedBPM(enrichedSong) : "";

    const style = {
        "--song-hash-color": getHashedColor(props.value.type === "song" ? props.value.song.name : "" || ""),
    };

    const handleNewDivider = () => {
        props.onChange({
            type: 'divider',
            eventSongListId: props.value.eventSongListId,
            id: getUniqueNegativeID(),
            sortOrder: props.value.sortOrder,
            subtitle: "",
        });
    }

    return <>
        <div className={`tr ${props.value.id <= 0 ? 'newItem' : 'existingItem'} item ${props.value.type === "new" ? 'invalidItem' : 'validItem'} type_${props.value.type}`} style={style as any}>
            <div className="td icon">{props.onDelete && <div className="freeButton" onClick={props.onDelete}>{gIconMap.Delete()}</div>}</div>
            {/* <div className="td icon">{props.value.songId ? <div className="freeButton" onClick={props.onDelete}>{gIconMap.Delete()}</div> : gIconMap.Add()}</div> */}
            <div className="td songIndex">{props.value.type === 'song' && (props.value.index + 1)}
                {/* id:{props.value.id} so:{props.value.sortOrder} */}
            </div>
            <div className="td dragHandle draggable">{showDragHandle && gCharMap.Hamburger()}
                {/* <InspectObject src={props.value} tooltip="snth" /> */}
            </div>
            <div className="td songName">
                {props.value.type === 'song' && <div>{props.value.song.name}</div>}
                {/* value used to be props.value.song || null */}
                {props.value.type === 'new' && <SongAutocomplete onChange={handleAutocompleteChange} value={null} fadedSongIds={props.songList.songs.map(s => s.songId)} />}
                {props.value.type === 'divider' && <div className='divider'>{gDividerText}</div>}

            </div>
            <div className="td length">{props.value.type === 'song' && props.value.song.lengthSeconds && formatSongLength(props.value.song.lengthSeconds)}</div>
            <div className="td runningLength">{props.value.type === 'song' && props.value.runningTimeSeconds && <>{formatSongLength(props.value.runningTimeSeconds)}{props.value.songsWithUnknownLength ? <>+</> : <>&nbsp;</>}</>}</div>            <div className="td tempo">
                {enrichedSong?.startBPM && <MetronomeButton bpm={enrichedSong.startBPM} isTapping={false} onSyncClick={() => { }} tapTrigger={0} variant='tiny' />} {formattedBPM}
                {(props.value.type === 'new') && <Tooltip title="Add a divider"><span><CMSmallButton onClick={handleNewDivider}>+Divider</CMSmallButton></span></Tooltip>}
            </div>
            {/* </div>
        <div className="tr"> */}
            <div className="td comment">
                <div className="comment">
                    {isDupeWarning && <Tooltip title={`This song occurs ${occurrences} times in this set list. Is that right?`}><div className='warnIndicator'>⚠{occurrences}</div></Tooltip>}
                    {props.value.type !== 'new' &&
                        <InputBase
                            className="cmdbSimpleInput"
                            placeholder="Comment"
                            // this is required to prevent the popup from happening when you click into the text field. you must explicitly click the popup indicator.
                            // a bit of a hack/workaround but necessary https://github.com/mui/material-ui/issues/23164
                            onMouseDownCapture={(e) => e.stopPropagation()}
                            value={props.value.subtitle || ""}
                            onChange={(e) => handleCommentChange(e.target.value)}
                        />}
                </div>
                {showTags && enrichedSong && enrichedSong.tags.length > 0 && (
                    <CMChipContainer>
                        {enrichedSong.tags.filter(a => a.tag.showOnSongLists).map(a => <CMStandardDBChip key={a.id} model={a.tag} variation={StandardVariationSpec.Weak} size="small" />)}
                    </CMChipContainer>
                )}
            </div>
        </div>
    </>;
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

// state managed internally.
export const EventSongListValueEditor = (props: EventSongListValueEditorProps) => {
    const snackbarContext = React.useContext(SnackbarContext);
    const [grayed, setGrayed] = React.useState<boolean>(false);
    const currentUser = useCurrentUser()[0]!;
    const clientIntention: db3.xTableClientUsageContext = { intention: "user", mode: "primary", currentUser };
    const [showingDeleteConfirmation, setShowingDeleteConfirmation] = React.useState<boolean>(false);
    const newRowId = React.useMemo(() => getUniqueNegativeID(), []);

    // const ensureHasNewRow = (list: EventSongListItem[]) => {
    //     // make sure there is at least 1 "new" item.
    //     if (!list.some(s => s.type === 'new')) {
    //         const id = newRowId;// getUniqueNegativeID(); // make sure all objects have IDs, for tracking changes
    //         const sortOrders = list.map(song => song.sortOrder);
    //         const newSortOrder = 1 + Math.max(0, ...sortOrders);
    //         list.push({
    //             eventSongListId: props.initialValue.id,
    //             id,
    //             sortOrder: newSortOrder,
    //             type: "new",
    //         });
    //     }
    // };
    const [showTags, setShowTags] = React.useState<boolean>(false);

    // make sure the caller's object doesn't get modified. esp. create a copy of the songs array so we can manipulate it. any refs we modify should not leak outside of this component.
    //const initialValueCopy: db3.EventSongListPayload = { ...props.initialValue, songs: [...props.initialValue.songs.map(s => ({ ...s }))], dividers: [...props.initialValue.dividers.map(d => ({ ...d }))] };

    //const [value, setValue] = React.useState<db3.EventSongListPayload>(() => JSON.parse(JSON.stringify(props.initialValue)));
    const [value, setValue] = React.useState<db3.EventSongListPayload>(JSON.parse(JSON.stringify(props.initialValue)));

    // row items are a combination of songs + dividers, with a new blank row at the end
    const rowItems = GetRowItems(value);
    //ensureHasNewRow(rowItems);

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

    const itemToEventSongListSong = (x: EventSongListSongItem) => {
        const a: EventSongListSongItem = x;
        const { type, songId, song, ...rest } = x;
        if (!songId) throw new Error(`expected songId here`);
        if (!song) throw new Error(`expected song here`);
        const id = x.id === newRowId ? getUniqueNegativeID() : x.id;
        const p: Prisma.EventSongListSongGetPayload<{ include: { song: true } }> = { ...rest, songId, song, id };
        return p;
    };

    // after you mutate rowItems (ordering, data, whatever), call this to apply to the setlist object
    const handleRowsUpdated = (rows: EventSongListItem[]) => {
        const newValue = JSON.parse(JSON.stringify(value));
        newValue.songs = rows.filter(r => r.type === 'song').map(item => itemToEventSongListSong(item)) as any;
        newValue.dividers = rows.filter(r => r.type === "divider");
        setValue(newValue);
    };

    const handleRowChange = (newValue: EventSongListItem) => {
        handleRowsUpdated([...rowItems.filter(row => row.id !== newValue.id), newValue]);
        // // replace existing with this.
        // const n = { ...value };
        // n.songs = n.songs.filter(s => s.id !== newValue.id);
        // n.dividers = n.dividers.filter(s => s.id !== newValue.id);
        // switch (newValue.type) {
        //     case 'divider':
        //         {
        //             n.dividers.push(newValue);
        //             break;
        //         }
        //     case 'song':
        //         {
        //             n.songs.push(itemToEventSongListSong(newValue) as any); // payloads are slightly different.
        //         }
        //     default:
        //         return; // noop on new or whatever
        // }
        // //if (index === -1) throw new Error(`id should alread be populated`);
        // //n.songs[index] = newValue;
        // //ensureHasNewRow();
        // setValue(n);
    };

    const handleRowDelete = (row: EventSongListItem) => {
        handleRowsUpdated(rowItems.filter(existing => existing.id !== row.id));

        // const n = { ...value };
        // n.songs = n.songs.filter(s => s.id !== row.id);
        // n.dividers = n.dividers.filter(s => s.id !== row.id);
        // const index = n.songs.findIndex(s => s.id === row.id);
        // if (index === -1) throw new Error(`id should alread be populated`);
        // n.songs.splice(index, 1);
        // ensureHasNewRow(n.songs);
        //setValue(n);
    };

    const onDrop = (args: ReactSmoothDnd.DropResult) => {
        // removedIndex is the previous index; the original item to be moved
        // addedIndex is the new index where it should be moved to.
        if (args.addedIndex == null || args.removedIndex == null) throw new Error(`why are these null?`);
        //value.songs = moveItemInArray(value.songs, args.removedIndex, args.addedIndex).map((song, index) => ({ ...song, sortOrder: index }));
        const newItems = moveItemInArray(rowItems, args.removedIndex, args.addedIndex).map((item, index) => ({ ...item, sortOrder: index }));
        handleRowsUpdated(newItems);
        //setValue({ ...value });
    };

    const getClipboardSongList = async (): Promise<PortableSongList | null> => {
        let obj: undefined | PortableSongList = undefined;
        try {
            const txt = await navigator.clipboard.readText();
            obj = JSON.parse(txt) as PortableSongList;
            // sanity check.
            if (!Array.isArray(obj)) throw "not an array";
            if (obj.length < 1) {
                snackbarContext.showMessage({ severity: 'error', children: "Empty setlist; ignoring." });
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

    const appendPortableSongList = (list: db3.EventSongListPayload, obj: PortableSongList) => {
        const newItems: EventSongListItem[] = [...rowItems.filter(item => item.type !== 'new')];
        const highestSortOrder = 1 + newItems.reduce((acc, val) => Math.max(acc, val.sortOrder), 0);

        newItems.push(...obj.map(p => {
            switch (p.type) {
                case 'divider':
                    const div: EventSongListDividerItem = {
                        type: 'divider',
                        id: getUniqueNegativeID(),
                        eventSongListId: list.id,
                        sortOrder: highestSortOrder + p.sortOrder,// assumes non-zero sort orders
                        subtitle: p.comment,
                    };
                    return div;
                case 'song':
                    const song: EventSongListSongItem = {
                        type: 'song',
                        id: getUniqueNegativeID(),
                        eventSongListId: list.id,
                        sortOrder: highestSortOrder + p.sortOrder,// assumes non-zero sort orders
                        subtitle: p.comment,
                        songId: p.song.id,
                        song: p.song,
                        index: 0, // it doesn't matter; it will get populated later
                        runningTimeSeconds: null, // populated later
                        songsWithUnknownLength: 0, // populated later
                    }
                    return song;
            }
            throw new Error(`unknown type?`);
        }));

        // const items = obj.map((s): db3.EventSongListSongPayload => ({
        //     eventSongListId: list.id,
        //     id: getUniqueNegativeID(),
        //     songId: s.song.id,
        //     song: s.song,
        //     subtitle: s.comment,
        //     sortOrder: s.sortOrder,
        // }));
        // remove the dummy row, merge the lists
        //list.songs = [...list.songs.filter(s => !!s.song), ...items];
        // and set sort orders
        //list.songs.forEach((item, index) => item.sortOrder = index);
        // and ensure it has a dummy row.
        //ensureHasNewRow(list.songs);
        handleRowsUpdated(newItems);
    };

    const handlePasteAppend = async () => {
        const obj = await getClipboardSongList();
        if (!obj) return;
        const newList = { ...value };
        appendPortableSongList(newList, obj);
        //setValue(newList);
    };

    const handlePasteReplace = async () => {
        const obj = await getClipboardSongList();
        if (!obj) return;
        const newList = { ...value };
        appendPortableSongList(newList, obj);
        //setValue(newList);
    };

    const nameColumn = tableSpec.getColumn("name");
    const nameField = nameColumn.renderForNewDialog!({ key: "name", row: value, validationResult, api, value: value.name, clientIntention, autoFocus: true });

    return <>
        <ReactiveInputDialog onCancel={props.onCancel} className="EventSongListValueEditor">

            <DialogTitle>
                <SettingMarkdown setting='EditEventSongListDialogTitle' />
            </DialogTitle>
            <DialogContent dividers>
                <CMDialogContentText>
                    <SettingMarkdown setting='EditEventSongListDialogDescription' />
                    <AdminInspectObject src={props.initialValue} label="initial value" />
                    <AdminInspectObject src={value} label="value" />
                    <AdminInspectObject src={stats} label="stats" />
                    <AdminInspectObject src={rowItems} label="rowitems" />
                </CMDialogContentText>

                <div className="EventSongListValue">

                    {props.onDelete && <Button onClick={() => setShowingDeleteConfirmation(true)}>{gIconMap.Delete()}Delete</Button>}
                    {props.onDelete && showingDeleteConfirmation && (<div className="deleteConfirmationControl">Are you sure you want to delete this item?
                        <Button onClick={() => setShowingDeleteConfirmation(false)}>nope, cancel</Button>
                        <Button onClick={() => {
                            if (!props.onDelete) return;
                            setShowingDeleteConfirmation(false);
                            props.onDelete();
                        }}>yes</Button>
                    </div>)}

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
                                        showTags={showTags}
                                        setShowTags={setShowTags}
                                        handleCopySongNames={async () => await CopySongListNames(snackbarContext, value)}
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
                                    {/* <FormControlLabel className='CMFormControlLabel'
                                        control={<Checkbox size="small" checked={showTags} onClick={() => setShowTags(!showTags)} />} label="Show tags" /> */}
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
                                    <EventSongListValueEditorRow key={s.id} value={s} onChange={handleRowChange} songList={value} onDelete={() => handleRowDelete(s)} showTags={showTags} />
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
                </div>
            </DialogContent>
            <DialogActions>
                <Button onClick={props.onCancel} startIcon={gIconMap.Cancel()} disabled={grayed}>Cancel</Button>
                <Button onClick={() => {
                    setGrayed(true);
                    props.onSave(value);
                }} startIcon={gIconMap.Save()} disabled={grayed}>OK</Button>
            </DialogActions>

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

    const deleteMutation = API.events.deleteEventSongListx.useToken();
    const updateMutation = API.events.updateEventSongListx.useToken();

    const handleSave = (newValue: db3.EventSongListPayload) => {
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
        {!props.readonly && editAuthorized && editMode && <EventSongListValueEditor
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
    initialValue.name = `Set ${props.event.songLists.length + 1}`;

    const handleSave = (value: db3.EventSongListPayload) => {
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

    return <EventSongListValueEditor
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

    const updateSortOrderMutation = API.other.updateGenericSortOrderMutation.useToken();
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const onDrop = (args: ReactSmoothDnd.DropResult) => {
        setSaving(true);
        // removedIndex is the previous index; the original item to be moved
        // addedIndex is the new index where it should be moved to.
        if (args.addedIndex == null || args.removedIndex == null) throw new Error(`why are these null?`);
        const movingItemId = event.songLists[args.removedIndex]!.id;
        const newPositionItemId = event.songLists[args.addedIndex]!.id;
        assert(!!movingItemId && !!newPositionItemId, "moving item not found?");

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
                    <EventSongListControl key={c.id} value={c} readonly={false} refetch={refetch} event={event} />
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
            <EventSongListNewEditor event={event} onCancel={() => setNewOpen(false)} onSuccess={() => { setNewOpen(false); refetch(); }} />
        )}
        <EventSongListList event={event} tableClient={tableClient} readonly={readonly} refetch={refetch} />
    </div>;
};

