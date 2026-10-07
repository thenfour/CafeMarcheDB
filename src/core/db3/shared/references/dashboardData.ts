import type { EventPublicId } from "shared/publicId";
import type { ServerStartInfo } from "shared/serverStateBase";
import type { ScopedAuthorizationData } from "src/auth/shared/cmAuthorization";
import { hydrateView, type AnyDB3View, type ClientOf, type DtoOf } from "../core/db3View";
import { menuLinkListView } from "../entities/menuLink/menuLinkViews";
import { SettingsDto } from "../schema/settings";
import * as dashboard from "./dashboardReferences";
import type { LocalizationCatalog } from "src/locale/shared/localizationCatalog";
import type { BandUserInstrumentsDto } from "../entities/user/bandUserInstruments";

/** RPC payload: field codecs and reference expansion have not run yet. */
export interface DashboardDataDto {
    authorization: ScopedAuthorizationData;
    localization: LocalizationCatalog;
    currentMembership: BandUserInstrumentsDto | null;
    permission: DtoOf<typeof dashboard.permissionDashboardView>[];
    userTag: DtoOf<typeof dashboard.userTagDashboardView>[];
    wikiPageTag: DtoOf<typeof dashboard.wikiPageTagDashboardView>[];
    eventType: DtoOf<typeof dashboard.eventTypeDashboardView>[];
    eventStatus: DtoOf<typeof dashboard.eventStatusDashboardView>[];
    eventTag: DtoOf<typeof dashboard.eventTagDashboardView>[];
    eventAttendance: DtoOf<typeof dashboard.eventAttendanceDashboardView>[];
    fileTag: DtoOf<typeof dashboard.fileTagDashboardView>[];
    instrumentFunctionalGroup: DtoOf<typeof dashboard.instrumentFunctionalGroupDashboardView>[];
    songTag: DtoOf<typeof dashboard.songTagDashboardView>[];
    songCreditType: DtoOf<typeof dashboard.songCreditTypeDashboardView>[];
    instrument: DtoOf<typeof dashboard.instrumentDashboardView>[];
    dynMenuLinks: DtoOf<typeof menuLinkListView>[];
    serverBaseUri: string;
    serverStartupState: ServerStartInfo | null;
    relevantEventIds: EventPublicId[];
    bandTimeZone: string;

    settings: SettingsDto;
}

/** Hydrate one complete snapshot; old or revoked references cannot survive a refresh. */
export function hydrateDashboardData(dto: DashboardDataDto) {
    const referenceStore = dashboard.createDashboardReferenceStore();
    function hydrate<TView extends AnyDB3View>(
        view: TView,
        items: readonly DtoOf<NoInfer<TView>>[],
    ): ClientOf<TView>[] {
        return items.map(item => hydrateView(view, item, referenceStore));
    }

    // Leaf values must exist before instrument/menu hydration resolves their references.
    const leaves = {
        permission: hydrate(dashboard.permissionDashboardView, dto.permission),
        userTag: hydrate(dashboard.userTagDashboardView, dto.userTag),
        wikiPageTag: hydrate(dashboard.wikiPageTagDashboardView, dto.wikiPageTag)
            .filter(dashboard.isCompleteWikiPageTagDashboardClient),
        eventType: hydrate(dashboard.eventTypeDashboardView, dto.eventType),
        eventStatus: hydrate(dashboard.eventStatusDashboardView, dto.eventStatus),
        eventTag: hydrate(dashboard.eventTagDashboardView, dto.eventTag),
        eventAttendance: hydrate(dashboard.eventAttendanceDashboardView, dto.eventAttendance)
            .filter(dashboard.isCompleteEventAttendanceDashboardClient),
        fileTag: hydrate(dashboard.fileTagDashboardView, dto.fileTag),
        instrumentFunctionalGroup: hydrate(dashboard.instrumentFunctionalGroupDashboardView, dto.instrumentFunctionalGroup),
        songTag: hydrate(dashboard.songTagDashboardView, dto.songTag),
        songCreditType: hydrate(dashboard.songCreditTypeDashboardView, dto.songCreditType),
    };
    dashboard.registerDashboardReferences(referenceStore, leaves);
    const instrument = hydrate(dashboard.instrumentDashboardView, dto.instrument);
    dashboard.registerDashboardReferences(referenceStore, { instrument });

    return {
        ...dto,
        ...leaves,
        instrument,
        dynMenuLinks: hydrate(menuLinkListView, dto.dynMenuLinks),
        referenceStore,
    };
}

export type DashboardDataClient = ReturnType<typeof hydrateDashboardData>;


// MIGRATION_RESTORE: role-administration
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/core/db3/shared/references/dashboardData.ts:1-79
// Reason: Single-band Role administration cannot execute against GlobalRole and BandRole.
// Restore: Restore role and permission editors, designations, account role assignment and continuity safeguards using GlobalRole/BandRole; never restore User.role.
// Verification: Adapt the preserved authorization and command tests; verify atomic designations, protected grants, fresh authorization, auditing and browser editors.
// SHA256: a181a5b61f482ada785445aa6b53cb2ca59e810fc8016bf6a2f44f2bf8021472
// MIGRATION_REFERENCE_BEGIN
// import type { EventPublicId } from "shared/publicId";
// import type { ServerStartInfo } from "shared/serverStateBase";
// import type { ScopedAuthorizationData } from "src/auth/shared/cmAuthorization";
// import { hydrateView, type AnyDB3View, type ClientOf, type DtoOf } from "../core/db3View";
// import { menuLinkListView } from "../entities/menuLink/menuLinkViews";
// import { SettingsDto } from "../schema/settings";
// import * as dashboard from "./dashboardReferences";
// import type { LocalizationCatalog } from "src/locale/shared/localizationCatalog";
// import type { BandUserInstrumentsDto } from "../entities/user/bandUserInstruments";
//
// /** RPC payload: field codecs and reference expansion have not run yet. */
// export interface DashboardDataDto {
//     authorization: ScopedAuthorizationData;
//     localization: LocalizationCatalog;
//     currentMembership: BandUserInstrumentsDto | null;
//     permission: DtoOf<typeof dashboard.permissionDashboardView>[];
//     userTag: DtoOf<typeof dashboard.userTagDashboardView>[];
//     role: DtoOf<typeof dashboard.roleDashboardView>[];
//     wikiPageTag: DtoOf<typeof dashboard.wikiPageTagDashboardView>[];
//     eventType: DtoOf<typeof dashboard.eventTypeDashboardView>[];
//     eventStatus: DtoOf<typeof dashboard.eventStatusDashboardView>[];
//     eventTag: DtoOf<typeof dashboard.eventTagDashboardView>[];
//     eventAttendance: DtoOf<typeof dashboard.eventAttendanceDashboardView>[];
//     fileTag: DtoOf<typeof dashboard.fileTagDashboardView>[];
//     instrumentFunctionalGroup: DtoOf<typeof dashboard.instrumentFunctionalGroupDashboardView>[];
//     songTag: DtoOf<typeof dashboard.songTagDashboardView>[];
//     songCreditType: DtoOf<typeof dashboard.songCreditTypeDashboardView>[];
//     instrument: DtoOf<typeof dashboard.instrumentDashboardView>[];
//     dynMenuLinks: DtoOf<typeof menuLinkListView>[];
//     serverBaseUri: string;
//     serverStartupState: ServerStartInfo | null;
//     relevantEventIds: EventPublicId[];
//     bandTimeZone: string;
//
//     settings: SettingsDto;
// }
//
// /** Hydrate one complete snapshot; old or revoked references cannot survive a refresh. */
// export function hydrateDashboardData(dto: DashboardDataDto) {
//     const referenceStore = dashboard.createDashboardReferenceStore();
//     function hydrate<TView extends AnyDB3View>(
//         view: TView,
//         items: readonly DtoOf<NoInfer<TView>>[],
//     ): ClientOf<TView>[] {
//         return items.map(item => hydrateView(view, item, referenceStore));
//     }
//
//     // Leaf values must exist before instrument/menu hydration resolves their references.
//     const leaves = {
//         permission: hydrate(dashboard.permissionDashboardView, dto.permission),
//         userTag: hydrate(dashboard.userTagDashboardView, dto.userTag),
//         role: hydrate(dashboard.roleDashboardView, dto.role)
//             .filter(dashboard.isCompleteRoleDashboardClient),
//         wikiPageTag: hydrate(dashboard.wikiPageTagDashboardView, dto.wikiPageTag)
//             .filter(dashboard.isCompleteWikiPageTagDashboardClient),
//         eventType: hydrate(dashboard.eventTypeDashboardView, dto.eventType),
//         eventStatus: hydrate(dashboard.eventStatusDashboardView, dto.eventStatus),
//         eventTag: hydrate(dashboard.eventTagDashboardView, dto.eventTag),
//         eventAttendance: hydrate(dashboard.eventAttendanceDashboardView, dto.eventAttendance)
//             .filter(dashboard.isCompleteEventAttendanceDashboardClient),
//         fileTag: hydrate(dashboard.fileTagDashboardView, dto.fileTag),
//         instrumentFunctionalGroup: hydrate(dashboard.instrumentFunctionalGroupDashboardView, dto.instrumentFunctionalGroup),
//         songTag: hydrate(dashboard.songTagDashboardView, dto.songTag),
//         songCreditType: hydrate(dashboard.songCreditTypeDashboardView, dto.songCreditType),
//     };
//     dashboard.registerDashboardReferences(referenceStore, leaves);
//     const instrument = hydrate(dashboard.instrumentDashboardView, dto.instrument);
//     dashboard.registerDashboardReferences(referenceStore, { instrument });
//
//     return {
//         ...dto,
//         ...leaves,
//         instrument,
//         dynMenuLinks: hydrate(menuLinkListView, dto.dynMenuLinks),
//         referenceStore,
//     };
// }
//
// export type DashboardDataClient = ReturnType<typeof hydrateDashboardData>;
// MIGRATION_REFERENCE_END
