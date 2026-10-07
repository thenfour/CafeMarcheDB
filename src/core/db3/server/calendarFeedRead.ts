import { Prisma } from "@prisma/client";
import { CalendarDate } from "shared/dateTimePolicy";
import { Permission } from "shared/permissions";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { loadBandTimeZone } from "src/server/bandTimeZone";
import { loadSettingsSnapshot } from "src/setting/server/settings";
import { readSettingSnapshot } from "src/setting/shared/settingsContract";
import { CalendarExportSchema, type CalendarExportArgs } from "../shared/calendarFeed";
import { GetUserVisibilityWhereExpression } from "./db3Helpers";
import { requireAttendanceRead, visibleAttendanceEvents } from "./eventAttendancePolicy";
import { EventSegmentForCalArgs, EventSongListForCalArgs } from "./icalUtils";

function calendarEventSelection(auth: CMServerAuthorization) {
    const bandId = auth.requireBand().id;
    const bandUserId = auth.requireMembership().id;
    const visibleContent = { bandId, ...GetUserVisibilityWhereExpression({ auth, createdByUserIDColumnName: "createdByUserId" }) };
    return Prisma.validator<Prisma.EventDefaultArgs>()({
        select: {
            publicId: true,
            name: true,
            revision: true,
            locationDescription: true,
            locationURL: true,
            status: { select: { significance: true } },
            responses: {
                where: { bandUserId },
                select: { revision: true, isInvited: true }
            },
            segments: {
                orderBy: [{ startsAt: "asc" }, { id: "asc" }],
                select: {
                    ...EventSegmentForCalArgs.select,
                    publicId: true,
                    responses: {
                        where: { bandUserId },
                        select: { attendanceId: true }
                    },
                },
            },
            expectedAttendanceUserTag: {
                where: { bandId },
                select: {
                    bandUserTagAssignments: {
                        where: { bandUserId },
                        select: { publicId: true }
                    }
                },
            },
            songLists: {
                orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                select: {
                    ...EventSongListForCalArgs.select,
                    songs: {
                        ...EventSongListForCalArgs.select.songs,
                        where: {
                            song: { ...visibleContent, isDeleted: false },
                            // Song contents require their own read capability, even within a visible event.
                            ...(auth.hasPermission(Permission.view_songs) ? {} : { id: { in: [] } }),
                        },
                    },
                },
            },
            descriptionWikiPage: {
                where: {
                    ...visibleContent,
                    ...(auth.hasPermission(Permission.view_wiki_pages) && auth.hasPermission(Permission.view_wiki_page_revisions) ? {} : { id: { in: [] } }),
                },
                select: {
                    currentRevision: {
                        where: { wikiPage: visibleContent },
                        select: { content: true }
                    }
                },
            },
        },
    });
}

export type CalendarFeedEvent = Prisma.EventGetPayload<ReturnType<typeof calendarEventSelection>>;

// return the oldest date we want to include in the calendar feed.
function oldestCalendarDate(now: Date, bandTimeZone: string): Date {
    const today = CalendarDate.fromInstant({ value: now, timeZone: bandTimeZone }).date;
    const marker = new Date(`${today}T00:00:00Z`);
    const originalMonth = marker.getUTCMonth();
    marker.setUTCFullYear(marker.getUTCFullYear() - 1);
    if (marker.getUTCMonth() !== originalMonth) {
        marker.setUTCDate(0);
    }
    return new CalendarDate(marker.toISOString().slice(0, 10), bandTimeZone).toStartInstant();
}

/** expects to be called in a transaction */
export async function readCalendarFeedInTransaction(
    database: Prisma.TransactionClient,
    authorization: CMServerAuthorization,
    input: CalendarExportArgs,
    now = new Date(), // for  unit tests
) {
    const args = CalendarExportSchema.parse(input);
    const auth = (await authorization.refresh(database)).requireUser();
    const bandId = requireAttendanceRead(auth, args.bandPublicId);
    const membership = auth.requireMembership();
    const [
        bandTimeZone,
        settingsSnapshot,
        subscriber,
        attendance,
        cancelledStatuses
    ] = await Promise.all([
        loadBandTimeZone(database, bandId),
        loadSettingsSnapshot(database, auth),
        database.user.findUniqueOrThrow({ where: { id: auth.userId }, select: { uid: true } }),
        database.eventAttendance.findMany({ select: { id: true, strength: true } }),// Retired choices and statuses retain their historical meaning in feeds.
        database.eventStatus.findMany({ where: { significance: "Cancelled" }, select: { id: true } }),
    ]);
    const events = await database.event.findMany({
        ...calendarEventSelection(auth),
        where: {
            AND: [visibleAttendanceEvents(auth), args.type === "event" ? { uid: args.eventUid } : {
                OR: [{ endDateTime: { gte: oldestCalendarDate(now, bandTimeZone) } }, { endDateTime: null }],
            }]
        },
        orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    });
    const localeTag = readSettingSnapshot(settingsSnapshot, "bandUser", "calendar.locale");
    const locale = await database.locale.findFirst({
        where: { ietfTag: localeTag, isDeleted: false },
        select: { id: true }
    });
    return {
        events,
        attendance,
        cancelledStatusIds: cancelledStatuses.map(row => row.id),
        subscriber,
        settingsSnapshot,
        bandTimeZone, bandPublicId: args.bandPublicId,
        localeTag,
        actionContext: { bandId, localeContextId: locale?.id ?? null },
        userId: auth.userId,
        membershipId: membership.id,
    };
}
