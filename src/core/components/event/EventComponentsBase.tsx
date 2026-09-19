
import { assert } from 'blitz';
import { Prisma } from "db";
import { DateTimeRange, Timing } from 'shared/time';
import { calculateEventAttendance, EventAttendanceResult } from "./attendanceCalculation";
import { getUniqueNegativeID } from 'shared/utils';
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import { API } from '../../db3/clientAPI';
import { useTableRenderContext, xTableClientCaps, xTableClientSpec } from '../../db3/components/DB3ClientCore';
import { SearchResultsRet } from '../../db3/shared/apiTypes';
import { EnrichedEvent, EnrichedSearchEventPayload } from '../../db3/shared/schema/enrichedEventTypes';
import { EventResponseInfo, fn_makeMockEventSegmentResponse, fn_makeMockEventUserResponse, GetEventResponseInfo, UserInstrumentList } from '../../db3/shared/schema/eventAPI';
import { DashboardContextData, useDashboardContext } from '../dashboardContext/DashboardContext';
import { DashboardContextDataBase } from '../dashboardContext/dashboardContextTypes';


type CalculateEventMetadataEvent = db3.EventResponses_MinimalEvent & Prisma.EventGetPayload<{
    select: {
        expectedAttendanceUserTagId: true,
        name: true,
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
    responseInfo: EventResponseInfo<TEvent, TEventSegment, TEventResponse, TSegmentResponse> | null;
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
    dashboardContext: DashboardContextDataBase,
    userMap: UserInstrumentList, // unique list of all relevant users.
    expectedAttendanceTag: db3.EventResponses_ExpectedUserTag | null, // unique list of all invited user tags.
    makeMockEventSegmentResponse: fn_makeMockEventSegmentResponse<TEventSegment, TSegmentResponse>,
    makeMockEventUserResponse: fn_makeMockEventUserResponse<TEvent, TEventResponse>,
): EventWithMetadata<TEvent,
    TEventResponse,
    TEventSegment,
    TSegmentResponse> {

    const responseInfo = GetEventResponseInfo<TEvent, TEventSegment, TEventResponse, TSegmentResponse>({
        event,
        expectedAttendanceTag,
        dashboardContext,
        userMap,
        makeMockEventSegmentResponse,
        makeMockEventUserResponse,
    });
    const eventURI = dashboardContext.routingApi.getURIForEvent(event, tabSlug);

    const dateRange = API.events.getEventDateRange(event);

    return {
        event,
        tabSlug,
        expectedAttendanceTag,
        eventURI,
        responseInfo,
        eventTiming: dateRange.hitTestDateTime(new Date()),
        dateRange,
    };
};



export type EventEnrichedVerbose_Event = EnrichedEvent<Prisma.EventGetPayload<typeof db3.EventArgs_Verbose>>;

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
        tableSpec: new xTableClientSpec({
            table: db3.xUserWithInstrument,
            columns: [],
        }),
        filterModel: {
            tableParams,
        }
    });

    const userMap = dynMenuClient.items as UserInstrumentList;

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
                createdAt: new Date(),
                updatedAt: new Date(),
                createdByUserId: null,
                updatedByUserId: null,
            }
        },
        (event, user, isInvited) => {
            if (!user?.id) return null;
            return {
                userComment: "",
                user: user,
                revision: 0,
                uid: getUniqueNegativeID().toString(),
                eventId: event.id,
                id: -1,
                userId: user.id,
                instrumentId: null,
                isInvited,
                instrument: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdByUserId: null,
                updatedByUserId: null,
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
        EnrichedSearchEventPayload,
        db3.EventResponses_MinimalEventUserResponse,
        db3.EventResponses_MinimalEventSegment,
        db3.EventResponses_MinimalEventSegmentUserResponse
    >;
    userMap: UserInstrumentList,
};

export { type EventAttendanceResult } from "./attendanceCalculation";

// Production context adapter; the calculation itself has no React dependencies.
export const CalcEventAttendance = (props: CalcEventAttendanceArgs): EventAttendanceResult => {
    const dashboardContext = useDashboardContext();
    const user = dashboardContext.currentUser!;
    if (!props.eventData.responseInfo) throw new Error("no response info");
    const eventUserResponse = props.eventData.responseInfo.getEventResponseForUser(user, dashboardContext, props.userMap);
    assert(!!eventUserResponse, "getEventResponseForUser should always return an event response");
    return calculateEventAttendance({
        eventUserResponse,
        segmentUserResponses: Object.values(props.eventData.responseInfo.getResponsesBySegmentForUser(user)),
        segments: props.eventData.event.segments,
        eventTiming: props.eventData.eventTiming,
        eventIsCancelled: props.eventData.event.status?.significance === db3.EventStatusSignificance.Cancelled,
        cancelledStatusIds: db3.getCancelledStatusIds(dashboardContext.eventStatus.items),
        attendances: dashboardContext.eventAttendance.items,
    });
};


//////////////////////////////////////////////////////////////////////////////////////////////////
export interface EventListItemProps {
    event: EnrichedSearchEventPayload;
    results: SearchResultsRet;
    //refetch: () => void;
    //filterSpec: EventsFilterSpec;
};

export const CalculateEventSearchResultsMetadata = ({ event, results }: EventListItemProps) => {
    const dashboardContext = useDashboardContext();

    const userMap: UserInstrumentList = [dashboardContext.currentUser!];
    const customData = results.customData as db3.EventSearchCustomData;
    const userTags = (customData ? customData.userTags : []) as db3.EventResponses_ExpectedUserTag[];
    const expectedAttendanceUserTag = userTags.find(t => t.id === event.expectedAttendanceUserTagId) || null;

    const eventData = CalculateEventMetadata<
        EnrichedSearchEventPayload,
        db3.EventSearch_EventUserResponse,
        db3.EventSearch_EventSegment,
        db3.EventSearch_EventSegmentUserResponse
    >(event, undefined, dashboardContext,
        userMap,
        expectedAttendanceUserTag,
        (segment, user) => { // makeMockEventSegmentResponse
            if (!user?.id) return null;
            return {
                attendanceId: null,
                eventSegmentId: segment.id,
                id: -1,
                userId: user.id,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdByUserId: null,
                updatedByUserId: null,
            }
        },
        (event, user, isInvited) => { // makeMockEventUserResponse
            if (!user?.id) return null;
            return {
                userComment: "",
                revision: 0,
                uid: getUniqueNegativeID().toString(),
                eventId: event.id,
                id: -1,
                userId: user.id,
                instrumentId: null,
                isInvited,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdByUserId: null,
                updatedByUserId: null,
            }
        },
    );

    return {
        eventData,
        userMap,
    };
};


export const EventTableClientColumns = {
    id: new DB3Client.PKColumnClient({ columnName: "id" }),
    name: new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 150, fieldCaption: "Event name", className: "titleText" }),
    dateRange: new DB3Client.EventDateRangeColumn({ startsAtColumnName: "startsAt", headerName: "Date range", durationMillisColumnName: "durationMillis", isAllDayColumnName: "isAllDay" }),
    //description: new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 150 }),
    isDeleted: new DB3Client.BoolColumnClient({ columnName: "isDeleted" }),
    locationDescription: new DB3Client.GenericStringColumnClient({ columnName: "locationDescription", cellWidth: 150, fieldCaption: "Location" }),
    locationURL: new DB3Client.GenericStringColumnClient({ columnName: "locationURL", cellWidth: 150, fieldCaption: "Location URL" }),
    type: new DB3Client.ForeignSingleFieldClient<db3.EventTypePayload>({ columnName: "type", cellWidth: 150, selectStyle: "inline", fieldCaption: "Event Type" }),
    status: new DB3Client.ForeignSingleFieldClient<db3.EventStatusPayload>({ columnName: "status", cellWidth: 150, fieldCaption: "Status" }),
    segmentBehavior: new DB3Client.ConstEnumStringFieldClient({ columnName: "segmentBehavior", cellWidth: 220, fieldCaption: "Behavior of segments" }),
    expectedAttendanceUserTag: new DB3Client.ForeignSingleFieldClient<db3.UserTagPayload>({ columnName: "expectedAttendanceUserTag", cellWidth: 150, fieldCaption: "Who's invited?" }),
    tags: new DB3Client.TagsFieldClient<db3.EventTagAssignmentPayload>({ columnName: "tags", cellWidth: 150, allowDeleteFromCell: false, fieldCaption: "Tags" }),

    visiblePermission: new DB3Client.ForeignSingleFieldClient({ columnName: "visiblePermission", cellWidth: 120, fieldCaption: "Who can view this event?" }),

    createdAt: new DB3Client.CreatedAtColumn({ columnName: "createdAt", cellWidth: 150 }),
    createdByUser: new DB3Client.ForeignSingleFieldClient({ columnName: "createdByUser", cellWidth: 120, }),

    frontpageVisible: new DB3Client.BoolColumnClient({ columnName: "frontpageVisible" }),
    frontpageDate: new DB3Client.GenericStringColumnClient({ columnName: "frontpageDate", cellWidth: 150 }),
    frontpageTime: new DB3Client.GenericStringColumnClient({ columnName: "frontpageTime", cellWidth: 150 }),
    frontpageDetails: new DB3Client.MarkdownStringColumnClient({ columnName: "frontpageDetails", cellWidth: 150 }),

    frontpageTitle: new DB3Client.GenericStringColumnClient({ columnName: "frontpageTitle", cellWidth: 150 }),
    frontpageLocation: new DB3Client.GenericStringColumnClient({ columnName: "frontpageLocation", cellWidth: 150 }),
    frontpageLocationURI: new DB3Client.GenericStringColumnClient({ columnName: "frontpageLocationURI", cellWidth: 150 }),
    frontpageTags: new DB3Client.GenericStringColumnClient({ columnName: "frontpageTags", cellWidth: 150 }),
} as const;


