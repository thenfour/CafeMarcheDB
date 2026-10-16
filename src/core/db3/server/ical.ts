import db from "db";
import ical, { ICalCalendarMethod, type ICalCalendar, type ICalEvent } from "ical-generator";
import { isAttendanceGoing } from "shared/eventAttendance";
import type { EventPublicId, EventSegmentPublicId } from "shared/publicId";
import { parsePublicId } from "shared/publicId";
import { resolveActiveCalendarFeedUser } from "src/auth/server/calendarFeedSubscription";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { getServerBandHostingConfig, portalHref } from "src/route/portalRouting";
import { readSettingSnapshot, type SettingsSnapshot } from "src/setting/shared/settingsContract";
import { MakeICalEventUid } from "../shared/apiTypes";
import { shouldIncludeEventInCalendarFeed } from "../shared/calendarAttendance";
import { CalendarExportSchema, type CalendarExportArgs } from "../shared/calendarFeed";
import { readCalendarFeedInTransaction } from "./calendarFeedRead";
import type { DB3ReadRootDatabase } from "./db3ReadExecution";
import { GetEventCalendarInput, type EventCalendarInput } from "./icalUtils";

interface ICalSettings {
    calendarName: string;
    calendarCompany: string;
    calendarProduct: string;
    eventNamePrefix: string;
};

function getICalSettings(settings: SettingsSnapshot): ICalSettings {
    return {
        calendarName: readSettingSnapshot(settings, "band", "ical.calendarName"),
        calendarCompany: readSettingSnapshot(settings, "band", "ical.calendarCompany"),
        calendarProduct: readSettingSnapshot(settings, "band", "ical.calendarProduct"),
        eventNamePrefix: readSettingSnapshot(settings, "band", "ical.calendarEventPrefix"),
    };
};

interface CreateCalendarArgs {
    icalSettings: ICalSettings;
    localeTag?: string;
};

export const createCalendar = async (args: CreateCalendarArgs): Promise<ICalCalendar> => {

    const calendar = ical({
        name: args.icalSettings.calendarName,
        prodId: {
            // Band metadata may be blank; RFC product identifiers still require both parts.
            company: args.icalSettings.calendarCompany.trim() || "CMDB",
            product: args.icalSettings.calendarProduct.trim() || "Calendar",
            language: new Intl.Locale(args.localeTag ?? "en-US").language.toUpperCase(),
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



export interface CalendarEventPersonalization {
    subscriberUid: string | null;
    responseRevision: number;
    isAttending: boolean;
}

export function addEventToCalendar2(
    calendar: ICalCalendar,
    personalization: CalendarEventPersonalization | null,
    event: EventCalendarInput<number | EventSegmentPublicId, number | EventPublicId> | null,
    icalSettings: ICalSettings,
): ICalEvent | null {
    if (!event || event.statusSignificance === "Cancelled") {
        return null;
    }
    // RFC 5545 requires DTEND after DTSTART. Timed points omit DTEND; input bounds stay exact.
    const endsInStartSecond = !event.isAllDay
        && Math.floor(event.end.valueOf() / 1000) === Math.floor(event.start.valueOf() / 1000);
    const calEvent = calendar.createEvent({
        allDay: event.isAllDay, start: event.start, end: endsInStartSecond ? undefined : event.end,
        summary: `${icalSettings.eventNamePrefix}${personalization?.isAttending ? "\u{1F44D} " : ""}${event.name}`,
        description: `${event.eventUri}\n\n${event.description}`, location: event.locationDescription,
        url: event.eventUri, status: event.calStatus,
        sequence: event.revision + (personalization?.responseRevision ?? 0),
    });
    if (event.uid) {
        calEvent.uid(MakeICalEventUid(event.uid, personalization?.subscriberUid ?? null));
    }
    return calEvent;
}

type CalendarFeedSnapshot = Awaited<ReturnType<typeof readCalendarFeedInTransaction>>;

function renderCalendarEvent(calendar: ICalCalendar, event: CalendarFeedSnapshot["events"][number],
    snapshot: CalendarFeedSnapshot, settings: ICalSettings,
): void {
    const response = event.responses[0];
    const isInvited = event.expectedAttendanceUserTag?.bandUserTagAssignments.length
        ? true : response?.isInvited === true;
    const attendanceById = new Map(snapshot.attendance.map(row => [row.id, row]));
    // These policy helpers use a generic identity; each private feed contains only its subscriber's BandUser answers.
    const membershipIdentity = snapshot.membershipId;
    const segments = event.segments.map(segment => ({
        ...segment,
        responses: segment.responses.map(answer => ({ ...answer, userId: membershipIdentity })),
    }));
    if (!shouldIncludeEventInCalendarFeed({
        userId: membershipIdentity, isInvited, segments,
        showDeclinedEvents: readSettingSnapshot(snapshot.settingsSnapshot, "user", "calendar.showDeclinedEvents"),
        showUninvitedEvents: readSettingSnapshot(snapshot.settingsSnapshot, "user", "calendar.showUninvitedEvents"),
        cancelledStatusIds: new Set(snapshot.cancelledStatusIds), attendanceById,
    })) {
        return;
    }
    const personalization: CalendarEventPersonalization = {
        subscriberUid: snapshot.subscriber.uid, responseRevision: response?.revision ?? 0,
        isAttending: event.segments.some(segment => segment.responses.some(answer =>
            answer.attendanceId != null && isAttendanceGoing(attendanceById.get(answer.attendanceId)))),
    };
    const inputs = GetEventCalendarInput({
        ...event, id: parsePublicId<"Event">(event.publicId),
        segments: event.segments.map(segment => ({ ...segment, id: parsePublicId<"EventSegment">(segment.publicId) })),
    }, snapshot.cancelledStatusIds, snapshot.bandTimeZone);
    for (const input of inputs?.segments ?? []) {
        const uri = new URL(input.eventUri);
        const path = portalHref(`${uri.pathname}${uri.search}${uri.hash}`, { bandPublicId: snapshot.bandPublicId }, getServerBandHostingConfig());
        addEventToCalendar2(calendar, personalization, { ...input, eventUri: new URL(path, uri.origin).href }, settings);
    }
}

async function renderCalendarFeed(snapshot: CalendarFeedSnapshot): Promise<ICalCalendar> {
    const settings = getICalSettings(snapshot.settingsSnapshot);
    const calendar = await createCalendar({ icalSettings: settings, localeTag: snapshot.localeTag });
    for (const event of snapshot.events) {
        renderCalendarEvent(calendar, event, snapshot, settings);
    }
    return calendar;
}

export type CalExportCoreArgs = CalendarExportArgs & { currentUser: { id: number } };

export function CalExportCore(input: CalExportCoreArgs, database: DB3ReadRootDatabase = db): Promise<ICalCalendar> {
    const { currentUser, ...context } = input;
    const args = CalendarExportSchema.parse(context);
    return database.$transaction(async transaction => {
        const auth = await loadAuthorizationForUser(currentUser, transaction, args.bandPublicId);
        return renderCalendarFeed(await readCalendarFeedInTransaction(transaction, auth, args));
    }, { isolationLevel: "RepeatableRead", timeout: 30_000 });
}

export function exportCalendarFeedForToken(calendarFeedToken: string, context: CalendarExportArgs,
    database: DB3ReadRootDatabase = db,
) {
    const args = CalendarExportSchema.parse(context);
    return database.$transaction(async transaction => {
        // Credential, principal, membership, grants, settings and content share one snapshot.
        const user = await resolveActiveCalendarFeedUser(calendarFeedToken, transaction);
        const auth = await loadAuthorizationForUser(user, transaction, args.bandPublicId);
        const snapshot = await readCalendarFeedInTransaction(transaction, auth, args);
        return { calendar: await renderCalendarFeed(snapshot), userId: snapshot.userId, actionContext: snapshot.actionContext };
    }, { isolationLevel: "RepeatableRead", timeout: 30_000 });
}
