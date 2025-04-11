import { BlitzPage } from "@blitzjs/next";
import { useQuery } from "@blitzjs/rpc";
import { Button, FormControlLabel, Tooltip as MuiTooltip } from "@mui/material";
import * as React from 'react';
import Identicon from 'react-identicons';
import { Bar, CartesianGrid, ComposedChart, Legend, Pie, PieChart, Tooltip, XAxis, YAxis } from "recharts";
import { toSorted } from "shared/arrayUtils";
import { gLightSwatchColors } from "shared/color";
import { Permission } from "shared/permissions";
import { CalcRelativeTimingFromNow, DateAdd, formatMillisecondsToDHMS, roundToNearest15Minutes } from "shared/time";
import { getHashedColor, smartTruncate } from "shared/utils";
import { EventChip, FileChip, SongChip, WikiPageChip } from "src/core/components/CMCoreComponents";
import { CMSmallButton, NameValuePair } from "src/core/components/CMCoreComponents2";
import { CMMultiSelect, CMSingleSelect } from "src/core/components/CMSelect";
import { CMSelectNullBehavior } from "src/core/components/CMSingleSelectDialog";
import { CMDateRangePicker } from "src/core/components/DateTimeRangeControl";
import { AgeRelativeToNow } from "src/core/components/RelativeTimeComponents";
import { CMTab, CMTabPanel, CMTabPanelChild } from "src/core/components/TabPanel";
import { gIconMap } from "src/core/db3/components/IconMap";
import getGeneralFeatureDetail from "src/core/db3/queries/getGeneralFeatureDetail";
import getGeneralFeatureReport from "src/core/db3/queries/getGeneralFeatureReport";
import { ActivityFeature } from "src/core/db3/shared/activityTracking";
import { GeneralActivityReportDetailPayload, ReportAggregateBy } from "src/core/db3/shared/apiTypes";
import DashboardLayout from "src/core/layouts/DashboardLayout";

const getColorForFeature = (feature: ActivityFeature): string | null => {
    const featureColorMap: Record<ActivityFeature, string> = {
        [ActivityFeature.global_ical_digest]: gLightSwatchColors.light_blue,
        [ActivityFeature.event_ical_digest]: gLightSwatchColors.light_blue,

        [ActivityFeature.wiki_page_view]: gLightSwatchColors.light_pink,
        [ActivityFeature.song_view]: gLightSwatchColors.light_pink,
        [ActivityFeature.event_view]: gLightSwatchColors.light_pink,

        [ActivityFeature.file_download]: gLightSwatchColors.light_purple,

        [ActivityFeature.metronome_persistent]: gLightSwatchColors.light_gold,

        [ActivityFeature.main_search_link_click]: gLightSwatchColors.light_green,
        [ActivityFeature.song_search_link_click]: gLightSwatchColors.light_green,
        [ActivityFeature.event_search_link_click]: gLightSwatchColors.light_green,
        [ActivityFeature.relevant_event_link_click]: gLightSwatchColors.light_green,
        [ActivityFeature.big_calendar_event_link_click]: gLightSwatchColors.light_green,
        [ActivityFeature.setlist_song_link_click]: gLightSwatchColors.light_green,
        [ActivityFeature.dashboard_menu_link_click]: gLightSwatchColors.light_green,
        [ActivityFeature.general_link_click]: gLightSwatchColors.light_green,
    };

    return featureColorMap[feature] || null;
}

const AnonymizedUserChip = ({ value, size = 25 }: { value: string, size?: number }) => {
    return <MuiTooltip title={value.substring(0, 6)} disableInteractive><div><Identicon string={value} size={size} /></div></MuiTooltip>;
}

interface FeatureLabelProps {
    feature: ActivityFeature;
    onClickIsolate: () => void;
    onClickExclude: () => void;
}

const FeatureLabel = (props: FeatureLabelProps) => {
    const featureColor = getHashedColor(props.feature);

    return <>
        <div
            style={{ display: "flex", alignItems: "center" }}
        >
            <span style={{ color: featureColor }}>{props.feature}</span>
            <span className="flex-spacer"></span>
            <span>
                <MuiTooltip title={`Isolate ${props.feature}`} disableInteractive>
                    <span>
                        <CMSmallButton onClick={props.onClickIsolate}>isol</CMSmallButton>
                    </span>
                </MuiTooltip>
                <MuiTooltip title={`Hide / exclude ${props.feature}`} disableInteractive>
                    <span>
                        <CMSmallButton onClick={props.onClickExclude}>hide</CMSmallButton>
                    </span>
                </MuiTooltip>
            </span>
        </div>
    </>;
};

interface ContextLabelProps {
    value: string;
};

const ContextLabel = (props: ContextLabelProps) => {
    const parts = props.value.split("/").filter(x => x.length > 0);
    return <span className="contextLabelContainer">{
        parts.map((part, index) => {
            const color = getHashedColor(part);
            const bgcolor = getHashedColor(part, { alpha: "0.1" });
            return <><span key={index} className="contextLabelPart" style={{ color, backgroundColor: bgcolor }}>
                {part}
            </span>
                {index < parts.length - 1 && <span className="contextLabelSeparator">/</span>}
            </>;
        })
    }</span>;
};

interface GeneralFeatureReportDetailItemProps {
    value: GeneralActivityReportDetailPayload;
    index: number;
    onIsolateFeature: (feature: ActivityFeature) => void;
    onExcludeFeature: (feature: ActivityFeature) => void;
};

const GeneralFeatureReportDetailItem = ({ value, index, ...props }: GeneralFeatureReportDetailItemProps) => {
    const feature = value.feature as ActivityFeature;

    return <tr className="GeneralFeatureReportDetailItemRow">
        <td style={{ fontFamily: "var(--ff-mono)" }}>#{index}</td>
        <td>
            <MuiTooltip title={<AgeRelativeToNow value={value.createdAt} />} disableInteractive>
                <span>{value.createdAt.toLocaleString()}</span>
            </MuiTooltip>
        </td>
        <td>{value.userHash && <AnonymizedUserChip value={value.userHash} />}</td>
        <td>{value.context && <ContextLabel value={value.context} />}</td>
        <td><FeatureLabel feature={feature} onClickExclude={() => props.onExcludeFeature(feature)} onClickIsolate={() => props.onIsolateFeature(feature)} /></td>
        <td style={{ whiteSpace: "nowrap" }}>
            {value.queryText && <span className="queryText">"<span className="actualQueryText">{value.queryText}</span>"</span>}
        </td>
        <td>
            {value.song && <SongChip value={value.song} startAdornment={gIconMap.MusicNote()} useHashedColor={true} />}
            {value.event && <EventChip value={value.event} startAdornment={gIconMap.CalendarMonth()} useHashedColor={true} />}
            {value.file && <FileChip value={value.file} startAdornment={gIconMap.AttachFile()} useHashedColor={true} />}
            {value.wikiPage && <WikiPageChip slug={value.wikiPage.slug} startAdornment={gIconMap.Article()} useHashedColor={true} />}
        </td>
        <td>{value.uri && <a href={value.uri} target="_blank" rel="noreferrer" >{smartTruncate(value.uri, 60)}</a>}</td>
    </tr>;
};

interface GeneralFeatureDetailTableProps {
    data: GeneralActivityReportDetailPayload[];
    onIsolateFeature: (feature: ActivityFeature) => void;
    onExcludeFeature: (feature: ActivityFeature) => void;
};

const GeneralFeatureDetailTable = ({ data, ...props }: GeneralFeatureDetailTableProps) => {
    return <table>
        <thead>
            <tr>
                <th>#</th>
                <th>When</th>
                <th>User</th>
                <th>Context</th>
                <th>Feature</th>
                <th>Query</th>
                <th></th>
                <th>URI</th>
            </tr>
        </thead>
        <tbody>
            {data.map((item, index) => {
                return <GeneralFeatureReportDetailItem key={index} value={item} index={data.length - index} onExcludeFeature={props.onExcludeFeature} onIsolateFeature={props.onIsolateFeature} />;
            })}
        </tbody>
    </table>;
}


type DetailTabId = "general" | "features" | "users" | "songs" | "events" | "wikiPages" | "files";

type ContextObjectDistinctItem = {
    key: string,
    headingIndicator: React.ReactNode;
    itemCount: number;
    totalCount: number;
    percentageOfTotal: string;
    items: GeneralActivityReportDetailPayload[];
};

function getContextObjectTabData(
    items: GeneralActivityReportDetailPayload[] | null | undefined,
    getKey: (item: GeneralActivityReportDetailPayload) => string,
    getHeadingIndicator: (item: GeneralActivityReportDetailPayload) => React.ReactNode,
): ContextObjectDistinctItem[] {
    if (!items) {
        //console.log(`no items; short circuit`);
        return [];
    }
    const distinctItems = [...new Set(items.map(getKey))];
    const itemCount = items.length;
    const contextObjects = distinctItems.map((distinctItem) => {
        const filteredItems = items.filter((item) => getKey(item) === distinctItem);
        return {
            key: distinctItem,
            headingIndicator: getHeadingIndicator(filteredItems[0]!),
            itemCount: filteredItems.length,
            totalCount: itemCount,
            percentageOfTotal: `${(filteredItems.length * 100 / itemCount).toFixed()}%`,
            items: filteredItems,
        };
    });
    return toSorted(contextObjects, (a, b) => b.itemCount - a.itemCount);
}

const DistinctContextObjectPieChart = ({ item }: { item: ContextObjectDistinctItem }) => {
    const chartData = [
        { fill: "#66f", value: item.itemCount },
        { fill: "#f8f8f8", value: item.totalCount - item.itemCount },
    ];
    return <PieChart width={60} height={60} data={chartData}>
        <Pie dataKey="value" data={chartData} cx="50%" cy="50%" innerRadius={7} outerRadius={25} isAnimationActive={false} />
    </PieChart>;
};

type ContextObjectTabData = {
    id: DetailTabId,
    tabHeader: React.ReactNode,
    items: ContextObjectDistinctItem[],
    onIsolateFeature: (feature: ActivityFeature) => void;
    onExcludeFeature: (feature: ActivityFeature) => void;
};

const DistinctContextObjectTabContent = ({ item }: { item: ContextObjectTabData }) => {
    return item.items.length > 1 && <div>
        {item.items.map((contextObject) => {
            return <div key={contextObject.key}>
                <div style={{ display: "flex", fontWeight: "bold", alignItems: "center" }}>
                    <DistinctContextObjectPieChart item={contextObject} />
                    {contextObject.headingIndicator} ({contextObject.itemCount} items) ({contextObject.percentageOfTotal} of total)
                </div>
                <GeneralFeatureDetailTable data={contextObject.items} onExcludeFeature={item.onExcludeFeature} onIsolateFeature={item.onIsolateFeature} />
            </div>;
        })}
    </div>;
};


interface GeneralFeatureDetailAreaProps {
    features: ActivityFeature[];
    excludeFeatures: ActivityFeature[];
    bucket: string | null;
    aggregateBy: ReportAggregateBy;
    excludeYourself: boolean;
    //filteredSongId: number | undefined;
    //filteredEventId: number | undefined;
    //filteredUserId: number | undefined;
    //filteredWikiPageId: number | undefined;
    refetchTrigger: number;
    onIsolateFeature: (feature: ActivityFeature) => void;
    onExcludeFeature: (feature: ActivityFeature) => void;
};

const GeneralFeatureDetailArea = ({ excludeYourself, features, excludeFeatures, bucket, aggregateBy, refetchTrigger, onIsolateFeature, onExcludeFeature }: GeneralFeatureDetailAreaProps) => {

    const [tabId, setTabId] = React.useState<DetailTabId>("general");

    const [detail, { refetch }] = useQuery(getGeneralFeatureDetail, {
        features,
        excludeFeatures,
        bucket,
        aggregateBy,
        //filteredSongId,
        excludeYourself,
        //filteredEventId,
        //filteredUserId,
        //filteredWikiPageId,
    });

    React.useEffect(() => {
        refetchTrigger && refetch();
    }, [refetchTrigger]);

    const tabs: ContextObjectTabData[] = React.useMemo(() => {
        const ret: ContextObjectTabData[] = [];

        const byFeature = getContextObjectTabData(
            detail?.data,
            (item) => item.feature,
            (item) => item.feature,
        );
        if (byFeature.length) {
            ret.push({
                id: "features",
                tabHeader: `Features (${byFeature.length})`,
                items: byFeature,
                onIsolateFeature,
                onExcludeFeature,
            });
        }

        const byUser = getContextObjectTabData(
            detail?.data.filter(x => !!x.userHash),
            (item) => item.userHash!,
            (item) => <AnonymizedUserChip value={item.userHash!} size={50} />,
        );
        if (byUser.length) {
            ret.push({
                id: "users",
                tabHeader: `Users (${byUser.length})`,
                items: byUser,
                onIsolateFeature,
                onExcludeFeature,
            });
        }
        const bySong = getContextObjectTabData(
            detail?.data.filter(x => !!x.song),
            (item) => item.song!.id.toString(),
            (item) => <SongChip value={item.song!} startAdornment={gIconMap.MusicNote()} useHashedColor={true} />,
        );
        if (bySong.length) {
            ret.push({
                id: "songs",
                tabHeader: `Songs (${bySong.length})`,
                items: bySong,
                onIsolateFeature,
                onExcludeFeature,
            });
        }
        const byEvent = getContextObjectTabData(
            detail?.data.filter(x => !!x.event),
            (item) => item.event!.id.toString(),
            (item) => <EventChip value={item.event!} startAdornment={gIconMap.CalendarMonth()} useHashedColor={true} />,
        );
        if (byEvent.length) {
            ret.push({
                id: "events",
                tabHeader: `Events (${byEvent.length})`,
                items: byEvent,
                onIsolateFeature,
                onExcludeFeature,
            });
        }
        const byWikiPage = getContextObjectTabData(
            detail?.data.filter(x => !!x.wikiPage),
            (item) => item.wikiPage!.id.toString(),
            (item) => <WikiPageChip slug={item.wikiPage!.slug} startAdornment={gIconMap.Article()} useHashedColor={true} />,
        );
        if (byWikiPage.length) {
            ret.push({
                id: "wikiPages",
                tabHeader: `Wiki pages (${byWikiPage.length})`,
                items: byWikiPage,
                onIsolateFeature,
                onExcludeFeature,
            });
        }
        const byFile = getContextObjectTabData(
            detail?.data.filter(x => !!x.file),
            (item) => item.file!.id.toString(),
            (item) => <FileChip value={item.file!} startAdornment={gIconMap.AttachFile()} useHashedColor={true} />,
        );
        if (byFile.length) {
            ret.push({
                id: "files",
                tabHeader: `Files (${byFile.length})`,
                items: byFile,
                onIsolateFeature,
                onExcludeFeature,
            });
        }

        return ret;

    }, [detail]);

    const renderedTabs: CMTabPanelChild[] = [
        <CMTab key={9999} thisTabId="general" summaryTitle={`General (${detail?.data.length})`} >
            <GeneralFeatureDetailTable data={detail?.data || []} onExcludeFeature={onExcludeFeature} onIsolateFeature={onIsolateFeature} />
        </CMTab>,
        ...tabs.map((tab) => <CMTab key={tab.id} thisTabId={tab.id} summaryTitle={tab.tabHeader} enabled={tab.items.length > 1} >
            <DistinctContextObjectTabContent key={tab.id} item={tab} />
        </CMTab>),
    ];

    return <div>
        <CMTabPanel handleTabChange={(e, newTabId: DetailTabId) => setTabId(newTabId)} selectedTabId={tabId} >
            {renderedTabs}
        </CMTabPanel>
    </div>;
};

// to allow suspense to work right
interface GeneralFeatureStatsReportInnerProps {
    features: ActivityFeature[],
    excludeFeatures: ActivityFeature[],
    selectedBucket: string | null,
    excludeYourself: boolean;
    aggregateBy: ReportAggregateBy,
    startDate: Date,
    endDate: Date,
    onClickBucket: (bucket: string) => void,
    refetchTrigger: number,
    setDataUpdatedAt: (date: Date) => void,
};
const GeneralFeatureStatsReportInner = ({ excludeYourself, setDataUpdatedAt, refetchTrigger, onClickBucket, features, excludeFeatures, selectedBucket, aggregateBy,
    startDate, endDate }: GeneralFeatureStatsReportInnerProps) => {
    const [result, { refetch, dataUpdatedAt }] = useQuery(getGeneralFeatureReport, {
        features,
        excludeFeatures,
        excludeYourself,
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
    const now = React.useMemo(() => new Date(), []);
    const [features, setFeatures] = React.useState<ActivityFeature[]>([]);
    const [aggregateBy, setAggregateBy] = React.useState<ReportAggregateBy>(ReportAggregateBy.day);
    const [excludeYourself, setExcludeYourself] = React.useState<boolean>(true);
    const [startDate, setStartDate] = React.useState<Date>(new Date(now.getTime() - 3 * 30 * 24 * 60 * 60 * 1000));
    const [endDate, setEndDate] = React.useState<Date>(new Date(now.getTime() + 24 * 60 * 60 * 1000)); // +1 day

    const [selectedBucket, setSelectedBucket] = React.useState<string | null>(null);
    const [refetchTrigger, setRefetchTrigger] = React.useState(0);

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
                    <FormControlLabel control={<input type="checkbox" checked={excludeYourself} onChange={(e) => setExcludeYourself(e.target.checked)} />} label="Exclude yourself" />
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
                startDate={realStartDate}
                endDate={realEndDate}
                onClickBucket={setSelectedBucket}
                refetchTrigger={refetchTrigger}
                setDataUpdatedAt={setDataUpdatedAt}
            />
        </React.Suspense>

        <React.Suspense>
            <GeneralFeatureDetailArea
                features={features}
                onExcludeFeature={onExcludeFeature}
                onIsolateFeature={onIsolateFeature}
                excludeFeatures={[]}
                bucket={selectedBucket}
                aggregateBy={aggregateBy}
                excludeYourself={excludeYourself}
                refetchTrigger={refetchTrigger}
            />
        </React.Suspense>
    </div>;
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
