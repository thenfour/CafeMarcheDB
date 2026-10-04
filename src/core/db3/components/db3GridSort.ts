import type { GridSortModel } from "@mui/x-data-grid";
import type { IAuthorization } from "src/auth/shared/cmAuthorization";
import type { xTable } from "../shared/db3core";
import { z } from "zod";

// Nested relation ordering cannot be represented by a grid column sort.
const prismaOrderBySchema = z.array(z.record(z.unknown()));

export function gridSortModelFromPrismaOrderBy(table: xTable, auth: IAuthorization): GridSortModel {
    const parsed = prismaOrderBySchema.safeParse(table.naturalOrderBy);
    if (!parsed.success) return [];

    for (const order of parsed.data) {
        const field = Object.keys(order)[0];
        if (!field) continue;
        const direction = order[field];
        if (direction !== "asc" && direction !== "desc") continue;
        if (!table.columns.some(column => column.member === field)) continue;
        if (!table.authorizeColumnForView({ model: null, auth, columnName: field })) continue;
        return [{ field, sort: direction }];
    }

    // An empty sort lets the server apply its trusted natural ordering.
    return [];
}
