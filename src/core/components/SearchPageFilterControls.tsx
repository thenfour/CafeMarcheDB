import React from "react";
import { StandardVariationSpec } from "shared/color";
import { SearchResultsRet } from "src/core/db3/shared/apiTypes";
import { CMChip, CMChipContainer } from "./CMChip";
import { AdminInspectObject, CMSmallButton } from "./CMCoreComponents2";
import { DashboardContext } from "./DashboardContext";
import { FilterControls, SortByGroup, TagsFilterGroup } from "./FilterControl";
import { CMSinglePageSurfaceCard } from "./CMCoreComponents";
import { DiscreteFilterState, SearchPageState } from "../hooks/useSearchFilters";

//////////////////////////////////////////////////////////////////////////////////////////////////
// Filter Group Configuration Types
//////////////////////////////////////////////////////////////////////////////////////////////////

export interface FilterGroupConfig {
    key: string; // unique identifier for this filter group
    label: React.ReactNode;
    style: "tags" | "foreignSingle" | "radio";
    db3Column: string; // for finding facet data and errors
    filterHook: DiscreteFilterState<any>;

    // Optional customization
    sanitize?: (item: any) => any; // for transforming facet items (e.g., adding colors, tooltips)
}

export interface SortConfig {
    columnOptions: string[];
    columnOptionsEnum?: Record<string, string>; // for mapping display names
}

//////////////////////////////////////////////////////////////////////////////////////////////////
// Generic Search Page Filter Controls Component
//////////////////////////////////////////////////////////////////////////////////////////////////

export interface SearchPageFilterControlsProps<TStaticFilter> {
    // Core search page state
    searchPage: SearchPageState<TStaticFilter, any>;

    // Static filters (still ad-hoc by design)
    staticFilters: TStaticFilter[];

    // Filter group configurations
    filterGroups: FilterGroupConfig[];

    // Sort configuration (optional)
    sortConfig?: SortConfig;

    // Search results for facet data
    results: SearchResultsRet;

    // Optional admin debug info
    showAdminControls?: boolean;

    // Optional customization
    className?: string;
    primaryFilterExtra?: React.ReactNode; // additional content in primary filter area
    footerExtra?: React.ReactNode; // additional content in footer area
}

export function SearchPageFilterControls<TStaticFilter extends { label: string; helpText: string }>(
    props: SearchPageFilterControlsProps<TStaticFilter>
) {
    const dashboardContext = React.useContext(DashboardContext);

    // Primary filter: static filter chips
    const primaryFilter = (
        <div>
            <CMChipContainer>
                {props.staticFilters.map(e => {
                    const doesMatch = e.label === props.searchPage.matchingStaticFilter?.label;
                    return (
                        <CMChip
                            key={e.label}
                            onClick={() => props.searchPage.handleClickStaticFilter(e)}
                            size="small"
                            variation={{ ...StandardVariationSpec.Strong, selected: doesMatch }}
                            shape="rectangle"
                        >
                            {e.label}
                        </CMChip>
                    );
                })}
                {props.searchPage.matchingStaticFilter && (
                    <div className="tinyCaption">{props.searchPage.matchingStaticFilter.helpText}</div>
                )}
            </CMChipContainer>
            {props.primaryFilterExtra}
        </div>
    );

    // Extra filter: individual filter groups
    const extraFilter = props.filterGroups.length > 0 ? (
        <div>
            {props.filterGroups.map((filterGroup, index) => (
                <React.Fragment key={filterGroup.key}>
                    <TagsFilterGroup
                        label={filterGroup.label}
                        style={filterGroup.style}
                        errorMessage={props.results?.filterQueryResult.errors.find(x => x.column === filterGroup.db3Column)?.error}
                        value={filterGroup.filterHook.criterion}
                        filterEnabled={filterGroup.filterHook.enabled}
                        onChange={(criterion, enabled) => {
                            filterGroup.filterHook.setEnabled(enabled);
                            filterGroup.filterHook.setCriterion(criterion);
                        }}
                        items={props.results.facets.find(f => f.db3Column === filterGroup.db3Column)?.items || []}
                        sanitize={filterGroup.sanitize}
                    />
                    {index < props.filterGroups.length - 1 && <div className="divider" />}
                </React.Fragment>
            ))}
        </div>
    ) : undefined;

    // Footer filter: sort controls
    const footerFilter = props.sortConfig ? (
        <div>
            <div className="divider" />
            <SortByGroup
                columnOptions={Object.keys(props.sortConfig.columnOptionsEnum ||
                    props.sortConfig.columnOptions.reduce((acc, col) => ({ ...acc, [col]: col }), {}))}
                value={props.searchPage.sortModel}
                setValue={props.searchPage.setSortModel}
            />
        </div>
    ) : props.footerExtra ? (
        <div>
            <div className="divider" />
            {props.footerExtra}
        </div>
    ) : undefined;

    return (
        <CMSinglePageSurfaceCard className={`filterControls ${props.className || ""}`}>
            <div className="content">
                {props.showAdminControls && dashboardContext.isShowingAdminControls && (
                    <CMSmallButton onClick={props.searchPage.handleCopyFilterspec}>
                        Copy filter spec
                    </CMSmallButton>
                )}
                {props.showAdminControls && (
                    <>
                        <AdminInspectObject src={props.searchPage.filterSpec} label="Filter spec" />
                        <AdminInspectObject src={props.results} label="Results obj" />
                    </>
                )}

                <FilterControls
                    inCard={false}
                    onQuickFilterChange={props.searchPage.setQuickFilter}
                    onResetFilter={props.searchPage.resetToDefaults}
                    hasAnyFilters={props.searchPage.hasAnyFilters}
                    hasExtraFilters={props.searchPage.hasExtraFilters}
                    quickFilterText={props.searchPage.filterSpec.quickFilter}
                    primaryFilter={primaryFilter}
                    extraFilter={extraFilter}
                    footerFilter={footerFilter}
                />
            </div>
        </CMSinglePageSurfaceCard>
    );
}

//////////////////////////////////////////////////////////////////////////////////////////////////
// Helper function to create filter group configs
//////////////////////////////////////////////////////////////////////////////////////////////////

export function createFilterGroupConfig(
    key: string,
    label: React.ReactNode,
    style: "tags" | "foreignSingle" | "radio",
    db3Column: string,
    filterHook: DiscreteFilterState,
    sanitize?: (item: any) => any
): FilterGroupConfig {
    return {
        key,
        label,
        style,
        db3Column,
        filterHook,
        sanitize,
    };
}
