import { z } from "zod";
import { BandPublicIdSchema } from "src/locale/shared/presentationInput";
import { xFile } from "../db3";
import { ImageFileFormatOptions, type ImageFileFormat } from "./fileTypes";

const coordinate = z.number().finite();
const imageSize = z.object({ width: coordinate.positive(), height: coordinate.positive() }).strict();
export const ImageEditParamsSchema = z.object({
    cropBegin: z.object({ x: coordinate, y: coordinate }).strict(),
    cropSize: imageSize.nullable(),
    rotate: coordinate,
}).strict();

export const ForkImageParamsSchema = z.object({
    bandPublicId: BandPublicIdSchema,
    parentFileId: xFile.identitySchema,
    outputType: z.custom<ImageFileFormat>(value => typeof value === "string"
        && Object.prototype.hasOwnProperty.call(ImageFileFormatOptions, value)),
    quality: z.number().int().min(1).max(100),
    editParams: ImageEditParamsSchema,
    newDimensions: imageSize.extend({ width: coordinate.positive().max(16_384), height: coordinate.positive().max(16_384) }).optional(),
}).strict();

export const ForkImageResultSchema = z.object({ publicId: xFile.identitySchema }).strict();
export type ImageForkInput = z.infer<typeof ForkImageParamsSchema>;
