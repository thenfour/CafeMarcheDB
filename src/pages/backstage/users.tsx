import { BlitzPage } from "@blitzjs/next";
import { Button, ListItemIcon, Menu, MenuItem } from "@mui/material";
import React, { Suspense } from "react";
import InfiniteScroll from "react-infinite-scroll-component";
import { arraysContainSameValues } from "shared/arrayUtils";
import { StandardVariationSpec } from "shared/color";
import { Permission } from "shared/permissions";
import { SortDirection } from "shared/rootroot";
import { arrayToTSV } from "shared/utils";
import { CMChip, CMChipContainer, CMStandardDBChip } from "src/core/components/CMChip";
import { AdminInspectObject, CMSinglePageSurfaceCard } from "src/core/components/CMCoreComponents";
import { CMSmallButton, GoogleIconSmall, useURLState } from "src/core/components/CMCoreComponents2";
import { DashboardContext, useDashboardContext } from "src/core/components/DashboardContext";
import { FilterControls, SortByGroup, SortBySpec, TagsFilterGroup } from "src/core/components/FilterControl";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { SnackbarContext, SnackbarContextType } from "src/core/components/SnackbarContext";
import { UserOrderByColumnOption, UserOrderByColumnOptions, UsersFilterSpec } from "src/core/components/UserComponents";
import { useUserListData } from "src/core/components/UserSearch";
import { getURIForUser } from "src/core/db3/clientAPILL";
import { gCharMap, gIconMap } from "src/core/db3/components/IconMap";
import * as db3 from "src/core/db3/db3";
import { DiscreteCriterion, DiscreteCriterionFilterType, SearchResultsRet } from "src/core/db3/shared/apiTypes";
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

    const [refreshSerial, setRefreshSerial] = React.useState<number>(0);

    const [quickFilter, setQuickFilter] = useURLState<string>("qf", "");

    const [sortColumn, setSortColumn] = useURLState<string>("sc", gDefaultStaticFilterValue.orderByColumn);
    const [sortDirection, setSortDirection] = useURLState<SortDirection>("sd", gDefaultStaticFilterValue.orderByDirection);

    const sortModel: SortBySpec = {
        columnName: sortColumn,
        direction: sortDirection,
    };
    const setSortModel = (x: SortBySpec) => {
        setSortColumn(x.columnName);
        setSortDirection(x.direction);
    };

    // "tg" prefix
    const [tagFilterBehaviorWhenEnabled, setTagFilterBehaviorWhenEnabled] = useURLState<DiscreteCriterionFilterType>("tgb", gDefaultStaticFilterValue.tagFilterBehavior);
    const [tagFilterOptionsWhenEnabled, setTagFilterOptionsWhenEnabled] = useURLState<number[]>("tgo", gDefaultStaticFilterValue.tagFilterOptions);
    const [tagFilterEnabled, setTagFilterEnabled] = useURLState<boolean>("tge", gDefaultStaticFilterValue.tagFilterEnabled);
    const tagFilterWhenEnabled: DiscreteCriterion = {
        db3Column: "tags",
        behavior: tagFilterBehaviorWhenEnabled,
        options: tagFilterOptionsWhenEnabled,
    };
    const setTagFilterWhenEnabled = (x: DiscreteCriterion) => {
        setTagFilterBehaviorWhenEnabled(x.behavior);
        setTagFilterOptionsWhenEnabled(x.options as any);
    };

    // "rl" prefix
    const [roleFilterBehaviorWhenEnabled, setRoleFilterBehaviorWhenEnabled] = useURLState<DiscreteCriterionFilterType>("rlb", gDefaultStaticFilterValue.roleFilterBehavior);
    const [roleFilterOptionsWhenEnabled, setRoleFilterOptionsWhenEnabled] = useURLState<number[]>("rlo", gDefaultStaticFilterValue.roleFilterOptions);
    const [roleFilterEnabled, setRoleFilterEnabled] = useURLState<boolean>("rle", gDefaultStaticFilterValue.roleFilterEnabled);
    const roleFilterWhenEnabled: DiscreteCriterion = {
        db3Column: "role",
        behavior: roleFilterBehaviorWhenEnabled,
        options: roleFilterOptionsWhenEnabled,
    };
    const setRoleFilterWhenEnabled = (x: DiscreteCriterion) => {
        setRoleFilterBehaviorWhenEnabled(x.behavior);
        setRoleFilterOptionsWhenEnabled(x.options as any);
    };

    // "in" prefix
    const [instrumentFilterBehaviorWhenEnabled, setInstrumentFilterBehaviorWhenEnabled] = useURLState<DiscreteCriterionFilterType>("inb", gDefaultStaticFilterValue.instrumentFilterBehavior);
    const [instrumentFilterOptionsWhenEnabled, setInstrumentFilterOptionsWhenEnabled] = useURLState<number[]>("ino", gDefaultStaticFilterValue.instrumentFilterOptions);
    const [instrumentFilterEnabled, setInstrumentFilterEnabled] = useURLState<boolean>("ine", gDefaultStaticFilterValue.instrumentFilterEnabled);
    const instrumentFilterWhenEnabled: DiscreteCriterion = {
        db3Column: "instruments",
        behavior: instrumentFilterBehaviorWhenEnabled,
        options: instrumentFilterOptionsWhenEnabled,
    };
    const setInstrumentFilterWhenEnabled = (x: DiscreteCriterion) => {
        setInstrumentFilterBehaviorWhenEnabled(x.behavior);
        setInstrumentFilterOptionsWhenEnabled(x.options as any);
    };

    // the default basic filter spec when no params specified.
    const filterSpec: UsersFilterSpec = {
        refreshSerial,

        // in dto...
        quickFilter,

        orderByColumn: sortColumn as any,
        orderByDirection: sortDirection,

        tagFilter: tagFilterEnabled ? tagFilterWhenEnabled : { db3Column: "tags", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
        instrumentFilter: instrumentFilterEnabled ? instrumentFilterWhenEnabled : { db3Column: "instruments", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
        roleFilter: roleFilterEnabled ? roleFilterWhenEnabled : { db3Column: "role", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
    };

    const { enrichedItems, results, loadMoreData } = useUserListData(filterSpec);

    const handleCopyFilterspec = () => {
        const o: UsersFilterSpecStatic = {
            label: "(n/a)",
            helpText: "",
            orderByColumn: sortColumn as any,
            orderByDirection: sortDirection,

            tagFilterEnabled,
            tagFilterBehavior: tagFilterBehaviorWhenEnabled,
            tagFilterOptions: tagFilterOptionsWhenEnabled,

            roleFilterEnabled,
            roleFilterBehavior: roleFilterBehaviorWhenEnabled,
            roleFilterOptions: roleFilterOptionsWhenEnabled,

            instrumentFilterEnabled,
            instrumentFilterBehavior: instrumentFilterBehaviorWhenEnabled,
            instrumentFilterOptions: instrumentFilterOptionsWhenEnabled,
        }
        const txt = JSON.stringify(o, null, 2);
        console.log(o);
        navigator.clipboard.writeText(txt).then(() => {
            snackbarContext.showMessage({ severity: "success", children: `copied ${txt.length} chars` });
        }).catch(() => {
            // nop
        });
    };

    const handleClickStaticFilter = (x: UsersFilterSpecStatic) => {
        setSortColumn(x.orderByColumn);
        setSortDirection(x.orderByDirection);

        setTagFilterEnabled(x.tagFilterEnabled);
        setTagFilterBehaviorWhenEnabled(x.tagFilterBehavior);
        setTagFilterOptionsWhenEnabled(x.tagFilterOptions);

        setRoleFilterEnabled(x.roleFilterEnabled);
        setRoleFilterBehaviorWhenEnabled(x.roleFilterBehavior);
        setRoleFilterOptionsWhenEnabled(x.roleFilterOptions);

        setInstrumentFilterEnabled(x.instrumentFilterEnabled);
        setInstrumentFilterBehaviorWhenEnabled(x.instrumentFilterBehavior);
        setInstrumentFilterOptionsWhenEnabled(x.instrumentFilterOptions);
    };

    const MatchesStaticFilter = (x: UsersFilterSpecStatic): boolean => {
        if (sortColumn !== x.orderByColumn) return false;
        if (sortDirection !== x.orderByDirection) return false;

        if (x.tagFilterEnabled !== tagFilterEnabled) return false;
        if (tagFilterEnabled) {
            if (tagFilterBehaviorWhenEnabled !== x.tagFilterBehavior) return false;
            if (!arraysContainSameValues(tagFilterOptionsWhenEnabled, x.tagFilterOptions)) return false;
        }

        if (x.roleFilterEnabled !== roleFilterEnabled) return false;
        if (roleFilterEnabled) {
            if (roleFilterBehaviorWhenEnabled !== x.roleFilterBehavior) return false;
            if (!arraysContainSameValues(roleFilterOptionsWhenEnabled, x.roleFilterOptions)) return false;
        }

        if (x.instrumentFilterEnabled !== instrumentFilterEnabled) return false;
        if (instrumentFilterEnabled) {
            if (instrumentFilterBehaviorWhenEnabled !== x.instrumentFilterBehavior) return false;
            if (!arraysContainSameValues(instrumentFilterOptionsWhenEnabled, x.instrumentFilterOptions)) return false;
        }

        return true;
    };

    const matchingStaticFilter = gStaticFilters.find(x => MatchesStaticFilter(x));

    const hasExtraFilters = ((): boolean => {
        if (!!matchingStaticFilter) return false;
        if (tagFilterEnabled) return true;
        if (roleFilterEnabled) return true;
        if (instrumentFilterEnabled) return true;
        return false;
    })();

    const hasAnyFilters = hasExtraFilters;

    return <>
        <CMSinglePageSurfaceCard className="filterControls">
            <div className="content">

                {dashboardContext.isShowingAdminControls && <CMSmallButton onClick={handleCopyFilterspec}>Copy filter spec</CMSmallButton>}
                <AdminInspectObject src={filterSpec} label="Filter spec" />
                <AdminInspectObject src={results} label="Results obj" />
                <FilterControls
                    inCard={false}
                    onQuickFilterChange={(v) => setQuickFilter(v)}
                    onResetFilter={() => {
                        handleClickStaticFilter(gDefaultStaticFilterValue);
                    }}
                    hasAnyFilters={hasAnyFilters}
                    hasExtraFilters={hasExtraFilters}
                    quickFilterText={filterSpec.quickFilter}
                    primaryFilter={
                        <div>
                            <CMChipContainer>
                                {
                                    gStaticFilters.map(e => {
                                        const doesMatch = e.label === matchingStaticFilter?.label;// MatchesStaticFilter(e[1]);
                                        return <CMChip
                                            key={e.label}
                                            onClick={() => handleClickStaticFilter(e)} size="small"
                                            variation={{ ...StandardVariationSpec.Strong, selected: doesMatch }}
                                            shape="rectangle"
                                        >
                                            {e.label}
                                        </CMChip>;
                                    })
                                }
                                {matchingStaticFilter && <div className="tinyCaption">{matchingStaticFilter.helpText}</div>}
                            </CMChipContainer>
                        </div>
                    }
                    extraFilter={
                        <div>
                            <TagsFilterGroup
                                label={"Tags"}
                                style="tags"
                                filterEnabled={tagFilterEnabled}
                                errorMessage={results?.filterQueryResult.errors.find(x => x.column === "tags")?.error}
                                value={tagFilterWhenEnabled}
                                onChange={(n, enabled) => {
                                    setTagFilterEnabled(enabled);
                                    setTagFilterWhenEnabled(n);
                                }}
                                items={results.facets.find(f => f.db3Column === "tags")?.items || []}
                                sanitize={x => {
                                    if (!x.id) return x;
                                    const tag = dashboardContext.userTag.getById(x.id)!;
                                    return {
                                        ...x,
                                        color: tag.color || null,
                                        label: tag.text,
                                        shape: "rounded",
                                        tooltip: tag.description,
                                    };
                                }}
                            />

                            <div className="divider" />
                            <TagsFilterGroup
                                label={"Role"}
                                style="foreignSingle"
                                errorMessage={results?.filterQueryResult.errors.find(x => x.column === "role")?.error}
                                value={roleFilterWhenEnabled}
                                filterEnabled={roleFilterEnabled}
                                onChange={(n, enabled) => {
                                    setRoleFilterEnabled(enabled);
                                    setRoleFilterWhenEnabled(n);
                                }}
                                items={results.facets.find(f => f.db3Column === "role")?.items || []}
                                sanitize={x => {
                                    if (!x.id) return x;
                                    const role = dashboardContext.role.getById(x.id)!;
                                    return {
                                        ...x,
                                        color: role.color || null,
                                        label: role.name,
                                        shape: "rectangle",
                                        tooltip: role.description,
                                    };
                                }}
                            />

                            <div className="divider" />
                            <TagsFilterGroup
                                label={"Instruments"}
                                style="tags"
                                filterEnabled={instrumentFilterEnabled}
                                errorMessage={results?.filterQueryResult.errors.find(x => x.column === "instruments")?.error}
                                value={instrumentFilterWhenEnabled}
                                onChange={(n, enabled) => {
                                    setInstrumentFilterEnabled(enabled);
                                    setInstrumentFilterWhenEnabled(n);
                                }}
                                items={results.facets.find(f => f.db3Column === "instruments")?.items || []}
                                sanitize={x => {
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
                                }}
                            />

                        </div>
                    } // extra filter
                    footerFilter={
                        <div>
                            <div className="divider" />
                            <SortByGroup
                                columnOptions={Object.keys(UserOrderByColumnOptions)}
                                setValue={setSortModel}
                                value={sortModel}
                            />
                        </div>
                    }
                />
            </div>

        </CMSinglePageSurfaceCard>
        <UsersList
            filterSpec={filterSpec}
            users={enrichedItems}
            results={results}
            loadMoreData={loadMoreData}
            hasMore={enrichedItems.length < results.rowCount}
            refetch={() => setRefreshSerial(refreshSerial + 1)}
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
