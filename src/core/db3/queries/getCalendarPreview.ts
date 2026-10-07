
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { ICalCalendar, ICalDateTimeValue, ICalLocation } from "ical-generator";
import { Permission } from "shared/permissions";
import { CalExportCore } from "../server/ical";
import { ICalCalendarJSON } from "../shared/apiTypes";
import { UserForCalBackendArgs } from "../shared/schema/prismArgs";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { CalendarBandContextSchema } from "../shared/calendarFeed";
import { cmauthorize } from "@/src/auth/server/cmResolver";


function ICalConvertToDate(value: ICalDateTimeValue): Date {
    if (value instanceof Date) {
        return value;  // already a Date object
    } else if (typeof value === 'string') {
        return new Date(value);  // try to parse if it's a string (ISO format or similar)
    } else if ('toJSDate' in value && typeof value.toJSDate === 'function') {
        return value.toJSDate();  // use the provided method to convert to a Date object
    } else {
        throw new Error("Unable to convert ICalDateTimeValue to Date.");
    }
}


function calendarLocationTitle(location: ICalLocation | null): string | undefined {
    return location && "title" in location ? location.title : undefined;
}

export default resolver.pipe(
    cmauthorize(Permission.sysadmin),
    resolver.zod(CalendarBandContextSchema),
    async (input, ctx): Promise<ICalCalendarJSON> => {
        try {
            const startTimestamp = Date.now();
            const auth = await loadAuthorization(ctx.session, input.bandPublicId);
            const freshAuth = await auth.refresh();
            const authWithUser = freshAuth.requireUser();
            freshAuth.requirePermission(Permission.sysadmin);
            const u = await db.user.findFirst({
                ...UserForCalBackendArgs,
                where: {
                    id: authWithUser.userId,
                    isDeleted: false,
                },
            });
            if (!u) {
                throw new Error("Active calendar preview user not found.");
            }

            const cal: ICalCalendar = await CalExportCore({
                type: "upcoming",
                currentUser: u,
                bandPublicId: input.bandPublicId,
            });

            const ret: ICalCalendarJSON = {
                executionTimeMillis: Date.now() - startTimestamp,
                name: cal.name() || "",
                prodId: cal.prodId(),
                timezone: cal.timezone() || undefined,
                description: cal.description() || undefined,
                method: cal.method() || undefined,
                scale: cal.scale() || undefined,
                source: cal.source() || undefined,
                url: cal.url() || undefined,
                iCalText: cal.toString(),
                events: cal.events().map(e => ({
                    start: ICalConvertToDate(e.start()),
                    end: e.end() === null ? undefined : ICalConvertToDate(e.end()!),
                    summary: e.summary(),
                    allDay: e.allDay(),
                    sequence: e.sequence(),
                    status: String(e.status()),
                    url: e.url() || undefined,
                    uid: e.uid(),
                    //attendees: e.attendees(),
                    description: e.description() ? {
                        html: e.description()?.html,
                        plain: e.description()?.plain,
                    } : undefined,
                    location: calendarLocationTitle(e.location()),
                    organizer: e.organizer() ? {
                        name: e.organizer()?.name!,
                        email: e.organizer()?.email,
                        mailto: e.organizer()?.mailto,
                        sentBy: e.organizer()?.sentBy,
                    } : undefined,
                })),

            };
            return ret;

        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);



