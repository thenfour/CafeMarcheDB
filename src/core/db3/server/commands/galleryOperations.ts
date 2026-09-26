import type { Prisma } from "db";
import { moveItemInArray } from "shared/arrayUtils";
import { reorderGalleryItemsCommand, xFrontpageGalleryItem } from "../../db3";
import { DB3CommandError, defineCommandHandler } from "../db3CommandCore";
import { DB3MutationAuthorizationError } from "../db3mutationCore";
import { resolvePublicIds } from "../db3PublicIds";
import { createUsableSortOrderSlots } from "../db3SortOrder";

// this is largely duplicated with eventSongListReorderCommandHandler
// next time any reordering  needs to be implemented, centralize/share the flow.
// it's error-prone and unmaintainable to duplicate this logic across multiple command handlers.
export const galleryReorderCommandHandler = defineCommandHandler(
    reorderGalleryItemsCommand,
    async (dto, context) => {
        // authorize at table level
        if (!xFrontpageGalleryItem.authorizeTableForEdit(context.authorization)) {
            throw new DB3MutationAuthorizationError(xFrontpageGalleryItem.tableName, ["sortOrder"]);
        }

        // convert public id to internal database IDs
        // this also does per-row auth
        const ids = await resolvePublicIds(
            xFrontpageGalleryItem,
            dto.scopeRowIds,
            context.authorization,
            context.transaction,
        );
        // convert to full database rows; this should really be combined with resolvePublicIds
        // through a view.
        const items = await context.transaction.frontpageGalleryItem.findMany({
            where: { id: { in: ids }, isDeleted: false },
            orderBy: { sortOrder: "asc" },
        }) as Prisma.FrontpageGalleryItemGetPayload<{}>[]; // The transaction delegate is runtime-selected.

        // user either requested non-existent items (maybe async changes)
        // or are not authorized for some rows; either way safest to short-circuit.
        if (items.length !== dto.scopeRowIds.length) {
            throw new DB3CommandError("Gallery reorder scope was not found.");
        }

        const from = items.findIndex(item => item.publicId === dto.movingItemId);
        const to = items.findIndex(item => item.publicId === dto.newPositionItemId);
        if (from < 0 || to < 0) {
            throw new DB3CommandError("Gallery reorder endpoints were not found.");
        }

        const slots = createUsableSortOrderSlots(items, "sortOrder");
        const changes = moveItemInArray(items, from, to).flatMap((item, index) =>
            item.sortOrder === slots[index] ? [] : [{ item, sortOrder: slots[index]! }]);
        for (const change of changes) {
            const authorization = xFrontpageGalleryItem.authorizeAndSanitize({
                contextDesc: "FrontpageGalleryItem_Reorder",
                model: { sortOrder: change.sortOrder },
                existingModel: change.item,
                publicData: context.authorization,
                rowMode: "update",
                fallbackOwnerId: null,
            });
            if (!authorization.rowIsAuthorized
                || authorization.unauthorizedColumnCount > 0
                || authorization.unknownColumnCount > 0) {
                throw new DB3MutationAuthorizationError(xFrontpageGalleryItem.tableName, ["sortOrder"]);
            }
        }
        for (const change of changes) {
            await context.rowServices.update(
                xFrontpageGalleryItem,
                xFrontpageGalleryItem.parseIdentity(change.item.publicId),
                { sortOrder: change.sortOrder },
            );
        }
        return {};
    },
);
