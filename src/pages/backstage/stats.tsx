import { BlitzPage } from "@blitzjs/next";
import { useQuery } from "@blitzjs/rpc";
import React, { Suspense } from 'react';
import { StandardVariationSpec } from "shared/color";
import { Permission } from "shared/permissions";
import { arraysContainSameValues, getEnumValues } from "shared/utils";
import { ActivityVis, ActivityVisBucket } from "src/core/components/ActivityVis";
import { CMChip } from "src/core/components/CMChip";
import { AdminInspectObject, CMSinglePageSurfaceCard } from "src/core/components/CMCoreComponents";
import { EventTextLink } from "src/core/components/CMCoreComponents2";
import { DashboardContext } from "src/core/components/DashboardContext";
import { ChipFilterGroup, ChipFilterGroupItem, FilterControls } from "src/core/components/FilterControl";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { getURIForEvent, getURIForSong } from "src/core/db3/clientAPILL";
import { EventAPI, EventStatusSignificance, EventTypeSignificance } from "src/core/db3/db3";
import getGlobalStats from "src/core/db3/queries/getGlobalStats";
import { GetGlobalStatsFilterSpec, GetGlobalStatsRet, GetGlobalStatsRetEvent, GetGlobalStatsRetPopularSongOccurrance, GetSongActivityReportFilterSpecTimingFilter } from "src/core/db3/shared/apiTypes";
import DashboardLayout from "src/core/layouts/DashboardLayout";




////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface GlobalStatsFilterControlsProps {
    filterSpec: GetGlobalStatsFilterSpec;
    setFilterSpec: (s: GetGlobalStatsFilterSpec) => void;
    defaultFilterSpec: GetGlobalStatsFilterSpec;
}

export const GlobalStatsFilterControls = ({ filterSpec, setFilterSpec, defaultFilterSpec }: GlobalStatsFilterControlsProps) => {
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
        <div className='divider'></div>
        <ChipFilterGroup
            style='toggle'
            items={dashboardContext.songTag.map((s): ChipFilterGroupItem<number> => ({
                id: s.id,
                label: s.text,
                color: s.color,
            }))}
            onChange={(ns) => setFilterSpec({ ...filterSpec, songTagIds: ns })}
            selectedIds={filterSpec.songTagIds}
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









const StatsPagePopularSong = ({ occurrances, expanded }: { occurrances: GetGlobalStatsRetPopularSongOccurrance[], expanded: boolean }) => {
    const [selectedBucket, setSelectedBucket] = React.useState<null | ActivityVisBucket<GetGlobalStatsRetPopularSongOccurrance>>(null);

    return <div>
        <h2>
            <a
                href={getURIForSong({
                    id: occurrances[0]!.songId,
                    name: occurrances[0]!.songName,
                })}
                rel="noreferrer"
                target="_blank"
            >
                {occurrances[0]!.songName}</a>
            ({occurrances.length})
        </h2>
        {expanded && <>
            <ActivityVis
                items={occurrances.filter(a => !!a.startsAt)}
                getItemInfo={x => {
                    return {
                        occursAt: x.startsAt!,
                    }
                }}
                getBucketInfo={(b) => {
                    return {
                        tooltip: <ul>{b.items.map(x => <li key={x.item.eventId}>{x.item.eventName}</li>)}</ul>
                    };
                }}
                selectedMonthBucketId={selectedBucket?.yearMonthBucketId || null}
                onBucketClick={(b) => setSelectedBucket(b)}
            />
            <div>
                <ul>
                    {selectedBucket?.items.map(i => {
                        return <li key={i.item.eventId}>
                            <EventTextLink event={{ id: i.item.eventId, name: i.item.eventName, startsAt: i.item.startsAt, statusId: i.item.statusId, typeId: i.item.typeId }} />
                        </li>;

                    })}
                </ul>
            </div>
        </>}
    </div>
};



////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface StatsPageQuerierProps {
    filterSpec: GetGlobalStatsFilterSpec,
    setResults: (x: GetGlobalStatsRet) => void;
}
const StatsPageQuerier = (props: StatsPageQuerierProps) => {
    const [results, { refetch }] = useQuery(getGlobalStats, {
        filterSpec: props.filterSpec,
    });
    //const [results, queryInfo] = useQuery(getSongActivityReport, { songId: props.songId, filterSpec: props.filterSpec });
    React.useEffect(() => {
        props.setResults(results);
    }, [results]);
    return <div></div>;
};



const StatsPageInner = () => {
    const dashboardContext = React.useContext(DashboardContext);

    const defaultFilterSpec: GetGlobalStatsFilterSpec = {
        // primary
        timing: "All",

        // extra
        eventStatusIds: dashboardContext.eventStatus.filter(s => s.significance === EventStatusSignificance.FinalConfirmation).map(s => s.id),// dashboardContext.eventStatus.filter(s => s.significance !== EventStatusSignificance.Cancelled).map(s => s.id), // everything
        eventTypeIds: dashboardContext.eventType.filter(t => [EventTypeSignificance.Concert].includes(t.significance as any)).map(t => t.id), // concerts & rehearsals & weekend are the only thing that matter for songs
        eventTagIds: [],
        songTagIds: [],
    };

    const [expanded, setExpanded] = React.useState<boolean>(true);
    const [filterSpec, setFilterSpec] = React.useState<GetGlobalStatsFilterSpec>(defaultFilterSpec);
    const [results, setResults] = React.useState<GetGlobalStatsRet>({
        allEvents: [],
        eventsQuery: "",
        popularSongsOccurrances: [],
        popularSongsQuery: "",
    });

    const [selectedEventBucket, setSelectedEventBucket] = React.useState<null | ActivityVisBucket<GetGlobalStatsRetEvent>>(null);

    const songMap = new Map<number, GetGlobalStatsRetPopularSongOccurrance[]>();
    results.popularSongsOccurrances.forEach(s => {
        if (songMap.has(s.songId)) {
            songMap.get(s.songId)?.push(s);
        } else {
            songMap.set(s.songId, [s]);
        }
    });

    const sortedSongs = [...songMap.values()];
    sortedSongs.sort((a, b) => {
        return b.length - a.length; // desc
    });

    return <div>
        <AdminInspectObject src={results} label="results" />

        <GlobalStatsFilterControls
            defaultFilterSpec={defaultFilterSpec}
            filterSpec={filterSpec}
            setFilterSpec={setFilterSpec}
        />

        <CMChip
            onClick={() => setExpanded(!expanded)}
            shape="rectangle"
            variation={{ ...StandardVariationSpec.Strong, selected: expanded }}
        >
            Show graphs
        </CMChip>

        <Suspense>
            <StatsPageQuerier filterSpec={filterSpec} setResults={setResults} />
        </Suspense>

        <h1>Event activity ({results.allEvents.length})</h1>

        {expanded &&
            <ActivityVis
                className="events"
                items={results.allEvents.filter(e => !!e.startsAt)}
                getItemInfo={(e) => {
                    return {
                        occursAt: e.startsAt!,
                    };
                }}
                getBucketInfo={(b) => {
                    return {
                        tooltip: <ul>{b.items.map(x => <li key={x.item.id}>{EventAPI.getLabel(x.item)}</li>)}</ul>
                    };
                }}
                selectedMonthBucketId={selectedEventBucket?.yearMonthBucketId || null}
                onBucketClick={(b) => setSelectedEventBucket(b)}
            />}

        <div>
            <ul>
                {selectedEventBucket?.items.map(i => {
                    return <li key={i.item.id}>
                        <EventTextLink event={i.item} />
                        {/* <a rel="noreferrer" target="_blank" href={getURIForEvent(i.item)}>
                            {EventAPI.getLabel(i.item)}
                        </a> */}
                    </li>;

                })}
            </ul>
        </div>

        <h1>Most popular songs (top 10)</h1>
        {sortedSongs.map(s => {
            return <StatsPagePopularSong key={s[0]!.songId} occurrances={s} expanded={expanded} />;
        })}
    </div>;
};

const MainContent = () => {

    return <>
        <CMSinglePageSurfaceCard>
            <div className="content">
                <SettingMarkdown setting="StatsPage_markdown"></SettingMarkdown>
                <Suspense>
                    <StatsPageInner />
                </Suspense>
            </div>
        </CMSinglePageSurfaceCard>
    </>;
};


const StatsPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Global Stats" basePermission={Permission.view_events_nonpublic}>
            <MainContent />
        </DashboardLayout>
    )
}

export default StatsPage;
