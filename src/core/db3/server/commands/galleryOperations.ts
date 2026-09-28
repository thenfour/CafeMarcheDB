import type { Prisma } from "db";
import { reorderGalleryItemsCommand, xFrontpageGalleryItem } from "../../db3";
import { DB3CommandError, defineCommandHandler } from "../db3CommandCore";
import { DB3MutationAuthorizationError } from "../db3mutationCore";
import { resolvePublicIds } from "../db3PublicIds";
import { executePublicIdReorder } from "../db3PublicIdReorder";

export const galleryReorderCommandHandler = defineCommandHandler(
    reorderGalleryItemsCommand,
    async (dto, context) => {
        await executePublicIdReorder({
            table: xFrontpageGalleryItem,
            auth: context.authorization,
            scopePublicIds: dto.scopeRowIds,
            movingPublicId: dto.movingItemId,
            newPositionPublicId: dto.newPositionItemId,
            loadRows: async () => {
                const ids = await resolvePublicIds(
                    xFrontpageGalleryItem, dto.scopeRowIds,
                    context.authorization, context.transaction,
                );
                return context.transaction.frontpageGalleryItem.findMany({
                    where: { id: { in: ids }, isDeleted: false },
                    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                }) as Promise<Prisma.FrontpageGalleryItemGetPayload<{}>[]>; // The transaction delegate is runtime selected.
            },
            writeChange: async change => {
                await context.rowServices.update(
                    xFrontpageGalleryItem,
                    xFrontpageGalleryItem.parseIdentity(change.item.publicId),
                    { sortOrder: change.newSortOrder },
                );
            },
            error: reason => reason === "unauthorized"
                ? new DB3MutationAuthorizationError(xFrontpageGalleryItem.tableName, ["sortOrder"])
                : new DB3CommandError(reason === "scope"
                    ? "Gallery reorder scope was not found."
                    : "Gallery reorder endpoints were not found."),
        });
        return {};
    },
);
