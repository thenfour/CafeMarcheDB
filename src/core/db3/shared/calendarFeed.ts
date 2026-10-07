import { z } from "zod";
import { isPublicId, type BandPublicId } from "shared/publicId";

export const CalendarBandContextSchema = z.object({
    bandPublicId: z.custom<BandPublicId>(isPublicId),
}).strict();

export type CalendarBandContext = z.infer<typeof CalendarBandContextSchema>;

export const CalendarExportSchema = z.discriminatedUnion("type", [
    CalendarBandContextSchema.extend({
        type: z.literal("upcoming")
    }),
    CalendarBandContextSchema.extend({
        type: z.literal("event"),
        eventUid: z.string().min(1).max(768)
    }),
]);
export type CalendarExportArgs = z.infer<typeof CalendarExportSchema>;
