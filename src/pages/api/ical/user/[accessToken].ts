import { Ctx } from "@blitzjs/next";
import db from "db";
import { floorToDay } from "shared/time";
import { CoerceToString } from "shared/utils";
import { api } from "src/blitz-server";
import * as db3 from 'src/core/db3/db3';
import { DB3QueryCore2 } from "src/core/db3/server/db3QueryCore";
import * as mutationCore from 'src/core/db3/server/db3mutationCore';
import { addEventToCalendar, createCalendar } from "src/core/db3/server/ical";

// if you use access token, bypass session auth. this would allow a feed to refresh automatically without having to have a session.

export default api(async (req, res, ctx: Ctx) => {
    return new Promise(async (resolve, reject) => {
        try {
            const accessToken = CoerceToString(req.query.accessToken);
            let currentUser: null | db3.UserWithRolesPayload = null;
            if (accessToken.length > 10) {
                currentUser = await db.user.findUnique({
                    where: {
                        accessToken,
                    },
                    include: db3.UserWithRolesArgs.include,
                });
            }

            if (!currentUser) {
                currentUser = await mutationCore.getCurrentUserCore(ctx);// try session.
            }

            const clientIntention: db3.xTableClientUsageContext = { currentUser, intention: currentUser ? "user" : "public", mode: 'primary' };

            const table = db3.xEventVerbose;
            const minDate = floorToDay(new Date()); // avoid tight loop where date changes every render, by flooring to day.
            minDate.setDate(minDate.getDate() - 1);

            const eventsTableParams: db3.EventTableParams = {
                minDate,
            };

            const eventsRaw = await DB3QueryCore2({
                clientIntention,
                tableName: table.tableName,
                tableID: table.tableID,
                filter: {
                    items: [],
                    tableParams: eventsTableParams,
                },
                cmdbQueryContext: `ical/user/${accessToken}`,
                orderBy: undefined,
            }, currentUser);

            // don't error if 0 events. this is a calendar-of-events and 0 events is valid.

            const events = eventsRaw.items as db3.EventClientPayload_Verbose[];

            const sourceURL = process.env.CMDB_BASE_URL + `api/ical/user/${accessToken || (currentUser ? "session" : "public")}`;
            const cal = createCalendar({
                sourceURL,
            });

            for (let i = 0; i < events.length; ++i) {
                const event = events[i]!;
                addEventToCalendar(cal, currentUser, event);
            }

            res.setHeader('Content-Type', 'text/calendar');
            res.setHeader(`Content-Disposition`, `attachment; filename=CM_Agenda${currentUser ? `U${currentUser.id}` : ""}.ics`);
            res.send(cal.toString());
        } catch (e) {
            console.log(e);
            reject(`exception thrown: ${e}`);
        }
    }); // return new promise
});





