import { BlitzPage } from "@blitzjs/next";
import { Button, ListItemIcon, Menu, MenuItem } from "@mui/material";
import React, { Suspense } from "react";
import InfiniteScroll from "react-infinite-scroll-component";
import { StandardVariationSpec } from "shared/color";
import { Permission } from "shared/permissions";
import { SortDirection } from "shared/rootroot";
import { arrayToTSV } from "shared/utils";
import { AppContextMarker } from "src/core/components/AppContext";
import { CMChip, CMChipContainer } from "src/core/components/CMChip";
import { CMSinglePageSurfaceCard } from "src/core/components/CMCoreComponents";
import { AdminInspectObject, CMSmallButton } from "src/core/components/CMCoreComponents2";
import { DashboardContext } from "src/core/components/DashboardContext";
import { FileOrderByColumnOption, FileOrderByColumnOptions, FilesFilterSpec } from "src/core/components/FileComponentsBase";
import { useFileListData } from "src/core/components/FileSearch";
import { FilterControls, SortByGroup, TagsFilterGroup } from "src/core/components/FilterControl";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { SnackbarContext, SnackbarContextType } from "src/core/components/SnackbarContext";
import { getURIForFile, getURIForFileLandingPage } from "src/core/db3/clientAPILL";
import { gCharMap, gIconMap } from "src/core/db3/components/IconMap";
import * as db3 from "src/core/db3/db3";
import { DiscreteCriterion, DiscreteCriterionFilterType, SearchResultsRet } from "src/core/db3/shared/apiTypes";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { NavRealm } from "src/core/components/Dashboard2";
import { CMLink } from "@/src/core/components/CMLink";
import { useDiscreteFilter, useSearchPage } from "src/core/hooks/useSearchFilters";

// for serializing in compact querystring
interface FilesFilterSpecStatic {
    label: string,
    helpText: string,

    orderByColumn: FileOrderByColumnOption;
    orderByDirection: SortDirection;

    // typeFilterEnabled: boolean;
    // typeFilterBehavior: DiscreteCriterionFilterType;
    // typeFilterOptions: number[];

    tagFilterEnabled: boolean;
    tagFilterBehavior: DiscreteCriterionFilterType;
    tagFilterOptions: number[];

    // uploaderFilterEnabled: boolean;
    // uploaderFilterBehavior: DiscreteCriterionFilterType;
    // uploaderFilterOptions: number[];

    // sizeFilterEnabled: boolean;
    // sizeFilterBehavior: DiscreteCriterionFilterType;
    // sizeFilterOptions: number[];

    // taggedUserFilterEnabled: boolean;
    // taggedUserFilterBehavior: DiscreteCriterionFilterType;
    // taggedUserFilterOptions: number[];

    // taggedEventFilterEnabled: boolean;
    // taggedEventFilterBehavior: DiscreteCriterionFilterType;
    // taggedEventFilterOptions: number[];

    // taggedSongFilterEnabled: boolean;
    // taggedSongFilterBehavior: DiscreteCriterionFilterType;
    // taggedSongFilterOptions: number[];

    taggedInstrumentFilterEnabled: boolean;
    taggedInstrumentFilterBehavior: DiscreteCriterionFilterType;
    taggedInstrumentFilterOptions: number[];
}

// predefined filter sets
const gDefaultStaticFilterValue: FilesFilterSpecStatic = {
    label: "All files",
    helpText: "",
    orderByColumn: FileOrderByColumnOptions.uploadedAt,
    orderByDirection: "desc",
    // typeFilterBehavior: DiscreteCriterionFilterType.hasSomeOf,
    // typeFilterOptions: [],
    // typeFilterEnabled: false,
    tagFilterBehavior: DiscreteCriterionFilterType.hasAllOf,
    tagFilterOptions: [],
    tagFilterEnabled: false,
    // uploaderFilterBehavior: DiscreteCriterionFilterType.hasSomeOf,
    // uploaderFilterOptions: [],
    // uploaderFilterEnabled: false,
    // sizeFilterBehavior: DiscreteCriterionFilterType.hasSomeOf,
    // sizeFilterOptions: [],
    // sizeFilterEnabled: false,
    // taggedUserFilterBehavior: DiscreteCriterionFilterType.hasSomeOf,
    // taggedUserFilterOptions: [],
    // taggedUserFilterEnabled: false,
    // taggedEventFilterBehavior: DiscreteCriterionFilterType.hasSomeOf,
    // taggedEventFilterOptions: [],
    // taggedEventFilterEnabled: false,
    // taggedSongFilterBehavior: DiscreteCriterionFilterType.hasSomeOf,
    // taggedSongFilterOptions: [],
    // taggedSongFilterEnabled: false,
    taggedInstrumentFilterBehavior: DiscreteCriterionFilterType.hasSomeOf,
    taggedInstrumentFilterOptions: [],
    taggedInstrumentFilterEnabled: false,
};

const gStaticFilters: FilesFilterSpecStatic[] = []

async function CopyFileListCSV(snackbarContext: SnackbarContextType, value: db3.EnrichedFile<db3.FilePayload>[]) {
    const obj = value.map((e, i) => ({
        Order: (i + 1).toString(),
        ID: e.id.toString(),
        Name: e.fileLeafName,
        Description: e.description || "",
        MimeType: e.mimeType || "",
        SizeBytes: e.sizeBytes?.toString() || "",
        UploadedAt: e.uploadedAt?.toISOString() || "",
        UploadedBy: e.uploadedByUser?.name || "",
        URL: getURIForFile(e),
    }));
    const txt = arrayToTSV(obj);
    await navigator.clipboard.writeText(txt);
    snackbarContext.showMessage({ severity: "success", children: `copied ${txt.length} chars` });
}

type FileListItemProps = {
    index: number;
    file: db3.EnrichedFile<db3.FilePayload>;
    results: SearchResultsRet;
    refetch: () => void;
    filterSpec: FilesFilterSpec;
};

const FileListItem = (props: FileListItemProps) => {
    const dashboardContext = React.useContext(DashboardContext);
    const visInfo = dashboardContext.getVisibilityInfo(props.file);

    return <div className={`songListItem ${visInfo.className}`}>
        <div className="titleLine">
            <div className="topTitleLine">
                <CMLink className="nameLink" href={getURIForFileLandingPage(props.file)}>
                    {props.file.fileLeafName}
                </CMLink>
                <div style={{ flexGrow: 1 }}>
                    <AdminInspectObject src={props.file} label="Obj" />
                </div>
                <span className="resultIndex">#{props.index}</span>
            </div>
        </div>

        <div className="credits">
            <div className="credit row">
                <div className="fieldItem">{props.file.description}</div>
            </div>
            <div className="credit row">
                <div className="fieldCaption">Uploaded:</div>
                <div className="fieldItem">{props.file.uploadedAt?.toLocaleDateString()}</div>
                <div className="fieldCaption">By:</div>
                <div className="fieldItem">{props.file.uploadedByUser?.name}</div>
                <div className="fieldCaption">Size:</div>
                <div className="fieldItem">{props.file.sizeBytes ? `${Math.round(props.file.sizeBytes / 1024)} KB` : 'Unknown'}</div>
                <div className="fieldCaption">Type:</div>
                <div className="fieldItem">{props.file.mimeType || 'Unknown'}</div>
            </div>
        </div>

        <div className="chips">
            {(props.file.tags || []).map(tag => (
                <CMChip
                    key={tag.id}
                    color={tag.fileTag.color}
                    variation={StandardVariationSpec.Weak}
                    size="small"
                    shape="rectangle"
                >
                    {tag.fileTag.text}
                </CMChip>
            ))}
        </div>    </div>;
};

interface FilesListArgs {
    filterSpec: FilesFilterSpec,
    results: SearchResultsRet;
    files: db3.EnrichedFile<db3.FilePayload>[],
    refetch: () => void;
    loadMoreData: () => void;
    hasMore: boolean;
}

const FilesList = ({ filterSpec, results, files, refetch, loadMoreData, hasMore }: FilesListArgs) => {
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const snackbarContext = React.useContext(SnackbarContext);

    const [autoLoadCount, setAutoLoadCount] = React.useState(0);
    const MAX_AUTO_LOADS = 15;

    const handleCopy = async () => {
        await CopyFileListCSV(snackbarContext, files);
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
                    loadMoreData();
                }
            }
        };

        // Delay the check to ensure the DOM has updated
        setTimeout(checkIfNeedsMoreData, 0);
    }, [files]);

    return <div className="eventList searchResults">
        <AppContextMarker name="Files list" queryText={filterSpec.quickFilter}>
            <div className="searchRecordCount">
                {results.rowCount === 0 ? "No items to show" : <>Displaying {files.length} items of {results.rowCount} total</>}
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
                dataLength={files.length}
                next={loadMoreData}
                hasMore={hasMore}
                loader={<h4>Loading...</h4>}
            >
                <div className="filesList">
                    {files.map((file, index) => (
                        <FileListItem
                            key={file.id}
                            index={index + 1}
                            file={file}
                            results={results}
                            refetch={refetch}
                            filterSpec={filterSpec}
                        />
                    ))}
                </div>
            </InfiniteScroll>
            {hasMore && <Button onClick={loadMoreData}>Load more results...</Button>}
        </AppContextMarker>
    </div>;
};

const FileListOuter = () => {
    const dashboardContext = React.useContext(DashboardContext);
    const snackbarContext = React.useContext(SnackbarContext);

    // Individual filter hooks - still needed for the search page hook
    const tagFilter = useDiscreteFilter({
        urlPrefix: "ta",
        db3Column: "tags",
        defaultBehavior: gDefaultStaticFilterValue.tagFilterBehavior,
        defaultOptions: gDefaultStaticFilterValue.tagFilterOptions,
        defaultEnabled: gDefaultStaticFilterValue.tagFilterEnabled,
    });

    const taggedInstrumentFilter = useDiscreteFilter({
        urlPrefix: "ti",
        db3Column: "taggedInstruments",
        defaultBehavior: gDefaultStaticFilterValue.taggedInstrumentFilterBehavior,
        defaultOptions: gDefaultStaticFilterValue.taggedInstrumentFilterOptions,
        defaultEnabled: gDefaultStaticFilterValue.taggedInstrumentFilterEnabled,
    });

    // Using useSearchPage hook for centralized search page logic
    const searchPage = useSearchPage<FilesFilterSpecStatic, FilesFilterSpec>({
        staticFilters: gStaticFilters,
        defaultStaticFilter: gDefaultStaticFilterValue,
        sortColumnKey: "orderByColumn",
        sortDirectionKey: "orderByDirection",
        filterMappings: [
            { filterHook: tagFilter, columnKey: "tagFilter" },
            { filterHook: taggedInstrumentFilter, columnKey: "taggedInstrumentFilter" },
        ],
        buildFilterSpec: ({ refreshSerial, quickFilter, sortColumn, sortDirection, filterMappings }) => {
            const filterSpec: FilesFilterSpec = {
                refreshSerial,
                quickFilter,
                orderByColumn: sortColumn as any,
                orderByDirection: sortDirection,
                tagFilter: tagFilter.enabled ? tagFilter.criterion : { db3Column: "tags", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
                taggedInstrumentFilter: taggedInstrumentFilter.enabled ? taggedInstrumentFilter.criterion : { db3Column: "taggedInstruments", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
            };
            return filterSpec;
        },
        buildStaticFilterSpec: ({ sortColumn, sortDirection, filterMappings }) => {
            const staticSpec: FilesFilterSpecStatic = {
                label: "(n/a)",
                helpText: "",
                orderByColumn: sortColumn as any,
                orderByDirection: sortDirection,
                tagFilterEnabled: tagFilter.enabled,
                tagFilterBehavior: tagFilter.criterion.behavior,
                tagFilterOptions: tagFilter.criterion.options as number[],
                taggedInstrumentFilterEnabled: taggedInstrumentFilter.enabled,
                taggedInstrumentFilterBehavior: taggedInstrumentFilter.criterion.behavior,
                taggedInstrumentFilterOptions: taggedInstrumentFilter.criterion.options as number[],
            };
            return staticSpec;
        }
    }); const { enrichedFiles, results, loadMoreData } = useFileListData(searchPage.filterSpec);

    return <>
        <CMSinglePageSurfaceCard className="filterControls">
            <div className="content">
                {dashboardContext.isShowingAdminControls && <CMSmallButton onClick={searchPage.handleCopyFilterspec}>Copy filter spec</CMSmallButton>}
                <AdminInspectObject src={searchPage.filterSpec} label="Filter spec" />
                <AdminInspectObject src={results} label="Results obj" />

                <FilterControls
                    inCard={false}
                    onQuickFilterChange={searchPage.setQuickFilter}
                    onResetFilter={searchPage.resetToDefaults}
                    hasAnyFilters={searchPage.hasAnyFilters}
                    hasExtraFilters={searchPage.hasExtraFilters}
                    quickFilterText={searchPage.filterSpec.quickFilter} primaryFilter={
                        <div>
                            <CMChipContainer>
                                {
                                    gStaticFilters.map(e => {
                                        const doesMatch = e.label === searchPage.matchingStaticFilter?.label;
                                        return <CMChip
                                            key={e.label}
                                            onClick={() => searchPage.handleClickStaticFilter(e)} size="small"
                                            variation={{ ...StandardVariationSpec.Strong, selected: doesMatch }}
                                            shape="rectangle"
                                        >
                                            {e.label}
                                        </CMChip>;
                                    })
                                }
                                {searchPage.matchingStaticFilter && <div className="tinyCaption">{searchPage.matchingStaticFilter.helpText}</div>}
                            </CMChipContainer>
                        </div>
                    }
                    extraFilter={
                        <div>                            <TagsFilterGroup
                            style="tags"
                            filterEnabled={tagFilter.enabled}
                            items={results.facets?.find(f => f.db3Column === "tags")?.items || []}
                            value={tagFilter.criterion}
                            onChange={(v, enabled) => {
                                tagFilter.setEnabled(enabled);
                                tagFilter.setCriterion(v);
                            }}
                            errorMessage={results.filterQueryResult?.errors?.find(e => e.column === "tags")?.error}
                            label="File tags"
                        />
                            <div className="divider" />
                            {/* <TagsFilterGroup
                                style="foreignSingle"
                                filterEnabled={uploaderFilterEnabled}
                                items={results.facets?.find(f => f.db3Column === "uploadedByUser")?.items || []}
                                value={uploaderFilterWhenEnabled}
                                onChange={(v, enabled) => {
                                    setUploaderFilterEnabled(enabled);
                                    setUploaderFilterBehaviorWhenEnabled(v.behavior);
                                    setUploaderFilterOptionsWhenEnabled(v.options as number[]);
                                }}
                                errorMessage={results.filterQueryResult?.errors?.find(e => e.column === "uploadedByUser")?.error}
                                label="Uploaded by"
                            />
                            <div className="divider" />
                            <TagsFilterGroup
                                style="tags"
                                filterEnabled={taggedUserFilterEnabled}
                                items={results.facets?.find(f => f.db3Column === "taggedUsers")?.items || []}
                                value={taggedUserFilterWhenEnabled}
                                onChange={(v, enabled) => {
                                    setTaggedUserFilterEnabled(enabled);
                                    setTaggedUserFilterBehaviorWhenEnabled(v.behavior);
                                    setTaggedUserFilterOptionsWhenEnabled(v.options as number[]);
                                }}
                                errorMessage={results.filterQueryResult?.errors?.find(e => e.column === "taggedUsers")?.error}
                                label="Tagged users"
                            />
                            <div className="divider" />
                            <TagsFilterGroup
                                style="tags"
                                filterEnabled={taggedEventFilterEnabled}
                                items={results.facets?.find(f => f.db3Column === "taggedEvents")?.items || []}
                                value={taggedEventFilterWhenEnabled}
                                onChange={(v, enabled) => {
                                    setTaggedEventFilterEnabled(enabled);
                                    setTaggedEventFilterBehaviorWhenEnabled(v.behavior);
                                    setTaggedEventFilterOptionsWhenEnabled(v.options as number[]);
                                }}
                                errorMessage={results.filterQueryResult?.errors?.find(e => e.column === "taggedEvents")?.error}
                                label="Tagged events"
                            />
                            <div className="divider" />
                            <TagsFilterGroup
                                style="tags"
                                filterEnabled={taggedSongFilterEnabled}
                                items={results.facets?.find(f => f.db3Column === "taggedSongs")?.items || []}
                                value={taggedSongFilterWhenEnabled}
                                onChange={(v, enabled) => {
                                    setTaggedSongFilterEnabled(enabled);
                                    setTaggedSongFilterBehaviorWhenEnabled(v.behavior);
                                    setTaggedSongFilterOptionsWhenEnabled(v.options as number[]);
                                }}
                                errorMessage={results.filterQueryResult?.errors?.find(e => e.column === "taggedSongs")?.error}
                                label="Tagged songs"
                            />
                            <div className="divider" /> */}                            <TagsFilterGroup
                                style="tags"
                                filterEnabled={taggedInstrumentFilter.enabled}
                                items={results.facets?.find(f => f.db3Column === "taggedInstruments")?.items || []}
                                value={taggedInstrumentFilter.criterion}
                                onChange={(v, enabled) => {
                                    taggedInstrumentFilter.setEnabled(enabled);
                                    taggedInstrumentFilter.setCriterion(v);
                                }}
                                errorMessage={results.filterQueryResult?.errors?.find(e => e.column === "taggedInstruments")?.error}
                                label="Tagged instruments"
                            />
                        </div>
                    }
                    footerFilter={
                        <div>
                            <div className="divider" />
                            <SortByGroup
                                columnOptions={Object.keys(FileOrderByColumnOptions)}
                                setValue={searchPage.setSortModel}
                                value={searchPage.sortModel}
                            />
                        </div>
                    }
                />
            </div>
        </CMSinglePageSurfaceCard>
        <FilesList
            filterSpec={searchPage.filterSpec}
            files={enrichedFiles}
            results={results}
            loadMoreData={loadMoreData}
            hasMore={enrichedFiles.length < results.rowCount}
            refetch={() => searchPage.setRefreshSerial(searchPage.refreshSerial + 1)}
        />
    </>;
};

//////////////////////////////////////////////////////////////////////////////////////////////////
const FilesPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Files" basePermission={Permission.access_file_landing_page} navRealm={NavRealm.files}>
            <AppContextMarker name="Files search page">
                <div className="eventsMainContent searchPage">
                    <Suspense>
                        <SettingMarkdown setting="files_markdown"></SettingMarkdown>
                    </Suspense>
                    <FileListOuter />
                </div>
            </AppContextMarker>
        </DashboardLayout>
    )
}

export default FilesPage;
