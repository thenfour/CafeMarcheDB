import type { EventSongListSongItem } from "../../setlistApi";
import type { EventSongListContent } from "./eventSongListContent";
import { createEventSongListLocalKey, type EventSongListDraftItem, type EventSongListDraftSong, type EventSongListDraftDivider } from "./eventSongListDraft";

export type PortableSongListSong = {
    sortOrder: number;
    comment: string;
    song: EventSongListSongItem["song"];
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

/** Portable content carries no persisted setlist or item identity. */
export function eventSongListContentToPortable(content: EventSongListContent): PortableSongList {
    return content.items.flatMap<PortableSongListSong | PortableSongListDivider>((item, sortOrder) => {
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
}

/** Every paste creates fresh local rows, even when copying into the same list. */
export function portableSongListToDraftItems(value: PortableSongList): EventSongListDraftItem[] {
    const orderedPortableItems = [...value].sort((a, b) => a.sortOrder - b.sortOrder);
    return orderedPortableItems.map(p => {
        switch (p.type) {
            case 'divider':
                const div: EventSongListDraftDivider = {
                    type: 'divider',
                    clientId: createEventSongListLocalKey(),
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
                const song: EventSongListDraftSong = {
                    type: 'song',
                    clientId: createEventSongListLocalKey(),
                    subtitle: p.comment,
                    songId: p.song.id,
                    song: p.song,
                }
                return song;
        }
        throw new Error(`unknown type?`);
    });
}
