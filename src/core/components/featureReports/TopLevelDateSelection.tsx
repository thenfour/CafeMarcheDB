import { getColorForFeature } from "@/src/core/components/featureReports/FeatureReportBasics";
import { GeneralFeatureDetailArea } from "@/src/core/components/featureReports/FeatureReportDrillDownComponents";
import { ActivityReportTimeBucketSize } from "@/src/core/components/featureReports/activityReportTypes";
import { BlitzPage } from "@blitzjs/next";
import { useQuery } from "@blitzjs/rpc";
import { ArrowUpward, Clear } from "@mui/icons-material";
import { Button, FormControlLabel } from "@mui/material";
import * as React from 'react';
import { Bar, CartesianGrid, ComposedChart, Legend, Tooltip, XAxis, YAxis } from "recharts";
import { Permission } from "shared/permissions";
import { DateAdd, formatMillisecondsToDHMS, roundToNearest15Minutes } from "shared/time";
import { IsNullOrWhitespace } from "shared/utils";
import { PermissionBoundary } from "src/core/components/CMCoreComponents";
import { CMSmallButton, NameValuePair } from "src/core/components/CMCoreComponents2";
import { CMMultiSelect, CMSingleSelect } from "src/core/components/CMSelect";
import { CMSelectNullBehavior } from "src/core/components/CMSingleSelectDialog";
import { CMTextInputBase } from "src/core/components/CMTextField";
import { CMDateRangePicker } from "src/core/components/DateTimeRangeControl";
import { AgeRelativeToNow } from "src/core/components/RelativeTimeComponents";
//import getGeneralFeatureDetail from "src/core/db3/queries/getGeneralFeatureDetail";
import getGeneralFeatureReport from "@/src/core/components/featureReports/queries/getGeneralFeatureReport";
import { ActivityFeature } from "@/src/core/components/featureReports/activityTracking";
import DashboardLayout from "src/core/layouts/DashboardLayout";

// date selection, bucket size
// and other filters


// to allow suspense to work right
interface FeatureReportTopLevelDateSelectorProps {
    features: ActivityFeature[],
    excludeFeatures: ActivityFeature[],
    selectedBucket: string | null,
    excludeYourself: boolean;
    excludeSysadmins: boolean;
    aggregateBy: ActivityReportTimeBucketSize,
    startDate: Date,
    endDate: Date,
    onClickBucket: (bucket: string) => void,
    refetchTrigger: number,
    contextBeginsWith: string | undefined,
    setDataUpdatedAt: (date: Date) => void,
};

export const FeatureReportTopLevelDateSelector = ({ excludeYourself, excludeSysadmins, contextBeginsWith, setDataUpdatedAt, refetchTrigger, onClickBucket, features, excludeFeatures, selectedBucket, aggregateBy,
    startDate, endDate }: FeatureReportTopLevelDateSelectorProps) => {
    const [result, { refetch, dataUpdatedAt }] = useQuery(getGeneralFeatureReport, {
        features,
        excludeFeatures,
        excludeYourself,
        excludeSysadmins,
        contextBeginsWith,
        startDate,//: roundToNearest15Minutes(startDate),
        endDate,//: roundToNearest15Minutes(endDate),
        aggregateBy,
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
        fill: selectedBucket === item.bucket ? "#cc8" : "#484",
    }));

    const handleBucketClick = (data: { bucket: string, count: number }, index: number, e) => {
        onClickBucket(data.bucket);
    };

    return <ComposedChart
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


};
