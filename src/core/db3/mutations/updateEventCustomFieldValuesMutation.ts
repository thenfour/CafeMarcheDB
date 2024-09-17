// updateEventCustomFieldValuesMutation
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import { TupdateEventCustomFieldValuesArgs } from "../shared/apiTypes";
import { CreateChangeContext } from "shared/utils";




// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize(Permission.manage_events),
    async (args: TupdateEventCustomFieldValuesArgs, ctx: AuthenticatedCtx) => {

        if (!args.eventId) {
            throw new Error(`can't update event custom fields without a pk`);
        }

        const currentUser = (await mutationCore.getCurrentUserCore(ctx))!;

        const clientIntention: db3.xTableClientUsageContext = {
            intention: "user",
            mode: "primary",
            currentUser,
        };

        const changeContext = CreateChangeContext(`updateEventCustomFieldValuesMutation`);

        await mutationCore.UpdateEventCustomFieldValues(changeContext, ctx, args);

        return args;
    }
);

