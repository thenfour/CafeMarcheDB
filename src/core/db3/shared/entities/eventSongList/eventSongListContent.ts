import type { EventSongListItem, EventSongListSongItem, LocalSongListPayload } from "../../setlistApi";
import {
    GetRowItems,
    SongListItemsIndexAndNamesToString,
    SongListItemsNamesToString,
    SongListItemsToMarkdown,
    SongListItemsToTSV,
} from "../../setlistApi";

export interface EventSongListStats {
    readonly songCount: number;
    readonly durationSeconds: number;
    readonly songsOfUnknownDuration: number;
    readonly maxBpm: number | null;
}

/**
 * The client-side value object produced from the two persistence collections
 * that make up a setlist. Callers consume one ordered sequence and do not need
 * to know that songs and dividers live in separate database tables.
 */
export class EventSongListContent {
    readonly items: readonly EventSongListItem[];
    readonly songItems: readonly EventSongListSongItem[];
    readonly stats: EventSongListStats;

    constructor(source: LocalSongListPayload) {
        this.items = GetRowItems(source);
        this.songItems = this.items.filter(
            (item): item is EventSongListSongItem => item.type === "song",
        );
        this.stats = this.songItems.reduce<EventSongListStats>((stats, item) => ({
            songCount: stats.songCount + 1,
            durationSeconds: stats.durationSeconds + (item.song.lengthSeconds ?? 0),
            songsOfUnknownDuration: stats.songsOfUnknownDuration
                + (item.song.lengthSeconds == null ? 1 : 0),
            maxBpm: item.song.startBPM == null
                ? stats.maxBpm
                : Math.max(stats.maxBpm ?? item.song.startBPM, item.song.startBPM),
        }), {
            songCount: 0,
            durationSeconds: 0,
            songsOfUnknownDuration: 0,
            maxBpm: null,
        });
    }

    toNamesText(): string {
        return SongListItemsNamesToString(this.items);
    }

    toIndexedNamesText(): string {
        return SongListItemsIndexAndNamesToString(this.items);
    }

    toMarkdown(): string {
        return SongListItemsToMarkdown(this.items);
    }

    toTSV(): string {
        return SongListItemsToTSV(this.items);
    }
}
