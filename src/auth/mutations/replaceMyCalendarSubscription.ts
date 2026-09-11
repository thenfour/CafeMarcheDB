import { resolver } from "@blitzjs/rpc";
import { NotFoundError } from "blitz";
import db, { Prisma } from "db";
import {
    ChangeAction,
    CreateChangeContext,
    RegisterChange,
} from "shared/activityLog";
import { Permission } from "shared/permissions";
import {
    generateCalendarFeedToken,
    getCalendarFeedSubscriptionInfo,
    requireCalendarFeedOwnerSession,
} from "../server/calendarFeedSubscription";

export default resolver.pipe(
    resolver.authorize(Permission.login),
    async (_input, ctx) => db.$transaction(
        async tx => {
            const userId = requireCalendarFeedOwnerSession(ctx);
            const user = await tx.user.findFirst({
                select: { id: true },
                where: { id: userId, isDeleted: false },
            });
            if (!user) throw new NotFoundError();

            const calendarFeedToken = generateCalendarFeedToken();
            await tx.user.update({
                where: { id: userId },
                data: { calendarFeedToken },
            });
            await RegisterChange({
                action: ChangeAction.update,
                changeContext: CreateChangeContext("replaceCalendarFeedSubscription"),
                table: "User",
                pkid: userId,
                oldValues: { calendarFeedLinkReplaced: false },
                newValues: { calendarFeedLinkReplaced: true },
                ctx,
                db: tx,
            });

            return getCalendarFeedSubscriptionInfo(calendarFeedToken);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
);
