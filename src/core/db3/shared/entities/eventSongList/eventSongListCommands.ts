import { z } from "zod";

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
