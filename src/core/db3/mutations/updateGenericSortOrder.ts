import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx, assert } from "blitz";
import db, { Prisma } from "db";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/activityLog";
import { moveItemInArray } from "shared/arrayUtils";
import { Permission } from "shared/permissions";
import { CreatePublicData } from "types";
import * as db3 from "../db3";
import { deriveDB3ClientIntention, DB3RequestValidationError } from "../server/db3RequestValidation";
import * as mutationCore from "../server/db3mutationCore";
import { TupdateGenericSortOrderArgs, ZupdateGenericSortOrderArgs } from "../shared/apiTypes";

export const createUsableSortOrderSlots = (items: Array<Record<string, any>>, sortOrderMember: string): number[] => {
    const slots = items
        .map(item => item[sortOrderMember] as number)
        .sort((a, b) => a - b);

    // Legacy/default data can contain duplicate sort orders. Merely permuting
    // duplicate values makes a drag operation a successful no-op. Preserve
    // healthy existing slots (including gaps), but make the sequence strictly
    // increasing when a duplicate or descending value is encountered.
    for (let i = 1; i < slots.length; ++i) {
        if (slots[i]! <= slots[i - 1]!) {
            slots[i] = slots[i - 1]! + 1;
        }
    }
    return slots;
};

// Tables must opt in and declare their grouping boundary. The caller also
// supplies the complete row-ID scope represented by its reorderable UI. Only
// those rows are loaded or changed; hidden, paginated, tenant-separated, or
// otherwise unrelated rows keep their existing sort positions.
export default resolver.pipe(
    resolver.authorize(Permission.login),
    resolver.zod(ZupdateGenericSortOrderArgs),
    async (args: TupdateGenericSortOrderArgs, ctx: AuthenticatedCtx) => {
        let table: db3.xTable;
        try {
            table = db3.GetTableById(args.tableID);
        } catch {
            throw new DB3RequestValidationError(`unknown table ID '${args.tableID}'`);
        }

        if (table.tableID !== args.tableID || table.tableName !== args.tableName) {
            throw new DB3RequestValidationError(
                `table name '${args.tableName}' does not match table ID '${args.tableID}'`,
            );
        }

        const policy = table.sortOrderPolicy;
        const sortOrderColumn = table.SqlSpecialColumns.sortOrder;
        if (!policy || policy.scope !== "explicitRowIds" || !sortOrderColumn) {
            throw new mutationCore.DB3MutationAuthorizationError(table.tableName, ["sortOrder"]);
        }

        const requestGroupingColumn = args.groupByColumn ?? null;
        if (requestGroupingColumn !== policy.groupingColumn) {
            throw new DB3RequestValidationError(
                policy.groupingColumn === null
                    ? `table '${table.tableID}' does not accept a reorder grouping column`
                    : `table '${table.tableID}' must be reordered within '${policy.groupingColumn}'`,
            );
        }

        const currentUser = await mutationCore.getCurrentUserCore(ctx);
        if (!currentUser) {
            throw new mutationCore.DB3MutationAuthorizationError(table.tableName, [sortOrderColumn.member]);
        }

        const clientIntention = deriveDB3ClientIntention("mutation", currentUser);
        const publicData = CreatePublicData({ user: currentUser });
        const hasTableMutationCapability = publicData.isSysAdmin
            || publicData.permissions.includes(table.tableAuthMap.Edit)
            || publicData.permissions.includes(table.tableAuthMap.EditOwn);
        if (!hasTableMutationCapability || (table.requiresActualSysadminForMutation && !publicData.isSysAdmin)) {
            throw new mutationCore.DB3MutationAuthorizationError(table.tableName, [sortOrderColumn.member]);
        }

        await db.$transaction(async transactionalDb => {
            const dbTableClient = transactionalDb[table.tableName] as any;
            const whereClause: Record<string, unknown> = {};
            if (policy.groupingColumn !== null) {
                whereClause[policy.groupingColumn] = args.groupValue;
            }
            if (table.SqlSpecialColumns.isDeleted) {
                whereClause[table.SqlSpecialColumns.isDeleted.member] = false;
            }
            whereClause[table.pkMember] = { in: args.scopeRowIds };

            const items = await dbTableClient.findMany({
                ...table.getSelectionArgs(clientIntention, { items: [] }),
                where: whereClause,
                orderBy: { [sortOrderColumn.member]: "asc" },
            }) as unknown as Array<Record<string, any>>;

            // A missing row can mean a stale ID, another group, or a deleted
            // record. Keep those cases indistinguishable and never broaden the
            // query to discover what exists outside the caller's scope.
            if (items.length !== args.scopeRowIds.length) {
                throw new mutationCore.DB3MutationAuthorizationError(
                    table.tableName,
                    [sortOrderColumn.member],
                );
            }

            // Explicit scope is not an authorization grant. Every supplied row
            // must be visible to the fresh database actor before it may
            // participate in the operation.
            if (items.some(item => !table.authorizeRowForView({
                clientIntention,
                model: item,
                publicData,
            }))) {
                throw new mutationCore.DB3MutationAuthorizationError(
                    table.tableName,
                    [sortOrderColumn.member],
                );
            }

            const indexToMove = items.findIndex(item => item[table.pkMember] === args.movingItemId);
            const destinationIndex = items.findIndex(item => item[table.pkMember] === args.newPositionItemId);
            assert(
                indexToMove !== -1 && destinationIndex !== -1,
                `specified items were not found in the same reorder group; movingItemId:${args.movingItemId}, newPositionItemId:${args.newPositionItemId}`,
            );

            if (indexToMove !== destinationIndex) {
                assert(items.length > 1, "can't move items when there's only 1");
            }

            const reorderedItems = moveItemInArray(items, indexToMove, destinationIndex);
            // Reuse this scope's existing numeric slots. This preserves gaps
            // occupied by out-of-scope rows instead of renumbering through
            // hidden or paginated data.
            const sortOrderSlots = createUsableSortOrderSlots(items, sortOrderColumn.member);
            const changes = reorderedItems.flatMap((item, index) => (
                item[sortOrderColumn.member] === sortOrderSlots[index]
                    ? []
                    : [{
                        item,
                        oldSortOrder: item[sortOrderColumn.member] as number,
                        newSortOrder: sortOrderSlots[index]!,
                    }]
            ));

            // Preflight every row before the first write. A bulk reorder is
            // rejected atomically if any shifted row or its sort-order field is
            // outside the actor's authorization envelope.
            changes.forEach(change => {
                const authorization = table.authorizeAndSanitize({
                    clientIntention,
                    contextDesc: `updateSortOrder:${table.tableName}:preflight`,
                    model: { [sortOrderColumn.member]: change.newSortOrder },
                    existingModel: change.item,
                    publicData,
                    rowMode: "update",
                    fallbackOwnerId: null,
                });
                if (!authorization.rowIsAuthorized
                    || authorization.unauthorizedColumnCount > 0
                    || authorization.unknownColumnCount > 0) {
                    throw new mutationCore.DB3MutationAuthorizationError(
                        table.tableName,
                        [sortOrderColumn.member],
                    );
                }
            });

            for (const change of changes) {
                await dbTableClient.update({
                    data: { [sortOrderColumn.member]: change.newSortOrder },
                    where: { [table.pkMember]: change.item[table.pkMember] },
                });
            }

            if (changes.length > 0) {
                await RegisterChange({
                    action: ChangeAction.update,
                    changeContext: CreateChangeContext(`updateSortOrder:${table.tableName}`),
                    table: table.tableName,
                    pkid: 0,
                    oldValues: changes.map(change => ({
                        [table.pkMember]: change.item[table.pkMember],
                        [sortOrderColumn.member]: change.oldSortOrder,
                    })),
                    newValues: changes.map(change => ({
                        [table.pkMember]: change.item[table.pkMember],
                        [sortOrderColumn.member]: change.newSortOrder,
                    })),
                    ctx,
                    db: transactionalDb,
                });
            }
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

        return args;
    },
);
