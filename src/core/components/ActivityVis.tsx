
import { Tooltip } from "@mui/material";
import React from "react";
import { IsNullOrWhitespace } from 'shared/utils';


interface ActivityVisItemInfo {
    occursAt: Date;
};


interface ActivityVisCellInfo {
    tooltip: string | null;
};

type ActivityVisItemWithInfo<T> = {
    item: T;
    bucketId: string;
    extraInfo: ActivityVisItemInfo;
};

export type ActivityVisBucket<T> = {
    bucketId: string;
    items: ActivityVisItemWithInfo<T>[];
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface ActivityVisProps<T> {
    items: T[];
    selectedBucketId?: string | null;
    onBucketClick?: (bucket: ActivityVisBucket<T>) => void;
    getBucketInfo?: (bucket: ActivityVisBucket<T>) => ActivityVisCellInfo;
    getItemInfo: (item: T) => ActivityVisItemInfo;
};

export const ActivityVis = <T,>(props: ActivityVisProps<T>) => {

    // attach info to the generic item
    const itemsWithInfo: ActivityVisItemWithInfo<T>[] = props.items.map(item => {
        const extraInfo = props.getItemInfo(item);
        const year = extraInfo.occursAt.getFullYear();
        const month = extraInfo.occursAt.getMonth(); // month index, where January is 0
        const bucketId = `${year}-${month}`;
        return {
            item,
            bucketId,
            extraInfo,
        };
    });

    // place into buckets.
    const buckets = new Map<string, ActivityVisBucket<T>>();
    itemsWithInfo.forEach(item => {
        if (!buckets.has(item.bucketId)) {
            // init bucket.
            buckets.set(item.bucketId, {
                bucketId: item.bucketId,
                items: [item],
            });
        } else {
            buckets.get(item.bucketId)!.items.push(item);
        }
    });


    // Determine the range of years; this is not efficient but ok.
    const years = itemsWithInfo.map(i => i.extraInfo.occursAt.getFullYear());
    const maxYear = Math.max(...years);
    const minYear = Math.min(...years);

    // Generate grid rows for each year
    const rows: React.ReactNode[] = [];
    for (let year = maxYear; year >= minYear; year--) {
        const cells: React.ReactNode[] = [];
        for (let month = 0; month < 12; month++) {
            const key = `${year}-${month}`;
            const bucket: ActivityVisBucket<T> = buckets.get(key) || { items: [], bucketId: key };
            const bucketInfo = props.getBucketInfo && props.getBucketInfo(bucket);
            const count = bucket.items.length;

            const classes = [
                "cell",
                count > 0 ? "hasActivity" : "noActivity",
                count === 1 && "lowActivity", // 1
                (count >= 2 && count <= 3) && "medActivity", // 2, 3
                count >= 4 && "highActivity",
                props.selectedBucketId === key ? "selected" : "notSelected",
            ];

            const ch = (count === 0 || IsNullOrWhitespace(bucketInfo?.tooltip)) ?
                <div className='cellInner'></div>
                :
                <Tooltip title={bucketInfo?.tooltip} disableInteractive>
                    <div className='cellInner'></div>
                </Tooltip>
                ;

            cells.push(
                <td className={classes.join(" ")} key={month} onClick={!props.onBucketClick ? undefined : (() => props.onBucketClick!(bucket))}>
                    {ch}
                </td>
            );
        }
        rows.push(
            <tr key={year}>
                <th className='yearTH'>{year}</th>
                {cells}
            </tr>
        );
    }

    return (
        <table className='activityVis'>
            <thead>
                <tr>
                    <th></th>
                    {Array.from({ length: 12 }, (_, i) => (
                        <th key={i} className='monthTH'>{new Date(0, i).toLocaleString('default', { month: 'short' })}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {rows}
            </tbody>
        </table>
    );
};

