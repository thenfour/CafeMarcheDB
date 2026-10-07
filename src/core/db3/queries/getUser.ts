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


// MIGRATION_RESTORE: directory-search
// Source: 1768352278c2ac37768c8bd2c2cc0ad5ffd4324a:src/core/db3/queries/getUser.ts:1-35
// Reason: The membership directory replaces the old user search with a smaller feature set.
// Restore: Restore multi-value filter operators, presets, URL state, contact search policy, and CSV export for the selected band.
// Verification: Test filter combinations, permission restrictions, pagination, URL round trips, and exported rows; exercise the built directory.
// SHA256: 1575fc4a34af503db0daac3ae2f2202cc7283765c55e489194fce9f9cae806f1
// MIGRATION_REFERENCE_BEGIN
// // based off the structure/logic of getEventFilterInfo
// // this basically is used only by UserChip in case it needs to resolve info
//
// import { resolver } from "@blitzjs/rpc";
// import { AuthenticatedCtx } from "blitz";
// import { z } from "zod";
// import { queryTable } from "../server/db3QueryCore";
// import { loadAuthorization } from "src/auth/server/serverAuthorization";
// import { xUser } from "../db3";
// import type { UserPublicId } from "shared/publicId";
// import { DB3PublicIdError } from "../server/db3PublicIds";
//
// export default resolver.pipe(
//     resolver.zod(z.object({ userId: xUser.identitySchema }).strict()),
//     async (args, ctx: AuthenticatedCtx): Promise<{ publicId: UserPublicId; name: string } | null> => {
//         let result;
//         try {
//             // TODO: use db3 views to handle authorization / sanitization.
//             result = await queryTable({
//                 table: xUser,
//                 orderBy: undefined,
//                 filter: {
//                     tableParams: { userId: args.userId },
//                 },
//                 take: 1,
//                 cmdbQueryContext: "getUser",
//             }, await loadAuthorization(ctx.session));
//         } catch (error) {
//             if (error instanceof DB3PublicIdError) return null;
//             throw error;
//         }
//         const user = result.items[0];
//         return user ? { publicId: xUser.parseIdentity(user.publicId), name: user.name } : null;
//     }
// );
// MIGRATION_REFERENCE_END
