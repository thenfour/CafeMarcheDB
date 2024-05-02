
import { DateTimeRange, Timing } from 'shared/time';
import * as db3 from "src/core/db3/db3";
import { API } from '../db3/clientAPI';
import React from 'react';
import { useTableRenderContext, xTableClientCaps, xTableClientSpec } from '../db3/components/DB3ClientCore';
import { Prisma } from "db";
import { DashboardContextData } from './DashboardContext';

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
    expectedAttendanceTag: null | db3.EventResponses_ExpectedUserTag;
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
    userMap: db3.UserInstrumentList, // unique list of all relevant users.
    expectedAttendanceTag: db3.EventResponses_ExpectedUserTag | null, // unique list of all invited user tags.
    makeMockEventSegmentResponse: db3.fn_makeMockEventSegmentResponse<TEventSegment, TSegmentResponse>,
    makeMockEventUserResponse: db3.fn_makeMockEventUserResponse<TEvent, TEventResponse>,
): EventWithMetadata<TEvent,
    TEventResponse,
    TEventSegment,
    TSegmentResponse> {

    const responseInfo = db3.GetEventResponseInfo<TEvent, TEventSegment, TEventResponse, TSegmentResponse>({
        event,
        expectedAttendanceTag,
        data,
        userMap,
        makeMockEventSegmentResponse,
        makeMockEventUserResponse,
    });
    const eventURI = API.events.getURIForEvent(event.id, event.slug, tabSlug);

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



export type EventEnrichedVerbose_Event = db3.EnrichedEvent<Prisma.EventGetPayload<typeof db3.EventArgs_Verbose>>;
// export type EventEnrichedVerbose_EventUserResponse = Prisma.EventUserResponseGetPayload<typeof db3.EventArgs_Verbose.include.responses>;
// export type EventEnrichedVerbose_EventSegment = Prisma.EventSegmentGetPayload<typeof db3.EventArgs_Verbose.include.segments>;
// export type EventEnrichedVerbose_EventSegmentUserResponse = Prisma.EventSegmentUserResponseGetPayload<typeof db3.EventArgs_Verbose.include.segments.include.responses>;

interface CalculateEventMetadata_VerboseArgs {
    event: EventEnrichedVerbose_Event,
    tabSlug: string | undefined;
    dashboardContext: DashboardContextData;
};

export function CalculateEventMetadata_Verbose({ event, tabSlug, dashboardContext }: CalculateEventMetadata_VerboseArgs) {

    // - current user
    // - users that appear in event responses
    // - users that appear in segment responses
    // - and finally, any users that are invited by default.
    // because of the last point, a fetch is absolutely required.
    const invitees = event.expectedAttendanceUserTag?.userAssignments.map(a => a.userId) || [];

    const userIdMap = new Set<number>([
        ...event.responses.map(r => r.userId),
        ...event.segments.map(seg => seg.responses.map(r => r.userId)).flat(),
        ...invitees,
    ]);

    const tableParams: db3.UserTablParams = {
        userIds: [...userIdMap]
    };

    // fetch users with instruments.
    const dynMenuClient = useTableRenderContext({
        requestedCaps: xTableClientCaps.Query,
        clientIntention: dashboardContext.userClientIntention,
        tableSpec: new xTableClientSpec({
            table: db3.xUserWithInstrument,
            columns: [],
        }),
        filterModel: {
            items: [],
            tableParams,
        }
    });

    const userMap = dynMenuClient.items as db3.UserInstrumentList;

    const eventData = CalculateEventMetadata<
        EventEnrichedVerbose_Event,
        db3.EventVerbose_EventUserResponse,
        db3.EventVerbose_EventSegment,
        db3.EventVerbose_EventSegmentUserResponse
    >(event, tabSlug, dashboardContext, userMap, event.expectedAttendanceUserTag,
        (segment, user) => {
            if (!user?.id) return null;
            return {
                attendanceId: null,
                attendance: null,
                eventSegmentId: segment.id,
                id: -1,
                userId: user.id,
                user: user,
                eventSegment: null as any,
            }
        },
        (event, user, isInvited) => {
            if (!user?.id) return null;
            return {
                userComment: "",
                user: user,
                eventId: event.id,
                id: -1,
                userId: user.id,
                instrumentId: null,
                isInvited,
                instrument: null,
            }
        },
    );

    return {
        userMap,
        eventData,
    };
};