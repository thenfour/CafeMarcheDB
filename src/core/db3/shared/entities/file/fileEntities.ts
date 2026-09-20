import { Prisma } from "db";
import { defineEntity } from "../../core/db3Entity";
import { xFileTag } from "../../schema/file";

export const fileTagEntity = defineEntity<Prisma.FileTagDelegate>()({
    schema: xFileTag,
    getIdentity: (tag: Prisma.FileTagGetPayload<{}>) => tag.id,
});
