import { permissionNamesSatisfyRequirement } from "src/auth/shared/permissionRequirement";
import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import { Alert } from "@mui/material";
import type { SortDirection } from "shared/rootroot";
import * as db3 from "src/core/db3/db3";
import { DiscreteCriterionFilterType as Behavior } from "src/core/db3/shared/apiTypes";
import { useDB3QueryContext } from "src/core/db3/components/useDB3Context";
import { userSearchConfig } from "src/core/hooks/searchConfigs";
import { useDiscreteFilter, useSearchPage } from "src/core/hooks/useSearchFilters";
import { useLocale } from "src/locale/components/useLocale";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { CMLink } from "@/src/route/CMLink";
import { useDashboardContext } from "../dashboardContext/DashboardContext";
import { SearchPageContent, type SearchPageContentConfig, type FilterGroupDefinition } from "../search/SearchPageContent";
import { UserListItem } from "./UserListItem";
import { UserOrderByColumnNames, UserOrderByColumnOptions, type UserOrderByColumnOption, type UsersFilterSpec } from "./UserClientBaseTypes";
import { portalHref } from "src/route/portalRouting";
import { bandMemberHref } from "./bandMemberLinks";
import { useCmdbRouter } from "@/src/route/useCmdbRouter";

interface MemberPreset {
    label: string;
    helpText: string;
    orderByColumn: UserOrderByColumnOption;
    orderByDirection: SortDirection;
    tagFilterEnabled: boolean;
    tagFilterBehavior: Behavior;
    tagFilterOptions: string[];
    roleFilterEnabled: boolean;
    roleFilterBehavior: Behavior;
    roleFilterOptions: string[];
    instrumentFilterEnabled: boolean;
    instrumentFilterBehavior: Behavior;
    instrumentFilterOptions: string[];
}

const all: MemberPreset = {
    label: "All",
    helpText: "Searching all members",
    orderByColumn: "name",
    orderByDirection: "asc",
    tagFilterEnabled: false,
    tagFilterBehavior: Behavior.hasAllOf,
    tagFilterOptions: [],
    roleFilterEnabled: false,
    roleFilterBehavior: Behavior.hasAny,
    roleFilterOptions: [],
    instrumentFilterEnabled: false,
    instrumentFilterBehavior: Behavior.hasAllOf,
    instrumentFilterOptions: [],
};
const newMembers: MemberPreset = {
    ...all, label: "New",
    helpText: "Searching new members",
    orderByColumn: "createdAt",
    orderByDirection: "desc",
    tagFilterEnabled: true,
    tagFilterBehavior: Behavior.hasNone
};

function memberSort(value: string, canManage: boolean): UserOrderByColumnOption {
    return canManage && value === "createdAt" ? "createdAt" : "name";
}

function LoadedMemberDirectory() {
    const dashboard = useDashboardContext();
    const context = useDB3QueryContext();
    const router = useCmdbRouter();
    const locale = useLocale();
    const canManage = dashboard.isAuthorized(BandPermission.manage_users);
    const allPreset = { ...all, label: locale.getPlainString("membership.directory.all"), helpText: locale.getPlainString("membership.directory.allDescription") };
    const newPreset = { ...newMembers, label: locale.getPlainString("membership.directory.new"), helpText: locale.getPlainString("membership.directory.newDescription") };
    const presets = canManage ? [allPreset, newPreset] : [allPreset];
    const tagFilter = useDiscreteFilter<string>({
        urlPrefix: "tg", db3Column: "bandUserTagAssignments",
        defaultBehavior: all.tagFilterBehavior, defaultOptions: [], defaultEnabled: false
    });
    const roleFilter = useDiscreteFilter<string>({
        urlPrefix: "rl", db3Column: "bandRole",
        defaultBehavior: all.roleFilterBehavior, defaultOptions: [], defaultEnabled: false
    });
    const instrumentFilter = useDiscreteFilter<string>({
        urlPrefix: "in", db3Column: "bandUserInstruments",
        defaultBehavior: all.instrumentFilterBehavior, defaultOptions: [], defaultEnabled: false
    });
    const searchPage = useSearchPage<MemberPreset, UsersFilterSpec>({
        table: db3.xBandUser, staticFilters: presets, defaultStaticFilter: all,
        sortColumnKey: "orderByColumn", sortDirectionKey: "orderByDirection",
        filterMappings: [{ filterHook: tagFilter, columnKey: "tagFilter" },
        ...(canManage ? [{ filterHook: roleFilter, columnKey: "roleFilter" }] : []),
        { filterHook: instrumentFilter, columnKey: "instrumentFilter" }],
        buildFilterSpec: ({ quickFilter, refreshSerial, sortColumn, sortDirection, includeDeleted }) => ({
            quickFilter,
            refreshSerial,
            includeDeleted,
            orderByColumn: memberSort(sortColumn, canManage),
            orderByDirection: sortDirection,
            tagFilter: tagFilter.enabled ? tagFilter.criterion : {
                db3Column: "bandUserTagAssignments",
                behavior: Behavior.alwaysMatch,
                options: []
            },
            instrumentFilter: instrumentFilter.enabled ? instrumentFilter.criterion : {
                db3Column: "bandUserInstruments",
                behavior: Behavior.alwaysMatch,
                options: []
            },
            roleFilter: canManage && roleFilter.enabled ? roleFilter.criterion : {
                db3Column: "bandRole",
                behavior: Behavior.alwaysMatch,
                options: []
            },
        }),
        buildStaticFilterSpec: ({ sortColumn, sortDirection }) => ({
            label: "(n/a)",
            helpText: "",
            orderByColumn: memberSort(sortColumn, canManage),
            orderByDirection: sortDirection,
            tagFilterEnabled: tagFilter.enabled,
            tagFilterBehavior: tagFilter.criterion.behavior,
            tagFilterOptions: tagFilter.criterion.options.map(String),
            roleFilterEnabled: canManage && roleFilter.enabled,
            roleFilterBehavior: roleFilter.criterion.behavior,
            roleFilterOptions: roleFilter.criterion.options.map(String),
            instrumentFilterEnabled: instrumentFilter.enabled,
            instrumentFilterBehavior: instrumentFilter.criterion.behavior,
            instrumentFilterOptions: instrumentFilter.criterion.options.map(String),
        }),
    });
    const config: SearchPageContentConfig<MemberPreset, UsersFilterSpec, db3.BandUserSearchDto, db3.BandUserSearchClient> = {
        staticFilters: presets, defaultStaticFilter: all,
        sortColumnOptions: canManage ? UserOrderByColumnOptions : { name: "name" },
        sortColumnNames: canManage ? UserOrderByColumnNames : { name: "Name" },
        searchConfig: userSearchConfig,
        renderItem: (user, index, filterSpec, results, refetch) => <UserListItem user={user} index={index} filterSpec={filterSpec} refetch={refetch} />,
        getItemKey: user => user.publicId,
        csvExporter: {
            filename: "users", itemToCSVRow: (member, index) => ({
                Order: index, "Public ID": member.user.publicId, Name: member.user.name ?? "",
                URL: bandMemberHref(member.user.publicId, context, router.hosting),
            })
        },
        showAdminControls: canManage, className: "usersListContainer",
    };
    const groups: FilterGroupDefinition[] = [
        {
            key: "tags",
            label: "Tags",
            type: "tags",
            column: "bandUserTagAssignments"
        },
        ...(canManage ? [{ key: "role", label: "Role", type: "foreignSingle", column: "bandRole" }] : []),
        { key: "instruments", label: "Instruments", type: "tags", column: "bandUserInstruments" },
    ];
    return <div className="eventsMainContent searchPage">
        {dashboard.isAuthorized(BandPermission.recover_users) && <CMLink href={portalHref("/backstage/recoverMembers", context, router.hosting)}>{locale.getPlainString("membership.lifecycle.recoveryTitle")}</CMLink>}
        <SearchPageContent config={config} filterHooks={{ tags: tagFilter, role: roleFilter, instruments: instrumentFilter }}
            filterGroupDefinitions={groups} searchPageHook={searchPage} />
    </div>;
}

export function BandMemberDirectory() {
    const presentation = usePresentation();
    const locale = useLocale();
    if (!presentation.bandPublicId) {
        return <Alert severity="info">{locale.getPlainString("membership.directory.noBand")}</Alert>;
    }
    const permissions = presentation.data?.authorization.effectivePermissionNames ?? [];
    if (!permissionNamesSatisfyRequirement(permissions, BandPermission.search_users, Boolean(presentation.bandPublicId)) || !permissionNamesSatisfyRequirement(permissions, BandPermission.view_users_basic_info, Boolean(presentation.bandPublicId))) {
        return <Alert severity="info">{locale.getPlainString("membership.directory.noAccess")}</Alert>;
    }
    return <LoadedMemberDirectory key={`${presentation.bandPublicId}/${presentation.data?.input.clientRequestId}`} />;
}
