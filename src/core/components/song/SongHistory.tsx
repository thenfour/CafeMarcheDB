import { Alert } from "@mui/material";
import React from "react";
import { useLocale } from "src/locale/components/useLocale";
import type { SongPublicId } from "shared/publicId";

export interface SongHistoryProps {
    readonly song: { readonly publicId: SongPublicId };
}

/** Retain the song-tab entry point while historical readers are deferred. */
export function SongHistory(_props: SongHistoryProps) {
    const locale = useLocale();
    return <Alert severity="info">{locale.getPlainString("recovery.eventSongStatistics.songHistoryDescription")}</Alert>;
}

// MIGRATION_RESTORE: event-song-statistics
// Source: 8fdb9fd6ba7c2bb21718fd050181aad06c6eda97:src/core/components/song/SongHistory.tsx:1-201
// Reason: Event statistics and song history use legacy SQL readers without selected-band snapshots and depend on removed role/catalog fields.
// Restore: Restore event statistics, popular-song occurrences and song performance history with timing/type/status/tag filters, visualization, bucket selection, expansion and event links using fresh band-scoped authorization, public identities and localized catalog labels.
// Verification: Test two bands, platform policy, permission/member revocation, hidden/deleted songs/events, date boundaries, consistent aggregates and public references; exercise statistics and song history controls in the built browser.
// SHA256: 5c2fbe7cc40e6ec62cd84061d3d2fd1237f519c965cc498d11d4d041adc066f0
// MIGRATION_REFERENCE_BEGIN
//
// import { useQuery } from '@blitzjs/rpc';
// import React, { Suspense } from "react";
// import { getEnumValues } from 'shared/utils';
// import getSongActivityReport from '../../db3/queries/getSongActivityReport';
// import { GetSongActivityReportFilterSpec, GetSongActivityReportFilterSpecTimingFilter, GetSongActivityReportRet, GetSongActivityReportRetEvent } from '../../db3/shared/apiTypes';
// import { ActivityVis, ActivityVisBucket } from '../ActivityVis';
// import { LocalizedMarkdown } from '../../../setting/client/components/SettingMarkdown';
//
// import * as db3 from '../../db3/db3';
// import { ChipFilterGroup, ChipFilterGroupItem, FilterControls } from '../search/FilterControl';
// import { arraysContainSameValues } from 'shared/arrayUtils';
// import { AdminInspectObject } from '../CMCoreComponents2';
// import { useDashboardContext } from '../dashboardContext/DashboardContext';
// import type { EventStatusPublicId, EventTagPublicId, EventTypePublicId, SongPublicId } from 'shared/publicId';
//
//
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// interface SongHistoryFilterControlsProps {
//     filterSpec: GetSongActivityReportFilterSpec;
//     setFilterSpec: (s: GetSongActivityReportFilterSpec) => void;
//     defaultFilterSpec: GetSongActivityReportFilterSpec;
// }
//
// export const SongHistoryFilterControls = ({ filterSpec, setFilterSpec, defaultFilterSpec }: SongHistoryFilterControlsProps) => {
//     const dashboardContext = useDashboardContext();
//
//     const hasExtraFilters = () => {
//         if (!arraysContainSameValues(filterSpec.eventStatusIds, defaultFilterSpec.eventStatusIds)) return true;
//         if (!arraysContainSameValues(filterSpec.eventTagIds, defaultFilterSpec.eventTagIds)) return true;
//         if (!arraysContainSameValues(filterSpec.eventTypeIds, defaultFilterSpec.eventTypeIds)) return true;
//         return false;
//     };
//
//     const hasAnyFilters = () => {
//         if (filterSpec.timing !== defaultFilterSpec.timing) return true;
//         return hasExtraFilters();
//     };
//
//     const filters = <>
//         <ChipFilterGroup
//             style='radio'
//             items={getEnumValues(GetSongActivityReportFilterSpecTimingFilter).map(x => ({
//                 id: x as keyof typeof GetSongActivityReportFilterSpecTimingFilter,
//                 label: x,
//             }))}
//             onChange={(ns) => setFilterSpec({ ...filterSpec, timing: ns[0]! })}
//             selectedIds={[filterSpec.timing]}
//         />
//     </>;
//
//     const extFilters = <>
//         <div className='divider'></div>
//         <ChipFilterGroup
//             style='toggle'
//             items={dashboardContext.eventType.map((s): ChipFilterGroupItem<EventTypePublicId> => ({
//                 id: s.publicId,
//                 label: s.name,
//                 color: s.color,
//             }))}
//             onChange={(ns) => setFilterSpec({ ...filterSpec, eventTypeIds: ns })}
//             selectedIds={filterSpec.eventTypeIds}
//         />
//         <ChipFilterGroup
//             style='toggle'
//             items={dashboardContext.eventStatus.map((s): ChipFilterGroupItem<EventStatusPublicId> => ({
//                 id: s.publicId,
//                 label: s.name,
//                 color: s.color,
//                 shape: 'rectangle',
//             }))}
//             onChange={(ns) => setFilterSpec({ ...filterSpec, eventStatusIds: ns })}
//             selectedIds={filterSpec.eventStatusIds}
//         />
//         <ChipFilterGroup
//             style='toggle'
//             items={dashboardContext.eventTag.map((s): ChipFilterGroupItem<EventTagPublicId> => ({
//                 id: s.publicId,
//                 label: s.name,
//                 color: s.color,
//             }))}
//             onChange={(ns) => setFilterSpec({ ...filterSpec, eventTagIds: ns })}
//             selectedIds={filterSpec.eventTagIds}
//         />
//     </>;
//
//     return <FilterControls
//         inCard={true}
//         hasAnyFilters={hasAnyFilters()}
//         onResetFilter={() => setFilterSpec(defaultFilterSpec)}
//         primaryFilter={filters}
//         extraFilter={extFilters}
//         hasExtraFilters={hasExtraFilters()}
//     />;
// };
//
//
//
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// interface SongHistoryQuerierProps {
//     filterSpec: GetSongActivityReportFilterSpec,
//     songId: SongPublicId;
//     setResults: (x: GetSongActivityReportRet) => void;
// }
// const SongHistoryQuerier = (props: SongHistoryQuerierProps) => {
//     const [results, queryInfo] = useQuery(getSongActivityReport, { songId: props.songId, filterSpec: props.filterSpec });
//     React.useEffect(() => {
//         props.setResults(results);
//     }, [results]);
//     return <div></div>;
// };
//
//
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// export interface SongHistoryProps {
//     song: db3.SongDetailClient;
// }
//
// export const SongHistoryInner = ({ song, ...props }: SongHistoryProps) => {
//     const dashboardContext = useDashboardContext();
//
//     const defaultFilterSpec: GetSongActivityReportFilterSpec = {
//         // primary
//         timing: "All past",
//
//         // extra
//         eventStatusIds: [], // don't include cancelled
//         eventTagIds: [],
//         eventTypeIds: [],
//     };
//
//     const [filterSpec, setFilterSpec] = React.useState<GetSongActivityReportFilterSpec>(defaultFilterSpec);
//     const [results, setResults] = React.useState<GetSongActivityReportRet>({
//         events: [],
//     });
//
//     const [selectedBucket, setSelectedBucket] = React.useState<null | ActivityVisBucket<GetSongActivityReportRetEvent>>(null);
//
//     return <div className='SongHistoryInner'>
//
//         <AdminInspectObject src={results} label='results' />
//         <AdminInspectObject src={filterSpec} label='filterSpec' />
//
//         <SongHistoryFilterControls
//             defaultFilterSpec={defaultFilterSpec}
//             filterSpec={filterSpec}
//             setFilterSpec={setFilterSpec}
//         />
//
//         <Suspense>
//             <SongHistoryQuerier filterSpec={filterSpec} songId={song.publicId} setResults={setResults} />
//         </Suspense>
//
//         <div>
//             This song has appeared in {results.events.length} events that match your filter
//         </div>
//
//         <ActivityVis
//             items={results.events.filter(e => !!e.startsAt)}
//             getItemInfo={(item) => {
//                 return {
//                     occursAt: item.startsAt!,
//                 }
//             }}
//             getBucketInfo={(bucket) => {
//                 if (bucket.items.length === 0) return { tooltip: "" };
//                 return {
//                     tooltip: <ul>{bucket.items.map(x => <li key={x.item.publicId}>{db3.EventAPI.getLabel(x.item)}</li>)}</ul>
//                 }
//             }}
//             selectedMonthBucketId={selectedBucket?.yearMonthBucketId || null}
//             onBucketClick={(bucket) => {
//                 if (bucket.yearMonthBucketId === selectedBucket?.yearMonthBucketId) {
//                     // toggle off.
//                     setSelectedBucket(null);
//                     return;
//                 }
//                 setSelectedBucket(bucket);
//             }}
//         />
//         <ul>
//             {selectedBucket && selectedBucket.items.map(i => {
//                 return <li key={i.item.publicId}>
//                     <a rel="noreferrer" target="_blank" href={dashboardContext.routingApi.getURIForEvent(i.item)}>
//                         {db3.EventAPI.getLabel(i.item)}
//                     </a></li>;
//             })}
//         </ul>
//     </div>;
// };
//
// export const SongHistory = (props: SongHistoryProps) => {
//
//     return <div>
//         <LocalizedMarkdown setting='SongHistoryTabDescription' />
//         <Suspense>
//             <SongHistoryInner {...props} />
//         </Suspense>
//     </div>;
// };
// MIGRATION_REFERENCE_END
