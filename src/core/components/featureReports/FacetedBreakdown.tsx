import { parseBucketToDateRange } from '@/shared/mysqlUtils';
import { formatMillisecondsToDHMS } from '@/shared/time';
import { useQuery } from "@blitzjs/rpc";
import { Collapse } from '@mui/material';
import * as React from 'react';
import { Pie, PieChart, Tooltip } from 'recharts';
import { CMSmallButton } from '../CMCoreComponents2';
import { CMTab, CMTabPanel, CMTabPanelChild } from "../TabPanel";
//
import { ActivityDetailTabId, FacetResultBase } from "./activityReportTypes";
import { FacetHandler, gClientFacetHandlers } from './ClientFacetHandlers';
import { FacetItemDetailTable } from './FacetItemDetailTable';
import { CMBar } from './FeatureReportBasics';
import getFacetedBreakdown from "./queries/getFacetedBreakdown";
import { FeatureReportFilterSpec } from './server/facetProcessor';


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

const DistinctContextObjectPieChart = <Tpayload extends FacetResultBase, TKey>({ item, items, innerRadius = 7, outerRadius = 25, handler }: { item: Tpayload, items: Tpayload[], innerRadius?: number, outerRadius?: number, handler: FacetHandler<Tpayload, TKey> }) => {
    const itemKey = handler.getItemKey(item);

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




interface CollapsibleFacetItemDetailProps<Tpayload extends FacetResultBase, TKey> {
    handler: FacetHandler<Tpayload, TKey>;
    items: Tpayload[];
    contextObject: Tpayload;
    baseFilterSpec: FeatureReportFilterSpec;
    setFilterSpec: (spec: FeatureReportFilterSpec) => void;
    totalCount: number;
    refreshTrigger: number;
};

const CollapsibleFacetItemDetail = <Tpayload extends FacetResultBase, TKey>({ handler, contextObject, items, totalCount, baseFilterSpec, refreshTrigger, ...props }: CollapsibleFacetItemDetailProps<Tpayload, TKey>) => {
    const [expanded, setExpanded] = React.useState(false);
    const supportsDrilldown = handler.supportsDrilldown;

    const key = handler.getItemKey(contextObject);
    const percentageOfTotal = `${Math.round((contextObject.count / totalCount) * 100)}%`
    return <div key={key as React.Key}>
        <div
            className={`${supportsDrilldown ? "interactable" : ""}`}
            style={{ display: "flex", fontWeight: "bold", alignItems: "center", backgroundColor: handler.getItemColor(contextObject, "0.2"), borderTop: `3px solid ${handler.getItemColor(contextObject)}` }}
            onClick={() => setExpanded(!expanded)}
        >
            <DistinctContextObjectPieChart item={contextObject} items={items} handler={handler} />
            {handler.renderItem({ item: contextObject, filterSpec: baseFilterSpec, setFilterSpec: props.setFilterSpec, handler, reason: "facetItemDetailHeader" })} ({contextObject.count} items) ({percentageOfTotal} of total)
        </div>
        {supportsDrilldown && expanded && <Collapse in={expanded}>
            <React.Suspense>
                <FacetItemDetailTable filterSpec={handler.addFilter(baseFilterSpec, contextObject)} refreshTrigger={refreshTrigger} setFilterSpec={props.setFilterSpec} />
            </React.Suspense>
        </Collapse>}
    </div>;
};

interface FacetedTabContentProps<Tpayload extends FacetResultBase, TKey> {
    handler: FacetHandler<Tpayload, TKey>;
    items: Tpayload[];
    filterSpec: FeatureReportFilterSpec;
    setFilterSpec: (spec: FeatureReportFilterSpec) => void;
    refreshTrigger: number;
};

const FacetedTabContent = <Tpayload extends FacetResultBase, TKey>({ handler, items, ...props }: FacetedTabContentProps<Tpayload, TKey>) => {

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

    return <div className="DistinctContextObjectTabContent">
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
                            return <tr key={key as React.Key}>
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
                                    {/* <CMAdhocChipContainer> */}
                                    {handler.renderItem({ item: contextObject, filterSpec: props.filterSpec, setFilterSpec: props.setFilterSpec, handler, reason: "facetItemSummaryHeader" })}
                                    {/* </CMAdhocChipContainer> */}

                                </td>
                            </tr>;
                        })}
                    </tbody>
                </table>
            </div>
        </div>

        {items.map((contextObject) => <CollapsibleFacetItemDetail
            key={handler.getItemKey(contextObject) as React.Key}
            contextObject={contextObject}
            handler={handler}
            items={items}
            setFilterSpec={props.setFilterSpec}
            totalCount={totalCount}
            baseFilterSpec={props.filterSpec}
            refreshTrigger={props.refreshTrigger}
        />)}

    </div>;
};


interface FeatureReportTopLevelDateSelectorProps {
    refetchTrigger: number;
    filterSpec: FeatureReportFilterSpec;
    setFilterSpec: (spec: FeatureReportFilterSpec) => void;
};

export const FacetedBreakdown = (props: FeatureReportTopLevelDateSelectorProps) => {
    //const dashboardContext = useDashboardContext();
    const [tabId, setTabId] = React.useState<ActivityDetailTabId | "total">("total");

    const [result, { refetch }] = useQuery(getFacetedBreakdown, {
        refreshTrigger: props.refetchTrigger,
        filterSpec: props.filterSpec,
    });
    if (!result) return null;

    const renderedTabs: CMTabPanelChild[] = [
        <CMTab key={9999} thisTabId="total" summaryTitle={`Total (${result.total.count})`} >
        </CMTab>,
        ...Object.entries(result.facets).map(([facetKey, facetInfo]) => {
            const handler = gClientFacetHandlers[facetKey];
            if (!handler) {
                console.error(`No handler for facet ${facetKey}`);
            }
            return <CMTab key={facetKey} thisTabId={facetKey} summaryTitle={`${facetKey} (${facetInfo.length})`} enabled={facetInfo.length > 0} >
                <FacetedTabContent
                    handler={handler}
                    setFilterSpec={props.setFilterSpec}
                    items={facetInfo as any}
                    filterSpec={props.filterSpec}
                    refreshTrigger={props.refetchTrigger}
                />
            </CMTab>;
        }),
    ];

    const bucketDateRange = props.filterSpec.selectedBucket ? parseBucketToDateRange(props.filterSpec.selectedBucket, props.filterSpec.bucketSize) : null;

    return <div>
        <CMSmallButton>{result.metrics.queryTimeMs}ms</CMSmallButton>
        <div className="bucketLabel">
            {props.filterSpec.selectedBucket && <>
                {props.filterSpec.selectedBucket} [{bucketDateRange?.start.toLocaleString()} - {bucketDateRange?.end.toLocaleString()}] (range: {formatMillisecondsToDHMS(bucketDateRange!.end.getTime() - bucketDateRange!.start.getTime())})
            </>
            }
            {!props.filterSpec.selectedBucket && <>No bucket selected</>}
        </div>
        <CMTabPanel handleTabChange={(e, newTabId: ActivityDetailTabId) => setTabId(newTabId)} selectedTabId={tabId} >
            {renderedTabs}
        </CMTabPanel>
    </div>;
};

