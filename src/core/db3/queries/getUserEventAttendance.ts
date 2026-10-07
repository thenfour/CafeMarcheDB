import { resolver } from "@blitzjs/rpc";
import type { Ctx } from "blitz";
import db from "db";
import { GetBandUserEventAttendanceSchema } from "src/auth/schemas";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { readUserAttendanceHistory } from "../server/eventAttendanceRead";

export default resolver.pipe(
    resolver.zod(GetBandUserEventAttendanceSchema),
    async (args, ctx: Ctx) => readUserAttendanceHistory(db, await loadAuthorization(ctx.session, args.bandPublicId), args),
);
