import { ClientSession, useSession } from '@blitzjs/auth';
import { useMutation, useQuery } from '@blitzjs/rpc';
import { Prisma } from "db";
import React from 'react';
import { Permission, gPublicPermissions } from 'shared/permissions';
import { TableAccessor } from 'shared/rootroot';
import { useCurrentUser } from 'src/auth/hooks/useCurrentUser';
import getDashboardData from 'src/auth/queries/getDashboardData';
import * as db3 from "src/core/db3/db3";
import { ColorVariationSpec, gAppColors } from "shared/color";
import { GetStyleVariablesForColor } from "../components/Color";
import setShowingAdminControls from 'src/auth/mutations/setShowingAdminControls';
import refreshSessionPermissions from 'src/auth/mutations/refreshSessionPermissions';

interface ObjectWithVisiblePermission {
    visiblePermissionId: number | null;
    //visiblePermission: db3.PermissionPayloadMinimum | null;
};


export class DashboardContextData {
    metronomeSilencers: (() => void)[];
    userClientIntention: db3.xTableClientUsageContext;

    userTag: TableAccessor<Prisma.UserTagGetPayload<{}>>;
    permission: TableAccessor<Prisma.PermissionGetPayload<{}>>;
    role: TableAccessor<Prisma.RoleGetPayload<{}>>;
    rolePermission: TableAccessor<Prisma.RolePermissionGetPayload<{}>>;
    eventType: TableAccessor<Prisma.EventTypeGetPayload<{}>>;
    eventStatus: TableAccessor<Prisma.EventStatusGetPayload<{}>>;
    eventTag: TableAccessor<Prisma.EventTagGetPayload<{}>>;
    eventAttendance: TableAccessor<Prisma.EventAttendanceGetPayload<{}>>;
    fileTag: TableAccessor<Prisma.FileTagGetPayload<{}>>;
    instrument: TableAccessor<Prisma.InstrumentGetPayload<{}>>;
    instrumentTag: TableAccessor<Prisma.InstrumentTagGetPayload<{}>>;
    instrumentFunctionalGroup: TableAccessor<Prisma.InstrumentFunctionalGroupGetPayload<{}>>;
    songTag: TableAccessor<Prisma.SongTagGetPayload<{}>>;
    songCreditType: TableAccessor<Prisma.SongCreditTypeGetPayload<{}>>;

    currentUser: db3.UserPayload | null;
    session: ClientSession | null;

    isAuthorized(p: Permission | string) {
        if (!this.currentUser || !this.session) return gPublicPermissions.some(pp => pp === p);
        if (this.session.isSysAdmin) return true;
        return !!(this.session.permissions?.some(pp => pp === p));
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

    // takes a bare event and applies eventstatus, type, visiblePermission, et al
    enrichEvent<T extends Partial<Prisma.EventGetPayload<{ include: { tags: true } }>>>(event: T) {
        // original payload type,
        // removing items we're replacing,
        // + stuff we're adding/changing.
        const ret: Omit<T, 'tags'> & Prisma.EventGetPayload<{
            select: {
                status: true,// add the fields we are treating
                type: true,
                visiblePermission: true,
                tags: {
                    include: {
                        eventTag: true,
                    }
                }
            },
        }> = {
            ...event,
            status: this.eventStatus.getById(event.statusId),
            type: this.eventType.getById(event.typeId),
            visiblePermission: this.permission.getById(event.visiblePermissionId),
            tags: (event.tags || []).map((t) => {
                const ret = {
                    ...t,
                    eventTag: this.eventTag.getById(t.eventTagId)! // enrich!
                };
                return ret;
            }).sort((a, b) => a.eventTag.sortOrder - b.eventTag.sortOrder), // respect ordering
        };

        return ret;
    }
};

type Orig = {
    tags: {

    }[];
};

export const DashboardContext = React.createContext(new DashboardContextData());

export const DashboardContextProvider = ({ children }: React.PropsWithChildren<{}>) => {
    const valueRef = React.useRef(new DashboardContextData());

    const [currentUser] = useCurrentUser();
    valueRef.current.currentUser = currentUser;

    const [setShowingAdminControlsMutation] = useMutation(setShowingAdminControls);
    const [refreshSessionPermissionsMutation] = useMutation(refreshSessionPermissions);

    React.useEffect(() => {
        void refreshSessionPermissionsMutation({});
    }, []);

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
    valueRef.current.instrument = new TableAccessor(dashboardData.instrument);
    valueRef.current.instrumentTag = new TableAccessor(dashboardData.instrumentTag);
    valueRef.current.instrumentFunctionalGroup = new TableAccessor(dashboardData.instrumentFunctionalGroup);
    valueRef.current.songTag = new TableAccessor(dashboardData.songTag);
    valueRef.current.songCreditType = new TableAccessor(dashboardData.songCreditType);

    return <DashboardContext.Provider value={valueRef.current}>
        {children}
    </DashboardContext.Provider>
};

