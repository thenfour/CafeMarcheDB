// updateGenericSortOrder
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx, assert } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import * as db3 from "../db3";
import { TupdateGenericSortOrderArgs, ZupdateGenericSortOrderArgs } from "../shared/apiTypes";
import { moveItemInArray } from "shared/arrayUtils";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/activityLog";

// todo: find a better algorithm. for potentially large tables,
// this is not efficient. instead consider keeping gaps between items giving room
// to move single items without updating neighbors.

// ASSUMES that the table's sort order column is called "sortOrder"
// ASSUMES that the table is not that big; we will update many sort orders here.
export default resolver.pipe(
    resolver.authorize(Permission.login),
    resolver.zod(ZupdateGenericSortOrderArgs),
    async (args: TupdateGenericSortOrderArgs, ctx: AuthenticatedCtx) => {

        if (args.movingItemId === args.newPositionItemId) {
            //moving an item to the same place 
            return args;
        }

        const table = db3.GetTableById(args.tableID);
        const dbTableClient = db[table.tableName] as typeof db.frontpageGalleryItem; // the prisma interface. for convenience of intellisense cast to something known.

        // check permissions of sort order column.
        const sortOrderColumn = table.SqlSpecialColumns.sortOrder;
        if (!sortOrderColumn) {
            throw new Error(`table ${table.tableName} does not have a sort order column`);
        }

        // column.authorize ...
        //CMDBAuthorizeOrThrow("updateEventComment", Permission.comm)
        //const currentUser = await mutationCore.getCurrentUserCore(ctx);

        let whereClause: any = {};
        if (args.groupByColumn && args.groupValue !== undefined) {
            whereClause[args.groupByColumn] = args.groupValue;
        }

        const items = await dbTableClient.findMany({
            where: whereClause,
            select: {
                id: true,
                sortOrder: true,
            },
            orderBy: {
                sortOrder: "asc",
            },
        });

        assert(items.length > 1, "can't move items when there's only 1");

        const indexToMove = items.findIndex(i => i.id === args.movingItemId);
        const destIndex = items.findIndex(i => i.id === args.newPositionItemId);
        assert(indexToMove !== -1 && destIndex !== -1, `specified items weren't found movingItemId:${args.movingItemId}, newPositionItemId:${args.newPositionItemId}`);

        const newItems = moveItemInArray(items, indexToMove, destIndex);

        // items are now in order. correct their sort orders so they're in order.
        // in order to not have to update ALL rows all the time, just check if things are in order. if they're not, correct that item only and continue.
        // it's safe to assume sorted array index === sort order. it's tempting to try and retain weird sort orders like if you make manual adjustments or something,
        // but it just gets more complex than it's worth.
        //let prevSortOrder = newItems[0]!.sortOrder;
        let oldValues: { id: number, sortOrder: number }[] = [];
        let newValues: { id: number, sortOrder: number }[] = [];

        for (let i = 0; i < newItems.length; ++i) {
            const item = newItems[i]!;
            if (item.sortOrder === i) continue;
            oldValues.push({ id: item.id, sortOrder: item.sortOrder });
            newValues.push({ id: item.id, sortOrder: i });

            await dbTableClient.update({
                data: { sortOrder: i },
                where: { id: item.id },
            });
        }

        const contextDesc = `updateSortOrder:${table.tableName}`;
        const changeContext = CreateChangeContext(contextDesc);

        await RegisterChange({
            action: ChangeAction.update,
            changeContext,
            table: args.tableName,
            pkid: 0,
            oldValues,
            newValues,
            ctx,
        });

        return args;
    }
);

