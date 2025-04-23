import { useDashboardContext } from "@/src/core/components/DashboardContext";
import { ActivityDetailTabId } from "@/src/core/db3/shared/activityTabs";
import { BlitzPage } from "@blitzjs/next";
import { useQuery } from "@blitzjs/rpc";
import { ArrowUpward, Clear } from "@mui/icons-material";
import { Button, FormControlLabel, Tooltip as MuiTooltip } from "@mui/material";
import * as React from 'react';
import Identicon from 'react-identicons';
import { Bar, CartesianGrid, ComposedChart, Legend, Pie, PieChart, Tooltip, XAxis, YAxis } from "recharts";
import { toSorted } from "shared/arrayUtils";
import { gLightSwatchColors, gSwatchColors } from "shared/color";
import { parseBucketToDateRange } from "shared/mysqlUtils";
import { Permission } from "shared/permissions";
import { DateAdd, formatMillisecondsToDHMS, roundToNearest15Minutes } from "shared/time";
import { getHashedColor, IsNullOrWhitespace, smartTruncate } from "shared/utils";
import { CMChip } from "src/core/components/CMChip";
import { AdminInspectObject, AttendanceChip, EventChip, FileChip, InstrumentChip, PermissionBoundary, SongChip, WikiPageChip } from "src/core/components/CMCoreComponents";
import { CMSmallButton, NameValuePair } from "src/core/components/CMCoreComponents2";
import { CMMultiSelect, CMSingleSelect } from "src/core/components/CMSelect";
import { CMSelectNullBehavior } from "src/core/components/CMSingleSelectDialog";
import { CMTextInputBase } from "src/core/components/CMTextField";
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

        [ActivityFeature.metronome_persistent]: gLightSwatchColors.light_gold,

        [ActivityFeature.link_follow_external]: gLightSwatchColors.light_green,
        [ActivityFeature.link_follow_internal]: gLightSwatchColors.light_green,

        [ActivityFeature.event_change_custom_field]: gLightSwatchColors.light_orange,

        [ActivityFeature.attendance_response]: gLightSwatchColors.light_brown,
        [ActivityFeature.attendance_instrument]: gLightSwatchColors.light_brown,
        [ActivityFeature.attendance_comment]: gLightSwatchColors.light_brown,
        [ActivityFeature.attendance_explicit_invite]: gLightSwatchColors.light_brown,
        [ActivityFeature.event_change_invite_tag]: gLightSwatchColors.light_brown,

        [ActivityFeature.menu_link_update]: gLightSwatchColors.light_olive,
        [ActivityFeature.menu_link_create]: gLightSwatchColors.light_olive,
        [ActivityFeature.menu_link_reorder]: gLightSwatchColors.light_olive,
        [ActivityFeature.menu_link_delete]: gLightSwatchColors.light_olive,

        [ActivityFeature.custom_link_create]: gLightSwatchColors.light_citron,
        [ActivityFeature.custom_link_update]: gLightSwatchColors.light_citron,
        [ActivityFeature.custom_link_delete]: gLightSwatchColors.light_citron,

        [ActivityFeature.event_segment_create]: gSwatchColors.blue,
        [ActivityFeature.event_segment_edit]: gSwatchColors.blue,
        [ActivityFeature.event_segment_delete]: gSwatchColors.blue,
        [ActivityFeature.event_segment_reorder]: gSwatchColors.blue,

        [ActivityFeature.event_view]: gLightSwatchColors.light_pink,
        [ActivityFeature.event_create]: gSwatchColors.teal,
        [ActivityFeature.event_edit]: gSwatchColors.teal,
        [ActivityFeature.event_frontpage_edit]: gSwatchColors.teal,
        [ActivityFeature.event_delete]: gSwatchColors.teal,

        [ActivityFeature.profile_view]: gSwatchColors.dark_gray,
        [ActivityFeature.profile_edit]: gSwatchColors.dark_gray,
        [ActivityFeature.profile_change_instrument]: gSwatchColors.dark_gray,
        [ActivityFeature.profile_change_default_instrument]: gSwatchColors.dark_gray,

        [ActivityFeature.login_email]: gSwatchColors.pink,
        [ActivityFeature.login_google]: gSwatchColors.pink,
        [ActivityFeature.logout]: gSwatchColors.pink,
        [ActivityFeature.signup_email]: gSwatchColors.red,
        [ActivityFeature.signup_google]: gSwatchColors.red,
        [ActivityFeature.forgot_password]: gSwatchColors.red,

        [ActivityFeature.wiki_page_view]: gSwatchColors.light_gray,
        [ActivityFeature.wiki_edit]: gSwatchColors.light_gray,
        [ActivityFeature.wiki_change_visibility]: gSwatchColors.light_gray,

        [ActivityFeature.frontpagegallery_reorder]: gSwatchColors.citron,
        [ActivityFeature.frontpagegallery_item_create]: gSwatchColors.citron,
        [ActivityFeature.frontpagegallery_item_edit]: gSwatchColors.citron,
        [ActivityFeature.frontpagegallery_item_delete]: gSwatchColors.citron,
        [ActivityFeature.frontpagegallery_item_change_visibility]: gSwatchColors.citron,

        [ActivityFeature.file_download]: gSwatchColors.maroon,
        [ActivityFeature.file_upload]: gSwatchColors.maroon,
        [ActivityFeature.file_upload_url]: gSwatchColors.maroon,
        [ActivityFeature.file_edit]: gSwatchColors.maroon,
        [ActivityFeature.file_delete]: gSwatchColors.maroon,

        [ActivityFeature.song_view]: gSwatchColors.purple,
        [ActivityFeature.song_edit]: gSwatchColors.purple,
        [ActivityFeature.song_edit_description]: gSwatchColors.purple,
        [ActivityFeature.song_delete]: gSwatchColors.purple,
        [ActivityFeature.song_create]: gSwatchColors.purple,
        [ActivityFeature.song_credit_add]: gSwatchColors.purple,
        [ActivityFeature.song_credit_edit]: gSwatchColors.purple,
        [ActivityFeature.song_credit_delete]: gSwatchColors.purple,

        [ActivityFeature.setlist_plan_create]: gSwatchColors.black,
        [ActivityFeature.setlist_plan_save]: gSwatchColors.black,
        [ActivityFeature.setlist_plan_delete]: gSwatchColors.black,

        [ActivityFeature.setlist_create]: gSwatchColors.green,
        [ActivityFeature.setlist_edit]: gSwatchColors.green,
        [ActivityFeature.setlist_delete]: gSwatchColors.green,
        [ActivityFeature.setlist_reorder]: gSwatchColors.green,
    };

    return featureColorMap[feature] || null;
}

const AnonymizedUserChip = ({ value, size = 25 }: { value: string, size?: number }) => {
    return <MuiTooltip title={value.substring(0, 6)} disableInteractive>
        <div style={{ display: "flex", alignItems: "center", padding: "5px", margin: "2px", backgroundColor: "white", borderRadius: "4px" }}>
            <Identicon string={value} size={size} />
        </div>
    </MuiTooltip>;
}

interface FeatureLabelProps {
    feature: ActivityFeature;
    onClickIsolate: () => void;
    onClickExclude: () => void;
}

const FeatureLabel = (props: FeatureLabelProps) => {
    //const featureColor = getHashedColor(props.feature);
    const color = getColorForFeature(props.feature);

    return <>
        <div
            style={{ display: "flex", alignItems: "center" }}
        >
            {/* <span>{props.feature}</span> */}
            <CMChip
                color={color}
                size="small"
                shape="rectangle"
                onClick={() => props.onClickIsolate()}
                tooltip={`Isolate ${props.feature}`}
            >{props.feature}</CMChip>
            <span className="flex-spacer"></span>
            <span>
                {/* <MuiTooltip title={`Isolate ${props.feature}`} disableInteractive>
                    <span>
                        <CMSmallButton onClick={props.onClickIsolate}>isol</CMSmallButton>
                    </span>
                </MuiTooltip> */}
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
    // if the user clicks on a path part, this will be called with rooted path part (e.g. "foo/bar")
    onClickPart?: (rootedPart: string) => void;
};


const ContextLabel = ({ value, onClickPart }: ContextLabelProps) => {
    // Split on slash and filter out any empty segments
    const parts = value.split("/").filter((x) => x.length > 0)

    return (
        <span className="contextLabelContainer">
            {parts.map((part, index) => {
                const color = getHashedColor(part)
                const bgcolor = getHashedColor(part, { alpha: "0.1" })
                const rooted = "/" + parts.slice(0, index + 1).join("/");

                // construct the sub-path from the start up to this index
                const handlePartClick = () => {
                    if (!onClickPart) return
                    onClickPart(rooted)
                }

                return (
                    <React.Fragment key={index}>
                        <MuiTooltip title={onClickPart ? `Show only ${rooted}` : `Context: ${rooted}`} disableInteractive>
                            <span
                                className={`contextLabelPart ${onClickPart && "interactable"}`}
                                style={{ color, backgroundColor: bgcolor, cursor: onClickPart ? "pointer" : undefined }}
                                onClick={onClickPart ? handlePartClick : undefined}
                            >
                                {part}
                            </span>
                        </MuiTooltip>
                        {index < parts.length - 1 && <span className="contextLabelSeparator">/</span>}
                    </React.Fragment>
                )
            })}
        </span>
    )
}

interface GeneralFeatureReportDetailItemProps {
    value: GeneralActivityReportDetailPayload;
    index: number;
    onIsolateFeature: (feature: ActivityFeature) => void;
    onExcludeFeature: (feature: ActivityFeature) => void;
    onFilterContext: (context: string) => void;
};

const GeneralFeatureReportDetailItem = ({ value, index, ...props }: GeneralFeatureReportDetailItemProps) => {
    const feature = value.feature as ActivityFeature;

    return <tr className="GeneralFeatureReportDetailItemRow">
        <td style={{ fontFamily: "var(--ff-mono)" }}>
            <AdminInspectObject src={value} />
            <span>#{index}</span>
        </td>
        <td>
            <MuiTooltip title={<AgeRelativeToNow value={value.createdAt} />} disableInteractive>
                <span>{value.createdAt.toLocaleString()}</span>
            </MuiTooltip>
        </td>
        <td>{value.userHash && <AnonymizedUserChip value={value.userHash} />}</td>
        <td>{value.context && <ContextLabel value={value.context} onClickPart={(part) => {
            props.onFilterContext(part);
        }} />}</td>
        <td><FeatureLabel feature={feature} onClickExclude={() => props.onExcludeFeature(feature)} onClickIsolate={() => props.onIsolateFeature(feature)} /></td>
        <td style={{ whiteSpace: "nowrap" }}>
            {value.queryText && <span className="queryText">"<span className="actualQueryText">{value.queryText}</span>"</span>}
        </td>
        <td>
            {value.song && <SongChip value={value.song} startAdornment={gIconMap.MusicNote()} useHashedColor={true} />}
            {value.event && <EventChip value={value.event} startAdornment={gIconMap.CalendarMonth()} useHashedColor={true} />}
            {value.file && <FileChip value={value.file} startAdornment={gIconMap.AttachFile()} useHashedColor={true} />}
            {value.wikiPage && <WikiPageChip slug={value.wikiPage.slug} startAdornment={gIconMap.Article()} useHashedColor={true} />}

            {/* todo: real chips */}
            {value.eventSegmentId && <CMChip>Segment #{value.eventSegmentId}</CMChip>}
            {value.customLinkId && <CMChip>Custom link #{value.customLinkId}</CMChip>}
            {value.eventSongListId && <CMChip>Setlist #{value.eventSongListId}</CMChip>}
            {value.frontpageGalleryItemId && <CMChip>Gallery item #{value.frontpageGalleryItemId}</CMChip>}
            {value.menuLinkId && <CMChip>Menu link #{value.menuLinkId}</CMChip>}
            {value.setlistPlanId && <CMChip>Setlist plan #{value.setlistPlanId}</CMChip>}
            {value.songCreditTypeId && <CMChip>Song credit #{value.songCreditTypeId}</CMChip>}

            {value.attendanceId && <AttendanceChip value={value.attendanceId} />}
            {value.instrumentId && <InstrumentChip value={value.instrumentId} />}
        </td>
        <td>{value.uri && <a href={value.uri} target="_blank" rel="noreferrer" >{smartTruncate(value.uri, 60)}</a>}</td>
    </tr>;
};

interface GeneralFeatureDetailTableProps {
    data: GeneralActivityReportDetailPayload[];
    onIsolateFeature: (feature: ActivityFeature) => void;
    onExcludeFeature: (feature: ActivityFeature) => void;
    onFilterContext: (context: string) => void;
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
                return <GeneralFeatureReportDetailItem key={index} value={item} index={data.length - index} onExcludeFeature={props.onExcludeFeature} onIsolateFeature={props.onIsolateFeature} onFilterContext={props.onFilterContext} />;
            })}
        </tbody>
    </table>;
}

type ContextObjectDistinctItem = {
    key: string,
    headingIndicator: React.ReactNode;
    label: string;
    itemCount: number;
    totalCount: number;
    percentageOfTotal: string;
    items: GeneralActivityReportDetailPayload[];
};

function getContextObjectTabData(
    items: GeneralActivityReportDetailPayload[] | null | undefined,
    getKey: (item: GeneralActivityReportDetailPayload) => string,
    getLabel: (item: GeneralActivityReportDetailPayload) => string,
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
            label: getLabel(filteredItems[0]!),
            itemCount: filteredItems.length,
            totalCount: itemCount,
            percentageOfTotal: `${(filteredItems.length * 100 / itemCount).toFixed()}%`,
            items: filteredItems,
        };
    });
    return toSorted(contextObjects, (a, b) => b.itemCount - a.itemCount);
}

const DistinctContextObjectPieChart = ({ item, items, innerRadius = 7, outerRadius = 25 }: { item: ContextObjectDistinctItem, items: ContextObjectDistinctItem[], innerRadius?: number, outerRadius?: number }) => {
    const chartData = items.map((contextObject) => ({
        ...contextObject,
        fill: contextObject.key === item.key ? getHashedColor(contextObject.key) : "#f8f8f8",
    }));

    return <PieChart width={60} height={60} data={chartData}>
        <Pie
            dataKey="itemCount"
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            isAnimationActive={false}
        />
    </PieChart>;
};

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }, items: ContextObjectDistinctItem[]) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
        percent < 0.1 ? <></> :
            <g style={{ pointerEvents: "none" }}>
                <text
                    x={x}
                    y={y}
                    fill="#666"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={14}
                >
                    {/* {`${(percent * 100).toFixed(0)}%`} */}
                    {items[index]!.label}
                </text>
                <text
                    x={x + 1}
                    y={y + 1}
                    fill="#eee"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={14}
                >
                    {/* {`${(percent * 100).toFixed(0)}%`} */}
                    {items[index]!.label}
                </text>
            </g>
    );
};

const renderCustomTooltip = ({ active, label, payload, ...e }: any, item: ContextObjectTabData) => {
    if (active && payload[0]) {
        const item = payload[0]!;
        return (
            <div className="custom-tooltip" style={{ backgroundColor: '#ffff', padding: '5px', border: '1px solid #cccc' }}>
                {item.name} ({item.payload.itemCount} of {item.payload.totalCount}, {item.payload.percentageOfTotal} of total)
            </div>
        );
    }
    return null;
};

const CMBar = ({ value01, color }: { value01: number, color?: string }) => {
    return <div style={{ width: "150px", height: "13px", backgroundColor: "#eee", borderRadius: "2px", overflow: "hidden" }}>
        <div style={{ width: `${value01 * 100}%`, height: "100%", backgroundColor: color }}></div>
    </div>;
};

type ContextObjectTabData = {
    id: ActivityDetailTabId,
    tabHeader: React.ReactNode,
    items: ContextObjectDistinctItem[],
    onIsolateFeature: (feature: ActivityFeature) => void;
    onExcludeFeature: (feature: ActivityFeature) => void;
    onFilterContext: (context: string) => void;
};

const DistinctContextObjectTabContent = ({ item }: { item: ContextObjectTabData }) => {

    const chartData = item.items.map((contextObject) => ({
        ...contextObject,
        fill: getHashedColor(contextObject.key),
    }));

    const TopCount = 5;

    const sortedItems = item.items.sort((a, b) => b.itemCount - a.itemCount);
    const topNItems = sortedItems.slice(0, TopCount);

    return item.items.length > 1 && <div className="DistinctContextObjectTabContent">
        <div className="header">
            <PieChart width={210} height={210} data={chartData}>
                <Pie
                    dataKey="itemCount"
                    nameKey={"label"}
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={7}
                    outerRadius={100}
                    isAnimationActive={false}
                    label={(e) => {
                        return renderCustomizedLabel(e, chartData);
                    }}
                    labelLine={false}
                />
                <Tooltip content={e => renderCustomTooltip(e, item)} />
            </PieChart>
            <div>
                top {TopCount} {item.tabHeader}:
                <table>
                    <tbody>
                        {topNItems.map((contextObject) => {
                            return <tr key={contextObject.key}>
                                <td>
                                    <CMBar value01={contextObject.itemCount / contextObject.totalCount} color={getHashedColor(contextObject.key)} />
                                </td>
                                <td>
                                    <span style={{ whiteSpace: "nowrap", fontFamily: "var(--ff-mono)", color: getHashedColor(contextObject.key) }}>
                                        {contextObject.percentageOfTotal}
                                    </span>
                                </td>
                                <td>
                                    <span style={{ whiteSpace: "nowrap", fontFamily: "var(--ff-mono)", color: getHashedColor(contextObject.key) }}>
                                        ({contextObject.itemCount} of {contextObject.totalCount})
                                    </span>
                                </td>
                                <td>
                                    <span style={{ whiteSpace: "nowrap", fontFamily: "var(--ff-mono)", color: getHashedColor(contextObject.key) }}>
                                        {contextObject.headingIndicator}
                                    </span>
                                </td>
                            </tr>;
                        })}
                    </tbody>
                </table>
            </div>
        </div>
        {item.items.map((contextObject) => {
            return <div key={contextObject.key}>
                <div style={{ display: "flex", fontWeight: "bold", alignItems: "center", backgroundColor: getHashedColor(contextObject.key, { alpha: "0.2" }), borderTop: `3px solid ${getHashedColor(contextObject.key)}` }}>
                    <DistinctContextObjectPieChart item={contextObject} items={item.items} />
                    {contextObject.headingIndicator} ({contextObject.itemCount} items) ({contextObject.percentageOfTotal} of total)
                </div>
                <GeneralFeatureDetailTable data={contextObject.items} onExcludeFeature={item.onExcludeFeature} onIsolateFeature={item.onIsolateFeature} onFilterContext={item.onFilterContext} />
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
    excludeSysadmins: boolean;
    contextBeginsWith: string | undefined;
    refetchTrigger: number;
    onIsolateFeature: (feature: ActivityFeature) => void;
    onExcludeFeature: (feature: ActivityFeature) => void;
    onFilterContext: (context: string) => void;
};

const GeneralFeatureDetailArea = ({ excludeYourself, features, contextBeginsWith, excludeFeatures, excludeSysadmins, bucket, aggregateBy, refetchTrigger, onIsolateFeature, onExcludeFeature, onFilterContext }: GeneralFeatureDetailAreaProps) => {
    const dashboardContext = useDashboardContext();
    const [tabId, setTabId] = React.useState<ActivityDetailTabId>(ActivityDetailTabId.general);

    const [detail, { refetch }] = useQuery(getGeneralFeatureDetail, {
        features,
        excludeFeatures,
        bucket,
        aggregateBy,
        excludeYourself,
        excludeSysadmins,
        contextBeginsWith,
    });

    React.useEffect(() => {
        refetchTrigger && refetch();
    }, [refetchTrigger]);


    const tabs: ContextObjectTabData[] = React.useMemo(() => {
        interface TabConfig {
            id: ActivityDetailTabId;
            label: string;
            filterFn: (item: GeneralActivityReportDetailPayload) => boolean;
            keyFn: (item: GeneralActivityReportDetailPayload) => string;
            renderFn: (item: GeneralActivityReportDetailPayload) => React.ReactNode;
            getlabel: (item: GeneralActivityReportDetailPayload) => string;
        }

        const tabConfigs: TabConfig[] = [
            {
                id: ActivityDetailTabId.feature,
                label: "Features",
                filterFn: (item) => !!item.feature,
                keyFn: (item) => item.feature,
                renderFn: (item) => <FeatureLabel feature={item.feature as ActivityFeature} onClickExclude={() => { }} onClickIsolate={() => { }} />,
                getlabel: (item) => item.feature,
            },
            {
                id: ActivityDetailTabId.user,
                label: "Users",
                filterFn: (item) => !!item.userHash,
                keyFn: (item) => item.userHash!,
                renderFn: (item) => <AnonymizedUserChip value={item.userHash!} size={50} />,
                getlabel: (item) => item.userHash!.substring(0, 6),
            },
            {
                id: ActivityDetailTabId.song,
                label: "Songs",
                filterFn: (item) => !!item.song,
                keyFn: (item) => item.song!.id.toString(),
                renderFn: (item) => (
                    <SongChip
                        value={item.song!}
                        startAdornment={gIconMap.MusicNote()}
                        useHashedColor
                    />
                ),
                getlabel: (item) => item.song!.name,
            },
            {
                id: ActivityDetailTabId.event,
                label: "Events",
                filterFn: (item) => !!item.event,
                keyFn: (item) => item.event!.id.toString(),
                renderFn: (item) => (
                    <EventChip
                        value={item.event!}
                        startAdornment={gIconMap.CalendarMonth()}
                        useHashedColor
                    />
                ),
                getlabel: (item) => item.event!.name,
            },
            {
                id: ActivityDetailTabId.wikiPage,
                label: "Wiki pages",
                filterFn: (item) => !!item.wikiPage,
                keyFn: (item) => item.wikiPage!.id.toString(),
                renderFn: (item) => (
                    <WikiPageChip
                        slug={item.wikiPage!.slug}
                        startAdornment={gIconMap.Article()}
                        useHashedColor
                    />
                ),
                getlabel: (item) => item.wikiPage!.slug,
            },
            {
                id: ActivityDetailTabId.file,
                label: "Files",
                filterFn: (item) => !!item.file,
                keyFn: (item) => item.file!.id.toString(),
                renderFn: (item) => (
                    <FileChip
                        value={item.file!}
                        startAdornment={gIconMap.AttachFile()}
                        useHashedColor
                    />
                ),
                getlabel: (item) => item.file!.fileLeafName,
            },
            {
                id: ActivityDetailTabId.context,
                label: "Contexts",
                filterFn: (item) => !!item.context,
                keyFn: (item) => item.context || "",
                renderFn: (item) => <ContextLabel value={item.context!} />,
                getlabel: (item) => item.context!,
            },
            {
                id: ActivityDetailTabId.attendance,
                label: "Attendance",
                filterFn: (item) => !!item.attendanceId,
                keyFn: (item) => item.attendanceId!.toString(),
                renderFn: (item) => <AttendanceChip value={item.attendanceId!} />,
                getlabel: (item) => {
                    const att = dashboardContext.eventAttendance.getById(item.attendanceId!);
                    return att?.text!;
                },
            },
            {
                id: ActivityDetailTabId.customLink,
                label: "Custom Links",
                filterFn: (item) => !!item.customLinkId,
                keyFn: (item) => item.customLinkId!.toString(),
                renderFn: (item) => <CMChip>Custom Link #{item.customLinkId}</CMChip>,
                getlabel: (item) => item.customLink?.name!,
            },
            {
                id: ActivityDetailTabId.setlist,
                label: "Setlists",
                filterFn: (item) => !!item.eventSongListId,
                keyFn: (item) => item.eventSongListId!.toString(),
                renderFn: (item) => <CMChip>Setlist #{item.eventSongListId}</CMChip>,
                getlabel: (item) => item.eventSongListId!.toString(),
            },
            {
                id: ActivityDetailTabId.frontpageGalleryItem,
                label: "Frontpage Gallery Items",
                filterFn: (item) => !!item.frontpageGalleryItemId,
                keyFn: (item) => item.frontpageGalleryItemId!.toString(),
                renderFn: (item) => <CMChip>Gallery Item #{item.frontpageGalleryItemId}</CMChip>,
                getlabel: (item) => item.frontpageGalleryItemId!.toString(),
            },
            {
                id: ActivityDetailTabId.menuLink,
                label: "Menu Links",
                filterFn: (item) => !!item.menuLinkId,
                keyFn: (item) => item.menuLinkId!.toString(),
                renderFn: (item) => <CMChip>Menu Link #{item.menuLinkId}</CMChip>,
                getlabel: (item) => item.menuLink?.caption!,
            },
            {
                id: ActivityDetailTabId.setlistPlan,
                label: "Setlist Plans",
                filterFn: (item) => !!item.setlistPlanId,
                keyFn: (item) => item.setlistPlanId!.toString(),
                renderFn: (item) => <CMChip>Setlist Plan #{item.setlistPlanId}</CMChip>,
                getlabel: (item) => item.setlistPlan?.name!,
            },
            {
                id: ActivityDetailTabId.songCreditType,
                label: "Song Credit Types",
                filterFn: (item) => !!item.songCreditTypeId,
                keyFn: (item) => item.songCreditTypeId!.toString(),
                renderFn: (item) => <CMChip>Song Credit Type #{item.songCreditTypeId}</CMChip>,
                getlabel: (item) => {
                    const creditType = dashboardContext.songCreditType.getById(item.songCreditTypeId!);
                    return creditType?.text!;
                },
            },
            {
                id: ActivityDetailTabId.instrument,
                label: "Instruments",
                filterFn: (item) => !!item.instrumentId,
                keyFn: (item) => item.instrumentId!.toString(),
                renderFn: (item) => <InstrumentChip value={item.instrumentId!} />,
                getlabel: (item) => {
                    const instrument = dashboardContext.instrument.getById(item.instrumentId!);
                    return instrument?.name!;
                },
            },
            {
                id: ActivityDetailTabId.screenSize,
                label: "Screen Size",
                filterFn: (item) => !!item.screenWidth && !!item.screenHeight,
                keyFn: (item) => {
                    return `${item.screenWidth}x${item.screenHeight}`;
                },
                renderFn: (item) => <CMChip>{item.screenWidth}x{item.screenHeight}</CMChip>,
                getlabel: (item) => {
                    return `${item.screenWidth}x${item.screenHeight}`;
                }
            },
            {
                id: ActivityDetailTabId.operatingSystem,
                label: "Operating System",
                filterFn: (item) => !!item.operatingSystem,
                keyFn: (item) => {
                    return item.operatingSystem!;
                },
                renderFn: (item) => <CMChip>{item.operatingSystem}</CMChip>,
                getlabel: (item) => {
                    return item.operatingSystem!;
                }
            },
            {
                id: ActivityDetailTabId.pointerType,
                label: "Pointer type",
                filterFn: (item) => !!item.pointerType,
                keyFn: (item) => {
                    return item.pointerType!;
                },
                renderFn: (item) => <CMChip>{item.pointerType}</CMChip>,
                getlabel: (item) => {
                    return item.pointerType!;
                }
            },
            {
                id: ActivityDetailTabId.browser,
                label: "Browser",
                filterFn: (item) => !!item.browserName,
                keyFn: (item) => {
                    return item.browserName!;
                },
                renderFn: (item) => <CMChip>{item.browserName}</CMChip>,
                getlabel: (item) => {
                    return item.browserName!;
                }
            },
            {
                id: ActivityDetailTabId.deviceClass,
                label: "Device type",
                filterFn: (item) => !!item.deviceClass,
                keyFn: (item) => {
                    return item.deviceClass!;
                },
                renderFn: (item) => <CMChip>{item.deviceClass}</CMChip>,
                getlabel: (item) => {
                    return item.deviceClass!;
                }
            },

            {
                id: ActivityDetailTabId.language,
                label: "Language",
                filterFn: (item) => !!item.language,
                keyFn: (item) => {
                    return item.language!;
                },
                renderFn: (item) => <CMChip>{item.language}</CMChip>,
                getlabel: (item) => {
                    return item.language!;
                }
            },

            {
                id: ActivityDetailTabId.locale,
                label: "Locale",
                filterFn: (item) => !!item.locale,
                keyFn: (item) => {
                    return item.locale!;
                },
                renderFn: (item) => <CMChip>{item.locale}</CMChip>,
                getlabel: (item) => {
                    return item.locale!;
                }
            },

            {
                id: ActivityDetailTabId.timezone,
                label: "Timezone",
                filterFn: (item) => !!item.timezone,
                keyFn: (item) => {
                    return item.timezone!;
                },
                renderFn: (item) => <CMChip>{item.timezone}</CMChip>,
                getlabel: (item) => {
                    return item.timezone!;
                }
            },

        ];

        const data = detail?.data ?? [];

        // 2) Iterate through each config to build the final tabs
        return tabConfigs.reduce<ContextObjectTabData[]>((acc, cfg) => {
            // Filter data for the current tab type
            const filtered = data.filter(cfg.filterFn);
            // Then gather context objects using your existing function
            const items = getContextObjectTabData(filtered, cfg.keyFn, cfg.getlabel, cfg.renderFn);

            if (items.length > 0) {
                acc.push({
                    id: cfg.id,
                    tabHeader: `${cfg.label} (${items.length})`,
                    items,
                    onIsolateFeature,
                    onExcludeFeature,
                    onFilterContext,
                });
            }
            return acc;
        }, []);
    }, [detail]);

    const renderedTabs: CMTabPanelChild[] = [
        <CMTab key={9999} thisTabId="general" summaryTitle={`General (${detail?.data.length})`} >
            <GeneralFeatureDetailTable data={detail?.data || []} onExcludeFeature={onExcludeFeature} onIsolateFeature={onIsolateFeature} onFilterContext={onFilterContext} />
        </CMTab>,
        ...tabs.map((tab) => <CMTab key={tab.id} thisTabId={tab.id} summaryTitle={tab.tabHeader} enabled={tab.items.length > 1} >
            <DistinctContextObjectTabContent key={tab.id} item={tab} />
        </CMTab>),
    ];

    const bucketDateRange = bucket ? parseBucketToDateRange(bucket, aggregateBy) : null;

    return <div>
        <div className="bucketLabel">
            {bucket && <>
                {bucket} [{bucketDateRange?.start.toLocaleString()} - {bucketDateRange?.end.toLocaleString()}] (range: {formatMillisecondsToDHMS(bucketDateRange!.end.getTime() - bucketDateRange!.start.getTime())})
            </>
            }
            {!bucket && <>No bucket selected</>}
        </div>
        <CMTabPanel handleTabChange={(e, newTabId: ActivityDetailTabId) => setTabId(newTabId)} selectedTabId={tabId} >
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
