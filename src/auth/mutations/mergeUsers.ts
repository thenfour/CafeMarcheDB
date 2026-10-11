import { resolver } from "@blitzjs/rpc";
import db from "db";
import { Permission } from "shared/permissions";
import { CommitUserMergeInput } from "../userMergeSchemas";
import { cmauthorize } from "../server/cmResolver";
import { publicMergeResponse } from "../server/userMerge/publicResponse";
import { commitUserMerge } from "../server/userMerge/commitUserMerge";

export default resolver.pipe(
    resolver.zod(CommitUserMergeInput),
    cmauthorize({ permission: Permission.merge_users, requireUser: true }),
    (input, ctx) => publicMergeResponse(() => commitUserMerge(db, { authorization: ctx.auth, isImpersonating: ctx.session.$publicData.impersonatingFromUserId != null }, input)),
);
