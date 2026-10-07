import { resolver } from "@blitzjs/rpc";
import type { Ctx } from "blitz";
import db from "db";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { saveSetlistPlan } from "../server/setlistPlanPersistence";
import { ZSaveSetlistPlanArgs } from "../shared/setlistPlanApi";

export default resolver.pipe(
    resolver.zod(ZSaveSetlistPlanArgs),
    async (args, ctx: Ctx) => saveSetlistPlan(db, await loadAuthorization(ctx.session, args.bandPublicId), args),
);
