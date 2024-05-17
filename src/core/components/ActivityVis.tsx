
import { Tooltip } from "@mui/material";
import React from "react";
import { Clamp, IsNullOrWhitespace, lerp } from 'shared/utils';


interface ActivityVisItemInfo {
    occursAt: Date;
};


interface ActivityVisCellInfo {
    tooltip: React.ReactNode;
};

type ActivityVisItemWithInfo<T> = {
    item: T;
    yearBucketId: string;
    monthBucketId: string;
    extraInfo: ActivityVisItemInfo;
};

export type ActivityVisBucket<T> = {
    yearBucketId: string;
    monthBucketId: string;
    items: ActivityVisItemWithInfo<T>[];
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface ActivityVisProps<T> {
    items: T[];
    className?: string;
    selectedMonthBucketId?: string | null;
    onBucketClick?: (bucket: ActivityVisBucket<T>) => void;
    getBucketInfo?: (bucket: ActivityVisBucket<T>) => ActivityVisCellInfo;
    getItemInfo: (item: T) => ActivityVisItemInfo;
};

export const ActivityVis = <T,>(props: ActivityVisProps<T>) => {
    let maxYear: number | null = null;// = Math.max(...years);
    let minYear: number | null = null;// = Math.min(...years);

    // attach info to the generic item
    const itemsWithInfo: ActivityVisItemWithInfo<T>[] = props.items.map(item => {
        const extraInfo = props.getItemInfo(item);
        const year = extraInfo.occursAt.getFullYear();
        minYear = Math.min(minYear || 9999, year);
        maxYear = Math.min(maxYear || 0, year);
        const month = extraInfo.occursAt.getMonth(); // month index, where January is 0
        return {
            item,
            extraInfo,
            yearBucketId: `${year}`,
            monthBucketId: `${year}-${month}`,
        };
    });

    // place into buckets (bucket=yyyy-mm) and yearbuckets
    const yearBuckets = new Map<string, ActivityVisBucket<T>>();
    const monthBuckets = new Map<string, ActivityVisBucket<T>>();
    itemsWithInfo.forEach(item => {
        if (!monthBuckets.has(item.monthBucketId)) {
            // init bucket.
            monthBuckets.set(item.monthBucketId, {
                monthBucketId: item.monthBucketId,
                yearBucketId: item.yearBucketId,
                items: [item],
            });
        } else {
            monthBuckets.get(item.monthBucketId)!.items.push(item);
        }

        if (!yearBuckets.has(item.yearBucketId)) {
            // init bucket.
            yearBuckets.set(item.yearBucketId, {
                monthBucketId: item.monthBucketId,
                yearBucketId: item.yearBucketId,
                items: [item],
            });
        } else {
            yearBuckets.get(item.yearBucketId)!.items.push(item);
        }
    });

    const maxMonthValue = [...monthBuckets.values()].reduce((acc, v) => Math.max(v.items.length, acc), 1); // start with 1 to avoid later div0
    const maxYearValue = [...yearBuckets.values()].reduce((acc, v) => Math.max(v.items.length, acc), 1);

    maxYear = maxYear || new Date().getFullYear();
    minYear = minYear || new Date().getFullYear();

    function getColorClass(value) {
        // Special bucket for values very near 0
        if (value <= 0.001) {
            return '#eee'; // transparent.
        }
        const colors = [
            // kinda usable green-pink
            //-- // {"c":["#00f","#f88","#0f02"],"m":"lab","z":4,"op":"diagBL"}
            // "#00ff0022",
            // "#7fb68572",
            // "#9685adaf",
            // "#ae69b9dc",
            // "#d367aef6",
            // "#ff8888",

            // very usable. green-yellow
            // //- // {"c":["#0a0","#fc0","#ccc"],"m":"lab","z":2,"op":"TL"}
            // "#cccccc",
            // "#9ec292",
            // "#6ab757",
            // "#00aa00",
            // "#7db800",
            // "#c1c300",
            // "#ffcc00",

            // almost usable. pretty purple/pink/orange, but it's too many colors.
            // // {"c":["#88f","#f84","#8f8"],"m":"lab","z":2,"op":"TL"}
            // "#88ff88",
            // "#98d8b4",
            // "#97b0db",
            // "#8888ff",
            // "#c586c2",
            // "#e88785",
            // "#ff8844",

            // autumn colors is very usable but ... stylized?
            // {"c":["#f80","#420","#8f8"],"m":"lab","z":2,"op":"TL"}
            // "#88ff88",
            // "#c4db62",
            // "#e7b43a",
            // "#ff8800",
            // "#bc6406",
            // "#7d4107",
            // "#442200",


            //-- // {"c":["#4c4","#fc0","#aaf8"],"m":"hsl","z":2,"op":"TL"}
            // "#aaaaff88",
            // "#81cef5b0",
            // "#5fe4b8d7",
            // "#44cc44",
            // "#74dc2e",
            // "#c2ed17",
            // "#ffcc00",

            // {"c":["#88f","#f84","#8f8"],"m":"cmyk","z":2,"op":"TL"}
            "#88ff88",
            "#88d7b0",
            "#88b0d7",
            "#8888ff",
            "#b088c1",
            "#d78882",
            "#ff8844",

        ];

        return colors[Math.floor(value * (colors.length - 1))];
    }

    // Generate grid rows for each year
    const rows: React.ReactNode[] = [];
    for (let year = maxYear; year >= minYear; year--) {
        const cells: React.ReactNode[] = [];
        for (let month = 0; month < 12; month++) {
            const key = `${year}-${month}`;
            const bucket: ActivityVisBucket<T> = monthBuckets.get(key) || { items: [], monthBucketId: key, yearBucketId: `${year}` };
            const bucketInfo = props.getBucketInfo && props.getBucketInfo(bucket);
            const count = bucket.items.length;
            const normCount = count / maxMonthValue;

            const classes = [
                "cell",
                props.selectedMonthBucketId === key ? "selected" : "notSelected",
                normCount > 0 ? "hasActivity" : "noActivity",
            ];

            const ch = (count === 0 || IsNullOrWhitespace(bucketInfo?.tooltip)) ?
                <div className='cellInner'></div>
                :
                <Tooltip title={bucketInfo?.tooltip} disableInteractive>
                    <div className='cellInner'>{count}</div>
                </Tooltip>
                ;

            const opacity = normCount === 0 ? undefined : lerp(.5, 1, normCount);

            cells.push(
                <td className={classes.join(" ")} style={{ backgroundColor: getColorClass(normCount), opacity }} key={month} onClick={!props.onBucketClick ? undefined : (() => props.onBucketClick!(bucket))}>
                    {ch}
                </td>
            );
        } // months

        const yearBucket: ActivityVisBucket<T> = yearBuckets.get(year.toString()) || { items: [], monthBucketId: "n/a", yearBucketId: `${year}` };
        const yearCount = yearBucket.items.length;
        const normYearValue = yearCount / maxYearValue;

        const yearStyle = {
            "--normValue": normYearValue,
            "--color": getColorClass(normYearValue),
        };

        rows.push(
            <tr key={year}>
                <th className='yearTH'>{year}</th>
                {cells}
                <td className="yearTotalGraphTD">
                    <div className="yearTotalGraphWrap">
                        <div className="yearTotalFilledPart" style={yearStyle as any}>
                            {yearCount}
                        </div>
                    </div>
                </td>
            </tr>
        );
    }

    return (
        <table className={`activityVis ${props.className}`}>
            <thead>
                <tr>
                    <th></th>
                    {Array.from({ length: 12 }, (_, i) => (
                        <th key={i} className='monthTH'>{new Date(0, i).toLocaleString('default', { month: 'short' })}</th>
                    ))}
                    <th>Year total</th>
                </tr>
            </thead>
            <tbody>
                {rows}
            </tbody>
        </table>
    );
};

