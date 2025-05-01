import { toSorted } from "@/shared/arrayUtils";
import { ColorPaletteEntry, gGeneralPaletteList, gLightSwatchColors, gSwatchColors } from "@/shared/color";
import { getHashedColor, IsNullOrWhitespace, smartTruncate } from "@/shared/utils";
import { Tooltip as MuiTooltip } from "@mui/material";
import * as React from 'react';
import Identicon from 'react-identicons';
import { Pie, PieChart, Tooltip } from 'recharts';
import { gIconMap } from "../../db3/components/IconMap";
import { CMChip } from "../CMChip";
import { AdminInspectObject, AttendanceChip, EventChip, FileChip, InstrumentChip, SongChip, WikiPageChip } from "../CMCoreComponents";
import { AgeRelativeToNow } from "../RelativeTimeComponents";
//
import { ActivityDetailTabId, GeneralActivityReportDetailPayload } from "./activityReportTypes";
import { ActivityFeature, BrowserIconMap, Browsers, DeviceClasses, DeviceClassIconMap, OperatingSystem, OSIconMap, PointerTypeIconMap, PointerTypes } from "./activityTracking";

export const CMAdhocChipContainer = ({ children }: { children: React.ReactNode }) => {
    return <div className="adHocChipContainer">
        {children}
    </div>;
}

export interface CMAdhocChipProps {
    children: React.ReactNode;
    startIcon?: React.ReactNode;
    style?: React.CSSProperties;
    className?: string;
    onClick?: () => void;
};

export const CMAdhocChip = (props: CMAdhocChipProps) => {
    return <div className={`adHocChip ${props.className} ${props.onClick && 'interactable'}`} onClick={props.onClick} style={props.style}>
        {props.startIcon && <div className="adHocChipStartIcon">{props.startIcon}</div>}
        <div className="adHocChipContent">{props.children}</div>
    </div>;
};


export type ContextObjectDistinctItem = {
    key: string,
    headingIndicator: React.ReactNode;
    label: string;
    itemCount: number;
    totalCount: number;
    percentageOfTotal: string;
    items: GeneralActivityReportDetailPayload[];
};


export type ContextObjectTabData = {
    id: ActivityDetailTabId,
    tabHeader: React.ReactNode,
    items: ContextObjectDistinctItem[],
    onIsolateFeature: (feature: ActivityFeature) => void;
    onExcludeFeature: (feature: ActivityFeature) => void;
    onFilterContext: (context: string) => void;
};


export const getColorForFeature = (feature: ActivityFeature): ColorPaletteEntry => {
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

    //return featureColorMap[feature] || gGeneralPaletteList.defaultEntry.strong.foregroundColor;
    return gGeneralPaletteList.findEntry(featureColorMap[feature]) || gGeneralPaletteList.defaultEntry;
}

export const AnonymizedUserChip = ({ value, size = 25 }: { value: string, size?: number }) => {
    return <MuiTooltip title={value.substring(0, 6)} disableInteractive>
        <div style={{ display: "flex", alignItems: "center", padding: "0px", margin: "2px", backgroundColor: "white", borderRadius: "4px" }}>
            <Identicon string={value} size={size} />
        </div>
    </MuiTooltip>;
}

interface FeatureLabelProps {
    feature: ActivityFeature;
    onClickIsolate?: () => void;
    onClickExclude?: () => void;
}

export const FeatureLabel = (props: FeatureLabelProps) => {
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
            //onClick={props.onClickIsolate ? (() => props.onClickIsolate!()) : undefined}
            //tooltip={`Isolate ${props.feature}`}
            >{props.feature}</CMChip>
            {/* <span className="flex-spacer"></span> */}
            {/* <span>
                <MuiTooltip title={`Hide / exclude ${props.feature}`} disableInteractive>
                    <span>
                        <CMSmallButton onClick={props.onClickExclude}>hide</CMSmallButton>
                    </span>
                </MuiTooltip>
            </span> */}
        </div>
    </>;
};

interface ContextLabelProps {
    value: string;
    // if the user clicks on a path part, this will be called with rooted path part (e.g. "foo/bar")
    onClickPart?: (rootedPart: string) => void;
};


export const ContextLabel = ({ value, onClickPart }: ContextLabelProps) => {
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

export const CMBar = ({ value01, color }: { value01: number, color?: string }) => {
    return <div style={{ width: "150px", height: "13px", backgroundColor: "#eee", borderRadius: "2px", overflow: "hidden" }}>
        <div style={{ width: `${value01 * 100}%`, height: "100%", backgroundColor: color }}></div>
    </div>;
};


export function getContextObjectTabData(
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

export const BrowserChip = ({ value }: { value: string | null | undefined }) => {
    if (IsNullOrWhitespace(value)) return null;
    const relUri = BrowserIconMap[value as Browsers];
    if (!relUri) return <div className="adHocChip">{value}</div>;
    return <MuiTooltip title={value}>
        <CMAdhocChip startIcon={<img src={relUri} width={24} height={24} />}>
            {value}
        </CMAdhocChip>
    </MuiTooltip>;
}

export const OperatingSystemChip = ({ value }: { value: string | null | undefined }) => {
    if (IsNullOrWhitespace(value)) return null;
    const relUri = OSIconMap[value as OperatingSystem];
    if (!relUri) return <div className="adHocChip">{value}</div>;
    return <MuiTooltip title={value}>
        <CMAdhocChip startIcon={<img src={relUri} width={24} height={24} />}>
            {value}
        </CMAdhocChip>
    </MuiTooltip>;
}

export const PointerTypeChip = ({ value }: { value: string | null | undefined }) => {
    if (IsNullOrWhitespace(value)) return null;
    const relUri = PointerTypeIconMap[value as PointerTypes];
    if (!relUri) return <div className="adHocChip">{value}</div>;
    return <MuiTooltip title={value}>
        <CMAdhocChip startIcon={<img src={relUri} width={24} height={24} />}>
            {value}
        </CMAdhocChip>
    </MuiTooltip>;
}

export const DeviceClassChip = ({ value }: { value: string | null | undefined }) => {
    if (IsNullOrWhitespace(value)) return null;
    const relUri = DeviceClassIconMap[value as DeviceClasses];
    if (!relUri) return <div className="adHocChip">{value}</div>;
    return <MuiTooltip title={value}>
        <CMAdhocChip startIcon={<img src={relUri} width={24} height={24} />}>
            {value}
        </CMAdhocChip>
    </MuiTooltip>;
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
        <td>
            {value.locale && <div className="adHocChipContainer">
                <div className="adHocChip">{value.locale}</div>
            </div>}
        </td >
        <td>
            <div className="adHocChipContainer">
                <PointerTypeChip value={value.pointerType} />
                <DeviceClassChip value={value.deviceClass} />
                <OperatingSystemChip value={value.operatingSystem} />
            </div>
        </td>
        <td>
            <BrowserChip value={value.browserName} />
        </td>
    </tr >;
};



interface GeneralFeatureDetailTableProps {
    data: GeneralActivityReportDetailPayload[];
    onIsolateFeature: (feature: ActivityFeature) => void;
    onExcludeFeature: (feature: ActivityFeature) => void;
    onFilterContext: (context: string) => void;
};

export const GeneralFeatureDetailTable = ({ data, ...props }: GeneralFeatureDetailTableProps) => {
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
                <th></th>
                <th></th>
                <th></th>
                <th></th>
                <th></th>
                <th></th>
            </tr>
        </thead>
        <tbody>
            {data.map((item, index) => {
                return <GeneralFeatureReportDetailItem key={index} value={item} index={data.length - index} onExcludeFeature={props.onExcludeFeature} onIsolateFeature={props.onIsolateFeature} onFilterContext={props.onFilterContext} />;
            })}
        </tbody>
    </table>;
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

export const DistinctContextObjectTabContent = ({ item }: { item: ContextObjectTabData }) => {

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
                                    <span style={{ whiteSpace: "nowrap", fontFamily: "var(--ff-mono)", /*color: getHashedColor(contextObject.key)*/ }}>
                                        {contextObject.percentageOfTotal}
                                    </span>
                                </td>
                                <td>
                                    <span style={{ whiteSpace: "nowrap", fontFamily: "var(--ff-mono)", /* color: getHashedColor(contextObject.key)*/ }}>
                                        ({contextObject.itemCount} of {contextObject.totalCount})
                                    </span>
                                </td>
                                <td>
                                    <span style={{ whiteSpace: "nowrap", fontFamily: "var(--ff-mono)", /* color: getHashedColor(contextObject.key)*/ }}>
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
