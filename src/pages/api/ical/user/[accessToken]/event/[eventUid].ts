import { Ctx } from "@blitzjs/next";
import { ICalCalendar } from "ical-generator";
import { CoerceToString, concatenateUrlParts } from "shared/utils";
import { api } from "src/blitz-server";
import { CalExportCore } from "src/core/db3/server/ical";
import { GetICalRelativeURIForUserAndEvent, MakeICalEventUid, ParseICalEventUid } from "src/core/db3/shared/apiTypes";

export default api(async (req, res, ctx: Ctx) => {
    return new Promise(async (resolve, reject) => {
        try {
            const accessToken = CoerceToString(req.query.accessToken);
            //const eventUid = CoerceToString(req.query.eventUid);
            if (!req.query.eventUid) throw new Error(`invalid uid`);
            if (typeof req.query.eventUid !== "string") throw new Error(`invalid uid`);
            const uid = ParseICalEventUid(req.query.eventUid);
            if (!uid) throw new Error(`invalid uid`);

            const cal: ICalCalendar = await CalExportCore({
                accessToken,
                eventUid: uid.eventUid,
                type: "event",
                sourceURI: concatenateUrlParts(
                    process.env.CMDB_BASE_URL!,
                    GetICalRelativeURIForUserAndEvent({ userAccessToken: accessToken || null, eventUid: uid?.eventUid, userUid: uid?.userUid })
                )
            });

            res.setHeader('Content-Type', 'text/calendar');
            res.setHeader(`Content-Disposition`, `attachment; filename=CM_Event_${MakeICalEventUid(uid.eventUid, uid.userUid)}.ics`);
            res.send(cal.toString());
        } catch (e) {
            console.log(e);
            reject(`exception thrown: ${e}`);
        }
    }); // return new promise
});





