import { defineEntity } from "../../core/db3Entity";
import { xMenuLink } from "../../schema/menuLink";

export const menuLinkEntity = defineEntity({
    schema: xMenuLink,
    getIdentity: (link: { id: number }) => link.id,
});
