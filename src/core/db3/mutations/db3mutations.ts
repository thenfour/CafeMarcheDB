import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import { Permission } from "shared/permissions";
import db from "db";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import { deriveDB3ClientIntention, populateDB3AuthorizationPermissions, validateDB3MutationRequest } from "../server/db3RequestValidation";
import type { TransactionalPrismaClient } from "../shared/apiTypes";

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize(Permission.login) as any, // i think because MutatorInput is a combined type, this fails.
    async (untrustedInput: unknown, ctx: AuthenticatedCtx) => {
        const input = validateDB3MutationRequest(untrustedInput);
        const table = db3.GetTableById(input.tableID);

        const currentUser = await mutationCore.getCurrentUserCore(ctx);
        const clientIntention = await populateDB3AuthorizationPermissions(
            db,
            deriveDB3ClientIntention("mutation", currentUser),
        );

        const execute = async (transactionalDb: TransactionalPrismaClient = db as any) => {
            if (input.mutationType === "delete") {
                return await mutationCore.deleteImpl(table, input.deleteId, ctx, clientIntention, input.deleteType, transactionalDb);
            }
            if (input.mutationType === "insert") {
                return await mutationCore.insertImpl(table, input.insertModel, ctx, clientIntention, transactionalDb);
            }
            return (await mutationCore.updateImpl(
                table,
                input.updateId!,
                input.updateModel,
                ctx,
                clientIntention,
                transactionalDb,
            )).newModel;
        };

        return table.requiresTransactionalMutation
            ? db.$transaction(tx => execute(tx))
            : execute();
    }
);
