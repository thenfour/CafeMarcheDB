// drag reordering https://www.npmjs.com/package/react-smooth-dnd
// https://codesandbox.io/s/material-ui-sortable-list-with-react-smooth-dnd-swrqx?file=/src/index.js:113-129

// clipboard custom formats
// https://developer.chrome.com/blog/web-custom-formats-for-the-async-clipboard-api/

import { markdownToPlainText } from "shared/markdownUtils";
import { formatSongLength } from "shared/time";
import { arrayToTSV, IsNullOrWhitespace, StringToEnumValue } from "shared/utils";
import { getFormattedBPM } from "../clientAPILL";
import { EventSongListDividerTextStyle } from "./schema/prismArgs";
import type { SongTagAssociationReferenceClientPayload } from "./schema/prismArgs";
import type { EventSongListPublicId, EventSongListSongPublicId, EventSongListDividerPublicId, FilePublicId, SongPublicId } from "shared/publicId";

// Text/calendar formatting needs only semantic fields, never persistence identity.
interface BasicSongListSongItem {
    subtitle: string | null;
    sortOrder: number;
    song: {
        name: string;
        lengthSeconds: number | null;
        startBPM: number | null;
        endBPM: number | null;
    };
}
interface BasicSongListDivider {
    subtitle: string | null;
    sortOrder: number;
    color: string | null;
    isInterruption: boolean;
    isSong: boolean;
    subtitleIfSong: string | null;
    lengthSeconds: number | null;
    textStyle: string | null;
}

export interface EventSongListSongItemWithSong extends BasicSongListSongItem {
    /** Local editor key. It is never a database ID or a command target. */
    clientId: string;
    publicId?: EventSongListSongPublicId;
    eventSongListId?: EventSongListPublicId;
    songId: SongPublicId;
    song: BasicSongListSongItem["song"] & {
        publicId: SongPublicId;
        pinnedRecordingId: FilePublicId | null;
        tags: SongTagAssociationReferenceClientPayload[];
    };
}
export interface EventSongListDividerValue extends BasicSongListDivider {
    clientId: string;
    publicId?: EventSongListDividerPublicId;
    eventSongListId?: EventSongListPublicId;
}

type EventSongListCommonFields = {
    runningTimeSeconds: number | null;
    songsWithUnknownLength: number;
};
export type EventSongListSongItem = EventSongListSongItemWithSong & {
    type: "song";
    index: number;
} & EventSongListCommonFields;
export type EventSongListDividerItem = EventSongListDividerValue & {
    type: "divider";
    index?: number | null;
} & EventSongListCommonFields;
export type EventSongListNewItem = {
    eventSongListId?: EventSongListPublicId;
    clientId: string;
    publicId?: undefined;
    sortOrder: number;
    type: "new";
} & EventSongListCommonFields;
export type EventSongListItem = EventSongListSongItem | EventSongListDividerItem | EventSongListNewItem;
export type LocalSongListPayload = {
    songs: EventSongListSongItemWithSong[];
    dividers: EventSongListDividerValue[];
};
export type BasicLocalSongListPayload = {
    songs: BasicSongListSongItem[];
    dividers: BasicSongListDivider[];
};
type BasicEventSongListSongItem = BasicSongListSongItem & {
    type: "song";
    index: number;
} & EventSongListCommonFields;
type BasicEventSongListDividerItem = BasicSongListDivider & {
    type: "divider";
    index?: number | null;
} & EventSongListCommonFields;
type BasicEventSongListItem = BasicEventSongListSongItem | BasicEventSongListDividerItem | EventSongListNewItem;

export function GetRowItems(songList: LocalSongListPayload): EventSongListItem[];
export function GetRowItems(songList: BasicLocalSongListPayload): BasicEventSongListItem[];
export function GetRowItems(songList: BasicLocalSongListPayload): BasicEventSongListItem[] {
    // row items are a combination of songs + dividers, with a new blank row at the end
    // NB: toSorted() is not supported on uberspace server code.
    const rowItems: BasicEventSongListItem[] = songList.songs.map((s, songArrayIndex) => ({
        ...s,
        type: "song",
        index: -1, // populated later
        songArrayIndex: songArrayIndex, // index into the songs array
        runningTimeSeconds: null, // populated later
        songsWithUnknownLength: 0, // populated later
    }));
    rowItems.push(...songList.dividers.map(s => {
        const x: BasicEventSongListDividerItem = {
            ...s,
            type: 'divider',
            index: -1, // populated later
            runningTimeSeconds: null, // populated later
            songsWithUnknownLength: 0, // populated later
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
        if (item.type !== 'divider' && item.type !== 'song') throw new Error(`unknown type at this moment`);

        let songLengthSeconds: number | null = null;
        let incrementSongIndex = false;

        if (item.type === 'divider') {
            if (item.isInterruption) {
                songIndex = 0;
                runningTimeSeconds = null;
            }

            if (item.isSong) {
                songLengthSeconds = item.lengthSeconds;
                incrementSongIndex = true;
            }
        }
        if (item.type === 'song') {
            songLengthSeconds = item.song.lengthSeconds;
            if (item.song.lengthSeconds === null) {
                songsWithUnknownLength++;
            }
            incrementSongIndex = true;
        }

        if (songLengthSeconds != null) {
            runningTimeSeconds = songLengthSeconds + (runningTimeSeconds === null ? 0 : runningTimeSeconds); // inc running time.
        }

        item.index = songIndex;
        item.runningTimeSeconds = runningTimeSeconds;
        item.songsWithUnknownLength = songsWithUnknownLength;

        if (incrementSongIndex) {
            songIndex++;
        }
    }

    return rowItems;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function DividerToString(subtitle: string | null | undefined) {
    const plaintext = markdownToPlainText(subtitle || "");
    if (plaintext.includes("\n")) {
        // multi-line
        return `--------\n${plaintext}\n`;
    }
    return IsNullOrWhitespace(plaintext) ? `--------` : `-- ${plaintext} ------`;
}

export function SongListNamesToString(setlist: BasicLocalSongListPayload): string {
    return SongListItemsNamesToString(GetRowItems(setlist));
}

export function SongListItemsNamesToString(rowItems: readonly BasicEventSongListItem[]): string {
    return rowItems.map(item => {
        if (item.type === 'divider') {
            if (item.isSong) {
                return item.subtitle;
            } else {
                return DividerToString(item.subtitle);
            }
        } else if (item.type === 'song') {
            return item.song.name;
        }
        return '';
    }).join('\n');
}

export function SongListIndexAndNamesToString(setlist: BasicLocalSongListPayload): string {
    return SongListItemsIndexAndNamesToString(GetRowItems(setlist));
}

export function SongListItemsIndexAndNamesToString(rowItems: readonly BasicEventSongListItem[]): string {
    const lines: string[] = [];

    for (const item of rowItems) {
        if (item.type === 'divider') {
            if (item.isSong) {
                lines.push(`${(item.index || 0) + 1}. ${item.subtitle}`);
            }
            else {
                lines.push(DividerToString(item.subtitle));
            }
        } else if (item.type === 'song') {
            lines.push(`${item.index + 1}. ${item.song.name}`);
        }
        // Ignore other item types (e.g., 'new')
    }

    const txt = lines.join('\n');
    return txt;
}


export function SongListToTSV(setlist: BasicLocalSongListPayload): string {
    return SongListItemsToTSV(GetRowItems(setlist));
}

export function SongListItemsToTSV(rowItems: readonly BasicEventSongListItem[]): string {
    const csvRows: any[] = [];

    for (const item of rowItems) {
        if (item.type === 'divider') {
            if (item.isSong) {
                csvRows.push({
                    Index: ((item.index || 0) + 1).toString(),
                    Song: item.subtitle,
                    Length: item.lengthSeconds ? formatSongLength(item.lengthSeconds) : '',
                    Tempo: "",
                    Comment: item.subtitleIfSong || '',
                });

            } else {
                csvRows.push({
                    Index: '',
                    Song: DividerToString(item.subtitle),
                    Length: '',
                    Tempo: '',
                    Comment: '',
                });
            }
        } else if (item.type === 'song') {
            csvRows.push({
                Index: (item.index + 1).toString(),
                Song: item.song.name,
                Length: item.song.lengthSeconds ? formatSongLength(item.song.lengthSeconds) : '',
                Tempo: getFormattedBPM(item.song),
                Comment: item.subtitle || '',
            });
        }
    }

    const txt = arrayToTSV(csvRows);
    return txt;
}

export function SongListToMarkdown(setlist: BasicLocalSongListPayload) {
    return SongListItemsToMarkdown(GetRowItems(setlist));
}

export function SongListItemsToMarkdown(rowItems: readonly BasicEventSongListItem[]) {
    const lines: string[] = [];
    for (const item of rowItems) {
        if (item.type === 'divider') {
            // not sure the best way to format this but this feels practical.
            if (item.isSong) {
                const commentTxt = IsNullOrWhitespace(item.subtitleIfSong) ? '' : ` *${item.subtitleIfSong}*`;
                lines.push(`${(item.index || 0) + 1}. **${item.subtitle}**${commentTxt}`);
            } else {
                if (item.subtitle) {
                    lines.push(`\n-----\n\n### ${item.subtitle}\n`);
                } else {
                    lines.push(`\n-----\n`);
                }
            }
        } else if (item.type === 'song') {
            const commentTxt = IsNullOrWhitespace(item.subtitle) ? '' : ` *${item.subtitle}*`;
            lines.push(`${item.index + 1}. **${item.song.name}**${commentTxt}`);
        }
    }

    const txt = lines.join('\n');
    return txt;
}

export function StringToEventSongListDividerTextStyle(x: null | string): EventSongListDividerTextStyle {
    if (!x) return EventSongListDividerTextStyle.Default;
    return StringToEnumValue(EventSongListDividerTextStyle, x) || EventSongListDividerTextStyle.Default;
}

export function GetCssClassForEventSongListDividerTextStyle(x: EventSongListDividerTextStyle): string {
    const stylesMap: Record<keyof typeof EventSongListDividerTextStyle, string> = {
        "Default": "style_Default nodividers",
        "DefaultBreak": "style_Default style_Break nohatch nodividers",
        "DefaultBreakBefore": "style_Default style_BreakBefore nodividers",
        "DefaultBreakAfter": "style_Default style_BreakAfter nodividers",
        "Title": "style_Title nohatch nodividers",
        "TitleBreak": "style_Title style_Break nohatch nodividers",
        "TitleBreakBefore": "style_Title style_BreakBefore nohatch nodividers",
        "TitleBreakAfter": "style_Title style_BreakAfter nohatch nodividers",
        "Minimal": "style_Minimal nohatch nodividers",
        "MinimalBreak": "style_Minimal style_Break nohatch nodividers",
        "MinimalBreakBefore": "style_Minimal style_BreakBefore nohatch nodividers",
        "MinimalBreakAfter": "style_Minimal style_BreakAfter nohatch nodividers",
    };
    return stylesMap[x];
}
