import { resolver } from "@blitzjs/rpc";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { UserMergeInput } from "../userMergeSchemas";
import { prepareUserMerge } from "../server/userMerge/prepareUserMerge";
import { publicMergeResponse } from "../server/userMerge/publicResponse";

export default resolver.pipe(
    resolver.zod(UserMergeInput),
    resolver.authorize(Permission.merge_users),
    async (input, ctx) => publicMergeResponse(() => db.$transaction(async tx => {
        const { preview } = await prepareUserMerge(tx, ctx, input);
        return preview;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 })),
);
