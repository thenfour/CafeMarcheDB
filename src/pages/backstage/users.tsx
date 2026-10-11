import type { BlitzPage } from "@blitzjs/next";
import { Suspense } from "react";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { NavRealm } from "src/core/components/dashboard/StaticMenuItems";
import { BandMemberDirectory } from "src/core/components/user/BandMemberDirectory";
import { useLocale } from "src/locale/components/useLocale";
import { BandLocalizedMarkdown } from "src/setting/client/components/SettingMarkdown";

const UserSearchPage: BlitzPage = () => {
    const locale = useLocale();
    return <DashboardLayout title={locale.getPlainString("membership.directory.title")} navRealm={NavRealm.users}>
        <Suspense>
            <BandLocalizedMarkdown id="usersearch_markdown" />
            <BandMemberDirectory />
        </Suspense>
    </DashboardLayout>;
};
export default UserSearchPage;


// MIGRATION_RESTORE: directory-search
// Source: 1768352278c2ac37768c8bd2c2cc0ad5ffd4324a:src/pages/backstage/users.tsx:1-278
// Reason: The membership directory replaces the old user search with a smaller feature set.
// Restore: Restore multi-value filter operators, presets, URL state, contact search policy, and CSV export for the selected band.
// Verification: Test filter combinations, permission restrictions, pagination, URL round trips, and exported rows; exercise the built directory.
// SHA256: ceefce4b4dc79a3b769c6c5e1d8a2677e5a258bd17256da3d5f5172ba4bd5e29
// MIGRATION_REFERENCE_BEGIN
// import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
// import { useDashboardContext } from "@/src/core/components/dashboardContext/DashboardContext";
// import { UserOrderByColumnNames, UserOrderByColumnOption, UserOrderByColumnOptions, UsersFilterSpec } from "@/src/core/components/user/UserClientBaseTypes";
// import { EnrichedVerboseUser, UserListItem } from "@/src/core/components/user/UserListItem";
// import { BlitzPage } from "@blitzjs/next";
// import { Suspense } from "react";
// import { SortDirection } from "shared/rootroot";
// import { FilterGroupDefinition, SearchPageContent, SearchPageContentConfig } from "src/core/components/search/SearchPageContent";
// import { LocalizedMarkdown } from "@/src/setting/client/components/SettingMarkdown";
// import * as db3 from "src/core/db3/db3";
// import { DiscreteCriterionFilterType } from "src/core/db3/shared/apiTypes";
// import { userSearchConfig } from "src/core/hooks/searchConfigs";
// import { useDiscreteFilter, useSearchPage } from "src/core/hooks/useSearchFilters";
// import { Permission } from "@/shared/permissions";
// import type { UserTagPublicId } from "shared/publicId";
//
//
// // for serializing in compact querystring
// interface UsersFilterSpecStatic {
//     label: string,
//     helpText: string,
//
//     orderByColumn: UserOrderByColumnOption;
//     orderByDirection: SortDirection;
//
//     tagFilterEnabled: boolean;
//     tagFilterBehavior: DiscreteCriterionFilterType;
//     tagFilterOptions: UserTagPublicId[];
//
//     roleFilterEnabled: boolean;
//     roleFilterBehavior: DiscreteCriterionFilterType;
//     roleFilterOptions: number[];
//
//     instrumentFilterEnabled: boolean;
//     instrumentFilterBehavior: DiscreteCriterionFilterType;
//     instrumentFilterOptions: number[];
// };
//
//
//
// //////////////////////////////////////////////////////////////////////////////////////////////////
//
// const gStaticFilters: UsersFilterSpecStatic[] = [
//     {
//         label: "All",
//         helpText: "Searching all users",
//         orderByColumn: UserOrderByColumnOptions.name,
//         orderByDirection: "asc",
//         tagFilterBehavior: DiscreteCriterionFilterType.hasAllOf,
//         tagFilterOptions: [],
//         tagFilterEnabled: false,
//         instrumentFilterBehavior: DiscreteCriterionFilterType.hasAllOf,
//         instrumentFilterOptions: [],
//         instrumentFilterEnabled: false,
//         roleFilterBehavior: DiscreteCriterionFilterType.hasAny,
//         roleFilterOptions: [],
//         roleFilterEnabled: false,
//     },
//     {
//         label: "New",
//         helpText: "Searching new users",
//         orderByColumn: UserOrderByColumnOptions.createdAt,
//         orderByDirection: "desc",
//         tagFilterBehavior: DiscreteCriterionFilterType.hasNone,
//         tagFilterOptions: [],
//         tagFilterEnabled: true,
//         instrumentFilterBehavior: DiscreteCriterionFilterType.hasAllOf,
//         instrumentFilterOptions: [],
//         instrumentFilterEnabled: false,
//         roleFilterBehavior: DiscreteCriterionFilterType.hasAny,
//         roleFilterOptions: [],
//         roleFilterEnabled: false,
//     },
// ];
//
// const gDefaultStaticFilterName = "All" as const;
// const gDefaultStaticFilterValue = gStaticFilters.find(x => x.label === gDefaultStaticFilterName)!;
//
//
// //////////////////////////////////////////////////////////////////////////////////////////////////
// const UserListOuter = () => {
//     const dashboardContext = useDashboardContext();
//     const canManageUsers = dashboardContext.isAuthorized(Permission.manage_users);
//     const availableStaticFilters = canManageUsers
//         ? gStaticFilters
//         : gStaticFilters.filter(filter => filter.label !== "New");
//
//     // Individual filter hooks - still needed for the search page hook
//     const tagFilter = useDiscreteFilter<UserTagPublicId>({
//         urlPrefix: "tg",
//         db3Column: "tags",
//         defaultBehavior: gDefaultStaticFilterValue.tagFilterBehavior,
//         defaultOptions: gDefaultStaticFilterValue.tagFilterOptions,
//         defaultEnabled: gDefaultStaticFilterValue.tagFilterEnabled,
//     });
//
//     const roleFilter = useDiscreteFilter({
//         urlPrefix: "rl",
//         db3Column: "role",
//         defaultBehavior: gDefaultStaticFilterValue.roleFilterBehavior,
//         defaultOptions: gDefaultStaticFilterValue.roleFilterOptions,
//         defaultEnabled: gDefaultStaticFilterValue.roleFilterEnabled,
//     });
//
//     const instrumentFilter = useDiscreteFilter({
//         urlPrefix: "in",
//         db3Column: "instruments",
//         defaultBehavior: gDefaultStaticFilterValue.instrumentFilterBehavior,
//         defaultOptions: gDefaultStaticFilterValue.instrumentFilterOptions,
//         defaultEnabled: gDefaultStaticFilterValue.instrumentFilterEnabled,
//     });
//
//     // Using useSearchPage hook for centralized search page logic
//     const searchPage = useSearchPage<UsersFilterSpecStatic, UsersFilterSpec>({
//         table: db3.xUser,
//         staticFilters: availableStaticFilters,
//         defaultStaticFilter: gDefaultStaticFilterValue,
//         sortColumnKey: "orderByColumn",
//         sortDirectionKey: "orderByDirection",
//         filterMappings: [
//             { filterHook: tagFilter, columnKey: "tagFilter" },
//             ...(canManageUsers ? [{ filterHook: roleFilter, columnKey: "roleFilter" }] : []),
//             { filterHook: instrumentFilter, columnKey: "instrumentFilter" },
//         ],
//         buildFilterSpec: ({ refreshSerial, quickFilter, sortColumn, sortDirection, includeDeleted }) => {
//             const filterSpec: UsersFilterSpec = {
//                 refreshSerial,
//                 quickFilter,
//                 includeDeleted,
//                 orderByColumn: canManageUsers ? sortColumn as any : UserOrderByColumnOptions.name,
//                 orderByDirection: sortDirection,
//                 tagFilter: tagFilter.enabled ? tagFilter.criterion : { db3Column: "tags", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
//                 instrumentFilter: instrumentFilter.enabled ? instrumentFilter.criterion : { db3Column: "instruments", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
//                 roleFilter: canManageUsers && roleFilter.enabled ? roleFilter.criterion : { db3Column: "role", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
//             };
//             return filterSpec;
//         },
//         buildStaticFilterSpec: ({ sortColumn, sortDirection, filterMappings }) => {
//             const staticSpec: UsersFilterSpecStatic = {
//                 label: "(n/a)",
//                 helpText: "",
//                 orderByColumn: canManageUsers ? sortColumn as any : UserOrderByColumnOptions.name,
//                 orderByDirection: sortDirection,
//                 tagFilterEnabled: tagFilter.enabled,
//                 tagFilterBehavior: tagFilter.criterion.behavior,
//                 tagFilterOptions: tagFilter.criterion.options,
//                 roleFilterEnabled: canManageUsers && roleFilter.enabled,
//                 roleFilterBehavior: roleFilter.criterion.behavior,
//                 roleFilterOptions: roleFilter.criterion.options as number[],
//                 instrumentFilterEnabled: instrumentFilter.enabled,
//                 instrumentFilterBehavior: instrumentFilter.criterion.behavior,
//                 instrumentFilterOptions: instrumentFilter.criterion.options as number[],
//             };
//             return staticSpec;
//         }
//     });
//
//     // Configuration for the generic SearchPageContent component
//     const config: SearchPageContentConfig<UsersFilterSpecStatic, UsersFilterSpec, db3.UserClientPayload, EnrichedVerboseUser> = {
//         staticFilters: availableStaticFilters,
//         defaultStaticFilter: gDefaultStaticFilterValue,
//         sortColumnOptions: canManageUsers ? UserOrderByColumnOptions : { name: UserOrderByColumnOptions.name },
//         sortColumnNames: canManageUsers ? UserOrderByColumnNames : { name: UserOrderByColumnNames.name },
//         //useDataHook: (filterSpec) => useSearchableList(filterSpec, userSearchConfig),
//         searchConfig: userSearchConfig,
//         renderItem: (user, index, filterSpec, results, refetch) => (
//             <UserListItem
//                 index={index}
//                 key={user.publicId}
//                 user={user}
//                 filterSpec={filterSpec}
//                 refetch={refetch}
//                 results={results}
//             />
//         ),
//         getItemKey: (user) => user.publicId,
//         csvExporter: {
//             itemToCSVRow: (user, index) => ({
//                 Order: index.toString(),
//                 "Public ID": user.publicId,
//                 Name: user.name,
//                 URL: dashboardContext.routingApi.getURIForUser(user),
//             }),
//             filename: "users"
//         },
//         showAdminControls: canManageUsers,
//     };
//
//     // Filter hooks for passing to the generic component
//     const filterHooks = {
//         tags: tagFilter,
//         role: roleFilter,
//         instruments: instrumentFilter,
//     };
//
//     // Filter group definitions
//     const filterGroupDefinitions: FilterGroupDefinition[] = [
//         {
//             key: "tags",
//             label: "Tags",
//             type: "tags",
//             column: "tags",
//             chipTransformer: (x) => {
//                 if (!x.id) return x;
//                 const tag = dashboardContext.userTag.getById(db3.xBandUserTag.parseIdentity(x.id))!;
//                 return {
//                     ...x,
//                     color: tag.color || null,
//                     label: tag.name,
//                     shape: "rounded",
//                     tooltip: tag.description,
//                 };
//             }
//         },
//         ...(canManageUsers ? [{
//             key: "role",
//             label: "Role",
//             type: "foreignSingle",
//             column: "role",
//             chipTransformer: (x) => {
//                 if (!x.id) return x;
//                 const role = dashboardContext.role.getById(db3.xRole.parseIdentity(x.id))!;
//                 return {
//                     ...x,
//                     color: role.color || null,
//                     label: role.name,
//                     shape: "rectangle",
//                     tooltip: role.description,
//                 };
//             }
//         }] satisfies FilterGroupDefinition[] : []),
//         {
//             key: "instruments",
//             label: "Instruments",
//             type: "tags",
//             column: "instruments",
//             chipTransformer: (x) => {
//                 if (!x.id) return x;
//                 const instrument = dashboardContext.instrument.getById(db3.xInstrument.parseIdentity(x.id));
//                 if (!instrument) return x;
//                 const instrumentGroup = dashboardContext.instrumentFunctionalGroup.getById(instrument.functionalGroupId);
//                 if (!instrumentGroup) return x;
//                 return {
//                     ...x,
//                     color: instrumentGroup.color || null,
//                     label: instrument.name,
//                     shape: "rounded",
//                     tooltip: instrument.description,
//                 };
//             }
//         },
//     ];
//
//     return (
//         <SearchPageContent
//             config={config}
//             filterHooks={filterHooks}
//             filterGroupDefinitions={filterGroupDefinitions}
//             searchPageHook={searchPage}
//         />
//     );
// };
//
// //////////////////////////////////////////////////////////////////////////////////////////////////
// const UserSearchPage: BlitzPage = (props) => {
//     return (
//         <DashboardLayout title="Users">
//             <div className="eventsMainContent searchPage">
//                 <Suspense>
//                     <LocalizedMarkdown setting="usersearch_markdown"></LocalizedMarkdown>
//                 </Suspense>
//                 <UserListOuter />
//             </div>
//         </DashboardLayout>
//     )
// }
//
// export default UserSearchPage;
// MIGRATION_REFERENCE_END
