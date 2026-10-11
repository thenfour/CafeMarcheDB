import { resolver } from "@blitzjs/rpc";
import type { TAnyModel } from "@/shared/rootroot";
import { loadAuthorization } from "@/src/auth/server/serverAuthorization";
import { Permission } from "shared/permissions";
import type { Ctx } from "blitz";
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
import { BandPublicIdSchema } from "src/locale/shared/presentationInput";
import { z } from "zod";

/**
 * Test-only compatibility harness for the retired generic DB3 mutation RPC.
 * Authorization tests retain the hostile request shapes that hardened the
 * underlying row services, without publishing this table-selected transport
 * as an application endpoint.
 */
export default resolver.pipe(
    async (untrustedInput: unknown, ctx: Ctx) => {
        // Band context belongs to this test envelope, not the retired mutation transport.
        const { bandPublicId, ...request } = z.object({ bandPublicId: BandPublicIdSchema.nullish() }).passthrough().parse(untrustedInput);
        const input = validateDB3MutationRequest(request);
        const table = db3.GetTableById(input.tableID);
        const publicData = await loadAuthorization(ctx.session, bandPublicId);
        publicData.requirePermission(Permission.login);

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
                    publicData,
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
                    publicData,
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
                publicData,
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
