import db, { Prisma } from "db";
import ical, { ICalCalendar, ICalCalendarMethod, ICalEvent } from "ical-generator";
import { floorLocalToLocalDay } from "shared/time";
import { DB3QueryCore2 } from "src/core/db3/server/db3QueryCore";
import * as db3 from "../db3";
import { EventCalendarInput, EventForCal, GetEventCalendarInput } from "./icalUtils";
import { MakeICalEventUid } from "../shared/apiTypes";
import { slugify } from "shared/rootroot";

interface CreateCalendarArgs {
    sourceURL: string;
};

export const createCalendar = (args: CreateCalendarArgs): ICalCalendar => {

    const calendar = ical({
        name: "Café Marché Agenda",
        prodId: {
            company: "Café Marché",
            product: "Backstage",
            language: "EN",
        },
        source: args.sourceURL, // * cal.source('http://example.com/my/original_source.ical');
        url: args.sourceURL, // * calendar.url('http://example.com/my/feed.ical'); // seems same as source
        //ttl: ,  seconds; let users decide.
        //scale: "", // ??? gregorian. calendar scale. don't use.
    });

    // publish should always be used.
    // other methods are for things like requesting meetingns, accepting meetings, etc.
    // which is why they're at the calendar level not the event level.
    calendar.method(ICalCalendarMethod.PUBLISH);

    return calendar;
};



// if user is null, it's a public access.
export const addEventToCalendar2 = (
    calendar: ICalCalendar,
    user: null | Prisma.UserGetPayload<{}>,
    event: EventCalendarInput | null,
    eventVerbose: db3.EventClientPayload_Verbose,
    eventAttendanceIdsRepresentingGoing: number[]
): ICalEvent | null => {

    if (!event) {
        return null;
    }
    //if (eventVerbose.status?.significance as db3.EventStatusSignificance)
    if (event.statusSignificance === "Cancelled") {
        return null;
    }

    // I don't have the right info here to use things like 
    // db3.GetEventResponseInfo();
    // CalculateEventMetadata
    // et al,
    // so wing it.
    const getEventUserResponse = (): null | Prisma.EventUserResponseGetPayload<{}> => {
        if (!user) return null;
        const found = eventVerbose.responses.find(u => u.userId === user.id);
        return found || null;
    };

    const isUserAttending = (userId: number): boolean => {
        return eventVerbose.segments.some(segment =>
            segment.responses.some(response =>
                response.userId === userId && response.attendanceId && eventAttendanceIdsRepresentingGoing.includes(response.attendanceId)
            )
        );
    }

    // const userSegmentResponses = eventVerbose.

    const eventUserResponse = getEventUserResponse();
    // const numberOfPositiveResponses = user == null ? 0 : (eventVerbose.segments
    //     .reduce((acc, seg) => {
    //         const userResponse = seg.responses.find(sr => sr.userId === user.id);
    //         if (!userResponse) return acc;
    //         if (!userResponse.attendanceId) return acc;
    //         const attendance = eventAttendances.find(ea => ea.id === userResponse.attendanceId);
    //         if (!attendance) return acc;
    //         if (attendance.strength < 50) return acc;
    //         return acc + 1;
    //     }, 0));

    // URI for event
    // URI for user calendar
    // URI for event calendar
    const eventURL = process.env.CMDB_BASE_URL + `backstage/event/${event.eventId}/${slugify(event.name)}`; // 

    // // for all-day events, the datetime range will return midnight of the start day.
    // // BUT this will lead to issues because of timezones. In order to output a UTC date,
    // // the time gets shifted and will likely be the previous day. For all-day events therefore,
    // // let's be precise and use an ISO string (20240517) because all-day events are not subject to
    // // time zone offsets.
    // let start: Date | string = dateRange.getStartDateTime()!;
    // let end: Date | string = dateRange.getLastDateTime()!; // this date must be IN the time range so don't use "end", use "last"
    // if (dateRange.isAllDay()) {
    //     start = prepareAllDayDateForICal(start);
    //     end = prepareAllDayDateForICal(end);
    //     // end = new Date(start);
    //     // end.setMilliseconds(start.getMilliseconds() + dateRange.getDurationMillis());
    //     //end = prepareAllDayDateForICal(end);
    // }

    let summary = `CM: ${event.name}`;
    if (user && isUserAttending(user.id)) {
        summary = `CM👍 ${event.name}`;
    }

    const calEvent = calendar.createEvent({
        allDay: event.isAllDay,
        start: event.start,
        end: event.end,
        summary: summary,//`CM: ${event.name}`,
        description: event.description,
        location: event.locationDescription,
        url: eventURL,
        status: event.calStatus,
        sequence: event.revision + (eventUserResponse?.revision || 0),

        //sequence: event.sequenceid, // not sure we really can do this well.
        // don't include organizer; this is like, for a meeting request, who would you contact to propose time changes.
        //organizer: "Carl Corcoran",// * event.organizer('Organizer\'s Name <organizer@example.com>'); 
        // don't do attendees; it complicates last modified time, may not even really be used for this purpose etc.
        // attendees: [
        //     // new ICalAttendee({
        //     // })
        // ],
        //class: "", // public | private | confidential
    });
    if (event.uid) {
        calEvent.uid(`${MakeICalEventUid(event.uid, user?.uid || null)}`);
    }

    return calEvent;
};

export const addEventToCalendar = (
    calendar: ICalCalendar,
    user: null | Prisma.UserGetPayload<{}>,
    event: EventForCal,
    eventVerbose: db3.EventClientPayload_Verbose,
    eventAttendanceIdsRepresentingGoing: number[]
): ICalEvent[] => {
    const inputs = GetEventCalendarInput(event);
    return inputs
        .map(input => addEventToCalendar2(calendar, user, input, eventVerbose, eventAttendanceIdsRepresentingGoing))
        .filter(x => !!x);
};

export interface CalExportCoreArgs1 {
    accessToken: string;
    sourceURI: string;
};

export interface CalExportCoreArgsSingleEvent extends CalExportCoreArgs1 {
    type: "event";
    eventUid: string;
};

export interface CalExportCoreArgsUpcoming extends CalExportCoreArgs1 {
    type: "upcoming";
};

type CalExportCoreArgs = CalExportCoreArgsUpcoming | CalExportCoreArgsSingleEvent;

export const CalExportCore = async ({ accessToken, type, ...args }: CalExportCoreArgs): Promise<ICalCalendar> => {
    let currentUser: null | db3.UserWithRolesPayload = null;
    if (accessToken.length > 10) {
        currentUser = await db.user.findUnique({
            where: {
                accessToken,
            },
            include: db3.UserWithRolesArgs.include,
        });
    }

    const clientIntention: db3.xTableClientUsageContext = { currentUser, intention: currentUser ? "user" : "public", mode: 'primary' };

    const table = db3.xEventVerbose;
    const minDate = floorLocalToLocalDay(new Date()); // avoid tight loop where date changes every render, by flooring to day.
    //minDate.setDate(minDate.getDate() - 1);
    minDate.setMonth(minDate.getMonth() - 12); // #226 this is a default calendar export and it should not make events disappear immediately.

    const eventsTableParams: db3.EventTableParams = {
        minDate: type === "upcoming" ? minDate : undefined,
        eventUids: type === "event" ? [(args as CalExportCoreArgsSingleEvent).eventUid] : undefined,
    };

    const eventsRaw = await DB3QueryCore2({
        clientIntention,
        tableName: table.tableName,
        tableID: table.tableID,
        filter: {
            items: [],
            tableParams: eventsTableParams,
        },
        cmdbQueryContext: `CalExportCore`,
        orderBy: undefined,
    }, currentUser);

    // don't error if 0 events. this is a calendar-of-events and 0 events is valid.

    const events = eventsRaw.items as db3.EventClientPayload_Verbose[];

    //const sourceURL = process.env.CMDB_BASE_URL + GetICalRelativeURIForUserAndEvent({ userAccessToken: currentUser?.accessToken || null, eventUid });
    const cal = createCalendar({
        sourceURL: args.sourceURI,
    });

    const eventAttendances = await db.eventAttendance.findMany();

    for (let i = 0; i < events.length; ++i) {
        const event = events[i]!;
        addEventToCalendar(cal, currentUser, event, event, eventAttendances.filter(ea => ea.strength >= 50).map(ea => ea.id));
    }

    return cal;
};
