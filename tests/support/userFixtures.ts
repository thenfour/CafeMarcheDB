import { parsePublicId, type UserPublicId } from "shared/publicId";

export const userPublicId = (id: number): UserPublicId =>
    parsePublicId<"User">(`TestUser${String(id).padStart(8, "0")}`);
