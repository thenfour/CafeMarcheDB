import { getColorForFeature } from "@/src/core/components/FeatureReportBasics";
import { GeneralFeatureDetailArea } from "@/src/core/components/FeatureReportDrillDownComponents";
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
import getGeneralFeatureReport from "src/core/db3/queries/getGeneralFeatureReport";
import { ActivityFeature } from "src/core/db3/shared/activityTracking";
import { ReportAggregateBy } from "src/core/db3/shared/apiTypes";
import DashboardLayout from "src/core/layouts/DashboardLayout";


// to allow suspense to work right
interface GeneralFeatureStatsReportInnerProps {
    features: ActivityFeature[],
    excludeFeatures: ActivityFeature[],
    selectedBucket: string | null,
    excludeYourself: boolean;
    excludeSysadmins: boolean;
    aggregateBy: ReportAggregateBy,
    startDate: Date,
    endDate: Date,
    onClickBucket: (bucket: string) => void,
    refetchTrigger: number,
    contextBeginsWith: string | undefined,
    setDataUpdatedAt: (date: Date) => void,
};
const GeneralFeatureStatsReportInner = ({ excludeYourself, excludeSysadmins, contextBeginsWith, setDataUpdatedAt, refetchTrigger, onClickBucket, features, excludeFeatures, selectedBucket, aggregateBy,
    startDate, endDate }: GeneralFeatureStatsReportInnerProps) => {
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

const GeneralFeatureStatsReport = () => {
    const [refetchTrigger, setRefetchTrigger] = React.useState(0);
    const now = React.useMemo(() => new Date(), [refetchTrigger]);
    const [features, setFeatures] = React.useState<ActivityFeature[]>([]);
    const [aggregateBy, setAggregateBy] = React.useState<ReportAggregateBy>(ReportAggregateBy.day);
    const [excludeYourself, setExcludeYourself] = React.useState<boolean>(true);
    const [excludeSysadmins, setExcludeSysadmins] = React.useState<boolean>(true);
    const [contextBeginsWith, setContextBeginsWith] = React.useState<string | undefined>();
    const [startDate, setStartDate] = React.useState<Date>(new Date(now.getTime() - 3 * 30 * 24 * 60 * 60 * 1000));
    const [endDate, setEndDate] = React.useState<Date>(new Date(now.getTime() + 24 * 60 * 60 * 1000)); // +1 day

    const [selectedBucket, setSelectedBucket] = React.useState<string | null>(null);

    const [dataUpdatedAt, setDataUpdatedAt] = React.useState<Date>(now);

    const realStartDate = roundToNearest15Minutes(startDate);
    const realEndDate = roundToNearest15Minutes(endDate);

    const onExcludeFeature = (feature: ActivityFeature) => {
        // if you have nothing selected, it's the same as all selected. so handle that differently.
        let newFeatures = features.length === 0 ? Object.values(ActivityFeature) : features;
        newFeatures = newFeatures.filter(x => x !== feature);
        setFeatures(newFeatures);
    };

    const onIsolateFeature = (feature: ActivityFeature) => {
        setFeatures([feature]);
    };

    return <div className="FeatureStatsReport">
        <div className="filterContainer">
            <div style={{ display: "flex", alignItems: "center" }}>
                <Button onClick={() => setRefetchTrigger(x => x + 1)}>Refresh</Button>
                <span className="smallText">
                    last updated: <AgeRelativeToNow value={dataUpdatedAt} />
                </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", marginLeft: "6px" }}>
                <FormControlLabel control={<input type="checkbox" checked={excludeYourself} onChange={(e) => setExcludeYourself(e.target.checked)} />} label="Exclude yourself" />
                <PermissionBoundary permission={Permission.sysadmin}>
                    <FormControlLabel control={<input type="checkbox" checked={excludeSysadmins} onChange={(e) => {
                        setExcludeSysadmins(e.target.checked);
                        if (!e.target.checked) {
                            setExcludeYourself(false);
                        }

                    }} />} label="Exclude sysadmins" />
                </PermissionBoundary>
            </div>
            <NameValuePair name="Feature" value={
                <>
                    <Button onClick={() => setFeatures(Object.values(ActivityFeature))} >All</Button>
                    <Button onClick={() => setFeatures([])} >None</Button>
                    <CMMultiSelect
                        value={features}
                        onChange={setFeatures}
                        getOptions={() => {
                            return Object.values(ActivityFeature);
                        }}
                        getOptionInfo={(item) => {
                            return {
                                id: item.toString(),
                                color: getColorForFeature(item),
                            };
                        }}
                        renderOption={(item) => {
                            return item.toString();
                        }}
                    />

                    <div style={{ display: "flex", alignItems: "center", marginRight: "25px" }}>
                        <CMTextInputBase
                            style={{ fontSize: "15px", margin: "7px", backgroundColor: "white", borderRadius: "4px", padding: "5px", fontFamily: "var(--ff-mono)" }}
                            placeholder="filter context..."
                            onChange={(e, val) => {
                                setContextBeginsWith(IsNullOrWhitespace(val) ? undefined : val);
                            }}
                            value={contextBeginsWith}
                        />
                        <CMSmallButton onClick={() => {
                            // remove last path part of contextBeginsWith
                            if (contextBeginsWith) {
                                const parts = contextBeginsWith.split("/");
                                if (parts.length > 1) {
                                    setContextBeginsWith(parts.slice(0, -1).join("/"));
                                } else {
                                    setContextBeginsWith(undefined);
                                }
                            }
                        }}>
                            <ArrowUpward />
                        </CMSmallButton>
                        <CMSmallButton onClick={() => {
                            setContextBeginsWith(undefined);
                        }}>
                            <Clear />
                        </CMSmallButton>
                    </div>
                </>
            } />

            <NameValuePair name="Timing" value={
                <div>
                    <div style={{ display: "flex", alignItems: "center" }}>

                        <CMDateRangePicker
                            value={{ start: startDate, end: endDate }}
                            onChange={(val) => {
                                if (val) {
                                    setStartDate(val.start);
                                    setEndDate(val.end);
                                }
                            }} />

                        <CMSmallButton
                            onClick={() => {
                                setStartDate(DateAdd(new Date(), { years: -1 }));
                                setEndDate(DateAdd(new Date(), { days: 1 }));
                            }}
                        >
                            Past year
                        </CMSmallButton>

                        <CMSmallButton
                            onClick={() => {
                                setStartDate(DateAdd(new Date(), { months: -6 }));
                                setEndDate(DateAdd(new Date(), { days: 1 }));
                            }}
                        >
                            Past 6 months
                        </CMSmallButton>


                        <CMSmallButton
                            onClick={() => {
                                setStartDate(DateAdd(new Date(), { months: -3 }));
                                setEndDate(DateAdd(new Date(), { days: 1 }));
                            }}
                        >
                            Past 3 months
                        </CMSmallButton>


                        <CMSmallButton
                            onClick={() => {
                                setStartDate(DateAdd(new Date(), { months: -1 }));
                                setEndDate(DateAdd(new Date(), { days: 1 }));
                            }}
                        >
                            Past month
                        </CMSmallButton>

                        <CMSmallButton
                            onClick={() => {
                                setStartDate(DateAdd(new Date(), { days: -14 }));
                                setEndDate(DateAdd(new Date(), { days: 1 }));
                            }}
                        >
                            Past 2 weeks
                        </CMSmallButton>

                    </div>

                    <div style={{ display: "flex", alignItems: "center", fontFamily: "var(--ff-mono)", opacity: 0.7, fontSize: "12px", padding: "5px", marginLeft: "10px" }}>
                        [<AgeRelativeToNow value={startDate} />]
                        <div className="ndash field">&ndash;</div>
                        [<AgeRelativeToNow value={endDate} />]
                        ({formatMillisecondsToDHMS(endDate.getTime() - startDate.getTime())})
                    </div>

                    <CMSingleSelect
                        value={aggregateBy}
                        onChange={(option) => {
                            setAggregateBy(option);
                            setSelectedBucket(null); // buckets don't make sense anymore
                        }}
                        getOptions={() => {
                            return Object.values(ReportAggregateBy);
                        }}
                        getOptionInfo={(item) => {
                            return {
                                id: item.toString(),
                            };
                        }}
                        nullBehavior={CMSelectNullBehavior.NonNullable}
                        renderOption={(item) => {
                            return item.toString();
                        }}
                    />
                </div>
            } />
        </div>

        <React.Suspense>
            <GeneralFeatureStatsReportInner
                features={features}
                excludeFeatures={[]}
                selectedBucket={selectedBucket}
                aggregateBy={aggregateBy}
                excludeYourself={excludeYourself}
                excludeSysadmins={excludeSysadmins}
                startDate={realStartDate}
                endDate={realEndDate}
                onClickBucket={setSelectedBucket}
                refetchTrigger={refetchTrigger}
                contextBeginsWith={contextBeginsWith}
                setDataUpdatedAt={setDataUpdatedAt}
            />
        </React.Suspense>

        <React.Suspense>
            <GeneralFeatureDetailArea
                features={features}
                onExcludeFeature={onExcludeFeature}
                onIsolateFeature={onIsolateFeature}
                onFilterContext={setContextBeginsWith}
                excludeFeatures={[]}
                bucket={selectedBucket}
                aggregateBy={aggregateBy}
                excludeYourself={excludeYourself}
                excludeSysadmins={excludeSysadmins}
                contextBeginsWith={contextBeginsWith}
                refetchTrigger={refetchTrigger}
            />
        </React.Suspense>
    </div >;
};

const MainContent = () => {
    return <GeneralFeatureStatsReport />
};


const FeatureReportsPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Feature reports" basePermission={Permission.sysadmin}>
            <div className="contentSection fullWidth">
                <MainContent />
            </div>
        </DashboardLayout>
    )
}

export default FeatureReportsPage;
