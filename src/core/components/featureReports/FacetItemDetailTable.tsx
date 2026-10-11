import React from "react";
import { invoke } from "@blitzjs/rpc";
import { Alert } from "@mui/material";
import { formatZonedDate } from "shared/dateTimePresentation";
import { getBandDateTimeFields } from "shared/dateTimePolicy";
import { useLocale } from "src/locale/components/useLocale";
import { smartTruncate } from "shared/utils";
import type { ActivityDetailInput, ActivityDetailResult, ActivityDetailRow } from "./activityReportTypes";
import { changeActivityFacetFilter, type ActivityReportFilters } from "./ClientFacetHandlers";
import { ActivityReferenceChips, ActivityScalarFilter, AnonymizedUserChip, ContextLabel } from "./FeatureReportBasics";
import getDetail from "./queries/getDetail";

interface FacetItemDetailTableProps {
    readonly input: ActivityDetailInput;
    readonly refetchTrigger: number;
    readonly onChangeFilters: (filters: ActivityReportFilters) => void;
}

function activityTimestamp(value: Date, timeZone: string, locale: string): string {
    const date = { value, timeZone };
    const calendar = formatZonedDate(date, locale, { year: "numeric", month: "2-digit", day: "2-digit" });
    const clock = formatZonedDate(date, locale, { timeStyle: "medium" });
    // An explicit offset distinguishes the two occurrences of a repeated DST hour.
    return `${calendar} ${clock} ${getBandDateTimeFields(value, timeZone).offset}`;
}

function RowFilters({ row, filters, onChange }: {
    readonly row: ActivityDetailRow; readonly filters: ActivityReportFilters; readonly onChange: (filters: ActivityReportFilters) => void;
}) {
    const dimensions: Array<{ readonly facet: React.ComponentProps<typeof ActivityScalarFilter>["facet"]; readonly value: string | null }> = [
        { facet: "locales", value: row.locale }, { facet: "languages", value: row.language }, { facet: "timezones", value: row.timezone },
        { facet: "pointerTypes", value: row.pointerType }, { facet: "deviceClasses", value: row.deviceClass },
        { facet: "operatingSystems", value: row.operatingSystem }, { facet: "browsers", value: row.browserName },
    ];
    return <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{dimensions.map(item => item.value !== null && item.value !== ""
        ? <ActivityScalarFilter key={item.facet} facet={item.facet} value={item.value} filters={filters} onChangeFilters={onChange} /> : null)}</div>;
}

export function FacetItemDetailTableRow({ row, index, timeZone, filters, onChangeFilters }: {
    readonly row: ActivityDetailRow; readonly index: number; readonly timeZone: string;
    readonly filters: ActivityReportFilters; readonly onChangeFilters: (filters: ActivityReportFilters) => void;
}) {
    const locale = useLocale();
    return <tr className="GeneralFeatureReportDetailItemRow" data-activity-row={row.rowKey}>
        <td>{index.toLocaleString(locale.formattingLocale ?? undefined)}</td>
        <td style={{ whiteSpace: "nowrap" }}><time dateTime={row.createdAt.toISOString()}>{activityTimestamp(row.createdAt, timeZone, locale.formattingLocale ?? "en")}</time></td>
        <td><AnonymizedUserChip value={row.userHash} /></td>
        <td style={{ width: 220, minWidth: 220, overflowWrap: "anywhere" }}>{row.context !== null && <ContextLabel value={row.context}
            onClickPart={prefix => onChangeFilters(changeActivityFacetFilter(filters, "contexts", "isolate", prefix))} />}</td>
        <td><ActivityScalarFilter facet="features" value={row.feature} filters={filters} onChangeFilters={onChangeFilters} /></td>
        <td style={{ maxWidth: 220, overflowWrap: "anywhere" }}>{row.queryText && <q>{row.queryText}</q>}</td>
        <td style={{ minWidth: 320 }}><ActivityReferenceChips row={row} timeZone={timeZone} filters={filters} onChangeFilters={onChangeFilters} /></td>
        <td style={{ width: 300, minWidth: 300 }}><RowFilters row={row} filters={filters} onChange={onChangeFilters} />
            {row.screenWidth !== null && row.screenHeight !== null && <span className="smallText">{row.screenWidth} × {row.screenHeight}</span>}</td>
        <td style={{ maxWidth: 320, overflowWrap: "anywhere" }}>{row.uri && <a href={row.uri} target="_blank" rel="noreferrer">{smartTruncate(row.uri, 80)}</a>}</td>
    </tr>;
}

export function FacetItemDetailTable({ input, refetchTrigger, onChangeFilters }: FacetItemDetailTableProps) {
    const locale = useLocale();
    const [loaded, setLoaded] = React.useState<{ readonly key: string; readonly result: ActivityDetailResult } | null>(null);
    const [failedKey, setFailedKey] = React.useState<string | null>(null);
    const requestKey = JSON.stringify([input, refetchTrigger]);
    React.useEffect(() => {
        let current = true;
        setLoaded(null);
        setFailedKey(null);
        void invoke(getDetail, input).then(result => {
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
    const result = loaded?.key === requestKey ? loaded.result : null;
    if (failedKey === requestKey) {
        return <Alert severity="error">{locale.getPlainString("activityReports.failed")}</Alert>;
    }
    if (!result) {
        return <div role="status">{locale.getPlainString("activityReports.loading")}</div>;
    }
    const filters = { timeline: input.filterSpec, facets: input.facetFilters };
    return <div className="ActivityLedger" data-activity-details data-activity-detail-total={result.metrics.totalRowCount}>
        <div>{locale.getPlainString("activityReports.showingRows", { shown: result.rows.length, total: result.metrics.totalRowCount })}</div>
        <div className="smallText">{locale.getPlainString("activityReports.newestFirst")} · {result.metrics.queryTimeMs} ms · {result.timeZone}</div>
        {result.metrics.totalRowCount > result.rowLimit && <Alert severity="info">{locale.getPlainString("activityReports.rowLimit", { limit: result.rowLimit })}</Alert>}
        {!result.rows.length ? <div>{locale.getPlainString("activityReports.noFacetItems")}</div> : <div style={{ overflowX: "auto" }}>
            <table className="FacetItemDetailTable" style={{ width: "max-content", minWidth: "100%" }}><thead><tr>
                <th>#</th><th>{locale.getPlainString("activityReports.when")}</th><th>{locale.getPlainString("activityReports.facet.users")}</th>
                <th>{locale.getPlainString("activityReports.facet.contexts")}</th><th>{locale.getPlainString("activityReports.facet.features")}</th>
                <th>{locale.getPlainString("activityReports.queryText")}</th>
                <th>{locale.getPlainString("activityReports.references")}</th><th>{locale.getPlainString("activityReports.device")}</th>
                <th>{locale.getPlainString("activityReports.savedUrl")}</th>
            </tr></thead><tbody>{result.rows.map((row, index) => <FacetItemDetailTableRow key={row.rowKey} row={row} index={index + 1}
                timeZone={result.timeZone} filters={filters} onChangeFilters={onChangeFilters} />)}</tbody></table>
        </div>}
    </div>;
}
