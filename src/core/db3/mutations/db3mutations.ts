import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import { Permission } from "shared/permissions";
import db, { Prisma } from "db";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import { validateDB3MutationRequest } from "../server/db3RequestValidation";
import type { TransactionalPrismaClient } from "../shared/apiTypes";
import { getRequestAuthorization } from "@/src/auth/server/requestAuthorization";
import { resolvePublicForeignIds, resolvePublicId, sanitizeDB3ModelForTransport, tableUsesPublicIdsInTransport } from "../server/db3PublicIds";
import type { TAnyModel } from "@/shared/rootroot";

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize(Permission.login) as any, // i think because MutatorInput is a combined type, this fails.
    async (untrustedInput: unknown, ctx: AuthenticatedCtx) => {
        const input = validateDB3MutationRequest(untrustedInput);
        const table = db3.GetTableById(input.tableID);

        // don't add publicId resolution to the inner core functions; do it here at the
        // API boundary

        const requestAuthorization = await getRequestAuthorization(ctx.session);
        const publicData = db3.createDB3Authorization(requestAuthorization.user, requestAuthorization.effectivePermissions);

        if (input.mutationType !== "insert" && !table.authorizeTableForEdit(publicData)) {
            throw new mutationCore.DB3MutationAuthorizationError(table.tableName, [table.pkMember]);
        }

        // simplest approach: wrap all mutations in a transaction. this will run the associated
        // mutations and hooks serially.
        const transactionOptions = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000 };

        return await db.$transaction(async (transactionalDb: TransactionalPrismaClient = db as any) => {

            if (input.mutationType === "delete") {
                const deleteId = "deletePublicId" in input
                    ? await resolvePublicId(table, input.deletePublicId, publicData, transactionalDb, true)
                    : input.deleteId;
                // deleteImpl returns bool; no translation needed back to client.
                return await mutationCore.deleteImpl(table, deleteId, ctx, input.deleteType, transactionalDb);
            }

            if (input.mutationType === "insert") {
                const insertModel = await resolvePublicForeignIds(table, input.insertModel, publicData, transactionalDb);
                const inserted = await mutationCore.insertImpl<TAnyModel>(table, insertModel, ctx, transactionalDb);
                if (!tableUsesPublicIdsInTransport(table)) {
                    return inserted; // no public ID translation needed
                }
                const selectionArgs = await table.CalculateSelectionArgs(publicData, { items: [] });
                const row = await transactionalDb[table.tableName].findFirst({
                    where: { [table.pkMember]: inserted[table.pkMember] },
                    ...selectionArgs,
                });
                return sanitizeDB3ModelForTransport(table, row, publicData, `insertResult:${table.tableName}`);
            }

            const updateId = "updatePublicId" in input
                ? await resolvePublicId(table, input.updatePublicId, publicData, transactionalDb, true)
                : input.updateId;
            const updateModel = await resolvePublicForeignIds(table, input.updateModel, publicData, transactionalDb);

            const updated = (await mutationCore.updateImpl(
                table,
                updateId,
                updateModel,
                ctx,
                transactionalDb,
            )).newModel;

            if (!tableUsesPublicIdsInTransport(table)) {
                return updated; // no public ID translation needed
            }

            const selectionArgs = await table.CalculateSelectionArgs(publicData, { items: [] });
            const row = await transactionalDb[table.tableName].findFirst({
                where: { [table.pkMember]: updateId },
                ...selectionArgs,
            });
            return sanitizeDB3ModelForTransport(table, row, publicData, `updateResult:${table.tableName}`);
        }, transactionOptions);
    }
);
