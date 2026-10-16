import type { CmdbRouter } from "src/route/portalRouting";
import { useCmdbRouter } from "src/route/useCmdbRouter";

import { DateTimeRange, Timing } from 'shared/time';
import { getUniqueNegativeID } from 'shared/utils';
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import { useEventParticipants } from './useEventParticipants';
import { EventResponseInfo, fn_makeMockEventSegmentResponse, fn_makeMockEventUserResponse, GetEventResponseInfo, EventParticipantList } from '../../db3/shared/schema/eventAPI';
import { DashboardContextData, useDashboardContext } from '../dashboardContext/DashboardContext';
import { DashboardContextDataBase } from '../dashboardContext/dashboardContextTypes';
import { calculateEventAttendance, EventAttendanceResult } from "./attendanceCalculation";
import type { BandUserPublicId, EventStatusPublicId, UserTagPublicId } from 'shared/publicId';


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
    router: Pick<CmdbRouter, "getURIForEvent">,
    userMap: EventParticipantList, // unique list of all relevant users.
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
    const eventURI = router.getURIForEvent(event, tabSlug);

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



export type EventDetailEvent = db3.EventDetailClient;
export type EventDetailTableClient = DB3Client.xTableRenderClient<typeof db3.eventDetailView>;

interface CalculateEventDetailMetadataArgs {
    event: EventDetailEvent,
    tabSlug: string | undefined;
    dashboardContext: DashboardContextData;
    router: Pick<CmdbRouter, "getURIForEvent">;
};

export function CalculateEventDetailMetadata({ event, tabSlug, dashboardContext, router }: CalculateEventDetailMetadataArgs) {

    // - current user
    // - users that appear in event responses
    // - users that appear in segment responses
    // - and finally, any users that are invited by default.
    // because of the last point, a fetch is absolutely required.
    const invitees = event.expectedAttendanceUserTag?.bandUserTagAssignments.map(a => a.bandUserId) || [];
    const membershipIds = new Set<BandUserPublicId>([
        ...event.responses.map(r => r.bandUserId),
        ...event.segments.flatMap(segment => segment.responses.map(r => r.bandUserId)),
        ...invitees,
    ]);
    if (dashboardContext.currentMembership) {
        membershipIds.add(dashboardContext.currentMembership.publicId);
    }
    const userMap = useEventParticipants({ membershipIds: [...membershipIds] });

    const eventData = CalculateEventMetadata<
        EventDetailEvent,
        db3.EventDetailEventResponse,
        db3.EventDetailSegmentClient,
        db3.EventDetailSegmentResponse
    >(event, new DateTimeRange({
        startsAtDateTime: event.startsAt,
        durationMillis: Number(event.durationMillis),
        isAllDay: event.isAllDay,
    }), tabSlug, dashboardContext, router, userMap, event.expectedAttendanceUserTag,
        (segment, user) => {
            if (!user?.publicId) return null;
            return {
                attendanceId: null,
                attendance: null,
                eventSegmentId: segment.publicId,
                publicId: null,
                bandUserId: user.membershipId,
                createdAt: new Date(),
                updatedAt: new Date(),
                updatedByUser: null,
            }
        },
        (event, user, isInvited) => {
            if (!user?.publicId) return null;
            return {
                userComment: "",
                revision: 0,
                eventId: event.publicId,
                publicId: null,
                bandUserId: user.membershipId,
                bandInstrumentId: null,
                bandInstrument: null,
                isInvited,
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
    userMap: EventParticipantList,
    dashboardContext: DashboardContextDataBase;
};

export { type EventAttendanceResult } from "./attendanceCalculation";

// calculation itself has no React dependencies.
export const CalcEventAttendance = (props: CalcEventAttendanceArgs): EventAttendanceResult => {
    const dashboardContext = props.dashboardContext;
    const user = props.userMap.find(participant => participant.publicId === dashboardContext.currentUser?.publicId);

    // Q: why is user needed here?
    //assert(!!user, `Attendance requires an active participant in the selected band; current user: ${dashboardContext.currentUser?.publicId}`);
    if (!props.eventData.responseInfo) throw new Error("no response info");

    const hasUser = !!user;
    const eventUserResponse = hasUser ? props.eventData.responseInfo.getEventResponseForUser(user, dashboardContext, props.userMap) : null;

    //assert(!!eventUserResponse, "getEventResponseForUser should always return an event response");
    return calculateEventAttendance({
        eventUserResponse,
        segmentUserResponses: hasUser ? Object.values(props.eventData.responseInfo.getResponsesBySegmentForUser(user)) : [],

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
    response.bandUserId !== undefined
    && response.bandInstrumentId !== undefined
    && response.isInvited !== undefined
    && response.userComment !== undefined
);

const isSegmentResponseReady = (
    response: NonNullable<NonNullable<db3.EventSearchClient["segments"]>[number]["responses"]>[number],
): response is typeof response & db3.EventResponses_MinimalEventSegmentUserResponse => (
    response.bandUserId !== undefined && response.attendanceId !== undefined
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
    userMap: EventParticipantList;
} | null => {
    const dashboardContext = useDashboardContext();
    const router = useCmdbRouter();
    const currentUser = db3.eventParticipantFromMembership(dashboardContext.currentMembership);

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

    const userMap: EventParticipantList = [currentUser];
    const attendanceTag = event.expectedAttendanceUserTag;
    if (attendanceTag && (
        attendanceTag.bandUserTagAssignments === undefined
        || attendanceTag.bandUserTagAssignments.some(assignment => assignment.bandUserId === undefined)
    )) {
        return null;
    }
    const expectedAttendanceUserTag: db3.EventResponses_ExpectedUserTag | null = attendanceTag
        ? {
            publicId: attendanceTag.publicId,
            bandUserTagAssignments: attendanceTag.bandUserTagAssignments!.map(assignment => ({
                bandUserId: assignment.bandUserId!,
            })),
        }
        : null;

    const metadataSegments: EventSearchMetadataSegment[] = event.segments.map(segment => {
        const dateRangeSpec = segment.dateRange.getSpec();
        return {
            ...segment,
            responses: segment.responses,
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
    >(metadataEvent, event.dateRange, undefined, dashboardContext, router,
        userMap,
        expectedAttendanceUserTag,
        (segment, user) => { // makeMockEventSegmentResponse
            if (!user?.publicId) return null;
            return {
                attendanceId: null,
                eventSegmentId: segment.publicId,
                publicId: null,
                bandUserId: user.membershipId,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdByUserId: null,
                updatedByUserId: null,
            }
        },
        (event, user, isInvited) => { // makeMockEventUserResponse
            if (!user?.publicId) return null;
            return {
                userComment: "",
                revision: 0,
                uid: getUniqueNegativeID().toString(),
                eventId: event.publicId,
                publicId: null,
                bandUserId: user.membershipId,
                bandInstrumentId: null,
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
    name: columnName => new DB3Client.GenericStringColumnClient({ fieldDescriptionKey: null, columnName, cellWidth: 150, fieldCaptionKey: "db3.fields.eventName", className: "titleText" }),
    startsAt: columnName => new DB3Client.EventDateRangeColumn({
        fieldCaptionKey: "db3.fields.dateRange",
        fieldDescriptionKey: null,
        startsAtColumnName: columnName,
        headerNameKey: "db3.fields.dateRange",
        durationMillisColumnName: "durationMillis",
        isAllDayColumnName: "isAllDay",
    }),
    //description: new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 150 }),
    isDeleted: columnName => new DB3Client.BoolColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.deleted", columnName }),
    locationDescription: columnName => new DB3Client.GenericStringColumnClient({ fieldDescriptionKey: null, columnName, cellWidth: 150, fieldCaptionKey: "db3.fields.location" }),
    locationURL: columnName => new DB3Client.GenericStringColumnClient({ fieldDescriptionKey: null, columnName, cellWidth: 150, fieldCaptionKey: "db3.fields.locationUrl" }),
    type: columnName => new DB3Client.ForeignSingleFieldClient<db3.EventTypeDashboardClient>({
        columnName,
        cellWidth: 150,
        fieldCaptionKey: "db3.fields.eventType",
        fieldDescriptionKey: null,
        selectStyle: "inline",
        selectionView: db3.eventTypeEditorView,
    }),
    status: columnName => new DB3Client.ForeignSingleFieldClient<db3.EventStatusDashboardClient>({ fieldDescriptionKey: null, columnName, cellWidth: 150, fieldCaptionKey: "db3.fields.status", selectionView: db3.eventStatusEditorView }),
    expectedAttendanceUserTag: columnName => new DB3Client.ForeignSingleFieldClient<db3.UserTagDashboardClient>({
        columnName,
        cellWidth: 150,
        fieldCaptionKey: "db3.fields.invitedMembers",
        fieldDescriptionKey: "event.expectedAttendanceUserTag.DescriptionMarkdown",
        selectionView: db3.bandUserTagView,
    }),
    tags: columnName => new DB3Client.TagsFieldClient<db3.EventTagAssignmentClientPayload & { eventTag: db3.EventTagDashboardClient }>({
        columnName,
        cellWidth: 150,
        fieldCaptionKey: "db3.fields.tags",
        fieldDescriptionKey: null,
        selectStyle: "inline",
        allowDeleteFromCell: false,
        selectionView: db3.bandEventTagView,
    }),

    visiblePermission: DB3Client.foreignRefFieldGen({
        fieldDescriptionKey: "event.visiblePermission.DescriptionMarkdown",
        selectionView: db3.permissionVisibilityView,
        fieldCaptionKey: "db3.fields.eventVisibility",
    }),

    createdAt: columnName => new DB3Client.CreatedAtColumn({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.createdAt", columnName, cellWidth: 150 }),
    createdByUser: columnName => new DB3Client.ForeignSingleFieldClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.createdBy", columnName, cellWidth: 120, }),

    frontpageVisible: columnName => new DB3Client.BoolColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.visibleOnFrontpage", columnName }),
    frontpageDate: columnName => new DB3Client.GenericStringColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.publicDate", columnName, cellWidth: 150 }),
    frontpageTime: columnName => new DB3Client.GenericStringColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.publicTime", columnName, cellWidth: 150 }),
    frontpageDetails: columnName => new DB3Client.MarkdownStringColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.publicDetails", columnName, cellWidth: 150 }),

    frontpageTitle: columnName => new DB3Client.GenericStringColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.publicTitle", columnName, cellWidth: 150 }),
    frontpageLocation: columnName => new DB3Client.GenericStringColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.publicLocation", columnName, cellWidth: 150 }),
    frontpageLocationURI: columnName => new DB3Client.GenericStringColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.publicLocationUrl", columnName, cellWidth: 150 }),
    frontpageTags: columnName => new DB3Client.GenericStringColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.publicTags", columnName, cellWidth: 150 }),
});

