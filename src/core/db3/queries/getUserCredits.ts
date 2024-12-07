import { resolver } from "@blitzjs/rpc";
import { assert, AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { getCurrentUserCore } from "../server/db3mutationCore";
import { GetFilteredSongsItemSongSelect, GetFilteredSongsRet } from "../shared/apiTypes";
import { ZGetUserEventAttendanceArgrs } from "src/auth/schemas";

// type UserGetCreditsQueryResult = {
//     songs: UserGetCreditsQueryResult_Song[];
//     wikiPages: UserGetCreditsQueryResult_WikiPage[];
//     filesUploaded: UserGetCreditsQueryResult_FileUploaded[];
//     eventsCreated: UserGetCreditsQueryResult_EventCreated[];
// };

export default resolver.pipe(
    resolver.authorize(Permission.view_events_nonpublic),
    resolver.zod(ZGetUserEventAttendanceArgrs),
    async (args, ctx: AuthenticatedCtx): Promise<null> => {
        try {
            return null;
        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);



