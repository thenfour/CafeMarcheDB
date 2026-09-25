import { parsePublicId } from "shared/publicId";

export const eventPublicId = (id: number) => parsePublicId<"Event">(`Event___${String(id).padStart(8, "0")}`);
export const segmentPublicId = (id: number) => parsePublicId<"EventSegment">(`EventSeg${String(id).padStart(8, "0")}`);
export const eventResponsePublicId = (id: number) => parsePublicId<"EventUserResponse">(`EventRsp${String(id).padStart(8, "0")}`);
export const segmentResponsePublicId = (id: number) => parsePublicId<"EventSegmentUserResponse">(`SegmResp${String(id).padStart(8, "0")}`);
