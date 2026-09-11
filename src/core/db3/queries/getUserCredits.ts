import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { ZGetUserEventAttendanceArgrs } from "src/auth/schemas";
import { getCurrentUserCore } from "../server/db3mutationCore";
import { GetAuthorizedTableReadWhere } from "../server/db3ReadPolicy";
import { xSong } from "../shared/schema/song";

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
            const currentUser = await getCurrentUserCore(ctx);
            if (!currentUser) throw new Error("Current user was not found.");
            const songWhere = await GetAuthorizedTableReadWhere({
                table: xSong,
                currentUser,
            });

            const songCredits = await db.songCredit.findMany({
                where: {
                    userId: args.userId,
                    song: songWhere,
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



