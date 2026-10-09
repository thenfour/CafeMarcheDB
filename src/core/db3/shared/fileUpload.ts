import { z } from "zod";
import { BandPublicIdSchema } from "src/locale/shared/presentationInput";
import { xBandFileTag, xBandUser, xEvent, xFile, xInstrument, xPermission, xSong, xUser, xWikiPage } from "../db3";

export const FileUploadArgsSchema = z.object({
    bandPublicId: BandPublicIdSchema,
    taggedBandUserId: xBandUser.identitySchema.optional(),
    taggedSongId: xSong.identitySchema.optional(),
    taggedEventId: xEvent.identitySchema.optional(),
    taggedInstrumentId: xInstrument.identitySchema.optional(),
    taggedWikiPageId: xWikiPage.identitySchema.optional(),
    fileTagId: xBandFileTag.identitySchema.optional(),
    visiblePermissionId: xPermission.identitySchema.optional(),
    visiblePermission: z.string().min(1).max(100).optional(),
    externalURI: z.string().max(768).url().refine(value => ["http:", "https:"].includes(new URL(value).protocol)).optional(),
    maxImageDimension: z.coerce.number().int().min(1).max(16_384).optional(),
}).strict().refine(value => !value.visiblePermission || !value.visiblePermissionId, {
    message: "Choose one visibility reference.",
});
export type FileUploadArgs = z.infer<typeof FileUploadArgsSchema>;

export const UploadedFileSchema = z.object({
    publicId: xFile.identitySchema,
    storedLeafName: z.string(), fileLeafName: z.string(), mimeType: z.string().nullable(),
    externalURI: z.string().nullable(), description: z.string(), sizeBytes: z.number().nullable(),
    customData: z.string().nullable(), uploadedByUserId: xUser.identitySchema.nullable(),
});

export const FileUploadResponseSchema = z.object({
    files: z.array(UploadedFileSchema), isSuccess: z.boolean(), errorMessage: z.string().optional(),
});
