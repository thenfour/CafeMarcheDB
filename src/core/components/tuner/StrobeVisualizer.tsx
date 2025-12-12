import React from "react";

export type StrobeVisualizerProps = {
    centsOffset: number | null; // cents relative to nearest pitch, -50..+50 typical
    isActive: boolean; // whether pitch is trusted; false -> muted/idle motion
};

type RingDefinition = {
    sizePercent: number; // diameter relative to container
    segments: number;
    direction: 1 | -1;
    speedScale: number;
};

const MAX_DETUNE_CENTS = 50;

// Visual tuning
const MAX_ROTATION_SPEED_DEG_PER_SEC = 240;
const IDLE_ROTATION_SPEED_DEG_PER_SEC = 0; // gentle drift when untrusted
const DEAD_BAND_CENTS = 0.1; // freeze when very close to in-tune
//const SPEED_CURVE = ; // tanh curve strength

const SEGMENT_FILL_RATIO = .5;

// Slightly de-correlate the rings so they don't just "brightness-mix"
// const RING_DEFINITIONS: RingDefinition[] = [
//     { sizePercent: 100, segments: 16, direction: 1, speedScale: 1.0 },
//     { sizePercent: 90, segments: 16, direction: -1, speedScale: 0.618 },
//     { sizePercent: 80, segments: 16, direction: 1, speedScale: 1.2 },
// ];

const ringSize = 20;

const RING_DEFINITIONS: RingDefinition[] = [
    { sizePercent: 100, segments: 32, direction: 1, speedScale: 1 },
    { sizePercent: 100 - ringSize, segments: 16, direction: -1, speedScale: 1 },
    { sizePercent: 100 - ringSize * 2, segments: 8, direction: 1, speedScale: 1.85 },
    { sizePercent: 100 - ringSize * 3, segments: 4, direction: -1, speedScale: 2.85 },
];


//const INNER_DISC_SIZE_PERCENT = 80;

const PRIMARY_STROBE_COLOR = "#444"; // MUI primary tone
//const MUTED_STROBE_COLOR = "#080";
const GAP_COLOR = "#ccc";
//const BACKDROP_COLOR = "rgba(0, 0, 0, 0.03)";
const INNER_DISC_COLOR = "#fff";

function clampDetuneCents(detuneCents: number | null): number | null {
    if (detuneCents === null) return null;
    return Math.max(-MAX_DETUNE_CENTS, Math.min(MAX_DETUNE_CENTS, detuneCents));
}

function normalizeRotation(rotationDeg: number): number {
    const wrapped = rotationDeg % 360;
    return wrapped < 0 ? wrapped + 360 : wrapped;
}

function buildSegmentGradient(fillColor: string, segmentCount: number): string {
    const segmentSpanDeg = 360 / segmentCount;
    const litSpanDeg = segmentSpanDeg * SEGMENT_FILL_RATIO;
    const gapSpanDeg = segmentSpanDeg - litSpanDeg;
    return `repeating-conic-gradient(${fillColor} 0deg ${litSpanDeg}deg, ${GAP_COLOR} ${litSpanDeg}deg ${litSpanDeg + gapSpanDeg
        }deg)`;
}

// function prefersReducedMotion(): boolean {
//     if (typeof window === "undefined" || !window.matchMedia) return false;
//     return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// }

function computeNormalizedDetune(detuneCents: number | null): number {
    if (detuneCents == null) return 0;
    const c = clampDetuneCents(detuneCents) ?? 0;
    const abs = Math.abs(c);
    if (abs < DEAD_BAND_CENTS) return 0;
    return c / MAX_DETUNE_CENTS; // -1..1
}

// Smooth, stable mapping: deadband + tanh curve
function detuneToSpeed(
    detuneCents: number | null,
    direction: 1 | -1,
    speedScale: number,
    isActive: boolean
): number {
    if (!isActive) return direction * IDLE_ROTATION_SPEED_DEG_PER_SEC * speedScale;

    const x = computeNormalizedDetune(detuneCents); // -1..1
    //const curved = Math.tanh(SPEED_CURVE * x); // -1..1, gentler near 0
    return direction * x * MAX_ROTATION_SPEED_DEG_PER_SEC * speedScale;
}

function useRingRotation(ref: React.RefObject<HTMLDivElement>, speedDegPerSec: number, enabled: boolean): void {
    const speedTargetRef = React.useRef(speedDegPerSec);
    const speedSmoothedRef = React.useRef(speedDegPerSec);
    const rotationRef = React.useRef(0);
    const lastTRef = React.useRef<number | null>(null);

    // Update target speed without restarting rAF.
    React.useEffect(() => {
        speedTargetRef.current = speedDegPerSec;
    }, [speedDegPerSec]);

    React.useEffect(() => {
        const el = ref.current;
        if (!el) return;

        if (!enabled) {
            console.log("strobe visualizer: rotation disabled");
            // Freeze without snapping back to 0deg.
            return;
        }

        let raf = 0;

        const step = (now: number) => {
            if (lastTRef.current == null) lastTRef.current = now;
            const dt = (now - lastTRef.current) / 1000;
            lastTRef.current = now;

            // Smooth speed changes (one-pole low-pass)
            // tau ~ 80ms => stable but still responsive
            const tau = 0.08;
            const alpha = 1 - Math.exp(-dt / tau);
            speedSmoothedRef.current += (speedTargetRef.current - speedSmoothedRef.current) * alpha;

            rotationRef.current = normalizeRotation(rotationRef.current + speedSmoothedRef.current * dt);
            //console.log(rotationRef.current);
            el.style.transform = `rotate(${rotationRef.current}deg)`;

            raf = requestAnimationFrame(step);
        };

        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [ref, enabled]);
}

function RingLayer({
    definition,
    rotationSpeedDegPerSec,
    enabled,
}: {
    definition: RingDefinition;
    rotationSpeedDegPerSec: number;
    enabled: boolean;
}) {
    if (!enabled) {
        return null;
    }
    const ringRef = React.useRef<HTMLDivElement>(null);
    useRingRotation(ringRef, rotationSpeedDegPerSec, enabled);

    const fillColor = PRIMARY_STROBE_COLOR;
    const gradient = buildSegmentGradient(fillColor, definition.segments);
    const outerSize = `${definition.sizePercent}%`;

    return (
        <div
            style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            <div
                ref={ringRef}
                style={{
                    width: outerSize,
                    height: outerSize,
                    borderRadius: "50%",
                    backgroundImage: gradient,
                    position: "relative",
                    //transition: "opacity 180ms ease-out",
                    //opacity: muted ? 0.7 : 1,
                    transform: "rotate(0deg)",
                    willChange: "transform",
                }}
            >
                <div
                    style={{
                        position: "absolute",
                        //inset: `${definition.thicknessPx}px`,
                        borderRadius: "50%",
                        //backgroundColor: BACKDROP_COLOR,
                    }}
                />
            </div>
        </div>
    );
}

export const StrobeVisualizer: React.FC<StrobeVisualizerProps> = ({ centsOffset, isActive }) => {
    const clampedCents = clampDetuneCents(centsOffset);

    // Only compute the speed plan on prop changes; animation itself is imperative.
    const rotationPlan = React.useMemo(() => {
        return RING_DEFINITIONS.map((definition) => ({
            definition,
            rotationSpeedDegPerSec: detuneToSpeed(clampedCents, definition.direction, definition.speedScale, isActive),
        }));
    }, [clampedCents, isActive]);

    return (
        <div
            style={{
                position: "relative",
                width: "100%",
                borderRadius: "50%",
                overflow: "hidden",
                height: "100%",
                aspectRatio: "1 / 1",
            }}
        >
            {rotationPlan.map((plan, index) => (
                <RingLayer
                    key={index}
                    definition={plan.definition}
                    rotationSpeedDegPerSec={plan.rotationSpeedDegPerSec}
                    enabled={isActive}
                />
            ))}
        </div>
    );
};
