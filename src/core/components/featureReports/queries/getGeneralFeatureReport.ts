import { resolver } from "@blitzjs/rpc";
import type { Ctx } from "blitz";
import db from "db";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { GeneralFeatureReportInputSchema } from "../activityReportTypes";
import { readActivityTimeline } from "../server/activityTimeline";

export default resolver.pipe(async (input: unknown, ctx: Ctx) => {
    const args = GeneralFeatureReportInputSchema.parse(input);
    const auth = await loadAuthorization(ctx.session, args.bandPublicId);
    return readActivityTimeline(db, auth, args);
});
