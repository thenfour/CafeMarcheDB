import { resolver } from "@blitzjs/rpc";
import type { Ctx } from "blitz";
import db from "db";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { reorderSetlistPlans } from "../server/setlistPlanPersistence";
import { ZReorderSetlistPlansArgs } from "../shared/setlistPlanApi";

export default resolver.pipe(
    resolver.zod(ZReorderSetlistPlansArgs),
    async (args, ctx: Ctx) => reorderSetlistPlans(db, await loadAuthorization(ctx.session, args.bandPublicId), args),
);
