import React from "react";
import { Alert, Box, Button, Chip, Divider, LinearProgress, MenuItem, Select, Stack, Typography, Accordion, AccordionSummary, AccordionDetails } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { TunerEngine, TunerReading, TunerStatusUpdate } from "@/src/core/audio/tuner/tunerEngine";
import { CMSinglePageSurfaceCard } from "../CMCoreComponents";
import { SegmentedVuMeter } from "./SegmentedVuMeter";
import { AdminContainer } from "../CMCoreComponents2";

const NO_DEVICE_ID = "default";

const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

function frequencyToMidi(frequencyHz: number): number {
    return 69 + 12 * Math.log2(frequencyHz / 440);
}

function midiToNoteName(midi: number): string {
    const noteIndex = ((Math.round(midi) % 12) + 12) % 12;
    const octave = Math.floor(Math.round(midi) / 12) - 1;
    return `${noteNames[noteIndex]}${octave}`;
}

function formatFrequency(frequencyHz: number | null): string {
    if (!frequencyHz) return "—";
    return `${frequencyHz.toFixed(2)} Hz`;
}

function formatCents(detuneCents: number | null): string {
    if (detuneCents === null) return "—";
    const rounded = detuneCents.toFixed(1);
    return `${rounded} cents`;
}

type NoteData = {
    noteLabel: string;
    centsLabel: string;
    centsValue: number | null;
};

function deriveNoteData(reading: TunerReading | null): NoteData {
    if (!reading || !reading.frequencyHz) {
        return { noteLabel: "—", centsLabel: "—", centsValue: null };
    }
    const midi = frequencyToMidi(reading.frequencyHz);
    const nearest = Math.round(midi);
    const cents = (midi - nearest) * 100;
    return {
        noteLabel: midiToNoteName(nearest),
        centsLabel: formatCents(cents),
        centsValue: cents,
    };
}

function formatConfidence(confidence01: number): string {
    return `${Math.round(confidence01 * 100)}%`;
}

function formatRms(rms: number): string {
    return `${(rms * 100).toFixed(1)}% level`;
}

function mapCentsToPercent(cents: number | null): number {
    if (cents === null) return 50;
    const clamped = Math.min(50, Math.max(-50, cents));
    return (clamped + 50) * 1; // -50..50 -> 0..100
}

function levelPercent(rms: number | undefined): number {
    if (!rms || rms <= 0) return 0;
    // scale roughly to 0-1 range then to percent; rms of 0.5 ~ very loud
    const scaled = Math.min(1, rms * 2);
    return scaled * 100;
}

const TunerStatusChip = ({ status }: { status: TunerStatusUpdate }) => {
    if (status.status === "running") return <Chip size="small" color="success" label="Listening" />;
    if (status.status === "starting") return <Chip size="small" color="warning" label="Starting" />;
    if (status.status === "error") return <Chip size="small" color="error" label="Error" />;
    return <Chip size="small" variant="outlined" label="Idle" />;
};

export const TunerUserDisplay: React.FC<{
    handleRefreshDevices: () => Promise<void>;
    handleStart: () => Promise<void>;
    handleStop: () => Promise<void>;
    devices: MediaDeviceInfo[];
    selectedDeviceId: string;
    setSelectedDeviceId: (id: string) => void;
    reading: TunerReading | null;
    status: TunerStatusUpdate;
}> = (props) => {
    const noteData = deriveNoteData(props.reading);
    const centsPercent = mapCentsToPercent(noteData.centsValue);

    return (
        <div className="tunerPro">
            <div className="tunerHeader" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", rowGap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Typography variant="h6" component="h2">Tuner</Typography>
                    <TunerStatusChip status={props.status} />
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                    <Button variant="outlined" onClick={props.handleRefreshDevices}>Refresh inputs</Button>
                    {props.status.status !== "running" && <Button variant="contained" onClick={props.handleStart}>Start</Button>}
                    {props.status.status === "running" && <Button variant="text" onClick={props.handleStop}>Stop</Button>}
                </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", rowGap: "8px" }}>
                <Typography variant="body2">Input</Typography>
                <Select
                    size="small"
                    value={props.selectedDeviceId}
                    onChange={(e) => props.setSelectedDeviceId(e.target.value)}
                    sx={{ minWidth: 220 }}
                >
                    <MenuItem value={NO_DEVICE_ID}>System default</MenuItem>
                    {props.devices.map(d => (
                        <MenuItem key={d.deviceId || d.label} value={d.deviceId}>{d.label || "Mic"}</MenuItem>
                    ))}
                </Select>
            </div>

            {props.status.status === "error" && (
                <Alert severity="error">{props.status.message ?? "Tuner error"}</Alert>
            )}

            <div>
                <div className="bigNote">{noteData.noteLabel}</div>

                <div>
                    <Typography variant="subtitle2" gutterBottom>Cents offset</Typography>
                    <div style={{ position: "relative", height: 10, borderRadius: 5, backgroundColor: "rgba(0,0,0,0.08)" }}>
                        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, backgroundColor: "rgba(0,0,0,0.2)" }} />
                        <div
                            style={{
                                position: "absolute",
                                top: -4,
                                height: 18,
                                width: 4,
                                borderRadius: 2,
                                backgroundColor: "#1976d2",
                                transition: "left 120ms ease-out",
                                left: `${centsPercent}%`,
                                transform: "translateX(-50%)",
                            }}
                        />
                    </div>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{noteData.centsLabel}</Typography>
                </div>
            </div>

            <div>
                <SegmentedVuMeter valueRms={props.reading?.rms ?? 0} />
            </div>
        </div>
    );
};

export const TunerDevDisplay: React.FC<{
    handleRefreshDevices: () => Promise<void>;
    handleStart: () => Promise<void>;
    handleStop: () => Promise<void>;
    devices: MediaDeviceInfo[];
    selectedDeviceId: string;
    setSelectedDeviceId: (id: string) => void;
    reading: TunerReading | null;
    status: TunerStatusUpdate;
}> = (props) => {

    const { noteLabel, centsLabel } = deriveNoteData(props.reading);

    return <Stack spacing={2}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6" component="h2">Tuner (beta)</Typography>
            <Stack direction="row" spacing={1}>
                <Button variant="outlined" onClick={props.handleRefreshDevices}>Refresh inputs</Button>
                {props.status.status !== "running" && <Button variant="contained" onClick={props.handleStart}>Start</Button>}
                {props.status.status === "running" && <Button variant="text" onClick={props.handleStop}>Stop</Button>}
            </Stack>
        </Stack>

        <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="body2">Input:</Typography>
            <Select
                size="small"
                value={props.selectedDeviceId}
                onChange={(e) => props.setSelectedDeviceId(e.target.value)}
                sx={{ minWidth: 200 }}
            >
                <MenuItem value={NO_DEVICE_ID}>System default</MenuItem>
                {props.devices.map(d => (
                    <MenuItem key={d.deviceId || d.label} value={d.deviceId}>{d.label || "Mic"}</MenuItem>
                ))}
            </Select>
        </Stack>

        {props.status.status === "error" && (
            <Alert severity="error">{props.status.message ?? "Tuner error"}</Alert>
        )}

        <Box>
            <Typography variant="subtitle2" gutterBottom>Pitch</Typography>
            <Typography variant="h4">{noteLabel}</Typography>
            <Typography variant="body2" color="text.secondary">{formatFrequency(props.reading?.frequencyHz ?? null)} · {centsLabel}</Typography>
        </Box>

        <Box>
            <Typography variant="subtitle2" gutterBottom>Confidence</Typography>
            <LinearProgress variant="determinate" value={(props.reading?.confidence01 ?? 0) * 100} />
            <Typography variant="caption" color="text.secondary">{formatConfidence(props.reading?.confidence01 ?? 0)}</Typography>
        </Box>

        <Box>
            <Typography variant="subtitle2" gutterBottom>Input level</Typography>
            <LinearProgress variant="determinate" value={Math.min(100, (props.reading?.rms ?? 0) * 200)} />
            <Typography variant="caption" color="text.secondary">{formatRms(props.reading?.rms ?? 0)}</Typography>
        </Box>
    </Stack>
};

export const TunerCard: React.FC = () => {
    const [reading, setReading] = React.useState<TunerReading | null>(null);
    const [status, setStatus] = React.useState<TunerStatusUpdate>({ status: "idle" });
    const [devices, setDevices] = React.useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = React.useState<string>(NO_DEVICE_ID);
    const engineRef = React.useRef<TunerEngine | null>(null);

    if (!engineRef.current) {
        engineRef.current = new TunerEngine({
            onReading: setReading,
            onStatus: setStatus,
        });
    }
    const engine = engineRef.current;

    const handleRefreshDevices = React.useCallback(async () => {
        try {
            const found = await engine.listAudioInputs();
            setDevices(found);
        } catch (err) {
            setStatus({ status: "error", message: err instanceof Error ? err.message : "Unable to list devices" });
        }
    }, [engine]);

    const handleStart = React.useCallback(async () => {
        await handleRefreshDevices();
        await engine.start(selectedDeviceId === NO_DEVICE_ID ? undefined : selectedDeviceId);
    }, [engine, handleRefreshDevices, selectedDeviceId]);

    const handleStop = React.useCallback(async () => {
        await engine.stop();
    }, [engine]);

    React.useEffect(() => {
        return () => {
            void engine.stop();
        };
    }, [engine]);

    return (<>
        <TunerUserDisplay
            handleRefreshDevices={handleRefreshDevices}
            handleStart={handleStart}
            handleStop={handleStop}
            devices={devices}
            selectedDeviceId={selectedDeviceId}
            setSelectedDeviceId={setSelectedDeviceId}
            reading={reading}
            status={status}
        />

        <AdminContainer>
            <TunerDevDisplay
                handleRefreshDevices={handleRefreshDevices}
                handleStart={handleStart}
                handleStop={handleStop}
                devices={devices}
                selectedDeviceId={selectedDeviceId}
                setSelectedDeviceId={setSelectedDeviceId}
                reading={reading}
                status={status}
            />

        </AdminContainer>

    </>);
};
