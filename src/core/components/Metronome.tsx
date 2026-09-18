import { Button } from "@mui/base";
import { Add, PlayArrow, Remove } from "@mui/icons-material";
import { Tooltip } from "@mui/material";
import React from "react";
import { Clamp, CoerceToNumberOrNull } from "shared/utils";
import { gIconMap } from "../db3/components/IconMap";
import { CMTextInputBase } from "./CMTextField";
import { Knob } from "./Knob";
import { ReactiveInputDialog } from "./ReactiveInputDialog";
import { useDashboardContext, useFeatureRecorder } from "./dashboardContext/DashboardContext";
import { ActivityFeature } from "./featureReports/activityTracking";
import { MetronomePlayback } from "./metronomePlayback";
import { useLocalStorageState } from "./useLocalStorageState";

const gTickSampleFilePath = "/metronome3.mp3";
const gMinBPM = 40;
const gMaxBPM = 220;

// Master tempo configuration - single source of truth for all tempo-related systems
interface TempoRegion {
    name: string;
    startBPM: number;
    endBPM: number;
    color: string;
    textColor: string;
    //keyTempos: number[];  // Important BPM values within this region
    presetTempos: number[];  // Standard tempo values for this region
}

const TEMPO_REGIONS: TempoRegion[] = [
    {
        name: 'Largo',
        startBPM: gMinBPM,
        endBPM: 66,
        color: '#E8F5E8',
        textColor: '#4A7C59',
        presetTempos: [40, 44, 48, 51, 54, 57, 60, 63, 66]
    },
    {
        name: 'Andante',
        startBPM: 66,
        endBPM: 76,
        color: '#E3F2FD',
        textColor: '#2196F3',
        presetTempos: [69, 72]
    },
    {
        name: 'Moderato',
        startBPM: 76,
        endBPM: 108,
        color: '#F3E5F5',
        textColor: '#9C27B0',
        presetTempos: [76, 80, 84, 88, 92, 96, 100, 104, 108]
    },
    {
        name: 'Allegretto',
        startBPM: 108,
        endBPM: 120,
        color: '#E8F5F5',
        textColor: '#E91E63',
        presetTempos: [112, 116, 120]
    },
    {
        name: 'Allegro',
        startBPM: 120,
        endBPM: 168,
        color: '#FFF3E0',
        textColor: '#FF9800',
        presetTempos: [120, 124, 128, 132, 136, 140, 144, 148, 152, 156, 160, 164, 168]
    },
    {
        name: 'Vivace',
        startBPM: 168,
        endBPM: 200,
        color: '#cFF8E1',
        textColor: '#000',
        presetTempos: [172, 176, 180, 184, 188, 192, 196, 200]
    },
    {
        name: 'Presto',
        startBPM: 200,
        endBPM: gMaxBPM,
        color: '#FFEBEE',
        textColor: '#F44336',
        presetTempos: [200, 204, 208, 212, 216, 220]
    }
];

// Generate unified configurations from master data
const getKnobSegments = () => TEMPO_REGIONS.map((region, index) => ({
    startValue: region.startBPM,
    endValue: region.endBPM,
    color: region.color,
    label: region.name,
    textColor: region.textColor,
    textOpacity: 0.5,
    fontSize: 13,
    fontWeight: 'normal' as const
}));

const getTickMarks = () => {
    const allKeyTempos = TEMPO_REGIONS.flatMap(region => region.presetTempos);
    // Add region boundaries that aren't already in keyTempos
    // const boundaries = TEMPO_REGIONS.slice(1).map(region => region.startBPM)
    //     .filter(bpm => !allKeyTempos.includes(bpm));

    return allKeyTempos
        .sort((a, b) => a - b)
        .map(bpm => ({
            value: bpm,
            label: bpm.toString()
        }));
};

export interface MetronomePlayerProps {
    bpm: number;
    syncTrigger: number;
    mute: boolean;
    running: boolean;
};

// React owns loading and disposal; playback owns beat phase and the two clocks.
export const MetronomePlayer: React.FC<MetronomePlayerProps> = ({ bpm, syncTrigger, mute, running }) => {
    const indicatorRef = React.useRef<HTMLDivElement>(null);
    const playbackRef = React.useRef<MetronomePlayback | null>(null);

    React.useEffect(() => {
        const abort = new AbortController();
        const context = new AudioContext({ latencyHint: "interactive" });
        const playback = new MetronomePlayback(context, pulse => {
            indicatorRef.current?.style.setProperty("--metronome-pulse", pulse.toString());
        });
        playbackRef.current = playback;

        const loadSample = async () => {
            const response = await fetch(gTickSampleFilePath, { signal: abort.signal });
            if (!response.ok) throw new Error(`Metronome sample request failed: ${response.status}`);
            const bytes = await response.arrayBuffer();
            if (abort.signal.aborted) return;
            const buffer = await context.decodeAudioData(bytes);
            if (abort.signal.aborted) return;
            playback.setBuffer(buffer);
        };
        void loadSample().catch(error => {
            if (!abort.signal.aborted) console.error("Unable to load metronome audio", error);
        });

        return () => {
            abort.abort();
            playback.dispose();
            playbackRef.current = null;
        };
    }, []);

    React.useEffect(() => {
        playbackRef.current?.update({ bpm: Clamp(bpm, gMinBPM, gMaxBPM), syncTrigger, mute, running });
    }, [bpm, syncTrigger, mute, running]);

    return <div className="metronomePlayerContainer" aria-hidden="true">
        <div ref={indicatorRef} className="metronomeIndicator" />
    </div>;
};


export const MetronomeButton = React.forwardRef<
    {
        isPlaying: boolean;
        togglePlaying: () => void;
        handleSync: () => void;
    },
    {
        bpm: number;
        mountPlaying?: boolean;
        tapTrigger: number;
        isTapping: boolean;
        onSyncClick: () => void;
        variant: "normal" | "tiny";
    }
>(({ bpm, mountPlaying, tapTrigger, isTapping, onSyncClick, variant }, ref) => {
    const [playing, setPlaying] = React.useState<boolean>(mountPlaying || false);
    const dashboardContext = useDashboardContext();
    const recordFeature = useFeatureRecorder();
    const [beatSyncTrigger, setBeatSyncTrigger] = React.useState<number>(0);
    const mySilencer = React.useRef<() => void>(() => setPlaying(false));

    const togglePlaying = () => setPlaying(!playing);
    const handleSync = React.useCallback(() => {
        setBeatSyncTrigger(beatSyncTrigger + 1);
        onSyncClick();
    }, [beatSyncTrigger, onSyncClick]);

    // Expose control functions through ref
    React.useImperativeHandle(ref, () => ({
        isPlaying: playing,
        togglePlaying,
        handleSync
    }), [playing]);

    // Handle sync keyboard shortcut when component is active
    React.useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Don't handle shortcuts if focus is on an input element
            if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
                return;
            }

            if ((event.key === 's' || event.key === 'S') && playing) {
                event.preventDefault();
                handleSync();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [playing, handleSync]);

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

    // if you are playing the metronome for > 1 minute, record the activity.
    React.useEffect(() => {
        if (playing) {
            const timer = window.setTimeout(() => {
                void recordFeature({
                    feature: ActivityFeature.metronome_persistent,
                });
            }, 60 * 1000); // 1 minute
            return () => {
                clearTimeout(timer);
            };
        }
    }, [playing]);

    // when tapping,
    // the metronome should behave differently:
    // - ONLY play on sync triggers
    // - ONLY flash.

    return <div className={`metronomeButtonContainer ${variant}`}>
        <div onClick={togglePlaying} className={`freeButton metronomeButton ${playing ? "playing" : "notPlaying"} ${variant}`}>

            {variant === "normal" && <span className="metronomeTransportLabel">{playing ? <></> : <PlayArrow />}</span>}

            {!playing && (variant === "tiny") && <span className="bpmText">{bpm}</span>}

            {/* Tap Tempo Button */}
            {playing && <MetronomePlayer bpm={bpm} syncTrigger={tapTrigger + beatSyncTrigger} mute={isTapping} running={!isTapping} />}
        </div>
        {playing && (variant === "normal") && <div className="metronomeSyncButton freeButton" onClick={(e) => {
            handleSync();
            e.stopPropagation();
            e.preventDefault();
        }}>
            Sync
        </div>}


    </div>;
});


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

export const TapTempo = React.forwardRef<
    { handleTap: () => void },
    TapTempoProps
>(({ onTap, onStopTapping, killTapTrigger }, ref) => {
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
            const interval = currentTime - lastTapTime;
            tapTimes.current.push(interval);
        }

        setLastTapTime(currentTime);

        const calculatedBpm = calculateBPM(tapTimes.current);
        onTap(calculatedBpm, tapTimes.current.length);

        timerIDRef.current = window.setTimeout(stopTapping, 1400);
    };

    // Expose control functions through ref
    React.useImperativeHandle(ref, () => ({
        handleTap
    }), []);

    // Handle keyboard shortcuts specific to tap tempo
    React.useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if ((event.key === 't' || event.key === 'T') &&
                !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) {
                event.preventDefault();
                handleTap();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleTap]); // Add handleTap to dependencies so it updates when the function changes

    React.useEffect(() => {
        stopTapping();
    }, [killTapTrigger]);

    return (
        <div onClick={handleTap} className={classes[classToggle ? 0 : 1]}>
            {lastTapTime !== null ? tapTimes.current.length : "Tap"}
        </div>
    );
});

export interface MetronomeDialogProps {
    onClose: () => void;
}

interface MetronomePanelProps {
    onClose?: () => void;
}

export const MetronomePanel: React.FC<MetronomePanelProps> = ({ onClose }) => {
    //const [bpm, setBPM] = useURLState<number>("bpm", 120);
    const [bpm, setBPM] = useLocalStorageState<number>({
        key: "metronomeBPM",
        initialValue: 120,
    });
    const [textBpm, setTextBpm] = React.useState<string>(bpm.toString());
    const [tapTrigger, setTapTrigger] = React.useState<number>(0);
    const [killTapTrigger, setKillTapTrigger] = React.useState<number>(0);// trigger to exit tap mode
    const [isTapping, setIsTapping] = React.useState<boolean>(false);

    // Refs for accessing component functions
    const metronomeButtonRef = React.useRef<{
        isPlaying: boolean;
        togglePlaying: () => void;
        handleSync: () => void;
    }>(null);
    const tapTempoRef = React.useRef<{ handleTap: () => void }>(null);

    const handleSync = () => {
        setKillTapTrigger(killTapTrigger + 1);
    };

    const changeBPM = (delta: number) => {
        const newBPM = Clamp(bpm + delta, gMinBPM, gMaxBPM);
        setBPM(newBPM);
        setTextBpm(newBPM.toString());
    };

    // Keyboard shortcuts
    React.useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Don't handle shortcuts if focus is on an input element
            if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
                return;
            }

            switch (event.key) {
                case ' ': // Space - Play/Stop
                    event.preventDefault();
                    if (metronomeButtonRef.current?.togglePlaying) {
                        metronomeButtonRef.current.togglePlaying();
                    }
                    break;

                case 'ArrowUp': // Increase BPM
                    event.preventDefault();
                    changeBPM(event.shiftKey ? 5 : 1);
                    break;

                case 'ArrowDown': // Decrease BPM
                    event.preventDefault();
                    changeBPM(event.shiftKey ? -5 : -1);
                    break;



                // case 'Escape': // Close dialog
                //     event.preventDefault();
                //     props.onClose();
                //     break;

                default:
                    break;
            }
        };

        const handleWheel = (event: WheelEvent) => {
            // Document-level wheel events can target non-elements, including in Firefox DevTools.
            const target = event.target;
            if (!(target instanceof Element)) return;

            // Only handle wheel events originating inside the metronome panel.
            const dialogElement = target.closest('.GlobalMetronomeDialog');
            if (!dialogElement) return;

            event.preventDefault();            // Determine scroll direction
            const isScrollingUp = event.deltaY < 0;

            if (event.shiftKey) {
                // Fine control: ±1 BPM increment
                const delta = isScrollingUp ? 1 : -1;
                changeBPM(delta);
            } else {
                // Normal behavior: Jump to previous/next tick value
                const tickValues = tickMarks.map(tick => tick.value).sort((a, b) => a - b);

                if (isScrollingUp) {
                    // Find next higher tick value
                    const nextTick = tickValues.find(tickValue => tickValue > bpm);
                    if (nextTick) {
                        setBPM(nextTick);
                        setTextBpm(nextTick.toString());
                    }
                } else {
                    // Find previous lower tick value
                    const prevTick = tickValues.reverse().find(tickValue => tickValue < bpm);
                    if (prevTick) {
                        setBPM(prevTick);
                        setTextBpm(prevTick.toString());
                    }
                }
            }
        };

        // Add event listeners
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('wheel', handleWheel, { passive: false });

        // Cleanup
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('wheel', handleWheel);
        };
    }, [bpm, onClose]);

    // Get unified tempo configurations
    const knobSegments = getKnobSegments();
    const tickMarks = getTickMarks();
    //const presetTempos = getPresetTempos();



    return (
        <div className="GlobalMetronomeDialog">
            {/* <DialogContent dividers> */}
            <MetronomeButton
                ref={metronomeButtonRef}
                bpm={bpm}
                mountPlaying={false}
                isTapping={isTapping}
                tapTrigger={tapTrigger}
                onSyncClick={handleSync}
                variant="normal"
            />
            <div className="bpmAndTapRow">
                <div className="nudge minus freeButton" onClick={() => {
                    setBPM(bpm - 1);
                    setTextBpm((bpm - 1).toString());
                }}><Remove /></div>
                <div className="nudge plus freeButton" onClick={() => {
                    setBPM(bpm + 1);
                    setTextBpm((bpm + 1).toString());
                }}><Add /></div>
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
                    ref={tapTempoRef}
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
                {onClose && <Button className="closeButton freeButton" onClick={onClose}>{gIconMap.Close()}</Button>}
            </div>
            <div className="sliderContainer">
                <Knob
                    className="bpmSlider"
                    min={gMinBPM}
                    max={gMaxBPM}
                    value={bpm}
                    size={500}
                    centerRadius={110}
                    dragBehavior="vertical"
                    // Main value arc configuration (radius-based)
                    valueArcInnerRadius={130}  // centerRadius + 20 (gap from center)
                    valueArcOuterRadius={185}  // valueArcInnerRadius + 55 (old lineWidth)
                    // Segment arc configuration (radius-based)
                    segmentArcInnerRadius={193}  // valueArcOuterRadius + 8
                    segmentArcOuterRadius={218}  // segmentArcInnerRadius + 25 (old segmentArcWidth)
                    segmentTextRadius={205}      // middle of segment arc (segmentArcInnerRadius + segmentArcOuterRadius) / 2 - 10
                    // Needle configuration (radius-based)
                    needleStartRadius={70}
                    needleEndRadius={223}        // point to middle of value arc
                    needleColor="#888"
                    needleWidth={3}
                    // Tick mark configuration (radius-based)
                    tickStartRadius={224}        // segmentArcOuterRadius + 6
                    tickEndRadius={235}          // tickStartRadius + 11
                    tickLabelRadius={246}        // tickEndRadius + 8 (old tickLabelOffset)
                    tickColor="#999"
                    tickFontSize={12}
                    tickMarks={tickMarks}
                    segments={knobSegments}
                    // Interactive tick labels
                    useInteractiveTickLabels={true}
                    onTickLabelClick={(value) => {
                        setBPM(value);
                        setTextBpm(value.toString());
                    }}
                    // Snap-to-tick behavior for precise BPM selection
                    snapToTick={true}
                    snapDragToTick={true}
                    onChange={e => {
                        setBPM(e);
                        setTextBpm(e.toString());
                    }} />

            </div>
            <div className="keyboardShortcutsHelp" style={{
                fontSize: '11px',
                color: '#999',
                marginTop: '10px',
                textAlign: 'center',
                lineHeight: '1.3'
            }}>
                <div>
                    <strong>Space</strong>: Play/Stop • <strong>↑/↓</strong>: BPM ±1 • <strong>Shift+↑/↓</strong>: BPM ±5 • <strong>Mouse Wheel</strong>: Jump to tick • <strong>Shift+Wheel</strong>: BPM ±1 • <strong>Shift+Drag</strong>: Fine control • <strong>T</strong>: Tap • <strong>S</strong>: Sync
                </div>
            </div>
            {/* </DialogContent> */}
        </div>
    );
};

export const MetronomeDialog = (props: MetronomeDialogProps) => {
    return (
        <ReactiveInputDialog onCancel={props.onClose} className="GlobalMetronomeDialog">
            <MetronomePanel onClose={props.onClose} />
        </ReactiveInputDialog>
    );
};

export const MetronomeDialogButton = () => {
    // don't use URL state because it's unlikely to actually be used like this, and can cause FF to throw exceptions on rapid changes (ok esp for bpm)
    //const [open, setOpen] = useURLState<boolean>("metronome", false);
    const [open, setOpen] = React.useState<boolean>(false);
    return <>
        <Tooltip title="Open the metronome">
            <div
                className="freeButton globalMetronomeButton"
                onClick={() => setOpen(!open)}
            >
                {gIconMap.VolumeDown()}
            </div>
        </Tooltip>
        {open && <MetronomeDialog onClose={() => setOpen(false)} />}
    </>;
};





