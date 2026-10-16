// Read-only calendar of upcoming events. A personalized URL is a bearer
// credential because calendar clients cannot authenticate with the app.

import { ActivityFeature } from "@/src/core/components/featureReports/activityTracking";
import { AuthenticationError, AuthorizationError, NotFoundError } from "blitz";
import {
    CalendarFeedNotFoundError, isCalendarFeedToken,
} from "src/auth/server/calendarFeedSubscription";
import { api } from "src/blitz-server";
import { exportCalendarFeedForToken } from "src/core/db3/server/ical";
import { CalendarBandContextSchema } from "src/core/db3/shared/calendarFeed";
import { createActionRecord } from "src/core/db3/server/recordActionServer";
import { resolvePortalRequestContext } from "src/route/server/portalRequest";

const redactedCalendarFeedRoute = "/api/ical/user/[calendarFeedToken]/upcoming";

export default api(async (req, res) => {
    if (req.method !== "GET") {
        res.setHeader("Allow", "GET");
        res.status(405).end();
        return;
    }
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    try {
        const { requestPath } = await resolvePortalRequestContext(req);
        const context = CalendarBandContextSchema.safeParse({ bandPublicId: requestPath.bandPublicId });
        const calendarFeedToken = req.query.calendarFeedToken;
        if (!context.success || typeof calendarFeedToken !== "string" || !isCalendarFeedToken(calendarFeedToken)) {
            throw new CalendarFeedNotFoundError();
        }
        const { calendar, userId, actionContext } = await exportCalendarFeedForToken(calendarFeedToken, {
            ...context.data, type: "upcoming",
        });

        await createActionRecord({
            feature: ActivityFeature.global_ical_digest,
            uri: redactedCalendarFeedRoute,
            userId,
            isClient: false,
        }, actionContext);

        res.setHeader("Content-Type", "text/calendar; charset=utf-8");
        res.setHeader("Content-Disposition", "inline; filename=CM_UpcomingAgenda.ics");
        res.status(200).send(calendar.toString());
    } catch (error) {
        if (error instanceof CalendarFeedNotFoundError || error instanceof NotFoundError
            || error instanceof AuthenticationError || error instanceof AuthorizationError) {
            res.status(404).end();
            return;
        }

        // Do not serialize the request URL or Prisma arguments: both may
        // contain the bearer credential.
        console.error("Calendar feed request failed.");
        res.status(500).end();
    }
});
