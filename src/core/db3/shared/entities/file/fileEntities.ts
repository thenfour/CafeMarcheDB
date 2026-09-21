import { Prisma } from "db";
import { defineEntity } from "../../core/db3Entity";
import { xFile, xFileTag, xFrontpageGalleryItem } from "../../schema/file";

export const fileEntity = defineEntity<Prisma.FileDelegate>()({
    schema: xFile,
});

export const fileTagEntity = defineEntity<Prisma.FileTagDelegate>()({
    schema: xFileTag,
});

export const frontpageGalleryItemEntity = defineEntity<Prisma.FrontpageGalleryItemDelegate>()({
    schema: xFrontpageGalleryItem,
});
