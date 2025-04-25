import { gGeneralPaletteList } from '@/shared/color';
import { parseBucketToDateRange } from '@/shared/mysqlUtils';
import { formatMillisecondsToDHMS } from '@/shared/time';
import { getHashedColor } from '@/shared/utils';
import { useQuery } from "@blitzjs/rpc";
import * as React from 'react';
import { Pie, PieChart, Tooltip } from 'recharts';
import { useDashboardContext } from "../DashboardContext";
import { CMTab, CMTabPanel, CMTabPanelChild } from "../TabPanel";
import { ActivityDetailTabId, ActivityReportTimeBucketSize, FacetedBreakdownResult, FacetResultBase } from "./activityReportTypes";
import { ActivityFeature } from "./activityTracking";
import { AnonymizedUserChip, BrowserChip, CMAdhocChip, CMAdhocChipContainer, CMBar, ContextLabel, DeviceClassChip, FeatureLabel, getColorForFeature, OperatingSystemChip, PointerTypeChip } from './FeatureReportBasics';
import getFacetedBreakdown from "./queries/getFacetedBreakdown";
import { EventChip, SongChip, WikiPageChip } from '../CMCoreComponents';
import { gIconMap } from '../../db3/components/IconMap';

interface ScreenSizeIndicatorProps {
    screenWidth: number;
    screenHeight: number;
    maxScreenWidth: number;
    maxScreenHeight: number;
    renderWidth: number;
    renderHeight: number;
}

/**
 * Renders a simple visual representation of a screen size as a box,
 * scaled to fit inside the given render dimensions.
 */
export default function ScreenSizeIndicator({
    screenWidth,
    screenHeight,
    maxScreenWidth,
    maxScreenHeight,
    renderWidth,
    renderHeight,
}: ScreenSizeIndicatorProps) {
    // Normalize screen dimensions to max bounds
    //const widthRatio = screenWidth / maxScreenWidth;
    //const heightRatio = screenHeight / maxScreenHeight;

    // Determine final rendered size, keeping aspect ratio correct
    const scaleFactor = Math.min(renderWidth / maxScreenWidth, renderHeight / maxScreenHeight);
    const displayWidth = screenWidth * scaleFactor;
    const displayHeight = screenHeight * scaleFactor;

    return (
        <div
            className="relative flex items-center justify-center"
            style={{
                width: renderWidth,
                height: renderHeight,
                backgroundColor: "#f3f4f6", // Tailwind gray-100
                border: "1px solid #d1d5db", // Tailwind gray-300
                borderRadius: 4,
                overflow: "hidden",
            }}
        >
            <div
                style={{
                    width: displayWidth,
                    height: displayHeight,
                    backgroundColor: "#3b82f6", // Tailwind blue-500
                    border: "2px solid #2563eb", // Tailwind blue-600
                    borderRadius: 2,
                }}
                title={`${screenWidth} × ${screenHeight}`}
            />
        </div>
    );
}




const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }, items) => {
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

const renderCustomTooltip = ({ active, label, payload, ...e }: any) => {
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
interface FacetHandler<Tpayload extends FacetResultBase> {
    getItemKey: (item: Tpayload) => string;
    getFacetName: () => string;
    renderItem: (item: Tpayload) => React.ReactNode;
    getItemLabel: (item: Tpayload) => string;
    getItemColor: (item: Tpayload, alpha?: string) => string;
}

const MakeHandler = <Tpayload extends FacetResultBase,>(val: FacetHandler<Tpayload>) => val;

const gHandlers = {
    features: MakeHandler<FacetedBreakdownResult['facets']['features'][0]>({
        getItemKey: (item) => item.feature,
        getFacetName: () => "Feature",
        getItemLabel: (item) => item.feature,
        renderItem: (item) => {
            return <FeatureLabel feature={item.feature} />;
        },
        getItemColor: (item, alpha) => {
            const colorName = getColorForFeature(item.feature);
            const entry = gGeneralPaletteList.findEntry(colorName)!;
            if (alpha) return entry.strong.backgroundColor;
            return entry.strong.foregroundColor;
        }
    }),
    contexts: MakeHandler<FacetedBreakdownResult['facets']['contexts'][0]>({
        getItemKey: (item) => item.context,
        getFacetName: () => "Context",
        getItemLabel: (item) => item.context,
        renderItem: (item) => {
            return <ContextLabel value={item.context} />;
        },
        getItemColor: (item, alpha) => getHashedColor(item.context, { alpha }),
    }),
    operatingSystems: MakeHandler<FacetedBreakdownResult['facets']['operatingSystems'][0]>({
        getItemKey: (item) => item.operatingSystem,
        getFacetName: () => "Operating System",
        getItemLabel: (item) => item.operatingSystem,
        renderItem: (item) => {
            return <CMAdhocChipContainer>
                <CMAdhocChip startIcon={<OperatingSystemChip value={item.operatingSystem} />}>
                    {item.operatingSystem}
                </CMAdhocChip>
            </CMAdhocChipContainer>;
        },
        getItemColor: (item, alpha) => getHashedColor(item.operatingSystem, { alpha }),
    }),
    pointerTypes: MakeHandler<FacetedBreakdownResult['facets']['pointerTypes'][0]>({
        getItemKey: (item) => item.pointerType,
        getFacetName: () => "Pointer Type",
        getItemLabel: (item) => item.pointerType,
        renderItem: (item) => {
            return <CMAdhocChipContainer>

                <CMAdhocChip startIcon={<PointerTypeChip value={item.pointerType} />}>{item.pointerType}</CMAdhocChip>
            </CMAdhocChipContainer>;
        },
        getItemColor: (item, alpha) => getHashedColor(item.pointerType, { alpha }),
    }),
    browsers: MakeHandler<FacetedBreakdownResult['facets']['browsers'][0]>({
        getItemKey: (item) => item.browserName,
        getFacetName: () => "Browser",
        getItemLabel: (item) => item.browserName,
        renderItem: (item) => {
            return <CMAdhocChipContainer>

                <CMAdhocChip startIcon={<BrowserChip value={item.browserName} />}>{item.browserName}</CMAdhocChip>
            </CMAdhocChipContainer>;
        },
        getItemColor: (item, alpha) => getHashedColor(item.browserName, { alpha }),
    }),
    deviceClasses: MakeHandler<FacetedBreakdownResult['facets']['deviceClasses'][0]>({
        getItemKey: (item) => item.deviceClass,
        getFacetName: () => "Device Class",
        getItemLabel: (item) => item.deviceClass,
        renderItem: (item) => {
            return <CMAdhocChipContainer>
                <CMAdhocChip startIcon={<DeviceClassChip value={item.deviceClass} />}>{item.deviceClass}</CMAdhocChip>
            </CMAdhocChipContainer>;
        },
        getItemColor: (item, alpha) => getHashedColor(item.deviceClass, { alpha }),
    }),
    customLinks: MakeHandler<FacetedBreakdownResult['facets']['customLinks'][0]>({
        getItemKey: (item) => item.customLinkId.toString(),
        getFacetName: () => "Custom Link",
        getItemLabel: (item) => item.customLinkId.toString(),
        renderItem: (item) => {
            return <span style={{ fontFamily: "var(--ff-mono)" }}>{item.customLinkId}</span>;
        },
        getItemColor: (item, alpha) => getHashedColor(item.customLinkId.toString(), { alpha }),
    }),
    menuLinks: MakeHandler<FacetedBreakdownResult['facets']['menuLinks'][0]>({
        getItemKey: (item) => item.menuLinkId.toString(),
        getItemLabel: (item) => item.menuLinkId.toString(),
        getFacetName: () => "Menu Link",
        renderItem: (item) => {
            return <span style={{ fontFamily: "var(--ff-mono)" }}>{item.menuLinkId}</span>;
        },
        getItemColor: (item, alpha) => getHashedColor(item.menuLinkId.toString(), { alpha }),
    }),
    songs: MakeHandler<FacetedBreakdownResult['facets']['songs'][0]>({
        getItemKey: (item) => item.songId.toString(),
        getFacetName: () => "Song",
        getItemLabel: (item) => item.name,
        renderItem: (item) => {
            //return <span style={{ fontFamily: "var(--ff-mono)" }}>{item.songId}</span>;
            return <SongChip value={{ ...item, id: item.songId }} startAdornment={gIconMap.MusicNote()} useHashedColor={true} />;
        },
        getItemColor: (item, alpha) => getHashedColor(item.songId.toString(), { alpha }),
    }),
    events: MakeHandler<FacetedBreakdownResult['facets']['events'][0]>({
        getItemKey: (item) => item.eventId.toString(),
        getFacetName: () => "Event",
        getItemLabel: (item) => item.name,
        renderItem: (item) => {
            //return <span style={{ fontFamily: "var(--ff-mono)" }}>{item.eventId}</span>;
            return <EventChip value={{ ...item, id: item.eventId }} startAdornment={gIconMap.CalendarMonth()} useHashedColor={true} />
        },
        getItemColor: (item, alpha) => getHashedColor(item.eventId.toString(), { alpha }),
    }),
    wikiPages: MakeHandler<FacetedBreakdownResult['facets']['wikiPages'][0]>({
        getItemKey: (item) => item.wikiPageId.toString(),
        getFacetName: () => "Wiki Page",
        getItemLabel: (item) => item.slug,
        renderItem: (item) => {
            //return <span style={{ fontFamily: "var(--ff-mono)" }}>{item.wikiPageId}</span>;
            return <WikiPageChip slug={item.slug} startAdornment={gIconMap.Article()} useHashedColor={true} />;
        },
        getItemColor: (item, alpha) => getHashedColor(item.slug, { alpha }),
    }),
    users: MakeHandler<FacetedBreakdownResult['facets']['users'][0]>({
        getItemKey: (item) => item.userHash,
        getFacetName: () => "User",
        getItemLabel: (item) => item.userHash.substring(0, 8),
        renderItem: (item) => {
            return <AnonymizedUserChip value={item.userHash} />;
        },
        getItemColor: (item, alpha) => getHashedColor(item.userHash, { alpha }),
    }),
    timezones: MakeHandler<FacetedBreakdownResult['facets']['timezones'][0]>({
        getItemKey: (item) => item.timezone,
        getFacetName: () => "Timezone",
        getItemLabel: (item) => item.timezone,
        renderItem: (item) => {
            return <span style={{ fontFamily: "var(--ff-mono)" }}>{item.timezone}</span>;
        },
        getItemColor: (item, alpha) => getHashedColor(item.timezone, { alpha }),
    }),
    languages: MakeHandler<FacetedBreakdownResult['facets']['languages'][0]>({
        getItemKey: (item) => item.language,
        getFacetName: () => "Language",
        getItemLabel: (item) => item.language,
        renderItem: (item) => {
            return <CMAdhocChipContainer>
                <CMAdhocChip style={{ color: getHashedColor(item.language) }} ><span style={{ fontSize: "22px", fontWeight: "bold" }}>{item.language.toUpperCase()}</span></CMAdhocChip>
            </CMAdhocChipContainer>;
        },
        getItemColor: (item, alpha) => getHashedColor(item.language, { alpha }),
    }),
    locales: MakeHandler<FacetedBreakdownResult['facets']['locales'][0]>({
        getItemKey: (item) => item.locale,
        getFacetName: () => "Locale",
        getItemLabel: (item) => item.locale,
        renderItem: (item) => {
            return <CMAdhocChipContainer>
                <CMAdhocChip style={{ color: getHashedColor(item.locale) }} ><span style={{ fontSize: "22px", fontWeight: "bold" }}>{item.locale.toUpperCase()}</span></CMAdhocChip>
            </CMAdhocChipContainer>;
        },
        getItemColor: (item, alpha) => getHashedColor(item.locale, { alpha }),
    }),
    screenSizes: MakeHandler<FacetedBreakdownResult['facets']['screenSizes'][0]>({
        getItemKey: (item) => `${item.width}x${item.height}`,
        getFacetName: () => "Screen Size",
        getItemLabel: (item) => `${item.width}x${item.height}`,
        renderItem: (item) => {

            return <CMAdhocChipContainer>
                <CMAdhocChip startIcon={<ScreenSizeIndicator
                    screenHeight={item.height}
                    screenWidth={item.width}
                    maxScreenWidth={1920}
                    maxScreenHeight={1080}
                    renderWidth={40}
                    renderHeight={30}
                />}>
                    <span style={{ fontSize: "22px", fontWeight: "bold" }}>{item.width}x{item.height}</span></CMAdhocChip>
            </CMAdhocChipContainer>;


        },
        getItemColor: (item, alpha) => getHashedColor(`${item.width}x${item.height}`, { alpha }),
    }),
} as const;


const DistinctContextObjectPieChart = <Tpayload extends FacetResultBase,>({ item, items, innerRadius = 7, outerRadius = 25, handler }: { item: Tpayload, items: Tpayload[], innerRadius?: number, outerRadius?: number, handler: FacetHandler<Tpayload> }) => {
    const itemKey = handler.getItemKey(item);

    // const chartData = items.map((contextObject) => ({
    //     ...contextObject,
    //     fill: handler.getItemKey(contextObject) === itemKey ? handler.getItemColor(contextObject) : "#fff",
    //     //fill: handler.getItemColor(contextObject),
    //     //border: "0",
    // }));

    const chartData: any[] = [];

    // generate the "before this one" pie slice
    let beforeCount = 0;
    let thisIndex = -1;
    for (let i = 0; i < items.length; i++) {
        const contextObject = items[i]!;
        if (itemKey === handler.getItemKey(contextObject)) {
            thisIndex = i;
            break;
        }
        beforeCount += contextObject.count;
    }

    if (thisIndex === -1) {
        throw new Error(`Item ${itemKey} not found in items`);
    }

    chartData.push({
        label: "before",
        count: beforeCount,
        fill: "#fff",
    });

    chartData.push({
        label: itemKey,
        count: item.count,
        fill: handler.getItemColor(item),
    });

    let afterCount = 0;
    for (let i = thisIndex + 1; i < items.length; i++) {
        const contextObject = items[i]!;
        afterCount += contextObject.count;
    }
    chartData.push({
        label: "after",
        count: afterCount,
        fill: "#fff",
    });



    return <PieChart width={60} height={60} data={chartData}>
        <Pie
            dataKey="count"
            stroke='0'
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            isAnimationActive={false}
        />
    </PieChart>;
};


interface FacetedTabContentProps<Tpayload extends FacetResultBase> {
    handler: FacetHandler<Tpayload>;
    items: Tpayload[];
};

const FacetedTabContent = <Tpayload extends FacetResultBase,>({ handler, items }: FacetedTabContentProps<Tpayload>) => {

    //const [selectedItem, setSelectedItem] = React.useState<Tpayload | null>(null);

    const totalCount = items.reduce((acc, item) => acc + item.count, 0);

    const chartData = items.map((item) => {
        if (!item || !handler.getItemKey(item)) {
            console.log(item);
            console.error(`No fill for item ${item}`);
            debugger;
        }
        const fill = handler.getItemColor(item);
        return ({
            itemCount: item.count,
            label: handler.getItemLabel(item),
            totalCount,
            percentageOfTotal01: (item.count / totalCount),
            percentageOfTotalStr: `${Math.round((item.count / totalCount) * 100)}%`,
            fill,
        });
    });

    const sortedItems = items.sort((a, b) => b.count - a.count);
    const kPieSize = 240;
    const kInnerRadius = 30;

    return items.length > 1 && <div className="DistinctContextObjectTabContent">
        <div className="header">
            <PieChart width={kPieSize} height={kPieSize} data={chartData}>
                <Pie
                    dataKey="itemCount"
                    nameKey={"label"}
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={kInnerRadius}
                    outerRadius={kPieSize / 2}
                    isAnimationActive={false}
                    label={(e) => {
                        return renderCustomizedLabel(e, chartData);
                    }}
                    labelLine={false}
                />
                <Tooltip content={e => renderCustomTooltip(e)} />
            </PieChart>
            <div>
                <table>
                    <tbody>
                        {sortedItems.map((contextObject) => {
                            const key = handler.getItemKey(contextObject);
                            const color = handler.getItemColor(contextObject);
                            const percentageOfTotal = `${Math.round((contextObject.count / totalCount) * 100)}%`
                            return <tr key={key}>
                                <td>
                                    <CMBar value01={contextObject.count / totalCount} color={color} />
                                </td>
                                <td>
                                    <span style={{ whiteSpace: "nowrap", fontFamily: "var(--ff-mono)", /*color*/ }}>
                                        {percentageOfTotal}
                                    </span>
                                </td>
                                <td>
                                    <span style={{ whiteSpace: "nowrap", fontFamily: "var(--ff-mono)", /*color*/ }}>
                                        ({contextObject.count} of {totalCount})
                                    </span>
                                </td>
                                <td>
                                    <span style={{ whiteSpace: "nowrap", fontFamily: "var(--ff-mono)", /*color*/ }}>
                                        {handler.renderItem(contextObject)}
                                    </span>
                                </td>
                            </tr>;
                        })}
                    </tbody>
                </table>
            </div>
        </div>

        {items.map((contextObject) => {
            const key = handler.getItemKey(contextObject);
            const percentageOfTotal = `${Math.round((contextObject.count / totalCount) * 100)}%`
            return <div key={key}>
                <div style={{ display: "flex", fontWeight: "bold", alignItems: "center", backgroundColor: handler.getItemColor(contextObject, "0.2"), borderTop: `3px solid ${handler.getItemColor(contextObject)}` }}>
                    <DistinctContextObjectPieChart item={contextObject} items={items} handler={handler} />
                    {handler.renderItem(contextObject)} ({contextObject.count} items) ({percentageOfTotal} of total)
                </div>
                {/* <GeneralFeatureDetailTable data={contextObject.items} onExcludeFeature={item.onExcludeFeature} onIsolateFeature={item.onIsolateFeature} onFilterContext={item.onFilterContext} /> */}
            </div>;
        })}

    </div>;
};


interface FeatureReportTopLevelDateSelectorProps {
    features: ActivityFeature[];
    bucket: string | null;
    bucketSize: ActivityReportTimeBucketSize;
    excludeYourself: boolean;
    excludeSysadmins: boolean;
    contextBeginsWith: string | undefined;
    refetchTrigger: number;
};

export const FacetedBreakdown = (props: FeatureReportTopLevelDateSelectorProps) => {
    const dashboardContext = useDashboardContext();
    const [tabId, setTabId] = React.useState<ActivityDetailTabId | "total">("total");

    const [result, { refetch }] = useQuery(getFacetedBreakdown, {
        features: props.features,
        excludeYourself: props.excludeYourself,
        excludeSysadmins: props.excludeSysadmins,
        contextBeginsWith: props.contextBeginsWith,
        bucket: props.bucket,
        aggregateBy: props.bucketSize,
        refreshTrigger: props.refetchTrigger,
    });
    if (!result) return null;

    const renderedTabs: CMTabPanelChild[] = [
        <CMTab key={9999} thisTabId="total" summaryTitle={`Total (${result.total.count})`} >
        </CMTab>,
        ...Object.entries(result.facets).map(([facetKey, facetInfo]) => {
            const handler = gHandlers[facetKey];
            if (!handler) {
                console.error(`No handler for facet ${facetKey}`);
            }
            return <CMTab key={facetKey} thisTabId={facetKey} summaryTitle={`${facetKey} (${facetInfo.length})`} enabled={facetInfo.length > 1} >
                <FacetedTabContent
                    handler={handler}
                    items={facetInfo as any}
                />
            </CMTab>;
        }),
    ];

    const bucketDateRange = props.bucket ? parseBucketToDateRange(props.bucket, props.bucketSize) : null;

    return <div>
        <div className="bucketLabel">
            {props.bucket && <>
                {props.bucket} [{bucketDateRange?.start.toLocaleString()} - {bucketDateRange?.end.toLocaleString()}] (range: {formatMillisecondsToDHMS(bucketDateRange!.end.getTime() - bucketDateRange!.start.getTime())})
            </>
            }
            {!props.bucket && <>No bucket selected</>}
        </div>
        <CMTabPanel handleTabChange={(e, newTabId: ActivityDetailTabId) => setTabId(newTabId)} selectedTabId={tabId} >
            {renderedTabs}
        </CMTabPanel>
    </div>;
};

