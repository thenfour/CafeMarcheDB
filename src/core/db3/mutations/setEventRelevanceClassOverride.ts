import { resolver } from "@blitzjs/rpc";
import type { Ctx } from "blitz";
import db from "db";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { SetEventRelevanceSchema, setEventRelevance } from "../server/eventEditing";

export default resolver.pipe(
    resolver.zod(SetEventRelevanceSchema),
    async (args, ctx: Ctx) => setEventRelevance(db, await loadAuthorization(ctx.session, args.bandPublicId), args),
);
