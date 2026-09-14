// @vitest-environment jsdom
import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMetronomeOutputTime, MetronomeBeatClock, MetronomePlayback } from "src/core/components/metronomePlayback";

vi.mock("src/core/components/CMTextField", () => ({ CMTextInputBase: () => null }));
vi.mock("src/core/components/Knob", () => ({ Knob: () => null }));
vi.mock("src/core/components/ReactiveInputDialog", () => ({ ReactiveInputDialog: () => null }));
vi.mock("src/core/db3/components/IconMap", () => ({ gIconMap: {} }));
vi.mock("src/core/components/featureReports/activityTracking", () => ({ ActivityFeature: {} }));
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({ useDashboardContext: () => ({}), useFeatureRecorder: () => () => {} }));
import { MetronomePlayer } from "src/core/components/Metronome";

class TestSource {
    buffer: unknown = null;
    time = -1;
    stopTime: number | null = null;
    onended: (() => void) | null = null;
    connect = vi.fn();
    disconnect = vi.fn();
    start = (time = 0) => { this.time = Math.max(time, Date.now() / 1000); };
    stop = vi.fn(() => { this.stopTime = Date.now() / 1000; });
}

class TestAudioContext {
    static instances: TestAudioContext[] = [];
    state: AudioContextState = "running";
    get currentTime() { return Date.now() / 1000; }
    destination = {};
    baseLatency = 0;
    outputLatency = 0;
    sources: TestSource[] = [];
    gain = { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() };
    constructor() { TestAudioContext.instances.push(this); }
    createGain = () => this.gain;
    createBufferSource = () => {
        const source = new TestSource();
        this.sources.push(source);
        return source;
    };
    getOutputTimestamp = () => ({ contextTime: this.currentTime - this.outputLatency, performanceTime: performance.now() });
    decodeAudioData = vi.fn(async () => sample);
    resume = vi.fn(async () => {});
    close = vi.fn(async () => { this.state = "closed"; });
}

const sample = {} as AudioBuffer;
const response = { ok: true, arrayBuffer: async () => new ArrayBuffer(1) };
const originalGlobals = ["AudioContext", "fetch", "requestAnimationFrame", "cancelAnimationFrame", "IS_REACT_ACT_ENVIRONMENT"]
    .map(key => ({ key, descriptor: Object.getOwnPropertyDescriptor(globalThis, key) }));
let root: Root | null;
let playback: MetronomePlayback | null;
let frames: Map<number, FrameRequestCallback>;
let frameID: number;

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    vi.spyOn(performance, "now").mockImplementation(() => Date.now());
    TestAudioContext.instances = [];
    frames = new Map(); frameID = 0;
    playback = null; root = null;
    vi.stubGlobal("AudioContext", TestAudioContext);
    vi.stubGlobal("fetch", vi.fn(async () => response));
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++frameID, callback); return frameID; });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
});

afterEach(async () => {
    if (root) await act(async () => root!.unmount());
    playback?.dispose();
    vi.clearAllTimers();
    vi.useRealTimers();
    for (const { key, descriptor } of originalGlobals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
    }
    document.body.replaceChildren();
});

const renderFrame = () => {
    const callbacks = Array.from(frames.values());
    frames.clear();
    callbacks.forEach(callback => callback(performance.now()));
};
const controls = (bpm = 120) => ({ bpm, running: true, mute: false, syncTrigger: 0 });
const start = (bpm = 120) => {
    const context = new TestAudioContext();
    const draw = vi.fn();
    playback = new MetronomePlayback(context as unknown as AudioContext, draw);
    playback.update(controls(bpm));
    playback.setBuffer(sample);
    return { context, draw };
};
const audibleTimes = (context: TestAudioContext) => context.sources
    .filter(source => source.stopTime === null || source.time < source.stopTime).map(source => source.time);

describe("continuous metronome tempo", () => {
    it("carries 90% progress into a slower tempo", () => {
        const clock = new MetronomeBeatClock(120, 0);
        clock.setTempo(60, 0.45);
        expect(clock.beatAt(0.45)).toBeCloseTo(0.9, 12);
        expect(clock.timeOfBeat(1)).toBeCloseTo(0.55, 12);
    });

    it("integrates multiple tempo changes within one beat", () => {
        const clock = new MetronomeBeatClock(120, 0);
        clock.setTempo(60, 0.2); // 40% of a beat elapsed.
        clock.setTempo(180, 0.4); // Another 20% elapsed at 60 BPM.
        expect(clock.beatAt(0.4)).toBeCloseTo(0.6, 12);
        expect(clock.timeOfBeat(1)).toBeCloseTo(0.4 + 0.4 / 3, 12);
    });

    it.each([40, 120, 220])("keeps %s BPM aligned for ten minutes", bpm => {
        const { context } = start(bpm);
        vi.advanceTimersByTime(600000);
        expect(context.sources.length).toBe(bpm * 10 + 1);
        context.sources.forEach((source, i) => expect(source.time).toBeCloseTo(i * 60 / bpm, 9));
    });

    it.each([[60, 0.55], [220, 0.45 + 0.1 * 60 / 220]])("reschedules an already queued click when changing to %s BPM at 90%%", (bpm, expectedTime) => {
        const { context } = start();
        vi.advanceTimersByTime(450);
        const oldClick = context.sources.find(source => source.time === 0.5)!;
        expect(oldClick).toBeDefined();
        playback!.update(controls(bpm));
        expect(oldClick.stop).toHaveBeenCalledOnce();
        expect(audibleTimes(context)[1]).toBeCloseTo(expectedTime, 12);
        expect(context.sources[0]!.stop).not.toHaveBeenCalled();
    });

    it("keeps one next click under repeated wheel adjustments", () => {
        const { context } = start();
        vi.advanceTimersByTime(450);
        playback!.update(controls(100));
        vi.advanceTimersByTime(10);
        playback!.update(controls(80));
        vi.advanceTimersByTime(10);
        playback!.update(controls(60));
        // Progress: .9 + .01 * 100/60 + .01 * 80/60 = .93 beat.
        expect(audibleTimes(context)).toHaveLength(2);
        expect(audibleTimes(context)[1]).toBeCloseTo(0.54, 12);
    });

    it("does not duplicate a click when tempo changes exactly on a beat", () => {
        const { context } = start();
        vi.advanceTimersByTime(500);
        playback!.update(controls(60));
        vi.advanceTimersByTime(1000);
        expect(audibleTimes(context)).toEqual([0, 0.5, 1.5]);
    });

    it("skips expired beats after a stall instead of producing catch-up clicks", () => {
        const { context } = start();
        vi.setSystemTime(2000);
        vi.advanceTimersByTime(1000);
        expect(audibleTimes(context)).toEqual([0, 2.5, 3]);
    });
});

describe("metronome output synchronization", () => {
    it("maps the output timestamp to performance time without adding latency twice", () => {
        expect(getMetronomeOutputTime({
            currentTime: 10, state: "running", baseLatency: 0.01, outputLatency: 0.2,
            getOutputTimestamp: () => ({ contextTime: 9.7, performanceTime: 1000 }),
        }, 1050)).toBeCloseTo(9.75, 12);
    });

    it.each([undefined, () => ({ contextTime: 0, performanceTime: 0 })])("uses reported latency when an output timestamp is unavailable", getOutputTimestamp => {
        expect(getMetronomeOutputTime({ currentTime: 10, state: "running", baseLatency: 0.01, outputLatency: 0.2, getOutputTimestamp }, 1050)).toBeCloseTo(9.79, 12);
    });

    it("does not extrapolate a suspended output clock", () => {
        expect(getMetronomeOutputTime({ currentTime: 1, state: "suspended" }, 5000)).toBeNull();
    });

    it("keeps a finished source's flash until that sound reaches the output", () => {
        const { context, draw } = start();
        context.outputLatency = 0.15;
        vi.advanceTimersByTime(40);
        context.sources[0]!.onended!();
        vi.advanceTimersByTime(60); renderFrame();
        expect(draw).toHaveBeenLastCalledWith(0);
        vi.advanceTimersByTime(65); renderFrame();
        expect(draw).toHaveBeenLastCalledWith(1);
        vi.advanceTimersByTime(120); renderFrame();
        expect(draw).toHaveBeenLastCalledWith(0);
    });

    it("moves the visual along with a rescheduled audio click", () => {
        const { draw } = start();
        vi.advanceTimersByTime(450);
        playback!.update(controls(60));
        vi.advanceTimersByTime(50); renderFrame();
        expect(draw).toHaveBeenLastCalledWith(0);
        vi.advanceTimersByTime(50); renderFrame();
        expect(draw).toHaveBeenLastCalledWith(1);
    });

    it("shows an aged envelope after a late frame rather than a fresh flash", () => {
        const { draw } = start();
        vi.advanceTimersByTime(90); renderFrame();
        expect(draw.mock.calls[draw.mock.calls.length - 1]![0]).toBeCloseTo(0.5, 12);
        vi.advanceTimersByTime(150); renderFrame();
        expect(draw).toHaveBeenLastCalledWith(0);
    });

    it("flashes immediately for silent taps and resumes with one fresh beat", () => {
        const { context, draw } = start();
        vi.advanceTimersByTime(450);
        playback!.update({ ...controls(), running: false, mute: true, syncTrigger: 1 });
        renderFrame(); expect(draw).toHaveBeenLastCalledWith(1);
        expect(context.gain.gain.value).toBe(0);
        expect(context.sources[1]!.stop).toHaveBeenCalledOnce();
        vi.advanceTimersByTime(1400);
        playback!.update({ ...controls(), syncTrigger: 1 });
        expect(audibleTimes(context)).toEqual([0, 1.85]);
    });
});

describe("metronome loading lifecycle", () => {
    const render = async (bpm = 120, running = true, strict = false) => {
        if (!root) {
            const element = document.createElement("div"); document.body.append(element);
            root = createRoot(element);
        }
        const player = React.createElement(MetronomePlayer, { ...controls(bpm), running });
        await act(async () => root!.render(strict ? React.createElement(React.StrictMode, null, player) : player));
    };
    const settle = async () => { await act(async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); }); };

    it.each(["fetch", "decode"])("stopping during %s cancels all later playback and releases resources", async stage => {
        let resolve!: (value: any) => void;
        if (stage === "fetch") vi.stubGlobal("fetch", vi.fn(() => new Promise(r => { resolve = r; })));
        else vi.stubGlobal("fetch", vi.fn(async () => {
            TestAudioContext.instances[0]!.decodeAudioData.mockImplementation(() => new Promise<AudioBuffer>(r => { resolve = r; }));
            return response;
        }));
        await render();
        await act(async () => root!.unmount()); root = null;
        resolve(stage === "fetch" ? response : sample); await settle();
        const context = TestAudioContext.instances[0]!;
        expect(context.sources).toHaveLength(0);
        expect(context.close).toHaveBeenCalledOnce();
        expect(context.gain.disconnect).toHaveBeenCalledOnce();
        expect(frames.size).toBe(0);
        expect(vi.getTimerCount()).toBe(0);
    });

    it("uses the latest tempo when loading finishes", async () => {
        let resolve!: (value: any) => void;
        vi.stubGlobal("fetch", vi.fn(() => new Promise(r => { resolve = r; })));
        await render(120); await render(180);
        resolve(response); await settle();
        vi.advanceTimersByTime(350);
        expect(TestAudioContext.instances[0]!.sources[1]!.time).toBeCloseTo(1 / 3, 12);
    });

    it("honors a transition to tapping while loading", async () => {
        let resolve!: (value: any) => void;
        vi.stubGlobal("fetch", vi.fn(() => new Promise(r => { resolve = r; })));
        await render(); await render(100, false);
        resolve(response); await settle();
        expect(TestAudioContext.instances[0]!.sources).toHaveLength(0);
        await render(100, true);
        expect(TestAudioContext.instances[0]!.sources).toHaveLength(1);
    });

    it("keeps only the current player alive through Strict Mode setup and cleanup", async () => {
        await render(120, true, true);
        expect(TestAudioContext.instances).toHaveLength(2);
        expect(TestAudioContext.instances[0]!.state).toBe("closed");
        expect(TestAudioContext.instances[0]!.sources).toHaveLength(0);
        expect(TestAudioContext.instances[1]!.sources).toHaveLength(1);
        expect(frames.size).toBe(1);
    });
});
