import { Prisma } from "db";
import { z } from "zod";
import { PresentationInputSchema, BandPublicIdSchema } from "src/locale/shared/presentationInput";
import { defineView, type DtoOf } from "../../core/db3View";
import { deriveViewContract } from "../../core/db3ViewContract";
import { xEvent } from "../../schema/event";
import { xSong } from "../../schema/song";
import { EventActivityFilterSchema, EventActivityTimingSchema } from "../event/eventActivity";

export const SongHistoryTimingSchema = EventActivityTimingSchema;
export const SongHistoryFilterSchema = EventActivityFilterSchema;
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
