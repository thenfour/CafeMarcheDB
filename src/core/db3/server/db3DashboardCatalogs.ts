import { Permission } from "shared/permissions";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import type { LocalePreferenceInput } from "src/locale/shared/localePreferences";
import { instrumentDashboardView, instrumentFunctionalGroupDashboardView, songTagDashboardView } from "../shared/references/dashboardReferences";
import type { DashboardDataDto } from "../shared/references/dashboardData";
import { executeDB3Read, type DB3ReadDatabase } from "./db3ReadExecution";
import { queryView } from "./db3QueryCore";

type DashboardCatalogs = Pick<DashboardDataDto, "instrument" | "instrumentFunctionalGroup" | "songTag">;

/** The dashboard delivers dependent catalog references from one band/language snapshot. */
export async function loadDashboardCatalogs(database: DB3ReadDatabase, authorization: CMServerAuthorization,
    preferences: LocalePreferenceInput,
): Promise<DashboardCatalogs> {
    if (!authorization.band || !authorization.hasPermission(Permission.login)) {
        return { instrument: [], instrumentFunctionalGroup: [], songTag: [] };
    }
    return executeDB3Read(database, authorization, async context => {
        const instrumentFilter = { tableParams: { includeHidden: context.authorization.hasPermission(Permission.admin_instruments) } };
        const songFilter = { tableParams: { includeHidden: context.authorization.hasPermission(Permission.admin_songs) } };
        const [groups, instruments, tags] = await Promise.all([
            queryView({ view: instrumentFunctionalGroupDashboardView, ...preferences, filter: instrumentFilter,
                cmdbQueryContext: "dashboard instrument groups" }, context.authorization, context),
            queryView({ view: instrumentDashboardView, ...preferences, filter: instrumentFilter,
                cmdbQueryContext: "dashboard instruments" }, context.authorization, context),
            queryView({ view: songTagDashboardView, ...preferences, filter: songFilter,
                cmdbQueryContext: "dashboard song tags" }, context.authorization, context),
        ]);
        return { instrumentFunctionalGroup: groups.items, instrument: instruments.items, songTag: tags.items };
    });
}
