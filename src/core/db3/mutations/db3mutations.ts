import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import { Permission } from "shared/permissions";
import db, { Prisma } from "db";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import { validateDB3MutationRequest } from "../server/db3RequestValidation";
import type { TransactionalPrismaClient } from "../shared/apiTypes";

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize(Permission.login) as any, // i think because MutatorInput is a combined type, this fails.
    async (untrustedInput: unknown, ctx: AuthenticatedCtx) => {
        const input = validateDB3MutationRequest(untrustedInput);
        const table = db3.GetTableById(input.tableID);

        // simplest approach: wrap all mutations in a transaction. this will run the associated
        // mutations and hooks serially.
        const transactionOptions = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000 };

        return await db.$transaction(async (transactionalDb: TransactionalPrismaClient = db as any) => {
            if (input.mutationType === "delete") {
                return await mutationCore.deleteImpl(table, input.deleteId, ctx, input.deleteType, transactionalDb);
            }
            if (input.mutationType === "insert") {
                return await mutationCore.insertImpl(table, input.insertModel, ctx, transactionalDb);
            }
            return (await mutationCore.updateImpl(
                table,
                input.updateId!,
                input.updateModel,
                ctx,
                transactionalDb,
            )).newModel;
        }, transactionOptions);
    }
);
