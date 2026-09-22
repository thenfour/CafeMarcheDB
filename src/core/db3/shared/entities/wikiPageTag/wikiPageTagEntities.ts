import { Prisma } from "db";
import { defineEntity } from "../../core/db3Entity";
import { xWikiPageTag } from "../../schema/wikiPageTag";

export const wikiPageTagEntity = defineEntity({
    schema: xWikiPageTag,
    getIdentity: (tag: Prisma.WikiPageTagGetPayload<{}>) => tag.id,
});
