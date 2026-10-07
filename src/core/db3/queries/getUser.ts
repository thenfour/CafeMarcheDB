// this basically is used only by UserChip in case it needs to resolve info

import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import { queryView } from "../server/db3QueryCore";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { xUserMinimum } from "../shared/schema/user";
import type { UserPublicId } from "shared/publicId";
import { bandUserIdentityView } from "../shared/entities/user/bandUserProfile";
import { PresentationInputSchema } from "src/locale/shared/presentationInput";

export default resolver.pipe(
    resolver.zod(PresentationInputSchema.extend({ userId: xUserMinimum.identitySchema }).strict()),
    async (args, ctx: AuthenticatedCtx): Promise<{ publicId: UserPublicId; name: string } | null> => {
        if (!args.bandPublicId) {
            return null;
        }
        const { userId, ...context } = args;
        const auth = await loadAuthorization(ctx.session, args.bandPublicId);
        const result = await queryView({
            view: bandUserIdentityView,
            ...context,
            filter: { tableParams: { personPublicId: userId } },
            take: 1,
            cmdbQueryContext: "user chip membership",
        }, auth);
        const user = result.items[0]?.user;
        return user?.name !== undefined ? { publicId: user.publicId, name: user.name } : null;
    }
);
