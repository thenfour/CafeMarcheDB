import type { EventAttendancePublicId } from "shared/publicId";
import { loadUserAuthorization } from "@/src/auth/server/requestAuthorization";
import db, { Prisma } from "db";
import ical, { ICalCalendar, ICalCalendarMethod, ICalEvent } from "ical-generator";
import { floorLocalToLocalDay } from "shared/time";
import { queryTable } from "src/core/db3/server/db3QueryCore";
import * as db3 from "../db3";
import { MakeICalEventUid } from "../shared/apiTypes";
import { EventCalendarInput, GetEventCalendarInput } from "./icalUtils";
import { Setting } from "@/shared/settingKeys";
import { isAttendanceGoing } from "shared/eventAttendance";
import { isUserInvitedToEvent } from "shared/eventInvitation";
import { loadUserSettings } from "src/auth/server/userSettings";
import { shouldIncludeEventInCalendarFeed } from "../shared/calendarAttendance";
import { loadBandTimeZone } from "@/src/server/bandTimeZone";
import type { EventStatusPublicId } from "shared/publicId";

interface ICalSettings {
    calendarName: string;
    calendarCompany: string;
    calendarProduct: string;
    eventNamePrefix: string;
};

async function GetICalSettings(): Promise<ICalSettings> {
    const calendarName = await db.setting.findFirst({ where: { name: Setting.Ical_CalendarName } });
    const calendarCompany = await db.setting.findFirst({ where: { name: Setting.Ical_CalendarCompany } });
    const calendarProduct = await db.setting.findFirst({ where: { name: Setting.Ical_CalendarProduct } });
    const eventNamePrefix = await db.setting.findFirst({ where: { name: Setting.Ical_CalendarEventPrefix } });

    return {
        calendarName: calendarName?.value || "Café Marché Agenda",
        calendarCompany: calendarCompany?.value || "Café Marché",
        calendarProduct: calendarProduct?.value || "Backstage",
        eventNamePrefix: eventNamePrefix?.value || "CM: ",
    };
};

interface CreateCalendarArgs {
    icalSettings: ICalSettings;
};

export const createCalendar = async (args: CreateCalendarArgs): Promise<ICalCalendar> => {

    const calendar = ical({
        name: args.icalSettings.calendarName,
        prodId: {
            company: args.icalSettings.calendarCompany,
            product: args.icalSettings.calendarProduct,
            language: "EN",
        },
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
    eventAttendanceIdsRepresentingGoing: EventAttendancePublicId[],
    icalSettings: ICalSettings
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

    let summary = `${icalSettings.eventNamePrefix}${event.name}`;
    if (user && isUserAttending(user.id)) {
        summary = `${icalSettings.eventNamePrefix}👍 ${event.name}`;
    }

    // RFC 5545 sections 3.6.1/3.8.2.2
    // https://datatracker.ietf.org/doc/html/rfc5545#section-3.6.1
    // iCalendar has second precision and
    // represent a timed point by omitting DTEND, which must otherwise be later
    // than DTSTART. Keep exact input bounds for hashing and other consumers.

    // so basically, if the event ends in the same second it starts, DTEND needs to be omitted.
    // it's considered a point event if it's less than 1 second long.
    const endsInStartSecond = !event.isAllDay
        && Math.floor(event.end.valueOf() / 1000) === Math.floor(event.start.valueOf() / 1000);
    const calEvent = calendar.createEvent({
        allDay: event.isAllDay,
        start: event.start,
        end: endsInStartSecond ? undefined : event.end,
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

export const addEventToCalendar = async (
    calendar: ICalCalendar,
    user: null | db3.UserForCalBackendPayload,
    event: db3.EventClientPayload_Verbose,
    eventVerbose: db3.EventClientPayload_Verbose,
    eventAttendanceIdsRepresentingGoing: EventAttendancePublicId[],
    cancelledStatusIds: EventStatusPublicId[],
    icalSettings: ICalSettings,
    bandTimeZone: string,
): Promise<ICalEvent[]> => {
    const inputs = GetEventCalendarInput(event, cancelledStatusIds, bandTimeZone)!;

    return inputs
        .segments
        .map(input => addEventToCalendar2(calendar, user, input, eventVerbose, eventAttendanceIdsRepresentingGoing, icalSettings))
        .filter(x => !!x);
};

export interface CalExportCoreArgs1 {
    currentUser: db3.UserForCalBackendPayload;
};

export interface CalExportCoreArgsSingleEvent extends CalExportCoreArgs1 {
    type: "event";
    eventUid: string;
};

export interface CalExportCoreArgsUpcoming extends CalExportCoreArgs1 {
    type: "upcoming";
};

type CalExportCoreArgs = CalExportCoreArgsUpcoming | CalExportCoreArgsSingleEvent;

export const CalExportCore = async ({ currentUser, type, ...args }: CalExportCoreArgs): Promise<ICalCalendar> => {


    const table = db3.xEventVerbose;
    const minDate = floorLocalToLocalDay(new Date()); // avoid tight loop where date changes every render, by flooring to day.
    minDate.setMonth(minDate.getMonth() - 12); // #226 this is a default calendar export and it should not make events disappear immediately.

    const eventsTableParams: db3.EventTableParams = {
        minDate: type === "upcoming" ? minDate : undefined,
        eventUids: type === "event" ? [(args as CalExportCoreArgsSingleEvent).eventUid] : undefined,
    };

    const authorization = await loadUserAuthorization(currentUser);
    const { eventsRaw, bandTimeZone } = await db.$transaction(async tx => {
        const bandTimeZone = await loadBandTimeZone(tx);
        const eventsRaw = await queryTable({
            table,
            filter: {
                tableParams: eventsTableParams,
            },
            cmdbQueryContext: `CalExportCore`,
            orderBy: undefined,
        }, authorization, tx);
        return { eventsRaw, bandTimeZone };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30_000 });

    // don't error if 0 events. this is a calendar-of-events and 0 events is valid.

    const events = eventsRaw.items as db3.EventClientPayload_Verbose[];

    const settings = await GetICalSettings();

    const cal = await createCalendar({
        icalSettings: settings,
    });

    // These reference rows interpret existing event data; soft deletion makes
    // an option unavailable for future selection but does not erase its meaning.
    const eventAttendances = await db.eventAttendance.findMany();

    const cancelledStatusIds = (await db.eventStatus.findMany({
        select: { publicId: true },
        where: { significance: db3.EventStatusSignificance.Cancelled },
    })).map(status => db3.xEventStatus.parseIdentity(status.publicId));
    const userSettings = await loadUserSettings(currentUser.id);
    const attendanceById = new Map(eventAttendances.map(
        attendance => [
            db3.xEventAttendance.parseIdentity(attendance.publicId),
            attendance
        ]));
    const cancelledStatuses = new Set(cancelledStatusIds);
    const goingAttendanceIds = eventAttendances
        .filter(isAttendanceGoing)
        .map(attendance => db3.xEventAttendance.parseIdentity(attendance.publicId));

    for (let i = 0; i < events.length; ++i) {
        const event = events[i]!;
        const defaultInviteeUserIds = new Set(event.expectedAttendanceUserTag?.userAssignments.map(assignment => assignment.userId));
        if (!shouldIncludeEventInCalendarFeed({
            userId: currentUser.id,
            showDeclinedEvents: userSettings["calendar.showDeclinedEvents"],
            showUninvitedEvents: userSettings["calendar.showUninvitedEvents"],
            isInvited: isUserInvitedToEvent({
                userId: currentUser.id,
                defaultInvitationUserIds: defaultInviteeUserIds,
                responses: event.responses,
            }),
            segments: event.segments,
            cancelledStatusIds: cancelledStatuses,
            attendanceById,
        })) continue;
        await addEventToCalendar(cal, currentUser, event, event, goingAttendanceIds, cancelledStatusIds, settings, bandTimeZone);
    }

    return cal;
};
