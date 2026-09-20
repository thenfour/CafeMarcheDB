import type {
    EventSongListDividerItem,
    EventSongListItem,
    EventSongListSongItem,
    LocalSongListPayload,
} from "../../setlistApi";
import { EventSongListContent } from "./eventSongListContent";
import type { EventSongListDetailClient } from "./eventSongListViews";

export interface EventSongListDraftSong {
    readonly type: "song";
    readonly clientId: number;
    readonly songId: number;
    readonly song: EventSongListSongItem["song"];
    subtitle: string;
}

export interface EventSongListDraftDivider {
    readonly type: "divider";
    readonly clientId: number;
    color: string | null;
    isInterruption: boolean;
    isSong: boolean;
    subtitleIfSong: string | null;
    lengthSeconds: number | null;
    textStyle: string | null;
    subtitle: string;
}

export type EventSongListDraftItem = EventSongListDraftSong | EventSongListDraftDivider;

/**
 * Mutable client-side state for the setlist editor.
 *
 * Items are kept in their actual display order. Persistence's split song and
 * divider collections, and their sortOrder fields, are deliberately absent.
 */
export interface EventSongListDraft {
    /** The persisted identity. Undefined for a new setlist. */
    readonly id?: number;
    /** Stable local identity for editor and media-player state. */
    readonly clientId: number;
    readonly eventId: number;
    name: string;
    description: string;
    isActuallyPlayed: boolean;
    isOrdered: boolean;
    sortOrder: number;
    items: EventSongListDraftItem[];
}

const itemToDraft = (item: EventSongListItem): EventSongListDraftItem => {
    if (item.type === "song") {
        return {
            type: "song",
            clientId: item.id,
            songId: item.songId,
            song: item.song,
            subtitle: item.subtitle ?? "",
        };
    }
    if (item.type === "divider") {
        return {
            type: "divider",
            clientId: item.id,
            color: item.color,
            isInterruption: item.isInterruption,
            isSong: item.isSong,
            subtitleIfSong: item.subtitleIfSong,
            lengthSeconds: item.lengthSeconds,
            textStyle: item.textStyle,
            subtitle: item.subtitle ?? "",
        };
    }
    throw new Error("A blank editor row cannot be stored in a setlist draft.");
};

export function eventSongListClientToDraft(
    value: EventSongListDetailClient,
): EventSongListDraft | undefined {
    if (!value.content
        || value.eventId === undefined
        || value.name === undefined
        || value.description === undefined
        || value.isActuallyPlayed === undefined
        || value.isOrdered === undefined
        || value.sortOrder === undefined) {
        return undefined;
    }

    return {
        id: value.id,
        clientId: value.id,
        eventId: value.eventId,
        name: value.name,
        description: value.description,
        isActuallyPlayed: value.isActuallyPlayed,
        isOrdered: value.isOrdered,
        sortOrder: value.sortOrder,
        items: value.content.items.map(itemToDraft),
    };
}

export function createEventSongListDraft(args: {
    clientId: number;
    eventId: number;
    name: string;
    sortOrder?: number;
}): EventSongListDraft {
    return {
        clientId: args.clientId,
        eventId: args.eventId,
        name: args.name,
        description: "",
        isActuallyPlayed: false,
        isOrdered: true,
        sortOrder: args.sortOrder ?? 0,
        items: [],
    };
}

export function cloneEventSongListDraft(value: EventSongListDraft): EventSongListDraft {
    return {
        ...value,
        items: value.items.map(item => item.type === "song"
            ? {
                ...item,
                song: {
                    ...item.song,
                    tags: item.song.tags.map(tag => ({ ...tag })),
                },
            }
            : { ...item }),
    };
}

export function eventSongListRowToDraftItem(
    item: Exclude<EventSongListItem, { type: "new" }>,
    clientId = item.id,
): EventSongListDraftItem {
    return itemToDraft({ ...item, id: clientId });
}

/**
 * Replaces an editor row without changing its position in the ordered setlist.
 *
 * The source ID is passed separately so callers identify the rendered row
 * independently of the replacement value. Adding a new row remains explicit.
 */
export function replaceEventSongListEditorRow(
    rows: readonly EventSongListItem[],
    sourceRowId: number,
    newValue: EventSongListItem,
): EventSongListItem[] {
    const rowIndex = rows.findIndex(row => row.id === sourceRowId);
    if (rowIndex < 0) {
        throw new Error(`Cannot replace missing setlist row ${sourceRowId}.`);
    }

    const updatedRows = [...rows];
    updatedRows[rowIndex] = newValue;
    return updatedRows;
}

const draftToLocalPayload = (value: EventSongListDraft): LocalSongListPayload => ({
    songs: value.items.flatMap((item, sortOrder) => item.type === "song" ? [{
        id: item.clientId,
        eventSongListId: value.clientId,
        sortOrder,
        subtitle: item.subtitle,
        songId: item.songId,
        song: item.song,
    }] : []),
    dividers: value.items.flatMap((item, sortOrder) => item.type === "divider" ? [{
        id: item.clientId,
        eventSongListId: value.clientId,
        sortOrder,
        subtitle: item.subtitle,
        color: item.color,
        isInterruption: item.isInterruption,
        isSong: item.isSong,
        subtitleIfSong: item.subtitleIfSong,
        lengthSeconds: item.lengthSeconds,
        textStyle: item.textStyle,
    }] : []),
});

export function getEventSongListDraftContent(value: EventSongListDraft): EventSongListContent {
    return new EventSongListContent(draftToLocalPayload(value));
}

export function eventSongListDraftToClient(value: EventSongListDraft): EventSongListDetailClient {
    return {
        id: value.id ?? value.clientId,
        eventId: value.eventId,
        name: value.name,
        description: value.description,
        isActuallyPlayed: value.isActuallyPlayed,
        isOrdered: value.isOrdered,
        sortOrder: value.sortOrder,
        content: getEventSongListDraftContent(value),
    };
}

export function eventSongListDividerRowToDraftItem(
    item: EventSongListDividerItem,
): EventSongListDraftDivider {
    return itemToDraft(item) as EventSongListDraftDivider;
}
