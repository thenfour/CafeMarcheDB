import type { Prisma } from "db";
import { reorderMenuLinksCommand, xMenuLink } from "../../db3";
import { DB3CommandError, defineCommandHandler } from "../db3CommandCore";
import { DB3MutationAuthorizationError } from "../db3mutationCore";
import { resolvePublicIds } from "../db3PublicIds";
import { executePublicIdReorder } from "../db3PublicIdReorder";

export const menuLinkReorderCommandHandler = defineCommandHandler(
    reorderMenuLinksCommand,
    async (dto, context) => {
        await executePublicIdReorder({
            table: xMenuLink,
            authorization: context.authorization,
            scopePublicIds: dto.scopeRowIds,
            movingPublicId: dto.movingItemId,
            newPositionPublicId: dto.newPositionItemId,
            loadRows: async () => {
                const ids = await resolvePublicIds(
                    xMenuLink, dto.scopeRowIds,
                    context.authorization, context.transaction,
                );
                return context.transaction.menuLink.findMany({
                    where: { id: { in: ids } },
                    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                }) as Promise<Prisma.MenuLinkGetPayload<{}>[]>; // The transaction delegate is runtime selected.
            },
            writeChange: async change => {
                await context.rowServices.update(
                    xMenuLink,
                    xMenuLink.parseIdentity(change.item.publicId),
                    { sortOrder: change.newSortOrder },
                );
            },
            error: reason => reason === "unauthorized"
                ? new DB3MutationAuthorizationError(xMenuLink.tableName, ["sortOrder"])
                : new DB3CommandError(reason === "scope"
                    ? "Menu link reorder scope was not found."
                    : "Menu link reorder endpoints were not found."),
        });
        return {};
    },
);
