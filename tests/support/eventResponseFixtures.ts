import { parsePublicId } from "shared/publicId";

export const segmentPublicId = (id: number) => parsePublicId<"EventSegment">(`EventSeg${String(id).padStart(8, "0")}`);
export const eventResponsePublicId = (id: number) => parsePublicId<"EventUserResponse">(`EventRsp${String(id).padStart(8, "0")}`);
export const segmentResponsePublicId = (id: number) => parsePublicId<"EventSegmentUserResponse">(`SegmResp${String(id).padStart(8, "0")}`);
