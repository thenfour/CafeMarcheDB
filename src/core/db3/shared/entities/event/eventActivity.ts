import { z } from "zod";
import { xBandEventTag } from "./eventTagCatalogs";
import { xEventStatus, xEventType } from "./eventCatalogs";

export const EventActivityTimingSchema = z.enum(["All", "All past", "Future", "Past 5 years", "Past year"]);
export const EventActivityFilterSchema = z.object({
    timing: EventActivityTimingSchema,
    eventTypeIds: z.array(xEventType.identitySchema).max(100),
    eventStatusIds: z.array(xEventStatus.identitySchema).max(100),
    eventTagIds: z.array(xBandEventTag.identitySchema).max(100),
}).strict();
export type EventActivityTiming = z.infer<typeof EventActivityTimingSchema>;
