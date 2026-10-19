import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import { AuthorizationError, NotFoundError } from "blitz";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { memberSongCreditView } from "../shared/entities/song/songViews";
import { bandUserIdentityView } from "../shared/entities/user/bandUserProfile";
import { MemberSongCreditsInputSchema, type MemberSongCreditsInput } from "../shared/entities/user/memberSongCredits";
import { executeDB3Read, type DB3ReadDatabase } from "./db3ReadExecution";
import { queryView } from "./db3QueryCore";

export function readMemberSongCredits(database: DB3ReadDatabase, authorization: CMServerAuthorization, input: MemberSongCreditsInput) {
    const args = MemberSongCreditsInputSchema.parse(input);
    const { bandPublicId, routeLocale, browserLanguages, clientRequestId } = args;
    const presentation = { bandPublicId, routeLocale, browserLanguages, clientRequestId };
    return executeDB3Read(database, authorization, async context => {
        const auth = context.authorization.requireUser();
        if (auth.requireBand().publicId !== bandPublicId) {
            throw new AuthorizationError("Member credits require the selected band.");
        }
        auth.requirePermission(BandPermission.manage_users);
        const member = await queryView(
            {
                view: bandUserIdentityView,
                ...presentation,
                filter: { tableParams: { personPublicId: args.userId } },
                take: 1,
                cmdbQueryContext: "member credits owner"
            },
            auth,
            context
        );
        if (!member.items.length) {
            throw new NotFoundError();
        }
        const credits = await queryView(
            {
                view: memberSongCreditView,
                ...presentation,
                filter: { tableParams: { userId: args.userId } },
                take: args.take,
                cmdbQueryContext: "member song credits"
            },
            auth,
            context
        );
        return { songCredits: credits.items };
    });
}
