import { resolver } from "@blitzjs/rpc";
import type { Ctx } from "blitz";
import db from "db";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { copyEventSegmentResponses } from "../server/eventAttendanceBulk";
import { CopyEventSegmentResponsesSchema } from "../shared/eventAttendanceBulk";

export default resolver.pipe(
    resolver.zod(CopyEventSegmentResponsesSchema),
    async (args, ctx: Ctx) => copyEventSegmentResponses(db, await loadAuthorization(ctx.session, args.bandPublicId), args),
);
