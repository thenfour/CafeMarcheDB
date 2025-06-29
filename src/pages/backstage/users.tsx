import { BlitzPage } from "@blitzjs/next";
import { Button, ListItemIcon, Menu, MenuItem } from "@mui/material";
import React, { Suspense } from "react";
import InfiniteScroll from "react-infinite-scroll-component";
import { StandardVariationSpec } from "shared/color";
import { Permission } from "shared/permissions";
import { SortDirection } from "shared/rootroot";
import { arrayToTSV } from "shared/utils";
import { CMChip, CMChipContainer, CMStandardDBChip } from "src/core/components/CMChip";
import { AdminInspectObject, CMSmallButton, GoogleIconSmall } from "src/core/components/CMCoreComponents2";
import { DashboardContext, useDashboardContext } from "src/core/components/DashboardContext";
import { SearchPageFilterControls, createFilterGroupConfig } from "src/core/components/SearchPageFilterControls";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { SnackbarContext, SnackbarContextType } from "src/core/components/SnackbarContext";
import { UserOrderByColumnOption, UserOrderByColumnOptions, UsersFilterSpec } from "src/core/components/UserComponents";
import { useUserListData } from "src/core/components/UserSearch";
import { getURIForUser } from "src/core/db3/clientAPILL";
import { gCharMap, gIconMap } from "src/core/db3/components/IconMap";
import * as db3 from "src/core/db3/db3";
import { DiscreteCriterionFilterType, SearchResultsRet } from "src/core/db3/shared/apiTypes";
import { useDiscreteFilter, useSearchPage } from "src/core/hooks/useSearchFilters";
import DashboardLayout from "src/core/layouts/DashboardLayout";
export type EnrichedVerboseUser = db3.EnrichedUser<db3.UserPayload>;

type UserListItemProps = {
    index: number;
    user: EnrichedVerboseUser;
    results: SearchResultsRet;
    refetch: () => void;
    filterSpec: UsersFilterSpec;
};

const UserListItem = (props: UserListItemProps) => {
    const dashboardContext = useDashboardContext();

    return <div className={`songListItem`}>
        <div className="titleLine">
            <div className="topTitleLine">
                <a className="nameLink" href={getURIForUser(props.user)}>{props.user.name}</a>
                <div style={{ flexGrow: 1 }}>
                    <AdminInspectObject src={props.user} label="Obj" />
                </div>
                <span className="resultIndex">#{props.index}</span>
            </div>
        </div>

        <div className="credits">
            <div className="credit row">
                <div className="fieldItem">{props.user.email}</div>
            </div>
            <div className="credit row">
                <div className="fieldItem">{props.user.phone}</div>
            </div>
        </div>

        <div className="searchBody">
            <CMChipContainer className="songTags">
                {props.user.tags.map(tag => <CMStandardDBChip
                    key={tag.id}
                    size='small'
                    model={tag.userTag}
                    variation={{ ...StandardVariationSpec.Weak, selected: props.filterSpec.tagFilter.options.includes(tag.userTagId) }}
                    getTooltip={(_) => tag.userTag.description}
                />)}
                {props.user.role &&
                    <CMChip
                        color={props.user.role.color}
                        shape={"rectangle"}
                        size="small"
                        variation={{ ...StandardVariationSpec.Strong, selected: props.filterSpec.roleFilter.options.includes(props.user.role.id) }}
                    >
                        {props.user.role.name}
                    </CMChip>}
                {props.user.googleId && <GoogleIconSmall />
                }
            </CMChipContainer>

            <CMChipContainer className="instruments">
                {props.user.instruments.map(tag => <CMStandardDBChip
                    key={tag.id}
                    size='small'
                    model={tag.instrument}
                    variation={{ ...StandardVariationSpec.Weak, selected: props.filterSpec.instrumentFilter.options.includes(tag.instrumentId) }}
                    getTooltip={(_) => tag.instrument.description}
                />)}
            </CMChipContainer>

        </div>
    </div>;
};









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
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const snackbarContext = React.useContext(SnackbarContext);

    const [autoLoadCount, setAutoLoadCount] = React.useState(0);
    const MAX_AUTO_LOADS = 15;

    const handleCopy = async () => {
        await CopyUserListCSV(snackbarContext, users);
    };

    // useEffect hook to check if more data needs to be loaded
    React.useEffect(() => {
        const checkIfNeedsMoreData = () => {
            const contentElement = document.querySelector('.eventList.searchResults');
            if (contentElement) {
                const contentHeight = contentElement.scrollHeight;
                const viewportHeight = window.innerHeight;

                if (contentHeight <= viewportHeight && hasMore && autoLoadCount < MAX_AUTO_LOADS) {
                    setAutoLoadCount(prevCount => prevCount + 1);
                    console.log(`autoLoadCount = ${autoLoadCount}`);
                    loadMoreData();
                }
            }
        };

        // Delay the check to ensure the DOM has updated
        setTimeout(checkIfNeedsMoreData, 0);
    }, [users]);

    return <div className="eventList searchResults">
        <div className="searchRecordCount">
            {results.rowCount === 0 ? "No items to show" : <>Displaying {users.length} items of {results.rowCount} total</>}
            <CMSmallButton className='DotMenu' onClick={(e) => setAnchorEl(anchorEl ? null : e.currentTarget)}>{gCharMap.VerticalEllipses()}</CMSmallButton>
            <Menu
                id="menu-searchResults"
                anchorEl={anchorEl}
                keepMounted
                open={Boolean(anchorEl)}
                onClose={() => setAnchorEl(null)}
            >
                <MenuItem onClick={async () => { await handleCopy(); setAnchorEl(null); }}>
                    <ListItemIcon>
                        {gIconMap.ContentCopy()}
                    </ListItemIcon>
                    Copy CSV
                </MenuItem>
            </Menu>
        </div>

        <InfiniteScroll
            dataLength={users.length}
            next={loadMoreData}
            hasMore={hasMore}
            loader={<h4>Loading...</h4>}
        //scrollableTarget="scrollableDiv"
        >
            {users.map((user, i) => (
                <UserListItem
                    index={i + 1}
                    key={user.id}
                    user={user}
                    filterSpec={filterSpec}
                    refetch={refetch}
                    results={results}
                />
            ))}
        </InfiniteScroll>
        {hasMore && <Button onClick={loadMoreData}>Load more results...</Button>}

    </div>;
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
