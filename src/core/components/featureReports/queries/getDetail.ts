import { resolver } from "@blitzjs/rpc";
import type { Ctx } from "blitz";
import db from "db";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { ActivityDetailInputSchema } from "../activityReportTypes";
import { readActivityDetails } from "../server/activityDetails";

export default resolver.pipe(async (input: unknown, ctx: Ctx) => {
    const args = ActivityDetailInputSchema.parse(input);
    const auth = await loadAuthorization(ctx.session, args.bandPublicId);
    return readActivityDetails(db, auth, args);
});
