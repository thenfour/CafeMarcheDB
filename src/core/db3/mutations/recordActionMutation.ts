// recordActionMutation
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import * as mutationCore from "../server/db3mutationCore";
import { ZTRecordActionArgs } from "../../components/featureReports/activityTracking";
import { createActionRecord } from "../server/recordActionServer";

export default resolver.pipe(
    resolver.zod(ZTRecordActionArgs),
    async (args, ctx: AuthenticatedCtx) => {
        const currentUser = await mutationCore.getCurrentUserCore(ctx);
        await createActionRecord({
            ...args,
            userId: currentUser?.id,
            isClient: true,
        });
    }
);

