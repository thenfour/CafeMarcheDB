import React from "react";

export type FanSegmentTunerProps = {
    centsOffset: number | null; // typically -50..+50
    isActive: boolean;

    // Layout (procedural)
    width?: number;
    height?: number;
    originX?: number;      // center of the circles before flattening
    originY?: number;
    innerRadius?: number;
    outerRadius?: number;
    scaleY?: number;       // < 1 => flatter/elliptical
    startDeg?: number;     // arc span (degrees, SVG polar: 0° right, -90° up)
    endDeg?: number;
    gapDeg?: number;       // spacing between segments in degrees
    segmentCount?: number; // MUST be odd

    // Mapping
    maxDetuneCents?: number; // default 50

    // Colors
    centerOnColor?: string;
    flatOnColor?: string;
    sharpOnColor?: string;

    offColor?: string;        // unlit segment fill
    offOpacity?: number;      // unlit opacity
    mutedOpacity?: number;    // whole meter opacity when inactive
    backgroundColor?: string; // optional backdrop rect fill
};

function clamp(x: number, lo: number, hi: number) {
    return Math.max(lo, Math.min(hi, x));
}

function polar(cx: number, cy: number, r: number, deg: number) {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcCmd(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
    const p0 = polar(cx, cy, r, startDeg);
    const p1 = polar(cx, cy, r, endDeg);
    const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
    const sweep = endDeg >= startDeg ? 1 : 0;
    return { p0, p1, largeArc, sweep };
}

// Filled annular sector (ring slice)
function annularSectorPath(
    cx: number,
    cy: number,
    rInner: number,
    rOuter: number,
    startDeg: number,
    endDeg: number
) {
    const o = arcCmd(cx, cy, rOuter, startDeg, endDeg);
    const i = arcCmd(cx, cy, rInner, endDeg, startDeg); // reversed

    return [
        `M ${o.p0.x.toFixed(3)} ${o.p0.y.toFixed(3)}`,
        `A ${rOuter} ${rOuter} 0 ${o.largeArc} ${o.sweep} ${o.p1.x.toFixed(3)} ${o.p1.y.toFixed(3)}`,
        `L ${i.p0.x.toFixed(3)} ${i.p0.y.toFixed(3)}`,
        `A ${rInner} ${rInner} 0 ${i.largeArc} ${i.sweep} ${i.p1.x.toFixed(3)} ${i.p1.y.toFixed(3)}`,
        "Z",
    ].join(" ");
}

export const FanSegmentTuner: React.FC<FanSegmentTunerProps> = ({
    centsOffset,
    isActive,

    width = 320,
    height = 220,
    originX,
    originY,
    innerRadius = 78,
    outerRadius = 120,
    scaleY = 0.78,
    startDeg = -160,
    endDeg = -20,
    gapDeg = 0.5,
    segmentCount = 29,

    maxDetuneCents = 50,

    centerOnColor = "#4cc", // cyan
    flatOnColor = "#c55",    // red
    sharpOnColor = "#fc0",  // yellow

    offColor = "#eee",
    offOpacity = 1,
    mutedOpacity = 1,
    backgroundColor = "transparent",
}) => {
    // default origin if not provided: bottom-center-ish
    const cx = originX ?? width / 2;
    const cy = originY ?? height * 0.86;

    // enforce odd segment count
    const N = Math.max(3, segmentCount | 0);
    const oddN = N % 2 === 1 ? N : N + 1;
    const half = (oddN - 1) / 2;

    const detected = isActive && centsOffset != null;

    const clampedCents = centsOffset == null ? 0 : clamp(centsOffset, -maxDetuneCents, maxDetuneCents);
    const absCents = Math.abs(clampedCents);

    // How many segments to light on one side (0..half)
    const centsPerSegment = maxDetuneCents / half;
    const litCount = detected ? Math.min(half, Math.floor(absCents / centsPerSegment + 1e-6)) : 0;

    const totalSpan = endDeg - startDeg;
    const stepDeg = totalSpan / oddN;

    // ellipse flattening around the origin point
    const transform =
        scaleY === 1
            ? undefined
            : `translate(${cx} ${cy}) scale(1 ${scaleY}) translate(${-cx} ${-cy})`;

    const meterOpacity = detected ? 1 : mutedOpacity;

    return (
        <svg
            viewBox={`0 0 ${width} ${height}`}
            width="100%"
            height="auto"
            style={{ display: "block" }}
        >
            {backgroundColor !== "transparent" && (
                <rect x={0} y={0} width={width} height={height} fill={backgroundColor} />
            )}

            <g transform={transform} opacity={meterOpacity}>
                {Array.from({ length: oddN }, (_, k) => {
                    const i = k - half; // -half..0..+half
                    const segStart = startDeg + k * stepDeg + gapDeg / 2;
                    const segEnd = startDeg + (k + 1) * stepDeg - gapDeg / 2;

                    // decide if lit + what color
                    let fill = offColor;
                    let opacity = offOpacity;

                    if (detected) {
                        if (i === 0) {
                            fill = centerOnColor;
                            opacity = 1;
                        } else if (i < 0) {
                            // flat side: light from center outward
                            if (-i <= litCount && clampedCents < 0) {
                                fill = flatOnColor;
                                opacity = 1;
                            }
                        } else {
                            // sharp side
                            if (i <= litCount && clampedCents > 0) {
                                fill = sharpOnColor;
                                opacity = 1;
                            }
                        }
                    }

                    const d = annularSectorPath(cx, cy, innerRadius, outerRadius, segStart, segEnd);

                    return <path key={k} d={d} fill={fill} opacity={opacity} />;
                })}
            </g>
        </svg>
    );
};
