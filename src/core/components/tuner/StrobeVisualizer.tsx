import React from "react";

export type StrobeVisualizerProps = {
    centsOffset: number | null; // cents relative to nearest pitch, -50..+50 typical
    isActive: boolean; // whether pitch is trusted; false -> muted/idle motion
};

type RingDefinition = {
    sizePercent: number; // diameter relative to container
    thicknessPx: number;
    segments: number;
    direction: 1 | -1;
    speedScale: number;
};

const MAX_DETUNE_CENTS = 50;
const MAX_ROTATION_SPEED_DEG_PER_SEC = 240; // feels lively but readable
const IDLE_ROTATION_SPEED_DEG_PER_SEC = 0; // gentle drift when untrusted
const SEGMENT_FILL_RATIO = 0.5; // percent of each segment arc that is lit
const RING_DEFINITIONS: RingDefinition[] = [
    { sizePercent: 90, thicknessPx: 32, segments: 8, direction: 1, speedScale: 1 },
    { sizePercent: 90, thicknessPx: 32, segments: 8, direction: -1, speedScale: 1 },
    //{ sizePercent: 90, thicknessPx: 32, segments: 24, direction: 1, speedScale: 1.4 },
];
// const RING_DEFINITIONS: RingDefinition[] = [
//     { sizePercent: 100, thicknessPx: 16, segments: 30, direction: 1, speedScale: 1 },
//     { sizePercent: 78, thicknessPx: 14, segments: 24, direction: -1, speedScale: 1.2 },
//     { sizePercent: 56, thicknessPx: 12, segments: 16, direction: 1, speedScale: 0.85 },
// ];

const PRIMARY_STROBE_COLOR = "rgba(25, 118, 210, 0.9)"; // MUI primary tone
const MUTED_STROBE_COLOR = "rgba(25, 118, 210, 0.25)";
const GAP_COLOR = "rgba(15, 23, 42, 0.08)";
const BACKDROP_COLOR = "rgba(0, 0, 0, 0.03)";
const INNER_DISC_COLOR = "#f7f9fb";

function clampDetuneCents(detuneCents: number | null): number | null {
    if (detuneCents === null) return null;
    return Math.max(-MAX_DETUNE_CENTS, Math.min(MAX_DETUNE_CENTS, detuneCents));
}

function normalizeDetune(detuneCents: number | null): number {
    if (detuneCents === null) return 0;
    const clamped = clampDetuneCents(detuneCents) ?? 0;
    return clamped / MAX_DETUNE_CENTS; // -1..1
}

function deriveRotationSpeed(detuneCents: number | null, direction: 1 | -1, speedScale: number, isActive: boolean): number {
    const normalized = normalizeDetune(detuneCents);
    if (!isActive) {
        return direction * IDLE_ROTATION_SPEED_DEG_PER_SEC * speedScale;
    }
    return direction * normalized * MAX_ROTATION_SPEED_DEG_PER_SEC * speedScale;
}

function normalizeRotation(rotationDeg: number): number {
    const wrapped = rotationDeg % 360;
    return wrapped < 0 ? wrapped + 360 : wrapped;
}

function buildSegmentGradient(fillColor: string, segmentCount: number): string {
    const segmentSpanDeg = 360 / segmentCount;
    const litSpanDeg = segmentSpanDeg * SEGMENT_FILL_RATIO;
    const gapSpanDeg = segmentSpanDeg - litSpanDeg;
    return `repeating-conic-gradient(${fillColor} 0deg ${litSpanDeg}deg, ${GAP_COLOR} ${litSpanDeg}deg ${litSpanDeg + gapSpanDeg}deg)`;
}

function useRingRotation(ref: React.RefObject<HTMLDivElement>, rotationSpeedDegPerSec: number): void {
    React.useEffect(() => {
        const element = ref.current;
        if (!element) return;

        if (rotationSpeedDegPerSec === 0) {
            element.style.transform = "rotate(0deg)";
            return;
        }

        let animationFrame: number;
        let lastTimestamp = performance.now();
        let rotationDeg = 0;

        const step = (now: number) => {
            const deltaSeconds = (now - lastTimestamp) / 1000;
            lastTimestamp = now;
            rotationDeg = normalizeRotation(rotationDeg + rotationSpeedDegPerSec * deltaSeconds);
            element.style.transform = `rotate(${rotationDeg}deg)`;
            animationFrame = requestAnimationFrame(step);
        };

        animationFrame = requestAnimationFrame(step);
        return () => cancelAnimationFrame(animationFrame);
    }, [ref, rotationSpeedDegPerSec]);
}

function RingLayer({
    definition,
    rotationSpeedDegPerSec,
    muted,
}: {
    definition: RingDefinition;
    rotationSpeedDegPerSec: number;
    muted: boolean;
}) {
    const ringRef = React.useRef<HTMLDivElement>(null);
    useRingRotation(ringRef, rotationSpeedDegPerSec);

    const fillColor = muted ? MUTED_STROBE_COLOR : PRIMARY_STROBE_COLOR;
    const gradient = buildSegmentGradient(fillColor, definition.segments);
    const outerSize = `${definition.sizePercent}%`;
    const innerSize = `calc(100% - ${definition.thicknessPx * 2}px)`;

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
                    transition: "opacity 180ms ease-out",
                    opacity: muted ? 0.7 : 1,
                    transform: "rotate(0deg)",
                }}
            >
                <div
                    style={{
                        position: "absolute",
                        inset: `${definition.thicknessPx}px`,
                        width: innerSize,
                        height: innerSize,
                        borderRadius: "50%",
                        backgroundColor: BACKDROP_COLOR,
                    }}
                />
            </div>
        </div>
    );
}

export const StrobeVisualizer: React.FC<StrobeVisualizerProps> = ({ centsOffset, isActive }) => {
    const clampedCents = clampDetuneCents(centsOffset);
    const rotationPlan = React.useMemo(() => {
        return RING_DEFINITIONS.map((definition) => ({
            definition,
            rotationSpeedDegPerSec: deriveRotationSpeed(clampedCents, definition.direction, definition.speedScale, isActive),
        }));
    }, [clampedCents, isActive]);

    return (
        <div
            style={{
                position: "relative",
                width: "100%",
                maxWidth: 320,
                margin: "12px auto 0",
                aspectRatio: "1 / 1",
                borderRadius: "50%",
                background: BACKDROP_COLOR,
                overflow: "hidden",
            }}
        >
            {rotationPlan.map((plan, index) => (
                <RingLayer
                    key={index}
                    definition={plan.definition}
                    rotationSpeedDegPerSec={plan.rotationSpeedDegPerSec}
                    muted={!isActive}
                />
            ))}
            <div
                style={{
                    position: "absolute",
                    inset: "32%",
                    borderRadius: "50%",
                    background: INNER_DISC_COLOR,
                    boxShadow: "0 0 18px rgba(0,0,0,0.08) inset",
                }}
            />
        </div>
    );
};
