import { z } from "zod";
import { defineCommand } from "../../core/db3Command";
import type { EventSongListDraft } from "./eventSongListDraft";
import {
    xEvent,
    xEventSongListDivider,
    xEventSongList,
    xEventSongListSong,
} from "../../schema/event";

const PersistedIdSchema = z.number().int().positive();
const SortOrderSchema = z.number().int();

export const EventSongListSongCommandSchema = z.object({
    publicId: xEventSongListSong.identitySchema.optional(),
    sortOrder: SortOrderSchema,
    songId: PersistedIdSchema,
    subtitle: z.string(),
}).strict();

export const EventSongListDividerCommandSchema = z.object({
    publicId: xEventSongListDivider.identitySchema.optional(),
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
    publicId: xEventSongList.identitySchema.optional(),
    name: z.string(),
    description: z.string(),
    isActuallyPlayed: z.boolean(),
    isOrdered: z.boolean(),
    eventId: xEvent.identitySchema,
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
    publicId: xEventSongList.identitySchema,
}).strict();

export type EventSongListSaveResult = z.infer<typeof EventSongListSaveResultSchema>;

export const saveEventSongListCommand = defineCommand({
    commandID: "EventSongList_Save",
    entity: xEventSongList,
    dtoSchema: EventSongListMutationCommandSchema,
    resultSchema: EventSongListSaveResultSchema,
    invalidation: {
        mode: "caller",
        entityIDs: [
            xEventSongList.tableID,
            xEventSongListSong.tableID,
            xEventSongListDivider.tableID,
        ],
    },
    // converts a mutable client react code facing draft object
    // to a serializable format over the wire.
    serialize: (value: EventSongListDraft): EventSongListMutationCommand => ({
        ...(value.publicId === undefined ? {} : { publicId: value.publicId }),
        eventId: value.eventId,
        name: value.name,
        description: value.description,
        isActuallyPlayed: value.isActuallyPlayed,
        isOrdered: value.isOrdered,
        sortOrder: value.sortOrder,
        songs: value.items.flatMap((item, sortOrder) => item.type === "song" ? [{
            ...(item.publicId === undefined ? {} : { publicId: item.publicId }),
            songId: item.songId,
            sortOrder,
            subtitle: item.subtitle,
        }] : []),
        dividers: value.items.flatMap((item, sortOrder) => item.type === "divider" ? [{
            ...(item.publicId === undefined ? {} : { publicId: item.publicId }),
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

const DeleteEventSongListSchema = z.object({
    publicId: xEventSongList.identitySchema,
}).strict();
export const deleteEventSongListCommand = defineCommand({
    commandID: "EventSongList_Delete",
    entity: xEventSongList,
    dtoSchema: DeleteEventSongListSchema,
    resultSchema: DeleteEventSongListSchema,
    invalidation: saveEventSongListCommand.invalidation,
    serialize: (value: z.infer<typeof DeleteEventSongListSchema>) => value,
});

const ReorderEventSongListsSchema = z.object({
    eventId: xEvent.identitySchema,
    movingItemId: xEventSongList.identitySchema,
    newPositionItemId: xEventSongList.identitySchema,
    scopeRowIds: z.array(xEventSongList.identitySchema).min(1),
}).strict().superRefine((value, ctx) => {
    if (new Set(value.scopeRowIds).size !== value.scopeRowIds.length
        || !value.scopeRowIds.includes(value.movingItemId)
        || !value.scopeRowIds.includes(value.newPositionItemId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Reorder requires unique scoped IDs containing both endpoints." });
    }
});
export const reorderEventSongListsCommand = defineCommand({
    commandID: "EventSongList_Reorder",
    entity: xEventSongList,
    dtoSchema: ReorderEventSongListsSchema,
    resultSchema: z.object({}).strict(),
    serialize: (value: z.infer<typeof ReorderEventSongListsSchema>) => value,
});
