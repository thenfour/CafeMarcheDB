import { BlitzPage } from "@blitzjs/next";
import { useQuery } from "@blitzjs/rpc";
import { Accordion, AccordionDetails, AccordionSummary, Button, FormControlLabel } from "@mui/material";
import * as React from 'react';
import Identicon from 'react-identicons';
import { Bar, CartesianGrid, ComposedChart, Legend, Tooltip, XAxis, YAxis } from "recharts";
import { Permission } from "shared/permissions";
import { QuickSearchItemMatch, QuickSearchItemType } from "shared/quickFilter";
import { roundToNearest15Minutes } from "shared/time";
import { getHashedColor, smartTruncate } from "shared/utils";
import { EventChip, FileChip, SongChip, WikiPageChip } from "src/core/components/CMCoreComponents";
import { NameValuePair } from "src/core/components/CMCoreComponents2";
import { CMMultiSelect, CMSingleSelect } from "src/core/components/CMSelect";
import { CMSelectNullBehavior } from "src/core/components/CMSingleSelectDialog";
import { AgeRelativeToNow } from "src/core/components/RelativeTimeComponents";
import { AssociationSelect } from "src/core/components/setlistPlan/ItemAssociation";
import { CMTab, CMTabPanel } from "src/core/components/TabPanel";
import { gIconMap } from "src/core/db3/components/IconMap";
import * as DB3Client from "src/core/db3/DB3Client";
import getGeneralFeatureDetail from "src/core/db3/queries/getGeneralFeatureDetail";
import getGeneralFeatureReport from "src/core/db3/queries/getGeneralFeatureReport";
import { ActivityFeature } from "src/core/db3/shared/activityTracking";
import { GeneralActivityReportDetailPayload, ReportAggregateBy } from "src/core/db3/shared/apiTypes";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { Tooltip as MuiTooltip } from "@mui/material";

enum TabId {
    icalStats = "icalStats",
    songViews = "songViews",
    eventViews = "eventViews",
};

const AnonymizedUserChip = ({ value, size = 25 }: { value: string, size?: number }) => {
    return <MuiTooltip title={value.substring(0, 6)} disableInteractive><span><Identicon string={value} size={size} /></span></MuiTooltip>;
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

type DetailTabId = "general" | "users" | "songs" | "events" | "wikiPages" | "files";

const GeneralFeatureDetailArea = ({ excludeYourself, features, bucket, aggregateBy, filteredEventId, filteredSongId, filteredUserId, filteredWikiPageId, refetchTrigger }: GeneralFeatureDetailAreaProps) => {

    //console.log("generalFeatureDetailArea; bucket", bucket, "aggregateBy", aggregateBy, "filteredEventId", filteredEventId, "filteredSongId", filteredSongId, "filteredUserId", filteredUserId, "filteredWikiPageId", filteredWikiPageId);

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

    // get some distinct values...
    const distinctSets: {
        features: string[],
        users: string[],
        songIds: number[],
        eventIds: number[],
        wikiPageIds: number[],
        fileIds: number[],
    } = React.useMemo(() => {
        if (!detail) {
            return {
                features: [],
                users: [],
                songIds: [],
                eventIds: [],
                wikiPageIds: [],
                fileIds: [],
            };
        }

        return {
            features: [...new Set(detail.data.map((item) => item.feature))],
            users: [...new Set(detail.data.filter(x => !!x.userHash).map((item) => item.userHash!))],
            songIds: [...new Set(detail.data.filter(x => !!x.song).map((item) => item.song!.id))],
            eventIds: [...new Set(detail.data.filter(x => !!x.event).map((item) => item.event!.id))],
            wikiPageIds: [...new Set(detail.data.filter(x => !!x.wikiPage).map((item) => item.wikiPage!.id))],
            fileIds: [...new Set(detail.data.filter(x => !!x.file).map((item) => item.file!.id))],
        }
    }, [detail]);

    return <div>

        <CMTabPanel handleTabChange={(e, newTabId: DetailTabId) => setTabId(newTabId)} selectedTabId={tabId} >
            <CMTab thisTabId="general" summaryTitle={`General (${detail?.data.length})`} >
                <GeneralFeatureDetailTable data={detail?.data || []} />
            </CMTab>
            <CMTab thisTabId="features" summaryTitle={`Features (${distinctSets.features.length})`} enabled={distinctSets.features.length > 1} >
                {distinctSets.features.length > 1 && <div>
                    {distinctSets.features.map((feature) => {
                        return <div key={feature}>
                            <strong>{feature}</strong>
                            <GeneralFeatureDetailTable data={detail?.data.filter((item) => item.feature === feature) || []} />
                        </div>;
                    })}
                </div>}
            </CMTab>
            <CMTab thisTabId="users" summaryTitle={`Users (${distinctSets.users.length})`} enabled={distinctSets.users.length > 1} >
                {distinctSets.users.length > 1 && <div>
                    {distinctSets.users.map((user) => {
                        return <div key={user}>
                            <AnonymizedUserChip value={user} size={50} />
                            <GeneralFeatureDetailTable data={detail?.data.filter((item) => item.userHash === user) || []} />
                        </div>;
                    })}
                </div>}
            </CMTab>
            <CMTab thisTabId="songs" summaryTitle={`Songs (${distinctSets.songIds.length})`} enabled={distinctSets.songIds.length > 1} >
                {distinctSets.songIds.length > 1 && <div>
                    {distinctSets.songIds.map((songId) => {
                        const song = detail?.data.find((item) => item.song?.id === songId)?.song;
                        return <div key={songId}>
                            <SongChip value={song!} startAdornment={gIconMap.MusicNote()} useHashedColor={true} />
                            <GeneralFeatureDetailTable data={detail?.data.filter((item) => item.song?.id === songId) || []} />
                        </div>;
                    })}
                </div>}
            </CMTab>
            <CMTab thisTabId="events" summaryTitle={`Events (${distinctSets.eventIds.length})`} enabled={distinctSets.eventIds.length > 1} >
                {distinctSets.eventIds.length > 1 && <div >
                    {distinctSets.eventIds.map((eventId) => {
                        const event = detail?.data.find((item) => item.event?.id === eventId)?.event;
                        return <div key={eventId}>
                            <EventChip value={event!} startAdornment={gIconMap.CalendarMonth()} useHashedColor={true} />
                            <GeneralFeatureDetailTable data={detail?.data.filter((item) => item.event?.id === eventId) || []} />
                        </div>;
                    })}
                </div>}
            </CMTab>
            <CMTab thisTabId="wikiPages" summaryTitle={`Wiki pages (${distinctSets.wikiPageIds.length})`} enabled={distinctSets.wikiPageIds.length > 1} >
                {distinctSets.wikiPageIds.length > 1 && <div >
                    {distinctSets.wikiPageIds.map((wikiPageId) => {
                        const wikiPage = detail?.data.find((item) => item.wikiPage?.id === wikiPageId)?.wikiPage;
                        return <div key={wikiPageId}>
                            <WikiPageChip slug={wikiPage?.slug!} startAdornment={gIconMap.Article()} useHashedColor={true} />
                            <GeneralFeatureDetailTable data={detail?.data.filter((item) => item.wikiPage?.id === wikiPageId) || []} />
                        </div>;
                    })}
                </div>}

            </CMTab>
            <CMTab thisTabId="files" summaryTitle={`Files (${distinctSets.fileIds.length})`} enabled={distinctSets.fileIds.length > 1} >
                {distinctSets.fileIds.length > 1 && <div>
                    {distinctSets.fileIds.map((fileId) => {
                        const file = detail?.data.find((item) => item.file?.id === fileId)?.file;
                        return <div key={fileId}>
                            <FileChip value={file!} startAdornment={gIconMap.AttachFile()} useHashedColor={true} />
                            <GeneralFeatureDetailTable data={detail?.data.filter((item) => item.file?.id === fileId) || []} />
                        </div>;
                    })}
                </div>}
            </CMTab>

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
        width={600}
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
        <Accordion defaultExpanded={false}>
            <AccordionSummary>Filters</AccordionSummary>
            <AccordionDetails>
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
                    <>
                        <DB3Client.CMDatePicker
                            label="Start date"
                            value={startDate}
                            onChange={(val) => {
                                if (val) {
                                    setStartDate(val);
                                }
                            }}
                        />
                        <DB3Client.CMDatePicker
                            label="End date"
                            value={endDate}
                            onChange={(val) => {
                                if (val) {
                                    setEndDate(val);
                                }
                            }}
                        />
                    </>
                } />

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
    const [tabId, setTabId] = React.useState<TabId>(TabId.icalStats);
    return <CMTabPanel selectedTabId={tabId} handleTabChange={(e, newTabId: TabId) => setTabId(newTabId)} >
        <CMTab thisTabId={TabId.icalStats} summaryTitle="Reports">
            <GeneralFeatureStatsReport />
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
