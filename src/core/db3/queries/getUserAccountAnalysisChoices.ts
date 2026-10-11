import { resolver } from "@blitzjs/rpc";
import db from "db";
import { Permission } from "shared/permissions";
import { cmauthorize } from "src/auth/server/cmResolver";
import { readUserAccountAnalysisChoices } from "../server/userMassAnalysisRead";
import { UserAccountAnalysisChoicesRequestSchema } from "../shared/userMassAnalysisRequest";

export default resolver.pipe(
    resolver.zod(UserAccountAnalysisChoicesRequestSchema),
    cmauthorize({ permission: Permission.sysadmin, requireUser: true }),
    async (_input, ctx) => readUserAccountAnalysisChoices(db, ctx.auth),
);
