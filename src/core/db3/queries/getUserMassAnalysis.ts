import { resolver } from "@blitzjs/rpc";
import db from "db";
import { Permission } from "shared/permissions";
import { cmauthorize } from "src/auth/server/cmResolver";
import { readUserMassAnalysis } from "../server/userMassAnalysisRead";
import { UserMassAnalysisRequestSchema } from "../shared/userMassAnalysisRequest";

export default resolver.pipe(
    resolver.zod(UserMassAnalysisRequestSchema),
    cmauthorize({ permission: Permission.sysadmin, requireUser: true }),
    async ({ userId, ...locale }, ctx) => readUserMassAnalysis(db, ctx.auth, userId, locale),
);
