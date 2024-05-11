
import { useQuery } from '@blitzjs/rpc';
import { Tooltip } from "@mui/material";
import React, { Suspense } from "react";
import { IsNullOrWhitespace } from 'shared/utils';
import getSongActivityReport from '../db3/queries/getSongActivityReport';
import { EnrichedVerboseSong } from './SongComponentsBase';
import { GetSongActivityReportRetEvent } from '../db3/shared/apiTypes';
import { SettingMarkdown } from './SettingMarkdown';
import { getURIForEvent } from '../db3/clientAPILL';
import { ActivityVis, ActivityVisBucket } from './ActivityVis';


////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export interface SongHistoryProps {
    song: EnrichedVerboseSong;
}

export const SongHistoryInner = ({ song, ...props }: SongHistoryProps) => {
    const [selectedBucket, setSelectedBucket] = React.useState<null | ActivityVisBucket<GetSongActivityReportRetEvent>>(null);
    const [results, { refetch }] = useQuery(getSongActivityReport, { songId: song.id });

    return <div className='SongHistoryInner'>
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
                    tooltip: bucket.items.map(i => i.item.name).join("\r\n"),
                }
            }}
            selectedBucketId={selectedBucket?.bucketId || null}
            onBucketClick={(bucket) => {
                if (bucket.bucketId === selectedBucket?.bucketId) {
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
                    <a rel="noreferrer" target="_blank" href={getURIForEvent(i.item.id)}>
                        {i.item.startsAt?.toLocaleDateString()} {i.item.name}
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

