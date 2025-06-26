import { BlitzPage } from "@blitzjs/next";
import { Button, ListItemIcon, Menu, MenuItem } from "@mui/material";
import React, { Suspense } from "react";
import InfiniteScroll from "react-infinite-scroll-component";
import { arraysContainSameValues } from "shared/arrayUtils";
import { StandardVariationSpec } from "shared/color";
import { Permission } from "shared/permissions";
import { SortDirection } from "shared/rootroot";
import { arrayToTSV } from "shared/utils";
import { AppContextMarker } from "src/core/components/AppContext";
import { CMChip, CMChipContainer } from "src/core/components/CMChip";
import { AdminInspectObject, CMSinglePageSurfaceCard } from "src/core/components/CMCoreComponents";
import { CMSmallButton, useURLState } from "src/core/components/CMCoreComponents2";
import { DashboardContext } from "src/core/components/DashboardContext";
import { FileOrderByColumnOption, FileOrderByColumnOptions, FilesFilterSpec } from "src/core/components/FileComponentsBase";
import { useFileListData } from "src/core/components/FileSearch";
import { FilterControls, SortByGroup, SortBySpec, TagsFilterGroup } from "src/core/components/FilterControl";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { SnackbarContext, SnackbarContextType } from "src/core/components/SnackbarContext";
import { getURIForFile } from "src/core/db3/clientAPILL";
import { gCharMap, gIconMap } from "src/core/db3/components/IconMap";
import * as db3 from "src/core/db3/db3";
import { DiscreteCriterion, DiscreteCriterionFilterType, SearchResultsRet } from "src/core/db3/shared/apiTypes";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { NavRealm } from "src/core/components/Dashboard2";

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
                <a className="nameLink" href={`/backstage/file/${props.file.id}/${props.file.fileLeafName}/details`}>
                    {props.file.fileLeafName}
                </a>
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

    const [refreshSerial, setRefreshSerial] = React.useState<number>(1);

    // URL state management
    const [quickFilter, setQuickFilter] = useURLState<string>("f", "");
    const [sortColumn, setSortColumn] = useURLState<FileOrderByColumnOption>("sc", FileOrderByColumnOptions.uploadedAt);
    const [sortDirection, setSortDirection] = useURLState<SortDirection>("sd", "desc");

    const sortModel: SortBySpec = {
        columnName: sortColumn,
        direction: sortDirection,
    };
    const setSortModel = (x: SortBySpec) => {
        setSortColumn(x.columnName as FileOrderByColumnOption);
        setSortDirection(x.direction);
    };

    // Type filter
    // const [typeFilterEnabled, setTypeFilterEnabled] = useURLState<boolean>("tfe", false);
    // const [typeFilterBehaviorWhenEnabled, setTypeFilterBehaviorWhenEnabled] = useURLState<DiscreteCriterionFilterType>("tfb", DiscreteCriterionFilterType.hasSomeOf);
    // const [typeFilterOptionsWhenEnabled, setTypeFilterOptionsWhenEnabled] = useURLState<number[]>("tfo", []);

    // Tag filter
    const [tagFilterEnabled, setTagFilterEnabled] = useURLState<boolean>("tafe", false);
    const [tagFilterBehaviorWhenEnabled, setTagFilterBehaviorWhenEnabled] = useURLState<DiscreteCriterionFilterType>("tafb", DiscreteCriterionFilterType.hasAllOf);
    const [tagFilterOptionsWhenEnabled, setTagFilterOptionsWhenEnabled] = useURLState<number[]>("tafo", []);

    // Uploader filter
    // const [uploaderFilterEnabled, setUploaderFilterEnabled] = useURLState<boolean>("ufe", false);
    // const [uploaderFilterBehaviorWhenEnabled, setUploaderFilterBehaviorWhenEnabled] = useURLState<DiscreteCriterionFilterType>("ufb", DiscreteCriterionFilterType.hasSomeOf);
    // const [uploaderFilterOptionsWhenEnabled, setUploaderFilterOptionsWhenEnabled] = useURLState<number[]>("ufo", []);

    // Size filter
    // const [sizeFilterEnabled, setSizeFilterEnabled] = useURLState<boolean>("sfe", false);
    // const [sizeFilterBehaviorWhenEnabled, setSizeFilterBehaviorWhenEnabled] = useURLState<DiscreteCriterionFilterType>("sfb", DiscreteCriterionFilterType.hasSomeOf);
    // const [sizeFilterOptionsWhenEnabled, setSizeFilterOptionsWhenEnabled] = useURLState<number[]>("sfo", []);

    // // Associated users filter
    // const [taggedUserFilterEnabled, setTaggedUserFilterEnabled] = useURLState<boolean>("tufe", false);
    // const [taggedUserFilterBehaviorWhenEnabled, setTaggedUserFilterBehaviorWhenEnabled] = useURLState<DiscreteCriterionFilterType>("tufb", DiscreteCriterionFilterType.hasSomeOf);
    // const [taggedUserFilterOptionsWhenEnabled, setTaggedUserFilterOptionsWhenEnabled] = useURLState<number[]>("tufo", []);

    // // Associated events filter
    // const [taggedEventFilterEnabled, setTaggedEventFilterEnabled] = useURLState<boolean>("tefe", false);
    // const [taggedEventFilterBehaviorWhenEnabled, setTaggedEventFilterBehaviorWhenEnabled] = useURLState<DiscreteCriterionFilterType>("tefb", DiscreteCriterionFilterType.hasSomeOf);
    // const [taggedEventFilterOptionsWhenEnabled, setTaggedEventFilterOptionsWhenEnabled] = useURLState<number[]>("tefo", []);

    // // Associated songs filter
    // const [taggedSongFilterEnabled, setTaggedSongFilterEnabled] = useURLState<boolean>("tsfe", false);
    // const [taggedSongFilterBehaviorWhenEnabled, setTaggedSongFilterBehaviorWhenEnabled] = useURLState<DiscreteCriterionFilterType>("tsfb", DiscreteCriterionFilterType.hasSomeOf);
    // const [taggedSongFilterOptionsWhenEnabled, setTaggedSongFilterOptionsWhenEnabled] = useURLState<number[]>("tsfo", []);

    // Associated instruments filter
    const [taggedInstrumentFilterEnabled, setTaggedInstrumentFilterEnabled] = useURLState<boolean>("tife", false);
    const [taggedInstrumentFilterBehaviorWhenEnabled, setTaggedInstrumentFilterBehaviorWhenEnabled] = useURLState<DiscreteCriterionFilterType>("tifb", DiscreteCriterionFilterType.hasSomeOf);
    const [taggedInstrumentFilterOptionsWhenEnabled, setTaggedInstrumentFilterOptionsWhenEnabled] = useURLState<number[]>("tifo", []);

    // Build the filter spec
    //const typeFilterWhenEnabled: DiscreteCriterion = { db3Column: "mimeType", behavior: typeFilterBehaviorWhenEnabled, options: typeFilterOptionsWhenEnabled };
    const tagFilterWhenEnabled: DiscreteCriterion = { db3Column: "tags", behavior: tagFilterBehaviorWhenEnabled, options: tagFilterOptionsWhenEnabled };
    //const uploaderFilterWhenEnabled: DiscreteCriterion = { db3Column: "uploadedByUser", behavior: uploaderFilterBehaviorWhenEnabled, options: uploaderFilterOptionsWhenEnabled };
    //const sizeFilterWhenEnabled: DiscreteCriterion = { db3Column: "sizeBytes", behavior: sizeFilterBehaviorWhenEnabled, options: sizeFilterOptionsWhenEnabled };
    // const taggedUserFilterWhenEnabled: DiscreteCriterion = { db3Column: "taggedUsers", behavior: taggedUserFilterBehaviorWhenEnabled, options: taggedUserFilterOptionsWhenEnabled };
    // const taggedEventFilterWhenEnabled: DiscreteCriterion = { db3Column: "taggedEvents", behavior: taggedEventFilterBehaviorWhenEnabled, options: taggedEventFilterOptionsWhenEnabled };
    // const taggedSongFilterWhenEnabled: DiscreteCriterion = { db3Column: "taggedSongs", behavior: taggedSongFilterBehaviorWhenEnabled, options: taggedSongFilterOptionsWhenEnabled };
    const taggedInstrumentFilterWhenEnabled: DiscreteCriterion = { db3Column: "taggedInstruments", behavior: taggedInstrumentFilterBehaviorWhenEnabled, options: taggedInstrumentFilterOptionsWhenEnabled };

    const filterSpec: FilesFilterSpec = {
        refreshSerial,
        quickFilter,
        orderByColumn: sortColumn as any,
        orderByDirection: sortDirection,

        //typeFilter: typeFilterEnabled ? typeFilterWhenEnabled : { db3Column: "mimeType", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
        tagFilter: tagFilterEnabled ? tagFilterWhenEnabled : { db3Column: "tags", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
        //uploaderFilter: uploaderFilterEnabled ? uploaderFilterWhenEnabled : { db3Column: "uploadedByUser", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
        //sizeFilter: sizeFilterEnabled ? sizeFilterWhenEnabled : { db3Column: "sizeBytes", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
        // taggedUserFilter: taggedUserFilterEnabled ? taggedUserFilterWhenEnabled : { db3Column: "taggedUsers", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
        // taggedEventFilter: taggedEventFilterEnabled ? taggedEventFilterWhenEnabled : { db3Column: "taggedEvents", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
        // taggedSongFilter: taggedSongFilterEnabled ? taggedSongFilterWhenEnabled : { db3Column: "taggedSongs", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
        taggedInstrumentFilter: taggedInstrumentFilterEnabled ? taggedInstrumentFilterWhenEnabled : { db3Column: "taggedInstruments", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
    }; const { enrichedFiles, results, loadMoreData } = useFileListData(filterSpec);

    const handleCopyFilterspec = () => {
        const o: FilesFilterSpecStatic = {
            label: "(n/a)",
            helpText: "",
            orderByColumn: sortColumn as any,
            orderByDirection: sortDirection,

            // typeFilterEnabled,
            // typeFilterBehavior: typeFilterBehaviorWhenEnabled,
            // typeFilterOptions: typeFilterOptionsWhenEnabled,

            tagFilterEnabled,
            tagFilterBehavior: tagFilterBehaviorWhenEnabled,
            tagFilterOptions: tagFilterOptionsWhenEnabled,

            // uploaderFilterEnabled,
            // uploaderFilterBehavior: uploaderFilterBehaviorWhenEnabled,
            // uploaderFilterOptions: uploaderFilterOptionsWhenEnabled,

            // sizeFilterEnabled,
            // sizeFilterBehavior: sizeFilterBehaviorWhenEnabled,
            // sizeFilterOptions: sizeFilterOptionsWhenEnabled,

            // taggedUserFilterEnabled,
            // taggedUserFilterBehavior: taggedUserFilterBehaviorWhenEnabled,
            // taggedUserFilterOptions: taggedUserFilterOptionsWhenEnabled,

            // taggedEventFilterEnabled,
            // taggedEventFilterBehavior: taggedEventFilterBehaviorWhenEnabled,
            // taggedEventFilterOptions: taggedEventFilterOptionsWhenEnabled,

            // taggedSongFilterEnabled,
            // taggedSongFilterBehavior: taggedSongFilterBehaviorWhenEnabled,
            // taggedSongFilterOptions: taggedSongFilterOptionsWhenEnabled,

            taggedInstrumentFilterEnabled,
            taggedInstrumentFilterBehavior: taggedInstrumentFilterBehaviorWhenEnabled,
            taggedInstrumentFilterOptions: taggedInstrumentFilterOptionsWhenEnabled,
        }
        const txt = JSON.stringify(o, null, 2);
        console.log(o);
        navigator.clipboard.writeText(txt).then(() => {
            snackbarContext.showMessage({ severity: "success", children: `copied ${txt.length} chars` });
        }).catch(() => {
            // nop
        });
    };

    const handleClickStaticFilter = (x: FilesFilterSpecStatic) => {
        setSortColumn(x.orderByColumn);
        setSortDirection(x.orderByDirection);

        // setTypeFilterEnabled(x.typeFilterEnabled);
        // setTypeFilterBehaviorWhenEnabled(x.typeFilterBehavior);
        // setTypeFilterOptionsWhenEnabled(x.typeFilterOptions);

        setTagFilterEnabled(x.tagFilterEnabled);
        setTagFilterBehaviorWhenEnabled(x.tagFilterBehavior);
        setTagFilterOptionsWhenEnabled(x.tagFilterOptions);

        // setUploaderFilterEnabled(x.uploaderFilterEnabled);
        // setUploaderFilterBehaviorWhenEnabled(x.uploaderFilterBehavior);
        // setUploaderFilterOptionsWhenEnabled(x.uploaderFilterOptions);

        // setSizeFilterEnabled(x.sizeFilterEnabled);
        // setSizeFilterBehaviorWhenEnabled(x.sizeFilterBehavior);
        // setSizeFilterOptionsWhenEnabled(x.sizeFilterOptions);

        // setTaggedUserFilterEnabled(x.taggedUserFilterEnabled);
        // setTaggedUserFilterBehaviorWhenEnabled(x.taggedUserFilterBehavior);
        // setTaggedUserFilterOptionsWhenEnabled(x.taggedUserFilterOptions);

        // setTaggedEventFilterEnabled(x.taggedEventFilterEnabled);
        // setTaggedEventFilterBehaviorWhenEnabled(x.taggedEventFilterBehavior);
        // setTaggedEventFilterOptionsWhenEnabled(x.taggedEventFilterOptions);

        // setTaggedSongFilterEnabled(x.taggedSongFilterEnabled);
        // setTaggedSongFilterBehaviorWhenEnabled(x.taggedSongFilterBehavior);
        // setTaggedSongFilterOptionsWhenEnabled(x.taggedSongFilterOptions);

        setTaggedInstrumentFilterEnabled(x.taggedInstrumentFilterEnabled);
        setTaggedInstrumentFilterBehaviorWhenEnabled(x.taggedInstrumentFilterBehavior);
        setTaggedInstrumentFilterOptionsWhenEnabled(x.taggedInstrumentFilterOptions);

        setRefreshSerial(old => old + 1);
    };

    const matchingStaticFilter = gStaticFilters.find(f => {
        return f.orderByColumn === sortColumn &&
            f.orderByDirection === sortDirection &&
            //f.typeFilterEnabled === typeFilterEnabled &&
            f.tagFilterEnabled === tagFilterEnabled &&
            // f.uploaderFilterEnabled === uploaderFilterEnabled &&
            //f.sizeFilterEnabled === sizeFilterEnabled &&
            // f.taggedUserFilterEnabled === taggedUserFilterEnabled &&
            // f.taggedEventFilterEnabled === taggedEventFilterEnabled &&
            // f.taggedSongFilterEnabled === taggedSongFilterEnabled &&
            f.taggedInstrumentFilterEnabled === taggedInstrumentFilterEnabled &&
            //arraysContainSameValues(f.typeFilterOptions, typeFilterOptionsWhenEnabled) &&
            arraysContainSameValues(f.tagFilterOptions, tagFilterOptionsWhenEnabled) &&
            // arraysContainSameValues(f.uploaderFilterOptions, uploaderFilterOptionsWhenEnabled) &&
            //arraysContainSameValues(f.sizeFilterOptions, sizeFilterOptionsWhenEnabled) &&
            // arraysContainSameValues(f.taggedUserFilterOptions, taggedUserFilterOptionsWhenEnabled) &&
            // arraysContainSameValues(f.taggedEventFilterOptions, taggedEventFilterOptionsWhenEnabled) &&
            // arraysContainSameValues(f.taggedSongFilterOptions, taggedSongFilterOptionsWhenEnabled) &&
            arraysContainSameValues(f.taggedInstrumentFilterOptions, taggedInstrumentFilterOptionsWhenEnabled);
    });

    const hasExtraFilters = () => {
        const def = gDefaultStaticFilterValue;
        //if (typeFilterEnabled !== def.typeFilterEnabled) return true;
        // if (uploaderFilterEnabled !== def.uploaderFilterEnabled) return true;
        //if (sizeFilterEnabled !== def.sizeFilterEnabled) return true;
        // if (taggedUserFilterEnabled !== def.taggedUserFilterEnabled) return true;
        // if (taggedEventFilterEnabled !== def.taggedEventFilterEnabled) return true;
        // if (taggedSongFilterEnabled !== def.taggedSongFilterEnabled) return true;
        if (taggedInstrumentFilterEnabled !== def.taggedInstrumentFilterEnabled) return true;
        return false;
    };

    const hasAnyFilters = () => {
        const def = gDefaultStaticFilterValue;
        if (sortColumn !== def.orderByColumn) return true;
        if (sortDirection !== def.orderByDirection) return true;
        if (tagFilterEnabled !== def.tagFilterEnabled) return true;
        return hasExtraFilters();
    };

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
                    hasAnyFilters={hasAnyFilters()}
                    hasExtraFilters={hasExtraFilters()}
                    quickFilterText={filterSpec.quickFilter}
                    primaryFilter={
                        <div>
                            <CMChipContainer>
                                {
                                    gStaticFilters.map(e => {
                                        const doesMatch = e.label === matchingStaticFilter?.label;
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
                                style="tags"
                                filterEnabled={tagFilterEnabled}
                                items={results.facets?.find(f => f.db3Column === "tags")?.items || []}
                                value={tagFilterWhenEnabled}
                                onChange={(v, enabled) => {
                                    setTagFilterEnabled(enabled);
                                    setTagFilterBehaviorWhenEnabled(v.behavior);
                                    setTagFilterOptionsWhenEnabled(v.options as number[]);
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
                            <div className="divider" /> */}
                            <TagsFilterGroup
                                style="tags"
                                filterEnabled={taggedInstrumentFilterEnabled}
                                items={results.facets?.find(f => f.db3Column === "taggedInstruments")?.items || []}
                                value={taggedInstrumentFilterWhenEnabled}
                                onChange={(v, enabled) => {
                                    setTaggedInstrumentFilterEnabled(enabled);
                                    setTaggedInstrumentFilterBehaviorWhenEnabled(v.behavior);
                                    setTaggedInstrumentFilterOptionsWhenEnabled(v.options as number[]);
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
                                setValue={setSortModel}
                                value={sortModel}
                            />
                        </div>
                    }
                />
            </div>
        </CMSinglePageSurfaceCard>
        <FilesList
            filterSpec={filterSpec}
            files={enrichedFiles}
            results={results}
            loadMoreData={loadMoreData}
            hasMore={enrichedFiles.length < results.rowCount}
            refetch={() => setRefreshSerial(refreshSerial + 1)}
        />
    </>;
};

//////////////////////////////////////////////////////////////////////////////////////////////////
const FilesPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Files" basePermission={Permission.view_files} navRealm={NavRealm.files}>
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
