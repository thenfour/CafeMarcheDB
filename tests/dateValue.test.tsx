// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DateValue } from "src/core/components/DateTime/DateTimeComponents";

let container: HTMLDivElement;
let root: Root;
const value = new Date("2026-03-28T23:30:00Z");

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

describe("explicit date presentation", () => {
    it("uses the supplied locale and timezone instead of the browser's preferences", async () => {
        await act(async () => root.render(<DateValue value={value} formattingLocale="fr-BE" timeZone="Europe/Brussels" />));
        const date = container.querySelector(".DateValue")!;
        expect(date.textContent).toContain("dim.");
        expect(date.textContent).toContain("29 mars 2026");
        await act(async () => root.render(<DateValue value={value} formattingLocale="nl-BE" timeZone="America/Los_Angeles" />));
        expect(date.textContent).toContain("za");
        expect(date.textContent).toContain("28 mrt 2026");
    });

    it("formats tooltip dates and times with the same explicit presentation", async () => {
        await act(async () => root.render(<DateValue value={value} formattingLocale="fr-BE" timeZone="Europe/Brussels" />));
        await act(async () => {
            container.querySelector(".DateValue")!.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
            await new Promise(resolve => setTimeout(resolve, 160));
        });
        const tooltip = document.querySelector('[role="tooltip"]');
        expect(tooltip?.textContent).toContain("dimanche");
        expect(tooltip?.textContent).toContain("29/03/2026 00:30:00");
    });

    it("can change between missing and present dates without changing the hook order", async () => {
        for (const date of [null, value, undefined, value]) {
            await act(async () => root.render(<DateValue value={date} formattingLocale="en-US" timeZone="UTC" />));
            expect(container.querySelector(".DateValue")?.textContent).toBe(date ? "Sat Mar 28 2026" : "--");
        }
    });

    it("retains custom date rendering and same-zone relative calendar labels", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-03-28T22:30:00Z"));
        try {
            await act(async () => root.render(<DateValue value={value} formattingLocale="en-US" timeZone="Europe/Brussels"
                showRelative format={date => `Created on ${date}`} />));
            expect(container.textContent).toBe("Created on Sun Mar 29 2026 (Tomorrow)");
        } finally {
            vi.useRealTimers();
        }
    });
});
