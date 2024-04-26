// this feed does not support anonymous / sessionless access.

import { Ctx } from "@blitzjs/next";
import { Permission } from "shared/permissions";
import { CoerceToNumberOrNull } from "shared/utils";
import { api } from "src/blitz-server";
import * as db3 from 'src/core/db3/db3';
import { DB3QueryCore } from "src/core/db3/server/db3QueryCore";
import * as mutationCore from 'src/core/db3/server/db3mutationCore';
import { addEventToCalendar, createCalendar } from "src/core/db3/server/ical";

// on making blitz-integrated "raw" server API routes: https://blitzjs.com/docs/auth-server#api-routes
export default api(async (req, res, ctx: Ctx) => {
    return new Promise(async (resolve, reject) => {
        try {
            const currentUser = await mutationCore.getCurrentUserCore(ctx);
            const clientIntention: db3.xTableClientUsageContext = { currentUser, intention: currentUser ? "user" : "public", mode: 'primary' };

            const eventId = CoerceToNumberOrNull(req.query.eventId);
            if (!eventId) throw new Error(`bad parameter`);

            const actx = mutationCore.getAuthenticatedCtx(ctx, Permission.view_events);
            if (!actx) throw new Error(`unauthorized`);

            const table = db3.xEventVerbose;

            const events = await DB3QueryCore({
                clientIntention,
                tableName: table.tableName,
                tableID: table.tableID,
                filter: {
                    items: [{
                        field: "id",
                        operator: "equals",
                        value: eventId,
                    }],
                    quickFilterValues: undefined,
                    tableParams: undefined,
                },
                cmdbQueryContext: `api/ical/event/${eventId}`,
                orderBy: undefined,
            }, actx);

            if (!events.items) {
                // maybe you have no permissions to view this event, or it's not found.
                throw new Error(`not found`);
            }
            const event = events.items[0] as db3.EventClientPayload_Verbose;

            const sourceURL = process.env.CMDB_BASE_URL + `api/ical/event/${event.id}`;
            const cal = createCalendar({
                sourceURL,
            });

            addEventToCalendar(cal, currentUser, event);

            res.setHeader('Content-Type', 'text/calendar');
            res.setHeader('Content-Disposition', `attachment; filename=CM_${event.uid}.ics`);
            res.send(cal.toString());
        } catch (e) {
            console.log(e);
            reject(`exception thrown: ${e}`);
        }
    }); // return new promise
});





