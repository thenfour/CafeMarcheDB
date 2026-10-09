import { Prisma } from "db";
import { z } from "zod";
import type { SongPublicId } from "shared/publicId";
import { BandPublicIdSchema, PresentationInputSchema } from "src/locale/shared/presentationInput";
import { defineView, type DtoOf } from "../../core/db3View";
import { deriveViewContract } from "../../core/db3ViewContract";
import { dashboardReferenceContract } from "../../references/dashboardReferences";
import { xEvent } from "../../schema/event";
import { xBandSongTag } from "../song/bandSongTagViews";
import { EventActivityFilterSchema } from "./eventActivity";

export const EventStatisticsFilterSchema = EventActivityFilterSchema.extend({
    songTagIds: z.array(xBandSongTag.identitySchema).max(100),
}).strict();
export const EventStatisticsInputSchema = PresentationInputSchema.extend({
    bandPublicId: BandPublicIdSchema,
    filterSpec: EventStatisticsFilterSchema,
}).strict();
export type EventStatisticsInput = z.infer<typeof EventStatisticsInputSchema>;
export type EventStatisticsFilter = z.infer<typeof EventStatisticsFilterSchema>;

const contract = deriveViewContract(xEvent, Prisma.validator<Prisma.EventDefaultArgs>()({
    select: {
        publicId: true,
        name: true,
        startsAt: true,
        durationMillis: true,
        isAllDay: true,
        endDateTime: true,
        typeId: true,
        statusId: true,
        songLists: {
            select: {
                publicId: true,
                songs: {
                    select: {
                        publicId: true,
                        song: {
                            select: {
                                publicId: true,
                                name: true
                            }
                        }
                    }
                },
            }
        },
    },
}), { references: dashboardReferenceContract });
export const eventStatisticsView = defineView({
    viewID: "Event_Statistics",
    entity: xEvent,
    selection: contract.prismaSelection,
    dtoSchema: contract.dtoSchema,
    references: contract.referenceContract,
    hydrate: contract.hydrate,
    where: { startsAt: { not: null } },
});
export type EventStatisticsRow = DtoOf<typeof eventStatisticsView>;
export type EventStatisticsEvent = Omit<EventStatisticsRow, "songLists">;
export type PopularSongOccurrence = Omit<EventStatisticsEvent, "publicId" | "name"> & {
    readonly songId: SongPublicId;
    readonly songName: string;
    readonly eventId: EventStatisticsEvent["publicId"];
    readonly eventName: string;
};
export interface EventStatisticsResult {
    readonly allEvents: EventStatisticsEvent[];
    // Retain the existing RPC property spelling.
    readonly popularSongsOccurrances: PopularSongOccurrence[];
}
