// recordActionMutation
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { ZTRecordActionArgs } from "../../components/featureReports/activityTracking";
import { recordAuthenticatedClientAction } from "../server/recordActionServer";

export default resolver.pipe(
    resolver.zod(ZTRecordActionArgs),
    async (args, ctx: AuthenticatedCtx) => {
        await recordAuthenticatedClientAction(args, await loadAuthorization(ctx.session));
    }
);

