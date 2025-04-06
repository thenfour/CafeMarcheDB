import { BlitzPage } from "@blitzjs/next";
import { useQuery } from "@blitzjs/rpc";
import { Accordion, AccordionDetails, AccordionSummary } from "@mui/material";
import * as React from 'react';
import { Bar, CartesianGrid, ComposedChart, Legend, Tooltip, XAxis, YAxis } from "recharts";
import { Permission } from "shared/permissions";
import { QuickSearchItemMatch, QuickSearchItemType } from "shared/quickFilter";
import { roundToNearest15Minutes } from "shared/time";
import { EventChip, SongChip } from "src/core/components/CMCoreComponents";
import { NameValuePair } from "src/core/components/CMCoreComponents2";
import { CMSingleSelect } from "src/core/components/CMSelect";
import { CMSelectNullBehavior } from "src/core/components/CMSingleSelectDialog";
import { AssociationSelect } from "src/core/components/setlistPlan/ItemAssociation";
import { CMTab, CMTabPanel } from "src/core/components/TabPanel";
import { UserChip } from "src/core/components/userChip";
import * as DB3Client from "src/core/db3/DB3Client";
import getGeneralFeatureDetail from "src/core/db3/queries/getGeneralFeatureDetail";
import getGeneralFeatureReport from "src/core/db3/queries/getGeneralFeatureReport";
import { ActivityFeature } from "src/core/db3/shared/activityTracking";
import { GeneralActivityReportDetailPayload, ReportAggregateBy } from "src/core/db3/shared/apiTypes";
import DashboardLayout from "src/core/layouts/DashboardLayout";

enum TabId {
    icalStats = "icalStats",
    songViews = "songViews",
    eventViews = "eventViews",
};

const GeneralFeatureReportDetailItem = ({ value }: { value: GeneralActivityReportDetailPayload }) => {
    return <tr>
        <td>{value.createdAt.toLocaleString()}</td>
        <td>{value.uri && <a href={value.uri} target="_blank" rel="noreferrer" >{value.uri}</a>}</td>
        <td>{value.user && <UserChip value={value.user} />}</td>
        <td>
            {value.song && <SongChip value={value.song} />}
            {value.event && <EventChip value={value.event} />}
            {value.wikiPage && <div>Wiki page: {value.wikiPage.slug}</div>}
        </td>
    </tr>;
};

interface GeneralFeatureDetailAreaProps {
    feature: ActivityFeature;
    bucket: string | null;
    aggregateBy: ReportAggregateBy;
    filteredSongId: number | undefined;
    filteredEventId: number | undefined;
    filteredUserId: number | undefined;
    filteredWikiPageId: number | undefined;
};

const GeneralFeatureDetailArea = ({ feature, bucket, aggregateBy, filteredEventId, filteredSongId, filteredUserId, filteredWikiPageId }: GeneralFeatureDetailAreaProps) => {

    const [detail] = useQuery(getGeneralFeatureDetail, {
        feature,
        bucket,
        aggregateBy,
        filteredSongId,
        filteredEventId,
        filteredUserId,
        filteredWikiPageId,
    });

    return <table>
        <thead>
            <tr>
                <th>When</th>
                <th>URI</th>
                <th>User</th>
                <th>...</th>
            </tr>
        </thead>
        <tbody>
            {detail && detail.data.map((item, index) => {
                return <GeneralFeatureReportDetailItem key={index} value={item} />;
            })}
        </tbody>
    </table>;
};

const GeneralFeatureStatsReport = () => {
    const now = React.useMemo(() => new Date(), []);
    const [feature, setFeature] = React.useState<ActivityFeature>(ActivityFeature.event_view);
    const [aggregateBy, setAggregateBy] = React.useState<ReportAggregateBy>(ReportAggregateBy.day);
    const [startDate, setStartDate] = React.useState<Date>(new Date(now.getTime() - 3 * 30 * 24 * 60 * 60 * 1000));
    const [endDate, setEndDate] = React.useState<Date>(new Date(now.getTime() + 24 * 60 * 60 * 1000)); // +1 day

    const [filteredSong, setFilteredSong] = React.useState<QuickSearchItemMatch | undefined>(undefined);
    const [filteredEvent, setFilteredEvent] = React.useState<QuickSearchItemMatch | undefined>(undefined);
    const [filteredUser, setFilteredUser] = React.useState<QuickSearchItemMatch | undefined>(undefined);
    const [filteredWikiPage, setFilteredWikiPage] = React.useState<QuickSearchItemMatch | undefined>(undefined);

    const [selectedBucket, setSelectedBucket] = React.useState<string | null>(null);

    const [result] = useQuery(getGeneralFeatureReport, {
        feature,
        startDate: roundToNearest15Minutes(startDate),
        endDate: roundToNearest15Minutes(endDate),
        aggregateBy,
        filteredSongId: filteredSong?.id,
        filteredEventId: filteredEvent?.id,
        filteredUserId: filteredUser?.id,
        filteredWikiPageId: filteredWikiPage?.id,
    });

    const handleBucketClick = (data: { bucket: string, count: number }, index: number, e) => {
        setSelectedBucket(data.bucket);
    };

    return <div>
        <NameValuePair name="Feature" value={
            <CMSingleSelect
                value={feature}
                onChange={setFeature}
                getOptions={() => {
                    return Object.values(ActivityFeature);
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
        <Accordion defaultExpanded={false}>
            <AccordionSummary>Filters</AccordionSummary>
            <AccordionDetails>
                <NameValuePair name="Bucket size" value={

                    <CMSingleSelect
                        value={aggregateBy}
                        onChange={setAggregateBy}
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
                                    console.log("setStartDate", val);
                                    setStartDate(val);
                                }
                            }}
                        />
                        <DB3Client.CMDatePicker
                            label="End date"
                            value={endDate}
                            onChange={(val) => {
                                if (val) {
                                    console.log("setEndDate", val);
                                    setEndDate(val);
                                }
                            }}
                        />
                    </>
                } />

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

        <ComposedChart
            width={600}
            height={600}
            data={result.data}
        >
            <CartesianGrid stroke="#f5f5f5" />
            <XAxis dataKey="bucket" />
            <YAxis />
            <Tooltip />
            <Legend />

            <Bar dataKey="count" barSize={30} fill="#44f" onClick={handleBucketClick} />

        </ComposedChart>

        <React.Suspense>
            <GeneralFeatureDetailArea
                feature={feature}
                bucket={selectedBucket}
                aggregateBy={aggregateBy}
                filteredSongId={filteredSong?.id}
                filteredEventId={filteredEvent?.id}
                filteredUserId={filteredUser?.id}
                filteredWikiPageId={filteredWikiPage?.id}
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
