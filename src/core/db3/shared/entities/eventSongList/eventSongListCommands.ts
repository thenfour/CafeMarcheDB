import { z } from "zod";
import { defineCommand } from "../../core/db3Command";
import type { EventSongListDraft } from "./eventSongListDraft";
import {
    eventSongListDividerEntity,
    eventSongListEntity,
    eventSongListSongEntity,
} from "./eventSongListEntities";

const PersistedIdSchema = z.number().int().positive();
const SortOrderSchema = z.number().int();

export const EventSongListSongCommandSchema = z.object({
    id: PersistedIdSchema.optional(),
    sortOrder: SortOrderSchema,
    songId: PersistedIdSchema,
    subtitle: z.string(),
}).strict();

export const EventSongListDividerCommandSchema = z.object({
    id: PersistedIdSchema.optional(),
    sortOrder: SortOrderSchema,
    color: z.string().nullable(),
    isInterruption: z.boolean(),
    subtitleIfSong: z.string().nullable(),
    isSong: z.boolean(),
    lengthSeconds: z.number().int().nullable(),
    textStyle: z.string().nullable(),
    subtitle: z.string(),
}).strict();

export const EventSongListMutationCommandSchema = z.object({
    id: PersistedIdSchema.optional(),
    name: z.string(),
    description: z.string(),
    isActuallyPlayed: z.boolean(),
    isOrdered: z.boolean(),
    eventId: PersistedIdSchema,
    sortOrder: SortOrderSchema,
    songs: z.array(EventSongListSongCommandSchema),
    dividers: z.array(EventSongListDividerCommandSchema),
}).strict();

export type EventSongListSongCommand = z.infer<typeof EventSongListSongCommandSchema>;
export type EventSongListDividerCommand = z.infer<typeof EventSongListDividerCommandSchema>;
export type EventSongListMutationCommand = z.infer<typeof EventSongListMutationCommandSchema>;

// saving song lists doesn't return an updated object, just the id - mostly for the case
// where you inserted a new item.
export const EventSongListSaveResultSchema = z.object({
    id: PersistedIdSchema,
}).strict();

export type EventSongListSaveResult = z.infer<typeof EventSongListSaveResultSchema>;

export const saveEventSongListCommand = defineCommand({
    commandID: "EventSongList_Save",
    entity: eventSongListEntity,
    dtoSchema: EventSongListMutationCommandSchema,
    resultSchema: EventSongListSaveResultSchema,
    invalidation: {
        mode: "caller",
        entityIDs: [
            eventSongListEntity.entityID,
            eventSongListSongEntity.entityID,
            eventSongListDividerEntity.entityID,
        ],
    },
    // converts a mutable client react code facing draft object
    // to a serializable format over the wire.
    serialize: (value: EventSongListDraft): EventSongListMutationCommand => ({
        ...(value.id === undefined ? {} : { id: value.id }),
        eventId: value.eventId,
        name: value.name,
        description: value.description,
        isActuallyPlayed: value.isActuallyPlayed,
        isOrdered: value.isOrdered,
        sortOrder: value.sortOrder,
        songs: value.items.flatMap((item, sortOrder) => item.type === "song" ? [{
            ...(item.clientId > 0 ? { id: item.clientId } : {}),
            songId: item.songId,
            sortOrder,
            subtitle: item.subtitle,
        }] : []),
        dividers: value.items.flatMap((item, sortOrder) => item.type === "divider" ? [{
            ...(item.clientId > 0 ? { id: item.clientId } : {}),
            sortOrder,
            color: item.color,
            isInterruption: item.isInterruption,
            subtitleIfSong: item.subtitleIfSong,
            isSong: item.isSong,
            lengthSeconds: item.lengthSeconds,
            textStyle: item.textStyle,
            subtitle: item.subtitle,
        }] : []),
    }),
});
