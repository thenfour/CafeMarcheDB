import React from "react";
import { invoke } from "@blitzjs/rpc";
import { Alert } from "@mui/material";
import { formatZonedDate } from "shared/dateTimePresentation";
import { getBandDateTimeFields } from "shared/dateTimePolicy";
import { useLocale } from "src/locale/components/useLocale";
import { CMButton, CMButtonGroup } from "../CMCoreComponents2";
import type { ActivityDetailInput, ActivityDetailResult, ActivityDetailRow, ActivityFacetKey } from "./activityReportTypes";
import { changeActivityFacetFilter, type ActivityReportFilters } from "./ClientFacetHandlers";
import { ActivityReferenceChips, AnonymizedUserChip } from "./FeatureReportBasics";
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
    const dimensions: Array<{ readonly facet: ActivityFacetKey; readonly value: string | null }> = [
        { facet: "locales", value: row.locale }, { facet: "languages", value: row.language }, { facet: "timezones", value: row.timezone },
        { facet: "pointerTypes", value: row.pointerType }, { facet: "deviceClasses", value: row.deviceClass },
        { facet: "operatingSystems", value: row.operatingSystem }, { facet: "browsers", value: row.browserName },
    ];
    const locale = useLocale();
    return <CMButtonGroup>{dimensions.filter(item => item.value !== null && item.value !== "").map(item => <CMButton key={item.facet}
        tooltip={`${locale.getPlainString("activityReports.isolate")}: ${locale.getPlainString(`activityReports.facet.${item.facet}`)}`}
        onClick={() => { if (item.value !== null) { onChange(changeActivityFacetFilter(filters, item.facet, "isolate", item.value)); } }}>
        {item.value}
    </CMButton>)}</CMButtonGroup>;
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
        <td style={{ width: 220, minWidth: 220, overflowWrap: "anywhere" }}>{row.context !== null && <CMButton
            tooltip={locale.getPlainString("activityReports.isolate")}
            onClick={() => { if (row.context !== null) { onChangeFilters(changeActivityFacetFilter(filters, "contexts", "isolate", row.context)); } }}>{row.context}</CMButton>}</td>
        <td><CMButton tooltip={locale.getPlainString("activityReports.isolate")}
            onClick={() => onChangeFilters(changeActivityFacetFilter(filters, "features", "isolate", row.feature))}>{row.feature}</CMButton></td>
        <td style={{ minWidth: 320 }}><ActivityReferenceChips row={row} timeZone={timeZone} filters={filters} onChangeFilters={onChangeFilters} /></td>
        <td style={{ width: 300, minWidth: 300 }}><RowFilters row={row} filters={filters} onChange={onChangeFilters} />
            {row.screenWidth !== null && row.screenHeight !== null && <span className="smallText">{row.screenWidth} × {row.screenHeight}</span>}</td>
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
                <th>{locale.getPlainString("activityReports.references")}</th><th>{locale.getPlainString("activityReports.device")}</th>
            </tr></thead><tbody>{result.rows.map((row, index) => <FacetItemDetailTableRow key={row.rowKey} row={row} index={index + 1}
                timeZone={result.timeZone} filters={filters} onChangeFilters={onChangeFilters} />)}</tbody></table>
        </div>}
    </div>;
}

// MIGRATION_RESTORE: activity-reports
// Source: 9306d02db399b172ad5e9957c64e5930054faae8:src/core/components/featureReports/FacetItemDetailTable.tsx:1-224
// Reason: Legacy activity readers lack selected-band ownership and localized reference contracts, blocking application recovery.
// Restore: Restore activity timelines, facets, filters, drill-down details and CSV export with fresh authorization, explicit band ownership, localized references and public identities; preserve anonymization and redaction.
// Verification: Reactivate the preserved projection/filter specifications; test two bands, platform policy, grant revocation, anonymization, private references, CSV and browser report navigation/context switches.
// SHA256: f9582b138d143db47f8ae2e90e1c1681de5dfada3f6e6ab0e28582e3e4ce0f77
// MIGRATION_REFERENCE_BEGIN
// import { smartTruncate } from "@/shared/utils";
// import { useQuery } from "@blitzjs/rpc";
// import { Tooltip as MuiTooltip } from "@mui/material";
// import { gIconMap } from "../../db3/components/IconMap";
// import { CMChip } from "../CMChip";
// import { InstrumentChip } from "../CMCoreComponents";
// import { AdminInspectObject, CMSmallButton } from "../CMCoreComponents2";
// import { AgeRelativeToNow } from "../DateTime/RelativeTimeComponents";
// //
// import { TGetFeatureReportDetailResult } from "./activityReportTypes";
// import { ActivityFeature } from "./activityTracking";
// import { gClientFacetHandlers, FilterableChip } from "./ClientFacetHandlers";
// import { AnonymizedUserChip, BrowserChip, ContextLabel, DeviceClassChip, FeatureLabel, OperatingSystemChip, PointerTypeChip } from "./FeatureReportBasics";
// import getDetail from "./queries/getDetail";
// import { FeatureReportFilterSpec } from "./server/facetProcessor";
// import { EventChip } from "../event/EventChips";
// import { SongChip } from "../song/SongChip";
// import { FileChip } from "../file/FileChip";
// import { WikiPageChip } from "../wiki/WikiPageChip";
// import { AttendanceChip } from "../event/AttendanceChips";
//
//
// interface FacetItemDetailTableRowProps {
//     value: TGetFeatureReportDetailResult['rows'][0];
//     index: number;
//     filterSpec: FeatureReportFilterSpec;
//     setFilterSpec: (spec: FeatureReportFilterSpec) => void;
// };
//
// export const FacetItemDetailTableRow = ({ value, index, ...props }: FacetItemDetailTableRowProps) => {
//     const feature = value.feature as ActivityFeature;
//
//     return <tr className="GeneralFeatureReportDetailItemRow">
//         <td style={{ fontFamily: "var(--ff-mono)" }}>
//             <AdminInspectObject src={value} />
//             <span>#{index}</span>
//         </td>
//         <td>
//             <MuiTooltip title={<AgeRelativeToNow value={value.createdAt} />} disableInteractive>
//                 <span>{value.createdAt.toLocaleString()}</span>
//             </MuiTooltip>
//         </td>
//         <td>{value.userHash && <AnonymizedUserChip value={value.userHash} />}</td>
//         <td>{value.context && <ContextLabel value={value.context} onClickPart={(part) => {
//             props.setFilterSpec(gClientFacetHandlers.contexts.addFilter(props.filterSpec, {
//                 count: 0,
//                 context: part,
//             }));
//         }} />}</td>
//         <td>
//             <FilterableChip
//                 item={{ feature: feature, count: 0 }}
//                 handler={gClientFacetHandlers.features}
//                 filterSpec={props.filterSpec}
//                 setFilterSpec={props.setFilterSpec}
//             >
//                 <FeatureLabel feature={feature} />
//             </FilterableChip>
//         </td>
//         <td style={{ whiteSpace: "nowrap" }}>
//             {value.queryText && <span className="queryText">"<span className="actualQueryText">{value.queryText}</span>"</span>}
//         </td>
//         <td>
//             {value.song && <FilterableChip
//                 item={{ songId: value.song.publicId, name: value.song.name, count: 0 }}
//                 handler={gClientFacetHandlers.songs}
//                 filterSpec={props.filterSpec}
//                 setFilterSpec={props.setFilterSpec}
//             >
//                 <SongChip value={value.song} startAdornment={gIconMap.MusicNote()} useHashedColor={true} />
//             </FilterableChip>}
//             {value.event && <FilterableChip
//                 item={{ eventId: value.event.publicId, name: value.event.name, startsAt: value.event.startsAt, statusId: value.event.statusId, typeId: value.event.typeId, count: 0 }}
//                 handler={gClientFacetHandlers.events}
//                 filterSpec={props.filterSpec}
//                 setFilterSpec={props.setFilterSpec}
//             >
//                 <EventChip value={value.event} startAdornment={gIconMap.CalendarMonth()} useHashedColor={true} />
//             </FilterableChip>}
//             {value.file && <FileChip value={value.file} startAdornment={gIconMap.AttachFile()} useHashedColor={true} />}
//             {value.wikiPage && <FilterableChip
//                 item={{ wikiPageId: value.wikiPage.publicId, slug: value.wikiPage.slug, count: 0 }}
//                 handler={gClientFacetHandlers.wikiPages}
//                 filterSpec={props.filterSpec}
//                 setFilterSpec={props.setFilterSpec}
//             >
//                 <WikiPageChip slug={value.wikiPage.slug} startAdornment={gIconMap.Article()} useHashedColor={true} />
//             </FilterableChip>}
//
//             {value.eventSegmentId && <CMChip>Segment #{value.eventSegmentId}</CMChip>}
//             {value.customLinkId && <FilterableChip
//                 item={{ customLinkId: value.customLinkId, name: value.customLink?.name ?? "Custom link", count: 0 }}
//                 handler={gClientFacetHandlers.customLinks}
//                 filterSpec={props.filterSpec}
//                 setFilterSpec={props.setFilterSpec}
//             >
//                 <CMChip>{value.customLink?.name ?? "Custom link"}</CMChip>
//             </FilterableChip>}
//             {value.eventSongListId && <CMChip>Setlist #{value.eventSongListId}</CMChip>}
//             {value.frontpageGalleryItemId && <CMChip>Gallery item #{value.frontpageGalleryItemId}</CMChip>}
//             {value.menuLinkId && <FilterableChip
//                 item={{ menuLinkId: value.menuLinkId, name: value.menuLink?.caption ?? "Menu link", count: 0 }}
//                 handler={gClientFacetHandlers.menuLinks}
//                 filterSpec={props.filterSpec}
//                 setFilterSpec={props.setFilterSpec}
//             >
//                 <CMChip>{value.menuLink?.caption ?? "Menu link"}</CMChip>
//             </FilterableChip>}
//             {value.setlistPlanId && <CMChip>Setlist plan {value.setlistPlan?.name ?? value.setlistPlanId}</CMChip>}
//             {value.songCreditTypeId && <CMChip>
//                 Song credit {value.songCreditType?.text ?? value.songCreditTypeId}
//             </CMChip>}
//
//             {value.attendanceId && <AttendanceChip
//                 value={value.attendanceId}
//                 event={value.event || undefined}
//                 eventSegment={value.eventSegment || undefined}
//             />}
//             {value.instrumentId && <InstrumentChip value={value.instrumentId} />}
//         </td>
//         <td>{value.uri && <a href={value.uri} target="_blank" rel="noreferrer" >{smartTruncate(value.uri, 60)}</a>}</td>
//         <td>
//             {value.locale && <FilterableChip
//                 item={{ locale: value.locale, count: 0 }}
//                 handler={gClientFacetHandlers.locales}
//                 filterSpec={props.filterSpec}
//                 setFilterSpec={props.setFilterSpec}
//             >
//                 <div className="adHocChipContainer">
//                     <div className="adHocChip">{value.locale}</div>
//                 </div>
//             </FilterableChip>}
//         </td >
//         <td>
//             <div className="adHocChipContainer">
//                 {value.pointerType && <PointerTypeChip
//                     value={value.pointerType}
//                     filtering={{
//                         item: { pointerType: value.pointerType as any, count: 0 },
//                         handler: gClientFacetHandlers.pointerTypes,
//                         filterSpec: props.filterSpec,
//                         setFilterSpec: props.setFilterSpec
//                     }}
//                 />}
//                 {value.deviceClass && <DeviceClassChip
//                     value={value.deviceClass}
//                     filtering={{
//                         item: { deviceClass: value.deviceClass as any, count: 0 },
//                         handler: gClientFacetHandlers.deviceClasses,
//                         filterSpec: props.filterSpec,
//                         setFilterSpec: props.setFilterSpec
//                     }}
//                 />}
//                 {value.operatingSystem && <OperatingSystemChip
//                     value={value.operatingSystem}
//                     filtering={{
//                         item: { operatingSystem: value.operatingSystem, count: 0 },
//                         handler: gClientFacetHandlers.operatingSystems,
//                         filterSpec: props.filterSpec,
//                         setFilterSpec: props.setFilterSpec
//                     }}
//                 />}
//             </div>
//         </td>
//         <td>
//             {value.browserName && <BrowserChip
//                 value={value.browserName}
//                 filtering={{
//                     item: { browserName: value.browserName, count: 0 },
//                     handler: gClientFacetHandlers.browsers,
//                     filterSpec: props.filterSpec,
//                     setFilterSpec: props.setFilterSpec
//                 }}
//             />}
//         </td>
//     </tr >;
// };
//
// interface FacetItemDetailTableProps {
//     filterSpec: FeatureReportFilterSpec;
//     refreshTrigger: number;
//     setFilterSpec: (spec: FeatureReportFilterSpec) => void;
// };
//
// export const FacetItemDetailTable = ({ filterSpec, refreshTrigger, ...props }: FacetItemDetailTableProps) => {
//
//     const [items, { refetch }] = useQuery(getDetail, {
//         filterSpec,
//         refreshTrigger,
//     });
//
//     if (!items) {
//         return <div>Loading...</div>;
//     }
//
//     return <><table className="FacetItemDetailTable">
//         <thead>
//             <tr>
//                 <th>#</th>
//                 <th>When</th>
//                 <th>User</th>
//                 <th>Context</th>
//                 <th>Feature</th>
//                 <th>Query</th>
//                 <th></th>
//                 <th>URI</th>
//                 <th></th>
//                 <th></th>
//                 <th></th>
//                 <th></th>
//                 <th></th>
//                 <th></th>
//             </tr>
//         </thead>
//         <tbody>
//             {items.rows.map((item, index) => {
//                 //return <div>item....</div>;
//                 return <FacetItemDetailTableRow key={index} value={item} index={items.rows.length - index} filterSpec={filterSpec} setFilterSpec={props.setFilterSpec} />;
//             })}
//         </tbody>
//     </table>
//         <CMSmallButton>{items.metrics.queryTimeMs} ms</CMSmallButton>
//     </>;
// }
// MIGRATION_REFERENCE_END
