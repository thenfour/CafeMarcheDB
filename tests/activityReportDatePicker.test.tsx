// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CMDateRangePicker, type DateRange } from "src/core/components/DateTime/DateTimeRangeControl";
import { useEventsForDateRange } from "src/core/components/DateTime/useEventsForDateRange";

vi.mock("src/locale/components/useLocale", () => ({ useLocale: () => ({ formattingLocale: "nl-BE" }) }));
vi.mock("src/core/db3/components/IconMap", () => ({ gIconMap: { CalendarMonth: () => <span /> } }));
vi.mock("src/core/components/DateTime/useEventsForDateRange", () => ({ useEventsForDateRange: vi.fn(() => ({ events: [], loading: false })) }));

let root: Root;
let container: HTMLDivElement;
const range: DateRange = { start: new Date("2026-10-10T15:00:00Z"), end: new Date("2026-10-20T15:00:00Z") };
const changed = vi.fn();
async function render(showEventHighlights: boolean) {
    await act(async () => root.render(<LocalizationProvider dateAdapter={AdapterDayjs}>
        <CMDateRangePicker value={range} timeZone="Asia/Tokyo" showEventHighlights={showEventHighlights} onChange={changed} />
    </LocalizationProvider>));
}
async function openCalendar() {
    await act(async () => container.querySelector<HTMLDivElement>(".startDate:not(.endDate)")!.click());
}
beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe("activity report calendar controls", () => {
    it("formats the selected band's date using the presentation locale", async () => {
        await render(false);
        const expected = new Intl.DateTimeFormat("nl-BE", { timeZone: "Asia/Tokyo", weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(range.start);
        expect(container.querySelector(".startDate:not(.endDate)")!.textContent).toBe(expected);
    });
    it("selects band midnight without requesting Event highlights", async () => {
        await render(false);
        await openCalendar();
        const day = [...document.querySelectorAll<HTMLButtonElement>(".EventCalendarMonth button[role=gridcell]")]
            .find(button => button.textContent === "15" && !button.classList.contains("dayOutsideMonth"));
        expect(day).toBeDefined();
        await act(async () => day!.click());
        expect(changed).toHaveBeenCalledWith({ start: new Date("2026-10-14T15:00:00Z"), end: range.end });
        expect(useEventsForDateRange).not.toHaveBeenCalled();
    });
    it("retains explicitly enabled Event highlights through the existing calendar-window owner", async () => {
        await render(true);
        await openCalendar();
        expect(useEventsForDateRange).toHaveBeenCalled();
        const calendarWindow = vi.mocked(useEventsForDateRange).mock.calls.at(-1)![0];
        expect(calendarWindow.start.timeZone).toBe("Asia/Tokyo");
        expect(calendarWindow.endExclusive.timeZone).toBe("Asia/Tokyo");
    });
});
