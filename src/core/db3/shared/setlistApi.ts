// drag reordering https://www.npmjs.com/package/react-smooth-dnd
// https://codesandbox.io/s/material-ui-sortable-list-with-react-smooth-dnd-swrqx?file=/src/index.js:113-129

// clipboard custom formats
// https://developer.chrome.com/blog/web-custom-formats-for-the-async-clipboard-api/

import { Prisma } from "db";
import { markdownToPlainText } from "shared/markdownUtils";
import { formatSongLength } from "shared/time";
import { arrayToTSV, IsNullOrWhitespace, StringToEnumValue } from "shared/utils";
import { getFormattedBPM } from "../clientAPILL";
import { EventSongListDividerTextStyle } from "../db3";

// make song nullable for "add new item" support
export type EventSongListSongItemDb = Prisma.EventSongListSongGetPayload<{
    select: {
        eventSongListId: true,
        subtitle: true,
        id: true,
        sortOrder: true,
        songId: true,
    }
}>;

export type EventSongListSongItemWithSong = Prisma.EventSongListSongGetPayload<{
    select: {
        eventSongListId: true,
        subtitle: true,
        id: true,
        sortOrder: true,
        songId: true,
        song: {
            select: {
                id: true,
                name: true,
                lengthSeconds: true,
                startBPM: true,
                endBPM: true,
                tags: true,
                pinnedRecordingId: true,
            },
        }
    }
}>;

export type EventSongListSongItem = EventSongListSongItemWithSong & {
    type: "song";
    index: number;
    songArrayIndex: number; // index into the songs array (for play button)
    runningTimeSeconds: number | null; // the setlist time AFTER this song is played (no point in the 1st entry always having a 0)
    songsWithUnknownLength: number;
};

export type EventSongListDividerItem = Prisma.EventSongListDividerGetPayload<{
    select: {
        id: true,
        eventSongListId: true,
        subtitle: true,
        isInterruption: true,
        isSong: true,
        subtitleIfSong: true,
        lengthSeconds: true,
        textStyle: true,
        color: true,
        sortOrder: true,
    }
}> & {
    type: "divider"
    index?: number | null;
    runningTimeSeconds: number | null; // the setlist time AFTER this song is played (no point in the 1st entry always having a 0)
    songsWithUnknownLength: number;
};

export type EventSongListNewItem = {
    eventSongListId: number,
    id: number,
    sortOrder: number,
    type: "new";
};

export type EventSongListItem = EventSongListSongItem | EventSongListDividerItem | EventSongListNewItem;

type LocalSongListPayload = Prisma.EventSongListGetPayload<{
    select: {
        songs: {
            select: {
                songId: true,
                eventSongListId: true,
                id: true,
                sortOrder: true,
                subtitle: true,
                song: {
                    select: {
                        id: true,
                        name: true,
                        lengthSeconds: true,
                        startBPM: true,
                        endBPM: true,
                        tags: true,
                        pinnedRecordingId: true,
                    }
                }
            }
        },
        dividers: {
            select: {
                id: true,
                eventSongListId: true,
                isInterruption: true,
                subtitleIfSong: true,
                isSong: true,
                lengthSeconds: true,
                textStyle: true,
                subtitle: true,
                color: true,
                sortOrder: true,
            }
        }
    }
}>;

export function GetRowItems(songList: LocalSongListPayload): EventSongListItem[] {
    // row items are a combination of songs + dividers, with a new blank row at the end
    // NB: toSorted() is not supported on uberspace server code.
    const rowItems: EventSongListItem[] = songList.songs.map((s, songArrayIndex) => ({
        ...s,
        type: "song",
        index: -1, // populated later
        songArrayIndex: songArrayIndex, // index into the songs array
        runningTimeSeconds: null, // populated later
        songsWithUnknownLength: 0, // populated later
    }));
    rowItems.push(...songList.dividers.map(s => {
        const x: EventSongListDividerItem = {
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

            // All dividers can have a length, not just song-type dividers
            songLengthSeconds = item.lengthSeconds;

            if (item.isSong) {
                incrementSongIndex = true;
            }
        }
        if (item.type === 'song') {
            //songLengthSeconds = item.song.lengthSeconds;
            if (item.song.lengthSeconds != null) {
                runningTimeSeconds = item.song.lengthSeconds + (runningTimeSeconds === null ? 0 : runningTimeSeconds); // inc running time.
            } else {
                songsWithUnknownLength++;
            }
            incrementSongIndex = true;
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

export function SongListNamesToString(setlist: LocalSongListPayload): string {
    const rowItems = GetRowItems(setlist);

    const txt = rowItems.map(item => {
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

    return txt;
}

export function SongListIndexAndNamesToString(setlist: LocalSongListPayload): string {
    const rowItems = GetRowItems(setlist);

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


export function SongListToCSV(setlist: LocalSongListPayload): string {
    // Get the combined list of songs and dividers in order
    const rowItems = GetRowItems(setlist);

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

export function SongListToMarkdown(setlist: LocalSongListPayload) {
    const rowItems = GetRowItems(setlist);

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