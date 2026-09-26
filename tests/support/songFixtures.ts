import { parsePublicId } from "shared/publicId";

export const songPublicId = (id: number) =>
    parsePublicId<"Song">(`Song${String(id).padStart(12, "0")}`);
