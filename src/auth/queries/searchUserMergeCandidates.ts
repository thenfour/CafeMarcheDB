import { resolver } from "@blitzjs/rpc";
import db from "db";
import { Permission } from "shared/permissions";
import { SearchUserMergeCandidatesInput } from "../userMergeSchemas";
import { cmauthorize } from "../server/cmResolver";
import { publicMergeResponse } from "../server/userMerge/publicResponse";
import { searchMergeCandidates } from "../server/userMerge/readUserMerge";

export default resolver.pipe(
    resolver.zod(SearchUserMergeCandidatesInput),
    cmauthorize({ permission: Permission.merge_users, requireUser: true }),
    (input, ctx) => publicMergeResponse(() => searchMergeCandidates(db, { authorization: ctx.auth, isImpersonating: ctx.session.$publicData.impersonatingFromUserId != null }, input)),
);
