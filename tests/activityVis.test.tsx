// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActivityVis } from "src/core/components/ActivityVis";

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

describe("performance activity chart", () => {
    it("renders every year and places counts in the matching months", async () => {
        const dates = [new Date(2026, 2, 15), new Date(2024, 0, 1), new Date(2026, 2, 30)];
        await act(async () => root.render(<ActivityVis items={dates} getItemInfo={occursAt => ({ occursAt })}
            getBucketInfo={bucket => ({ tooltip: `${bucket.items.length} events` })} />));
        expect([...container.querySelectorAll(".yearTH")].map(cell => cell.textContent)).toEqual(["2026", "2025", "2024"]);
        const latest = container.querySelector(".yearTH")!.parentElement!;
        expect(latest.querySelectorAll(".cell")[2]!.textContent).toBe("2");
        expect(latest.querySelector(".yearTotalFilledPart")!.textContent).toBe("2");
    });

    it("uses the caller's calendar month, localized headings and selected-bucket callback", async () => {
        const click = vi.fn();
        const date = new Date("2025-12-31T23:30:00Z");
        await act(async () => root.render(<ActivityVis items={[date]} getItemInfo={occursAt => ({ occursAt })}
            getCalendarMonth={() => ({ year: 2026, month: 0 })} formattingLocale="fr-BE" selectedMonthBucketId="2026-0"
            getBucketInfo={() => ({ tooltip: "Event" })} onBucketClick={click} />));
        expect(container.querySelector(".yearTH")!.textContent).toBe("2026");
        expect(container.querySelector(".monthTH")!.textContent).toBe(new Date(2000, 0).toLocaleString("fr-BE", { month: "short" }));
        const selected = container.querySelector<HTMLTableCellElement>(".cell.selected")!;
        await act(async () => selected.click());
        expect(click.mock.calls[0]![0]).toMatchObject({ yearMonthBucketId: "2026-0", items: [{ item: date }] });
    });
});
