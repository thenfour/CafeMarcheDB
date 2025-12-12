import React from "react";
import { Alert, Box, Button, LinearProgress, MenuItem, Select, Stack, Typography } from "@mui/material";
import { TunerEngine, TunerReading, TunerStatusUpdate } from "@/src/core/audio/tuner/tunerEngine";
import { CMSinglePageSurfaceCard } from "../CMCoreComponents";

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

function deriveNoteData(reading: TunerReading | null) {
    if (!reading || !reading.frequencyHz) {
        return { noteLabel: "—", centsLabel: "—" };
    }
    const midi = frequencyToMidi(reading.frequencyHz);
    const nearest = Math.round(midi);
    const cents = (midi - nearest) * 100;
    return {
        noteLabel: midiToNoteName(nearest),
        centsLabel: formatCents(cents),
    };
}

function formatConfidence(confidence01: number): string {
    return `${Math.round(confidence01 * 100)}%`;
}

function formatRms(rms: number): string {
    return `${(rms * 100).toFixed(1)}% level`;
}

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

    return (
        <CMSinglePageSurfaceCard>
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
        </CMSinglePageSurfaceCard>
    );
};
