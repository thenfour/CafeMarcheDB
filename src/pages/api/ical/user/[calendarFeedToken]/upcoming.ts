// Read-only calendar of upcoming events. A personalized URL is a bearer
// credential because calendar clients cannot authenticate with the app.

import { ActivityFeature } from "@/src/core/components/featureReports/activityTracking";
import { Ctx } from "@blitzjs/next";
import { ICalCalendar } from "ical-generator";
import { CoerceToString } from "shared/utils";
import {
    CalendarFeedNotFoundError,
    resolveCalendarFeedRequestUser,
} from "src/auth/server/calendarFeedSubscription";
import { api } from "src/blitz-server";
import { CalExportCore } from "src/core/db3/server/ical";
import { recordAction } from "src/core/db3/server/recordActionServer";

const redactedCalendarFeedRoute = "/api/ical/user/[calendarFeedToken]/upcoming";

export default api(async (req, res, ctx: Ctx) => {
    try {
        const calendarFeedToken = CoerceToString(req.query.calendarFeedToken);
        const accessingUser = await resolveCalendarFeedRequestUser(calendarFeedToken);

        if (!accessingUser) {
            throw new CalendarFeedNotFoundError();
        }

        const cal: ICalCalendar = await CalExportCore({
            type: "upcoming",
            currentUser: accessingUser,
        });

        await recordAction({
            feature: ActivityFeature.global_ical_digest,
            uri: redactedCalendarFeedRoute,
            userId: accessingUser?.id,
        }, ctx);

        res.setHeader("Content-Type", "text/calendar; charset=utf-8");
        res.setHeader("Content-Disposition", "inline; filename=CM_UpcomingAgenda.ics");
        res.setHeader("Cache-Control", "private, no-store, max-age=0");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        res.setHeader("Referrer-Policy", "no-referrer");
        res.setHeader("X-Robots-Tag", "noindex, nofollow");
        res.status(200).send(cal.toString());
    } catch (error) {
        if (error instanceof CalendarFeedNotFoundError) {
            res.status(404).end();
            return;
        }

        // Do not serialize the request URL or Prisma arguments: both may
        // contain the bearer credential.
        console.error("Calendar feed request failed.");
        res.status(500).end();
    }
});
