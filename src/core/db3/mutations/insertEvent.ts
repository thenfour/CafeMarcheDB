import { resolver } from "@blitzjs/rpc";
import type { Ctx } from "blitz";
import db from "db";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { insertEvent } from "../server/eventCreation";
import { ZinsertEventArgs } from "../shared/apiTypes";

export default resolver.pipe(
    resolver.zod(ZinsertEventArgs),
    async (args, ctx: Ctx) => insertEvent(db, await loadAuthorization(ctx.session, args.bandPublicId), args),
);
