import { resolver } from "@blitzjs/rpc";
import db from "db";
import { Permission } from "shared/permissions";
import { CommitUserMergeInput } from "../userMergeSchemas";
import { commitUserMerge } from "../server/userMerge/commitUserMerge";
import { publicMergeResponse } from "../server/userMerge/publicResponse";

export default resolver.pipe(
    resolver.zod(CommitUserMergeInput),
    resolver.authorize(Permission.merge_users),
    (input, ctx) => publicMergeResponse(() => commitUserMerge(db, ctx, input)),
);
