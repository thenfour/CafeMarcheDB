import type { Prisma } from "db";
import {
    deleteEventSongListCommand,
    reorderEventSongListsCommand,
    xEvent,
    xEventSongList,
} from "../../db3";
import { DB3CommandError, defineCommandHandler } from "../db3CommandCore";
import { DB3MutationAuthorizationError } from "../db3mutationCore";
import { resolvePublicIds } from "../db3PublicIds";
import { executePublicIdReorder } from "../db3PublicIdReorder";

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


export const eventSongListReorderCommandHandler = defineCommandHandler(
    reorderEventSongListsCommand,
    async (dto, context) => {
        await executePublicIdReorder({
            table: xEventSongList,
            authorization: context.authorization,
            scopePublicIds: dto.scopeRowIds,
            movingPublicId: dto.movingItemId,
            newPositionPublicId: dto.newPositionItemId,
            loadRows: async () => {
                const event = await context.rowServices.requireVisible(xEvent, dto.eventId);
                const ids = await resolvePublicIds(
                    xEventSongList, dto.scopeRowIds,
                    context.authorization, context.transaction,
                );
                return context.transaction.eventSongList.findMany({
                    where: { id: { in: ids }, eventId: event.id },
                    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                }) as Promise<Prisma.EventSongListGetPayload<{}>[]>; // The transaction delegate is runtime selected.
            },
            writeChange: async change => {
                await context.rowServices.update(
                    xEventSongList,
                    xEventSongList.parseIdentity(change.item.publicId),
                    { sortOrder: change.newSortOrder },
                );
            },
            error: reason => reason === "unauthorized"
                ? new DB3MutationAuthorizationError(xEventSongList.tableName, ["sortOrder"])
                : new DB3CommandError(reason === "scope"
                    ? "Setlist reorder scope was not found in this event."
                    : "Setlist reorder endpoints were not found."),
        });
        return {};
    },
);
