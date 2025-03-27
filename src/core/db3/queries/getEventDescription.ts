import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { getEventDescriptionInfoCore } from "src/core/wiki/server/getWikiPageCore";
import { getCurrentUserCore } from "../server/db3mutationCore";
import { GetSoftDeleteWhereExpression, GetUserVisibilityWhereExpression } from "../shared/db3Helpers";

export default resolver.pipe(
    resolver.authorize(Permission.view_events),
    async (args: { eventId: number }, ctx: AuthenticatedCtx) => {

        // authorize
        const currentUser = await getCurrentUserCore(ctx);

        return await db.$transaction(async (dbt) => {
            const event = await dbt.event.findFirst({
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

            return await getEventDescriptionInfoCore({
                event: { id: args.eventId, name: "" },
                clientBaseRevisionId: null,
                clientLockId: null,
                currentUserId: currentUser?.id || null,
                dbt,
            });

        });

    }
);



