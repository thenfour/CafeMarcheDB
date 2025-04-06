// calendar of all upcoming events

import { Ctx } from "@blitzjs/next";
import { ICalCalendar } from "ical-generator";
import { CoerceToString, concatenateUrlParts } from "shared/utils";
import { api } from "src/blitz-server";
import { CalExportCore } from "src/core/db3/server/ical";
import { recordAction } from "src/core/db3/server/recordActionServer";
import { ActivityFeature } from "src/core/db3/shared/activityTracking";
import { GetICalRelativeURIForUserUpcomingEvents } from "src/core/db3/shared/apiTypes";

export default api(async (req, res, ctx: Ctx) => {
    return new Promise(async (resolve, reject) => {
        try {
            const accessToken = CoerceToString(req.query.accessToken);

            const cal: ICalCalendar = await CalExportCore({
                type: "upcoming",
                accessToken,
                sourceURI: concatenateUrlParts(
                    process.env.CMDB_BASE_URL!,
                    GetICalRelativeURIForUserUpcomingEvents({ userAccessToken: accessToken || null })
                )
            });

            await recordAction({
                feature: ActivityFeature.global_ical_digest,
                uri: req.url || "",
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





