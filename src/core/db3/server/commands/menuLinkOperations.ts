import type { Prisma } from "db";
import { moveItemInArray } from "shared/arrayUtils";
import { reorderMenuLinksCommand, xMenuLink } from "../../db3";
import { DB3CommandError, defineCommandHandler } from "../db3CommandCore";
import { DB3MutationAuthorizationError } from "../db3mutationCore";
import { resolvePublicIds } from "../db3PublicIds";
import { createUsableSortOrderSlots } from "../db3SortOrder";

export const menuLinkReorderCommandHandler = defineCommandHandler(
    reorderMenuLinksCommand,
    async (dto, context) => {
        if (!xMenuLink.authorizeTableForEdit(context.authorization)) {
            throw new DB3MutationAuthorizationError(xMenuLink.tableName, ["sortOrder"]);
        }

        const ids = await resolvePublicIds(xMenuLink, dto.scopeRowIds, context.authorization, context.transaction);
        const items = await context.transaction.menuLink.findMany({
            where: { id: { in: ids } },
            orderBy: { sortOrder: "asc" },
        }) as Prisma.MenuLinkGetPayload<{}>[]; // The command transaction delegate is runtime selected.
        if (items.length !== dto.scopeRowIds.length) {
            throw new DB3CommandError("Menu link reorder scope was not found.");
        }

        const from = items.findIndex(item => item.publicId === dto.movingItemId);
        const to = items.findIndex(item => item.publicId === dto.newPositionItemId);
        if (from < 0 || to < 0) {
            throw new DB3CommandError("Menu link reorder endpoints were not found.");
        }

        const slots = createUsableSortOrderSlots(items, "sortOrder");
        const changes = moveItemInArray(items, from, to).flatMap((item, index) =>
            item.sortOrder === slots[index] ? [] : [{ item, sortOrder: slots[index]! }]);

        for (const change of changes) {
            const authorization = xMenuLink.authorizeAndSanitize({
                contextDesc: "MenuLink_Reorder",
                model: { sortOrder: change.sortOrder },
                existingModel: change.item,
                publicData: context.authorization,
                rowMode: "update",
                fallbackOwnerId: null,
            });
            if (!authorization.rowIsAuthorized
                || authorization.unauthorizedColumnCount > 0
                || authorization.unknownColumnCount > 0) {
                throw new DB3MutationAuthorizationError(xMenuLink.tableName, ["sortOrder"]);
            }
        }
        for (const change of changes) {
            await context.rowServices.update(
                xMenuLink,
                xMenuLink.parseIdentity(change.item.publicId),
                { sortOrder: change.sortOrder },
            );
        }
        return {};
    },
);
