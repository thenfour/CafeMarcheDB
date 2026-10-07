import { generateToken, hash256 } from "@blitzjs/auth";
import type { Ctx } from "@blitzjs/next";
import type { Prisma } from "@prisma/client";
import db from "db";
import { NotFoundError } from "blitz";
import type { BandPublicId } from "shared/publicId";
import { ServerApi } from "src/server/serverApi";
import { GetICalRelativeURIForUserUpcomingEvents } from "src/core/db3/shared/apiTypes";
import { UserForCalBackendArgs } from "src/core/db3/shared/schema/prismArgs";
import { ChangeAction, CreateChangeContext, RegisterChange } from "./activityLog";
import { loadAuthorizationForUser } from "./serverAuthorization";
import { requireAttendanceRead } from "src/core/db3/server/eventAttendancePolicy";

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

// Calendar credentials outlive the session; impersonation must not expose them.
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
    bandPublicId: BandPublicId,
): CalendarFeedSubscriptionInfo => {
    const subscriptionUrl = ServerApi.getAbsoluteUri(
        GetICalRelativeURIForUserUpcomingEvents({ calendarFeedToken, bandPublicId }),
    );
    return {
        subscriptionUrl,
        webcalUrl: subscriptionUrl.replace(/^https?:\/\//i, "webcal://"),
    };
};

// Blitz adds delegate overloads; this reader uses only the standard Prisma user delegate.
const calendarDatabase = db as unknown as Pick<Prisma.TransactionClient, "user">;

export const resolveActiveCalendarFeedUser = async (calendarFeedToken: string, database = calendarDatabase) => {
    if (!isCalendarFeedToken(calendarFeedToken)) {
        throw new CalendarFeedNotFoundError("Calendar feed not found.");
    }

    const user = await database.user.findFirst({
        ...UserForCalBackendArgs,
        where: {
            calendarFeedToken,
            isDeleted: false,
            mergedIntoUserId: null,
        },
    });
    if (!user) {
        throw new CalendarFeedNotFoundError("Calendar feed not found.");
    }
    return user;
};

// Recognize the reserved public route without treating unknown credentials as anonymous.
// The HTTP endpoint currently serves only private feeds.
export const resolveCalendarFeedRequestUser = async (calendarFeedToken: string) => {
    if (calendarFeedToken === "public") {
        return null;
    }
    return resolveActiveCalendarFeedUser(calendarFeedToken);
};

type CalendarCredentialMode = "existing" | "replace";

async function saveCalendarFeedToken(database: Prisma.TransactionClient, userId: number, mode: CalendarCredentialMode) {
    let user = await database.user.findUniqueOrThrow({ where: { id: userId }, select: { calendarFeedToken: true } });
    let changed = mode === "replace";
    if (mode === "replace") {
        user = await database.user.update({ where: { id: userId }, data: { calendarFeedToken: generateCalendarFeedToken() }, select: { calendarFeedToken: true } });
    } else if (!user.calendarFeedToken) {
        const update = await database.user.updateMany({
            where: { id: userId, calendarFeedToken: null }, data: { calendarFeedToken: generateCalendarFeedToken() },
        });
        changed = update.count === 1;
        user = await database.user.findUniqueOrThrow({ where: { id: userId }, select: { calendarFeedToken: true } });
    }
    if (!user.calendarFeedToken) {
        throw new NotFoundError();
    }
    return { calendarFeedToken: user.calendarFeedToken, changed };
}

/** The caller owns a Serializable transaction; the private credential remains account-wide. */
export async function saveCalendarFeedSubscription(database: Prisma.TransactionClient, userId: number,
    bandPublicId: BandPublicId, mode: CalendarCredentialMode,
): Promise<CalendarFeedSubscriptionInfo> {
    const auth = (await loadAuthorizationForUser({ id: userId }, database, bandPublicId)).requireUser();
    requireAttendanceRead(auth, bandPublicId);
    auth.requireMembership();
    const { calendarFeedToken, changed } = await saveCalendarFeedToken(database, userId, mode);
    if (changed) {
        const replacing = mode === "replace";
        await RegisterChange({ action: ChangeAction.update,
            changeContext: CreateChangeContext(replacing ? "replaceCalendarFeedSubscription" : "createCalendarFeedSubscription"),
            table: "User", pkid: userId,
            oldValues: replacing ? { calendarFeedLinkReplaced: false } : { calendarFeedEnabled: false },
            newValues: replacing ? { calendarFeedLinkReplaced: true } : { calendarFeedEnabled: true }, auth, db: database,
        });
    }
    return getCalendarFeedSubscriptionInfo(calendarFeedToken, bandPublicId);
}
