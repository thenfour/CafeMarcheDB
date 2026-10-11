import { Permission } from "shared/permissions";
import { getClientServerState } from "shared/serverStateBase";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { loadLocalizationCatalog } from "src/locale/server/localization";
import type { PresentationInput } from "src/locale/shared/presentationInput";
import { loadSettingsSnapshot } from "src/setting/server/settings";
import { readSettingSnapshot } from "src/setting/shared/settingsContract";
import { eventParticipantView } from "../shared/entities/user/eventParticipant";
import type { DashboardDataDto } from "../shared/references/dashboardData";
import { permissionDashboardView } from "../shared/references/dashboardReferences";
import { loadDashboardCatalogs, loadSharedCatalogs } from "./db3DashboardCatalogs";
import { executeDB3Read, type DB3ReadDatabase, type DB3ReadContext } from "./db3ReadExecution";
import { queryView } from "./db3QueryCore";
import { xBandUser } from "../db3";
import { menuLinkListView } from "../shared/entities/menuLink/menuLinkViews";
import { readDashboardRelevantEvents } from "./dashboardEvents";
import { hasLimitedDashboardAccess } from "./dashboardAccountNotice";

async function loadCurrentMembership(context: DB3ReadContext, input: PresentationInput) {
    const { authorization } = context;
    if (!authorization.membership) { // no need to check further auth. it's handled in the query layer
        return null;
    }
    const result = await queryView({
        view: eventParticipantView,
        ...input,
        filter: {
            publicIds: [xBandUser.parseIdentity(authorization.membership.publicId)]
        },
        cmdbQueryContext: "dashboard current membership",
    }, authorization, context);
    return result.items[0] ?? null;
}

async function loadDashboardMenuLinks(context: DB3ReadContext, input: PresentationInput) {
    if (!context.authorization.band) {
        return [];
    }
    const result = await queryView({
        view: menuLinkListView, ...input, filter: {}, cmdbQueryContext: "dashboard menu links",
    }, context.authorization, context);
    return result.items;
}

/** Bootstrap only restored domains. Every delivered field shares fresh grants and one snapshot. */
export function loadDashboardData(
    database: DB3ReadDatabase,
    authorization: CMServerAuthorization,
    input: PresentationInput,
): Promise<DashboardDataDto> {
    return executeDB3Read(database, authorization, async context => {
        const { database: transaction, authorization } = context;
        const [localization, settings, permissions, catalogs, sharedCatalogs, currentMembership, dynMenuLinks, relevantEventIds, hasLimitedAccess] = await Promise.all([
            loadLocalizationCatalog(transaction, authorization, input),
            loadSettingsSnapshot(transaction, authorization),
            queryView({ view: permissionDashboardView, ...input, filter: {}, cmdbQueryContext: "dashboard permissions" }, authorization, context),
            loadDashboardCatalogs(context, authorization, input),
            loadSharedCatalogs(context, authorization, input),
            loadCurrentMembership(context, input),
            loadDashboardMenuLinks(context, input),
            readDashboardRelevantEvents(context, new Date()),
            hasLimitedDashboardAccess(context),
        ]);
        const server = getClientServerState(authorization.hasPermission(Permission.sysadmin));
        return {
            ...catalogs,
            ...sharedCatalogs,
            currentMembership,
            permission: permissions.items,
            authorization: authorization.toClientContext(),
            localization,
            settings,
            serverBaseUri: server.baseUri,
            serverStartupState: server.diagnostics,
            bandTimeZone: authorization.band ? readSettingSnapshot(settings, "band", "dateTime.bandTimeZone") : "Europe/Brussels",
            dynMenuLinks,
            relevantEventIds,
            hasLimitedAccess,
        };
    });
}
