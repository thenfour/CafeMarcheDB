import { Button } from "@mui/base";
import { DialogContent, Tooltip } from "@mui/material";
import React from "react";
import { Clamp, CoerceToNumberOrNull } from "shared/utils";
import { CMTextInputBase } from "./CMTextField";
import { DashboardContext } from './DashboardContext';
//import { useURLState } from "./CMCoreComponents2";
import { gIconMap } from "../db3/components/IconMap";
import { Knob } from "./Knob";
import { ReactiveInputDialog } from "./ReactiveInputDialog";

const gTickSampleFilePath = "/Metronome2.mp3";
const gMinBPM = 40;
const gMaxBPM = 220;


export interface MetronomePlayerProps {
    bpm: number;
    syncTrigger: number;
    mute: boolean;
    running: boolean;
};

// this is just a metronome player.
export const MetronomePlayer: React.FC<MetronomePlayerProps> = ({ bpm, syncTrigger, mute, running }) => {
    const classes = ['metronomeIndicator', 'metronomeIndicator tick', 'metronomeIndicator tock'] as const;
    const [activeClass, setActiveClass] = React.useState<number>(0);
    const [runningInitialized, setRunningInitialized] = React.useState<boolean | null>(null); // null = not initialized.
    const [initialSyncTrig, _] = React.useState<number>(() => syncTrigger);
    const [initialBpm, setInitialBpm] = React.useState<number | null>(() => bpm);
    const timerIDRef = React.useRef<number | undefined>(undefined);
    const audioContextRef = React.useRef<AudioContext | null>(null);
    const gainNodeRef = React.useRef<GainNode | null>(null);
    const tickBufferRef = React.useRef<AudioBuffer | null>(null);
    const nextFlashTimerIdRef = React.useRef<number | undefined>(undefined);

    // the sample that's scheduled to play next.
    const nextTickSource = React.useRef<AudioBufferSourceNode | null>(null);
    const nextTickBPM = React.useRef<number>(0); // in order to have smooth bpm transitions, keep track of the speed of the previous tick.
    const nextTickScheduledTime = React.useRef<number>(0); // and when is it scheduled, to know when it passed. also used to calculate next beat.

    // when swapping out, we don't want to disconnect it immediately, or we risk chopping off the sample.
    // put it in a place to be disconnected on next tick.
    const tickTrash = React.useRef<AudioBufferSourceNode | null>(null);

    bpm = Clamp(bpm, gMinBPM, gMaxBPM);

    const flash = () => {
        setActiveClass((value) => value === 2 ? 1 : 2);
    };

    const beatsAndBPMToMS = (beats: number, bpm__) => beats * 1000 * 60 / bpm__;
    const beatsToMS = (beats: number) => beatsAndBPMToMS(beats, bpm);//beats * 1000 * 60 / bpm;

    const beatsAndBPMToSec = (beats: number, bpm__) => beats * 60 / bpm__;
    const beatsToSec = (beats: number) => beatsAndBPMToSec(beats, bpm);//beats * 1000 * 60 / bpm;

    const killTimer = () => {
        if (timerIDRef.current) {
            clearTimeout(timerIDRef.current);
            timerIDRef.current = undefined;
        }
    };
    const killSchedule = () => {
        if (nextFlashTimerIdRef.current) {
            clearTimeout(nextFlashTimerIdRef.current);
            nextFlashTimerIdRef.current = undefined;
        }
        if (tickTrash.current) {
            tickTrash.current.stop();
            tickTrash.current.disconnect();
            tickTrash.current = null;
        }
        if (nextTickSource.current) {
            nextTickSource.current.stop();
            nextTickSource.current.disconnect();
            nextTickSource.current = null;
        }
    };

    const scheduleTick = (why: string, t?: number | undefined) => {
        const ctx = audioContextRef.current;
        if (!ctx) return null;
        const tickSource = ctx.createBufferSource();
        tickSource.buffer = tickBufferRef.current;
        tickSource.connect(gainNodeRef.current!);
        tickSource.start(t);
        const currentTime = ctx.currentTime;
        if (nextFlashTimerIdRef.current) {
            clearTimeout(nextFlashTimerIdRef.current);
            nextFlashTimerIdRef.current = undefined;
        }
        if (t === undefined) {
            flash();
        } else {
            let ms = 1000 * (t - currentTime);
            if (ms > 0) {
                ms += 10; // to align better with the sound in CHrome, a small delay. hacky and doubtfully accurate but it feels better than 0 delay.
                nextFlashTimerIdRef.current = window.setTimeout(flash, ms);
            }
        }
        return tickSource;
    };

    // timer proc to ensure there's a next tick scheduled for play.
    // Scheduler function to queue up ticks in the audio context; setInterval is not accurate enough.
    // basically this runs and schedules a tick a short time in the future.
    const tickProc = (forceImmediate?: boolean) => {
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
            nextTickSource.current = scheduleTick("tick:forceImmediate"); // plays immediatly
            nextTickBPM.current = bpm;
            nextTickScheduledTime.current = currentTime;
            // timer set for middle of beat.
            timerIDRef.current = window.setTimeout(tickProc,);
            return;
        }

        if (!nextTickSource.current) {
            nextTickSource.current = scheduleTick("tick:nonext?"); // plays immediatly
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

            nextTickBPM.current = bpm;

            // it could be that we somehow miss a beat, especially during weird turbuent times or changing BPMs. in that case we can choose to skip it or to schedule it.
            if (remainingSec <= 0) {
                nextTickSource.current = scheduleTick("tickProc:missed a beat", undefined); // immediate.
                nextTickScheduledTime.current = currentTime + remainingSec;
                timerIDRef.current = window.setTimeout(tickProc, halfBeatMS);
                return;
            }

            nextTickScheduledTime.current = currentTime + remainingSec;
            nextTickSource.current = scheduleTick("tickProc:normal", currentTime + remainingSec);
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
        killTimer();
        killSchedule();
        if (running) {
            //console.log(`running`);
            tickProc(true);
        }
        else {
            flash();
        }
    };

    const doInit = async () => {
        if (!!audioContextRef.current) return; // double mount?
        audioContextRef.current = new AudioContext();
        gainNodeRef.current = audioContextRef.current.createGain();
        gainNodeRef.current.connect(audioContextRef.current.destination);
        const response = await fetch(gTickSampleFilePath);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
        tickBufferRef.current = audioBuffer;

        doBeatSync();
    };

    const doStop = () => {
        killTimer();

        if (tickTrash.current) {
            tickTrash.current.disconnect();
            tickTrash.current = null;
        }
        if (nextTickSource.current) {
            nextTickSource.current.stop();
            nextTickSource.current.disconnect();
            nextTickSource.current = null;
        }
    };

    React.useEffect(() => {
        void doInit();
        return () => doStop();
    }, []);

    React.useEffect(() => {
        if (syncTrigger > initialSyncTrig) {
            doBeatSync();
        }
    }, [syncTrigger]);

    React.useEffect(() => {
        if (initialBpm === bpm) {
            return;
        }
        setInitialBpm(null); // allow further bpm changes to always work even if === initial

        // run the timer proc ASAP to evaluate what to do.
        killTimer();

        // if not running, do nothing.
        if (running) {
            tickProc(false);
        }
    }, [bpm]);

    React.useEffect(() => {
        if (gainNodeRef.current) {
            gainNodeRef.current.gain.value = mute ? 0 : 1;
        }
    }, [mute, gainNodeRef.current]);

    React.useEffect(() => {
        killTimer();
        if (running && runningInitialized) {
            //console.log(`RUNNING change ${bpm}`);
            tickProc(false);
        }
        if (!runningInitialized) {
            setRunningInitialized(true);
        }
    }, [running]);

    return <div className="metronomePlayerContainer">
        <div className={classes[activeClass]}>
        </div>
    </div>;
};


export const MetronomeButton = ({ bpm, mountPlaying, tapTrigger, isTapping, onSyncClick, variant }: { bpm: number, mountPlaying?: boolean, tapTrigger: number, isTapping: boolean, onSyncClick: () => void, variant: "normal" | "tiny" }) => {
    const [playing, setPlaying] = React.useState<boolean>(mountPlaying || false);
    const dashboardContext = React.useContext(DashboardContext);
    const [beatSyncTrigger, setBeatSyncTrigger] = React.useState<number>(0);
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

    // when tapping,
    // the metronome should behave differently:
    // - ONLY play on sync triggers
    // - ONLY flash.

    return <div className={`metronomeButtonContainer ${variant}`}>
        <div onClick={() => setPlaying(!playing)} className={`freeButton metronomeButton ${playing ? "playing" : "notPlaying"}`}>
            {playing ? (variant === "normal" && gIconMap.VolumeUp()) : bpm}
            {playing && <MetronomePlayer bpm={bpm} syncTrigger={tapTrigger + beatSyncTrigger} mute={isTapping} running={!isTapping} />}
        </div>
        {playing && (variant === "normal") && <div className="metronomeSyncButton freeButton" onClick={(e) => {
            setBeatSyncTrigger(beatSyncTrigger + 1);
            onSyncClick();
            e.stopPropagation();
            e.preventDefault();
        }}>
            Sync
        </div>}


    </div>;
};


// uses IQR filter + linear weighted average
function calculateBPM(tapIntervals): number | null {
    if (tapIntervals.length < 2) {
        return null; // Not enough taps to calculate BPM accurately
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
        return null; // Not enough valid taps after filtering
    }

    // Calculate the simple average of the filtered intervals
    const averageInterval = filteredIntervals.reduce((a, b) => a + b, 0) / filteredIntervals.length;

    // Convert the average interval to BPM
    const bpm = Math.round(60000 / averageInterval);
    return bpm;
}

export interface TapTempoProps {
    onStopTapping: () => void;
    onTap: (newBpm: number | null, tapCount: number) => void;
    killTapTrigger: number;
}


export const TapTempo: React.FC<TapTempoProps> = ({ onTap, onStopTapping, killTapTrigger }) => {
    const [lastTapTime, setLastTapTime] = React.useState<number | null>(null);
    const tapTimes = React.useRef<number[]>([]);
    const [classToggle, setClassToggle] = React.useState<boolean>(false);
    const timerIDRef = React.useRef<number | undefined>(undefined);
    const classes = [
        'tapTempoButton freeButton tick',
        'tapTempoButton freeButton tock',
    ];

    const stopTapping = () => {
        if (timerIDRef.current) {
            clearTimeout(timerIDRef.current);
        }
        tapTimes.current = [];
        setLastTapTime(null);
        onStopTapping();
    };

    const handleTap = () => {
        // if (tapTimes.current.length === 0) {
        //     onFirstClick();
        // }

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
        onTap(calculatedBpm, tapTimes.current.length);

        timerIDRef.current = window.setTimeout(stopTapping, 1400);
    };

    React.useEffect(() => {
        stopTapping();
    }, [killTapTrigger]);

    return (
        <div onClick={handleTap} className={classes[classToggle ? 0 : 1]}>
            {lastTapTime !== null ? tapTimes.current.length : "Tap"}
        </div>
    );
};

export interface MetronomeDialogProps {
    onClose: () => void;
}

type TempoPreset = [bpm: number, caption: string];

export const MetronomeDialog = (props: MetronomeDialogProps) => {
    //const [bpm, setBPM] = useURLState<number>("bpm", 120);
    const [bpm, setBPM] = React.useState<number>(120);
    const [textBpm, setTextBpm] = React.useState<string>(bpm.toString());
    const [tapTrigger, setTapTrigger] = React.useState<number>(0);
    const [killTapTrigger, setKillTapTrigger] = React.useState<number>(0);// trigger to exit tap mode
    const [isTapping, setIsTapping] = React.useState<boolean>(false);

    const handleSync = () => {
        setKillTapTrigger(killTapTrigger + 1);
    };

    //const standardTempos = [80, 90, 100, 120, 140, 160];
    //const standardTempos = [76, 92, 112, 126, 144, 168, 184, 200];
    const standardTempos1: [bpm: number, caption: string][] = [
        [76, 'Andante'],
        [84, 'Moderato'],
        [96, 'Moderato'],
        [104, 'Allegretto'],
        [116, 'Allegro Mod.'],
        [124, 'Allegro'],
        [132, 'Allegro'],
    ];
    const standardTempos2: [bpm: number, caption: string][] = [
        [144, 'Vivace'],
        [152, 'Vivace'],
        [160, 'Presto'],
        [168, 'Presto'],
        [180, 'Presto'],
        [192, 'Prestissimo'],
        [200, 'Prestissimo'],
    ];



    return <ReactiveInputDialog onCancel={props.onClose} className="GlobalMetronomeDialog">
        <DialogContent dividers>
            <MetronomeButton bpm={bpm} mountPlaying={true} isTapping={isTapping} tapTrigger={tapTrigger} onSyncClick={handleSync} variant="normal" />
            <div className="bpmAndTapRow">
                <div className="nudge minus freeButton" onClick={() => {
                    setBPM(bpm - 1);
                    setTextBpm((bpm - 1).toString());
                }}>-</div>
                <div className="nudge plus freeButton" onClick={() => {
                    setBPM(bpm + 1);
                    setTextBpm((bpm + 1).toString());
                }}>+</div>
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
                    killTapTrigger={killTapTrigger}
                    onStopTapping={() => {
                        setIsTapping(false);
                    }}
                    onTap={(newBpm, count) => {
                        setIsTapping(true);
                        setTapTrigger(tapTrigger + 1);
                        if (newBpm !== null) {
                            setBPM(newBpm);
                            setTextBpm(newBpm.toString());
                        }
                    }} />
            </div>
            <div className="sliderContainer">
                {/* <input className="bpmSlider" type="range" min={gMinBPM} max={gMaxBPM} value={bpm} onChange={e => {
                    setBPM(e.target.valueAsNumber);
                    setTextBpm(e.target.value);
                }} /> */}
                <Knob
                    className="bpmSlider"
                    min={gMinBPM}
                    max={gMaxBPM}
                    value={bpm}
                    size={500}
                    lineWidth={85}
                    centerRadius={110}
                    dragBehavior="vertical"
                    onChange={e => {
                        //const valueAsNumber = value as number;
                        setBPM(e);
                        setTextBpm(e.toString());
                    }} />

            </div>
            <div className="buttonRow">
                {standardTempos1.map((t, i) => {
                    const [presetBpm, caption] = t;
                    return <div key={i} className={`preset freeButton ${presetBpm === bpm ? "selected" : ""}`} onClick={() => {
                        setBPM(presetBpm);
                        setTextBpm(String(presetBpm));
                    }}>
                        <div className="title">{presetBpm}</div>
                        <div className="subtitle">{caption}</div>
                    </div>
                })}
            </div>
            <div className="buttonRow">
                {standardTempos2.map((t, i) => {
                    const [presetBpm, caption] = t;
                    return <div key={i} className={`preset freeButton ${presetBpm === bpm ? "selected" : ""}`} onClick={() => {
                        setBPM(presetBpm);
                        setTextBpm(String(presetBpm));
                    }}>
                        <div className="title">{presetBpm}</div>
                        <div className="subtitle">{caption}</div>
                    </div>
                })}
            </div>
            <div className="buttonRow">
                <Button className="closeButton" onClick={props.onClose}>Close</Button>
            </div>
        </DialogContent>

    </ReactiveInputDialog>;
};

export const MetronomeDialogButton = () => {
    // don't use URL state because it's unlikely to actually be used like this, and can cause FF to throw exceptions on rapid changes (ok esp for bpm)
    //const [open, setOpen] = useURLState<boolean>("metronome", false);
    const [open, setOpen] = React.useState<boolean>(false);
    return <>
        <Tooltip title="Open metronome app"><div className="freeButton globalMetronomeButton" onClick={() => setOpen(!open)}>{gIconMap.VolumeDown()}</div></Tooltip>
        {open && <MetronomeDialog onClose={() => setOpen(false)} />}
    </>;
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

//     const rmsInterval = Math.sqrt(weightedSumSquares / totalWeight);

//     // Convert RMS interval to BPM
//     const bpm = Math.round(60000 / rmsInterval);
//     return bpm;
// }







// interface Metronome2Props {
//     bpm: number;
// }

// export const Metronome2: React.FC<Metronome2Props> = ({ bpm }) => {
//     const [isPlaying, setIsPlaying] = React.useState(false);
//     const [flashing, setFlashing] = React.useState(false);
//     const audioContextRef = React.useRef<AudioContext | null>(null);
//     const nextTickTimeRef = React.useRef(0);
//     const timerIDRef = React.useRef<number>();

//     React.useEffect(() => {
//         if (audioContextRef.current === null) {
//             audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
//         }

//         if (isPlaying) {
//             const audioContext = audioContextRef.current!;
//             const secondsPerBeat = 60 / bpm;
//             nextTickTimeRef.current = audioContext.currentTime;
//             scheduler();

//             return () => {
//                 if (timerIDRef.current) {
//                     clearTimeout(timerIDRef.current);
//                 }
//             };
//         }
//     }, [isPlaying, bpm]);

//     const scheduler = () => {
//         const audioContext = audioContextRef.current!;
//         while (nextTickTimeRef.current < audioContext.currentTime + 0.1) {
//             scheduleTick(nextTickTimeRef.current);
//             const secondsPerBeat = 60 / bpm;
//             nextTickTimeRef.current += secondsPerBeat;
//         }
//         timerIDRef.current = window.setTimeout(scheduler, 25);
//     };

//     const scheduleTick = (time: number) => {
//         const audioContext = audioContextRef.current!;

//         // Schedule audible beep
//         const oscillator = audioContext.createOscillator();
//         const gainNode = audioContext.createGain();
//         oscillator.connect(gainNode);
//         gainNode.connect(audioContext.destination);
//         oscillator.frequency.value = 880; // Frequency in Hz (A5 note)
//         gainNode.gain.value = 1; // Volume

//         oscillator.start(time);
//         oscillator.stop(time + 0.05); // Beep duration

//         // Schedule visual flash
//         const flashDelay = (time - audioContext.currentTime) * 1000;
//         setTimeout(() => {
//             setFlashing(true);
//             setTimeout(() => setFlashing(false), 100); // Flash duration
//         }, flashDelay);
//     };

//     const toggleMetronome = () => {
//         setIsPlaying((prev) => !prev);
//     };

//     return (
//         <div style={{ textAlign: 'center' }}>
//             <div
//                 style={{
//                     width: '50px',
//                     height: '50px',
//                     backgroundColor: flashing ? 'red' : 'gray',
//                     borderRadius: '50%',
//                     margin: '20px auto',
//                     transition: 'background-color 0.1s',
//                 }}
//             />
//             <button onClick={toggleMetronome}>{isPlaying ? 'Stop' : 'Start'}</button>
//         </div>
//     );
// };

// export const Metronome2Container = () => {
//     const [bpm, setBPM] = useURLState<number>("bpm", 120);
//     const [textBpm, setTextBpm] = React.useState<string>(bpm.toString());
//     return <><input className="bpmSlider" type="range" min={gMinBPM} max={gMaxBPM} value={bpm} onChange={e => {
//         setBPM(e.target.valueAsNumber);
//         setTextBpm(e.target.value);
//     }} />
//         {textBpm}
//         <Metronome2 bpm={bpm} /></>
// };
