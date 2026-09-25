import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import { Permission } from "shared/permissions";
import { isPublicId, type UserTagPublicId } from "shared/publicId";
import { z } from "zod";
import { getRequestAuthorization } from "@/src/auth/server/requestAuthorization";
import * as db3 from "../db3";
import { queryView } from "../server/db3QueryCore";

const ZInp = z.object({
    userTagIds: z.array(z.custom<UserTagPublicId>(isPublicId)),
});

export default resolver.pipe(
    resolver.authorize(Permission.public),
    resolver.zod(ZInp),
    async (args, ctx: AuthenticatedCtx) => {
        const authorization = await getRequestAuthorization(ctx.session);
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



