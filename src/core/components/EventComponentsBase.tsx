
import { DateTimeRange, Timing } from 'shared/time';
import * as db3 from "src/core/db3/db3";
import { API } from '../db3/clientAPI';
import React from 'react';
import { DashboardContext } from './DashboardContext';
import { useTableRenderContext, xTableClientCaps, xTableClientSpec } from '../db3/components/DB3ClientCore';



// getUserTagsClient() {
//     return DB3ClientCore.useTableRenderContext({
//         tableSpec: new DB3ClientCore.xTableClientSpec({
//             table: db3.xUserTag,
//             columns: [],
//         }),
//         requestedCaps: DB3ClientCore.xTableClientCaps.Query,
//         clientIntention: { intention: 'user', mode: 'primary' },
//     });
// }

// getUserTag(userTagId: number | null): null | db3.UserTagPayload {
//     const ctx = DB3ClientCore.useTableRenderContext({
//         requestedCaps: DB3ClientCore.xTableClientCaps.Query,
//         clientIntention: { intention: 'user', mode: 'primary' },
//         tableSpec: new DB3ClientCore.xTableClientSpec({
//             table: db3.xUserTag,
//             columns: [
//             ],
//         }),
//         filterModel: {
//             items: [],
//             tableParams: {
//                 userTagId,
//             }
//         },
//     });
//     // do not put this above the useTableRenderContext call; hooks must be consistent between renders.
//     if (!userTagId) return null;
//     return (ctx.items?.length === 1 ? ctx.items[0] : null) as any;
// }



export interface EventWithMetadata {
    event: db3.EventClientPayload_Verbose;
    tabSlug: string | undefined;
    eventURI: string;
    responseInfo: db3.EventResponseInfo | null;
    eventTiming: Timing;
    expectedAttendanceTag: null | db3.UserTagPayload;
    dateRange: DateTimeRange,
};

export const CalculateEventMetadata = (event: db3.EventClientPayload_Verbose, tabSlug?: string | undefined): EventWithMetadata => {
    //const dashboardContext = React.useContext(DashboardContext);
    //const expectedAttendanceTag = API.users.getUserTag(event.expectedAttendanceUserTagId);

    // REQUIRED because we need the user-tag mappings as well.
    const ctx = useTableRenderContext({
        requestedCaps: xTableClientCaps.Query,
        clientIntention: { intention: 'user', mode: 'primary' },
        tableSpec: new xTableClientSpec({
            table: db3.xUserTag,
            columns: [
            ],
        }),
        filterModel: {
            items: [],
            tableParams: {
                userTagId: event.expectedAttendanceUserTagId,
            }
        },
    });
    const expectedAttendanceTag = ctx.items.length === 1 ? ctx.items[0] as db3.UserTagPayload : null;

    const responseInfo = db3.GetEventResponseInfo({ event, expectedAttendanceTag });
    const eventURI = API.events.getURIForEvent(event.id, event.slug, tabSlug);
    const eventTiming = API.events.getEventTiming(event);
    return {
        event,
        tabSlug,
        expectedAttendanceTag,
        eventURI,
        responseInfo,
        eventTiming,
        dateRange: API.events.getEventDateRange(event),
    };
};
