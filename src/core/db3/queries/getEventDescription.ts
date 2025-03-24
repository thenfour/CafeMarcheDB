import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { getCurrentUserCore } from "../server/db3mutationCore";
import { GetSoftDeleteWhereExpression, GetUserVisibilityWhereExpression } from "../shared/db3Helpers";
import { getEventDescriptionInfoCore } from "../server/getWikiPageCore";
//import { getEventDescriptionInfoCore } from "../server/serverEventUtils";

export default resolver.pipe(
    resolver.authorize(Permission.view_events),
    async (args: { eventId: number }, ctx: AuthenticatedCtx) => {

        // authorize
        const currentUser = await getCurrentUserCore(ctx);
        const event = await db.event.findFirst({
            where:
            {
                AND: [
                    { id: args.eventId },
                    await GetSoftDeleteWhereExpression(),
                    await GetUserVisibilityWhereExpression(currentUser),
                ]
            }
        });
        if (!event) {
            throw new Error("Event not found");
        }

        return await getEventDescriptionInfoCore({ id: args.eventId, name: "" });
    }
);



