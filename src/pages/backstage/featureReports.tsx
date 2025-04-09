import { BlitzPage } from "@blitzjs/next";
import { useQuery } from "@blitzjs/rpc";
import { Accordion, AccordionDetails, AccordionSummary, Button, FormControlLabel, Tooltip as MuiTooltip } from "@mui/material";
import * as React from 'react';
import Identicon from 'react-identicons';
import { Bar, CartesianGrid, ComposedChart, Legend, Pie, PieChart, Tooltip, XAxis, YAxis } from "recharts";
import { toSorted } from "shared/arrayUtils";
import { Permission } from "shared/permissions";
import { QuickSearchItemMatch, QuickSearchItemType } from "shared/quickFilter";
import { DateAdd, roundToNearest15Minutes } from "shared/time";
import { getHashedColor, smartTruncate } from "shared/utils";
import { EventChip, FileChip, SongChip, WikiPageChip } from "src/core/components/CMCoreComponents";
import { CMSmallButton, NameValuePair } from "src/core/components/CMCoreComponents2";
import { CMMultiSelect, CMSingleSelect } from "src/core/components/CMSelect";
import { CMSelectNullBehavior } from "src/core/components/CMSingleSelectDialog";
import { CMDateRangePicker } from "src/core/components/DateTimeRangeControl";
import { AgeRelativeToNow } from "src/core/components/RelativeTimeComponents";
import { AssociationSelect } from "src/core/components/setlistPlan/ItemAssociation";
import { CMTab, CMTabPanel, CMTabPanelChild } from "src/core/components/TabPanel";
import { gIconMap } from "src/core/db3/components/IconMap";
import getGeneralFeatureDetail from "src/core/db3/queries/getGeneralFeatureDetail";
import getGeneralFeatureReport from "src/core/db3/queries/getGeneralFeatureReport";
import { ActivityFeature } from "src/core/db3/shared/activityTracking";
import { GeneralActivityReportDetailPayload, ReportAggregateBy } from "src/core/db3/shared/apiTypes";
import DashboardLayout from "src/core/layouts/DashboardLayout";

enum TabId {
    general = "general",
    featureUsageByUser = "featureUsageByUser",
};

const AnonymizedUserChip = ({ value, size = 25 }: { value: string, size?: number }) => {
    return <MuiTooltip title={value.substring(0, 6)} disableInteractive><div><Identicon string={value} size={size} /></div></MuiTooltip>;
}

const GeneralFeatureReportDetailItem = ({ value, index }: { value: GeneralActivityReportDetailPayload, index: number }) => {

    const featureColor = getHashedColor(value.feature);

    return <tr>
        <td style={{ fontFamily: "var(--ff-mono)" }}>#{index}</td>
        <td style={{ color: featureColor }}>{value.feature}</td>
        <td>{value.createdAt.toLocaleString()}</td>
        <td>{value.uri && <a href={value.uri} target="_blank" rel="noreferrer" >{smartTruncate(value.uri, 60)}</a>}</td>
        <td>{value.userHash && <AnonymizedUserChip value={value.userHash} />}</td>
        <td>
            {value.song && <SongChip value={value.song} startAdornment={gIconMap.MusicNote()} useHashedColor={true} />}
            {value.event && <EventChip value={value.event} startAdornment={gIconMap.CalendarMonth()} useHashedColor={true} />}
            {value.file && <FileChip value={value.file} startAdornment={gIconMap.AttachFile()} useHashedColor={true} />}
            {value.wikiPage && <WikiPageChip slug={value.wikiPage.slug} startAdornment={gIconMap.Article()} useHashedColor={true} />}
        </td>
    </tr>;
};



const GeneralFeatureDetailTable = ({ data }: { data: GeneralActivityReportDetailPayload[] }) => {
    return <table>
        <thead>
            <tr>
                <th>#</th>
                <th>Feature</th>
                <th>When</th>
                <th>URI</th>
                <th>User</th>
                <th>...</th>
            </tr>
        </thead>
        <tbody>
            {data.map((item, index) => {
                return <GeneralFeatureReportDetailItem key={index} value={item} index={data.length - index} />;
            })}
        </tbody>
    </table>;
}


interface GeneralFeatureDetailAreaProps {
    features: ActivityFeature[];
    bucket: string | null;
    aggregateBy: ReportAggregateBy;
    excludeYourself: boolean;
    filteredSongId: number | undefined;
    filteredEventId: number | undefined;
    filteredUserId: number | undefined;
    filteredWikiPageId: number | undefined;
    refetchTrigger: number;
};

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

type ContextObjectTabData = {
    id: DetailTabId,
    tabHeader: React.ReactNode,
    items: ContextObjectDistinctItem[],
};

const DistinctContextObjectPieChart = ({ item }: { item: ContextObjectDistinctItem }) => {
    const chartData = [
        { fill: "#66f", value: item.itemCount },
        { fill: "#f8f8f8", value: item.totalCount - item.itemCount },
    ];
    return <PieChart width={60} height={60} data={chartData}>
        <Pie dataKey="value" data={chartData} cx="50%" cy="50%" innerRadius={7} outerRadius={25} isAnimationActive={false} />
    </PieChart>;
};

const DistinctContextObjectTabContent = ({ item }: { item: ContextObjectTabData }) => {
    return item.items.length > 1 && <div>
        {item.items.map((contextObject) => {
            return <div key={contextObject.key}>
                <div style={{ display: "flex", fontWeight: "bold", alignItems: "center" }}>
                    <DistinctContextObjectPieChart item={contextObject} />
                    {contextObject.headingIndicator} ({contextObject.itemCount} items) ({contextObject.percentageOfTotal} of total)
                </div>
                <GeneralFeatureDetailTable data={contextObject.items} />
            </div>;
        })}
    </div>;
};

const GeneralFeatureDetailArea = ({ excludeYourself, features, bucket, aggregateBy, filteredEventId, filteredSongId, filteredUserId, filteredWikiPageId, refetchTrigger }: GeneralFeatureDetailAreaProps) => {

    const [tabId, setTabId] = React.useState<DetailTabId>("general");

    const [detail, { refetch }] = useQuery(getGeneralFeatureDetail, {
        features,
        bucket,
        aggregateBy,
        filteredSongId,
        excludeYourself,
        filteredEventId,
        filteredUserId,
        filteredWikiPageId,
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
            });
        }

        return ret;

    }, [detail]);

    const renderedTabs: CMTabPanelChild[] = [
        <CMTab key={9999} thisTabId="general" summaryTitle={`General (${detail?.data.length})`} >
            <GeneralFeatureDetailTable data={detail?.data || []} />
        </CMTab>,
        ...tabs.map((tab) => <CMTab key={tab.id} thisTabId={tab.id} summaryTitle={tab.tabHeader} enabled={tab.items.length > 1} >
            <DistinctContextObjectTabContent key={tab.id} item={tab} />
        </CMTab>),
    ];

    console.log(`renderedTabs: `, renderedTabs);

    return <div>
        <CMTabPanel handleTabChange={(e, newTabId: DetailTabId) => setTabId(newTabId)} selectedTabId={tabId} >
            {renderedTabs}
        </CMTabPanel>
    </div>;
};

// to allow suspense to work right
interface GeneralFeatureStatsReportInnerProps {
    features: ActivityFeature[],
    selectedBucket: string | null,
    excludeYourself: boolean;
    aggregateBy: ReportAggregateBy,
    filteredSongId: number | undefined,
    filteredEventId: number | undefined,
    filteredUserId: number | undefined,
    filteredWikiPageId: number | undefined,
    startDate: Date,
    endDate: Date,
    onClickBucket: (bucket: string) => void,
    refetchTrigger: number,
    setDataUpdatedAt: (date: Date) => void,
};
const GeneralFeatureStatsReportInner = ({ excludeYourself, setDataUpdatedAt, refetchTrigger, onClickBucket, features, selectedBucket, aggregateBy, filteredSongId,
    filteredEventId,
    filteredUserId,
    filteredWikiPageId, startDate, endDate }: GeneralFeatureStatsReportInnerProps) => {
    const [result, { refetch, dataUpdatedAt }] = useQuery(getGeneralFeatureReport, {
        features,
        excludeYourself,
        startDate,//: roundToNearest15Minutes(startDate),
        endDate,//: roundToNearest15Minutes(endDate),
        aggregateBy,
        filteredSongId,//: filteredSong?.id,
        filteredEventId,//: filteredEvent?.id,
        filteredUserId,//: filteredUser?.id,
        filteredWikiPageId,//: filteredWikiPage?.id,
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

    const [filteredSong, setFilteredSong] = React.useState<QuickSearchItemMatch | undefined>(undefined);
    const [filteredEvent, setFilteredEvent] = React.useState<QuickSearchItemMatch | undefined>(undefined);
    const [filteredUser, setFilteredUser] = React.useState<QuickSearchItemMatch | undefined>(undefined);
    const [filteredWikiPage, setFilteredWikiPage] = React.useState<QuickSearchItemMatch | undefined>(undefined);

    const [selectedBucket, setSelectedBucket] = React.useState<string | null>(null);
    const [refetchTrigger, setRefetchTrigger] = React.useState(0);

    const [dataUpdatedAt, setDataUpdatedAt] = React.useState<Date>(now);

    const realStartDate = roundToNearest15Minutes(startDate);
    const realEndDate = roundToNearest15Minutes(endDate);


    return <div>
        <div style={{ display: "flex", alignItems: "center" }}>
            <Button onClick={() => setRefetchTrigger(x => x + 1)}>Refresh</Button>
            <span className="smallText">
                last updated: <AgeRelativeToNow value={dataUpdatedAt} />
            </span>
        </div>

        <NameValuePair name="Feature" value={
            <>
                <Button onClick={() => setFeatures([])} >Clear</Button>
                <CMMultiSelect
                    value={features}
                    onChange={setFeatures}
                    getOptions={() => {
                        return Object.values(ActivityFeature);
                    }}
                    getOptionInfo={(item) => {
                        return {
                            id: item.toString(),
                        };
                    }}
                    renderOption={(item) => {
                        return item.toString();
                    }}
                />
            </>
        } />

        <NameValuePair name="Bucket size" value={
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
        } />
        <NameValuePair name="Date range" value={
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
        } />

        <Accordion defaultExpanded={false}>
            <AccordionSummary>Filters</AccordionSummary>
            <AccordionDetails>
                <FormControlLabel control={<input type="checkbox" checked={excludeYourself} onChange={(e) => setExcludeYourself(e.target.checked)} />} label="Exclude yourself" />

                <AssociationSelect
                    title="Filter by user"
                    allowedItemTypes={[QuickSearchItemType.user]}
                    allowNull={true}
                    value={filteredUser || null}
                    onChange={(newValue) => setFilteredUser(newValue || undefined)}
                />
                <AssociationSelect
                    title="Filter by song"
                    allowedItemTypes={[QuickSearchItemType.song]}
                    allowNull={true}
                    value={filteredSong || null}
                    onChange={(newValue) => setFilteredSong(newValue || undefined)}
                />
                <AssociationSelect
                    title="Filter by event"
                    allowedItemTypes={[QuickSearchItemType.event]}
                    allowNull={true}
                    value={filteredEvent || null}
                    onChange={(newValue) => setFilteredEvent(newValue || undefined)}
                />
                <AssociationSelect
                    title="Filter by wiki page"
                    allowedItemTypes={[QuickSearchItemType.wikiPage]}
                    allowNull={true}
                    value={filteredEvent || null}
                    onChange={(newValue) => setFilteredWikiPage(newValue || undefined)}
                />


            </AccordionDetails>
        </Accordion>

        <React.Suspense>
            <GeneralFeatureStatsReportInner
                features={features}
                selectedBucket={selectedBucket}
                aggregateBy={aggregateBy}
                excludeYourself={excludeYourself}
                filteredSongId={filteredSong?.id}
                filteredEventId={filteredEvent?.id}
                filteredUserId={filteredUser?.id}
                filteredWikiPageId={filteredWikiPage?.id}
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
                bucket={selectedBucket}
                aggregateBy={aggregateBy}
                excludeYourself={excludeYourself}
                filteredSongId={filteredSong?.id}
                filteredEventId={filteredEvent?.id}
                filteredUserId={filteredUser?.id}
                filteredWikiPageId={filteredWikiPage?.id}
                refetchTrigger={refetchTrigger}
            />
        </React.Suspense>
    </div>;
};

const MainContent = () => {
    const [tabId, setTabId] = React.useState<TabId>(TabId.general);
    return <CMTabPanel selectedTabId={tabId} handleTabChange={(e, newTabId: TabId) => setTabId(newTabId)} >
        <CMTab key={TabId.general} thisTabId={TabId.general} summaryTitle="Reports">
            <GeneralFeatureStatsReport />
        </CMTab>
        <CMTab key={TabId.featureUsageByUser} thisTabId={TabId.featureUsageByUser} summaryTitle="Feature usage by user">
            <div style={{ display: "flex", alignItems: "center" }}>
                <span className="smallText">Coming soon...</span>
            </div>
        </CMTab>
    </CMTabPanel >;
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
