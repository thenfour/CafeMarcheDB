// based off the structure/logic of getEventFilterInfo
// this basically is used only by UserChip in case it needs to resolve info

import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import { z } from "zod";
import { DB3QueryCore } from "../server/db3QueryCore";
import { xUser } from "../db3";
import type { UserPublicId } from "shared/publicId";
import { DB3PublicIdError } from "../server/db3PublicIds";

export default resolver.pipe(
    resolver.zod(z.object({ userId: xUser.identitySchema }).strict()),
    async (args, ctx: AuthenticatedCtx): Promise<{ publicId: UserPublicId; name: string } | null> => {
        let result;
        try {
            // TODO: use db3 views to handle authorization / sanitization.
            result = await DB3QueryCore({
                table: xUser,
                orderBy: undefined,
                filter: {
                    tableParams: { userId: args.userId },
                },
                take: 1,
                cmdbQueryContext: "getUser",
            }, ctx);
        } catch (error) {
            if (error instanceof DB3PublicIdError) return null;
            throw error;
        }
        const user = result.items[0];
        return user ? { publicId: xUser.parseIdentity(user.publicId), name: user.name } : null;
    }
);
