import { Prisma } from "db";
import { defineEntity } from "../../core/db3Entity";
import { xCustomLink } from "../../schema/customLinks";

export const customLinkEntity = defineEntity<Prisma.CustomLinkDelegate>()({
    schema: xCustomLink,
    getIdentity: (link: { id: number }) => link.id,
});
