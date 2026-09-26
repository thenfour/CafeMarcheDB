import { moveItemInArray } from "shared/arrayUtils";
import type { xTable } from "../shared/db3core";
import type { DB3ServerAuthorization } from "./db3ServerAuthorization";
import { createUsableSortOrderSlots } from "./db3SortOrder";

export interface PublicIdReorderRow {
    id: number;
    publicId: string;
    sortOrder: number;
}

export interface PublicIdReorderChange<TRow extends PublicIdReorderRow> {
    item: TRow;
    oldSortOrder: number;
    newSortOrder: number;
}

type ReorderFailure = "unauthorized" | "scope" | "endpoints";

// Callers load only their declared group and provide a writer that preserves
// their audit policy. All changed rows are checked before the first write.
export async function executePublicIdReorder<TRow extends PublicIdReorderRow>(args: {
    table: xTable;
    authorization: DB3ServerAuthorization;
    scopePublicIds: readonly string[];
    movingPublicId: string;
    newPositionPublicId: string;
    loadRows: () => Promise<TRow[]>;
    writeChange: (change: PublicIdReorderChange<TRow>) => Promise<void>;
    error: (reason: ReorderFailure) => Error;
}): Promise<PublicIdReorderChange<TRow>[]> {
    const {
        table, authorization, scopePublicIds, movingPublicId,
        newPositionPublicId, loadRows, writeChange, error,
    } = args;
    if (!table.authorizeTableForEdit(authorization)) throw error("unauthorized");
    const scope = new Set(scopePublicIds);
    if (scope.size !== scopePublicIds.length || scope.size === 0
        || !scope.has(movingPublicId) || !scope.has(newPositionPublicId)) {
        throw error("scope");
    }

    const rows = await loadRows();
    if (rows.length !== scope.size || rows.some(row =>
        !scope.has(row.publicId)
        || !table.authorizeRowForView({ model: row, publicData: authorization }))) {
        throw error("scope");
    }

    const from = rows.findIndex(row => row.publicId === movingPublicId);
    const to = rows.findIndex(row => row.publicId === newPositionPublicId);
    if (from < 0 || to < 0) throw error("endpoints");

    const slots = createUsableSortOrderSlots(rows, "sortOrder");
    const changes = moveItemInArray(rows, from, to).flatMap((item, index) =>
        item.sortOrder === slots[index] ? [] : [{
            item,
            oldSortOrder: item.sortOrder,
            newSortOrder: slots[index]!,
        }]);

    for (const change of changes) {
        const authorizationResult = table.authorizeAndSanitize({
            contextDesc: `reorder:${table.tableName}:preflight`,
            model: { sortOrder: change.newSortOrder },
            existingModel: change.item,
            publicData: authorization,
            rowMode: "update",
            fallbackOwnerId: null,
        });
        if (!authorizationResult.rowIsAuthorized
            || authorizationResult.unauthorizedColumnCount > 0
            || authorizationResult.unknownColumnCount > 0) {
            throw error("unauthorized");
        }
    }
    for (const change of changes) await writeChange(change);
    return changes;
}
