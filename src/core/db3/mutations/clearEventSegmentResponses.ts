import { resolver } from "@blitzjs/rpc";
import type { Ctx } from "blitz";
import db from "db";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { clearEventSegmentResponses } from "../server/eventAttendanceBulk";
import { ClearEventSegmentResponsesSchema } from "../shared/eventAttendanceBulk";

export default resolver.pipe(
    resolver.zod(ClearEventSegmentResponsesSchema),
    async (args, ctx: Ctx) => clearEventSegmentResponses(db, await loadAuthorization(ctx.session, args.bandPublicId), args),
);
