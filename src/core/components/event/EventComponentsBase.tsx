
import { assert } from 'blitz';
import { DateTimeRange, Timing } from 'shared/time';
import { getUniqueNegativeID } from 'shared/utils';
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import { defineLegacyTableClientSpec, useLegacyTableRenderContext, xTableClientCaps } from '../../db3/components/DB3ClientCore';
import { EnrichedEvent } from '../../db3/shared/schema/enrichedEventTypes';
import { EventResponseInfo, fn_makeMockEventSegmentResponse, fn_makeMockEventUserResponse, GetEventResponseInfo, UserInstrumentList } from '../../db3/shared/schema/eventAPI';
import { DashboardContextData, useDashboardContext } from '../dashboardContext/DashboardContext';
import { DashboardContextDataBase } from '../dashboardContext/dashboardContextTypes';
import { calculateEventAttendance, EventAttendanceResult } from "./attendanceCalculation";
import type { EventStatusPublicId, UserTagPublicId } from 'shared/publicId';


export type CalculateEventMetadataEvent = db3.EventResponses_MinimalEvent & {
    expectedAttendanceUserTagId: UserTagPublicId | null;
    name: string;
};

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
    dateRange: DateTimeRange,
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



export type EventEnrichedVerbose_Event = EnrichedEvent<db3.EventClientPayload_Verbose>;

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
    const dynMenuClient = useLegacyTableRenderContext({
        requestedCaps: xTableClientCaps.Query,
        tableSpec: defineLegacyTableClientSpec({
            table: db3.xUserWithInstrument,
            columns: {},
        }),
        filterModel: {
            tableParams,
        }
    });

    const userMap = dynMenuClient.items as UserInstrumentList;

    const eventData = CalculateEventMetadata<
        EventEnrichedVerbose_Event,
        db3.EventVerbose_EventUserResponse,
        db3.EventVerbose_EventSegmentClient,
        db3.EventVerbose_EventSegmentUserResponse
    >(event, new DateTimeRange({
        startsAtDateTime: event.startsAt,
        durationMillis: Number(event.durationMillis),
        isAllDay: event.isAllDay,
    }), tabSlug, dashboardContext, userMap, event.expectedAttendanceUserTag,
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
type CalculateAttendanceEvent = CalculateEventMetadataEvent & {
    segments: db3.EventResponses_MinimalEventSegment[];
    status?: { significance: string | null } | null;
};

export type AttendanceEventMetadata = EventWithMetadata<
    CalculateAttendanceEvent,
    db3.EventResponses_MinimalEventUserResponse,
    db3.EventResponses_MinimalEventSegment,
    db3.EventResponses_MinimalEventSegmentUserResponse
>;

export interface CalcEventAttendanceArgs {
    eventData: AttendanceEventMetadata;
    userMap: UserInstrumentList,
    dashboardContext: DashboardContextDataBase;
};

export { type EventAttendanceResult } from "./attendanceCalculation";

// Production context adapter; the calculation itself has no React dependencies.
export const CalcEventAttendance = (props: CalcEventAttendanceArgs): EventAttendanceResult => {
    const dashboardContext = props.dashboardContext;
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
        cancelledStatusIds: db3.getCancelledStatusIds(
            dashboardContext.eventStatus.items,
            status => db3.xEventStatus.getIdentity(status),
        ),
        attendances: dashboardContext.eventAttendance.items,
    });
};


//////////////////////////////////////////////////////////////////////////////////////////////////
export interface EventListItemProps {
    event: db3.EventSearchClient;
    //refetch: () => void;
    //filterSpec: EventsFilterSpec;
};

type ReadyEventSearchSegment = NonNullable<db3.EventSearchClient["segments"]>[number] & {
    name: string;
    dateRange: DateTimeRange;
    statusId: EventStatusPublicId | null;
    responses: db3.EventResponses_MinimalEventSegmentUserResponse[];
};

type EventSearchMetadataSegment = ReadyEventSearchSegment & db3.EventResponses_MinimalEventSegment;

type EventSearchMetadataEvent = db3.EventSearchClient & {
    expectedAttendanceUserTagId: UserTagPublicId | null;
    name: string;
    responses: db3.EventResponses_MinimalEventUserResponse[];
    segments: EventSearchMetadataSegment[];
};

export type EventSearchMetadata = EventWithMetadata<
    EventSearchMetadataEvent,
    db3.EventResponses_MinimalEventUserResponse,
    EventSearchMetadataSegment,
    db3.EventResponses_MinimalEventSegmentUserResponse
>;

const isEventUserResponseReady = (
    response: NonNullable<db3.EventSearchClient["responses"]>[number],
): response is typeof response & db3.EventResponses_MinimalEventUserResponse => (
    response.userId !== undefined
    && response.instrumentId !== undefined
    && response.isInvited !== undefined
    && response.userComment !== undefined
);

const isSegmentResponseReady = (
    response: NonNullable<NonNullable<db3.EventSearchClient["segments"]>[number]["responses"]>[number],
): response is typeof response & db3.EventResponses_MinimalEventSegmentUserResponse => (
    response.userId !== undefined && response.attendanceId !== undefined
);

const isEventSegmentReady = (
    segment: NonNullable<db3.EventSearchClient["segments"]>[number],
): segment is ReadyEventSearchSegment => (
    segment.name !== undefined
    && segment.dateRange !== undefined
    && segment.statusId !== undefined
    && segment.responses !== undefined
    && segment.responses.every(isSegmentResponseReady)
);

export const CalculateEventSearchResultsMetadata = ({ event }: EventListItemProps): {
    eventData: EventSearchMetadata;
    userMap: UserInstrumentList;
} | null => {
    const dashboardContext = useDashboardContext();
    const currentUser = dashboardContext.currentUser;

    if (!currentUser
        || event.expectedAttendanceUserTagId === undefined
        || event.name === undefined
        || event.dateRange === undefined
        || event.responses === undefined
        || !event.responses.every(isEventUserResponseReady)
        || event.segments === undefined
        || !event.segments.every(isEventSegmentReady)) {
        return null;
    }

    const userMap: UserInstrumentList = [currentUser];
    const attendanceTag = event.expectedAttendanceUserTag;
    if (attendanceTag && (
        attendanceTag.userAssignments === undefined
        || attendanceTag.userAssignments.some(assignment => assignment.userId === undefined)
    )) {
        return null;
    }
    const expectedAttendanceUserTag: db3.EventResponses_ExpectedUserTag | null = attendanceTag
        ? {
            publicId: attendanceTag.publicId,
            userAssignments: attendanceTag.userAssignments!.map(assignment => ({
                userId: assignment.userId!,
            })),
        }
        : null;

    const metadataSegments: EventSearchMetadataSegment[] = event.segments.map(segment => {
        const dateRangeSpec = segment.dateRange.getSpec();
        return {
            ...segment,
            responses: segment.responses as db3.EventResponses_MinimalEventSegmentUserResponse[],
            startsAt: dateRangeSpec.startsAtDateTime,
            durationMillis: BigInt(dateRangeSpec.durationMillis),
            isAllDay: dateRangeSpec.isAllDay,
        };
    });

    const metadataEvent: EventSearchMetadataEvent = {
        ...event,
        expectedAttendanceUserTagId: event.expectedAttendanceUserTagId,
        name: event.name,
        responses: event.responses,
        segments: metadataSegments,
    };

    const eventData = CalculateEventMetadata<
        EventSearchMetadataEvent,
        db3.EventResponses_MinimalEventUserResponse,
        EventSearchMetadataSegment,
        db3.EventResponses_MinimalEventSegmentUserResponse
    >(metadataEvent, event.dateRange, undefined, dashboardContext,
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


export const EventTableClientColumns = DB3Client.makeClientColumnSet({
    id: columnName => new DB3Client.PKColumnClient({ columnName }),
    name: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 150, fieldCaption: "Event name", className: "titleText" }),
    startsAt: columnName => new DB3Client.EventDateRangeColumn({ startsAtColumnName: columnName, headerName: "Date range", durationMillisColumnName: "durationMillis", isAllDayColumnName: "isAllDay" }),
    //description: new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 150 }),
    isDeleted: columnName => new DB3Client.BoolColumnClient({ columnName }),
    locationDescription: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 150, fieldCaption: "Location" }),
    locationURL: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 150, fieldCaption: "Location URL" }),
    type: columnName => new DB3Client.ForeignSingleFieldClient<db3.EventTypeDashboardClient>({ columnName, cellWidth: 150, selectStyle: "inline", fieldCaption: "Event Type", selectionView: db3.eventTypeEditorView }),
    status: columnName => new DB3Client.ForeignSingleFieldClient<db3.EventStatusDashboardClient>({ columnName, cellWidth: 150, fieldCaption: "Status", selectionView: db3.eventStatusEditorView }),
    segmentBehavior: columnName => new DB3Client.ConstEnumStringFieldClient({ columnName, cellWidth: 220, fieldCaption: "Behavior of segments" }),
    expectedAttendanceUserTag: columnName => new DB3Client.ForeignSingleFieldClient<db3.UserTagPayload>({ columnName, cellWidth: 150, fieldCaption: "Who's invited?", selectionView: db3.userTagEditorView }),
    tags: columnName => new DB3Client.TagsFieldClient<db3.EventTagAssignmentClientPayload & { eventTag: db3.EventTagDashboardClient }>({ columnName, cellWidth: 150, allowDeleteFromCell: false, fieldCaption: "Tags", selectionView: db3.eventTagEditorView }),

    visiblePermission: DB3Client.foreignRefFieldGen({
        selectionView: db3.permissionVisibilityView,
        fieldCaption: "Who can view this event?",
    }),

    createdAt: columnName => new DB3Client.CreatedAtColumn({ columnName, cellWidth: 150 }),
    createdByUser: columnName => new DB3Client.ForeignSingleFieldClient({ columnName, cellWidth: 120, }),

    frontpageVisible: columnName => new DB3Client.BoolColumnClient({ columnName }),
    frontpageDate: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 150 }),
    frontpageTime: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 150 }),
    frontpageDetails: columnName => new DB3Client.MarkdownStringColumnClient({ columnName, cellWidth: 150 }),

    frontpageTitle: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 150 }),
    frontpageLocation: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 150 }),
    frontpageLocationURI: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 150 }),
    frontpageTags: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 150 }),
});


