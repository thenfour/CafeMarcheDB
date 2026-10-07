import { resolver } from "@blitzjs/rpc";
import db from "db";
import type { Ctx } from "blitz";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { BandPublicIdSchema, PresentationInputSchema } from "src/locale/shared/presentationInput";
import { isPublicId, type UserTagPublicId } from "shared/publicId";
import { z } from "zod";
import * as db3 from "../db3";
import { queryView } from "../server/db3QueryCore";

const ZInp = PresentationInputSchema.extend({
    bandPublicId: BandPublicIdSchema,
    userTagIds: z.array(z.custom<UserTagPublicId>(isPublicId)),
});

export default resolver.pipe(
    resolver.zod(ZInp),
    async (args, ctx: Ctx) => {
        const authorization = await loadAuthorization(ctx.session, args.bandPublicId);
        const result = await queryView({
            cmdbQueryContext: "getUserTagWithAssignments",
            view: db3.userTagEventSearchView,
            ...args,
            filter: {
                tableParams: { ids: args.userTagIds },
            },
            orderBy: undefined,
        }, authorization, db);
        return result.items;
    }
);



