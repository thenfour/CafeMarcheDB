import { scopedAuthorizationSatisfiesRequirement } from "src/auth/shared/permissionRequirement";
import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import { defineCmdbPage } from "src/route/cmdbPage";
import { Alert, FormControlLabel } from "@mui/material";
import { ArrowUpward, Clear } from "@mui/icons-material";
import React from "react";
import { CalendarDate } from "shared/dateTimePolicy";
import { ActivityReportTimeBucketSize } from "shared/mysqlUtils";
import { CMButton, CMButtonGroup, CMSmallButton, NameValuePair } from "src/core/components/CMCoreComponents2";
import { CMTextInputBase } from "src/core/components/CMTextField";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { CMDateRangePicker } from "src/core/components/DateTime/DateTimeRangeControl";
import { AgeRelativeToNow } from "src/core/components/DateTime/RelativeTimeComponents";
import { ActivityFeature } from "src/core/components/featureReports/activityTracking";
import { type ActivityTimelineFilter, type GeneralFeatureReportInput, type FacetedBreakdownInput } from "src/core/components/featureReports/activityReportTypes";
import { emptyActivityFacetFilters, type ActivityReportFilters } from "src/core/components/featureReports/ClientFacetHandlers";
import { FacetedBreakdown } from "src/core/components/featureReports/FacetedBreakdown";
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
    const [facetFilters, setFacetFilters] = React.useState(emptyActivityFacetFilters);
    const [refetchTrigger, setRefetchTrigger] = React.useState(0);
    const [dataUpdatedAt, setDataUpdatedAt] = React.useState<Date | null>(null);
    const input = React.useMemo<GeneralFeatureReportInput>(() => ({ ...presentation.data?.input, bandPublicId, ...range, filterSpec }),
        [presentation.data?.input, bandPublicId, range, filterSpec]);
    const validRange = range.startDate < range.endDateExclusive;
    const facetInput = React.useMemo<FacetedBreakdownInput | null>(() => selectedBucket ? { ...input, selectedBucket, facetFilters } : null,
        [input, selectedBucket, facetFilters]);
    const changeFilters = (filters: ActivityReportFilters) => {
        setFilterSpec(filters.timeline);
        setFacetFilters(filters.facets);
    };
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
                    showEventHighlights={scopedAuthorizationSatisfiesRequirement(presentation.data?.authorization, BandPermission.view_events_nonpublic) ?? false}
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
        {validRange && facetInput ? <FacetedBreakdown input={facetInput} refetchTrigger={refetchTrigger} onChangeFilters={changeFilters} />
            : validRange && <Alert severity="info">{locale.getPlainString("activityReports.selectBucket")}</Alert>}
    </div>;
}

function FeatureReportsPage() {
    const presentation = usePresentation();
    const locale = useLocale();
    const authorization = presentation.data?.authorization;
    const bandPublicId = authorization?.bandPublicId;
    const canRead = !!authorization?.userPublicId && scopedAuthorizationSatisfiesRequirement(authorization, BandPermission.view_feature_reports);
    const timeZone = bandPublicId && presentation.data ? readSettingSnapshot(presentation.data.settings, "band", "dateTime.bandTimeZone") : null;
    return <DashboardLayout title={locale.getPlainString("activityReports.title")}>
        {!bandPublicId || !timeZone ? <Alert severity="info">{locale.getPlainString("activityReports.selectBand")}</Alert>
            : !canRead ? <Alert severity="warning">{locale.getPlainString("activityReports.denied")}</Alert>
                : <GeneralFeatureStatsReport key={JSON.stringify([presentation.data && presentationContextKey(presentation.data.input), authorization?.userPublicId, authorization?.bandUserPublicId, timeZone])}
                    bandPublicId={bandPublicId} timeZone={timeZone} />}
    </DashboardLayout>;
}

defineCmdbPage("bandFeatureReports", FeatureReportsPage);
export default FeatureReportsPage;
