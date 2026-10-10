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
        const [localization, settings, permissions, catalogs, sharedCatalogs, currentMembership, dynMenuLinks] = await Promise.all([
            loadLocalizationCatalog(transaction, authorization, input),
            loadSettingsSnapshot(transaction, authorization),
            queryView({ view: permissionDashboardView, ...input, filter: {}, cmdbQueryContext: "dashboard permissions" }, authorization, context),
            loadDashboardCatalogs(context, authorization, input),
            loadSharedCatalogs(context, authorization, input),
            loadCurrentMembership(context, input),
            loadDashboardMenuLinks(context, input),
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
            // Event relevance remains under the separate dashboard Event/calendar checkpoint.
            relevantEventIds: [],
        };
    });
}


// MIGRATION_RESTORE: role-administration
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/core/db3/server/db3DashboardData.ts:1-64
// Reason: Single-band Role administration cannot execute against GlobalRole and BandRole.
// Restore: Restore role and permission editors, designations, account role assignment and continuity safeguards using GlobalRole/BandRole; never restore User.role.
// Verification: Adapt the preserved authorization and command tests; verify atomic designations, protected grants, fresh authorization, auditing and browser editors.
// SHA256: 3ebe76a8176a44a20740298013e9f0e2f96628058e04396a3c9e5bd7209f92f9
// MIGRATION_REFERENCE_BEGIN
// import { Permission } from "shared/permissions";
// import { parsePublicId } from "shared/publicId";
// import { getClientServerState } from "shared/serverStateBase";
// import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
// import { loadLocalizationCatalog } from "src/locale/server/localization";
// import type { PresentationInput } from "src/locale/shared/presentationInput";
// import { loadSettingsSnapshot } from "src/setting/server/settings";
// import { readSettingSnapshot } from "src/setting/shared/settingsContract";
// import { bandUserInstrumentsView } from "../shared/entities/user/bandUserInstruments";
// import type { DashboardDataDto } from "../shared/references/dashboardData";
// import { permissionDashboardView } from "../shared/references/dashboardReferences";
// import { loadDashboardCatalogs } from "./db3DashboardCatalogs";
// import { executeDB3Read, type DB3ReadDatabase, type DB3ReadContext } from "./db3ReadExecution";
// import { queryView } from "./db3QueryCore";
// import { xBandUser } from "../db3";
//
// async function loadCurrentMembership(context: DB3ReadContext, input: PresentationInput) {
//     const { authorization } = context;
//     if (!authorization.membership) { // no need to check further auth. it's handled in the query layer
//         return null;
//     }
//     const result = await queryView({
//         view: bandUserInstrumentsView,
//         ...input,
//         filter: {
//             publicIds: [xBandUser.parseIdentity(authorization.membership.publicId)]
//         },
//         cmdbQueryContext: "dashboard current membership",
//     }, authorization, context);
//     return result.items[0] ?? null;
// }
//
// /** Bootstrap only restored domains. Every delivered field shares fresh grants and one snapshot. */
// export function loadDashboardData(
//     database: DB3ReadDatabase,
//     authorization: CMServerAuthorization,
//     input: PresentationInput,
// ): Promise<DashboardDataDto> {
//     return executeDB3Read(database, authorization, async context => {
//         const { database: transaction, authorization } = context;
//         const [localization, settings, permissions, catalogs, currentMembership] = await Promise.all([
//             loadLocalizationCatalog(transaction, authorization, input),
//             loadSettingsSnapshot(transaction, authorization),
//             queryView({ view: permissionDashboardView, ...input, filter: {}, cmdbQueryContext: "dashboard permissions" }, authorization, context),
//             loadDashboardCatalogs(context, authorization, input),
//             loadCurrentMembership(context, input),
//         ]);
//         const server = getClientServerState(authorization.hasPermission(Permission.sysadmin));
//         return {
//             ...catalogs,
//             currentMembership,
//             permission: permissions.items,
//             authorization: authorization.toClientContext(),
//             localization,
//             settings,
//             serverBaseUri: server.baseUri,
//             serverStartupState: server.diagnostics,
//             bandTimeZone: authorization.band ? readSettingSnapshot(settings, "band", "dateTime.bandTimeZone") : "Europe/Brussels",
//             // These consumers are deferred during A0 recovery; do not query their old models.
//             role: [], wikiPageTag: [], eventType: [], eventStatus: [], eventTag: [],
//             eventAttendance: [], fileTag: [], songCreditType: [], dynMenuLinks: [], relevantEventIds: [],
//         };
//     });
// }
// MIGRATION_REFERENCE_END
