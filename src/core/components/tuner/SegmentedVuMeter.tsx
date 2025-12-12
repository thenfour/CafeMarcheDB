import React from "react";

export type SegmentedVuMeterProps = {
    valueRms: number; // expected 0..1, clamped internally
    segments?: number;
    silentThresholdDb?: number;
    idle?: boolean; // force gray coloring (e.g., below trust threshold)
};

const DEFAULT_SEGMENTS = 20;
const MIN_DB = -60;
const MAX_DB = 0;
const SILENT_DEFAULT_DB = -55;

function rmsToDb(rms: number): number {
    const epsilon = 1e-6;
    const db = 20 * Math.log10(Math.max(rms, epsilon));
    return Math.max(MIN_DB, Math.min(MAX_DB, db));
}

function mapDbToActiveSegments(db: number, segments: number, silentThresholdDb: number): number {
    // Below silent threshold: show 1 segment to indicate listening.
    if (db <= silentThresholdDb) {
        return 1;
    }

    // Ease-out mapping so low levels light more quickly than linear.
    const normalized = (db - MIN_DB) / (MAX_DB - MIN_DB); // 0..1
    const eased = 1 - Math.pow(1 - normalized, 0.5); // ease-out
    const active = Math.round(eased * segments);
    return Math.min(segments, Math.max(1, active));
}

function segmentColor(index: number, segments: number): string {
    const ratio = index / segments;
    if (ratio >= 0.9) return "#e53935"; // red
    if (ratio >= 0.7) return "#fbc02d"; // yellow
    return "#43a047"; // green
}

export const SegmentedVuMeter: React.FC<SegmentedVuMeterProps> = ({ valueRms, segments = DEFAULT_SEGMENTS, silentThresholdDb = SILENT_DEFAULT_DB, idle = false }) => {
    const clampedRms = Math.max(0, Math.min(1, valueRms));
    const db = rmsToDb(clampedRms);
    const activeCount = mapDbToActiveSegments(db, segments, silentThresholdDb);
    const idleColor = "#c0c0c0";

    return (
        <div style={{ display: "flex", flexDirection: "row", gap: "2px", alignItems: "center", width: "100%" }}>
            {Array.from({ length: segments }).map((_, i) => {
                const isActive = i < activeCount;
                const color = idle ? idleColor : (isActive ? segmentColor(i, segments) : "#d0d0d0");
                return (
                    <div
                        key={i}
                        style={{
                            flex: 1,
                            height: 12,
                            borderRadius: 1,
                            backgroundColor: color,
                            opacity: isActive ? 1 : 0.35,
                        }}
                    />
                );
            })}
        </div>
    );
};
