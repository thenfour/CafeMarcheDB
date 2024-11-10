// drag reordering https://www.npmjs.com/package/react-smooth-dnd
// https://codesandbox.io/s/material-ui-sortable-list-with-react-smooth-dnd-swrqx?file=/src/index.js:113-129

// clipboard custom formats
// https://developer.chrome.com/blog/web-custom-formats-for-the-async-clipboard-api/

import { Prisma } from "db";
import { formatSongLength } from "shared/time";
import { arrayToTSV, IsNullOrWhitespace, toSorted } from "shared/utils";
import { getFormattedBPM } from "../clientAPILL";
//import * as db3 from "src/core/db3/db3";

type LocalSongPayload = Prisma.SongGetPayload<{
    select: {
        id: true,
        name: true,
        lengthSeconds: true,
        startBPM: true,
        endBPM: true,
    }
}>;

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
            },
        }
    }
}>;

export type EventSongListSongItem = EventSongListSongItemWithSong & {
    //song: LocalSongPayload;
    type: "song";
    index: number;
    runningTimeSeconds: number | null; // the setlist time AFTER this song is played (no point in the 1st entry always having a 0)
    songsWithUnknownLength: number;
};

export type EventSongListDividerItem = Prisma.EventSongListDividerGetPayload<{
    select: {
        id: true,
        eventSongListId: true,
        subtitle: true,
        isInterruption: true,
        color: true,
        sortOrder: true,
    }
}> & { type: "divider" };

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
                    }
                }
            }
        },
        dividers: {
            select: {
                id: true,
                eventSongListId: true,
                isInterruption: true,
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
    const rowItems: EventSongListItem[] = toSorted(songList.songs, (a, b) => a.sortOrder - b.sortOrder).map((s, index) => ({
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
            if (item.isInterruption) {
                songIndex = 0;
                runningTimeSeconds = null;
                //songsWithUnknownLength = 0;
            }
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

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function DividerToString(subtitle: string | null | undefined) {
    return subtitle ? `-- ${subtitle} ------` : `--------`;
}

export function SongListNamesToString(setlist: LocalSongListPayload): string {
    const rowItems = GetRowItems(setlist);

    const txt = rowItems.map(item => {
        if (item.type === 'divider') {
            return DividerToString(item.subtitle);
        } else if (item.type === 'song') {
            return item.song.name;
        }
        return '';
    }).join('\n');

    return txt;
}

export function SongListIndexAndNamesToString(setlist: LocalSongListPayload): string {
    const rowItems = GetRowItems(setlist);

    let index = 1;
    const lines: string[] = [];

    for (const item of rowItems) {
        if (item.type === 'divider') {
            index = 1;
            lines.push(DividerToString(item.subtitle));
        } else if (item.type === 'song') {
            lines.push(`${index}. ${item.song.name}`);
            index++;
        }
        // Ignore other item types (e.g., 'new')
    }

    const txt = lines.join('\n');
    return txt;
}


export function SongListToCSV(setlist: LocalSongListPayload): string {
    // Get the combined list of songs and dividers in order
    const rowItems = GetRowItems(setlist);

    let index = 1;
    const csvRows: any[] = [];

    for (const item of rowItems) {
        if (item.type === 'divider') {
            index = 1;
            csvRows.push({
                Index: '',
                Song: DividerToString(item.subtitle),
                Length: '',
                Tempo: '',
                Comment: '',
            });
        } else if (item.type === 'song') {
            csvRows.push({
                Index: index.toString(),
                Song: item.song.name,
                Length: item.song.lengthSeconds ? formatSongLength(item.song.lengthSeconds) : '',
                Tempo: getFormattedBPM(item.song),
                Comment: item.subtitle || '',
            });
            index++;
        }
    }

    const txt = arrayToTSV(csvRows);
    return txt;
}

export function SongListToMarkdown(setlist: LocalSongListPayload) {
    const rowItems = GetRowItems(setlist);

    let index = 1;
    const lines: string[] = [];

    for (const item of rowItems) {
        if (item.type === 'divider') {
            index = 1;
            // not sure the best way to format this but this feels practical.
            if (item.subtitle) {
                lines.push(`\n-----\n\n### ${item.subtitle}\n`);
            } else {
                lines.push(`\n-----\n`);
            }
        } else if (item.type === 'song') {
            const commentTxt = IsNullOrWhitespace(item.subtitle) ? '' : ` *${item.subtitle}*`;
            lines.push(`${index}. **${item.song.name}**${commentTxt}`);
            index++;
        }
    }

    const txt = lines.join('\n');
    return txt;
}