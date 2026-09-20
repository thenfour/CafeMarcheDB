import { Prisma } from "db";
import { z } from "zod";
import { defineView, type ClientOf } from "../../core/db3View";
import { EventSongListContent } from "./eventSongListContent";
import { eventSongListEntity } from "./eventSongListEntities";

const CompleteSongTagAssociationDtoSchema = z.object({
    id: z.number().int(),
    songId: z.number().int(),
    tagId: z.number().int(),
});

const CompleteSetlistSongDtoSchema = z.object({
    id: z.number().int(),
    eventSongListId: z.number().int(),
    subtitle: z.string().nullable(),
    sortOrder: z.number().int(),
    songId: z.number().int(),
    song: z.object({
        id: z.number().int(),
        name: z.string(),
        lengthSeconds: z.number().int().nullable(),
        startBPM: z.number().int().nullable(),
        endBPM: z.number().int().nullable(),
        pinnedRecordingId: z.number().int().nullable(),
        tags: z.array(CompleteSongTagAssociationDtoSchema),
    }),
});

const CompleteSetlistDividerDtoSchema = z.object({
    id: z.number().int(),
    eventSongListId: z.number().int(),
    subtitle: z.string().nullable(),
    sortOrder: z.number().int(),
    color: z.string().nullable(),
    isInterruption: z.boolean(),
    isSong: z.boolean(),
    subtitleIfSong: z.string().nullable(),
    lengthSeconds: z.number().int().nullable(),
    textStyle: z.string().nullable(),
});

const SetlistSongDtoSchema = CompleteSetlistSongDtoSchema
    .partial()
    .extend({
        id: z.number().int(),
        song: CompleteSetlistSongDtoSchema.shape.song.partial().optional(),
    });

const SetlistDividerDtoSchema = CompleteSetlistDividerDtoSchema
    .partial()
    .extend({ id: z.number().int() });

const EventSongListDetailDtoSchema = z.object({
    id: z.number().int(),
    sortOrder: z.number().int().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    eventId: z.number().int().optional(),
    isOrdered: z.boolean().optional(),
    isActuallyPlayed: z.boolean().optional(),
    songs: z.array(SetlistSongDtoSchema).optional(),
    dividers: z.array(SetlistDividerDtoSchema).optional(),
});

const EventSongListContentDtoSchema = z.object({
    songs: z.array(CompleteSetlistSongDtoSchema),
    dividers: z.array(CompleteSetlistDividerDtoSchema),
});

export const eventSongListDetailSelection = Prisma.validator<Prisma.EventSongListDefaultArgs>()({
    select: {
        id: true,
        sortOrder: true,
        name: true,
        description: true,
        eventId: true,
        isOrdered: true,
        isActuallyPlayed: true,
        songs: {
            orderBy: { sortOrder: "asc" },
            select: {
                id: true,
                eventSongListId: true,
                subtitle: true,
                sortOrder: true,
                songId: true,
                song: {
                    select: {
                        id: true,
                        name: true,
                        lengthSeconds: true,
                        startBPM: true,
                        endBPM: true,
                        pinnedRecordingId: true,
                        createdByUserId: true,
                        visiblePermissionId: true,
                        isDeleted: true,
                        tags: {
                            select: {
                                id: true,
                                songId: true,
                                tagId: true,
                            },
                        },
                    },
                },
            },
        },
        dividers: {
            orderBy: { sortOrder: "asc" },
            select: {
                id: true,
                eventSongListId: true,
                subtitle: true,
                sortOrder: true,
                color: true,
                isInterruption: true,
                isSong: true,
                subtitleIfSong: true,
                lengthSeconds: true,
                textStyle: true,
            },
        },
    },
});

export type EventSongListDetailDto = z.infer<typeof EventSongListDetailDtoSchema>;

export function hydrateEventSongListDetailDto(dto: EventSongListDetailDto) {
    const { songs, dividers, ...songList } = dto;
    const completeContent = EventSongListContentDtoSchema.safeParse({ songs, dividers });
    return {
        ...songList,
        content: completeContent.success
            ? new EventSongListContent(completeContent.data)
            : undefined,
    };
}

export const eventSongListDetailView = defineView({
    viewID: "EventSongList_Detail",
    entity: eventSongListEntity,
    selection: eventSongListDetailSelection,
    dtoSchema: EventSongListDetailDtoSchema,
    hydrate: hydrateEventSongListDetailDto,
    getIdentity: client => client.id,
});

export type EventSongListDetailClient = ClientOf<typeof eventSongListDetailView>;
