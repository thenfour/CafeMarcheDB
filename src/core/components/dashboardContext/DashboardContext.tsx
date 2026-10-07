import type { EventAttendancePublicId } from "shared/publicId";
import { localTimeZone } from "@/shared/time";
import { shouldShowAdminControls } from '@/shared/adminControls';
import { ClientSession, getAntiCSRFToken, useSession } from '@blitzjs/auth';
import { useMutation, useQuery } from '@blitzjs/rpc';
import React from 'react';
import { Permission } from 'shared/permissions';
import { TableAccessor } from 'shared/rootroot';
import { useThrottle } from 'shared/useGeneral';
import { useCurrentUser } from 'src/auth/hooks/useCurrentUser';
import setShowingAdminControls from 'src/auth/mutations/setShowingAdminControls';
import getDashboardData from 'src/auth/queries/getDashboardData';
import * as db3 from "src/core/db3/db3";
import { z } from 'zod';
import { useAppContext } from '../AppContext';
import { GetStyleVariablesForColor } from '../color/ColorClientUtils';
import { ColorVariationSpec, gAppColors, gGeneralPaletteList } from '../color/palette';
import { ActivityFeature, ClientActivityParams, collectDeviceInfo, UseFeatureUseClientActivityParams, ZTRecordActionArgs } from '../featureReports/activityTracking';
import { DbBrandConfig, DefaultDbBrandConfig } from '@/shared/brandConfigBase';
import { useBrand } from '@/shared/brandConfig';
import { DashboardContextDataBase } from './dashboardContextTypes';
import { PermissionSet } from '@/src/auth/shared/PermissionSet';
import { CMClientAuthorization, type ScopedAuthorizationData } from '@/src/auth/shared/cmAuthorization';
import { isAttendanceGoing } from 'shared/eventAttendance';
import { partition } from "@/shared/arrayUtils";
import { EventStatusPublicId, PermissionPublicId } from "@/shared/publicId";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { collectLocalePreferences, type LocalePreferences } from "src/locale/shared/localePreferences";

type CmdbWindow = Window & {
    cmdbDashboardContext?: DashboardContextData;
};

export const getCmdbWindow = (): CmdbWindow => {
    return window as CmdbWindow;
}

interface ObjectWithVisiblePermission {
    visiblePermissionId: PermissionPublicId | null;
};

export class DashboardContextData extends DashboardContextDataBase {
    metronomeSilencers: (() => void)[];


    session: ClientSession | null;
    refetchDashboardData: () => Promise<unknown> = async () => { };
    effectivePermissions: PermissionSet = new PermissionSet([]);
    authorization: CMClientAuthorization = new CMClientAuthorization(null, new PermissionSet([]));
    authorizationContext: ScopedAuthorizationData | null = null;
    localePreferences: LocalePreferences = collectLocalePreferences();

    constructor() {
        super();
        this.metronomeSilencers = [];
    }

    isAuthorized(p: Permission | string) {
        return this.effectivePermissions.includesName(p);
    }

    isAuthorizedForVisibility(visibilityPermissionId: PermissionPublicId | null, ownerUserId: number | null) {
        if (visibilityPermissionId == null) {
            return ownerUserId === null || ownerUserId === this.currentUser?.id;
        }
        const pobj = this.permission.getById(visibilityPermissionId);
        if (!pobj) {
            console.error(`Unknown visibility permission ID: ${visibilityPermissionId}`);
            return false; // unknown permission??
        }
        return this.isAuthorized(pobj.name);
    }

    getPermission = (q: Permission) => {
        return this.permission.find(p => p.name === q);
    };

    getDefaultVisibilityPermission = () => {
        return this.getPermission(Permission.visibility_members)!;
    };

    getVisibilityInfo = <T extends ObjectWithVisiblePermission,>(item: T) => {
        const visPerm = this.permission.getById(item.visiblePermissionId);
        const publicPerms = [
            Permission.visibility_public,
        ];
        const userPerms = [
            Permission.visibility_members,
            Permission.visibility_logged_in_users
        ];
        const editorPerms = [
            Permission.visibility_editors,
        ];
        const isPrivate = visPerm === null; //
        const isForEditors = editorPerms.find(p => visPerm?.name === p);
        const isForUsers = userPerms.find(p => visPerm?.name === p);
        const isPublic = publicPerms.find(p => visPerm?.name === p);
        const cssClasses: string[] = [];
        if (isPrivate) cssClasses.push(`visibility-private`);
        if (isPublic) cssClasses.push(`visibility-public visiblePermission-${visPerm!.name}`);
        if (isForEditors) cssClasses.push(`visibility-editors visiblePermission-${visPerm!.name}`);
        if (isForUsers) cssClasses.push(`visibility-users visiblePermission-${visPerm!.name}`);

        let colorId = visPerm?.color;
        if (colorId == null) {
            colorId = gGeneralPaletteList.findEntry(gAppColors.private_visibility);
        }

        return {
            isPrivate,
            isPublic,
            isForEditors,
            isForUsers,
            //style,
            colorId,
            getStyleVariablesForColor: (variation: ColorVariationSpec) => GetStyleVariablesForColor({ color: colorId, ...variation }),
            className: cssClasses.join(" "),
        }
    }

    isPublic = <T extends ObjectWithVisiblePermission,>(item: T) => {
        return this.getVisibilityInfo(item).isPublic;
    };

    get isShowingAdminControls() {
        return shouldShowAdminControls(this.session);
    }

    getCancelledStatuses() {
        return this.eventStatus
            .filter(s => s.significance === db3.EventStatusSignificance.Cancelled);
    }

    partitionEventSegmentsByCancellation<
        Tseg extends { statusId: EventStatusPublicId | null },
    >(segments: Tseg[]): [Tseg[], Tseg[]] {
        const cancelledEventStatusIds = this.getCancelledStatuses().map(x => x.publicId);
        const isCancelled = (seg: Tseg) => {
            if (seg.statusId == null) return false;
            return cancelledEventStatusIds.includes(seg.statusId);
        }
        return partition(segments, isCancelled);
    }

    sortInstruments<Tinst extends { sortOrder?: number, functionalGroupId: db3.InstrumentFunctionalGroupClientPayload["publicId"] }>(instruments: Tinst[]): Tinst[] {
        // sort first by functional group, then by instrument sort order.
        const ret = [...instruments];
        ret.sort((a, b) => {
            const afg = this.instrumentFunctionalGroup.getById(a.functionalGroupId)?.sortOrder ?? 0;
            const bfg = this.instrumentFunctionalGroup.getById(b.functionalGroupId)?.sortOrder ?? 0;
            if (afg !== bfg) {
                return afg - bfg;
            }
            return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
        });
        return ret;
    }

    isAttendanceIdGoing(attendanceId: EventAttendancePublicId | null) {
        const attendance = this.eventAttendance.getById(attendanceId);
        return isAttendanceGoing(attendance);
    }

    getVisibilityPermissions(): db3.ClientOf<typeof db3.permissionDashboardView>[] {
        return this.permission.filter(p => p.isVisibility);
    }

    recordAction(args: { feature: ActivityFeature, properties?: any }): Promise<void> {
        return Promise.resolve();
    }

    // Method to refresh dashboard data when needed (e.g., after creating new tags)
    async refreshCachedData(): Promise<void> {
        await this.refetchDashboardData();
    }

    brand: DbBrandConfig = DefaultDbBrandConfig;

    localTimeZone: string = localTimeZone();
    formattingLocale: string = "en-US";

    eventDatePresentation: {
        bandTimeZone: string;
        viewerTimeZone: string;
        locale: string;
    }
};


// Keep the runtime object stable (for example metronome registrations), while
// a new provider envelope notifies React consumers when query data changes.
export const DashboardContext = React.createContext({ data: new DashboardContextData() });

export const useDashboardContext = () => React.useContext(DashboardContext).data;


export const DashboardContextProvider = ({ children }: React.PropsWithChildren<{}>) => {
    const valueRef = React.useRef(new DashboardContextData());
    const presentation = usePresentation();
    const brand = useBrand();

    const [currentUser] = useCurrentUser();
    valueRef.current.currentUser = currentUser;

    const [setShowingAdminControlsMutation] = useMutation(setShowingAdminControls);

    const sess = useSession();
    valueRef.current.session = sess;

    // ALT+9 admin controls
    React.useEffect(() => {
        if (!sess.permissionNames?.includes(Permission.sysadmin)) {
            return;
        }
        async function handleKeyPress(event) {
            if (event.altKey && event.key === '9') {
                await setShowingAdminControlsMutation({ toggle: true });
            }
        }

        window.addEventListener('keydown', handleKeyPress);
        return () => {
            window.removeEventListener('keydown', handleKeyPress);
        };
    }, [sess.permissionNames, setShowingAdminControlsMutation]);

    const [dashboardDto, { refetch }] = useQuery(getDashboardData, presentation.data?.input ?? {});
    const dashboardData = React.useMemo(() => db3.hydrateDashboardData(dashboardDto), [dashboardDto]);
    valueRef.current.currentMembership = dashboardData.currentMembership;
    valueRef.current.refetchDashboardData = refetch;
    valueRef.current.permission = new TableAccessor(dashboardData.permission);

    const authorizationContext = presentation.data?.authorization ?? dashboardData.authorization;
    valueRef.current.authorizationContext = authorizationContext;

    // todo: move to a proper routing mechanism
    valueRef.current.memberPresentation = presentation.data?.input ?? {};
    valueRef.current.effectivePermissions = new PermissionSet(authorizationContext.effectivePermissionNames);

    const localization = presentation.data?.localization ?? dashboardData.localization;
    valueRef.current.localePreferences = localization.preferences;
    valueRef.current.formattingLocale = localization.formattingLocale;

    valueRef.current.authorization = new CMClientAuthorization(currentUser, valueRef.current.effectivePermissions);

    valueRef.current.userTag = new TableAccessor(dashboardData.userTag, tag => tag.publicId);
    valueRef.current.wikiPageTag = new TableAccessor(
        dashboardData.wikiPageTag,
        tag => db3.xWikiPageTag.getIdentity(tag),
    );
    valueRef.current.eventType = new TableAccessor(
        dashboardData.eventType,
        value => db3.xEventType.getIdentity(value),
    );
    valueRef.current.eventStatus = new TableAccessor(
        dashboardData.eventStatus,
        value => db3.xEventStatus.getIdentity(value),
    );
    valueRef.current.eventTag = new TableAccessor(
        dashboardData.eventTag,
        value => db3.xEventTag.getIdentity(value),
    );
    valueRef.current.eventAttendance = new TableAccessor(dashboardData.eventAttendance, value => db3.xEventAttendance.getIdentity(value));
    valueRef.current.fileTag = new TableAccessor(
        dashboardData.fileTag,
        tag => db3.xFileTag.getIdentity(tag),
    );
    valueRef.current.referenceStore = dashboardData.referenceStore;
    valueRef.current.instrumentFunctionalGroup = new TableAccessor(
        dashboardData.instrumentFunctionalGroup,
        group => group.publicId,
    );
    valueRef.current.songTag = new TableAccessor(
        dashboardData.songTag,
        tag => tag.publicId,
    );
    valueRef.current.songCreditType = new TableAccessor(dashboardData.songCreditType);
    valueRef.current.serverBaseUri = dashboardData.serverBaseUri;
    valueRef.current.serverStartupState = dashboardData.serverStartupState;
    valueRef.current.relevantEventIds = dashboardData.relevantEventIds;
    valueRef.current.bandTimeZone = dashboardData.bandTimeZone;

    valueRef.current.settings = presentation.data?.settings ?? dashboardData.settings;

    valueRef.current.brand = brand;
    valueRef.current.localTimeZone = localTimeZone();

    valueRef.current.eventDatePresentation = {
        bandTimeZone: valueRef.current.bandTimeZone,
        viewerTimeZone: valueRef.current.localTimeZone,
        locale: valueRef.current.formattingLocale,
    };

    // establish singleton for use by non-react code
    if (typeof window !== "undefined") { // Q: why is this necessary? shouldn't this always be running in a client browser with `window`?
        getCmdbWindow().cmdbDashboardContext = valueRef.current;
    }

    valueRef.current.dynMenuLinks = new TableAccessor(dashboardData.dynMenuLinks);
    valueRef.current.instrument = new TableAccessor(dashboardData.instrument, value => value.publicId);

    return (
        <DashboardContext.Provider value={{ data: valueRef.current }}>
            {children}
        </DashboardContext.Provider>
    );
};

/**
 * Keepalive-based drop-in replacement for recordFeature (client-side only), as a hook.
 * Usage: const recordClientTelemetry = useClientTelemetryEvent();
 *        recordClientTelemetry({ feature, context, ...associations })
 * thisComponentContext - normally we like to use <AppContextMarker>, but if you want to use this hook in the
 * same component as <AppContextMarker>, you can pass the context manually because otherwise it won't be available yet in the tree.
 */

export function useClientTelemetryEvent(thisComponentContext?: string) {
    const appCtx = useAppContext();
    return async ({ feature, context, ...associations }: ClientActivityParams) => {
        const url = "/api/telemetry";
        const deviceInfo = await collectDeviceInfo();
        const { stack, ...sanitizedAppCtx } = appCtx; // remove stack from app context to avoid sending it over the wire

        // calculate the context from appctx stack, thisComponentContext, and the passed context.
        const contextParts = [stack, thisComponentContext, context].filter(Boolean);

        const event: z.infer<typeof ZTRecordActionArgs> = {
            ...sanitizedAppCtx,
            ...associations,
            uri: window.location.href,
            context: contextParts.join("/"),
            feature,
            deviceInfo,
        };

        //console.log("Recording client telemetry event", { appCtx, feature, context, associations, event });

        // see blitz docs for manually invoking APIs / https://blitzjs.com/docs/session-management#manual-api-requests
        const antiCSRFToken = getAntiCSRFToken();

        const payload = JSON.stringify({ event });
        const contentType = "application/json";
        const headers: Record<string, string> = { "Content-Type": contentType };
        if (antiCSRFToken) headers["anti-csrf"] = antiCSRFToken;

        // keepalive retains unload-time delivery while allowing the auth
        // middleware's required anti-CSRF header, which sendBeacon cannot set.
        await fetch(url, {
            method: "POST",
            headers,
            body: payload,
            keepalive: true,
        });
    };
}


export const useFeatureRecorder = () => {
    return useClientTelemetryEvent();
}


export const useRecordFeatureUse = (params: UseFeatureUseClientActivityParams) => {
    const recordEvent = useClientTelemetryEvent();
    // react likes to make redundant renders; throttle.
    const throttledRecordAction = useThrottle(() => {
        void collectDeviceInfo().then(deviceInfo => {
            try {
                void recordEvent(params);
            } catch (e) {
                console.error("Error recording feature use", e);
            }
        });
    }, 250);

    React.useEffect(throttledRecordAction, []);
}

export const getDashboardContextDataSingleton = () => {
    return getCmdbWindow().cmdbDashboardContext;
};


// MIGRATION_RESTORE: role-administration
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/core/components/dashboardContext/DashboardContext.tsx:197-311
// Reason: Single-band Role administration cannot execute against GlobalRole and BandRole.
// Restore: Restore role and permission editors, designations, account role assignment and continuity safeguards using GlobalRole/BandRole; never restore User.role.
// Verification: Adapt the preserved authorization and command tests; verify atomic designations, protected grants, fresh authorization, auditing and browser editors.
// SHA256: 72f3cf97c307e15909748689e623704199682e2ac030a53e2fd4eeab3ca4003d
// MIGRATION_REFERENCE_BEGIN
// export const DashboardContextProvider = ({ children }: React.PropsWithChildren<{}>) => {
//     const valueRef = React.useRef(new DashboardContextData());
//     const presentation = usePresentation();
//     const brand = useBrand();
//
//     const [currentUser] = useCurrentUser();
//     valueRef.current.currentUser = currentUser;
//
//     const [setShowingAdminControlsMutation] = useMutation(setShowingAdminControls);
//
//     const sess = useSession();
//     valueRef.current.session = sess;
//
//     // ALT+9 admin controls
//     React.useEffect(() => {
//         if (!sess.permissionNames?.includes(Permission.sysadmin)) {
//             return;
//         }
//         async function handleKeyPress(event) {
//             if (event.altKey && event.key === '9') {
//                 await setShowingAdminControlsMutation({ toggle: true });
//             }
//         }
//
//         window.addEventListener('keydown', handleKeyPress);
//         return () => {
//             window.removeEventListener('keydown', handleKeyPress);
//         };
//     }, [sess.permissionNames, setShowingAdminControlsMutation]);
//
//     const [dashboardDto, { refetch }] = useQuery(getDashboardData, presentation.data?.input ?? {});
//     const dashboardData = React.useMemo(() => db3.hydrateDashboardData(dashboardDto), [dashboardDto]);
//     valueRef.current.currentMembership = dashboardData.currentMembership;
//     valueRef.current.refetchDashboardData = refetch;
//     valueRef.current.permission = new TableAccessor(dashboardData.permission);
//
//     const authorizationContext = presentation.data?.authorization ?? dashboardData.authorization;
//     valueRef.current.authorizationContext = authorizationContext;
//
//     // todo: move to a proper routing mechanism
//     valueRef.current.memberPresentation = presentation.data?.input ?? {};
//     valueRef.current.effectivePermissions = new PermissionSet(authorizationContext.effectivePermissionNames);
//
//     const localization = presentation.data?.localization ?? dashboardData.localization;
//     valueRef.current.localePreferences = localization.preferences;
//     valueRef.current.formattingLocale = localization.formattingLocale;
//
//     valueRef.current.authorization = new CMClientAuthorization(currentUser, valueRef.current.effectivePermissions);
//
//     valueRef.current.userTag = new TableAccessor(dashboardData.userTag, tag => tag.publicId);
//     valueRef.current.wikiPageTag = new TableAccessor(
//         dashboardData.wikiPageTag,
//         tag => db3.xWikiPageTag.getIdentity(tag),
//     );
//     valueRef.current.role = new TableAccessor(
//         dashboardData.role,
//         role => db3.xRole.getIdentity(role),
//     );
//     valueRef.current.eventType = new TableAccessor(
//         dashboardData.eventType,
//         value => db3.xEventType.getIdentity(value),
//     );
//     valueRef.current.eventStatus = new TableAccessor(
//         dashboardData.eventStatus,
//         value => db3.xEventStatus.getIdentity(value),
//     );
//     valueRef.current.eventTag = new TableAccessor(
//         dashboardData.eventTag,
//         value => db3.xEventTag.getIdentity(value),
//     );
//     valueRef.current.eventAttendance = new TableAccessor(dashboardData.eventAttendance, value => db3.xEventAttendance.getIdentity(value));
//     valueRef.current.fileTag = new TableAccessor(
//         dashboardData.fileTag,
//         tag => db3.xFileTag.getIdentity(tag),
//     );
//     valueRef.current.referenceStore = dashboardData.referenceStore;
//     valueRef.current.instrumentFunctionalGroup = new TableAccessor(
//         dashboardData.instrumentFunctionalGroup,
//         group => group.publicId,
//     );
//     valueRef.current.songTag = new TableAccessor(
//         dashboardData.songTag,
//         tag => tag.publicId,
//     );
//     valueRef.current.songCreditType = new TableAccessor(dashboardData.songCreditType);
//     valueRef.current.serverBaseUri = dashboardData.serverBaseUri;
//     valueRef.current.serverStartupState = dashboardData.serverStartupState;
//     valueRef.current.relevantEventIds = dashboardData.relevantEventIds;
//     valueRef.current.bandTimeZone = dashboardData.bandTimeZone;
//
//     valueRef.current.settings = presentation.data?.settings ?? dashboardData.settings;
//
//     valueRef.current.brand = brand;
//     valueRef.current.localTimeZone = localTimeZone();
//
//     valueRef.current.eventDatePresentation = {
//         bandTimeZone: valueRef.current.bandTimeZone,
//         viewerTimeZone: valueRef.current.localTimeZone,
//         locale: valueRef.current.formattingLocale,
//     };
//
//     // establish singleton for use by non-react code
//     if (typeof window !== "undefined") { // Q: why is this necessary? shouldn't this always be running in a client browser with `window`?
//         getCmdbWindow().cmdbDashboardContext = valueRef.current;
//     }
//
//     valueRef.current.dynMenuLinks = new TableAccessor(dashboardData.dynMenuLinks);
//     valueRef.current.instrument = new TableAccessor(dashboardData.instrument, value => value.publicId);
//
//     return (
//         <DashboardContext.Provider value={{ data: valueRef.current }}>
//             {children}
//         </DashboardContext.Provider>
//     );
// };
// MIGRATION_REFERENCE_END
