import { Prisma } from "db";
import { defineEntity } from "../../core/db3Entity";
import { xMenuLink } from "../../schema/menuLink";

export const menuLinkEntity = defineEntity<Prisma.MenuLinkDelegate>()({
    schema: xMenuLink,
    getIdentity: (link: { id: number }) => link.id,
});
