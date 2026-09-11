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
            let user = await tx.user.findFirst({
                select: { id: true, calendarFeedToken: true },
                where: { id: userId, isDeleted: false },
            });
            if (!user) throw new NotFoundError();

            if (!user.calendarFeedToken) {
                const calendarFeedToken = generateCalendarFeedToken();
                const update = await tx.user.updateMany({
                    where: { id: userId, isDeleted: false, calendarFeedToken: null },
                    data: { calendarFeedToken },
                });
                user = await tx.user.findFirst({
                    select: { id: true, calendarFeedToken: true },
                    where: { id: userId, isDeleted: false },
                });
                if (!user?.calendarFeedToken) throw new NotFoundError();

                if (update.count === 1) {
                    await RegisterChange({
                        action: ChangeAction.update,
                        changeContext: CreateChangeContext("createCalendarFeedSubscription"),
                        table: "User",
                        pkid: userId,
                        oldValues: { calendarFeedEnabled: false },
                        newValues: { calendarFeedEnabled: true },
                        ctx,
                        db: tx,
                    });
                }
            }

            return getCalendarFeedSubscriptionInfo(user.calendarFeedToken);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
);
