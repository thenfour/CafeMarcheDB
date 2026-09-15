import { addCalendarDays, BandTimeZoneSchema, calendarDateToUtcDate, getAllDayInterval, getBandDateTimeFields } from "@/shared/dateTimePolicy";
import { DateTimeRange, DateTimeRangeSpec, localDateToCalendarDate } from "@/shared/time";
import { DateTimeRangeControl, DayControl } from "@/src/core/components/DateTime/DateTimeRangeControl";
import { useDashboardContext } from "@/src/core/components/dashboardContext/DashboardContext";
import { BlitzPage } from "@blitzjs/next";
import { Autocomplete, NoSsr, TextField } from "@mui/material";
import React from "react";
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
    { label: "All-day: Brussels spring day (23 elapsed hours)", spec: { startsAtDateTime: new Date("2026-03-29T00:00:00Z"), durationMillis: day, isAllDay: true } },
    { label: "All-day: Brussels autumn day (25 elapsed hours)", spec: { startsAtDateTime: new Date("2026-10-25T00:00:00Z"), durationMillis: day, isAllDay: true } },
    { label: "All-day: spans New Year", spec: { startsAtDateTime: new Date("2026-12-31T00:00:00Z"), durationMillis: 3 * day, isAllDay: true } },
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
    const [selectedDate, setSelectedDate] = React.useState<Date | null>(() => new Date(2026, 6, 10));
    const [timeZoneA, setTimeZoneA] = React.useState(dashboard.bandTimeZone);
    const [timeZoneB, setTimeZoneB] = React.useState("Asia/Tokyo");
    const [locale, setLocale] = React.useState("en-GB");
    const [lifecycleTimeZone, setLifecycleTimeZone] = React.useState(dashboard.bandTimeZone);
    const [editHistory, setEditHistory] = React.useState<string[]>([]);
    const [sampleName, setSampleName] = React.useState(presets[0]!.label);
    const [editorReset, setEditorReset] = React.useState(0);
    const spec = selectedRange.getSpec();
    const interval = selectedRange.getInstantInterval(lifecycleTimeZone);
    const selectedDay = selectedDate ? localDateToCalendarDate(selectedDate) : null;

    const editRange = (source: string, next: DateTimeRange) => {
        setEditHistory(history => [`${source}: ${selectedRange.toSerializableString()} ? ${next.toSerializableString()}`, ...history].slice(0, 6));
        setSelectedRange(next);
    };
    const loadPreset = (index: number) => {
        const preset = presets[index]!;
        setSelectedRange(new DateTimeRange(preset.spec));
        setSampleName(preset.label);
        setEditHistory([]);
        setEditorReset(reset => reset + 1);
    };

    const renderForTZ = (panel: string, timeZone: string, onChange: (zone: string) => void, locale: string) => {
        const calendarDates = selectedRange.getCalendarDateRange(timeZone);
        const midnight = selectedDay ? getAllDayInterval({ startDate: selectedDay, endDateExclusive: addCalendarDays(selectedDay, 1) }, timeZone).start : null;
        const fields = !spec.isAllDay && spec.startsAtDateTime ? getBandDateTimeFields(spec.startsAtDateTime, timeZone) : null;
        return <section aria-label={panel} style={{ border: "1px solid #8886", borderRadius: 8, padding: 20, minWidth: 0 }}>
            <h2>{panel}</h2>
            <ZoneSelector label={`${panel}: display / editing timezone`} value={timeZone} onChange={onChange} />
            <Values rows={[
                ["Explicit display", selectedRange.toDisplayString({ displayTimeZone: timeZone, locale })],
                ["Calendar dates touched (exclusive end)", calendarDates ? `${calendarDates.startDate} ? ${calendarDates.endDateExclusive}` : null],
                ["Start clock and offset", fields ? `${fields.date} ${fields.time} ${fields.offset}` : spec.isAllDay ? "Calendar dates only" : null],
            ]} />
            <h3>Edit the shared range</h3>
            <DateTimeRangeControl key={editorReset} value={selectedRange} onChange={next => editRange(panel, next)} timeZone={timeZone} />
            <p>Changing this panel?s timezone changes its presentation. Editing a date or clock updates the shared sample.</p>
            <h3>Standalone DayControl</h3>
            <DayControl value={selectedDate} onChange={setSelectedDate} timeZone={timeZone} otherValue={null} />
            <Values rows={[
                ["Selected calendar date", selectedDay],
                ["Midnight in this panel?s zone ? UTC", midnight?.toISOString()],
            ]} />
            <p>DayControl receives calendar fields in a device-local Date carrier. Its timezone sets calendar context; the value is already a selected day.</p>
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
            <option value="" disabled>Choose a sample?</option>
            {presets.map((preset, index) => <option key={preset.label} value={index}>{preset.label}</option>)}
        </select></label>
        <p>{sampleName}</p>
        <section aria-label="Storage and runtime" style={{ border: "1px solid #8886", borderRadius: 8, padding: 20, marginBottom: 20 }}>
            <h2>Storage and runtime</h2>
            <Values rows={[
                ["Stored start (UTC ISO)", spec.startsAtDateTime?.toISOString()],
                ["Stored duration (ms)", spec.durationMillis],
                ["Stored all-day flag", String(spec.isAllDay)],
                ["toString() ? runtime local", selectedRange.toString()],
                ["Explicit UTC display", selectedRange.toDisplayString({ displayTimeZone: "UTC", locale })],
                ["Explicit device display", selectedRange.toDisplayString({ displayTimeZone: deviceTimeZone, locale })],
                ["Selected DayControl carrier: Date.toString()", selectedDate?.toString()],
                ["Selected DayControl carrier: ISO (not event storage)", selectedDate?.toISOString()],
                ["Selected day encoded for all-day storage", selectedDay ? calendarDateToUtcDate(selectedDay).toISOString() : null],
            ]} />
            {spec.isAllDay && <p>The stored start encodes a calendar date. Duration counts nominal 24-hour days; the lifecycle below can have a different elapsed duration.</p>}
            <details><summary>Legacy toDisplayStrings() ? runtime local</summary><pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(selectedRange.toDisplayStrings(), null, 2)}</pre></details>
            <details><summary>Serialized range</summary><pre style={{ whiteSpace: "pre-wrap" }}>{selectedRange.toSerializableString()}</pre></details>
        </section>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 460px), 1fr))", gap: 20 }}>
            {renderForTZ("Panel A", timeZoneA, setTimeZoneA, locale)}
            {renderForTZ("Panel B", timeZoneB, setTimeZoneB, locale)}
        </div>
        <section aria-label="Lifecycle" style={{ marginTop: 24 }}>
            <h2>Shared lifecycle</h2>
            <p>This separate setting simulates the band?s lifecycle timezone. It affects all-day boundaries; timed instants stay fixed.</p>
            <ZoneSelector label="Simulated band lifecycle timezone" value={lifecycleTimeZone} onChange={setLifecycleTimeZone} />
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
