import { parsePublicId } from "shared/publicId";

export const galleryPublicId = (id: number) =>
    parsePublicId<"FrontpageGalleryItem">(`Gallery${String(id).padStart(9, "0")}`);
