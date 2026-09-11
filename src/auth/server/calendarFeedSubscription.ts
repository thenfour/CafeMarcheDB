import { generateToken, hash256 } from "@blitzjs/auth";
import type { Ctx } from "@blitzjs/next";
import db from "db";
import { ServerApi } from "src/server/serverApi";
import { GetICalRelativeURIForUserUpcomingEvents } from "src/core/db3/shared/apiTypes";
import { UserForCalBackendArgs } from "src/core/db3/shared/schema/prismArgs";

export class CalendarFeedAuthorizationError extends Error {
    name = "CalendarFeedAuthorizationError";
    statusCode = 403;
}

export class CalendarFeedNotFoundError extends Error {
    name = "CalendarFeedNotFoundError";
    statusCode = 404;
}

export interface CalendarFeedSubscriptionInfo {
    subscriptionUrl: string;
    webcalUrl: string;
}

const calendarFeedTokenPattern = /^[a-f0-9]{40,64}$/i;

export const generateCalendarFeedToken = (): string => hash256(generateToken()).toLowerCase();

export const isCalendarFeedToken = (value: string): boolean => calendarFeedTokenPattern.test(value);

// because the cal feed involves a secret personal access token that persits
// outside of the immediate session, only allow the original owner to access it.
// when releasing impersonation, basically access to the user should cease immediately,
// and cal tokens don't do that.
export const requireCalendarFeedOwnerSession = (ctx: Ctx): number => {
    const userId = ctx.session.userId;
    if (!userId || ctx.session.$publicData.impersonatingFromUserId != null) {
        throw new CalendarFeedAuthorizationError(
            "Calendar subscription links are available only to the signed-in account owner.",
        );
    }
    return userId;
};

export const getCalendarFeedSubscriptionInfo = (
    calendarFeedToken: string,
): CalendarFeedSubscriptionInfo => {
    const subscriptionUrl = ServerApi.getAbsoluteUri(
        GetICalRelativeURIForUserUpcomingEvents({ calendarFeedToken }),
    );
    return {
        subscriptionUrl,
        webcalUrl: subscriptionUrl.replace(/^https?:\/\//i, "webcal://"),
    };
};

export const resolveActiveCalendarFeedUser = async (calendarFeedToken: string) => {
    if (!isCalendarFeedToken(calendarFeedToken)) {
        throw new CalendarFeedNotFoundError("Calendar feed not found.");
    }

    const user = await db.user.findFirst({
        ...UserForCalBackendArgs,
        where: {
            calendarFeedToken,
            isDeleted: false,
        },
    });
    if (!user) throw new CalendarFeedNotFoundError("Calendar feed not found.");
    return user;
};

// Public access is deliberately opt-in via the stable literal route. Any other
// missing or unknown bearer credential must fail closed instead of silently
// receiving the public calendar.
export const resolveCalendarFeedRequestUser = async (calendarFeedToken: string) => {
    if (calendarFeedToken === "public") return null;
    return resolveActiveCalendarFeedUser(calendarFeedToken);
};
