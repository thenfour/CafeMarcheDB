import { DB3ReferenceStore, type DB3ReferenceProvider, emptyReferenceContract } from "../../core/db3Hydration";
import { Prisma } from "db";
import { z } from "zod";
import { defineView, type ClientOf } from "../../core/db3View";
import { EventSongListContent } from "./eventSongListContent";
import { deriveViewContract } from "../../core/db3ViewContract";
import { xEventSongList, xEventSongListSong, xEventSongListDivider } from "../../schema/event";
import { isPublicId, type SongTagAssociationPublicId, type SongTagPublicId } from "shared/publicId";
import { graft } from "../common/viewCommon";

const CompleteSongTagAssociationDtoSchema = z.object({
    publicId: z.custom<SongTagAssociationPublicId>(isPublicId, "invalid SongTagAssociation public ID"),
    songId: z.number().int(),
    tagId: z.custom<SongTagPublicId>(isPublicId, "invalid SongTag public ID"),
});

const CompleteSetlistSongDtoSchema = z.object({
    publicId: xEventSongListSong.identitySchema,
    eventSongListId: xEventSongList.identitySchema,
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
    publicId: xEventSongListDivider.identitySchema,
    eventSongListId: xEventSongList.identitySchema,
    subtitle: z.string().nullable(),
    sortOrder: z.number().int(),
    color: z.string().nullable(),
    isInterruption: z.boolean(),
    isSong: z.boolean(),
    subtitleIfSong: z.string().nullable(),
    lengthSeconds: z.number().int().nullable(),
    textStyle: z.string().nullable(),
});

const EventSongListContentDtoSchema = z.object({
    songs: z.array(CompleteSetlistSongDtoSchema),
    dividers: z.array(CompleteSetlistDividerDtoSchema),
});

const eventSongListTransportSelection = Prisma.validator<Prisma.EventSongListDefaultArgs>()({
    select: {
        publicId: true,
        sortOrder: true,
        name: true,
        description: true,
        eventId: true,
        isOrdered: true,
        isActuallyPlayed: true,
        songs: {
            orderBy: { sortOrder: "asc" },
            select: {
                publicId: true,
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
                        tags: {
                            select: {
                                publicId: true,
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
                publicId: true,
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

// Authorization support stays outside the transported Song card.
const eventSongListSelection = graft(eventSongListTransportSelection, {
    select: {
        s
        songs: {
            select: {
                song: {
                    select: {
                        createdByUserId: true,
                        visiblePermissionId: true,
                        isDeleted: true,
                    }
                },
            },
        },
    },
}) satisfies Prisma.EventSongListDefaultArgs;
const eventSongListContract = deriveViewContract(xEventSongList, eventSongListSelection, {
    transportSelection: eventSongListTransportSelection,
});
export const eventSongListDetailSelection = eventSongListContract.prismaSelection;
export type EventSongListDetailDto = z.infer<typeof eventSongListContract.dtoSchema>;

export type EventSongListCompleteDto = Required<Omit<EventSongListDetailDto, "songs" | "dividers">> & z.infer<typeof EventSongListContentDtoSchema>;

export function hydrateEventSongListDetailDto(
    dto: EventSongListDetailDto,
    references: DB3ReferenceProvider<typeof emptyReferenceContract> = new DB3ReferenceStore(),
) {
    const { songs, dividers, ...songList } = eventSongListContract.hydrate(dto, references);
    // Content owns ordered rows and compact color keys. Incomplete reads stay read-only.
    const completeContent = EventSongListContentDtoSchema.safeParse(dto);
    return {
        ...songList,
        clientId: songList.publicId,
        content: completeContent.success
            ? new EventSongListContent({
                songs: completeContent.data.songs.map(row => ({ ...row, clientId: row.publicId })),
                dividers: completeContent.data.dividers.map(row => ({ ...row, clientId: row.publicId })),
            })
            : undefined,
    };
}

export const eventSongListDetailView = defineView({
    viewID: "EventSongList_Detail",
    entity: xEventSongList,
    selection: eventSongListDetailSelection,
    dtoSchema: eventSongListContract.dtoSchema,
    hydrate: hydrateEventSongListDetailDto,
});
export type EventSongListDetailClient = ClientOf<typeof eventSongListDetailView>;

// A preview may represent an unsaved draft, which has no persisted identity.
export type EventSongListPreview = Omit<EventSongListDetailClient, "publicId" | "clientId"> & {
    publicId?: EventSongListDetailClient["publicId"];
    clientId: string;
};
