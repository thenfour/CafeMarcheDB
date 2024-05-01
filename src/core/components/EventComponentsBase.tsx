
import { DateTimeRange, Timing } from 'shared/time';
import * as db3 from "src/core/db3/db3";
import { API } from '../db3/clientAPI';
import React from 'react';
import { useTableRenderContext, xTableClientCaps, xTableClientSpec } from '../db3/components/DB3ClientCore';
import { Prisma } from "db";

type CalculateEventMetadataEvent = db3.EventResponses_MinimalEvent & Prisma.EventGetPayload<{
    select: {
        expectedAttendanceUserTagId: true,
        slug: true,
        startsAt: true,
        durationMillis: true,
        isAllDay: true,
    }
}>

export interface EventWithMetadata<
    TEvent extends CalculateEventMetadataEvent,
    TEventResponse extends db3.EventResponses_MinimalEventUserResponse,
    TEventSegment extends db3.EventResponses_MinimalEventSegment,
    TSegmentResponse extends db3.EventResponses_MinimalEventSegmentUserResponse,
> {
    event: TEvent;
    tabSlug: string | undefined;
    eventURI: string;
    responseInfo: db3.EventResponseInfo<TEvent, TEventSegment, TEventResponse, TSegmentResponse> | null;
    eventTiming: Timing;
    expectedAttendanceTag: null | db3.UserTagPayload;
    dateRange: DateTimeRange,
};

// when calculating metadata for 20 search results, i don't want to fetch user tags individually. i should group them.
export function CalculateEventMetadata<
    TEvent extends CalculateEventMetadataEvent,
    TEventResponse extends db3.EventResponses_MinimalEventUserResponse,
    TEventSegment extends db3.EventResponses_MinimalEventSegment,
    TSegmentResponse extends db3.EventResponses_MinimalEventSegmentUserResponse,
>(
    event: TEvent,
    tabSlug: string | undefined,
    data: db3.DashboardContextDataBase,
    userMap: db3.UserInstrumentList,
    makeMockEventSegmentResponse: db3.fn_makeMockEventSegmentResponse<TEventSegment, TSegmentResponse>,
    makeMockEventUserResponse: db3.fn_makeMockEventUserResponse<TEvent, TEventResponse>,
): EventWithMetadata<TEvent,
    TEventResponse,
    TEventSegment,
    TSegmentResponse> {
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

    const responseInfo = db3.GetEventResponseInfo<TEvent, TEventSegment, TEventResponse, TSegmentResponse>({
        event,
        expectedAttendanceTag,
        data,
        userMap,
        makeMockEventSegmentResponse,
        makeMockEventUserResponse,
    });
    const eventURI = API.events.getURIForEvent(event.id, event.slug, tabSlug);
    //const eventTiming = API.events.getEventTiming(event);

    let dateRange = new DateTimeRange({
        startsAtDateTime: event.startsAt,
        durationMillis: Number(event.durationMillis),
        isAllDay: event.isAllDay,
    });

    return {
        event,
        tabSlug,
        expectedAttendanceTag,
        eventURI,
        responseInfo,
        eventTiming: dateRange.hitTestDateTime(),
        dateRange,
    };
};
