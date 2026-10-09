import { z } from "zod";
import { BandPublicIdSchema } from "src/locale/shared/presentationInput";
import { xFrontpageGalleryItem } from "../db3";
import { ForkImageParamsSchema, ForkImageResultSchema, ImageEditParamsSchema } from "./imageFork";

export const UpdateGalleryItemImageParamsSchema = z.object({
    bandPublicId: BandPublicIdSchema,
    galleryItemId: xFrontpageGalleryItem.identitySchema,
    imageParams: ForkImageParamsSchema.omit({ bandPublicId: true }),
}).strict();

export const UpdateGalleryItemImageResultSchema = z.object({
    newFile: ForkImageResultSchema,
    newDisplayParams: ImageEditParamsSchema,
}).strict();

export type GalleryImageInput = z.infer<typeof UpdateGalleryItemImageParamsSchema>;
