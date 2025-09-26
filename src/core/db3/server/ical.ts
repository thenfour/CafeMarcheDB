import db, { Prisma } from "db";
import ical, { ICalCalendar, ICalCalendarMethod, ICalEvent } from "ical-generator";
import { floorLocalToLocalDay } from "shared/time";
import { DB3QueryCore2 } from "src/core/db3/server/db3QueryCore";
import * as db3 from "../db3";
import { MakeICalEventUid } from "../shared/apiTypes";
import { EventCalendarInput, EventForCal, GetEventCalendarInput } from "./icalUtils";
import { Setting } from "@/shared/settings";

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
    user: null | db3.UserForCalBackendPayload,
    event: EventCalendarInput | null,
    eventVerbose: db3.EventClientPayload_Verbose,
    eventAttendanceIdsRepresentingGoing: number[],
    siteTitlePrefix: string
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

    const eventUserResponse = getEventUserResponse();

    let summary = `${siteTitlePrefix}${event.name}`;
    if (user && isUserAttending(user.id)) {
        summary = `${siteTitlePrefix}👍 ${event.name}`;
    }

    const calEvent = calendar.createEvent({
        allDay: event.isAllDay,
        start: event.start,
        end: event.end,
        summary: summary,//`CM: ${event.name}`,
        description: `${event.eventUri}\n\n${event.description}`,
        location: event.locationDescription,
        url: event.eventUri,
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

async function GetSiteTitlePrefix(): Promise<string> {
    const setting = await db.setting.findFirst({ where: { name: Setting.Dashboard_SiteTitlePrefix } });
    if (!setting) return "CM: ";
    return setting.value;
};

export const addEventToCalendar = async (
    calendar: ICalCalendar,
    user: null | db3.UserForCalBackendPayload,
    event: EventForCal,
    eventVerbose: db3.EventClientPayload_Verbose,
    eventAttendanceIdsRepresentingGoing: number[],
    cancelledStatusIds: number[],
): Promise<ICalEvent[]> => {
    const inputs = GetEventCalendarInput(event, cancelledStatusIds)!;

    const siteTitlePrefix = await GetSiteTitlePrefix();

    return inputs
        .segments
        .map(input => addEventToCalendar2(calendar, user, input, eventVerbose, eventAttendanceIdsRepresentingGoing, siteTitlePrefix))
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
    let currentUser: null | db3.UserForCalBackendPayload = null;
    if (accessToken.length > 10) {
        currentUser = await db.user.findUnique({
            where: {
                accessToken,
            },
            ...db3.UserForCalBackendArgs,
        });
    }

    const clientIntention: db3.xTableClientUsageContext = { currentUser, intention: currentUser ? "user" : "public", mode: 'primary' };

    const table = db3.xEventVerbose;
    const minDate = floorLocalToLocalDay(new Date()); // avoid tight loop where date changes every render, by flooring to day.
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

    const cal = createCalendar({
        sourceURL: args.sourceURI,
    });

    const eventAttendances = await db.eventAttendance.findMany();

    const cancelledStatusIds = (await db.eventStatus.findMany({ select: { id: true }, where: { significance: db3.EventStatusSignificance.Cancelled } })).map(x => x.id);

    for (let i = 0; i < events.length; ++i) {
        const event = events[i]!;
        await addEventToCalendar(cal, currentUser, event, event, eventAttendances.filter(ea => ea.strength >= 50).map(ea => ea.id), cancelledStatusIds);
    }

    return cal;
};
