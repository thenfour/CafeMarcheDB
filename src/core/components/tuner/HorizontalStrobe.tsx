import React from "react";

export type HorizontalStrobeVisualizerProps = {
    centsOffset: number | null; // -50..+50 typical
    isActive: boolean; // false -> muted/idle
    heightPx?: number; // optional UI sizing
};

const MAX_DETUNE_CENTS = 50;

// Visual tuning knobs
const DEAD_BAND_CENTS = 0.1;          // freeze near 0
const SPEED_CURVE = 2.2;             // tanh curve strength
const MAX_SPEED_PX_PER_SEC = 520;    // how fast it scrolls at max detune
const IDLE_SPEED_PX_PER_SEC = 40;    // slow drift when inactive (set 0 to freeze)
const SPEED_SMOOTH_TAU_SEC = 0.08;   // speed smoothing (80ms)

// High-contrast classic look
const COLOR_A = "#111"; // "black"
const COLOR_B = "#f5f5f5"; // "white"
const BORDER = "rgba(0,0,0,0.12)";

function clampDetuneCents(detuneCents: number | null): number | null {
    if (detuneCents === null) return null;
    return Math.max(-MAX_DETUNE_CENTS, Math.min(MAX_DETUNE_CENTS, detuneCents));
}

// function prefersReducedMotion(): boolean {
//     if (typeof window === "undefined" || !window.matchMedia) return false;
//     return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// }

function detuneToSpeedPxPerSec(detuneCents: number | null, direction: 1 | -1, isActive: boolean): number {
    if (!isActive) return direction * IDLE_SPEED_PX_PER_SEC;

    const c = clampDetuneCents(detuneCents) ?? 0;
    if (Math.abs(c) < DEAD_BAND_CENTS) return 0;

    const x = c / MAX_DETUNE_CENTS;          // -1..1
    const curved = Math.tanh(SPEED_CURVE * x); // -1..1, calmer near 0
    return direction * curved * MAX_SPEED_PX_PER_SEC;
}

function useBackgroundScrollX(
    ref: React.RefObject<HTMLDivElement>,
    speedPxPerSec: number,
    periodPx: number,         // repeat period of the pattern
    enabled: boolean
) {
    const speedTargetRef = React.useRef(speedPxPerSec);
    const speedSmoothRef = React.useRef(speedPxPerSec);
    const xRef = React.useRef(0);
    const lastTRef = React.useRef<number | null>(null);

    React.useEffect(() => {
        speedTargetRef.current = speedPxPerSec;
    }, [speedPxPerSec]);

    React.useEffect(() => {
        const el = ref.current;
        if (!el || !enabled) return;

        let raf = 0;
        const step = (now: number) => {
            if (lastTRef.current == null) lastTRef.current = now;
            const dt = (now - lastTRef.current) / 1000;
            lastTRef.current = now;

            // smooth speed a bit
            const tau = SPEED_SMOOTH_TAU_SEC;
            const alpha = 1 - Math.exp(-dt / tau);
            speedSmoothRef.current += (speedTargetRef.current - speedSmoothRef.current) * alpha;

            xRef.current += speedSmoothRef.current * dt;

            // wrap so numbers stay small and it never "slides out"
            const p = Math.max(1, periodPx);
            const wrapped = ((xRef.current % p) + p) % p;

            el.style.backgroundPosition = `${wrapped}px 0px`;

            raf = requestAnimationFrame(step);
        };

        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [ref, enabled, periodPx]);
}

/**
 * Imperative translateX animation:
 * - Phase persists across prop churn
 * - Speed changes are smoothed
 */
function useTranslateX(ref: React.RefObject<HTMLDivElement>, speedPxPerSec: number, enabled: boolean) {
    const speedTargetRef = React.useRef(speedPxPerSec);
    const speedSmoothRef = React.useRef(speedPxPerSec);
    const xRef = React.useRef(0);
    const lastTRef = React.useRef<number | null>(null);

    React.useEffect(() => {
        speedTargetRef.current = speedPxPerSec;
    }, [speedPxPerSec]);

    React.useEffect(() => {
        const el = ref.current;
        if (!el || !enabled) return;

        let raf = 0;

        const step = (now: number) => {
            if (lastTRef.current == null) lastTRef.current = now;
            const dt = (now - lastTRef.current) / 1000;
            lastTRef.current = now;

            // One-pole low-pass smoothing on speed
            const tau = SPEED_SMOOTH_TAU_SEC;
            const alpha = 1 - Math.exp(-dt / tau);
            speedSmoothRef.current += (speedTargetRef.current - speedSmoothRef.current) * alpha;

            xRef.current += speedSmoothRef.current * dt;
            el.style.transform = `translateX(${xRef.current}px)`;

            raf = requestAnimationFrame(step);
        };

        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [ref, enabled]);
}

// function StrobeLane({
//     speedPxPerSec,
//     stripePx,
//     muted,
// }: {
//     speedPxPerSec: number;
//     stripePx: number;
//     muted: boolean;
// }) {
//     const stripRef = React.useRef<HTMLDivElement>(null);
//     useTranslateX(stripRef, speedPxPerSec, true);

//     // repeating black/white vertical bars
//     const background = `repeating-linear-gradient(90deg,
//     ${COLOR_B} 0px,
//     ${COLOR_B} ${stripePx}px,
//     ${COLOR_A} ${stripePx}px,
//     ${COLOR_A} ${stripePx * 2}px
//   )`;

//     return (
//         <div
//             style={{
//                 position: "relative",
//                 overflow: "hidden",
//                 borderRadius: 10,
//                 border: `1px solid ${BORDER}`,
//                 background: muted ? "rgba(0,0,0,0.03)" : "rgba(0,0,0,0.02)",
//             }}
//         >
//             {/* wide strip so translation never reveals empty space */}
//             <div
//                 ref={stripRef}
//                 style={{
//                     width: "300%",
//                     height: "100%",
//                     backgroundImage: background,
//                     willChange: "transform",
//                     opacity: muted ? 0.45 : 1,
//                 }}
//             />
//             {/* optional subtle center marker */}
//             <div
//                 style={{
//                     position: "absolute",
//                     top: 0,
//                     bottom: 0,
//                     left: "50%",
//                     width: 2,
//                     transform: "translateX(-1px)",
//                     background: "rgba(0,0,0,0.10)",
//                     pointerEvents: "none",
//                 }}
//             />
//         </div>
//     );
// }



function StrobeLane({
    speedPxPerSec,
    stripePx,
    muted,
}: {
    speedPxPerSec: number;
    stripePx: number;
    muted: boolean;
}) {
    const laneRef = React.useRef<HTMLDivElement>(null);

    // For the 2-color repeating pattern, the period is 2*stripePx
    const periodPx = stripePx * 2;

    useBackgroundScrollX(laneRef, speedPxPerSec, periodPx, true);

    const background = `repeating-linear-gradient(90deg,
    ${COLOR_B} 0px,
    ${COLOR_B} ${stripePx}px,
    ${COLOR_A} ${stripePx}px,
    ${COLOR_A} ${stripePx * 2}px
  )`;

    return (
        <div
            ref={laneRef}
            style={{
                width: "100%",
                height: "100%",
                //borderRadius: 10,
                //border: `1px solid ${BORDER}`,
                backgroundImage: background,
                backgroundRepeat: "repeat",
                backgroundPosition: "0px 0px",
                willChange: "background-position",
                //opacity: muted ? 0.45 : 1,
                overflow: "hidden",
            }}
        >
            <div
                style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: "50%",
                    width: 2,
                    //transform: "translateX(-1px)",
                    background: "rgba(0,0,0,0.10)",
                    pointerEvents: "none",
                }}
            />
        </div>
    );
}
export const HorizontalStrobeVisualizer: React.FC<HorizontalStrobeVisualizerProps> = ({
    centsOffset,
    isActive,
}) => {
    // Two lanes (classic vibe: slightly different stripe sizes / opposing motion)
    const speed1 = React.useMemo(() => detuneToSpeedPxPerSec(centsOffset, 1, isActive), [centsOffset, isActive]);
    const speed2 = React.useMemo(() => detuneToSpeedPxPerSec(centsOffset, -1, isActive) * 0.85, [centsOffset, isActive]);

    return (
        <div>
            <div style={{ height: 20 }}>
                <StrobeLane speedPxPerSec={speed1} stripePx={10} muted={!isActive} />
            </div>
            <div style={{ height: 20 }}>
                <StrobeLane speedPxPerSec={speed2} stripePx={14} muted={!isActive} />
            </div>
        </div>
    );
};
