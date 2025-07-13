import { parseBucketToDateRange } from '@/shared/mysqlUtils';
import { formatMillisecondsToDHMS } from '@/shared/time';
import { invoke } from "@blitzjs/rpc";
import { useQuery } from "@blitzjs/rpc";
import { Button, CircularProgress, Collapse, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import * as React from 'react';
import { Pie, PieChart, Tooltip } from 'recharts';
import { CMSmallButton, InspectObject } from '../CMCoreComponents2';
import { CMTab, CMTabPanel, CMTabPanelChild } from "../TabPanel";
//
import { ActivityDetailTabId, FacetResultBase } from "./activityReportTypes";
import { FacetHandler, gClientFacetHandlers, FacetItemActions } from './ClientFacetHandlers';
import { FacetItemDetailTable, FacetItemDetailTableRow } from './FacetItemDetailTable';
import { CMBar } from './FeatureReportBasics';
import getFacetedBreakdown from "./queries/getFacetedBreakdown";
import getDetail from "./queries/getDetail";
import getDetailCsv from "./queries/getDetailCsv";
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

const downloadFile = (content: string, filename: string, mimeType: string = 'text/csv;charset=utf-8;') => {
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
    return <div key={key as React.Key} className={`CollapsibleFacetItemDetail ${handler.getItemKey(contextObject)}`}>
        <div
            className={`CollapsibleFacetItemDetailHeader ${supportsDrilldown ? "interactable" : ""}`}
            style={{ display: "flex", fontWeight: "bold", alignItems: "center", backgroundColor: handler.getItemColor(contextObject, "0.2"), borderTop: `3px solid ${handler.getItemColor(contextObject)}` }}
            onClick={() => setExpanded(!expanded)}
        >
            <DistinctContextObjectPieChart item={contextObject} items={items} handler={handler} />
            {handler.renderItem({ item: contextObject, filterSpec: baseFilterSpec, setFilterSpec: props.setFilterSpec, handler, reason: "facetItemDetailHeader" })} ({contextObject.count} items) ({percentageOfTotal} of total)
        </div>
        {supportsDrilldown && <div style={{ padding: '4px 8px', backgroundColor: handler.getItemColor(contextObject, "0.1") }}>
            <FacetItemActions
                item={contextObject}
                handler={handler}
                filterSpec={baseFilterSpec}
                setFilterSpec={props.setFilterSpec}
            />
        </div>}
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


const FacetedTabHeader = <Tpayload extends FacetResultBase, TKey>({ handler, items, ...props }: FacetedTabContentProps<Tpayload, TKey>) => {

    // Items are already sorted by count descending from the parent component
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

    const kPieSize = 240;
    const kInnerRadius = 30;

    return <div className="FacetedTabHeader header">
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
                    {items.map((contextObject) => {
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
    </div>;
};

const FacetedTabContent = <Tpayload extends FacetResultBase, TKey>({ handler, items, ...props }: FacetedTabContentProps<Tpayload, TKey>) => {

    const totalCount = items.reduce((acc, item) => acc + item.count, 0);

    return <div className="DistinctContextObjectTabContent">
        <FacetedTabHeader handler={handler} items={items} {...props} />

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


interface ExportDialogProps {
    open: boolean;
    onClose: () => void;
    filterSpec: FeatureReportFilterSpec;
    totalRows: number;
}

const ExportDialog = ({ open, onClose, filterSpec, totalRows }: ExportDialogProps) => {
    const [status, setStatus] = React.useState<'idle' | 'exporting' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = React.useState<string>('');

    const handleExport = async () => {
        setStatus('exporting');
        setErrorMessage('');

        try {
            // Call the CSV export query
            const result = await invoke(getDetailCsv, {
                refreshTrigger: Date.now(),
                filterSpec,
            });

            if (result) {
                // Create and download the file
                downloadFile(result.csvContent, result.filename);

                setStatus('success');
            } else {
                setStatus('error');
                setErrorMessage('Export failed: No data returned');
            }
        } catch (error) {
            setStatus('error');
            setErrorMessage(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const handleClose = () => {
        if (status !== 'exporting') {
            onClose();
            setStatus('idle');
            setErrorMessage('');
        }
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>Export Activity Data</DialogTitle>
            <DialogContent>
                {status === 'idle' && (
                    <div>
                        <p>This will export activity records to a file.</p>
                        <p>Total rows: <strong>{totalRows.toLocaleString()}</strong></p>
                        <p>The file will include all activity details with related entities (events, songs, files, etc.) in a format suitable for analysis in Excel or other tools.</p>
                    </div>
                )}
                {status === 'exporting' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <CircularProgress size={24} />
                        <span>Preparing export...</span>
                    </div>
                )}
                {status === 'success' && (
                    <div style={{ color: 'green' }}>
                        ✅ Export completed! The file should start downloading automatically.
                    </div>
                )}
                {status === 'error' && (
                    <div style={{ color: 'red' }}>
                        ❌ {errorMessage}
                    </div>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} disabled={status === 'exporting'}>
                    {status === 'success' ? 'Close' : 'Cancel'}
                </Button>
                {status === 'idle' && (
                    <Button onClick={handleExport} variant="contained" color="primary">
                        Export CSV
                    </Button>
                )}
                {status === 'error' && (
                    <Button onClick={handleExport} variant="contained" color="primary">
                        Retry
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
};

interface ExportButtonProps {
    filterSpec: FeatureReportFilterSpec;
    totalRows: number;
}

const ExportButton = ({ filterSpec, totalRows }: ExportButtonProps) => {
    const [showDialog, setShowDialog] = React.useState(false);

    return (
        <>
            <Button
                // variant="outlined"
                // size="small"
                onClick={() => setShowDialog(true)}
                style={{ margin: '8px' }}
            >
                📊 Export Data...
            </Button>
            <ExportDialog
                open={showDialog}
                onClose={() => setShowDialog(false)}
                filterSpec={filterSpec}
                totalRows={totalRows}
            />
        </>
    );
};


interface ActivityLedgerProps {
    filterSpec: FeatureReportFilterSpec;
    setFilterSpec: (spec: FeatureReportFilterSpec) => void;
    refreshTrigger: number;
}

const ActivityLedger = ({ filterSpec, setFilterSpec, refreshTrigger }: ActivityLedgerProps) => {
    const [result] = useQuery(getDetail, {
        refreshTrigger,
        filterSpec,
    });

    if (!result) {
        return <div>Loading activity ledger...</div>;
    }

    if (!result.rows || result.rows.length === 0) {
        return (
            <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                <h3>No activities found</h3>
                <p>Try adjusting your filters or selecting a different time bucket.</p>
            </div>
        );
    }

    // Sort chronologically (newest first)
    const sortedItems = [...result.rows].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return (
        <div className="ActivityLedger">
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                <ExportButton
                    filterSpec={filterSpec}
                    totalRows={result.metrics.totalRowCount}
                />
                <div style={{ fontFamily: 'var(--ff-mono)', fontSize: '14px', color: '#555' }}>
                    📋 Showing {sortedItems.length} of {result.metrics.totalRowCount.toLocaleString()} activities (Query: {result.metrics.queryTimeMs}ms) - Chronological Order (Newest First)
                </div>
            </div>

            <table className="FacetItemDetailTable" style={{ borderLeft: '3px solid #e3f2fd' }}>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>When</th>
                        <th>User</th>
                        <th>Context</th>
                        <th>Feature</th>
                        <th>Query</th>
                        <th>Relations</th>
                        <th>URI</th>
                        <th>Locale</th>
                        <th>Device</th>
                        <th>Browser</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedItems.map((item, index) => (
                        <FacetItemDetailTableRow
                            key={item.id}
                            value={item}
                            index={index + 1} // Show chronological index starting from 1
                            filterSpec={filterSpec}
                            setFilterSpec={setFilterSpec}
                        />
                    ))}
                </tbody>
            </table>
        </div>
    );
};


interface FeatureReportTopLevelDateSelectorProps {
    refetchTrigger: number;
    filterSpec: FeatureReportFilterSpec;
    setFilterSpec: (spec: FeatureReportFilterSpec) => void;
};

export const FacetedBreakdown = (props: FeatureReportTopLevelDateSelectorProps) => {
    //const dashboardContext = useDashboardContext();
    const [tabId, setTabId] = React.useState<ActivityDetailTabId | "total" | "ledger">("total");

    const [result, { refetch }] = useQuery(getFacetedBreakdown, {
        refreshTrigger: props.refetchTrigger,
        filterSpec: props.filterSpec,
    });
    if (!result) return null;

    // Sort all facet items by count descending for consistent ordering across all components
    const sortedFacets = Object.entries(result.facets).map(([facetKey, facetInfo]) => [
        facetKey,
        [...facetInfo].sort((a, b) => b.count - a.count)
    ] as const);

    const renderedTabs: CMTabPanelChild[] = [
        <CMTab key={9999} thisTabId="total" summaryTitle={`Total (${result.total.count})`} >
            <div className='summaryFacetTab' style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {
                    ...sortedFacets.map(([facetKey, facetInfo]) => {
                        const handler = gClientFacetHandlers[facetKey];
                        if (!handler) {
                            console.error(`No handler for facet ${facetKey}`);
                            return null;
                        }
                        if (facetInfo.length === 0) return null;
                        return <div className='summaryFacetHeader' key={facetKey}>
                            <h2>{facetKey.toUpperCase()}</h2>
                            <FacetedTabHeader
                                key={facetKey}
                                handler={handler}
                                setFilterSpec={props.setFilterSpec}
                                items={facetInfo as any}
                                filterSpec={props.filterSpec}
                                refreshTrigger={props.refetchTrigger}
                            />
                        </div>;
                    }
                    )}
            </div>
        </CMTab>,
        <CMTab key="ledger" thisTabId="ledger" summaryTitle="Activity Ledger">
            <ActivityLedger
                filterSpec={props.filterSpec}
                setFilterSpec={props.setFilterSpec}
                refreshTrigger={props.refetchTrigger}
            />
        </CMTab>,
        ...sortedFacets.map(([facetKey, facetInfo]) => {
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
        <CMTabPanel handleTabChange={(e, newTabId: ActivityDetailTabId | "total" | "ledger") => setTabId(newTabId)} selectedTabId={tabId} >
            {renderedTabs}
        </CMTabPanel>
    </div>;
};

