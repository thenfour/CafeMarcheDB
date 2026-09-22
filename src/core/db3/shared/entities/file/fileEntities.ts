import { Prisma } from "db";
import { defineEntity } from "../../core/db3Entity";
import { xFile, xFileTag, xFrontpageGalleryItem } from "../../schema/file";

export const fileEntity = defineEntity({
    schema: xFile,
    getIdentity: (file: { id: number }) => file.id,
});

export const fileTagEntity = defineEntity({
    schema: xFileTag,
    getIdentity: (tag: Prisma.FileTagGetPayload<{}>) => tag.id,
});

export const frontpageGalleryItemEntity = defineEntity({
    schema: xFrontpageGalleryItem,
    getIdentity: (item: { id: number }) => item.id,
});
