import { resolver } from "@blitzjs/rpc";
import type { Ctx } from "blitz";
import db from "db";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { listSetlistPlans } from "../server/setlistPlanPersistence";
import { ZListSetlistPlansArgs } from "../shared/setlistPlanApi";

export default resolver.pipe(
    resolver.zod(ZListSetlistPlansArgs),
    async (args, ctx: Ctx) => listSetlistPlans(db, await loadAuthorization(ctx.session, args.bandPublicId), args),
);



