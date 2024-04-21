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
    const [activeClass, setActiveClass] = React.useState('metronomeIndicator tick');
    const audioContextRef = React.useRef<AudioContext | null>(null);
    const nextTickTimeRef = React.useRef<number>(0);
    const timerIDRef = React.useRef<number | undefined>(undefined);
    const tickBufferRef = React.useRef<AudioBuffer | null>(null);

    bpm = Clamp(bpm, gMinBPM, gMaxBPM);

    // Load the tick sample
    const loadTickSample = async (audioContext: AudioContext, filePath: string) => {
        const response = await fetch(filePath);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        tickBufferRef.current = audioBuffer;
    };

    // Scheduler function to queue up ticks
    const scheduleTick = () => {
        if (audioContextRef.current && tickBufferRef.current) {
            const currentTime = audioContextRef.current.currentTime;

            // Schedule ticks only if we're ahead of time
            while (nextTickTimeRef.current < currentTime + 0.1) {
                const tickSource = audioContextRef.current.createBufferSource();
                tickSource.buffer = tickBufferRef.current;
                tickSource.connect(audioContextRef.current.destination);
                tickSource.start(nextTickTimeRef.current);

                // Swap classes to trigger animation
                setActiveClass(prevClass => (prevClass === 'metronomeIndicator tick' ? 'metronomeIndicator tock' : 'metronomeIndicator tick'));

                nextTickTimeRef.current += 60 / bpm;
            }
        }
    };

    // Start the metronome
    const startMetronome = () => {
        if (!audioContextRef.current) {
            audioContextRef.current = new AudioContext();
            loadTickSample(audioContextRef.current, gTickSampleFilePath);
        }
        nextTickTimeRef.current = audioContextRef.current.currentTime;
        scheduleTick();
        timerIDRef.current = window.setInterval(scheduleTick, 1000 * 60 / bpm);
    };

    // Stop the metronome
    const stopMetronome = () => {
        if (timerIDRef.current) {
            clearInterval(timerIDRef.current);
            timerIDRef.current = undefined;
        }
    };

    // Handle component mount and unmount
    React.useEffect(() => {
        startMetronome();
        return () => stopMetronome();
    }, [bpm, gTickSampleFilePath]);

    return <div className={activeClass}></div>;
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
