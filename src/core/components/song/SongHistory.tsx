import { useQuery } from "@blitzjs/rpc";
import { Alert } from "@mui/material";
import React from "react";
import { Permission } from "shared/permissions";
import { CalendarDate } from "shared/dateTimePolicy";
import type { SongPublicId } from "shared/publicId";
import { useLocale } from "src/locale/components/useLocale";
import type { LocalizedPlainStringKey } from "src/locale/shared/staticLocalizedStringRegistry";
import { useDB3QueryContext } from "src/core/db3/components/useDB3Context";
import getSongActivityReport from "../../db3/queries/getSongActivityReport";
import { SongHistoryTimingSchema, type SongHistoryFilter, type SongHistoryTiming } from "../../db3/shared/entities/song/songHistory";
import { ActivityVis } from "../ActivityVis";
import { Localized } from "src/setting/client/components/SettingMarkdown";
import { useDashboardContext } from "../dashboardContext/DashboardContext";
import { ChipFilterGroup, FilterControls } from "../search/FilterControl";

export interface SongHistoryProps {
    readonly song: { readonly publicId: SongPublicId };
}
const timingLabels: { readonly [Timing in SongHistoryTiming]: LocalizedPlainStringKey } = {
    All: "songHistory.all", "All past": "songHistory.past", Future: "songHistory.future",
    "Past 5 years": "songHistory.fiveYears", "Past year": "songHistory.year",
};
const defaultFilter: SongHistoryFilter = { timing: "All past", eventTypeIds: [], eventStatusIds: [], eventTagIds: [] };

function SongHistoryResults({ song, filterSpec }: SongHistoryProps & { filterSpec: SongHistoryFilter }) {
    const context = useDB3QueryContext();
    const dashboard = useDashboardContext();
    const locale = useLocale();
    const [selectedMonth, setSelectedMonth] = React.useState<string | null>(null);
    const [result, status] = useQuery(getSongActivityReport, { ...context, bandPublicId: context.bandPublicId!, songId: song.publicId, filterSpec }, {
        suspense: false, useErrorBoundary: false, keepPreviousData: false, staleTime: 0, cacheTime: 0,
    });
    React.useEffect(() => setSelectedMonth(null), [filterSpec]);
    if (status.isError) {
        return <Alert severity="error">{locale.getPlainString("songHistory.failed")}</Alert>;
    }
    if (!result || status.isFetching) {
        return <div role="status">{locale.getPlainString("songHistory.loading")}</div>;
    }
    const calendarMonth = (date: Date) => {
        const day = CalendarDate.fromInstant({ value: date, timeZone: dashboard.bandTimeZone }).date;
        return { year: Number(day.slice(0, 4)), month: Number(day.slice(5, 7)) - 1 };
    };
    const eventLabel = (event: typeof result.events[number]) => `${event.name ?? ""} (${event.startsAt?.toLocaleDateString(dashboard.formattingLocale, { timeZone: dashboard.bandTimeZone }) ?? ""})`;
    const selectedEvents = result.events.filter(event => {
        if (!event.startsAt) {
            return false;
        }
        const month = calendarMonth(event.startsAt);
        return `${month.year}-${month.month}` === selectedMonth;
    });
    return <>
        <div className="songHistoryCount">{locale.getPlainString("songHistory.count", { count: result.events.length })}</div>
        <ActivityVis items={result.events.filter(event => event.startsAt != null)} getItemInfo={event => ({ occursAt: event.startsAt! })}
            getCalendarMonth={calendarMonth} formattingLocale={dashboard.formattingLocale}
            selectedMonthBucketId={selectedMonth}
            getBucketInfo={bucket => ({ tooltip: <ul>{bucket.items.map(({ item }) => <li key={item.publicId}>{eventLabel(item)}</li>)}</ul> })}
            onBucketClick={bucket => setSelectedMonth(bucket.yearMonthBucketId === selectedMonth ? null : bucket.yearMonthBucketId)} />
        <ul className="songHistoryEvents">{selectedEvents.map(event => <li key={event.publicId}>
            <a href={dashboard.routingApi.getURIForEvent(event)} target="_blank" rel="noreferrer">{eventLabel(event)}</a>
        </li>)}</ul>
    </>;
}

function SongHistoryInner({ song }: SongHistoryProps) {
    const dashboard = useDashboardContext();
    const locale = useLocale();
    const [filterSpec, setFilterSpec] = React.useState<SongHistoryFilter>(defaultFilter);
    const hasExtraFilters = !!(filterSpec.eventTypeIds.length || filterSpec.eventStatusIds.length || filterSpec.eventTagIds.length);
    return <div className="SongHistoryInner">
        <FilterControls inCard hasAnyFilters={hasExtraFilters || filterSpec.timing !== defaultFilter.timing} hasExtraFilters={hasExtraFilters}
            onResetFilter={() => setFilterSpec(defaultFilter)}
            primaryFilter={<ChipFilterGroup style="radio" items={SongHistoryTimingSchema.options.map(timing => ({ id: timing, label: locale.getPlainString(timingLabels[timing]) }))}
                selectedIds={[filterSpec.timing]} onChange={values => setFilterSpec({ ...filterSpec, timing: values[0]! })} />}
            extraFilter={<>
                <div className="divider" />
                <ChipFilterGroup style="toggle" items={dashboard.eventType.map(type => ({ id: type.publicId, label: type.name, color: type.color }))}
                    selectedIds={filterSpec.eventTypeIds} onChange={eventTypeIds => setFilterSpec({ ...filterSpec, eventTypeIds })} />
                <ChipFilterGroup style="toggle" items={dashboard.eventStatus.map(status => ({ id: status.publicId, label: status.name, color: status.color, shape: "rectangle" }))}
                    selectedIds={filterSpec.eventStatusIds} onChange={eventStatusIds => setFilterSpec({ ...filterSpec, eventStatusIds })} />
                <ChipFilterGroup style="toggle" items={dashboard.eventTag.map(tag => ({ id: tag.publicId, label: tag.name, color: tag.color }))}
                    selectedIds={filterSpec.eventTagIds} onChange={eventTagIds => setFilterSpec({ ...filterSpec, eventTagIds })} />
            </>} />
        <SongHistoryResults song={song} filterSpec={filterSpec} />
    </div>;
}

export function SongHistory(props: SongHistoryProps) {
    const context = useDB3QueryContext();
    const dashboard = useDashboardContext();
    const locale = useLocale();
    if (!context.bandPublicId || !dashboard.isAuthorized(Permission.view_events_nonpublic)) {
        return <Alert severity="info">{locale.getPlainString("songHistory.unavailable")}</Alert>;
    }
    return <div>
        <Localized id="SongHistoryTabDescription" />
        <SongHistoryInner key={`${context.bandPublicId}/${context.routeLocale}/${props.song.publicId}/${context.clientRequestId}`} {...props} />
    </div>;
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
