import { BandTimeZoneSchema, CalendarDate, getBandDateTimeFields } from "@/shared/dateTimePolicy";
import { DateTimeRange, DateTimeRangeSpec, createAllDayRange, gMillisecondsPerDay } from "@/shared/time";
import { DateTimeRangeControl, DayControl } from "@/src/core/components/DateTime/DateTimeRangeControl";
import { useDashboardContext } from "@/src/core/components/dashboardContext/DashboardContext";
import { BlitzPage } from "@blitzjs/next";
import { Autocomplete, Button, NoSsr, TextField } from "@mui/material";
import React from "react";
import { formatEventDateRange, formatEventDateRangeTranslations, getRangeCalendarDates } from "shared/dateTimePresentation";
import { Permission } from "shared/permissions";
import { makeServerSidePermissionGuard } from "src/auth/server/serverPageAuthorization";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";

const hour = 3_600_000;
const day = 24 * hour;
const presets: { label: string; spec: DateTimeRangeSpec }[] = [
    { label: "Timed: Tokyo date differs from UTC", spec: { startsAtDateTime: new Date("2026-07-10T15:30:12.345Z"), durationMillis: 1_200_789, isAllDay: false } },
    { label: "Timed: crosses Brussels midnight", spec: { startsAtDateTime: new Date("2026-07-10T21:30:00Z"), durationMillis: 3 * hour, isAllDay: false } },
    { label: "Timed: Brussels spring clock change", spec: { startsAtDateTime: new Date("2026-03-29T00:30:00Z"), durationMillis: hour, isAllDay: false } },
    { label: "Timed: Brussels repeated hour, earlier occurrence", spec: { startsAtDateTime: new Date("2026-10-25T00:30:00Z"), durationMillis: hour, isAllDay: false } },
    { label: "Timed: Brussels repeated hour, later occurrence", spec: { startsAtDateTime: new Date("2026-10-25T01:30:00Z"), durationMillis: hour, isAllDay: false } },
    { label: "All-day: Brussels spring day (23 elapsed hours)", spec: { startsAtDateTime: new Date("2026-03-28T23:00:00Z"), durationMillis: 23 * hour, isAllDay: true } },
    { label: "All-day: Brussels autumn day (25 elapsed hours)", spec: { startsAtDateTime: new Date("2026-10-24T22:00:00Z"), durationMillis: 25 * hour, isAllDay: true } },
    { label: "All-day: spans New Year", spec: { startsAtDateTime: new Date("2026-12-30T23:00:00Z"), durationMillis: 3 * day, isAllDay: true } },
    { label: "Timed: zero duration", spec: { startsAtDateTime: new Date("2026-07-10T22:00:00Z"), durationMillis: 0, isAllDay: false } },
    { label: "TBD", spec: { startsAtDateTime: null, durationMillis: hour, isAllDay: false } },
];

function ZoneSelector({ label, value, onChange }: { label: string; value: string; onChange: (zone: string) => void }) {
    const [error, setError] = React.useState(false);
    const options = React.useMemo(() => [...new Set(["UTC", value, ...Intl.supportedValuesOf("timeZone")])], [value]);
    return <Autocomplete
        fullWidth freeSolo disableClearable options={options} value={value}
        onChange={(_event, next) => {
            const parsed = BandTimeZoneSchema.safeParse(next);
            setError(!parsed.success);
            if (parsed.success) onChange(parsed.data);
        }}
        renderInput={params => <TextField {...params} label={label} error={error}
            helperText={error ? "Enter a named timezone, e.g. Europe/Brussels." : "Choose a zone or type one and press Enter."} />}
    />;
}

function Values({ rows }: { rows: [string, React.ReactNode][] }) {
    return <dl style={{ display: "grid", gridTemplateColumns: "minmax(120px, 1fr) minmax(0, 2fr)", gap: "8px 16px" }}>
        {rows.map(([label, value]) => <React.Fragment key={label}>
            <dt>{label}</dt><dd style={{ margin: 0, overflowWrap: "anywhere", fontFamily: "monospace" }}>{value ?? "TBD"}</dd>
        </React.Fragment>)}
    </dl>;
}

export const DateTestPageCtrl = () => {
    const dashboard = useDashboardContext();
    const deviceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const [selectedRange, setSelectedRange] = React.useState(() => new DateTimeRange(presets[0]!.spec));
    const [selectedDate, setSelectedDate] = React.useState("2026-07-10");
    const [timeZoneA, setTimeZoneA] = React.useState(dashboard.bandTimeZone);
    const [timeZoneB, setTimeZoneB] = React.useState("Asia/Tokyo");
    const [locale, setLocale] = React.useState("en-GB");
    const [lifecycleTimeZone, setLifecycleTimeZone] = React.useState(dashboard.bandTimeZone);
    const [editHistory, setEditHistory] = React.useState<string[]>([]);
    const [sampleName, setSampleName] = React.useState(presets[0]!.label);
    const [editorReset, setEditorReset] = React.useState(0);
    const spec = selectedRange.getSpec();
    const interval = selectedRange.getBounds();
    const selectedDay = selectedDate;

    const editRange = (source: string, next: DateTimeRange) => {
        setEditHistory(history => [`${source}: ${selectedRange.toSerializableString()} ? ${next.toSerializableString()}`, ...history].slice(0, 6));
        setSelectedRange(next);
    };
    const loadPreset = (index: number) => {
        const preset = presets[index]!;
        setSelectedRange(new DateTimeRange(preset.spec));
        setLifecycleTimeZone("Europe/Brussels");
        setSampleName(preset.label);
        setEditHistory([]);
        setEditorReset(reset => reset + 1);
    };

    const renderForTZ = (panel: string, timeZone: string, onChange: (zone: string) => void, locale: string) => {
        const calendarDates = getRangeCalendarDates(selectedRange, timeZone);
        const calendarDate = new CalendarDate(selectedDate, timeZone);
        const midnight = calendarDate.toStartInstant();
        const fields = spec.startsAtDateTime ? getBandDateTimeFields(spec.startsAtDateTime, timeZone) : null;
        return <section aria-label={panel} style={{ border: "1px solid #8886", borderRadius: 8, padding: 20, minWidth: 0 }}>
            <h2>{panel}</h2>
            <ZoneSelector label={`${panel}: display / editing timezone`} value={timeZone} onChange={onChange} />
            <Values rows={[
                ["Explicit display", formatEventDateRange(selectedRange, { viewerTimeZone: timeZone, bandTimeZone: lifecycleTimeZone, locale })],
                ["Calendar dates touched (exclusive end)", calendarDates ? `${calendarDates.start.date} → ${calendarDates.endExclusive.date}` : null],
                ["Start clock and offset", fields ? `${fields.date} ${fields.time} ${fields.offset}` : spec.isAllDay ? "Calendar dates only" : null],
            ]} />
            <h3>Edit the shared range</h3>
            <DateTimeRangeControl key={editorReset} value={selectedRange} onChange={next => editRange(panel, next)} timeZone={spec.isAllDay ? lifecycleTimeZone : timeZone} />
            <p>Changing this panel's timezone changes its presentation. Editing a date or clock updates the shared sample.</p>
            <h3>Standalone DayControl</h3>
            <DayControl value={calendarDate} coalescedFallbackValue={calendarDate} onChange={date => setSelectedDate(date.date)} otherValue={null} />
            <Values rows={[
                ["Selected calendar date", selectedDay],
                ["Midnight in this panel's zone → UTC", midnight?.toISOString()],
            ]} />
            <p>DayControl receives a CalendarDate containing the selected day and its timezone.</p>
        </section>;
    };

    const allLocales = ["en-GB", "fr-FR", "nl-BE"];

    return <div style={{ maxWidth: 1500, padding: 20 }}>
        <h1>Date and timezone explorer</h1>
        <p>Device timezone: <strong>{deviceTimeZone}</strong>. Configured band timezone: <strong>{dashboard.bandTimeZone}</strong>.</p>
        <label>Select locale: <select value={locale} onChange={event => setLocale(event.target.value)}>
            {allLocales.map(loc => <option key={loc} value={loc}>{loc}</option>)}
        </select></label>
        <p>Both editors share one sample. These edits stay on this page; they do not save an event or change the band setting.</p>
        <label>Load a sample: <select aria-label="Load a sample" value="" onChange={event => loadPreset(Number(event.target.value))}>
            <option value="" disabled>Choose a sample</option>
            {presets.map((preset, index) => <option key={preset.label} value={index}>{preset.label}</option>)}
        </select></label>
        <p>{sampleName}</p>
        <section aria-label="Storage and runtime" style={{ border: "1px solid #8886", borderRadius: 8, padding: 20, marginBottom: 20 }}>
            <h2>Storage and runtime</h2>
            <Button onClick={() => {
                setSelectedRange(new DateTimeRange({
                    isAllDay: false,
                    startsAtDateTime: new Date(),
                    durationMillis: Math.floor(Math.random() * gMillisecondsPerDay) // random duration up to 24 hour
                }));

            }}>Reset range to Now + random</Button>
            <Values rows={[
                ["Stored start (UTC ISO)", spec.startsAtDateTime?.toISOString()],
                ["Stored duration (ms)", spec.durationMillis],
                ["Stored all-day flag", String(spec.isAllDay)],
                ["Explicit UTC display", formatEventDateRange(selectedRange, { viewerTimeZone: "UTC", bandTimeZone: lifecycleTimeZone, locale })],
                ["Explicit device display", formatEventDateRange(selectedRange, { viewerTimeZone: deviceTimeZone, bandTimeZone: lifecycleTimeZone, locale })],
            ]} />
            {spec.isAllDay && <p>Both bounds are real UTC instants. The stored duration is the actual elapsed time, including DST.</p>}
            <details><summary>Explicit multilingual formatting</summary>
                <pre style={{ whiteSpace: "pre-wrap" }}>
                    {JSON.stringify(formatEventDateRangeTranslations(selectedRange, { viewerTimeZone: deviceTimeZone, bandTimeZone: lifecycleTimeZone, locale }), null, 2)}
                </pre>
            </details>
            <details><summary>Serialized range</summary><pre style={{ whiteSpace: "pre-wrap" }}>{selectedRange.toSerializableString()}</pre></details>
        </section>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 460px), 1fr))", gap: 20 }}>
            {renderForTZ("Panel A", timeZoneA, setTimeZoneA, locale)}
            {renderForTZ("Panel B", timeZoneB, setTimeZoneB, locale)}
        </div>
        <section aria-label="Lifecycle" style={{ marginTop: 24 }}>
            <h2>Shared lifecycle</h2>
            <p>Changing the simulated band timezone reauthors all-day bounds while preserving the selected calendar dates. Presentation changes above leave these bounds fixed.</p>
            <ZoneSelector label="Simulated band lifecycle timezone" value={lifecycleTimeZone} onChange={nextZone => {
                if (selectedRange.isAllDay() && !selectedRange.isTBD()) {
                    const dates = getRangeCalendarDates(selectedRange, lifecycleTimeZone)!;
                    editRange("Band timezone reanchor", createAllDayRange(dates.dates, nextZone));
                }
                setLifecycleTimeZone(nextZone);
            }} />
            <Values rows={[
                ["Absolute start, inclusive", interval?.start.toISOString()],
                ["Absolute end, exclusive", interval?.end.toISOString()],
                ["Elapsed hours", interval ? (interval.end.valueOf() - interval.start.valueOf()) / hour : null],
            ]} />
        </section>
        <details style={{ marginTop: 24 }}><summary>Recent editor writes ({editHistory.length})</summary>
            <ol>{editHistory.map((entry, index) => <li key={index} style={{ overflowWrap: "anywhere", fontFamily: "monospace" }}>{entry}</li>)}</ol>
        </details>
    </div>;
};

const DateTestPage: BlitzPage = () => <DashboardLayout title="Date and timezone explorer">
    <NoSsr><DateTestPageCtrl /></NoSsr>
</DashboardLayout>;

export default DateTestPage;
export const getServerSideProps = makeServerSidePermissionGuard(Permission.sysadmin);
