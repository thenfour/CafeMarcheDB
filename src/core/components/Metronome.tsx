import React from "react";
import { gIconMap } from "../db3/components/IconSelectDialog";
import { ReactiveInputDialog } from "./CMCoreComponents";
import { CMTextInputBase } from "./CMTextField";
import { Clamp, CoerceToNumberOrNull } from "shared/utils";
import { Button } from "@mui/base";
import { DialogActions, DialogContent, DialogTitle, Tooltip } from "@mui/material";
import { DashboardContext } from './DashboardContext';

const gTickSampleFilePath = "/Metronome.mp3";
const gMinBPM = 30;
const gMaxBPM = 260;

export interface MetronomePlayerProps {
    bpm: number;
};


export const MetronomePlayer: React.FC<MetronomePlayerProps> = ({ bpm }) => {
    const classes = ['metronomeIndicator tick', 'metronomeIndicator tock'] as const;
    const [activeClass, setActiveClass] = React.useState<boolean>(false);
    const wantInitialTick = React.useRef<boolean>(false);
    const audioContextRef = React.useRef<AudioContext | null>(null);
    const nextTickTimeRef = React.useRef<number>(0);
    const timerIDRef = React.useRef<number | undefined>(undefined);
    const tickBufferRef = React.useRef<AudioBuffer | null>(null);

    bpm = Clamp(bpm, gMinBPM, gMaxBPM);

    const playTick = () => {
        if (audioContextRef.current) {
            if (!tickBufferRef.current) {
                wantInitialTick.current = true;
                return;
            }

            const tickSource = audioContextRef.current.createBufferSource();
            tickSource.buffer = tickBufferRef.current;
            tickSource.connect(audioContextRef.current.destination);
            tickSource.start();
            setActiveClass((val) => !val);
        }
    };

    const loadTickSample = async (audioContext: AudioContext, filePath: string) => {
        const response = await fetch(filePath);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        tickBufferRef.current = audioBuffer;
        if (wantInitialTick.current) {
            playTick();
        }
    };

    // Scheduler function to queue up ticks
    const scheduleTick = () => {
        if (audioContextRef.current) {
            if (!tickBufferRef.current) {
                wantInitialTick.current = true;
                return;
            }
            const currentTime = audioContextRef.current.currentTime;
            // Swap classes to trigger animation
            setActiveClass((val) => !val);

            // Schedule ticks only if we're ahead of time
            while (nextTickTimeRef.current < currentTime + 0.1) {
                const tickSource = audioContextRef.current.createBufferSource();
                tickSource.buffer = tickBufferRef.current;
                tickSource.connect(audioContextRef.current.destination);
                tickSource.start(nextTickTimeRef.current);

                nextTickTimeRef.current += 60 / bpm;
            }
        }
    };

    const resetMetronome = () => {
        if (audioContextRef.current) {
            nextTickTimeRef.current = audioContextRef.current.currentTime;

            if (timerIDRef.current) {
                clearInterval(timerIDRef.current);
            }

            playTick();

            timerIDRef.current = window.setInterval(scheduleTick, 1000 * 60 / bpm);
        }
    };

    // Start the metronome
    const startMetronome = () => {
        if (!audioContextRef.current) {
            audioContextRef.current = new AudioContext();
            void loadTickSample(audioContextRef.current, gTickSampleFilePath);
        }
        resetMetronome();
    };

    const stopMetronome = () => {
        if (timerIDRef.current) {
            clearInterval(timerIDRef.current);
            timerIDRef.current = undefined;
        }
    };

    React.useEffect(() => {
        startMetronome();
        return () => stopMetronome();
    }, [bpm, gTickSampleFilePath]);

    return <div className="metronomePlayerContainer">
        <div className={classes[activeClass ? 0 : 1]}>
        </div>
        <div className="metronomeSyncButton" onClick={(e) => {
            resetMetronome();
            e.stopPropagation();
            e.preventDefault();
        }}>
            Sync
        </div>
    </div>;
};




export const MetronomeButton = ({ bpm, mountPlaying }: MetronomePlayerProps & { mountPlaying?: boolean }) => {
    const [playing, setPlaying] = React.useState<boolean>(mountPlaying || false);
    const dashboardContext = React.useContext(DashboardContext);
    const mySilencer = React.useRef<() => void>(() => setPlaying(false));

    React.useEffect(() => {
        // add self
        dashboardContext.metronomeSilencers.push(mySilencer.current);
        return () => {
            // remove self from silencers.
            const withoutSelf = dashboardContext.metronomeSilencers.filter(s => s != mySilencer.current);
            dashboardContext.metronomeSilencers = withoutSelf;
        };
    }, []);

    React.useEffect(() => {
        if (playing) {
            const withoutSelf = dashboardContext.metronomeSilencers.filter(s => s != mySilencer.current);
            withoutSelf.forEach(s => s());
        }
    }, [playing]);

    return <div onClick={() => setPlaying(!playing)} className={`freeButton metronomeButton ${playing ? "playing" : "notPlaying"}`}>
        {playing ? gIconMap.VolumeUp() : gIconMap.VolumeOff()}
        {playing && <MetronomePlayer bpm={bpm} />}
    </div>;
};


export interface TapTempoProps {
    bpm: number;
    onChange: (newBpm: number) => void;
}

export const TapTempo: React.FC<TapTempoProps> = ({ bpm, onChange }) => {
    const [lastTapTime, setLastTapTime] = React.useState<number | null>(null);
    const tapTimes = React.useRef<number[]>([]);
    const classes = [
        'tapTempoButton freeButton tick',
        'tapTempoButton freeButton tock',
    ];
    const [classToggle, setClassToggle] = React.useState<boolean>(false);

    const handleTap = () => {
        const currentTime = Date.now();
        setClassToggle(!classToggle);
        if (lastTapTime !== null) {
            const interval = currentTime - lastTapTime;
            tapTimes.current.push(interval);

            // Calculate average interval
            const averageInterval = tapTimes.current.reduce((a, b) => a + b, 0) / tapTimes.current.length;
            const calculatedBpm = Math.round(60000 / averageInterval);

            onChange(calculatedBpm);
        }
        setLastTapTime(currentTime);

        // Reset if more than 2 seconds pass between taps
        setTimeout(() => {
            if (Date.now() - currentTime > 2000) {
                tapTimes.current = [];
                setLastTapTime(null);
            }
        }, 2000);
    };

    return (
        <div onClick={handleTap} className={classes[classToggle ? 0 : 1]}>
            tap
        </div>
    );
};

export interface MetronomeDialogProps {
    onClose: () => void;
}




export const MetronomeDialog = (props: MetronomeDialogProps) => {
    const [bpm, setBPM] = React.useState<number>(120);
    const [textBpm, setTextBpm] = React.useState<string>("120");
    return <ReactiveInputDialog onCancel={props.onClose} className="GlobalMetronomeDialog">
        <DialogTitle>
            Metronome
        </DialogTitle>
        <DialogContent dividers>
            <MetronomeButton bpm={bpm} mountPlaying={true} />
            <div className="bpmAndTapRow">
                <CMTextInputBase
                    onChange={(e, v) => {
                        const n = CoerceToNumberOrNull(v);
                        if (!n) return;
                        setBPM(n);
                    }}
                    value={textBpm.toString()}
                />
                <TapTempo bpm={bpm} onChange={(newBpm) => {
                    setBPM(newBpm);
                    setTextBpm(newBpm.toString());
                }} />
            </div>
            <input className="bpmSlider" type="range" min={gMinBPM} max={gMaxBPM} value={bpm} onChange={e => {
                setBPM(e.target.valueAsNumber);
                setTextBpm(e.target.value);
            }} />
        </DialogContent>
        <DialogActions>
            <Button onClick={props.onClose}>Close</Button>
        </DialogActions>



    </ReactiveInputDialog>;
};

export const MetronomeDialogButton = () => {
    const [open, setOpen] = React.useState<boolean>(false);
    return <>
        <Tooltip title="Open metronome app"><div className="freeButton globalMetronomeButton" onClick={() => setOpen(!open)}>{gIconMap.VolumeDown()}</div></Tooltip>
        {open && <MetronomeDialog onClose={() => setOpen(false)} />}
    </>;
};
