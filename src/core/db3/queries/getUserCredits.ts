import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import { Permission } from "shared/permissions";
import { ZGetUserEventAttendanceArgrs } from "src/auth/schemas";
import { getRequestAuthorization } from "@/src/auth/server/requestAuthorization";
import * as db3 from "../db3";
import { queryView } from "../server/db3QueryCore";

// type UserGetCreditsQueryResult = {
//     songs: UserGetCreditsQueryResult_Song[];
//     wikiPages: UserGetCreditsQueryResult_WikiPage[];
//     filesUploaded: UserGetCreditsQueryResult_FileUploaded[];
//     eventsCreated: UserGetCreditsQueryResult_EventCreated[];
// };

export default resolver.pipe(
    resolver.authorize(Permission.manage_users), // ?
    resolver.zod(ZGetUserEventAttendanceArgrs),
    async (args, ctx: AuthenticatedCtx) => {
        const authorization = await getRequestAuthorization(ctx.session);
        const result = await queryView({
            cmdbQueryContext: "getUserCredits",
            view: db3.songCreditUserView,
            filter: {
                tableParams: {
                    userId: args.userId,
                },
            },
            orderBy: undefined,
            take: args.take,
        }, authorization);

        return {
            songCredits: result.items,
        };
    }
);



