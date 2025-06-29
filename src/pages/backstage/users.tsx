import { UserListItem } from "@/src/core/components/user/UserListItem";
import { BlitzPage } from "@blitzjs/next";
import React, { Suspense } from "react";
import { Permission } from "shared/permissions";
import { SortDirection } from "shared/rootroot";
import { DashboardContext } from "src/core/components/DashboardContext";
import { SearchPageContent, FilterGroupDefinition, SearchPageContentConfig } from "src/core/components/SearchPageContent";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { UserOrderByColumnOption, UserOrderByColumnOptions, UsersFilterSpec } from "src/core/components/UserComponents";
import { useSearchableList } from "src/core/hooks/useSearchableList";
import { userSearchConfig } from "src/core/hooks/searchConfigs";
import { getURIForUser } from "src/core/db3/clientAPILL";
import { DiscreteCriterionFilterType } from "src/core/db3/shared/apiTypes";
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
    });

    // Configuration for the generic SearchPageContent component
    const config: SearchPageContentConfig<UsersFilterSpecStatic, UsersFilterSpec, EnrichedVerboseUser> = {
        staticFilters: gStaticFilters,
        defaultStaticFilter: gDefaultStaticFilterValue,
        sortColumnOptions: UserOrderByColumnOptions,
        useDataHook: (filterSpec) => useSearchableList(filterSpec, userSearchConfig),
        renderItem: (user, index, filterSpec, results, refetch) => (
            <UserListItem
                index={index}
                key={user.id}
                user={user}
                filterSpec={filterSpec}
                refetch={refetch}
                results={results}
            />
        ),
        getItemKey: (user) => user.id,
        csvExporter: {
            itemToCSVRow: (user, index) => ({
                Order: index.toString(),
                ID: user.id.toString(),
                Name: user.name,
                URL: getURIForUser(user),
            }),
            filename: "users"
        },
        showAdminControls: true,
    };

    // Filter hooks for passing to the generic component
    const filterHooks = {
        tags: tagFilter,
        role: roleFilter,
        instruments: instrumentFilter,
    };

    // Filter group definitions
    const filterGroupDefinitions: FilterGroupDefinition[] = [
        {
            key: "tags",
            label: "Tags",
            type: "tags",
            column: "tags",
            chipTransformer: (x) => {
                if (!x.id) return x;
                const tag = dashboardContext.userTag.getById(x.id)!;
                return {
                    ...x,
                    color: tag.color || null,
                    label: tag.text,
                    shape: "rounded",
                    tooltip: tag.description,
                };
            }
        },
        {
            key: "role",
            label: "Role",
            type: "foreignSingle",
            column: "role",
            chipTransformer: (x) => {
                if (!x.id) return x;
                const role = dashboardContext.role.getById(x.id)!;
                return {
                    ...x,
                    color: role.color || null,
                    label: role.name,
                    shape: "rectangle",
                    tooltip: role.description,
                };
            }
        },
        {
            key: "instruments",
            label: "Instruments",
            type: "tags",
            column: "instruments",
            chipTransformer: (x) => {
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
            }
        },
    ];

    return (
        <SearchPageContent
            config={config}
            filterHooks={filterHooks}
            filterGroupDefinitions={filterGroupDefinitions}
            searchPageHook={searchPage}
        />
    );
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
