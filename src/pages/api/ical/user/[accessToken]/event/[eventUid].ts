import { Ctx } from "@blitzjs/next";
import { ICalCalendar } from "ical-generator";
import { CoerceToString, concatenateUrlParts } from "shared/utils";
import { api } from "src/blitz-server";
import { CalExportCore } from "src/core/db3/server/ical";
import { GetICalRelativeURIForUserAndEvent } from "src/core/db3/shared/apiTypes";

export default api(async (req, res, ctx: Ctx) => {
    return new Promise(async (resolve, reject) => {
        try {
            const accessToken = CoerceToString(req.query.accessToken);
            const eventUid = CoerceToString(req.query.eventUid);

            const cal: ICalCalendar = await CalExportCore({
                accessToken,
                eventUid,
                type: "event",
                sourceURI: concatenateUrlParts(
                    process.env.CMDB_BASE_URL!,
                    GetICalRelativeURIForUserAndEvent({ userAccessToken: accessToken || null, eventUid })
                )
            });

            res.setHeader('Content-Type', 'text/calendar');
            res.setHeader(`Content-Disposition`, `attachment; filename=CM_Event_${eventUid}.ics`);
            res.send(cal.toString());
        } catch (e) {
            console.log(e);
            reject(`exception thrown: ${e}`);
        }
    }); // return new promise
});





