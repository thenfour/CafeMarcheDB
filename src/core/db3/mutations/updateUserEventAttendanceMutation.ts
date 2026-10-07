import { resolver } from "@blitzjs/rpc";
import type { Ctx } from "blitz";
import db from "db";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { updateEventAttendance } from "../server/eventAttendanceWrite";
import { ZupdateUserEventAttendanceMutationArgs } from "../shared/apiTypes";

export { EventAttendanceAuthorizationError } from "../server/eventAttendanceWrite";

export default resolver.pipe(
    resolver.zod(ZupdateUserEventAttendanceMutationArgs),
    async (args, ctx: Ctx) => updateEventAttendance(db, await loadAuthorization(ctx.session, args.bandPublicId), args),
);
