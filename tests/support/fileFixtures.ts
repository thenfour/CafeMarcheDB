import { parsePublicId } from "shared/publicId";

export const filePublicId = (id: number) =>
    parsePublicId<"File">(`File${String(id).padStart(12, "0")}`);
