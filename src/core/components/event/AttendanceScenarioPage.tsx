import React from "react";
import * as db3 from "src/core/db3/db3";
import { Alert, Box, Button, Checkbox, FormControl, FormControlLabel, FormLabel, MenuItem, Paper, Radio, RadioGroup, Stack, TextField, Typography } from "@mui/material";
import { AttendanceControlView } from "./AttendanceControlView";
import {
    AttendanceScenario, AttendanceScenarioUser, attendanceScenarioSchema, applyAttendanceScenarioChange,
    buildAttendanceScenario, createAttendanceScenario, describeAttendanceVisibility, scenarioAttendances, scenarioInstruments,
} from "./attendanceScenario";

const Choices = ({ label, value, choices, onChange }: {
    label: string; value: string; choices: readonly (readonly [string, string])[]; onChange: (value: string) => void;
}) => {
    const id = React.useId();
    return <FormControl><FormLabel id={id}>{label}</FormLabel>
        <RadioGroup row aria-labelledby={id} value={value} onChange={(_, next) => onChange(next)}>
            {choices.map(([key, caption]) => <FormControlLabel key={key} value={key} control={<Radio size="small" />} label={caption} />)}
        </RadioGroup>
    </FormControl>;
};
const timingChoices = [["past", "Past"], ["ongoing", "Ongoing"], ["future", "Future"], ["tbd", "TBD"]] as const;

const UserSettings = ({ person, segmentCount, update }: {
    person: AttendanceScenarioUser; segmentCount: number; update: (patch: Partial<AttendanceScenarioUser>) => void;
}) => <Stack spacing={2} sx={{ pt: 2 }}>
        <Stack direction="row" gap={2} flexWrap="wrap" alignItems="center">
            <TextField size="small" label="User name" value={person.name} onChange={e => update({ name: e.target.value })} />
            <FormControlLabel control={<Checkbox checked={person.tagInvited} onChange={(_, checked) => update({ tagInvited: checked })} />} label="Invited through tag" />
            <TextField select size="small" label="Individual invitation" sx={{ minWidth: 180 }} value={String(person.individualInvitation)}
                onChange={e => update({ individualInvitation: e.target.value === "null" ? null : e.target.value === "true" })}>
                <MenuItem value="null">Not set</MenuItem><MenuItem value="true">Invited</MenuItem><MenuItem value="false">Not invited</MenuItem>
            </TextField>
        </Stack>
        <Stack direction="row" gap={2} flexWrap="wrap" alignItems="center">
            <Choices label="Profile instruments" value={String(person.instrumentCount)} choices={[["0", "0"], ["1", "1"], ["2", "2"], ["3", "3"]]}
                onChange={value => update({ instrumentCount: Number(value) })} />
            <TextField select size="small" label="Primary instrument" sx={{ minWidth: 180 }} value={person.primaryInstrumentId ?? "none"}
                onChange={e => update({ primaryInstrumentId: e.target.value === "none" ? null : Number(e.target.value) })}>
                <MenuItem value="none">None marked primary</MenuItem>
                {scenarioInstruments.map(i => <MenuItem key={i.id} value={i.id}>{i.name}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="Stored event instrument" sx={{ minWidth: 200 }} value={person.instrumentId ?? "default"}
                onChange={e => update({ instrumentId: e.target.value === "default" ? null : Number(e.target.value) })}>
                <MenuItem value="default">Default (no stored choice)</MenuItem>
                {scenarioInstruments.map(i => <MenuItem key={i.id} value={i.id}>{i.name}{i.id > person.instrumentCount ? " (outside profile)" : ""}</MenuItem>)}
            </TextField>
        </Stack>
        <Stack direction="row" gap={2} flexWrap="wrap" alignItems="center">
            {person.responses.slice(0, segmentCount).map((value, index) => <TextField key={index} select size="small" label={`Segment ${index + 1} response`}
                sx={{ minWidth: 185 }} value={value === null ? "null" : value}
                onChange={e => update({
                    responses: person.responses.map((previous, i) => i === index
                        ? e.target.value === "missing" ? "missing" : e.target.value === "null" ? null : Number(e.target.value) as 1 | 2 | 3 : previous)
                })}>
                <MenuItem value="missing">Unanswered (no row)</MenuItem><MenuItem value="null">Unanswered (cleared)</MenuItem>
                {scenarioAttendances.map(a => <MenuItem key={a.id} value={a.id}>{a.text}</MenuItem>)}
            </TextField>)}
            <Button size="small" onClick={() => update({ responses: ["missing", "missing", "missing"] })}>Unanswered</Button>
            <Button size="small" onClick={() => update({ responses: [3, 3, 3] })}>All yes</Button>
            <Button size="small" onClick={() => update({ responses: [1, 1, 1] })}>All no</Button>
            <Button size="small" onClick={() => update({ responses: [3, 1, 2] })}>Mixed</Button>
        </Stack>
        <TextField size="small" label="Stored comment" multiline minRows={2} value={person.comment} onChange={e => update({ comment: e.target.value })} />
    </Stack>;

export const AttendanceScenarioPage = () => {
    const [scenario, setScenario] = React.useState(createAttendanceScenario);
    const [baseline, setBaseline] = React.useState(createAttendanceScenario);
    const [resetKeys, setResetKeys] = React.useState<Record<number, number>>({});
    const [revision, setRevision] = React.useState(0);
    const [json, setJson] = React.useState("");
    const [message, setMessage] = React.useState<{ severity: "success" | "error"; text: string } | null>(null);
    const [lastActions, setLastActions] = React.useState<Record<number, string>>({});
    const update = (patch: Partial<AttendanceScenario>) => setScenario(previous => ({ ...previous, ...patch }));
    const updateUser = (index: number, patch: Partial<AttendanceScenarioUser>) => setScenario(previous => ({
        ...previous, users: previous.users.map((person, i) => i === index ? { ...person, ...patch } : person),
    }));
    const load = (next: AttendanceScenario) => {
        setScenario(next); setBaseline(next); setRevision(value => value + 1); setLastActions({}); setMessage(null);
    };
    const exportScenario = async () => {
        const text = JSON.stringify(scenario, null, 2);
        setJson(text);
        try {
            await navigator.clipboard.writeText(text);
            setMessage({ severity: "success", text: "Current scenario copied. It includes the fixed clock and simulated responses." });
        } catch {
            setMessage({ severity: "success", text: "Current scenario exported below. Select the JSON to copy it." });
        }
    };
    return <Box sx={{ p: { xs: 1, md: 3 }, maxWidth: 1500, mx: "auto" }}>
        <Typography variant="h4" component="h1" gutterBottom>Attendance scenarios</Typography>
        <Typography paragraph color="text.secondary">
            Configure one event and compare the real attendance control for several simulated users. Answers, instruments, and comments stay on this page.
            File uploads are disabled. The page uses fixed sample response options and instruments.
        </Typography>
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
            <Stack spacing={2}>
                <Stack direction="row" gap={3} flexWrap="wrap">
                    <Choices label="Segments" value={String(scenario.segments.length)} choices={[["0", "0"], ["1", "1"], ["2", "2"], ["3", "3"]]}
                        onChange={value => update({ segments: Array.from({ length: Number(value) }, (_, i) => scenario.segments[i] || { cancelled: false, timing: "inherit" }) })} />
                    <Choices label="Event timing" value={scenario.timing} choices={timingChoices}
                        onChange={value => update({ timing: value as AttendanceScenario["timing"] })} />
                    <FormControlLabel control={<Checkbox checked={scenario.cancelled} onChange={(_, checked) => update({ cancelled: checked })} />} label="Event cancelled" />
                </Stack>
                {/* <Choices label="Presentation" value={scenario.presentation} choices={[["list", "List card"], ["detail", "Event detail"], ["both", "Both"]]}
                    onChange={value => update({ presentation: value as AttendanceScenario["presentation"] })} /> */}
                <details><summary>Event details and individual segment timing</summary>
                    <Stack spacing={2} sx={{ pt: 2 }}>
                        <Stack direction="row" gap={2} flexWrap="wrap">
                            <TextField label="Event name" size="small" value={scenario.eventName} onChange={e => update({ eventName: e.target.value })} />
                            <TextField label="Fixed clock (UTC)" size="small" type="datetime-local" value={scenario.now.slice(0, 16)} InputLabelProps={{ shrink: true }}
                                onChange={e => { if (e.target.value && Number.isFinite(Date.parse(`${e.target.value}Z`))) update({ now: new Date(`${e.target.value}Z`).toISOString() }); }} />
                        </Stack>
                        {scenario.segments.map((segment, index) => <Stack key={index} direction="row" gap={2} flexWrap="wrap" alignItems="center">
                            <Typography>Segment {index + 1}</Typography>
                            <FormControlLabel label="Cancelled" control={<Checkbox checked={segment.cancelled} onChange={(_, checked) => update({
                                segments: scenario.segments.map((s, i) => i === index ? { ...s, cancelled: checked } : s),
                            })} />} />
                            <TextField select size="small" label={`Segment ${index + 1} timing`} sx={{ minWidth: 160 }} value={segment.timing}
                                onChange={e => update({ segments: scenario.segments.map((s, i) => i === index ? { ...s, timing: e.target.value as typeof segment.timing } : s) })}>
                                <MenuItem value="inherit">Use event timing</MenuItem>
                                {timingChoices.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
                            </TextField>
                        </Stack>)}
                        <Typography variant="body2" color="text.secondary">Dates are generated around the fixed clock. Caption timing uses the aggregate event interval, including gaps between segments.</Typography>
                    </Stack>
                </details>
                <Stack direction="row" gap={1} flexWrap="wrap">
                    <Button variant="outlined" onClick={() => { void exportScenario(); }}>Copy current scenario</Button>
                    <Button onClick={() => load(baseline)}>Reset to loaded scenario</Button>
                    <Button onClick={() => load(createAttendanceScenario())}>Restore defaults</Button>
                </Stack>
                <details open={json.length > 0 || undefined}><summary>Export / import scenario JSON</summary>
                    <TextField fullWidth multiline minRows={5} maxRows={18} label="Scenario JSON" value={json} onChange={e => setJson(e.target.value)}
                        sx={{ mt: 2, mb: 1, "& textarea": { fontFamily: "monospace", fontSize: 12 } }} />
                    <Button onClick={() => {
                        try { load(attendanceScenarioSchema.parse(JSON.parse(json))); setMessage({ severity: "success", text: "Scenario loaded." }); }
                        catch (error) { setMessage({ severity: "error", text: `Cannot load scenario: ${error instanceof Error ? error.message : String(error)}` }); }
                    }}>Load JSON</Button>
                </details>
                {message && <Alert severity={message.severity} onClose={() => setMessage(null)} sx={{ whiteSpace: "pre-wrap" }}>{message.text}</Alert>}
            </Stack>
        </Paper>
        <Stack spacing={3}>
            {scenario.users.map((person, index) => {
                const { event, attendance } = buildAttendanceScenario(scenario, index);
                const flags = Object.fromEntries(Object.entries(attendance).filter(([, value]) => typeof value === "boolean" || typeof value === "string"));
                const modes = ["list", "detail"];
                return <Paper key={`${revision}-${index}-${resetKeys[index] || 0}`} variant="outlined" sx={{ p: 2 }} data-scenario-user={index}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                        <Typography component="h2" variant="h6">{person.name}</Typography>
                        <Button size="small" onClick={() => {
                            updateUser(index, baseline.users[index]!);
                            setResetKeys(keys => ({ ...keys, [index]: (keys[index] || 0) + 1 }));
                            setLastActions(actions => ({ ...actions, [index]: "Reset to loaded user." }));
                        }}>Reset user</Button>
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {attendance.isInvited ? "Invited" : "Uninvited"} · {person.instrumentCount} profile instrument(s) · Effective instrument: {attendance.eventUserResponse.instrument?.name || "none"}
                    </Typography>
                    <details><summary>Configure {person.name}</summary><UserSettings person={person} segmentCount={scenario.segments.length} update={patch => updateUser(index, patch)} /></details>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: modes.length === 2 ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)" }, gap: 2, my: 2 }}>
                        {modes.map(mode => <Box key={mode} sx={{ minWidth: 0, border: "1px solid", borderColor: "divider", borderRadius: 1, p: 1.5 }} data-presentation={mode}>
                            <Typography variant="overline" component="h3">{mode === "list" ? "List card" : "Event detail"}</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{describeAttendanceVisibility(attendance)}</Typography>
                            <AttendanceControlView attendance={attendance} event={event} minimalWhenNotAlert={mode === "list"} environment={{
                                attendances: scenarioAttendances,
                                instruments: scenarioInstruments,
                                allowUploads: false,
                                datePresentation: { bandTimeZone: "UTC", viewerTimeZone: "UTC", locale: "en" },
                                commentDialogTitle: "Attendance comment", commentDialogDescription: <Typography paragraph>Leave a comment for this event. This preview saves locally.</Typography>,
                                onSave: async change => {
                                    setScenario(previous => ({ ...previous, users: previous.users.map((user, i) => i === index ? applyAttendanceScenarioChange(user, change) : user) }));
                                    setLastActions(actions => ({ ...actions, [index]: `Saved locally: ${JSON.stringify(change)}` }));
                                },
                            }} />
                        </Box>)}
                    </Box>
                    {lastActions[index] && <Typography variant="body2" role="status" sx={{ mb: 1, overflowWrap: "anywhere" }}>{lastActions[index]}</Typography>}
                    <details><summary>Calculation and generated dates</summary>
                        <Box component="pre" sx={{ fontSize: 12, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify({
                            ...flags,
                            storedInstrumentId: person.instrumentId,
                            effectiveInstrumentId: attendance.eventUserResponse.instrument
                                ? db3.getInstrumentIdentity(attendance.eventUserResponse.instrument)
                                : null,
                            segments: event.segments.map(s => ({ id: s.id, startsAt: s.startsAt, cancelled: s.statusId !== null, response: person.responses[s.id - 1] })),
                        }, null, 2)}</Box>
                    </details>
                </Paper>;
            })}
        </Stack>
    </Box>;
};
