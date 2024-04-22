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
const gMaxBPM = 240;

export interface MetronomePlayerProps {
    bpm: number;
    syncTrigger: number;
    isTapping: boolean;
};


export const MetronomePlayer: React.FC<MetronomePlayerProps> = ({ bpm, syncTrigger, isTapping }) => {
    const classes = ['metronomeIndicator tick', 'metronomeIndicator tock'] as const;
    const [activeClass, setActiveClass] = React.useState<boolean>(false);
    const timerIDRef = React.useRef<number | undefined>(undefined);
    const audioContextRef = React.useRef<AudioContext | null>(null);
    const tickBufferRef = React.useRef<AudioBuffer | null>(null);

    // the sample that's scheduled to play next.
    const nextTickSource = React.useRef<AudioBufferSourceNode | null>(null);
    const nextTickBPM = React.useRef<number>(0); // in order to have smooth bpm transitions, keep track of the speed of the previous tick.
    const nextTickScheduledTime = React.useRef<number>(0); // and when is it scheduled, to know when it passed. also used to calculate next beat.

    // when swapping out, we don't want to disconnect it immediately, or we risk chopping off the sample.
    // put it in a place to be disconnected on next tick.
    const tickTrash = React.useRef<AudioBufferSourceNode | null>(null);

    bpm = Clamp(bpm, gMinBPM, gMaxBPM);

    const scheduleTick = (t?: number | undefined) => {
        if (t && t < 0) {
            debugger;
        }
        const ctx = audioContextRef.current!;
        const tickSource = ctx.createBufferSource();
        tickSource.buffer = tickBufferRef.current;
        tickSource.connect(ctx.destination);
        tickSource.start(t);
        const currentTime = ctx.currentTime;
        if (t === undefined) {
            setActiveClass((value) => !value);
        } else {
            const ms = 1000 * (t - currentTime);
            if (ms > 0) {
                window.setTimeout(() => setActiveClass((val) => !val), ms);
            }
        }
        return tickSource;
    };

    const beatsAndBPMToMS = (beats: number, bpm__) => beats * 1000 * 60 / bpm__;
    const beatsToMS = (beats: number) => beatsAndBPMToMS(beats, bpm);//beats * 1000 * 60 / bpm;

    const beatsAndBPMToSec = (beats: number, bpm__) => beats * 60 / bpm__;
    const beatsToSec = (beats: number) => beatsAndBPMToSec(beats, bpm);//beats * 1000 * 60 / bpm;

    // timer proc to ensure there's a next tick scheduled for play.
    // Scheduler function to queue up ticks in the audio context; setInterval is not accurate enough.
    // basically this runs and schedules a tick a short time in the future.
    const tickProc = (forceImmediate?: boolean, isTapping?: boolean) => {
        const ctx = audioContextRef.current!;
        const currentTime = ctx.currentTime;
        const halfBeatMS = beatsToMS(0.5);

        // - delete the trash node
        if (tickTrash.current) {
            tickTrash.current.disconnect();
            tickTrash.current = null;
        }

        // - force immediate
        if (forceImmediate) {
            // stop currently playing stuff
            if (nextTickSource.current) {
                nextTickSource.current.stop();
                nextTickSource.current.disconnect();
                nextTickSource.current = null;
            }
            nextTickSource.current = scheduleTick(); // plays immediatly
            nextTickBPM.current = bpm;
            nextTickScheduledTime.current = currentTime;
            // timer set for middle of beat.
            timerIDRef.current = window.setTimeout(tickProc,);
            return;
        }

        if (!nextTickSource.current) {
            nextTickSource.current = scheduleTick(); // plays immediatly
            nextTickBPM.current = bpm;
            nextTickScheduledTime.current = currentTime;
            // timer set for middle of beat.
            timerIDRef.current = window.setTimeout(tickProc, halfBeatMS);
            return;
        }

        // - if tick is passed, move to trash and schedule a new one. this should almost always be the case.
        if (nextTickScheduledTime.current < currentTime) {
            tickTrash.current = nextTickSource.current;

            // calculate audio time of the next beat.
            const timeElapsed = currentTime - nextTickScheduledTime.current; // seconds since the tick passed
            const beatFrac = timeElapsed * (nextTickBPM.current / 60); // beats, expressed in ITS BPM
            let remainingSec = beatsToSec(1.0 - beatFrac);

            // if you're tapping tempo, you want beats to line up with your taps.
            // this has the effect of bringing tap tempo bpm changes closer to NOW (the time you tap) over time.
            if (isTapping) {
                remainingSec = 0;
            }

            nextTickBPM.current = bpm;

            // it could be that we somehow miss a beat, especially during weird turbuent times or changing BPMs. in that case we can choose to skip it or to schedule it.
            if (remainingSec <= 0) {
                scheduleTick(undefined); // immediate.
                nextTickScheduledTime.current = currentTime + remainingSec;
                timerIDRef.current = window.setTimeout(tickProc, halfBeatMS);
                return;
            }

            nextTickScheduledTime.current = currentTime + remainingSec;
            nextTickSource.current = scheduleTick(currentTime + remainingSec);
            // and set our next timeout to the middle of the beat after nexttick.
            timerIDRef.current = window.setTimeout(tickProc, (remainingSec * 1000) + halfBeatMS);
            return;
        }

        // for some reason the tick that's scheduled next has NOT passed yet. let's just try again in the middle of the next beat.
        const timeRemaining = nextTickScheduledTime.current - currentTime;
        const beatFracRemaining = timeRemaining * (nextTickBPM.current / 60);
        const remainingMSInBeat = beatsToMS(beatFracRemaining); // so this is how long until the tick occurs.

        timerIDRef.current = window.setTimeout(tickProc, remainingMSInBeat + halfBeatMS);
    };

    const doBeatSync = () => {
        if (!audioContextRef.current) return;
        if (timerIDRef.current) {
            clearTimeout(timerIDRef.current);
            timerIDRef.current = undefined;
        }

        tickProc(true);
    };

    const doInit = async () => {
        if (!!audioContextRef.current) return; // double mount?
        audioContextRef.current = new AudioContext();
        const response = await fetch(gTickSampleFilePath);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
        tickBufferRef.current = audioBuffer;
        doBeatSync();
    };

    const doStop = () => {
        if (tickTrash.current) {
            tickTrash.current.disconnect();
            tickTrash.current = null;
        }
        if (nextTickSource.current) {
            nextTickSource.current.stop();
            nextTickSource.current.disconnect();
            nextTickSource.current = null;
        }

        if (timerIDRef.current) {
            clearTimeout(timerIDRef.current);
            timerIDRef.current = undefined;
        }
    };

    React.useEffect(() => {
        void doInit();
        return () => doStop();
    }, []);

    React.useEffect(() => {
        doBeatSync();
    }, [syncTrigger]);

    React.useEffect(() => {
        if (timerIDRef.current) {
            clearTimeout(timerIDRef.current);
            timerIDRef.current = undefined;
        }

        tickProc(false, isTapping);
    }, [bpm]);

    return <div className="metronomePlayerContainer">
        <div className={classes[activeClass ? 0 : 1]}>
        </div>
    </div>;
};




export const MetronomeButton = ({ bpm, mountPlaying, beatSyncTrigger, isTapping }: { bpm: number, mountPlaying?: boolean, beatSyncTrigger?: number, isTapping: boolean }) => {
    const [playing, setPlaying] = React.useState<boolean>(mountPlaying || false);
    const dashboardContext = React.useContext(DashboardContext);
    const [beatSyncToggle, setBeatSyncToggle] = React.useState<number>(0);
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

    return <div className="metronomeButtonContainer">
        <div onClick={() => setPlaying(!playing)} className={`freeButton metronomeButton ${playing ? "playing" : "notPlaying"}`}>
            {playing ? gIconMap.VolumeUp() : gIconMap.VolumeOff()}
            {playing && <MetronomePlayer bpm={bpm} syncTrigger={(beatSyncTrigger || 0) + beatSyncToggle} isTapping={isTapping} />}
        </div>
        {playing && <div className="metronomeSyncButton freeButton" onClick={(e) => {
            setBeatSyncToggle(beatSyncToggle + 1);
            e.stopPropagation();
            e.preventDefault();
        }}>
            Sync
        </div>}


    </div>;
};


// // filters outliers, takes equal average of all tap intervals
// function calculateBPM(tapIntervals) {
//     if (tapIntervals.length < 2) {
//         return 0; // Not enough taps to calculate BPM
//     }

//     // Filter outliers using a method such as interquartile range or standard deviation
//     const sortedIntervals = tapIntervals.slice().sort((a, b) => a - b);
//     const q1 = sortedIntervals[Math.floor(sortedIntervals.length / 4)];
//     const q3 = sortedIntervals[Math.floor(3 * sortedIntervals.length / 4)];
//     const iqr = q3 - q1;
//     const lowerBound = q1 - 1.5 * iqr;
//     const upperBound = q3 + 1.5 * iqr;

//     const filteredIntervals = sortedIntervals.filter(x => x >= lowerBound && x <= upperBound);

//     // Calculate average interval from filtered intervals
//     const averageInterval = filteredIntervals.reduce((a, b) => a + b, 0) / filteredIntervals.length;

//     // Convert intervals into BPM
//     const bpm = Math.round(60000 / averageInterval);
//     return bpm;
// }

// uses IQR filter + linear weighted average
function calculateBPM(tapIntervals) {
    if (tapIntervals.length < 2) {
        return 0; // Not enough taps to calculate BPM accurately
    }

    // Filter out outliers using IQR
    const sortedIntervals = [...tapIntervals].sort((a, b) => a - b);
    const q1 = sortedIntervals[Math.floor(sortedIntervals.length / 4)];
    const q3 = sortedIntervals[Math.floor(3 * sortedIntervals.length / 4)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    const filteredIntervals = sortedIntervals.filter(x => (x >= lowerBound && x <= upperBound));

    if (filteredIntervals.length < 1) {
        return 0; // Not enough valid taps after filtering
    }

    // Calculate the simple average of the filtered intervals
    const averageInterval = filteredIntervals.reduce((a, b) => a + b, 0) / filteredIntervals.length;

    // Convert the average interval to BPM
    const bpm = Math.round(60000 / averageInterval);
    return bpm;
}

// // filter outliers + use an RMS weighting
// function calculateBPM(tapIntervals) {
//     if (tapIntervals.length < 2) {
//         return 0; // Not enough taps to calculate BPM accurately
//     }

//     // Filter out outliers first using IQR
//     const sortedIntervals = [...tapIntervals].sort((a, b) => a - b);
//     const q1 = sortedIntervals[Math.floor(sortedIntervals.length / 4)];
//     const q3 = sortedIntervals[Math.floor(3 * sortedIntervals.length / 4)];
//     const iqr = q3 - q1;
//     const filteredIntervals = sortedIntervals.filter(x => (x >= q1 - 1.5 * iqr) && (x <= q3 + 1.5 * iqr));

//     if (filteredIntervals.length < 2) {
//         return 0; // Not enough valid taps after filtering
//     }

//     // Calculate weighted RMS of intervals
//     let weightedSumSquares = 0;
//     let totalWeight = 0;
//     filteredIntervals.forEach((interval, index) => {
//         let weight = index + 1; // Increasing weight for more recent intervals
//         weightedSumSquares += interval * interval * weight;
//         totalWeight += weight;
//     });

//     console.log(filteredIntervals.map(i => 60000 / i));
//     console.log(`filtered out ${tapIntervals.length - filteredIntervals.length} taps; weightedSumSquares=${weightedSumSquares} totalWeight=${totalWeight}`);

//     const rmsInterval = Math.sqrt(weightedSumSquares / totalWeight);

//     // Convert RMS interval to BPM
//     const bpm = Math.round(60000 / rmsInterval);
//     return bpm;
// }




export interface TapTempoProps {
    onFirstClick: () => void;
    onStopTapping: () => void;
    onChange: (newBpm: number, tapCount: number) => void;
}


export const TapTempo: React.FC<TapTempoProps> = ({ onChange, onFirstClick, onStopTapping }) => {
    const [lastTapTime, setLastTapTime] = React.useState<number | null>(null);
    const tapTimes = React.useRef<number[]>([]);
    const [classToggle, setClassToggle] = React.useState<boolean>(false);
    const timerIDRef = React.useRef<number | undefined>(undefined);
    const classes = [
        'tapTempoButton freeButton tick',
        'tapTempoButton freeButton tock',
    ];

    const handleTap = () => {
        if (tapTimes.current.length === 0) {
            onFirstClick();
        }

        const currentTime = Date.now();
        if (lastTapTime !== null && currentTime - lastTapTime < 200) { // Debounce rapid taps
            return;
        }
        setClassToggle(!classToggle);

        if (timerIDRef.current) {
            clearTimeout(timerIDRef.current);
        }

        if (lastTapTime !== null) {
            tapTimes.current.push(currentTime - lastTapTime);
        }

        setLastTapTime(currentTime);

        const calculatedBpm = calculateBPM(tapTimes.current);
        if (calculatedBpm) {
            onChange(calculatedBpm, tapTimes.current.length);
        }

        timerIDRef.current = window.setTimeout(() => {
            tapTimes.current = [];
            setLastTapTime(null);
            onStopTapping();
        }, 1400);
    };

    return (
        <div onClick={handleTap} className={classes[classToggle ? 0 : 1]}>
            {lastTapTime !== null ? tapTimes.current.length : "Tap"}
        </div>
    );
};

export interface MetronomeDialogProps {
    onClose: () => void;
}

export const MetronomeDialog = (props: MetronomeDialogProps) => {
    const [bpm, setBPM] = React.useState<number>(120);
    const [textBpm, setTextBpm] = React.useState<string>("120");
    const [beatSyncToggle, setBeatSyncToggle] = React.useState<number>(0);
    const [isTapping, setIsTapping] = React.useState<boolean>(false);

    return <ReactiveInputDialog onCancel={props.onClose} className="GlobalMetronomeDialog">
        <DialogTitle>
            Metronome
        </DialogTitle>
        <DialogContent dividers>
            <MetronomeButton bpm={bpm} mountPlaying={true} beatSyncTrigger={beatSyncToggle} isTapping={isTapping} />
            <div className="bpmAndTapRow">
                <CMTextInputBase
                    onChange={(e, v) => {
                        setTextBpm(v);
                        const n = CoerceToNumberOrNull(v);
                        if (!n) return;
                        if (n < gMinBPM) return;
                        if (n > gMaxBPM) return;
                        setBPM(n);
                    }}
                    value={textBpm}
                />
                <TapTempo
                    onFirstClick={() => {
                        setIsTapping(true);
                        setBeatSyncToggle(beatSyncToggle + 1);
                    }}
                    onStopTapping={() => {
                        setIsTapping(false);
                    }}
                    onChange={(newBpm, count) => {
                        setBPM(newBpm);
                        setTextBpm(newBpm.toString());
                    }} />
            </div>
            <div className="sliderContainer">
                <div className="nudge minus freeButton" onClick={() => {
                    setBPM(bpm - 1);
                    setTextBpm((bpm - 1).toString());
                }}>-</div>
                <div className="nudge plus freeButton" onClick={() => {
                    setBPM(bpm + 1);
                    setTextBpm((bpm + 1).toString());
                }}>+</div>
                <input className="bpmSlider" type="range" min={gMinBPM} max={gMaxBPM} value={bpm} onChange={e => {
                    setBPM(e.target.valueAsNumber);
                    setTextBpm(e.target.value);
                }} />
            </div>
        </DialogContent>
        <DialogActions>
            <Button className="closeButton" onClick={props.onClose}>Close</Button>
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
