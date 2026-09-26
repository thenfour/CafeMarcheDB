import type { Prisma } from "db";
import { moveItemInArray } from "shared/arrayUtils";
import {
    deleteEventSongListCommand,
    reorderEventSongListsCommand,
    xEvent,
    xEventSongList,
} from "../../db3";
import { DB3CommandError, defineCommandHandler } from "../db3CommandCore";
import { DB3MutationAuthorizationError } from "../db3mutationCore";
import { resolvePublicIds } from "../db3PublicIds";
import { createUsableSortOrderSlots } from "../db3SortOrder";

export const eventSongListDeleteCommandHandler = defineCommandHandler(
    deleteEventSongListCommand,
    async (dto, context) => {
        if (!xEventSongList.authorizeTableForEdit(context.authorization)) {
            throw new DB3MutationAuthorizationError(xEventSongList.tableName, ["publicId"]);
        }
        const row = await context.rowServices.requireVisible(xEventSongList, dto.publicId);
        const parent = await context.transaction.event.findUnique({
            where: { id: row.eventId },
            select: { publicId: true },
        });
        if (!parent) {
            throw new DB3CommandError("The setlist's event was not found.");
        }
        await context.rowServices.requireVisible(xEvent, xEvent.parseIdentity(parent.publicId));
        // The parent selection includes both collections for one aggregate audit.
        // Database cascades delete the children inside the command transaction.
        await context.rowServices.delete(xEventSongList, dto.publicId, "hard");
        return dto;
    },
);


// this is largely duplicated with galleryReorderCommandHandler
// next time any reordering  needs to be implemented, centralize/share the flow.
// it's error-prone and unmaintainable to duplicate this logic across multiple command handlers.
export const eventSongListReorderCommandHandler = defineCommandHandler(
    reorderEventSongListsCommand,
    async (dto, context) => {
        if (!xEventSongList.authorizeTableForEdit(context.authorization)) {
            throw new DB3MutationAuthorizationError(xEventSongList.tableName, ["sortOrder"]);
        }
        const event = await context.rowServices.requireVisible(xEvent, dto.eventId);
        const ids = await resolvePublicIds(xEventSongList, dto.scopeRowIds, context.authorization, context.transaction);

        const items = await context.transaction.eventSongList.findMany({
            where: {
                id: {
                    in: ids
                },
                eventId: event.id,
            },
            orderBy:
            {
                sortOrder: "asc",
            },
        }) as Prisma.EventSongListGetPayload<{}>[]; // context.transaction is `any`
        if (items.length !== dto.scopeRowIds.length) {
            throw new DB3CommandError("Setlist reorder scope was not found in this event.");
        }
        const from = items.findIndex(item => item.publicId === dto.movingItemId);
        const to = items.findIndex(item => item.publicId === dto.newPositionItemId);
        if (from < 0 || to < 0) {
            throw new DB3CommandError("Setlist reorder endpoints were not found.");
        }
        const slots = createUsableSortOrderSlots(items, "sortOrder");
        const changes = moveItemInArray(items, from, to).flatMap((item, index) =>
            item.sortOrder === slots[index] ? [] : [{ item, sortOrder: slots[index]! }]);

        // Authorize every changed field before the first write.
        for (const change of changes) {
            const auth = xEventSongList.authorizeAndSanitize({
                contextDesc: "EventSongList_Reorder",
                model: { sortOrder: change.sortOrder },
                existingModel: change.item,
                publicData: context.authorization,
                rowMode: "update",
                fallbackOwnerId: null,
            });
            if (!auth.rowIsAuthorized || auth.unauthorizedColumnCount > 0 || auth.unknownColumnCount > 0) {
                throw new DB3MutationAuthorizationError(xEventSongList.tableName, ["sortOrder"]);
            }
        }
        for (const change of changes) {
            await context.rowServices.update(xEventSongList, xEventSongList.parseIdentity(change.item.publicId), {
                sortOrder: change.sortOrder,
            });
        }
        return {};
    },
);
