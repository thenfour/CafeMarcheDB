import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import { Permission } from "shared/permissions";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import { deriveDB3ClientIntention, validateDB3MutationRequest } from "../server/db3RequestValidation";

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize(Permission.login) as any, // i think because MutatorInput is a combined type, this fails.
    async (untrustedInput: unknown, ctx: AuthenticatedCtx) => {
        const input = validateDB3MutationRequest(untrustedInput);
        const table = db3.GetTableById(input.tableID);

        const currentUser = await mutationCore.getCurrentUserCore(ctx);
        const clientIntention = deriveDB3ClientIntention("mutation", currentUser);

        if (input.mutationType === "delete") {
            // return boolean
            return await mutationCore.deleteImpl(table, input.deleteId, ctx, clientIntention, input.deleteType);
        }
        if (input.mutationType === "insert") {
            // return new object
            return await mutationCore.insertImpl(table, input.insertModel, ctx, clientIntention);
        }
        if (input.mutationType === "update") {
            // return new object
            //debugger;
            return (await mutationCore.updateImpl(table, input.updateId!, input.updateModel, ctx, clientIntention)).newModel;
        }
        return false;
    }
);

