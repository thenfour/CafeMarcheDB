import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import { Permission } from "shared/permissions";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize(Permission.login) as any, // i think because MutatorInput is a combined type, this fails.
    async (input: db3.MutatorInput, ctx: AuthenticatedCtx) => {
        const table = db3.GetTableById(input.tableID);

        const currentUser = await mutationCore.getCurrentUserCore(ctx);
        input.clientIntention = input.clientIntention || { intention: "user", mode: "primary" };
        input.clientIntention.currentUser = currentUser;

        if (input.mutationType === "delete") {
            // return boolean
            return await mutationCore.deleteImpl(table, input.deleteId, ctx, input.clientIntention, input.deleteType);
        }
        if (input.mutationType === "insert") {
            // return new object
            return await mutationCore.insertImpl(table, input.insertModel, ctx, input.clientIntention);
        }
        if (input.mutationType === "update") {
            // return new object
            //debugger;
            return (await mutationCore.updateImpl(table, input.updateId!, input.updateModel, ctx, input.clientIntention)).newModel;
        }
        return false;
    }
);

