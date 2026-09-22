import { defineEntity } from "../../core/db3Entity";
import { xCustomLink } from "../../schema/customLinks";

export const customLinkEntity = defineEntity({
    schema: xCustomLink,
    getIdentity: (link: { id: number }) => link.id,
});
