import React from "react";
import { DeferredDomainPage } from "src/core/components/DeferredDomainPage";

export default function RecoveryPage() {
    return <DeferredDomainPage feature="songWorkflows" />;
}

// MIGRATION_RESTORE: song-workflows
// Source: f96ac10c66a450a4b16b3a7a857abf96d125d434:src/pages/backstage/songs.tsx:1-180
// Reason: Song and credit screens still depend on undeclared ownership and obsolete dedicated endpoints.
// Restore: Restore song search/detail/editing, credits and pinned recording with fresh selected-band authorization, visible files and public localized references; retain the recovered narrow song lookup and setlist persistence.
// Verification: Verify two bands, visibility, deleted records, revoked grants, credits, pinned recording and complete built-browser song workflows.
// SHA256: beb40c394094e758bd89beffa7beb29d8a164fbb5ba227b76034c8955b0db779
// MIGRATION_REFERENCE_BEGIN
// import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
// import { useDashboardContext } from "@/src/core/components/dashboardContext/DashboardContext";
// import { SongOrderByColumnNames, SongOrderByColumnOption, SongOrderByColumnOptions, SongsFilterSpec } from "@/src/core/components/song/SongClientBaseTypes";
// import { SongListItem } from "@/src/core/components/song/SongListItem";
// import { BlitzPage } from "@blitzjs/next";
// import { Suspense } from "react";
// import { isPublicId, type SongTagPublicId } from "shared/publicId";
// import { SortDirection } from "shared/rootroot";
// import { AppContextMarker } from "src/core/components/AppContext";
// import { FilterGroupDefinition, SearchPageContent, SearchPageContentConfig } from "src/core/components/search/SearchPageContent";
// import { LocalizedMarkdown } from "@/src/setting/client/components/SettingMarkdown";
// import { NewSongButton } from "src/core/components/song/NewSongComponents";
// import * as db3 from "src/core/db3/db3";
// import { DiscreteCriterionFilterType } from "src/core/db3/shared/apiTypes";
// import { songSearchConfig } from "src/core/hooks/searchConfigs";
// import { useDiscreteFilter, useSearchPage } from "src/core/hooks/useSearchFilters";
//
//
// // for serializing in compact querystring
// interface SongsFilterSpecStatic {
//     label: string,
//     helpText: string,
//
//     orderByColumn: SongOrderByColumnOption;
//     orderByDirection: SortDirection;
//
//     tagFilterEnabled: boolean;
//     tagFilterBehavior: DiscreteCriterionFilterType;
//     tagFilterOptions: SongTagPublicId[];
// };
//
// //////////////////////////////////////////////////////////////////////////////////////////////////
//
// const gStaticFilters: SongsFilterSpecStatic[] = [
//     {
//         label: "All",
//         helpText: "Searching all songs",
//         orderByColumn: SongOrderByColumnOptions.name,
//         orderByDirection: "asc",
//         tagFilterBehavior: DiscreteCriterionFilterType.hasAllOf,
//         tagFilterOptions: [],
//         tagFilterEnabled: false,
//     },
// ];
//
// const gDefaultStaticFilterName = "All" as const;
// const gDefaultStaticFilterValue = gStaticFilters.find(x => x.label === gDefaultStaticFilterName)!;
//
// //////////////////////////////////////////////////////////////////////////////////////////////////
// const SongListOuter = () => {
//     const dashboardContext = useDashboardContext();
//
//     // Individual filter hooks - still needed for the search page hook
//     const tagFilter = useDiscreteFilter<SongTagPublicId>({
//         urlPrefix: "tg",
//         db3Column: "tags",
//         defaultBehavior: gDefaultStaticFilterValue.tagFilterBehavior,
//         defaultOptions: gDefaultStaticFilterValue.tagFilterOptions,
//         defaultEnabled: gDefaultStaticFilterValue.tagFilterEnabled,
//     });
//
//     // Using useSearchPage hook for centralized search page logic
//     const searchPage = useSearchPage<SongsFilterSpecStatic, SongsFilterSpec>({
//         staticFilters: gStaticFilters,
//         defaultStaticFilter: gDefaultStaticFilterValue,
//         sortColumnKey: "orderByColumn",
//         sortDirectionKey: "orderByDirection",
//         filterMappings: [
//             { filterHook: tagFilter, columnKey: "tagFilter" },
//         ],
//         buildFilterSpec: ({ refreshSerial, quickFilter, sortColumn, sortDirection, filterMappings }) => {
//             const filterSpec: SongsFilterSpec = {
//                 refreshSerial,
//                 quickFilter,
//                 orderByColumn: sortColumn as any,
//                 orderByDirection: sortDirection,
//                 tagFilter: tagFilter.enabled ? tagFilter.criterion : { db3Column: "tags", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
//             };
//             return filterSpec;
//         },
//         buildStaticFilterSpec: ({ sortColumn, sortDirection, filterMappings }) => {
//             const staticSpec: SongsFilterSpecStatic = {
//                 label: "(n/a)",
//                 helpText: "",
//                 orderByColumn: sortColumn as any,
//                 orderByDirection: sortDirection,
//                 tagFilterEnabled: tagFilter.enabled,
//                 tagFilterBehavior: tagFilter.criterion.behavior,
//                 // This hook instance owns SongTagPublicId options end to end.
//                 tagFilterOptions: tagFilter.criterion.options as SongTagPublicId[],
//             };
//             return staticSpec;
//         }
//     });
//
//     // Configuration for the generic SearchPageContent component
//     const config: SearchPageContentConfig<SongsFilterSpecStatic, SongsFilterSpec, db3.SongSearchDto, db3.SongSearchClient> = {
//         staticFilters: gStaticFilters,
//         defaultStaticFilter: gDefaultStaticFilterValue,
//         sortColumnOptions: SongOrderByColumnOptions,
//         sortColumnNames: SongOrderByColumnNames,
//         searchConfig: songSearchConfig,
//         renderItem: (song, index, filterSpec, results, refetch) => (
//             <SongListItem
//                 index={index}
//                 song={song}
//                 filterSpec={filterSpec}
//                 refetch={refetch}
//                 results={results}
//             />
//         ),
//         getItemKey: (song) => song.publicId,
//         contextMarkerName: "SongList",
//         csvExporter: {
//             itemToCSVRow: (song, index) => ({
//                 Order: index.toString(),
//                 ID: song.publicId.toString(),
//                 Name: song.name || "",
//                 URL: dashboardContext.routingApi.getURIForSong(song),
//             }),
//             filename: "songs"
//         },
//         showAdminControls: true,
//     };
//
//     // Filter hooks for passing to the generic component
//     const filterHooks = {
//         tags: tagFilter,
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
//                 if (!isPublicId(x.id)) return x;
//                 const tag = dashboardContext.songTag.getById(db3.xSongTag.parseIdentity(x.id))!;
//                 return {
//                     ...x,
//                     color: tag.color,
//                     label: tag.name,
//                     shape: "rounded",
//                     tooltip: tag.description,
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
// const SearchSongsPage: BlitzPage = (props) => {
//     return (
//         <DashboardLayout title="Songs">
//             <div className="eventsMainContent searchPage">
//                 <AppContextMarker name="song search page">
//                     <Suspense>
//                         <LocalizedMarkdown setting="songs_markdown"></LocalizedMarkdown>
//                     </Suspense>
//                     <NewSongButton />
//
//                     <SongListOuter />
//                 </AppContextMarker>
//             </div>
//         </DashboardLayout>
//     )
// }
//
// export default SearchSongsPage;
// MIGRATION_REFERENCE_END
