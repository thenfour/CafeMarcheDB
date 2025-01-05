
import { useQuery } from '@blitzjs/rpc';
import React, { Suspense } from "react";
import { arraysContainSameValues, getEnumValues } from 'shared/utils';
import { getURIForEvent } from '../db3/clientAPILL';
import getSongActivityReport from '../db3/queries/getSongActivityReport';
import { GetSongActivityReportFilterSpec, GetSongActivityReportFilterSpecTimingFilter, GetSongActivityReportRet, GetSongActivityReportRetEvent } from '../db3/shared/apiTypes';
import { ActivityVis, ActivityVisBucket } from './ActivityVis';
import { SettingMarkdown } from './SettingMarkdown';
import { EnrichedVerboseSong } from './SongComponentsBase';

import { EventAPI } from '../db3/db3';
import { AdminInspectObject } from './CMCoreComponents';
import { DashboardContext } from './DashboardContext';
import { ChipFilterGroup, ChipFilterGroupItem, FilterControls } from './FilterControl';


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface SongHistoryFilterControlsProps {
    filterSpec: GetSongActivityReportFilterSpec;
    setFilterSpec: (s: GetSongActivityReportFilterSpec) => void;
    defaultFilterSpec: GetSongActivityReportFilterSpec;
}

export const SongHistoryFilterControls = ({ filterSpec, setFilterSpec, defaultFilterSpec }: SongHistoryFilterControlsProps) => {
    const dashboardContext = React.useContext(DashboardContext);

    const hasExtraFilters = () => {
        if (!arraysContainSameValues(filterSpec.eventStatusIds, defaultFilterSpec.eventStatusIds)) return true;
        if (!arraysContainSameValues(filterSpec.eventTagIds, defaultFilterSpec.eventTagIds)) return true;
        if (!arraysContainSameValues(filterSpec.eventTypeIds, defaultFilterSpec.eventTypeIds)) return true;
        return false;
    };

    const hasAnyFilters = () => {
        if (filterSpec.timing !== defaultFilterSpec.timing) return true;
        return hasExtraFilters();
    };

    const filters = <>
        <ChipFilterGroup
            style='radio'
            items={getEnumValues(GetSongActivityReportFilterSpecTimingFilter).map(x => ({
                id: x as keyof typeof GetSongActivityReportFilterSpecTimingFilter,
                label: x,
            }))}
            onChange={(ns) => setFilterSpec({ ...filterSpec, timing: ns[0]! })}
            selectedIds={[filterSpec.timing]}
        />
    </>;

    const extFilters = <>
        <div className='divider'></div>
        <ChipFilterGroup
            style='toggle'
            items={dashboardContext.eventType.map((s): ChipFilterGroupItem<number> => ({
                id: s.id,
                label: s.text,
                color: s.color,
            }))}
            onChange={(ns) => setFilterSpec({ ...filterSpec, eventTypeIds: ns })}
            selectedIds={filterSpec.eventTypeIds}
        />
        <ChipFilterGroup
            style='toggle'
            items={dashboardContext.eventStatus.map((s): ChipFilterGroupItem<number> => ({
                id: s.id,
                label: s.label,
                color: s.color,
                shape: 'rectangle',
            }))}
            onChange={(ns) => setFilterSpec({ ...filterSpec, eventStatusIds: ns })}
            selectedIds={filterSpec.eventStatusIds}
        />
        <ChipFilterGroup
            style='toggle'
            items={dashboardContext.eventTag.map((s): ChipFilterGroupItem<number> => ({
                id: s.id,
                label: s.text,
                color: s.color,
            }))}
            onChange={(ns) => setFilterSpec({ ...filterSpec, eventTagIds: ns })}
            selectedIds={filterSpec.eventTagIds}
        />
    </>;

    return <FilterControls
        inCard={true}
        hasAnyFilters={hasAnyFilters()}
        onResetFilter={() => setFilterSpec(defaultFilterSpec)}
        primaryFilter={filters}
        extraFilter={extFilters}
        hasExtraFilters={hasExtraFilters()}
    />;
};



////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface SongHistoryQuerierProps {
    filterSpec: GetSongActivityReportFilterSpec,
    songId: number;
    setResults: (x: GetSongActivityReportRet) => void;
}
const SongHistoryQuerier = (props: SongHistoryQuerierProps) => {
    const [results, queryInfo] = useQuery(getSongActivityReport, { songId: props.songId, filterSpec: props.filterSpec });
    React.useEffect(() => {
        props.setResults(results);
    }, [results]);
    return <div></div>;
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export interface SongHistoryProps {
    song: EnrichedVerboseSong;
}

export const SongHistoryInner = ({ song, ...props }: SongHistoryProps) => {

    const defaultFilterSpec: GetSongActivityReportFilterSpec = {
        // primary
        timing: "All past",

        // extra
        eventStatusIds: [], // don't include cancelled
        eventTagIds: [],
        eventTypeIds: [],
    };

    const [filterSpec, setFilterSpec] = React.useState<GetSongActivityReportFilterSpec>(defaultFilterSpec);
    const [results, setResults] = React.useState<GetSongActivityReportRet>({
        events: [],
        query: "",
    });

    const [selectedBucket, setSelectedBucket] = React.useState<null | ActivityVisBucket<GetSongActivityReportRetEvent>>(null);

    return <div className='SongHistoryInner'>

        <AdminInspectObject src={results} label='results' />
        <AdminInspectObject src={filterSpec} label='filterSpec' />

        <SongHistoryFilterControls
            defaultFilterSpec={defaultFilterSpec}
            filterSpec={filterSpec}
            setFilterSpec={setFilterSpec}
        />

        <Suspense>
            <SongHistoryQuerier filterSpec={filterSpec} songId={song.id} setResults={setResults} />
        </Suspense>

        <div>
            This song has appeared in {results.events.length} events that match your filter
        </div>

        <ActivityVis
            items={results.events.filter(e => !!e.startsAt)}
            getItemInfo={(item) => {
                return {
                    occursAt: item.startsAt!,
                }
            }}
            getBucketInfo={(bucket) => {
                if (bucket.items.length === 0) return { tooltip: "" };
                return {
                    tooltip: <ul>{bucket.items.map(x => <li key={x.item.id}>{EventAPI.getLabel(x.item)}</li>)}</ul>
                }
            }}
            selectedMonthBucketId={selectedBucket?.yearMonthBucketId || null}
            onBucketClick={(bucket) => {
                if (bucket.yearMonthBucketId === selectedBucket?.yearMonthBucketId) {
                    // toggle off.
                    setSelectedBucket(null);
                    return;
                }
                setSelectedBucket(bucket);
            }}
        />
        <ul>
            {selectedBucket && selectedBucket.items.map(i => {
                return <li key={i.item.id}>
                    <a rel="noreferrer" target="_blank" href={getURIForEvent(i.item)}>
                        {EventAPI.getLabel(i.item)}
                    </a></li>;
            })}
        </ul>
    </div>;
};

export const SongHistory = (props: SongHistoryProps) => {

    return <div>
        <SettingMarkdown setting='SongHistoryTabDescription' />
        <Suspense>
            <SongHistoryInner {...props} />
        </Suspense>
    </div>;
};

