import { Prisma } from "db";
import { z } from "zod";
import { PresentationInputSchema, BandPublicIdSchema } from "src/locale/shared/presentationInput";
import { defineView, type DtoOf } from "../../core/db3View";
import { deriveViewContract } from "../../core/db3ViewContract";
import { xEvent } from "../../schema/event";
import { xSong } from "../../schema/song";
import { xBandEventTag } from "../event/eventTagCatalogs";
import { xEventStatus, xEventType } from "../event/eventCatalogs";

export const SongHistoryTimingSchema = z.enum(["All", "All past", "Future", "Past 5 years", "Past year"]);
export const SongHistoryFilterSchema = z.object({
    timing: SongHistoryTimingSchema,
    eventTypeIds: z.array(xEventType.identitySchema).max(100),
    eventStatusIds: z.array(xEventStatus.identitySchema).max(100),
    eventTagIds: z.array(xBandEventTag.identitySchema).max(100),
}).strict();
export const SongHistoryInputSchema = PresentationInputSchema.extend({
    bandPublicId: BandPublicIdSchema,
    songId: xSong.identitySchema,
    filterSpec: SongHistoryFilterSchema,
}).strict();
export type SongHistoryInput = z.infer<typeof SongHistoryInputSchema>;
export type SongHistoryFilter = z.infer<typeof SongHistoryFilterSchema>;
export type SongHistoryTiming = z.infer<typeof SongHistoryTimingSchema>;

const contract = deriveViewContract(xEvent, Prisma.validator<Prisma.EventDefaultArgs>()({
    select: { publicId: true, name: true, startsAt: true, durationMillis: true, isAllDay: true, endDateTime: true },
}));
export const songHistoryEventView = defineView({
    viewID: "Event_SongHistory",
    entity: xEvent,
    selection: contract.prismaSelection,
    dtoSchema: contract.dtoSchema,
    hydrate: contract.hydrate,
    where: { startsAt: { not: null } },
});
export type SongHistoryEvent = DtoOf<typeof songHistoryEventView>;
export interface SongHistoryResult {
    readonly events: SongHistoryEvent[];
}
