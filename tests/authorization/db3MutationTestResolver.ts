import { resolver } from "@blitzjs/rpc";
import type { TAnyModel } from "@/shared/rootroot";
import { getRequestAuthorization } from "@/src/auth/server/requestAuthorization";
import { Permission } from "shared/permissions";
import type { AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import * as db3 from "src/core/db3/db3";
import * as mutationCore from "src/core/db3/server/db3mutationCore";
import {
    resolvePublicForeignIds,
    resolvePublicId,
    sanitizeDB3ModelForTransport,
    tableUsesPublicIdsInTransport,
} from "src/core/db3/server/db3PublicIds";
import { validateDB3MutationRequest } from "src/core/db3/server/db3RequestValidation";
import type { TransactionalPrismaClient } from "src/core/db3/shared/apiTypes";

/**
 * Test-only compatibility harness for the retired generic DB3 mutation RPC.
 * Authorization tests retain the hostile request shapes that hardened the
 * underlying row services, without publishing this table-selected transport
 * as an application endpoint.
 */
export default resolver.pipe(
    // Blitz cannot infer the discriminated legacy request union through its
    // authorize middleware, while the following stage validates it at runtime.
    resolver.authorize(Permission.login) as any,
    async (untrustedInput: unknown, ctx: AuthenticatedCtx) => {
        const input = validateDB3MutationRequest(untrustedInput);
        const table = db3.GetTableById(input.tableID);
        const requestAuthorization = await getRequestAuthorization(ctx.session);
        const publicData = db3.createDB3Authorization(
            requestAuthorization.user,
            requestAuthorization.effectivePermissions,
        );

        if (input.mutationType !== "insert" && !table.authorizeTableForEdit(publicData)) {
            throw new mutationCore.DB3MutationAuthorizationError(table.tableName, [table.pkMember]);
        }

        const transactionOptions = {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            timeout: 120_000,
        };

        return db.$transaction(async (
            // Test mocks may omit the transaction callback argument; the real
            // Prisma client implements the same operations used by the harness.
            transactionalDb: TransactionalPrismaClient = db as any,
        ) => {
            if (input.mutationType === "delete") {
                const deleteId = "deletePublicId" in input
                    ? await resolvePublicId(
                        table,
                        input.deletePublicId,
                        publicData,
                        transactionalDb,
                        true,
                    )
                    : input.deleteId;
                return mutationCore.deleteImpl(
                    table,
                    deleteId,
                    ctx,
                    input.deleteType,
                    transactionalDb,
                );
            }

            if (input.mutationType === "insert") {
                const insertModel = await resolvePublicForeignIds(
                    table,
                    input.insertModel,
                    publicData,
                    transactionalDb,
                );
                const inserted = await mutationCore.insertImpl<TAnyModel>(
                    table,
                    insertModel,
                    ctx,
                    transactionalDb,
                );
                if (!tableUsesPublicIdsInTransport(table)) return inserted;

                const selectionArgs = await table.CalculateSelectionArgs(publicData, { items: [] });
                const row = await transactionalDb[table.tableName].findFirst({
                    where: { [table.pkMember]: inserted[table.pkMember] },
                    ...selectionArgs,
                });
                return sanitizeDB3ModelForTransport(
                    table,
                    row,
                    publicData,
                    `insertResult:${table.tableName}`,
                );
            }

            const updateId = "updatePublicId" in input
                ? await resolvePublicId(
                    table,
                    input.updatePublicId,
                    publicData,
                    transactionalDb,
                    true,
                )
                : input.updateId;
            const updateModel = await resolvePublicForeignIds(
                table,
                input.updateModel,
                publicData,
                transactionalDb,
            );
            const updated = (await mutationCore.updateImpl(
                table,
                updateId,
                updateModel,
                ctx,
                transactionalDb,
            )).newModel;
            if (!tableUsesPublicIdsInTransport(table)) return updated;

            const selectionArgs = await table.CalculateSelectionArgs(publicData, { items: [] });
            const row = await transactionalDb[table.tableName].findFirst({
                where: { [table.pkMember]: updateId },
                ...selectionArgs,
            });
            return sanitizeDB3ModelForTransport(
                table,
                row,
                publicData,
                `updateResult:${table.tableName}`,
            );
        }, transactionOptions);
    },
);
