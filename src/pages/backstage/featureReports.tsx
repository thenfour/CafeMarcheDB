import { Alert, FormControlLabel } from "@mui/material";
import { ArrowUpward, Clear } from "@mui/icons-material";
import React from "react";
import { CalendarDate } from "shared/dateTimePolicy";
import { ActivityReportTimeBucketSize } from "shared/mysqlUtils";
import { Permission } from "shared/permissions";
import { CMButton, CMButtonGroup, CMSmallButton, NameValuePair } from "src/core/components/CMCoreComponents2";
import { CMTextInputBase } from "src/core/components/CMTextField";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { CMDateRangePicker } from "src/core/components/DateTime/DateTimeRangeControl";
import { AgeRelativeToNow } from "src/core/components/DateTime/RelativeTimeComponents";
import { ActivityFeature } from "src/core/components/featureReports/activityTracking";
import { type ActivityTimelineFilter, type GeneralFeatureReportInput } from "src/core/components/featureReports/activityReportTypes";
import { activityReportDateRange, type ActivityReportPeriod } from "src/core/components/featureReports/activityReportTiming";
import { FeatureReportTopLevelDateSelector } from "src/core/components/featureReports/TopLevelDateSelection";
import { CMSelectDisplayStyle, CMMultiSelect, CMSingleSelect } from "src/core/components/select/CMSelect";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { useLocale } from "src/locale/components/useLocale";
import { presentationContextKey } from "src/locale/shared/presentationContext";
import { readSettingSnapshot } from "src/setting/shared/settingsContract";
import type { BandPublicId } from "shared/publicId";

const periods: ActivityReportPeriod[] = ["year", "sixMonths", "threeMonths", "month", "twoWeeks"];

function GeneralFeatureStatsReport({ bandPublicId, timeZone }: { readonly bandPublicId: BandPublicId; readonly timeZone: string }) {
    const presentation = usePresentation();
    const locale = useLocale();
    const [range, setRange] = React.useState(() => activityReportDateRange(new Date(), timeZone, "threeMonths"));
    const [filterSpec, setFilterSpec] = React.useState<ActivityTimelineFilter>({
        bucketSize: ActivityReportTimeBucketSize.day, excludeYourself: true, excludeSysadmins: true,
        contextBeginsWith: null, includeFeatures: [], excludeFeatures: [],
    });
    const [selectedBucket, setSelectedBucket] = React.useState<string | null>(null);
    const [refetchTrigger, setRefetchTrigger] = React.useState(0);
    const [dataUpdatedAt, setDataUpdatedAt] = React.useState<Date | null>(null);
    const input = React.useMemo<GeneralFeatureReportInput>(() => ({ ...presentation.data?.input, bandPublicId, ...range, filterSpec }),
        [presentation.data?.input, bandPublicId, range, filterSpec]);
    const validRange = range.startDate < range.endDateExclusive;
    const setDateRange = (value: typeof range) => {
        setRange(value);
        setSelectedBucket(null);
    };
    return <div className="FeatureStatsReport">
        <div className="filterContainer">
            <CMButton onClick={() => setRefetchTrigger(value => value + 1)}>{locale.getPlainString("activityReports.refresh")}</CMButton>
            {dataUpdatedAt && <AgeRelativeToNow value={dataUpdatedAt} />}
            <FormControlLabel label={locale.getPlainString("activityReports.excludeYourself")}
                control={<input type="checkbox" checked={filterSpec.excludeYourself} onChange={event => {
                    const checked = event.target.checked;
                    setFilterSpec(value => ({ ...value, excludeYourself: checked, excludeSysadmins: checked ? value.excludeSysadmins : false }));
                }} />} />
            <FormControlLabel label={locale.getPlainString("activityReports.excludeSysadmins")}
                control={<input type="checkbox" checked={filterSpec.excludeSysadmins} onChange={event => {
                    const checked = event.target.checked;
                    setFilterSpec(value => ({ ...value, excludeSysadmins: checked }));
                }} />} />
            <NameValuePair name={locale.getPlainString("activityReports.features")} value={<>
                <CMButtonGroup>
                    <CMButton onClick={() => setFilterSpec(value => ({ ...value, includeFeatures: Object.values(ActivityFeature) }))}>{locale.getPlainString("activityReports.all")}</CMButton>
                    <CMButton onClick={() => setFilterSpec(value => ({ ...value, includeFeatures: [] }))}>{locale.getPlainString("activityReports.none")}</CMButton>
                </CMButtonGroup>
                <CMMultiSelect value={filterSpec.includeFeatures} displayStyle={CMSelectDisplayStyle.SelectedWithDialog}
                    dialogTitle={locale.getPlainString("activityReports.features")}
                    onChange={includeFeatures => setFilterSpec(value => ({ ...value, includeFeatures }))}
                    getOptions={() => Object.values(ActivityFeature)} getOptionInfo={feature => ({ id: feature })} renderOption={feature => feature} />
                <div style={{ display: "flex", alignItems: "center" }}>
                    <CMTextInputBase placeholder={locale.getPlainString("activityReports.context")} value={filterSpec.contextBeginsWith ?? ""}
                        onChange={(_event, context) => setFilterSpec(value => ({ ...value, contextBeginsWith: context.trim() ? context : null }))} />
                    <CMButton aria-label={locale.getPlainString("activityReports.parentContext")} tooltip={locale.getPlainString("activityReports.parentContext")} onClick={() => setFilterSpec(value => ({
                        ...value, contextBeginsWith: value.contextBeginsWith?.split("/").slice(0, -1).join("/") || null,
                    }))}><ArrowUpward /></CMButton>
                    <CMButton aria-label={locale.getPlainString("activityReports.clearContext")} tooltip={locale.getPlainString("activityReports.clearContext")} onClick={() => setFilterSpec(value => ({ ...value, contextBeginsWith: null }))}><Clear /></CMButton>
                </div>
            </>} />
            <NameValuePair name={locale.getPlainString("activityReports.timing")} value={<>
                <CMDateRangePicker
                    value={{ start: range.startDate, end: range.endDateExclusive }}
                    timeZone={timeZone}
                    showEventHighlights={presentation.data?.authorization.effectivePermissionNames.includes(Permission.view_events_nonpublic) ?? false}
                    onChange={value => setDateRange({ startDate: value.start, endDateExclusive: value.end })}
                />
                <CMButtonGroup>{periods.map(period => (
                    <CMSmallButton
                        key={period}
                        onClick={() => setDateRange(activityReportDateRange(new Date(), timeZone, period))}
                    >
                        {locale.getPlainString(`activityReports.${period}`)}
                    </CMSmallButton>))}</CMButtonGroup>
                <div className="smallText">{locale.getPlainString("activityReports.timeZone")}: {timeZone}</div>
                <CMSingleSelect
                    value={filterSpec.bucketSize}
                    getOptions={() => Object.values(ActivityReportTimeBucketSize)}
                    onChange={bucketSize => { setFilterSpec(value => ({ ...value, bucketSize })); setSelectedBucket(null); }}
                    getOptionInfo={size => ({ id: size })} renderOption={size => locale.getPlainString(`activityReports.bucket.${size}`)}
                />
                <div className="smallText">{CalendarDate.fromInstant({ value: range.startDate, timeZone }).date} – {CalendarDate.fromInstant({ value: range.endDateExclusive, timeZone }).date}</div>
                <div className="smallText">{locale.getPlainString("activityReports.endExclusive")}</div>
            </>} />
        </div>
        {selectedBucket && <CMButton onClick={() => setSelectedBucket(null)}>{selectedBucket} · {locale.getPlainString("activityReports.clearBucket")}</CMButton>}
        {validRange ? <FeatureReportTopLevelDateSelector
            input={input}
            selectedBucket={selectedBucket}
            onClickBucket={setSelectedBucket}
            refetchTrigger={refetchTrigger}
            setDataUpdatedAt={setDataUpdatedAt}
        /> : <Alert severity="warning">{locale.getPlainString("activityReports.invalidRange")}</Alert>}
        <Alert severity="info">{locale.getPlainString("activityReports.remaining")}</Alert>
    </div>;
}

export default function FeatureReportsPage() {
    const presentation = usePresentation();
    const locale = useLocale();
    const authorization = presentation.data?.authorization;
    const bandPublicId = authorization?.bandPublicId;
    const canRead = !!authorization?.userPublicId && authorization.effectivePermissionNames.includes(Permission.view_feature_reports);
    const timeZone = bandPublicId && presentation.data ? readSettingSnapshot(presentation.data.settings, "band", "dateTime.bandTimeZone") : null;
    return <DashboardLayout title={locale.getPlainString("activityReports.title")}>
        {!bandPublicId || !timeZone ? <Alert severity="info">{locale.getPlainString("activityReports.selectBand")}</Alert>
            : !canRead ? <Alert severity="warning">{locale.getPlainString("activityReports.denied")}</Alert>
                : <GeneralFeatureStatsReport key={JSON.stringify([presentation.data && presentationContextKey(presentation.data.input), authorization?.userPublicId, authorization?.bandUserPublicId, timeZone])}
                    bandPublicId={bandPublicId} timeZone={timeZone} />}
    </DashboardLayout>;
}

// MIGRATION_RESTORE: activity-reports
// Source: 9306d02db399b172ad5e9957c64e5930054faae8:src/pages/backstage/featureReports.tsx:1-323
// Reason: Legacy activity readers lack selected-band ownership and localized reference contracts, blocking application recovery.
// Restore: Restore activity timelines, facets, filters, drill-down details and CSV export with fresh authorization, explicit band ownership, localized references and public identities; preserve anonymization and redaction.
// Verification: Reactivate the preserved projection/filter specifications; test two bands, platform policy, grant revocation, anonymization, private references, CSV and browser report navigation/context switches.
// SHA256: 55abc65378e40b05c8cbf06aab47ca32f8f4c0f2d415d3cfc7eb34ca3cc67989
// MIGRATION_REFERENCE_BEGIN
// import { ActivityReportTimeBucketSize } from "@/shared/mysqlUtils";
// import { CMDateRangePicker } from "@/src/core/components/DateTime/DateTimeRangeControl";
// import { AgeRelativeToNow } from "@/src/core/components/DateTime/RelativeTimeComponents";
// import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
// import { gClientFacetHandlers } from "@/src/core/components/featureReports/ClientFacetHandlers";
// import { FacetedBreakdown } from "@/src/core/components/featureReports/FacetedBreakdown";
// import { getColorForFeature } from "@/src/core/components/featureReports/FeatureReportBasics";
// import { FeatureReportTopLevelDateSelector } from "@/src/core/components/featureReports/TopLevelDateSelection";
// import { ActivityFeature } from "@/src/core/components/featureReports/activityTracking";
// import { FeatureReportFilterSpec } from "@/src/core/components/featureReports/server/facetProcessor";
// import { BlitzPage } from "@blitzjs/next";
// import { ArrowUpward, Clear } from "@mui/icons-material";
// import { Button, FormControlLabel } from "@mui/material";
// import * as React from 'react';
// import { Permission } from "shared/permissions";
// import { DateAdd, formatMillisecondsToDHMS, roundToNearest15Minutes } from "shared/time";
// import { IsNullOrWhitespace } from "shared/utils";
// import { PermissionBoundary } from "src/core/components/CMCoreComponents";
// import { AdminInspectObject, CMSmallButton, NameValuePair } from "src/core/components/CMCoreComponents2";
// import { CMTextInputBase } from "src/core/components/CMTextField";
// import { CMMultiSelect, CMSelectDisplayStyle, CMSingleSelect } from "src/core/components/select/CMSelect";
// import { CMSelectNullBehavior } from "src/core/components/select/CMSingleSelectDialog";
//
// const GeneralFeatureStatsReport = () => {
//     const [refetchTrigger, setRefetchTrigger] = React.useState(0);
//     const now = React.useMemo(() => new Date(), [refetchTrigger]);
//     const [startDate, setStartDate] = React.useState<Date>(new Date(now.getTime() - 3 * 30 * 24 * 60 * 60 * 1000));
//     const [endDate, setEndDate] = React.useState<Date>(new Date(now.getTime() + 24 * 60 * 60 * 1000)); // +1 day
//
//     const [filterSpec, setFilterSpec] = React.useState<FeatureReportFilterSpec>({
//         selectedBucket: null,
//         bucketSize: ActivityReportTimeBucketSize.day,
//         excludeYourself: true,
//         excludeSysadmins: true,
//         contextBeginsWith: undefined,
//         includeFeatures: [],
//         excludeFeatures: [],
//         includeOperatingSystems: [],
//         includePointerTypes: [],
//         includeBrowserNames: [],
//         includeDeviceClasses: [],
//         includeTimezones: [],
//         includeLanguages: [],
//         includeLocales: [],
//         includeCustomLinkIds: [],
//         includeEventIds: [],
//         includeMenuLinkIds: [],
//         includeSongIds: [],
//         includeWikiPageIds: [],
//         excludeOperatingSystems: [],
//         excludePointerTypes: [],
//         excludeBrowserNames: [],
//         excludeDeviceClasses: [],
//         excludeTimezones: [],
//         excludeLanguages: [],
//         excludeLocales: [],
//         excludeCustomLinkIds: [],
//         excludeEventIds: [],
//         excludeMenuLinkIds: [],
//         excludeSongIds: [],
//         excludeWikiPageIds: [],
//     });
//
//     const [dataUpdatedAt, setDataUpdatedAt] = React.useState<Date>(now);
//
//     const realStartDate = roundToNearest15Minutes(startDate);
//     const realEndDate = roundToNearest15Minutes(endDate);
//
//     const additionalFilters = Object.entries(gClientFacetHandlers).map(([key, handler]) => {
//         const x = handler.renderFilter({ filterSpec, setFilterSpec, handler: handler as any });
//         if (!x) return null;
//         return <React.Fragment key={key}>{x}</React.Fragment>;
//     }).filter(x => x !== null);
//
//     return <div className="FeatureStatsReport">
//         <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
//             <div className="filterContainer">
//                 <div style={{ display: "flex", alignItems: "center" }}>
//                     <Button onClick={() => setRefetchTrigger(x => x + 1)}>Refresh</Button>
//                     <span className="smallText">
//                         last updated: <AgeRelativeToNow value={dataUpdatedAt} />
//                     </span>
//                 </div>
//                 <div style={{ display: "flex", alignItems: "center", marginLeft: "6px" }}>
//                     <FormControlLabel
//                         control={
//                             <input
//                                 type="checkbox"
//                                 checked={filterSpec.excludeYourself}
//                                 onChange={(e) => {
//                                     if (e.target.checked) {
//                                         setFilterSpec((x) => ({ ...x, excludeYourself: true }));
//                                     }
//                                     else {
//                                         setFilterSpec((x) => ({ ...x, excludeYourself: false, excludeSysadmins: false }));
//                                     }
//                                 }}
//                             />}
//                         label="Exclude yourself"
//                     />
//                     <PermissionBoundary permission={Permission.sysadmin}>
//                         <FormControlLabel control={<input type="checkbox" checked={filterSpec.excludeSysadmins} onChange={(e) => {
//                             if (e.target.checked) {
//                                 setFilterSpec((x) => ({ ...x, excludeSysadmins: true }));
//                             }
//                             else {
//                                 setFilterSpec((x) => ({ ...x, excludeSysadmins: false, excludeYourself: false }));
//                             }
//                         }} />} label="Exclude sysadmins" />
//                     </PermissionBoundary>
//                 </div>
//                 <NameValuePair name="Feature" value={
//                     <>
//                         <Button onClick={() => {
//                             //setFeatures(Object.values(ActivityFeature))
//                             setFilterSpec((x) => ({ ...x, includeFeatures: Object.values(ActivityFeature) }));
//                         }} >All</Button>
//                         <Button onClick={() => setFilterSpec((x) => ({ ...x, includeFeatures: [] }))} >None</Button>
//                         <CMMultiSelect
//                             value={filterSpec.includeFeatures}
//                             displayStyle={CMSelectDisplayStyle.SelectedWithDialog}
//                             onChange={(checkedItems) => {
//                                 setFilterSpec((x) => ({ ...x, includeFeatures: checkedItems as ActivityFeature[] }));
//                             }}
//                             getOptions={() => {
//                                 return Object.values(ActivityFeature);
//                             }}
//                             getOptionInfo={(item) => {
//                                 return {
//                                     id: item.toString(),
//                                     color: getColorForFeature(item).id,
//                                 };
//                             }}
//                             renderOption={(item) => {
//                                 return item.toString();
//                             }}
//                         />
//
//                         <div style={{ display: "flex", alignItems: "center", marginRight: "25px" }}>
//                             <CMTextInputBase
//                                 style={{ fontSize: "15px", margin: "7px", backgroundColor: "white", borderRadius: "4px", padding: "5px", fontFamily: "var(--ff-mono)" }}
//                                 placeholder="filter context..."
//                                 onChange={(e, val) => {
//                                     //setContextBeginsWith(IsNullOrWhitespace(val) ? undefined : val);
//                                     if (IsNullOrWhitespace(val)) {
//                                         setFilterSpec((x) => ({ ...x, contextBeginsWith: undefined }));
//                                     } else {
//                                         setFilterSpec((x) => ({ ...x, contextBeginsWith: val }));
//                                     }
//                                 }}
//                                 value={filterSpec.contextBeginsWith || ""}
//                             />
//                             <CMSmallButton onClick={() => {
//                                 // remove last path part of contextBeginsWith
//                                 // if (contextBeginsWith) {
//                                 //     const parts = contextBeginsWith.split("/");
//                                 //     if (parts.length > 1) {
//                                 //         setContextBeginsWith(parts.slice(0, -1).join("/"));
//                                 //     } else {
//                                 //         setContextBeginsWith(undefined);
//                                 //     }
//                                 // }
//                                 if (filterSpec.contextBeginsWith) {
//                                     const parts = filterSpec.contextBeginsWith.split("/");
//                                     if (parts.length > 1) {
//                                         setFilterSpec((x) => ({ ...x, contextBeginsWith: parts.slice(0, -1).join("/") }));
//                                     } else {
//                                         setFilterSpec((x) => ({ ...x, contextBeginsWith: undefined }));
//                                     }
//                                 }
//                             }}>
//                                 <ArrowUpward />
//                             </CMSmallButton>
//                             <CMSmallButton onClick={() => {
//                                 //setContextBeginsWith(undefined);
//                                 setFilterSpec((x) => ({ ...x, contextBeginsWith: undefined }));
//                             }}>
//                                 <Clear />
//                             </CMSmallButton>
//                         </div>
//                     </>
//                 } />
//
//                 <NameValuePair name="Timing" value={
//                     <div>
//                         <div style={{ display: "flex", alignItems: "center" }}>
//
//                             <CMDateRangePicker
//                                 value={{ start: startDate, end: endDate }}
//                                 onChange={(val) => {
//                                     if (val) {
//                                         setStartDate(val.start);
//                                         setEndDate(val.end);
//                                     }
//                                 }}
//                                 timeZone={Intl.DateTimeFormat().resolvedOptions().timeZone}
//                             />
//
//                             <CMSmallButton
//                                 onClick={() => {
//                                     setStartDate(DateAdd(new Date(), { years: -1 }));
//                                     setEndDate(DateAdd(new Date(), { days: 1 }));
//                                 }}
//                             >
//                                 Past year
//                             </CMSmallButton>
//
//                             <CMSmallButton
//                                 onClick={() => {
//                                     setStartDate(DateAdd(new Date(), { months: -6 }));
//                                     setEndDate(DateAdd(new Date(), { days: 1 }));
//                                 }}
//                             >
//                                 Past 6 months
//                             </CMSmallButton>
//
//
//                             <CMSmallButton
//                                 onClick={() => {
//                                     setStartDate(DateAdd(new Date(), { months: -3 }));
//                                     setEndDate(DateAdd(new Date(), { days: 1 }));
//                                 }}
//                             >
//                                 Past 3 months
//                             </CMSmallButton>
//
//
//                             <CMSmallButton
//                                 onClick={() => {
//                                     setStartDate(DateAdd(new Date(), { months: -1 }));
//                                     setEndDate(DateAdd(new Date(), { days: 1 }));
//                                 }}
//                             >
//                                 Past month
//                             </CMSmallButton>
//
//                             <CMSmallButton
//                                 onClick={() => {
//                                     setStartDate(DateAdd(new Date(), { days: -14 }));
//                                     setEndDate(DateAdd(new Date(), { days: 1 }));
//                                 }}
//                             >
//                                 Past 2 weeks
//                             </CMSmallButton>
//
//                         </div>
//
//                         <div style={{ display: "flex", alignItems: "center", fontFamily: "var(--ff-mono)", opacity: 0.7, fontSize: "12px", padding: "5px", marginLeft: "10px" }}>
//                             [<AgeRelativeToNow value={startDate} />]
//                             <div className="ndash field">&ndash;</div>
//                             [<AgeRelativeToNow value={endDate} />]
//                             ({formatMillisecondsToDHMS(endDate.getTime() - startDate.getTime())})
//                         </div>
//
//                         <CMSingleSelect
//                             value={filterSpec.bucketSize}
//                             onChange={(option) => {
//                                 //setAggregateBy(option);
//                                 //setSelectedBucket(null); // buckets don't make sense anymore
//                                 setFilterSpec((x) => ({ ...x, bucketSize: option, selectedBucket: null }));
//                             }}
//                             getOptions={() => {
//                                 return Object.values(ActivityReportTimeBucketSize);
//                             }}
//                             getOptionInfo={(item) => {
//                                 return {
//                                     id: item.toString(),
//                                 };
//                             }}
//                             nullBehavior={CMSelectNullBehavior.NonNullable}
//                             renderOption={(item) => {
//                                 return item.toString();
//                             }}
//                         />
//                     </div>
//                 } />
//
//                 <AdminInspectObject src={additionalFilters} label="additionalFilters" />
//
//                 {additionalFilters.length > 0 && <NameValuePair name="Additional filters"
//                     value={
//                         <div>{additionalFilters}
//                         </div>
//                     } />
//                 }
//             </div>
//
//             <React.Suspense>
//                 <FeatureReportTopLevelDateSelector
//                     filterSpec={filterSpec}
//                     startDate={realStartDate}
//                     endDate={realEndDate}
//                     onClickBucket={(bucket) => {
//                         setFilterSpec((x) => ({ ...x, selectedBucket: bucket }));
//                     }}
//                     refetchTrigger={refetchTrigger}
//                     setDataUpdatedAt={setDataUpdatedAt}
//                 />
//             </React.Suspense>
//
//         </div>
//
//         <React.Suspense>
//             <FacetedBreakdown
//                 filterSpec={filterSpec}
//                 setFilterSpec={setFilterSpec}
//                 refetchTrigger={refetchTrigger}
//             />
//         </React.Suspense>
//     </div >;
// };
//
// const FeatureReportsPage: BlitzPage = () => {
//     return (
//         <DashboardLayout title="Feature reports">
//             <div className="contentSection fullWidth">
//                 <GeneralFeatureStatsReport />
//             </div>
//         </DashboardLayout>
//     )
// }
//
// export default FeatureReportsPage;
// MIGRATION_REFERENCE_END
