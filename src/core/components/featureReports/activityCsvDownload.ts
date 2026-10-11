import type { ActivityCsvResult } from "./activityReportTypes";

export function downloadActivityCsv(result: Pick<ActivityCsvResult, "csvContent" | "filename">): void {
    // Excel uses the UTF-8 marker to read localized labels correctly.
    const url = URL.createObjectURL(new Blob(["\uFEFF", result.csvContent], { type: "text/csv;charset=utf-8;" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = result.filename;
    document.body.appendChild(anchor);
    try {
        anchor.click();
    } finally {
        anchor.remove();
        URL.revokeObjectURL(url);
    }
}
