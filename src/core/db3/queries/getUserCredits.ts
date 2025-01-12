import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { ZGetUserEventAttendanceArgrs } from "src/auth/schemas";

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
        try {

            const songCredits = await db.songCredit.findMany({
                where: {
                    userId: args.userId,
                },
            });

            return {
                songCredits,
            };
        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);



