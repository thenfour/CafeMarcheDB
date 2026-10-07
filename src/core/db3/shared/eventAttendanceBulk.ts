import { z } from "zod";
import { isPublicId, type BandPublicId, type EventSegmentPublicId } from "shared/publicId";

const bandPublicId = z.custom<BandPublicId>(isPublicId);
const segmentPublicId = z.custom<EventSegmentPublicId>(isPublicId);

export const CopyEventSegmentResponsesSchema = z.object({
    bandPublicId,
    fromEventSegmentId: segmentPublicId,
    toEventSegmentId: segmentPublicId,
}).strict().refine(args => args.fromEventSegmentId !== args.toEventSegmentId, "Choose two different segments.");

export const ClearEventSegmentResponsesSchema = z.object({
    bandPublicId,
    eventSegmentId: segmentPublicId,
}).strict();

export type CopyEventSegmentResponsesArgs = z.infer<typeof CopyEventSegmentResponsesSchema>;
export type ClearEventSegmentResponsesArgs = z.infer<typeof ClearEventSegmentResponsesSchema>;
