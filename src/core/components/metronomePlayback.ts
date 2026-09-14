const schedulerIntervalMS = 25;
const scheduleAheadSeconds = 0.1;
const pulseHoldSeconds = 0.06;
const pulseFadeSeconds = 0.06;

/** Integrates tempo over audio time. Changing BPM preserves the current beat fraction. */
export class MetronomeBeatClock {
    private anchorBeat = 0;

    constructor(private bpm: number, private anchorTime: number) { }

    beatAt(time: number): number {
        return this.anchorBeat + (time - this.anchorTime) * this.bpm / 60;
    }

    timeOfBeat(beat: number): number {
        return this.anchorTime + (beat - this.anchorBeat) * 60 / this.bpm;
    }

    setTempo(bpm: number, time: number): void {
        this.anchorBeat = this.beatAt(time);
        this.anchorTime = time;
        this.bpm = bpm;
    }
}

type OutputClock = Pick<AudioContext, "currentTime" | "state"> & {
    getOutputTimestamp?: () => AudioTimestamp;
    baseLatency?: number;
    outputLatency?: number;
};

/** Audio time at the output device, rather than the rendering graph's ahead-of-output time. */
export function getMetronomeOutputTime(context: OutputClock, performanceTime: number): number | null {
    if (context.state !== "running") return null;

    const timestamp = context.getOutputTimestamp?.();
    if (timestamp && Number.isFinite(timestamp.contextTime) && Number.isFinite(timestamp.performanceTime)
        && timestamp.performanceTime! > 0) {
        // https://www.w3.org/TR/webaudio/#dom-audiocontext-getoutputtimestamp
        return Math.min(context.currentTime, timestamp.contextTime! + (performanceTime - timestamp.performanceTime!) / 1000);
    }

    // Older browsers and contexts which have not produced an output timestamp yet.
    return context.currentTime - (context.baseLatency || 0) - (context.outputLatency || 0);
}

export function metronomePulseAtAge(ageSeconds: number): number {
    if (ageSeconds < 0) return 0;
    return Math.max(0, Math.min(1, 1 - (ageSeconds - pulseHoldSeconds) / pulseFadeSeconds));
}

export interface MetronomePlaybackState {
    bpm: number;
    syncTrigger: number;
    mute: boolean;
    running: boolean;
}

interface ScheduledTick {
    time: number;
    source: AudioBufferSourceNode;
}

/** Owns one player's audio context, sources, scheduler, and output-synchronized indicator. */
export class MetronomePlayback {
    private readonly gain: GainNode;
    private buffer: AudioBuffer | null = null;
    private state: MetronomePlaybackState | null = null;
    private clock: MetronomeBeatClock | null = null;
    private nextBeat = 0;
    private ticks: ScheduledTick[] = [];
    private readonly sources = new Set<AudioBufferSourceNode>();
    private timer: number | undefined;
    private animationFrame: number | undefined;
    private lastTapTime: number | null = null;
    private disposed = false;

    constructor(private readonly context: AudioContext, private readonly drawPulse: (pulse: number) => void) {
        this.gain = context.createGain();
        this.gain.connect(context.destination);
        this.animationFrame = window.requestAnimationFrame(this.draw);
    }

    setBuffer(buffer: AudioBuffer): void {
        if (this.disposed) return;
        this.buffer = buffer;
        // Loading may have taken several renders; start with the latest committed controls.
        if (this.state?.running) this.start();
    }

    update(state: MetronomePlaybackState): void {
        if (this.disposed) return;
        const previous = this.state;
        this.state = state;
        this.gain.gain.value = state.mute ? 0 : 1;
        const synced = previous !== null && state.syncTrigger !== previous.syncTrigger;

        if (!state.running) {
            this.stop();
            if (synced) this.lastTapTime = performance.now();
            return;
        }
        this.lastTapTime = null;
        if (!this.buffer) return;

        if (!previous?.running || synced) {
            this.start();
        } else if (state.bpm !== previous.bpm && this.clock) {
            const now = this.context.currentTime;
            this.clock.setTempo(state.bpm, now);
            // Rendered clicks (including audio still travelling to the output) keep their visuals.
            // Future clicks must move to the new tempo, even when already inside the lookahead.
            this.ticks = this.ticks.filter(tick => {
                if (tick.time <= now) return true;
                this.releaseSource(tick.source, true);
                return false;
            });
            this.nextBeat = Math.floor(this.clock.beatAt(now) + 1e-9) + 1;
            this.schedule();
        }
    }

    private start(): void {
        this.stop();
        const now = this.context.currentTime;
        this.clock = new MetronomeBeatClock(this.state!.bpm, now);
        this.scheduleTick(now);
        this.nextBeat = 1;
        void this.context.resume().catch(error => console.warn("Unable to resume metronome audio", error));
        this.schedule();
    }

    private scheduleTick(time: number): void {
        const source = this.context.createBufferSource();
        source.buffer = this.buffer;
        source.connect(this.gain);
        this.sources.add(source);
        source.onended = () => this.releaseSource(source, false);
        source.start(time);
        this.ticks.push({ time, source });
    }

    private releaseSource(source: AudioBufferSourceNode, stop: boolean): void {
        if (!this.sources.delete(source)) return;
        source.onended = null;
        if (stop) source.stop();
        source.disconnect();
    }

    private schedule = (): void => {
        if (this.timer !== undefined) window.clearTimeout(this.timer);
        if (this.disposed || !this.clock) return;
        const now = this.context.currentTime;
        this.pruneAudibleTicks(getMetronomeOutputTime(this.context, performance.now()));
        if (this.context.state === "running") {
            // A stalled callback must skip expired beats, preserving phase without a catch-up burst.
            this.nextBeat = Math.max(this.nextBeat, Math.ceil(this.clock.beatAt(now) - 1e-9));
            let time = this.clock.timeOfBeat(this.nextBeat);
            while (time <= now + scheduleAheadSeconds) {
                this.scheduleTick(Math.max(now, time));
                this.nextBeat++;
                time = this.clock.timeOfBeat(this.nextBeat);
            }
        }
        this.timer = window.setTimeout(this.schedule, schedulerIntervalMS);
    };

    private pruneAudibleTicks(outputTime: number | null): void {
        if (outputTime === null) return;
        // Also called by the scheduler, keeping history bounded when a hidden tab stops painting.
        while (this.ticks.length > 1 && this.ticks[1]!.time <= outputTime) this.ticks.shift();
    }

    private draw = (): void => {
        if (this.disposed) return;
        const now = performance.now();
        const outputTime = getMetronomeOutputTime(this.context, now);
        let pulse = 0;
        if (this.lastTapTime !== null) {
            pulse = metronomePulseAtAge((now - this.lastTapTime) / 1000);
        } else if (outputTime !== null) {
            // Keep the last audible click plus any future clicks. A late frame shows the current
            // envelope instead of restarting an animation for a beat that has already passed.
            this.pruneAudibleTicks(outputTime);
            const tick = this.ticks[0];
            if (tick) pulse = metronomePulseAtAge(outputTime - tick.time);
        }
        this.drawPulse(pulse);
        this.animationFrame = window.requestAnimationFrame(this.draw);
    };

    private stop(): void {
        if (this.timer !== undefined) window.clearTimeout(this.timer);
        this.timer = undefined;
        this.clock = null;
        this.sources.forEach(source => this.releaseSource(source, true));
        this.ticks = [];
        this.drawPulse(0);
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.stop();
        if (this.animationFrame !== undefined) window.cancelAnimationFrame(this.animationFrame);
        this.gain.disconnect();
        void this.context.close().catch(error => console.warn("Unable to close metronome audio", error));
    }
}
