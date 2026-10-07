import { resolver } from "@blitzjs/rpc";
import db from "db";
import type { Ctx } from "blitz";
import { Permission } from "shared/permissions";
import { CalendarBandContextSchema } from "src/core/db3/shared/calendarFeed";
import { requireCalendarFeedOwnerSession, saveCalendarFeedSubscription } from "../server/calendarFeedSubscription";

export default resolver.pipe(
    resolver.authorize(Permission.login),
    resolver.zod(CalendarBandContextSchema),
    async (args, ctx: Ctx) => {
        const userId = requireCalendarFeedOwnerSession(ctx);
        return db.$transaction(transaction => saveCalendarFeedSubscription(transaction, userId, args.bandPublicId, "existing"),
            { isolationLevel: "Serializable" });
    },
);
