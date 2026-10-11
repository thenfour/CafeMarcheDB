import { resolver } from "@blitzjs/rpc";
import db from "db";
import { Permission } from "shared/permissions";
import { PreviewUserMergeInput } from "../userMergeSchemas";
import { cmauthorize } from "../server/cmResolver";
import { publicMergeResponse } from "../server/userMerge/publicResponse";
import { previewMerge } from "../server/userMerge/readUserMerge";

export default resolver.pipe(
    resolver.zod(PreviewUserMergeInput),
    cmauthorize({ permission: Permission.merge_users, requireUser: true }),
    (input, ctx) => publicMergeResponse(() => previewMerge(db, { authorization: ctx.auth, isImpersonating: ctx.session.$publicData.impersonatingFromUserId != null }, input)),
);
