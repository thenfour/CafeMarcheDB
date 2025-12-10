import { DashboardContextDataBase } from "@/src/core/components/dashboardContext/dashboardContextTypes";
import * as db3 from "@db3/db3";


////////////////////////////////////////////////////////////////

export type fn_makeMockEventSegmentResponse<TEventSegment extends db3.EventResponses_MinimalEventSegment, TSegmentResponse extends db3.EventResponses_MinimalEventSegmentUserResponse,> =
    (segment: TEventSegment, user: db3.UserWithInstrumentsPayload) => TSegmentResponse | null;

export type fn_makeMockEventUserResponse<TEvent extends db3.EventResponses_MinimalEvent, TEventResponse extends db3.EventResponses_MinimalEventUserResponse> =
    (event: TEvent, user: db3.UserWithInstrumentsPayload, isInvited: boolean) => TEventResponse | null;


export type UserInstrumentList = db3.UserWithInstrumentsPayload[];

export interface GetEventResponseForSegmentAndUserArgs<
    TEventSegment extends db3.EventResponses_MinimalEventSegment,
    TSegmentResponse extends db3.EventResponses_MinimalEventSegmentUserResponse,
> {
    user: db3.UserWithInstrumentsPayload;
    segment: TEventSegment;
    expectedAttendanceTag: db3.EventResponses_ExpectedUserTag | null;
    makeMockEventSegmentResponse: fn_makeMockEventSegmentResponse<TEventSegment, TSegmentResponse>;
};

export function createMockEventSegmentUserResponse
    <
        TEventSegment extends db3.EventResponses_MinimalEventSegment,
        TSegmentResponse extends db3.EventResponses_MinimalEventSegmentUserResponse,
    >(
        args: GetEventResponseForSegmentAndUserArgs<TEventSegment, TSegmentResponse>
    )
    : db3.EventSegmentUserResponse<TEventSegment, TSegmentResponse> | null {
    let expectAttendance: boolean = false;
    if (args.expectedAttendanceTag) {
        expectAttendance = !!args.expectedAttendanceTag.userAssignments.find(ua => ua.userId === args.user.id);
    }

    // // mock response when none exists
    // const mockResponse = args.createMockResponse(args.segment, args.user) : EventResponses_MinimalEventSegmentUserResponse = {
    //     attendanceId: null,
    //     //eventSegmentId: args.segment.id,
    //     //eventSegment: args.segment,
    //     id: -1,
    //     //user: args.user,
    //     userId: args.user.id,
    // };
    const resp = args.makeMockEventSegmentResponse(args.segment, args.user);
    if (!resp) return null;

    return {
        segment: args.segment,
        user: args.user,
        response: resp,
    };
};



export function getUserPrimaryInstrument(user: db3.UserWithInstrumentsPayload, data: DashboardContextDataBase): (db3.InstrumentPayload | null) {
    if (user.instruments.length < 1) return null;
    const p = user.instruments.find(i => i.isPrimary);
    if (p) {
        return data.instrument.getById(p.instrumentId);
    }
    return data.instrument.getById(user.instruments[0]!.instrumentId);
}

export function getInstrumentForEventUserResponse<TEventResponse extends db3.EventResponses_MinimalEventUserResponse>(response: TEventResponse, userId: number, data: DashboardContextDataBase, users: UserInstrumentList): (db3.InstrumentPayload | null) {
    if (response.instrumentId != null) {
        return data.instrument.getById(response.instrumentId);
    }
    const ret = getUserPrimaryInstrument(users.find(u => u.id === userId)!, data);
    return ret;
};


export interface createMockEventUserResponseArgs<TEvent extends db3.EventResponses_MinimalEvent, TEventResponse extends db3.EventResponses_MinimalEventUserResponse> {
    userId: number,
    event: TEvent;
    defaultInvitees: Set<number>;
    data: DashboardContextDataBase;
    users: UserInstrumentList;
    makeMockEventUserResponse: fn_makeMockEventUserResponse<TEvent, TEventResponse>;
};

export function createMockEventUserResponse<TEvent extends db3.EventResponses_MinimalEvent, TResponse extends db3.EventResponses_MinimalEventUserResponse>(
    args: createMockEventUserResponseArgs<TEvent, TResponse>
): db3.EventUserResponse<TEvent, TResponse> | null {
    const invitedByDefault: boolean = args.defaultInvitees.has(args.userId);
    const user = args.users.find(u => u.id === args.userId)!;

    // mock response when none exists
    const mockResponse = args.makeMockEventUserResponse(args.event, user, invitedByDefault);
    if (!mockResponse) return null;
    //     const mockResponse: EventUserResponsePayload = {
    //         userComment: "",
    //     eventId: event.id,
    //     id: -1,
    //     user,
    //     userId: user.id,
    //     instrument: null,
    //     instrumentId: null,
    //     isInvited: invitedByDefault,
    // };

    return {
        user,
        event: args.event,
        isInvited: invitedByDefault,
        isRelevantForDisplay: invitedByDefault,
        instrument: getInstrumentForEventUserResponse(mockResponse, args.userId, args.data, args.users),
        response: mockResponse,
    };
};

// who's relevant? it's not 100% clear how to handle certain cases.
// there should be 2 stages to the decision: is the user invited, and what is their answer?
// first, how to decide if a user is invited?
// it's based on if they have the expected attendance user tag and if it's been specified in EventSegmentUserResponse.expectAttendance.
// this is basically coalesce(Response.ExpectAttendance, hasusertag)
//
// HasUserTag    Response.ExpectAttendance    Invited
// no            no                           = no (explicit)
// no            yes                          = yes (explicit)
// no            null                         = no (use hasusertag)
// yes           no                           = no (explicit -- in this case the user has been explicitly uninvited)
// yes           yes                          = yes (explicit, redundant)
// yes           null                         = yes (use hasusertag)
// 
// INVITED?   ANSWER       RELEVANCE
// no         null         = no
// no         notgoing     = no. but questionable. "no" because it's redundant and unhelpful.
// no         going        = yes. but should be alerted.
// yes        null         = yes
// yes        notgoing     = yes
// yes        going        = yes
//

export function getEventSegmentResponseForSegmentAndUser<
    TEventSegment extends db3.EventResponses_MinimalEventSegment,
    TSegmentResponse extends db3.EventResponses_MinimalEventSegmentUserResponse,
>(args: GetEventResponseForSegmentAndUserArgs<TEventSegment, TSegmentResponse>)
    : db3.EventSegmentUserResponse<TEventSegment, TSegmentResponse> | null {
    console.assert(!!args.segment.responses);

    let expectAttendance: boolean = false;
    if (args.expectedAttendanceTag) {
        expectAttendance = !!args.expectedAttendanceTag.userAssignments.find(ua => ua.userId === args.user.id);
    }

    const responseNullable = args.segment.responses.find(r => r.userId === args.user.id);
    if (!!responseNullable) {
        // makes the assumption that the caller has properly typed TSegmentResponse as the result of TSegment.responses[n]
        const response = responseNullable as unknown as TSegmentResponse;
        return {
            segment: args.segment,
            user: args.user,
            response,
        };
    }

    return createMockEventSegmentUserResponse(args);
};


export interface GetEventResponseForUserArgs<
    TEvent extends db3.EventResponses_MinimalEvent,
    TEventResponse extends db3.EventResponses_MinimalEventUserResponse
> {
    user: db3.UserWithInstrumentsPayload;
    event: TEvent;
    defaultInvitationUserIds: Set<number>;
    data: DashboardContextDataBase;
    userMap: UserInstrumentList;
    makeMockEventUserResponse: fn_makeMockEventUserResponse<TEvent, TEventResponse>;
};


export function getEventResponseForUser<TEvent extends db3.EventResponses_MinimalEvent,
    TEventResponse extends db3.EventResponses_MinimalEventUserResponse
>({ event, user, defaultInvitationUserIds, data, userMap, makeMockEventUserResponse }: GetEventResponseForUserArgs<TEvent, TEventResponse>): db3.EventUserResponse<TEvent, TEventResponse> | null {
    const response = event.responses.find(r => r.userId === user.id);
    if (response) {
        const isInvited = response.isInvited || defaultInvitationUserIds.has(user.id); // #162 default invitation overrides "uninvite"
        const instrument = getInstrumentForEventUserResponse(response, user.id, data, userMap);
        return {
            isInvited,
            event,
            user,
            instrument,
            response: response as unknown as TEventResponse, // ASSUMES TEventResponse is type of TEvent.responses[x]
            isRelevantForDisplay: false, // calculated later.
        };
    }

    return createMockEventUserResponse({ event, defaultInvitees: defaultInvitationUserIds, userId: user.id, data, users: userMap, makeMockEventUserResponse });
};




export interface EventResponseInfoBase<
    TEvent extends db3.EventResponses_MinimalEvent,
    TEventSegment extends db3.EventResponses_MinimalEventSegment,
    TEventResponse extends db3.EventResponses_MinimalEventUserResponse,
    TSegmentResponse extends db3.EventResponses_MinimalEventSegmentUserResponse,
> {
    event: TEvent;
    allEventResponses: db3.EventUserResponse<TEvent, TEventResponse>[];
    allSegmentResponses: db3.EventSegmentUserResponse<TEventSegment, TSegmentResponse>[];
    distinctUsers: db3.UserWithInstrumentsPayload[];
    expectedAttendanceTag: db3.EventResponses_ExpectedUserTag | null;
    defaultInvitationUserIds: Set<number>;

    makeMockEventSegmentResponse: fn_makeMockEventSegmentResponse<TEventSegment, TSegmentResponse>;
    makeMockEventUserResponse: fn_makeMockEventUserResponse<TEvent, TEventResponse>;

};

export class EventResponseInfo<
    TEvent extends db3.EventResponses_MinimalEvent,
    TEventSegment extends db3.EventResponses_MinimalEventSegment,
    TEventResponse extends db3.EventResponses_MinimalEventUserResponse,
    TSegmentResponse extends db3.EventResponses_MinimalEventSegmentUserResponse,
>
    implements EventResponseInfoBase<TEvent, TEventSegment, TEventResponse, TSegmentResponse> {
    event: TEvent;
    allEventResponses: db3.EventUserResponse<TEvent, TEventResponse>[];
    allSegmentResponses: db3.EventSegmentUserResponse<TEventSegment, TSegmentResponse>[];
    distinctUsers: db3.UserWithInstrumentsPayload[];
    expectedAttendanceTag: db3.EventResponses_ExpectedUserTag | null;
    defaultInvitationUserIds: Set<number>;

    makeMockEventSegmentResponse: fn_makeMockEventSegmentResponse<TEventSegment, TSegmentResponse>;
    makeMockEventUserResponse: fn_makeMockEventUserResponse<TEvent, TEventResponse>;

    constructor(args: EventResponseInfoBase<TEvent, TEventSegment, TEventResponse, TSegmentResponse>, data: DashboardContextDataBase, users: UserInstrumentList) {
        Object.assign(this, args);

        // populate calculated stuff
        this.allEventResponses.forEach(r => {
            // relevant for display = invited OR is maybe going
            const segmentResponses = this.getResponsesBySegmentForUser(r.user);
            const segmentEntries = Object.entries(segmentResponses);

            const isMaybeGoing = segmentEntries.some(e => {
                const a = data.eventAttendance.getById(e[1].response.attendanceId);
                return a && (a.strength > 0);

            });

            r.isRelevantForDisplay = isMaybeGoing || r.isInvited;
        });
    };

    // ALWAYS returns a response. if doesn't exist in the list then a mock one is created.
    getResponseForUserAndSegment({ user, segment }: { user: db3.UserWithInstrumentsPayload, segment: TEventSegment }):
        db3.EventSegmentUserResponse<TEventSegment, TSegmentResponse> | null {
        const f = this.allSegmentResponses.find(resp => resp.user.id === user.id && resp.segment.id === segment.id);
        if (f) return f;
        return createMockEventSegmentUserResponse({ expectedAttendanceTag: this.expectedAttendanceTag, user, segment, makeMockEventSegmentResponse: this.makeMockEventSegmentResponse });
    };

    // returns responses for all event segments
    getResponsesBySegmentForUser = (user: db3.UserWithInstrumentsPayload): Record<number, db3.EventSegmentUserResponse<TEventSegment, TSegmentResponse>> => {
        const ret: Record<number, db3.EventSegmentUserResponse<TEventSegment, TSegmentResponse>> = {};
        this.event.segments.forEach(segment1 => {
            const segment = segment1 as unknown as TEventSegment; // assumes TEventSegment is type of TEvent.segment[n]
            const resp = this.getResponseForUserAndSegment({ user, segment });
            if (resp) {
                ret[segment.id] = resp;
            }
        });
        return ret;
    };

    getResponsesForSegment = (segmentId: number) => this.allSegmentResponses.filter(r => r.segment.id === segmentId);

    getEventResponseForUser = (user: db3.UserWithInstrumentsPayload, data: DashboardContextDataBase, userMap: UserInstrumentList) => {
        const ret = this.allEventResponses.find(r => r.user.id === user.id);
        if (!ret) return createMockEventUserResponse({ event: this.event, defaultInvitees: this.defaultInvitationUserIds, data, users: userMap, userId: user.id, makeMockEventUserResponse: this.makeMockEventUserResponse });
        return ret;
    }
};



// calculate responses for each user who is invited OR has a response.
// requires verbose view of event
interface EventResponsesPerUserArgs<
    TEvent extends db3.EventResponses_MinimalEvent,
    TEventResponse extends db3.EventResponses_MinimalEventUserResponse,
    TEventSegment extends db3.EventResponses_MinimalEventSegment,
    TSegmentResponse extends db3.EventResponses_MinimalEventSegmentUserResponse,
> {
    event: TEvent;
    expectedAttendanceTag: db3.EventResponses_ExpectedUserTag | null;
    data: DashboardContextDataBase;
    userMap: UserInstrumentList;

    makeMockEventSegmentResponse: fn_makeMockEventSegmentResponse<TEventSegment, TSegmentResponse>;
    makeMockEventUserResponse: fn_makeMockEventUserResponse<TEvent, TEventResponse>;

};

// returns array of response info per user. so each element has unique user.
export function GetEventResponseInfo<
    TEvent extends db3.EventResponses_MinimalEvent,
    TEventSegment extends db3.EventResponses_MinimalEventSegment,
    TEventResponse extends db3.EventResponses_MinimalEventUserResponse,
    TSegmentResponse extends db3.EventResponses_MinimalEventSegmentUserResponse,
>
    ({ event, expectedAttendanceTag, data, userMap, makeMockEventSegmentResponse, makeMockEventUserResponse }: EventResponsesPerUserArgs<TEvent, TEventResponse, TEventSegment, TSegmentResponse>
    ):
    (null | EventResponseInfo<TEvent, TEventSegment, TEventResponse, TSegmentResponse>) {
    if (!event.segments) return null; // limited users don't see segments.

    let defaultInvitationUserIds = new Set<number>();

    // calculate a list of potentially relevant users to all segments of the event.
    const users: db3.UserWithInstrumentsPayload[] = [];
    if (expectedAttendanceTag) {
        defaultInvitationUserIds = new Set<number>(expectedAttendanceTag.userAssignments.map(ua => ua.userId));
        expectedAttendanceTag.userAssignments.forEach(ua => {
            const user = userMap.find(u => u.id === ua.userId);
            if (user) {
                users.push(user);
            }
        });
    }
    event.segments.forEach((seg) => {
        // get user ids for this segment
        seg.responses.forEach(resp => {
            if (users.find(u => u.id === resp.userId) == null) { // doesn't already exist
                const mapUser = userMap.find(u => u.id === resp.userId);
                if (!mapUser) {
                    // console.log(`resp.userId=${resp.userId}`);
                    // console.log(userMap);
                    // throw new Error("your user map is missing someone. check console for requested user, and usermap");
                } else {
                    users.push(mapUser);
                }
            }
        });
    });
    event.responses.forEach((eventResponse) => {
        // if (users.find(u => u.id === eventResponse.userId) == null) {
        //     users.push(userMap.find(u => u.id === eventResponse.userId)!);
        // }
        if (users.find((u) => {
            return u.id === eventResponse.userId;
        }) == null) {
            const mappedUser = userMap.find(u => u.id === eventResponse.userId);
            if (!mappedUser) {
                // console.log(`resp.userId=${eventResponse.userId}`);
                // console.log(userMap);
                // throw new Error("your user map is missing someone. check console for requested user, and usermap");
            } else {
                users.push(mappedUser);
            }
        }
    });

    const allSegmentResponses: db3.EventSegmentUserResponse<TEventSegment, TSegmentResponse>[] = [];
    // for each segment, for all users, generate a response.
    for (let iseg = 0; iseg < event.segments.length; ++iseg) {
        const segment = event.segments[iseg]!;
        const segAsT = segment as unknown as TEventSegment; // type assumption

        users.forEach(user => {
            const resp = getEventSegmentResponseForSegmentAndUser({
                user,
                segment: segAsT,
                expectedAttendanceTag,
                makeMockEventSegmentResponse,
            });
            if (resp) {
                allSegmentResponses.push(resp);
            }
        });

    }

    const allEventResponses: db3.EventUserResponse<TEvent, TEventResponse>[] = [];

    users.forEach(user => {
        const resp = getEventResponseForUser({
            user,
            event,
            defaultInvitationUserIds,
            data,
            makeMockEventUserResponse,
            userMap,
        });
        if (resp) allEventResponses.push(resp);
    });

    return new EventResponseInfo({
        event,
        defaultInvitationUserIds,
        expectedAttendanceTag,
        distinctUsers: users,
        allSegmentResponses,
        allEventResponses,
        makeMockEventSegmentResponse,
        makeMockEventUserResponse,
    }, data, userMap);

};
