
import { DateTimeRange, Timing } from 'shared/time';
import * as db3 from "src/core/db3/db3";
import { API } from '../db3/clientAPI';
import React, { Suspense } from 'react';
import { useTableRenderContext, xTableClientCaps, xTableClientSpec } from '../db3/components/DB3ClientCore';
import { Prisma } from "db";
import { DashboardContextData } from './DashboardContext';
import { DiscreteCriterion, SearchResultsRet } from '../db3/shared/apiTypes';
import { SortDirection } from 'shared/rootroot';
import { DashboardContext } from "src/core/components/DashboardContext";
import { useQuery } from '@blitzjs/rpc';
import getSearchResults from '../db3/queries/getSearchResults';
import { CoalesceBool } from 'shared/utils';
import { assert } from 'blitz';

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
    if (dashboardContext.currentUser?.id) {
        // if current user is viewing, we should be able to generate event response data for them even if not responded or even invited.
        userIdMap.add(dashboardContext.currentUser.id);
    }

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


//////////////////////////////////////////////////////////////////////////////////////////////////
export interface CalcEventAttendanceArgs {
    eventData: EventWithMetadata<
        db3.EnrichedSearchEventPayload,
        db3.EventResponses_MinimalEventUserResponse,
        db3.EventResponses_MinimalEventSegment,
        db3.EventResponses_MinimalEventSegmentUserResponse
    >;
    userMap: db3.UserInstrumentList,
    alertOnly?: boolean; // when true, the control hides unless it's an alert.
};

export interface EventAttendanceResult {
    eventUserResponse: db3.EventUserResponse<db3.EventResponses_MinimalEvent, db3.EventResponses_MinimalEventUserResponse>;
    segmentUserResponses: db3.EventSegmentUserResponse<db3.EventResponses_MinimalEventSegment, db3.EventResponses_MinimalEventSegmentUserResponse>[];

    noSegments: boolean;
    eventIsCancelled: boolean;
    eventTiming: Timing;
    eventIsPast: boolean;


    isInvited: boolean;
    isSingleSegment: boolean;

    allAttendances: Prisma.EventAttendanceGetPayload<{}>[];

    anyAnswered: boolean;
    allAnswered: boolean;
    allAffirmative: boolean;
    someAffirmative: boolean;
    allNegative: boolean;

    alertFlag: boolean;
    hideBecauseNotAlert: boolean;
    visible: boolean;

    allowViewMode: boolean;

    allowInstrumentSelect: boolean;
};

// breaks out all the logic from the alert control into a function
// eventUserResponse: db3.EventUserResponse<db3.EventResponses_MinimalEvent, db3.EventResponses_MinimalEventUserResponse>;
// segmentUserResponses: db3.EventSegmentUserResponse<db3.EventResponses_MinimalEventSegment, db3.EventResponses_MinimalEventSegmentUserResponse>[];

export const CalcEventAttendance = (props: CalcEventAttendanceArgs): EventAttendanceResult => {
    const dashboardContext = React.useContext(DashboardContext);
    const user = dashboardContext.currentUser!;

    const alertOnly = CoalesceBool(props.alertOnly, false);
    if (!props.eventData.responseInfo) throw new Error("no response info");

    const ret: EventAttendanceResult = {
        eventUserResponse: props.eventData.responseInfo.getEventResponseForUser(user, dashboardContext, props.userMap)!,
        segmentUserResponses: Object.values(props.eventData.responseInfo.getResponsesBySegmentForUser(user)),

        noSegments: (props.eventData.event.segments.length < 1),
        eventIsCancelled: (props.eventData.event.status?.significance === db3.EventStatusSignificance.Cancelled),
        eventTiming: props.eventData.eventTiming,
        eventIsPast: props.eventData.eventTiming === Timing.Past,

        isInvited: false,
        isSingleSegment: false,

        allAttendances: [],

        anyAnswered: false,
        allAnswered: false,
        allAffirmative: false,
        someAffirmative: false,
        allNegative: false,

        alertFlag: false,
        hideBecauseNotAlert: false,
        visible: false,

        allowViewMode: false,

        allowInstrumentSelect: false,
    };

    //if (props.eventData.event.segments.length < 1) ret.noSegments = true;//return <AdminInspectObject src={"hidden bc no segments. no attendance can be recorded."} label="AttendanceControl" />;

    // never show attendance alert control for cancelled events
    //ret.eventIsCancelled = ;

    ret.segmentUserResponses.sort((a, b) => db3.compareEventSegments(a.segment, b.segment));
    //const eventResponse = props.eventData.responseInfo.getEventResponseForUser(user, dashboardContext, props.userMap);
    assert(!!ret.eventUserResponse, "getEventResponseForUser should be designed to always return an event response obj");

    ret.isInvited = ret.eventUserResponse.isInvited;
    ret.isSingleSegment = ret.segmentUserResponses.length === 1;

    ret.allAttendances = ret.segmentUserResponses.map(sr => dashboardContext.eventAttendance.getById(sr.response.attendanceId)!);

    ret.anyAnswered = ret.allAttendances.some(r => !!r);
    ret.allAnswered = ret.allAttendances.every(r => !!r);
    ret.allAffirmative = ret.allAttendances.every(r => !!r && r.strength > 50);
    ret.someAffirmative = ret.allAttendances.some(r => !!r && r.strength > 50);
    ret.allNegative = ret.allAttendances.every(r => !!r && r.strength <= 50);

    ret.alertFlag = ret.isInvited && !ret.allAnswered && !ret.eventIsPast && !ret.eventIsCancelled;
    ret.hideBecauseNotAlert = !ret.alertFlag && alertOnly;
    ret.visible = !ret.eventIsCancelled && !ret.noSegments && !ret.hideBecauseNotAlert && (ret.anyAnswered || ret.isInvited);// hide the control entirely if you're not invited, but still show if you already responded.

    // there are really just 2 modes here for simplicity
    // view (compact, instrument & segments on same line)
    // edit (full, instrument & segments on separate lines with full text)
    ret.allowViewMode = !ret.alertFlag;
    //const editMode = userSelectedEdit || !allowViewMode;

    // try to make the process slightly more linear by first asking about attendance. when you've answered that, THEN ask on what instrument.
    // also don't ask about instrument if all answers are negative.
    ret.allowInstrumentSelect = ret.allAnswered && ret.someAffirmative;

    return ret;
};



//////////////////////////////////////////////////////////////////////////////////////////////////
export interface EventListItemProps {
    event: db3.EnrichedSearchEventPayload;
    results: SearchResultsRet;
    //refetch: () => void;
    //filterSpec: EventsFilterSpec;
};

export const CalculateEventSearchResultsMetadata = ({ event, results }: EventListItemProps) => {
    const dashboardContext = React.useContext(DashboardContext);

    const userMap: db3.UserInstrumentList = [dashboardContext.currentUser!];
    const customData = results.customData as db3.EventSearchCustomData;
    const userTags = (customData ? customData.userTags : []) as db3.EventResponses_ExpectedUserTag[];
    const expectedAttendanceUserTag = userTags.find(t => t.id === event.expectedAttendanceUserTagId) || null;

    const eventData = CalculateEventMetadata<
        db3.EnrichedSearchEventPayload,
        db3.EventSearch_EventUserResponse,
        db3.EventSearch_EventSegment,
        db3.EventSearch_EventSegmentUserResponse
    >(event, undefined, dashboardContext,
        userMap,
        expectedAttendanceUserTag,
        (segment, user) => {
            if (!user?.id) return null;
            return {
                attendanceId: null,
                eventSegmentId: segment.id,
                id: -1,
                userId: user.id,
            }
        },
        (event, user, isInvited) => {
            if (!user?.id) return null;
            return {
                userComment: "",
                eventId: event.id,
                id: -1,
                userId: user.id,
                instrumentId: null,
                isInvited,
            }
        },
    );

    return {
        eventData,
        userMap,
    };
};


//////////////////////////////////////////////////////////////////////////////////////////////////
export enum EventOrderByColumnOptions {
    id = "id",
    startsAt = "startsAt",
    name = "name",
};

export type EventOrderByColumnOption = keyof typeof EventOrderByColumnOptions;// "startsAt" | "name";

export interface EventsFilterSpec {
    pageSize: number;
    page: number;
    quickFilter: string;
    refreshSerial: number; // this is necessary because you can do things to change the results from this page. think of adding an event then refetching.

    orderByColumn: EventOrderByColumnOption;
    orderByDirection: SortDirection;

    typeFilter: DiscreteCriterion;
    tagFilter: DiscreteCriterion;
    statusFilter: DiscreteCriterion;
    dateFilter: DiscreteCriterion;
};


export interface EventListQuerierProps {
    filterSpec: EventsFilterSpec;
    setResults: (v: SearchResultsRet, enrichedEvents: db3.EnrichedSearchEventPayload[]) => void;
    render: (isLoading: boolean) => React.ReactNode;
};

const EventListQuerierInner = (props: EventListQuerierProps) => {
    const dashboardContext = React.useContext(DashboardContext);

    const [searchResult, queryExtra] = useQuery(getSearchResults, {
        page: props.filterSpec.page,
        pageSize: props.filterSpec.pageSize,
        tableID: db3.xEvent.tableID,
        refreshSerial: props.filterSpec.refreshSerial,
        sort: [{
            db3Column: props.filterSpec.orderByColumn,
            direction: props.filterSpec.orderByDirection,
        }],

        quickFilter: props.filterSpec.quickFilter,
        discreteCriteria: [
            props.filterSpec.dateFilter,
            props.filterSpec.typeFilter,
            props.filterSpec.statusFilter,
            props.filterSpec.tagFilter,
        ],
    });

    React.useEffect(() => {
        if (queryExtra.isSuccess) {
            const enrichedEvents = searchResult.results.map(e => db3.enrichSearchResultEvent(e as db3.EventVerbose_Event, dashboardContext));
            props.setResults({ ...searchResult, }, enrichedEvents);
        }
    }, [queryExtra.dataUpdatedAt]);

    return <>{props.render(queryExtra.isLoading)}</>;// <div className={`queryProgressLine idle`}></div>;
};


export const EventListQuerier = (props: EventListQuerierProps) => {
    return <Suspense fallback={props.render(true)}>
        <EventListQuerierInner
            {...props}
        />
    </Suspense>
};


