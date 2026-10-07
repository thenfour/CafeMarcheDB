import { Permission } from "shared/permissions";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import type { LocalePreferenceInput } from "src/locale/shared/localePreferences";
import { fileTagDashboardView, eventTagDashboardView, eventAttendanceDashboardView, eventStatusDashboardView, eventTypeDashboardView, instrumentDashboardView, instrumentFunctionalGroupDashboardView, songTagDashboardView, userTagDashboardView } from "../shared/references/dashboardReferences";
import type { DashboardDataDto } from "../shared/references/dashboardData";
import { executeDB3Read, type DB3ReadDatabase } from "./db3ReadExecution";
import { queryView } from "./db3QueryCore";

type DashboardCatalogs = Pick<DashboardDataDto,
    "instrument"
    | "instrumentFunctionalGroup"
    | "songTag"
    | "userTag"
    | "eventTag"
    | "fileTag"
>;

/** Shared event behavior and captions remain available without a selected band. */
export function loadSharedEventCatalogs(
    database: DB3ReadDatabase,
    authorization: CMServerAuthorization,
    preferences: LocalePreferenceInput,
): Promise<Pick<DashboardDataDto, "eventType" | "eventStatus" | "eventAttendance">> {
    return executeDB3Read(database, authorization, async context => {
        const [types, statuses, attendances] = await Promise.all([
            queryView({ view: eventTypeDashboardView, ...preferences, includeDeleted: true, filter: {}, cmdbQueryContext: "dashboard event types" }, context.authorization, context),
            queryView({ view: eventStatusDashboardView, ...preferences, includeDeleted: true, filter: {}, cmdbQueryContext: "dashboard event statuses" }, context.authorization, context),
            queryView({ view: eventAttendanceDashboardView, ...preferences, includeDeleted: true, filter: {}, cmdbQueryContext: "dashboard event attendance" }, context.authorization, context),
        ]);
        return {
            eventType: types.items,
            eventStatus: statuses.items,
            eventAttendance: attendances.items,
        };
    });
}

/** The dashboard delivers dependent catalog references from one band/language snapshot. */
export async function loadDashboardCatalogs(database: DB3ReadDatabase, authorization: CMServerAuthorization,
    preferences: LocalePreferenceInput,
): Promise<DashboardCatalogs> {
    if (!authorization.band || !authorization.hasPermission(Permission.login)) {
        return { instrument: [], instrumentFunctionalGroup: [], songTag: [], userTag: [], eventTag: [], fileTag: [] };
    }
    return executeDB3Read(database, authorization, async context => {
        const instrumentFilter = { tableParams: { includeHidden: context.authorization.hasPermission(Permission.admin_instruments) } };
        const songFilter = { tableParams: { includeHidden: context.authorization.hasPermission(Permission.admin_songs) } };
        const userTagFilter = { tableParams: { includeHidden: context.authorization.hasPermission(Permission.manage_user_taxonomy) } };
        const eventTagFilter = { tableParams: { includeHidden: context.authorization.hasPermission(Permission.admin_events) } };
        const fileTagFilter = { tableParams: { includeHidden: context.authorization.hasPermission(Permission.admin_files) } };
        const [groups, instruments, tags, userTags, eventTags, fileTags] = await Promise.all([
            queryView({
                view: instrumentFunctionalGroupDashboardView, ...preferences, filter: instrumentFilter,
                cmdbQueryContext: "dashboard instrument groups"
            }, context.authorization, context),
            queryView({
                view: instrumentDashboardView, ...preferences, filter: instrumentFilter,
                cmdbQueryContext: "dashboard instruments"
            }, context.authorization, context),
            queryView({
                view: songTagDashboardView, ...preferences, filter: songFilter,
                cmdbQueryContext: "dashboard song tags"
            }, context.authorization, context),
            queryView({
                view: userTagDashboardView, ...preferences, filter: userTagFilter,
                cmdbQueryContext: "dashboard member tags"
            }, context.authorization, context),
            queryView({
                view: eventTagDashboardView, ...preferences, filter: eventTagFilter,
                cmdbQueryContext: "dashboard event tags"
            }, context.authorization, context),
            queryView({
                view: fileTagDashboardView, ...preferences, filter: fileTagFilter,
                cmdbQueryContext: "dashboard file tags"
            }, context.authorization, context),
        ]);
        return { instrumentFunctionalGroup: groups.items, instrument: instruments.items, songTag: tags.items, userTag: userTags.items, eventTag: eventTags.items, fileTag: fileTags.items };
    });
}
