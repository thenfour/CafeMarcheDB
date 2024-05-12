import { BlitzPage } from "@blitzjs/next";
import { useQuery } from "@blitzjs/rpc";
import React, { Suspense } from 'react';
import { Permission } from "shared/permissions";
import { ActivityVis, ActivityVisBucket } from "src/core/components/ActivityVis";
import { AdminInspectObject, CMSinglePageSurfaceCard } from "src/core/components/CMCoreComponents";
import { DashboardContext } from "src/core/components/DashboardContext";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { getURIForEvent, getURIForSong } from "src/core/db3/clientAPILL";
import getGlobalStats from "src/core/db3/queries/getGlobalStats";
import { GetGlobalStatsRetEvent, GetGlobalStatsRetPopularSongOccurrance } from "src/core/db3/shared/apiTypes";
import DashboardLayout from "src/core/layouts/DashboardLayout";


const StatsPagePopularSong = ({ occurrances }: { occurrances: GetGlobalStatsRetPopularSongOccurrance[] }) => {
    const [selectedBucket, setSelectedBucket] = React.useState<null | ActivityVisBucket<GetGlobalStatsRetPopularSongOccurrance>>(null);

    return <div>
        <h2>
            <a href={getURIForSong(occurrances[0]!.songId)} rel="noreferrer" target="_blank">
                {occurrances[0]!.songName}</a>
            ({occurrances.length})
        </h2>
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
            selectedBucketId={selectedBucket?.bucketId || null}
            onBucketClick={(b) => setSelectedBucket(b)}
        />
        <div>
            <ul>
                {selectedBucket?.items.map(i => {
                    return <li key={i.item.eventId}>
                        <a rel="noreferrer" target="_blank" href={getURIForEvent(i.item.eventId)}>
                            {i.item.startsAt?.toLocaleDateString()} {i.item.eventName}
                        </a></li>;

                })}
            </ul>
        </div>
    </div>
};

const StatsPageInner = () => {
    const [stats, { refetch }] = useQuery(getGlobalStats, {});
    const [selectedEventBucket, setSelectedEventBucket] = React.useState<null | ActivityVisBucket<GetGlobalStatsRetEvent>>(null);

    const songMap = new Map<number, GetGlobalStatsRetPopularSongOccurrance[]>();
    stats.popularSongsOccurrances.forEach(s => {
        if (songMap.has(s.songId)) {
            songMap.get(s.songId)?.push(s);
        } else {
            songMap.set(s.songId, [s]);
        }
    });

    return <div>
        <AdminInspectObject src={stats} label="stats" />
        <h1>Event activity</h1>
        <ActivityVis
            className="events"
            items={stats.allEvents.filter(e => !!e.startsAt)}
            getItemInfo={(e) => {
                return {
                    occursAt: e.startsAt!,
                };
            }}
            getBucketInfo={(b) => {
                return {
                    tooltip: <ul>{b.items.map(x => <li key={x.item.id}>{x.item.name}</li>)}</ul>
                };
            }}
            selectedBucketId={selectedEventBucket?.bucketId || null}
            onBucketClick={(b) => setSelectedEventBucket(b)}
        />
        <div>
            <ul>
                {selectedEventBucket?.items.map(i => {
                    return <li key={i.item.id}>
                        <a rel="noreferrer" target="_blank" href={getURIForEvent(i.item.id)}>
                            {i.item.startsAt?.toLocaleDateString()} {i.item.name}
                        </a></li>;

                })}
            </ul>
        </div>

        <h1>Most popular songs</h1>
        {[...songMap.keys()].map(songId => {
            const x = songMap.get(songId)!;
            return <StatsPagePopularSong occurrances={x} />;
        })}
    </div>;
};

const MainContent = () => {
    const dashboardContext = React.useContext(DashboardContext);
    if (!dashboardContext.isAuthorized(Permission.view_events)) {
        throw new Error(`unauthorized`);
    }

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
        <DashboardLayout title="Files">
            <MainContent />
        </DashboardLayout>
    )
}

export default StatsPage;
