import { useCmdbRouter } from "src/route/useCmdbRouter";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { NavRealm } from "@/src/core/components/dashboard/StaticMenuItems";
import { FileOrderByColumnNames, FileOrderByColumnOption, FileOrderByColumnOptions, FilesFilterSpec } from "@/src/core/components/file/FileClientBaseTypes";
import { FileListItem } from "@/src/core/components/file/FileListItem";
import { BlitzPage } from "@blitzjs/next";
import { Suspense } from "react";
import type { FileTagPublicId, InstrumentPublicId } from "shared/publicId";
import { SortDirection } from "shared/rootroot";
import { AppContextMarker } from "src/core/components/AppContext";
import { FilterGroupDefinition, SearchPageContent, SearchPageContentConfig } from "src/core/components/search/SearchPageContent";
import { BandLocalizedMarkdown } from "@/src/setting/client/components/SettingMarkdown";
import * as db3 from "src/core/db3/db3";
import { DiscreteCriterionFilterType } from "src/core/db3/shared/apiTypes";
import { fileSearchConfig } from "src/core/hooks/searchConfigs";
import { useDiscreteFilter, useSearchPage } from "src/core/hooks/useSearchFilters";

// for serializing in compact querystring
interface FilesFilterSpecStatic {
    label: string,
    helpText: string,

    orderByColumn: FileOrderByColumnOption;
    orderByDirection: SortDirection;

    tagFilterEnabled: boolean;
    tagFilterBehavior: DiscreteCriterionFilterType;
    tagFilterOptions: FileTagPublicId[];

    taggedInstrumentFilterEnabled: boolean;
    taggedInstrumentFilterBehavior: DiscreteCriterionFilterType;
    taggedInstrumentFilterOptions: InstrumentPublicId[];
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



function fileSortColumn(value: string): FileOrderByColumnOption {
    switch (value) {
        case "fileLeafName":
        case "sizeBytes":
        case "mimeType":
            return value;
        default:
            return "uploadedAt";
    }
}

const FileListOuter = () => {
    const cmdbRouter = useCmdbRouter();


    // Individual filter hooks - still needed for the search page hook
    const tagFilter = useDiscreteFilter<FileTagPublicId>({
        urlPrefix: "ta",
        db3Column: "tags",
        defaultBehavior: gDefaultStaticFilterValue.tagFilterBehavior,
        defaultOptions: gDefaultStaticFilterValue.tagFilterOptions,
        defaultEnabled: gDefaultStaticFilterValue.tagFilterEnabled,
    });

    const taggedInstrumentFilter = useDiscreteFilter<InstrumentPublicId>({
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
                orderByColumn: fileSortColumn(sortColumn),
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
                orderByColumn: fileSortColumn(sortColumn),
                orderByDirection: sortDirection,
                tagFilterEnabled: tagFilter.enabled,
                tagFilterBehavior: tagFilter.criterion.behavior,
                // This hook owns FileTag identities; its shared interface erases the brand.
                tagFilterOptions: tagFilter.criterion.options as FileTagPublicId[],
                taggedInstrumentFilterEnabled: taggedInstrumentFilter.enabled,
                taggedInstrumentFilterBehavior: taggedInstrumentFilter.criterion.behavior,
                // This hook owns BandInstrument identities; its shared interface erases the brand.
                taggedInstrumentFilterOptions: taggedInstrumentFilter.criterion.options as InstrumentPublicId[],
            };
            return staticSpec;
        }
    });

    // Configuration for the generic SearchPageContent component
    const config: SearchPageContentConfig<FilesFilterSpecStatic, FilesFilterSpec, db3.FileSearchDto, db3.FileSearchClient> = {
        staticFilters: gStaticFilters,
        defaultStaticFilter: gDefaultStaticFilterValue,
        sortColumnOptions: FileOrderByColumnOptions,
        sortColumnNames: FileOrderByColumnNames,
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
        getItemKey: (file) => file.publicId,
        contextMarkerName: "Files list",
        csvExporter: {
            itemToCSVRow: (file, index) => ({
                Order: index.toString(),
                ID: file.publicId,
                Name: file.fileLeafName || "",
                Description: file.description || "",
                MimeType: file.mimeType || "",
                SizeBytes: file.sizeBytes?.toString() || "",
                UploadedAt: file.uploadedAt?.toISOString() || "",
                UploadedBy: file.uploadedByUser?.name || "",
                URL: file.storedLeafName !== undefined
                    && file.fileLeafName !== undefined
                    && file.externalURI !== undefined
                    ? cmdbRouter.getURIForFile({
                        storedLeafName: file.storedLeafName,
                        fileLeafName: file.fileLeafName,
                        externalURI: file.externalURI,
                    })
                    : "",
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
        <DashboardLayout title="Files" navRealm={NavRealm.files}>
            <AppContextMarker name="Files search page">
                <div className="eventsMainContent searchPage">
                    <Suspense>
                        <BandLocalizedMarkdown id="files_markdown"></BandLocalizedMarkdown>
                    </Suspense>
                    <FileListOuter />
                </div>
            </AppContextMarker>
        </DashboardLayout>
    )
}

export default FilesPage;
