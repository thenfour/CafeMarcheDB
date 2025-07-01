import { ActivityReportTimeBucketSize } from "@/shared/mysqlUtils";
import { gClientFacetHandlers } from "@/src/core/components/featureReports/ClientFacetHandlers";
import { FacetedBreakdown } from "@/src/core/components/featureReports/FacetedBreakdown";
import { getColorForFeature } from "@/src/core/components/featureReports/FeatureReportBasics";
import { FeatureReportTopLevelDateSelector } from "@/src/core/components/featureReports/TopLevelDateSelection";
import { ActivityFeature } from "@/src/core/components/featureReports/activityTracking";
import { FeatureReportFilterSpec } from "@/src/core/components/featureReports/server/facetProcessor";
import { BlitzPage } from "@blitzjs/next";
import { ArrowUpward, Clear } from "@mui/icons-material";
import { Button, FormControlLabel } from "@mui/material";
import * as React from 'react';
import { Permission } from "shared/permissions";
import { DateAdd, formatMillisecondsToDHMS, roundToNearest15Minutes } from "shared/time";
import { IsNullOrWhitespace } from "shared/utils";
import { PermissionBoundary } from "src/core/components/CMCoreComponents";
import { AdminInspectObject, CMSmallButton, NameValuePair } from "src/core/components/CMCoreComponents2";
import { CMMultiSelect, CMSingleSelect } from "src/core/components/select/CMSelect";
import { CMSelectNullBehavior } from "src/core/components/select/CMSingleSelectDialog";
import { CMTextInputBase } from "src/core/components/CMTextField";
import { AgeRelativeToNow } from "@/src/core/components/DateTime/RelativeTimeComponents";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { CMDateRangePicker } from "@/src/core/components/DateTime/DateTimeRangeControl";

const GeneralFeatureStatsReport = () => {
    const [refetchTrigger, setRefetchTrigger] = React.useState(0);
    const now = React.useMemo(() => new Date(), [refetchTrigger]);
    const [startDate, setStartDate] = React.useState<Date>(new Date(now.getTime() - 3 * 30 * 24 * 60 * 60 * 1000));
    const [endDate, setEndDate] = React.useState<Date>(new Date(now.getTime() + 24 * 60 * 60 * 1000)); // +1 day

    const [filterSpec, setFilterSpec] = React.useState<FeatureReportFilterSpec>({
        selectedBucket: null,
        bucketSize: ActivityReportTimeBucketSize.day,
        excludeYourself: true,
        excludeSysadmins: true,
        contextBeginsWith: undefined,
        includeFeatures: [],
        excludeFeatures: [],
        includeOperatingSystems: [],
        includePointerTypes: [],
        includeBrowserNames: [],
        includeDeviceClasses: [],
        includeTimezones: [],
        includeLanguages: [],
        includeLocales: [],
        includeCustomLinkIds: [],
        includeEventIds: [],
        includeMenuLinkIds: [],
        includeSongIds: [],
        includeWikiPageIds: [],
        excludeOperatingSystems: [],
        excludePointerTypes: [],
        excludeBrowserNames: [],
        excludeDeviceClasses: [],
        excludeTimezones: [],
        excludeLanguages: [],
        excludeLocales: [],
        excludeCustomLinkIds: [],
        excludeEventIds: [],
        excludeMenuLinkIds: [],
        excludeSongIds: [],
        excludeWikiPageIds: [],
    });

    const [dataUpdatedAt, setDataUpdatedAt] = React.useState<Date>(now);

    const realStartDate = roundToNearest15Minutes(startDate);
    const realEndDate = roundToNearest15Minutes(endDate);

    const additionalFilters = Object.entries(gClientFacetHandlers).map(([key, handler]) => {
        const x = handler.renderFilter({ filterSpec, setFilterSpec, handler: handler as any });
        if (!x) return null;
        return <React.Fragment key={key}>{x}</React.Fragment>;
    }).filter(x => x !== null);

    return <div className="FeatureStatsReport">
        <div className="filterContainer">
            <div style={{ display: "flex", alignItems: "center" }}>
                <Button onClick={() => setRefetchTrigger(x => x + 1)}>Refresh</Button>
                <span className="smallText">
                    last updated: <AgeRelativeToNow value={dataUpdatedAt} />
                </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", marginLeft: "6px" }}>
                <FormControlLabel
                    control={
                        <input
                            type="checkbox"
                            checked={filterSpec.excludeYourself}
                            onChange={(e) => {
                                if (e.target.checked) {
                                    setFilterSpec((x) => ({ ...x, excludeYourself: true }));
                                }
                                else {
                                    setFilterSpec((x) => ({ ...x, excludeYourself: false, excludeSysadmins: false }));
                                }
                            }}
                        />}
                    label="Exclude yourself"
                />
                <PermissionBoundary permission={Permission.sysadmin}>
                    <FormControlLabel control={<input type="checkbox" checked={filterSpec.excludeSysadmins} onChange={(e) => {
                        if (e.target.checked) {
                            setFilterSpec((x) => ({ ...x, excludeSysadmins: true }));
                        }
                        else {
                            setFilterSpec((x) => ({ ...x, excludeSysadmins: false, excludeYourself: false }));
                        }
                    }} />} label="Exclude sysadmins" />
                </PermissionBoundary>
            </div>
            <NameValuePair name="Feature" value={
                <>
                    <Button onClick={() => {
                        //setFeatures(Object.values(ActivityFeature))
                        setFilterSpec((x) => ({ ...x, includeFeatures: Object.values(ActivityFeature) }));
                    }} >All</Button>
                    <Button onClick={() => setFilterSpec((x) => ({ ...x, includeFeatures: [] }))} >None</Button>
                    <CMMultiSelect
                        value={filterSpec.includeFeatures}
                        onChange={(checkedItems) => {
                            setFilterSpec((x) => ({ ...x, includeFeatures: checkedItems as ActivityFeature[] }));
                        }}
                        getOptions={() => {
                            return Object.values(ActivityFeature);
                        }}
                        getOptionInfo={(item) => {
                            return {
                                id: item.toString(),
                                color: getColorForFeature(item).id,
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
                                //setContextBeginsWith(IsNullOrWhitespace(val) ? undefined : val);
                                if (IsNullOrWhitespace(val)) {
                                    setFilterSpec((x) => ({ ...x, contextBeginsWith: undefined }));
                                } else {
                                    setFilterSpec((x) => ({ ...x, contextBeginsWith: val }));
                                }
                            }}
                            value={filterSpec.contextBeginsWith || ""}
                        />
                        <CMSmallButton onClick={() => {
                            // remove last path part of contextBeginsWith
                            // if (contextBeginsWith) {
                            //     const parts = contextBeginsWith.split("/");
                            //     if (parts.length > 1) {
                            //         setContextBeginsWith(parts.slice(0, -1).join("/"));
                            //     } else {
                            //         setContextBeginsWith(undefined);
                            //     }
                            // }
                            if (filterSpec.contextBeginsWith) {
                                const parts = filterSpec.contextBeginsWith.split("/");
                                if (parts.length > 1) {
                                    setFilterSpec((x) => ({ ...x, contextBeginsWith: parts.slice(0, -1).join("/") }));
                                } else {
                                    setFilterSpec((x) => ({ ...x, contextBeginsWith: undefined }));
                                }
                            }
                        }}>
                            <ArrowUpward />
                        </CMSmallButton>
                        <CMSmallButton onClick={() => {
                            //setContextBeginsWith(undefined);
                            setFilterSpec((x) => ({ ...x, contextBeginsWith: undefined }));
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
                        value={filterSpec.bucketSize}
                        onChange={(option) => {
                            //setAggregateBy(option);
                            //setSelectedBucket(null); // buckets don't make sense anymore
                            setFilterSpec((x) => ({ ...x, bucketSize: option, selectedBucket: null }));
                        }}
                        getOptions={() => {
                            return Object.values(ActivityReportTimeBucketSize);
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

            <AdminInspectObject src={additionalFilters} label="additionalFilters" />

            {additionalFilters.length > 0 && <NameValuePair name="Additional filters"
                value={
                    <div>{additionalFilters}
                    </div>
                } />
            }
        </div>

        <React.Suspense>
            <FeatureReportTopLevelDateSelector
                filterSpec={filterSpec}
                startDate={realStartDate}
                endDate={realEndDate}
                onClickBucket={(bucket) => {
                    setFilterSpec((x) => ({ ...x, selectedBucket: bucket }));
                }}
                refetchTrigger={refetchTrigger}
                setDataUpdatedAt={setDataUpdatedAt}
            />
        </React.Suspense>


        <React.Suspense>
            <FacetedBreakdown
                filterSpec={filterSpec}
                setFilterSpec={setFilterSpec}
                refetchTrigger={refetchTrigger}
            />
        </React.Suspense>
    </div >;
};

const FeatureReportsPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Feature reports" basePermission={Permission.sysadmin}>
            <div className="contentSection fullWidth">
                <GeneralFeatureStatsReport />
            </div>
        </DashboardLayout>
    )
}

export default FeatureReportsPage;
