import { ClientSession, useSession } from '@blitzjs/auth';
import { useMutation, useQuery } from '@blitzjs/rpc';
import { Prisma } from "db";
import React from 'react';
import { Permission, gPublicPermissions } from 'shared/permissions';
import { partition, TableAccessor } from 'shared/rootroot';
import { useCurrentUser } from 'src/auth/hooks/useCurrentUser';
import getDashboardData from 'src/auth/queries/getDashboardData';
import * as db3 from "src/core/db3/db3";
import { ColorVariationSpec, gAppColors } from "shared/color";
import { GetStyleVariablesForColor } from "../components/Color";
import setShowingAdminControls from 'src/auth/mutations/setShowingAdminControls';

interface ObjectWithVisiblePermission {
    visiblePermissionId: number | null;
};

export class DashboardContextData extends db3.DashboardContextDataBase {
    metronomeSilencers: (() => void)[];
    userClientIntention: db3.xTableClientUsageContext;

    session: ClientSession | null;

    constructor() {
        super();
        this.metronomeSilencers = [];
    }

    isAuthorized(p: Permission | string) {
        if (!this.currentUser || !this.session) return gPublicPermissions.some(pp => pp === p);
        if (this.session.isSysAdmin) return true;
        return !!(this.session.permissions?.some(pp => pp === p));
    }

    isAuthorizedPermissionId(pid: number | null) {
        const pobj = this.permission.getById(pid);
        if (!pobj) {
            return false;
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
            colorId = gAppColors.private_visibility;
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
        return this.session?.showAdminControls && this.session.isSysAdmin;
    }

    getPermissionsForRole(roleId) {
        return this.rolePermission.filter(rp => rp.roleId === roleId).map(rp => this.permission.getById(rp.permissionId));
    }

    getRolesForPermission(permissionId) {
        return this.rolePermission.filter(rp => rp.permissionId === permissionId).map(rp => this.role.getById(rp.roleId));
    }

    getCancelledStatuses() {
        return this.eventStatus
            .filter(s => s.significance === db3.EventStatusSignificance.Cancelled);
    }

    partitionEventSegmentsByCancellation<Tseg extends Prisma.EventSegmentGetPayload<{ select: { statusId: true } }>>(segments: Tseg[]): [Tseg[], Tseg[]] {
        const cancelledEventStatusIds = this.getCancelledStatuses().map(x => x.id);
        const isCancelled = (seg: Tseg) => {
            if (seg.statusId == null) return false;
            return cancelledEventStatusIds.includes(seg.statusId);
        }
        return partition(segments, isCancelled);
    }

    sortInstruments<Tinst extends Prisma.InstrumentGetPayload<{ select: { id: true, sortOrder: true, functionalGroupId: true } }>>(instruments: Tinst[]): Tinst[] {
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

    isAttendanceIdGoing(attendanceId: number | null) {
        const attendance = this.eventAttendance.getById(attendanceId);
        if (!attendance) return false;
        return attendance.strength >= 50;
    }

    getVisibilityPermissions(): Prisma.PermissionGetPayload<{}>[] {
        return this.permission.filter(p => p.isVisibility);
    }
};


export const DashboardContext = React.createContext(new DashboardContextData());

export const useDashboardContext = () => React.useContext(DashboardContext);


export const DashboardContextProvider = ({ children }: React.PropsWithChildren<{}>) => {
    const valueRef = React.useRef(new DashboardContextData());

    const [currentUser] = useCurrentUser();
    valueRef.current.currentUser = currentUser;

    const [setShowingAdminControlsMutation] = useMutation(setShowingAdminControls);

    const sess = useSession();
    valueRef.current.session = sess;

    React.useEffect(() => {
        async function handleKeyPress(event) {
            if (event.altKey && event.key === '9') {
                await setShowingAdminControlsMutation({ toggle: true });
            }
        }

        // Add event listener
        window.addEventListener('keydown', handleKeyPress);

        // Remove event listener on cleanup
        return () => {
            window.removeEventListener('keydown', handleKeyPress);
        };
    }, []);

    const [dashboardData, { refetch }] = useQuery(getDashboardData, {});
    valueRef.current.userClientIntention = { intention: currentUser ? "user" : 'public', mode: 'primary', currentUser }
    valueRef.current.userTag = new TableAccessor(dashboardData.userTag);
    valueRef.current.permission = new TableAccessor(dashboardData.permission);
    valueRef.current.role = new TableAccessor(dashboardData.role);
    valueRef.current.rolePermission = new TableAccessor(dashboardData.rolePermission);
    valueRef.current.eventType = new TableAccessor(dashboardData.eventType);
    valueRef.current.eventStatus = new TableAccessor(dashboardData.eventStatus);
    valueRef.current.eventTag = new TableAccessor(dashboardData.eventTag);
    valueRef.current.eventAttendance = new TableAccessor(dashboardData.eventAttendance);
    valueRef.current.fileTag = new TableAccessor(dashboardData.fileTag);
    valueRef.current.instrumentTag = new TableAccessor(dashboardData.instrumentTag);
    valueRef.current.instrumentFunctionalGroup = new TableAccessor(dashboardData.instrumentFunctionalGroup);
    valueRef.current.songTag = new TableAccessor(dashboardData.songTag);
    valueRef.current.songCreditType = new TableAccessor(dashboardData.songCreditType);
    valueRef.current.dynMenuLinks = new TableAccessor(dashboardData.dynMenuLinks);
    valueRef.current.eventCustomField = new TableAccessor(dashboardData.eventCustomField);
    valueRef.current.serverStartupState = dashboardData.serverStartupState;
    valueRef.current.relevantEventIds = dashboardData.relevantEventIds;

    valueRef.current.instrument = new TableAccessor(dashboardData.instrument.map(i => db3.enrichInstrument(i, valueRef.current)));

    return <DashboardContext.Provider value={valueRef.current}>
        {children}
    </DashboardContext.Provider>
};

