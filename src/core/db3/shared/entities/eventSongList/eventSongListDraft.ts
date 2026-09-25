import { getUniqueNegativeID } from "shared/utils";
import type { EventSongListPublicId, EventSongListSongPublicId, EventSongListDividerPublicId } from "shared/publicId";
import type {
    EventSongListDividerItem,
    EventSongListItem,
    EventSongListSongItem,
    LocalSongListPayload,
} from "../../setlistApi";
import { EventSongListContent } from "./eventSongListContent";
import type { EventSongListDetailClient, EventSongListPreview } from "./eventSongListViews";

export interface EventSongListDraftSong {
    readonly type: "song";
    readonly publicId?: EventSongListSongPublicId;
    readonly clientId: string;
    readonly songId: number;
    readonly song: EventSongListSongItem["song"];
    subtitle: string;
}

export interface EventSongListDraftDivider {
    readonly type: "divider";
    readonly publicId?: EventSongListDividerPublicId;
    readonly clientId: string;
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
    readonly publicId?: EventSongListPublicId;
    /** Stable local identity for editor and media-player state. */
    readonly clientId: string;
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
            clientId: item.clientId,
            publicId: item.publicId,
            songId: item.songId,
            song: item.song,
            subtitle: item.subtitle ?? "",
        };
    }
    if (item.type === "divider") {
        return {
            type: "divider",
            clientId: item.clientId,
            publicId: item.publicId,
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
        publicId: value.publicId,
        clientId: value.publicId,
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
    clientId: string;
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
    clientId = item.clientId,
): EventSongListDraftItem {
    return itemToDraft({ ...item, clientId });
}

/**
 * Replaces an editor row without changing its position in the ordered setlist.
 *
 * The source ID is passed separately so callers identify the rendered row
 * independently of the replacement value. Adding a new row remains explicit.
 */
export function replaceEventSongListEditorRow(
    rows: readonly EventSongListItem[],
    sourceRowId: string,
    newValue: EventSongListItem,
): EventSongListItem[] {
    const rowIndex = rows.findIndex(row => row.clientId === sourceRowId);
    if (rowIndex < 0) {
        throw new Error(`Cannot replace missing setlist row ${sourceRowId}.`);
    }

    const updatedRows = [...rows];
    updatedRows[rowIndex] = newValue;
    return updatedRows;
}

const draftToLocalPayload = (value: EventSongListDraft): LocalSongListPayload => ({
    songs: value.items.flatMap((item, sortOrder) => item.type === "song" ? [{
        clientId: item.clientId,
        publicId: item.publicId,
        eventSongListId: value.publicId,
        sortOrder,
        subtitle: item.subtitle,
        songId: item.songId,
        song: item.song,
    }] : []),
    dividers: value.items.flatMap((item, sortOrder) => item.type === "divider" ? [{
        clientId: item.clientId,
        publicId: item.publicId,
        eventSongListId: value.publicId,
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

export function eventSongListDraftToPreview(value: EventSongListDraft): EventSongListPreview {
    return {
        publicId: value.publicId,
        clientId: value.clientId,
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
    const draft = itemToDraft(item);
    if (draft.type !== "divider") throw new Error("Expected a divider.");
    return draft;
}

export function createEventSongListLocalKey(): string {
    return `draft:${getUniqueNegativeID()}`;
}
