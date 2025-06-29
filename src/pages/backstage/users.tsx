import { UserListItem } from "@/src/core/components/user/UserListItem";
import { BlitzPage } from "@blitzjs/next";
import React, { Suspense } from "react";
import { Permission } from "shared/permissions";
import { SortDirection } from "shared/rootroot";
import { arrayToTSV } from "shared/utils";
import { DashboardContext } from "src/core/components/DashboardContext";
import { SearchPageFilterControls, createFilterGroupConfig } from "src/core/components/SearchPageFilterControls";
import { SearchResultsList } from "src/core/components/SearchResultsList";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { SnackbarContext, SnackbarContextType } from "src/core/components/SnackbarContext";
import { UserOrderByColumnOption, UserOrderByColumnOptions, UsersFilterSpec } from "src/core/components/UserComponents";
import { useUserListData } from "src/core/components/UserSearch";
import { getURIForUser } from "src/core/db3/clientAPILL";
import * as db3 from "src/core/db3/db3";
import { DiscreteCriterionFilterType, SearchResultsRet } from "src/core/db3/shared/apiTypes";
import { useDiscreteFilter, useSearchPage } from "src/core/hooks/useSearchFilters";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { EnrichedVerboseUser } from "./wikiPageHistory";


// for serializing in compact querystring
interface UsersFilterSpecStatic {
    label: string,
    helpText: string,

    orderByColumn: UserOrderByColumnOption;
    orderByDirection: SortDirection;

    tagFilterEnabled: boolean;
    tagFilterBehavior: DiscreteCriterionFilterType;
    tagFilterOptions: number[];

    roleFilterEnabled: boolean;
    roleFilterBehavior: DiscreteCriterionFilterType;
    roleFilterOptions: number[];

    instrumentFilterEnabled: boolean;
    instrumentFilterBehavior: DiscreteCriterionFilterType;
    instrumentFilterOptions: number[];
};



async function CopyUserListCSV(snackbarContext: SnackbarContextType, value: EnrichedVerboseUser[]) {
    const obj = value.map((e, i) => ({
        Order: (i + 1).toString(),
        ID: e.id.toString(),
        Name: e.name,
        URL: getURIForUser(e),
    }));
    const txt = arrayToTSV(obj);
    await navigator.clipboard.writeText(txt);
    snackbarContext.showMessage({ severity: "success", children: `copied ${txt.length} chars` });
}




interface UsersListArgs {
    filterSpec: UsersFilterSpec,
    results: SearchResultsRet;
    users: EnrichedVerboseUser[],
    refetch: () => void;
    loadMoreData: () => void;
    hasMore: boolean;
};

const UsersList = ({ filterSpec, results, users, refetch, loadMoreData, hasMore }: UsersListArgs) => {
    const snackbarContext = React.useContext(SnackbarContext);

    const handleCopyCSV = async (items: db3.EnrichedVerboseUser[]) => {
        await CopyUserListCSV(snackbarContext, items);
    };

    return (
        <SearchResultsList
            items={users}
            results={results}
            filterSpec={filterSpec}
            loadMoreData={loadMoreData}
            hasMore={hasMore}
            refetch={refetch}
            onCopyCSV={handleCopyCSV}
            // Note: Users page doesn't use AppContextMarker in the original
            renderItem={(user, index) => (
                <UserListItem
                    index={index}
                    key={user.id}
                    user={user}
                    filterSpec={filterSpec}
                    refetch={refetch}
                    results={results}
                />
            )}
            getItemKey={(user) => user.id}
        />
    );
};

//////////////////////////////////////////////////////////////////////////////////////////////////

const gStaticFilters: UsersFilterSpecStatic[] = [
    {
        label: "All",
        helpText: "Searching all users",
        orderByColumn: UserOrderByColumnOptions.name,
        orderByDirection: "asc",
        tagFilterBehavior: DiscreteCriterionFilterType.hasAllOf,
        tagFilterOptions: [],
        tagFilterEnabled: false,
        instrumentFilterBehavior: DiscreteCriterionFilterType.hasAllOf,
        instrumentFilterOptions: [],
        instrumentFilterEnabled: false,
        roleFilterBehavior: DiscreteCriterionFilterType.hasAny,
        roleFilterOptions: [],
        roleFilterEnabled: false,
    },
];

const gDefaultStaticFilterName = "All" as const;
const gDefaultStaticFilterValue = gStaticFilters.find(x => x.label === gDefaultStaticFilterName)!;


//////////////////////////////////////////////////////////////////////////////////////////////////
const UserListOuter = () => {
    const dashboardContext = React.useContext(DashboardContext);
    const snackbarContext = React.useContext(SnackbarContext);

    // Individual filter hooks - still needed for the search page hook
    const tagFilter = useDiscreteFilter({
        urlPrefix: "tg",
        db3Column: "tags",
        defaultBehavior: gDefaultStaticFilterValue.tagFilterBehavior,
        defaultOptions: gDefaultStaticFilterValue.tagFilterOptions,
        defaultEnabled: gDefaultStaticFilterValue.tagFilterEnabled,
    });

    const roleFilter = useDiscreteFilter({
        urlPrefix: "rl",
        db3Column: "role",
        defaultBehavior: gDefaultStaticFilterValue.roleFilterBehavior,
        defaultOptions: gDefaultStaticFilterValue.roleFilterOptions,
        defaultEnabled: gDefaultStaticFilterValue.roleFilterEnabled,
    });

    const instrumentFilter = useDiscreteFilter({
        urlPrefix: "in",
        db3Column: "instruments",
        defaultBehavior: gDefaultStaticFilterValue.instrumentFilterBehavior,
        defaultOptions: gDefaultStaticFilterValue.instrumentFilterOptions,
        defaultEnabled: gDefaultStaticFilterValue.instrumentFilterEnabled,
    });

    // Using useSearchPage hook for centralized search page logic
    const searchPage = useSearchPage<UsersFilterSpecStatic, UsersFilterSpec>({
        staticFilters: gStaticFilters,
        defaultStaticFilter: gDefaultStaticFilterValue,
        sortColumnKey: "orderByColumn",
        sortDirectionKey: "orderByDirection",
        filterMappings: [
            { filterHook: tagFilter, columnKey: "tagFilter" },
            { filterHook: roleFilter, columnKey: "roleFilter" },
            { filterHook: instrumentFilter, columnKey: "instrumentFilter" },
        ],
        buildFilterSpec: ({ refreshSerial, quickFilter, sortColumn, sortDirection, filterMappings }) => {
            const filterSpec: UsersFilterSpec = {
                refreshSerial,
                quickFilter,
                orderByColumn: sortColumn as any,
                orderByDirection: sortDirection,
                tagFilter: tagFilter.enabled ? tagFilter.criterion : { db3Column: "tags", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
                instrumentFilter: instrumentFilter.enabled ? instrumentFilter.criterion : { db3Column: "instruments", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
                roleFilter: roleFilter.enabled ? roleFilter.criterion : { db3Column: "role", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
            };
            return filterSpec;
        },
        buildStaticFilterSpec: ({ sortColumn, sortDirection, filterMappings }) => {
            const staticSpec: UsersFilterSpecStatic = {
                label: "(n/a)",
                helpText: "",
                orderByColumn: sortColumn as any,
                orderByDirection: sortDirection,
                tagFilterEnabled: tagFilter.enabled,
                tagFilterBehavior: tagFilter.criterion.behavior,
                tagFilterOptions: tagFilter.criterion.options as number[],
                roleFilterEnabled: roleFilter.enabled,
                roleFilterBehavior: roleFilter.criterion.behavior,
                roleFilterOptions: roleFilter.criterion.options as number[],
                instrumentFilterEnabled: instrumentFilter.enabled,
                instrumentFilterBehavior: instrumentFilter.criterion.behavior,
                instrumentFilterOptions: instrumentFilter.criterion.options as number[],
            };
            return staticSpec;
        }
    }); const { enrichedItems, results, loadMoreData } = useUserListData(searchPage.filterSpec);

    // Configure filter groups for the generic component
    const filterGroups = [
        createFilterGroupConfig("tags", "Tags", "tags", "tags", tagFilter, (x) => {
            if (!x.id) return x;
            const tag = dashboardContext.userTag.getById(x.id)!;
            return {
                ...x,
                color: tag.color || null,
                label: tag.text,
                shape: "rounded",
                tooltip: tag.description,
            };
        }),
        createFilterGroupConfig("role", "Role", "foreignSingle", "role", roleFilter, (x) => {
            if (!x.id) return x;
            const role = dashboardContext.role.getById(x.id)!;
            return {
                ...x,
                color: role.color || null,
                label: role.name,
                shape: "rectangle",
                tooltip: role.description,
            };
        }),
        createFilterGroupConfig("instruments", "Instruments", "tags", "instruments", instrumentFilter, (x) => {
            if (!x.id) return x;
            const instrument = dashboardContext.instrument.getById(x.id);
            if (!instrument) return x;
            const instrumentGroup = dashboardContext.instrumentFunctionalGroup.getById(instrument.functionalGroupId);
            if (!instrumentGroup) return x;
            return {
                ...x,
                color: instrumentGroup.color || null,
                label: instrument.name,
                shape: "rounded",
                tooltip: instrument.description,
            };
        }),
    ];

    return <>
        <SearchPageFilterControls
            searchPage={searchPage}
            staticFilters={gStaticFilters}
            filterGroups={filterGroups}
            sortConfig={{
                columnOptions: Object.keys(UserOrderByColumnOptions),
                columnOptionsEnum: UserOrderByColumnOptions,
            }}
            results={results}
            showAdminControls={true}
        />
        <UsersList
            filterSpec={searchPage.filterSpec}
            users={enrichedItems}
            results={results}
            loadMoreData={loadMoreData}
            hasMore={enrichedItems.length < results.rowCount}
            refetch={() => searchPage.setRefreshSerial(searchPage.refreshSerial + 1)}
        />
    </>;
};

//////////////////////////////////////////////////////////////////////////////////////////////////
const UserSearchPage: BlitzPage = (props) => {
    return (
        <DashboardLayout title="Users" basePermission={Permission.search_users}>
            <div className="eventsMainContent searchPage">
                <Suspense>
                    <SettingMarkdown setting="usersearch_markdown"></SettingMarkdown>
                </Suspense>
                <UserListOuter />
            </div>
        </DashboardLayout>
    )
}

export default UserSearchPage;
