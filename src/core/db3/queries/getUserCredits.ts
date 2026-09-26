import { resolver, type CMCtx } from "@/src/auth/server/cmResolver";
import { Permission } from "shared/permissions";
import { ZGetUserEventAttendanceArgrs } from "src/auth/schemas";
import * as db3 from "../db3";
import { queryView } from "../server/db3QueryCore";

// type UserGetCreditsQueryResult = {
//     songs: UserGetCreditsQueryResult_Song[];
//     wikiPages: UserGetCreditsQueryResult_WikiPage[];
//     filesUploaded: UserGetCreditsQueryResult_FileUploaded[];
//     eventsCreated: UserGetCreditsQueryResult_EventCreated[];
// };

export default resolver.pipe(
    resolver.cmauthorize(Permission.manage_users), // ?
    resolver.zod(ZGetUserEventAttendanceArgrs),
    async (args, ctx: CMCtx) => {
        const authorization = ctx.auth;
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



