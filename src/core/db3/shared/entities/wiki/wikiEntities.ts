import { Prisma } from "db";
import { defineEntity } from "../../core/db3Entity";
import { xWikiPage } from "../../schema/wiki";

export const wikiPageEntity = defineEntity<Prisma.WikiPageDelegate>()({
    schema: xWikiPage,
    getIdentity: (page: { id: number }) => page.id,
});
