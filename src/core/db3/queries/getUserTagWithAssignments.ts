import { resolver, type CMCtx } from "@/src/auth/server/cmResolver";
import { Permission } from "shared/permissions";
import { isPublicId, type UserTagPublicId } from "shared/publicId";
import { z } from "zod";
import * as db3 from "../db3";
import { queryView } from "../server/db3QueryCore";

const ZInp = z.object({
    userTagIds: z.array(z.custom<UserTagPublicId>(isPublicId)),
});

export default resolver.pipe(
    resolver.cmauthorize(Permission.public),
    resolver.zod(ZInp),
    async (args, ctx: CMCtx) => {
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



