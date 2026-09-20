import { Prisma } from "db";
import { defineEntity } from "../../core/db3Entity";
import { xFile, xFileTag } from "../../schema/file";

export const fileEntity = defineEntity<Prisma.FileDelegate>()({
    schema: xFile,
    getIdentity: (file: { id: number }) => file.id,
});

export const fileTagEntity = defineEntity<Prisma.FileTagDelegate>()({
    schema: xFileTag,
    getIdentity: (tag: Prisma.FileTagGetPayload<{}>) => tag.id,
});
