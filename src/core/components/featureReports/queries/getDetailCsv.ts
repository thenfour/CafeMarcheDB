import { resolver } from "@blitzjs/rpc";
import type { Ctx } from "blitz";
import db from "db";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { FacetedBreakdownInputSchema } from "../activityReportTypes";
import { readActivityCsv } from "../server/activityCsv";

export default resolver.pipe(async (input: unknown, ctx: Ctx) => {
    const args = FacetedBreakdownInputSchema.parse(input);
    const auth = await loadAuthorization(ctx.session, args.bandPublicId);
    return readActivityCsv(db, auth, args);
});
