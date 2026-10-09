import { resolver } from "@blitzjs/rpc";
import type { Ctx } from "blitz";
import db from "db";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { EventStatisticsInputSchema } from "../shared/entities/event/eventStatistics";
import { readEventStatistics } from "../server/eventStatistics";

export default resolver.pipe(async (input: unknown, ctx: Ctx) => {
    const args = EventStatisticsInputSchema.parse(input);
    const auth = await loadAuthorization(ctx.session, args.bandPublicId);
    return readEventStatistics(db, auth, args);
});
