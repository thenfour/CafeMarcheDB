import { cmauthorize, type CMAuthCtx } from "@/src/auth/server/cmResolver";
import { resolver } from "@blitzjs/rpc";
import { Permission } from "shared/permissions";
import { isPublicId, type UserTagPublicId } from "shared/publicId";
import { z } from "zod";
import * as db3 from "../db3";
import { queryView } from "../server/db3QueryCore";

const ZInp = z.object({
    userTagIds: z.array(z.custom<UserTagPublicId>(isPublicId)),
});

export default resolver.pipe(
    cmauthorize(Permission.public),
    resolver.zod(ZInp),
    async (args, ctx: CMAuthCtx) => {
        const authorization = ctx.auth;
        const result = await queryView({
            cmdbQueryContext: "getUserTagWithAssignments",
            view: db3.userTagEventSearchView,
            filter: {
                tableParams: { ids: args.userTagIds },
            },
            orderBy: undefined,
        }, authorization);
        return result.items;
    }
);



