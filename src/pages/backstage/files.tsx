import { FileOrderByColumnOption, FileOrderByColumnOptions, FilesFilterSpec } from "@/src/core/components/file/FileClientBaseTypes";
import { FileListItem } from "@/src/core/components/file/FileListItem";
import { BlitzPage } from "@blitzjs/next";
import React, { Suspense } from "react";
import { Permission } from "shared/permissions";
import { SortDirection } from "shared/rootroot";
import { AppContextMarker } from "src/core/components/AppContext";
import { DashboardContext } from "src/core/components/DashboardContext";
import { FilterGroupDefinition, SearchPageContent, SearchPageContentConfig } from "src/core/components/search/SearchPageContent";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { getURIForFile } from "src/core/db3/clientAPILL";
import * as db3 from "src/core/db3/db3";
import { DiscreteCriterionFilterType } from "src/core/db3/shared/apiTypes";
import { fileSearchConfig } from "src/core/hooks/searchConfigs";
import { useDiscreteFilter, useSearchPage } from "src/core/hooks/useSearchFilters";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { NavRealm } from "@/src/core/components/dashboard/StaticMenuItems";

// for serializing in compact querystring
interface FilesFilterSpecStatic {
    label: string,
    helpText: string,

    orderByColumn: FileOrderByColumnOption;
    orderByDirection: SortDirection;

    tagFilterEnabled: boolean;
    tagFilterBehavior: DiscreteCriterionFilterType;
    tagFilterOptions: number[];

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

    tagFilterBehavior: DiscreteCriterionFilterType.hasAllOf,
    tagFilterOptions: [],
    tagFilterEnabled: false,

    taggedInstrumentFilterBehavior: DiscreteCriterionFilterType.hasSomeOf,
    taggedInstrumentFilterOptions: [],
    taggedInstrumentFilterEnabled: false,
};

const gStaticFilters: FilesFilterSpecStatic[] = []



const FileListOuter = () => {
    const dashboardContext = React.useContext(DashboardContext);

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
    });

    // Configuration for the generic SearchPageContent component
    const config: SearchPageContentConfig<FilesFilterSpecStatic, FilesFilterSpec, db3.FilePayload, db3.EnrichedFile<db3.FilePayload>> = {
        staticFilters: gStaticFilters,
        defaultStaticFilter: gDefaultStaticFilterValue,
        sortColumnOptions: FileOrderByColumnOptions,
        searchConfig: fileSearchConfig,
        renderItem: (file, index, filterSpec, results, refetch) => (
            <FileListItem
                index={index}
                file={file}
                results={results}
                refetch={refetch}
                filterSpec={filterSpec}
            />
        ),
        getItemKey: (file) => file.id,
        contextMarkerName: "Files list",
        csvExporter: {
            itemToCSVRow: (file, index) => ({
                Order: (index + 1).toString(),
                ID: file.id.toString(),
                Name: file.fileLeafName,
                Description: file.description || "",
                MimeType: file.mimeType || "",
                SizeBytes: file.sizeBytes?.toString() || "",
                UploadedAt: file.uploadedAt?.toISOString() || "",
                UploadedBy: file.uploadedByUser?.name || "",
                URL: getURIForFile(file),
            })
        },
        className: "filesListContainer",
        showAdminControls: true,
    };

    // Filter hooks for passing to the generic component
    const filterHooks = {
        tags: tagFilter,
        taggedInstruments: taggedInstrumentFilter,
    };

    // Filter group definitions
    const filterGroupDefinitions: FilterGroupDefinition[] = [
        {
            key: "tags",
            label: "File tags",
            type: "tags",
            column: "tags",
        },
        {
            key: "taggedInstruments",
            label: "Tagged instruments",
            type: "tags",
            column: "taggedInstruments",
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
