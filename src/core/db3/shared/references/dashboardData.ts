import type { ServerStartInfo } from "shared/serverStateBase";
import type { UserSettings } from "shared/userSettings";
import { hydrateView, type AnyDB3View, type ClientOf, type DtoOf } from "../core/db3View";
import { menuLinkListView } from "../entities/menuLink/menuLinkViews";
import * as dashboard from "./dashboardReferences";

/** RPC payload: field codecs and reference expansion have not run yet. */
export interface DashboardDataDto {
    permission: DtoOf<typeof dashboard.permissionDashboardView>[];
    userTag: DtoOf<typeof dashboard.userTagDashboardView>[];
    role: DtoOf<typeof dashboard.roleDashboardView>[];
    wikiPageTag: DtoOf<typeof dashboard.wikiPageTagDashboardView>[];
    eventType: DtoOf<typeof dashboard.eventTypeDashboardView>[];
    eventStatus: DtoOf<typeof dashboard.eventStatusDashboardView>[];
    eventTag: DtoOf<typeof dashboard.eventTagDashboardView>[];
    eventAttendance: DtoOf<typeof dashboard.eventAttendanceDashboardView>[];
    fileTag: DtoOf<typeof dashboard.fileTagDashboardView>[];
    instrumentFunctionalGroup: DtoOf<typeof dashboard.instrumentFunctionalGroupDashboardView>[];
    instrumentTag: DtoOf<typeof dashboard.instrumentTagDashboardView>[];
    songTag: DtoOf<typeof dashboard.songTagDashboardView>[];
    songCreditType: DtoOf<typeof dashboard.songCreditTypeDashboardView>[];
    instrument: DtoOf<typeof dashboard.instrumentDashboardView>[];
    dynMenuLinks: DtoOf<typeof menuLinkListView>[];
    serverBaseUri: string;
    serverStartupState: ServerStartInfo | null;
    relevantEventIds: number[];
    bandTimeZone: string;
    userSettings: UserSettings;
    effectivePermissionNames: string[];
    effectivePermissionIds: number[];
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
        role: hydrate(dashboard.roleDashboardView, dto.role)
            .filter(dashboard.isCompleteRoleDashboardClient),
        wikiPageTag: hydrate(dashboard.wikiPageTagDashboardView, dto.wikiPageTag)
            .filter(dashboard.isCompleteWikiPageTagDashboardClient),
        eventType: hydrate(dashboard.eventTypeDashboardView, dto.eventType),
        eventStatus: hydrate(dashboard.eventStatusDashboardView, dto.eventStatus),
        eventTag: hydrate(dashboard.eventTagDashboardView, dto.eventTag),
        eventAttendance: hydrate(dashboard.eventAttendanceDashboardView, dto.eventAttendance)
            .filter(dashboard.isCompleteEventAttendanceDashboardClient),
        fileTag: hydrate(dashboard.fileTagDashboardView, dto.fileTag),
        instrumentFunctionalGroup: hydrate(dashboard.instrumentFunctionalGroupDashboardView, dto.instrumentFunctionalGroup),
        instrumentTag: hydrate(dashboard.instrumentTagDashboardView, dto.instrumentTag),
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
