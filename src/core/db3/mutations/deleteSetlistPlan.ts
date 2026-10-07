import { resolver } from "@blitzjs/rpc";
import type { Ctx } from "blitz";
import db from "db";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { deleteSetlistPlan } from "../server/setlistPlanPersistence";
import { ZDeleteSetlistPlanArgs } from "../shared/setlistPlanApi";

export default resolver.pipe(
    resolver.zod(ZDeleteSetlistPlanArgs),
    async (args, ctx: Ctx) => deleteSetlistPlan(db, await loadAuthorization(ctx.session, args.bandPublicId), args),
);

