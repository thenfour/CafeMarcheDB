// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CalendarDate, CalendarRange } from "shared/dateTimePolicy";
import { kStaticLocalizedStringRegistry, type LocalizedPlainStringKey } from "src/locale/shared/staticLocalizedStringRegistry";

vi.mock("src/core/hooks/useSearchableList", () => ({ useSearchableList: () => {
    throw new Error("Deferred event overlay searched for content.");
} }));
vi.mock("src/locale/components/useLocale", () => ({ useLocale: () => ({
    getPlainString: (key: LocalizedPlainStringKey) => kStaticLocalizedStringRegistry[key].defaultValue,
}) }));

import { EventCalendarRecoveryNotice } from "src/core/components/DateTime/EventCalendarRecoveryNotice";
import { useEventsForDateRange } from "src/core/components/DateTime/useEventsForDateRange";

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});
describe("date-picker event-overlay recovery", () => {
    it("reports deferred highlights without mounting a search and gives an explicit explanation", async () => {
        const range = new CalendarRange(new CalendarDate("2026-10-08", "Europe/Brussels"), new CalendarDate("2026-10-09", "Europe/Brussels"));
        const Probe = () => {
            expect(useEventsForDateRange(range)).toEqual({ events: [], loading: false, error: null, availability: "deferred" });
            return <EventCalendarRecoveryNotice />;
        };
        await act(async () => root.render(<Probe />));
        expect(container.querySelector('[role="status"]')?.textContent).toContain("You can still select dates");
    });
});
