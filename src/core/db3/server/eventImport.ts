import { AuthorizationError } from "blitz";
import { CalendarDate } from "shared/dateTimePolicy";
import { Permission } from "shared/permissions";
import { createAllDayRange } from "shared/time";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { loadBandTimeZone } from "src/server/bandTimeZone";
import { ZGetImportEventDataArgs, type TGetImportEventDataArgs, type TGetImportEventDataRet, PermissionSignificance } from "../shared/apiTypes";
import { parseEventImportText, matchImportResponses, matchImportSongs } from "../shared/entities/event/eventImportParsing";
import { songImportMatchView } from "../shared/entities/song/songViews";
import { bandPersonReferenceView } from "../shared/entities/user/bandPersonReference";
import { permissionVisibilityView } from "../shared/entities/user/permissionViews";
import { eventAttendanceDashboardView, eventStatusDashboardView, eventTypeDashboardView, userTagDashboardView } from "../shared/references/dashboardReferences";
import { executeDB3Read, type DB3ReadDatabase } from "./db3ReadExecution";
import { queryView } from "./db3QueryCore";

/** Preview is read-only; creation separately reauthorizes every edited reference. */
export function readEventImportPreview(database: DB3ReadDatabase, authorization: CMServerAuthorization,
    input: TGetImportEventDataArgs): Promise<TGetImportEventDataRet> {
    const args = ZGetImportEventDataArgs.parse(input);
    return executeDB3Read(database, authorization, async context => {
        const auth = context.authorization.requireUser();
        auth.requirePermission(Permission.sysadmin);
        const band = auth.requireBand();
        if (band.publicId !== args.bandPublicId) {
            throw new AuthorizationError("Event import requires the selected band.");
        }
        const { bandPublicId, routeLocale, browserLanguages, clientRequestId } = args;
        const presentation = { bandPublicId, routeLocale, browserLanguages, clientRequestId };
        const [types, statuses, attendances, userTags, permissions, people, songs, timeZone] = await Promise.all([
            queryView({ view: eventTypeDashboardView, ...presentation, filter: {}, cmdbQueryContext: "import event types" }, auth, context),
            queryView({ view: eventStatusDashboardView, ...presentation, filter: {}, cmdbQueryContext: "import event statuses" }, auth, context),
            queryView({ view: eventAttendanceDashboardView, ...presentation, filter: {}, cmdbQueryContext: "import attendance choices" }, auth, context),
            queryView({ view: userTagDashboardView, ...presentation, filter: {}, cmdbQueryContext: "import invitation groups" }, auth, context),
            queryView({ view: permissionVisibilityView, ...presentation, filter: {}, cmdbQueryContext: "import visibility defaults" }, auth, context),
            queryView({ view: bandPersonReferenceView, ...presentation, filter: {}, cmdbQueryContext: "import active band people" }, auth, context),
            queryView({ view: songImportMatchView, ...presentation, filter: {}, cmdbQueryContext: "import visible Songs" }, auth, context),
            loadBandTimeZone(context.database, band.id),
        ]);
        const parsed = parseEventImportText(args.text, args.config);
        const today = CalendarDate.fromInstant({ value: new Date(), timeZone });
        const day = new CalendarDate(parsed.date ?? today.date, timeZone);
        const range = createAllDayRange({ startDate: day.date, endDateExclusive: day.addDays(1).date }, timeZone);
        const invitation = userTags.items.find(tag => tag.significance === "DefaultInvitation");
        const log = [`fallbackYear: ${parsed.fallbackYear}`, `extractDate: ${parsed.date}`];
        if (!invitation) {
            log.push("No default invitation user tag found.");
        }
        const choices = attendances.items.filter(choice => choice.isActive);
        const yes = choices.find(choice => choice.strength === 100)?.publicId ?? null;
        const no = choices.find(choice => choice.strength === 0)?.publicId ?? null;
        if (!yes || !no) {
            log.push("Missing active affirmative or negative attendance choice.");
        }
        return {
            event: {
                name: parsed.name, locationDescription: null,
                typeId: parsed.type === null ? null : types.items.find(type => type.significance === parsed.type)?.publicId ?? null,
                statusId: statuses.items.find(status => status.significance === "FinalConfirmation")?.publicId ?? null,
                tags: [], expectedAttendanceUserTagId: invitation?.publicId ?? null,
                visiblePermissionId: permissions.items.find(permission => permission.significance === PermissionSignificance.Visibility_Members)?.publicId ?? null,
            },
            segment: { name: "Segment 1", description: "", isAllDay: true, startsAt: range.getStartDateTime(), durationMillis: range.getDurationMillis() },
            songList: matchImportSongs(parsed.songs, songs.items, log),
            responses: matchImportResponses(parsed.eventText, people.items, { yes, no }, log), log,
        };
    });
}
