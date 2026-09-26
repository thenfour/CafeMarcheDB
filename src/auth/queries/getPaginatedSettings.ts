import type { CMCtx } from "@/src/auth/server/cmResolver";
import { cmauthorize } from "@/src/auth/server/cmResolver";
import { resolver } from "@blitzjs/rpc";
import type { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { z } from "zod";
import { DB3PaginatedQueryCore } from "src/core/db3/server/db3QueryCore";
import { settingEditorView } from "src/core/db3/shared/entities/setting/settingViews";

const GetInput = z.object({
    skip: z.number().int().min(0),
    take: z.number().int().min(1).max(1000),
});

export default resolver.pipe(
    cmauthorize(Permission.sysadmin),
    resolver.zod(GetInput),
    async ({ skip, take }, ctx: CMCtx) => {
        try {
            (await ctx.auth.refresh(db)).requirePermission(Permission.sysadmin);
            const result = await DB3PaginatedQueryCore({
                table: {
                    tableID: settingEditorView.tableID,
                    tableName: settingEditorView.tableName,
                    viewID: settingEditorView.viewID,
                },
                filter: {},
                orderBy: undefined,
                skip,
                take,
                cmdbQueryContext: "settings/list",
            }, ctx as AuthenticatedCtx); // The fresh Sysadmin check above requires an authenticated actor.

            return {
                items: result.items.map(item => settingEditorView.parseDto(item)),
                nextPage: result.nextPage,
                hasMore: result.hasMore,
                count: result.count,
            };
        } catch (e) {
            console.error(`Exception while querying setting`);
            console.error(e);
            throw (e);
        }
    }
);



