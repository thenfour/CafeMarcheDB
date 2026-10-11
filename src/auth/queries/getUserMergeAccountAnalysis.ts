import { resolver } from "@blitzjs/rpc";
import db from "db";
import { Permission } from "shared/permissions";
import { MergeAccountAnalysisInput } from "../userMergeSchemas";
import { cmauthorize } from "../server/cmResolver";
import { publicMergeResponse } from "../server/userMerge/publicResponse";
import { readMergeAccountAnalysis } from "../server/userMerge/readUserMerge";

export default resolver.pipe(
    resolver.zod(MergeAccountAnalysisInput),
    cmauthorize({ permission: Permission.merge_users, requireUser: true }),
    (input, ctx) => publicMergeResponse(() => readMergeAccountAnalysis(db, { authorization: ctx.auth, isImpersonating: ctx.session.$publicData.impersonatingFromUserId != null }, input)),
);
