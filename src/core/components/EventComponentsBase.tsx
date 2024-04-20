
import { DateTimeRange, Timing } from 'shared/time';
import * as db3 from "src/core/db3/db3";
import { API } from '../db3/clientAPI';

export interface EventWithMetadata {
    event: db3.EventClientPayload_Verbose;
    tabSlug: string | undefined;
    eventURI: string;
    responseInfo: db3.EventResponseInfo;
    eventTiming: Timing;
    expectedAttendanceTag: null | db3.UserTagPayload;
    dateRange: DateTimeRange,
};

export const CalculateEventMetadata = (event: db3.EventClientPayload_Verbose, tabSlug?: string | undefined): EventWithMetadata => {
    const expectedAttendanceTag = API.users.getUserTag(event.expectedAttendanceUserTagId);
    const eventURI = API.events.getURIForEvent(event.id, event.slug, tabSlug);
    const responseInfo = db3.GetEventResponseInfo({ event, expectedAttendanceTag });
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
