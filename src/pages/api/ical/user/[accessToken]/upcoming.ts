// calendar of all upcoming events

import { ActivityFeature } from "@/src/core/components/featureReports/activityTracking";
import { ServerApi } from "@/src/server/serverApi";
import { Ctx } from "@blitzjs/next";
import db from "db";
import { ICalCalendar } from "ical-generator";
import { CoerceToString } from "shared/utils";
import { api } from "src/blitz-server";
import { CalExportCore } from "src/core/db3/server/ical";
import { recordAction } from "src/core/db3/server/recordActionServer";
import { GetICalRelativeURIForUserUpcomingEvents } from "src/core/db3/shared/apiTypes";

export default api(async (req, res, ctx: Ctx) => {
    return new Promise(async (resolve, reject) => {
        try {
            const accessToken = CoerceToString(req.query.accessToken);

            const cal: ICalCalendar = await CalExportCore({
                type: "upcoming",
                accessToken,
                sourceURI: ServerApi.getAbsoluteUri(
                    GetICalRelativeURIForUserUpcomingEvents({ userAccessToken: accessToken || null })
                )
            });

            const accessingUser = await db.user.findUnique({
                where: {
                    accessToken,
                },
            });

            await recordAction({
                feature: ActivityFeature.global_ical_digest,
                uri: req.url || "",
                userId: accessingUser?.id,
            }, ctx);

            res.setHeader('Content-Type', 'text/calendar');
            res.setHeader(`Content-Disposition`, `attachment; filename=CM_UpcomingAgenda_${accessToken}.ics`);
            res.send(cal.toString());
        } catch (e) {
            console.log(e);
            reject(`exception thrown: ${e}`);
        }
    }); // return new promise
});





