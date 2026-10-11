import { invoke } from "@blitzjs/rpc";
import { Alert } from "@mui/material";
import React from "react";
import { Pie, PieChart, Tooltip } from "recharts";
import { getHashedColor } from "shared/utils";
import { useLocale } from "src/locale/components/useLocale";
import { CMButton, CMButtonGroup } from "../CMCoreComponents2";
import { CMTab, CMTabPanel } from "../TabPanel";
import { activityFacetKeys, type ActivityDetailInput, type ActivityFacetItem, type ActivityFacetKey, type ActivityReportReferences, type FacetedBreakdownInput, type FacetedBreakdownResult } from "./activityReportTypes";
import { activityFacetDetailSelection, activityFacetFilterValues, activityFacetSupportsFilter, changeActivityFacetFilter, type ActivityFacetFilterOperation, type ActivityReportFilters } from "./ClientFacetHandlers";
import { ActivityFacetLabel } from "./FeatureReportBasics";
import { FacetItemDetailTable } from "./FacetItemDetailTable";
import { ExportButton } from "./ExportButton";
import getFacetedBreakdown from "./queries/getFacetedBreakdown";

interface FacetedBreakdownProps {
    readonly input: FacetedBreakdownInput;
    readonly refetchTrigger: number;
    readonly onChangeFilters: (filters: ActivityReportFilters) => void;
}

function FacetFilterControls({ facet, filters, onChange }: {
    readonly facet: ActivityFacetKey; readonly filters: ActivityReportFilters; readonly onChange: (filters: ActivityReportFilters) => void;
}) {
    const locale = useLocale();
    const values = activityFacetFilterValues(filters, facet);
    if (!values.include.length && !values.exclude.length) {
        return null;
    }
    const change = (operation: ActivityFacetFilterOperation, key = "") => onChange(changeActivityFacetFilter(filters, facet, operation, key));
    return <div data-facet-filters={facet} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4 }}>
        <strong>{locale.getPlainString(`activityReports.facet.${facet}`)}</strong>
        {values.include.map(key => <CMButton key={`include:${key}`} onClick={() => change("removeInclude", key)}>
            {locale.getPlainString("activityReports.included")}: {key} ×
        </CMButton>)}
        {values.exclude.map(key => <CMButton key={`exclude:${key}`} onClick={() => change("removeExclude", key)}>
            {locale.getPlainString("activityReports.excluded")}: {key} ×
        </CMButton>)}
        <CMButton onClick={() => change("clear")}>{locale.getPlainString("activityReports.clearFilters")}</CMButton>
    </div>;
}

function FacetDistribution({ facet, items, references, timeZone, filters, onChange, details }: {
    readonly facet: ActivityFacetKey; readonly items: readonly ActivityFacetItem[]; readonly filters: ActivityReportFilters;
    readonly onChange: (filters: ActivityReportFilters) => void;
    readonly references: ActivityReportReferences;
    readonly timeZone: string;
    readonly details: { readonly input: FacetedBreakdownInput; readonly refetchTrigger: number } | null;
}) {
    const locale = useLocale();
    const [ascending, setAscending] = React.useState(false);
    const [expandedKey, setExpandedKey] = React.useState<string | null>(null);
    const detailInput = React.useMemo(() => {
        const selection = expandedKey === null ? null : activityFacetDetailSelection(facet, expandedKey);
        return details && selection ? { ...details.input, detail: selection } : null;
    }, [details, expandedKey, facet]);
    const sorted = [...items].sort((left, right) => (ascending ? left.count - right.count : right.count - left.count)
        || left.label.localeCompare(right.label, locale.formattingLocale ?? undefined) || left.key.localeCompare(right.key));
    const total = sorted.reduce((count, row) => count + row.count, 0);
    const chartData = sorted.map(item => ({ ...item, fill: getHashedColor(item.key) }));
    const countLabel = locale.getPlainString("activityReports.count");
    return <section className="summaryFacetHeader" data-facet-key={facet}>
        <h2>{locale.getPlainString(`activityReports.facet.${facet}`)}</h2>
        {facet === "users" && <div className="smallText">{locale.getPlainString("activityReports.anonymousActions")}</div>}
        <CMButtonGroup>
            <CMButton enabled={ascending} onClick={() => setAscending(false)}>{locale.getPlainString("activityReports.mostFirst")}</CMButton>
            <CMButton enabled={!ascending} onClick={() => setAscending(true)}>{locale.getPlainString("activityReports.leastFirst")}</CMButton>
        </CMButtonGroup>
        {!items.length ? <div>{locale.getPlainString("activityReports.noFacetItems")}</div> : <div className="FacetedTabHeader header" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
            <PieChart width={240} height={240}>
                <Pie dataKey="count" nameKey="label" data={chartData} innerRadius={30} outerRadius={100} isAnimationActive={false} />
                <Tooltip />
            </PieChart>
            <table>
                <thead><tr><th>{locale.getPlainString(`activityReports.facet.${facet}`)}</th><th>{countLabel}</th><th>%</th><th>{locale.getPlainString("activityReports.filters")}</th></tr></thead>
                <tbody>{sorted.map(item => <tr key={item.key} data-facet-item={item.key} data-facet-count={item.count}>
                    <td style={{ maxWidth: 320, overflowWrap: "anywhere" }}><ActivityFacetLabel facet={facet} item={item} references={references} timeZone={timeZone} /></td>
                    <td>{item.count.toLocaleString(locale.formattingLocale ?? undefined)}</td>
                    <td>{(item.count / total).toLocaleString(locale.formattingLocale ?? undefined, { style: "percent", maximumFractionDigits: 1 })}</td>
                    <td>{activityFacetSupportsFilter(facet) && <CMButtonGroup>
                        <CMButton onClick={() => onChange(changeActivityFacetFilter(filters, facet, "isolate", item.key))}>{locale.getPlainString("activityReports.isolate")}</CMButton>
                        {facet !== "contexts" && <CMButton onClick={() => onChange(changeActivityFacetFilter(filters, facet, "hide", item.key))}>{locale.getPlainString("activityReports.hide")}</CMButton>}
                        {details && <CMButton aria-expanded={expandedKey === item.key} onClick={() => setExpandedKey(current => current === item.key ? null : item.key)}>{locale.getPlainString("activityReports.details")}</CMButton>}
                    </CMButtonGroup>}</td>
                </tr>)}</tbody>
            </table>
        </div>}
        {detailInput && details && <FacetItemDetailTable input={detailInput} refetchTrigger={details.refetchTrigger} onChangeFilters={onChange} />}
    </section>;
}

export function FacetedBreakdown({ input, refetchTrigger, onChangeFilters }: FacetedBreakdownProps) {
    const locale = useLocale();
    const [loaded, setLoaded] = React.useState<{ readonly key: string; readonly result: FacetedBreakdownResult } | null>(null);
    const [failedKey, setFailedKey] = React.useState<string | null>(null);
    const [tab, setTab] = React.useState<string>("ledger");
    const requestKey = JSON.stringify([input, refetchTrigger]);
    React.useEffect(() => {
        let current = true;
        setFailedKey(null);
        setLoaded(null);
        void invoke(getFacetedBreakdown, input).then(result => {
            if (current) {
                setLoaded({ key: requestKey, result });
            }
        }).catch(() => {
            if (current) {
                setFailedKey(requestKey);
            }
        });
        return () => { current = false; };
    }, [input, refetchTrigger, requestKey]);
    const filters = { timeline: input.filterSpec, facets: input.facetFilters };
    const result = loaded?.key === requestKey ? loaded.result : null;
    const ledgerInput = React.useMemo<ActivityDetailInput>(() => ({ ...input, detail: { facet: "total" } }), [input]);
    const detailContext = React.useMemo(() => ({ input, refetchTrigger }), [input, refetchTrigger]);
    const renderFacet = (facet: ActivityFacetKey, withDetails: boolean) => result && <FacetDistribution key={facet} facet={facet}
        items={result.facets[facet]} references={result.references} timeZone={result.timeZone} filters={filters} onChange={onChangeFilters} details={withDetails ? detailContext : null} />;
    return <div data-activity-breakdown>
        <h2>{locale.getPlainString("activityReports.breakdown")}: {input.selectedBucket}</h2>
        <div>{locale.getPlainString("activityReports.timeZone")}: {result?.timeZone}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{activityFacetKeys.map(facet => <FacetFilterControls key={facet} facet={facet} filters={filters} onChange={onChangeFilters} />)}</div>
        {failedKey === requestKey ? <Alert severity="error">{locale.getPlainString("activityReports.failed")}</Alert>
            : !result ? <div role="status">{locale.getPlainString("activityReports.loading")}</div>
                : <div data-activity-facet-total={result.total.count}>
                    <ExportButton input={input} refetchTrigger={refetchTrigger} />
                    <div>{locale.getPlainString("activityReports.count")}: {result.total.count.toLocaleString(locale.formattingLocale ?? undefined)}</div>
                    <div className="smallText">{result.metrics.queryTimeMs} ms</div>
                    <CMTabPanel selectedTabId={tab} handleTabChange={(_event, value) => { if (typeof value === "string") { setTab(value); } }}>
                        {[
                        <CMTab key="ledger" thisTabId="ledger" summaryTitle={locale.getPlainString("activityReports.ledger")}>
                            <FacetItemDetailTable input={ledgerInput} refetchTrigger={refetchTrigger} onChangeFilters={onChangeFilters} />
                        </CMTab>,
                        <CMTab key="total" thisTabId="total" summaryTitle={locale.getPlainString("activityReports.summary")}>
                            <div className="summaryFacetTab" style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>{activityFacetKeys.filter(facet => result.facets[facet].length).map(facet => renderFacet(facet, false))}</div>
                            {!result.total.count && <div>{locale.getPlainString("activityReports.noFacetItems")}</div>}
                        </CMTab>,
                        ...activityFacetKeys.map(facet => <CMTab key={facet} thisTabId={facet} summaryTitle={`${locale.getPlainString(`activityReports.facet.${facet}`)} (${result.facets[facet].length})`}>{renderFacet(facet, true)}</CMTab>),
                        ]}
                    </CMTabPanel>
                </div>}
    </div>;
}
