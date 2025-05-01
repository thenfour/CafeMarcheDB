import { useQuery } from "@blitzjs/rpc";
import * as React from 'react';
import { Bar, CartesianGrid, ComposedChart, Legend, Tooltip, XAxis, YAxis } from "recharts";
//import getGeneralFeatureDetail from "src/core/db3/queries/getGeneralFeatureDetail";
import getGeneralFeatureReport from "@/src/core/components/featureReports/queries/getGeneralFeatureReport";
import { CMSmallButton } from "../CMCoreComponents2";
import { FeatureReportFilterSpec } from "./server/facetProcessor";

// date selection, bucket size
// and other filters

// to allow suspense to work right
interface FeatureReportTopLevelDateSelectorProps {
    filterSpec: FeatureReportFilterSpec;
    //features: ActivityFeature[],
    //selectedBucket: string | null,
    //excludeYourself: boolean;
    //excludeSysadmins: boolean;
    //aggregateBy: ActivityReportTimeBucketSize,
    startDate: Date,
    endDate: Date,
    onClickBucket: (bucket: string) => void,
    refetchTrigger: number,
    //contextBeginsWith: string | undefined,
    setDataUpdatedAt: (date: Date) => void,
};

export const FeatureReportTopLevelDateSelector = ({ filterSpec, setDataUpdatedAt, refetchTrigger, onClickBucket, startDate, endDate }: FeatureReportTopLevelDateSelectorProps) => {
    const [result, { refetch, dataUpdatedAt }] = useQuery(getGeneralFeatureReport, {
        filterSpec,
        startDate,//: roundToNearest15Minutes(startDate),
        endDate,//: roundToNearest15Minutes(endDate),
    });

    React.useEffect(() => {
        refetchTrigger && refetch();
    }, [refetchTrigger]);

    React.useEffect(() => {
        if (dataUpdatedAt) {
            setDataUpdatedAt(new Date(dataUpdatedAt));
        }
    }, [dataUpdatedAt]);

    const chartData = result.data.map((item) => ({
        ...item,
        //fill: selectedBucket === item.bucket ? "#c6c" : "#66c",
        fill: filterSpec.selectedBucket === item.bucket ? "#cc8" : "#484",
    }));

    const handleBucketClick = (data: { bucket: string, count: number }, index: number, e) => {
        onClickBucket(data.bucket);
    };

    return <div>
        <CMSmallButton>{result.metrics.queryTimeMs} ms</CMSmallButton>
        <ComposedChart
            width={800}
            height={600}
            data={chartData}
        >
            <CartesianGrid stroke="#f5f5f5" />
            <XAxis dataKey="bucket" />
            <YAxis />
            <Tooltip />
            <Legend />

            {/* <Bar dataKey="count" barSize={30} fill="#44f" onClick={handleBucketClick} isAnimationActive={true} animationDuration={40} /> */}
            <Bar dataKey="count" barSize={30} onClick={handleBucketClick} isAnimationActive={true} animationDuration={40} />

        </ComposedChart>
    </div>

};
