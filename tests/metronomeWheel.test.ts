// @vitest-environment jsdom
import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("src/core/components/CMTextField", async () => {
    const React = await vi.importActual<typeof import("react")>("react");
    return { CMTextInputBase: ({ value }: { value: string }) => React.createElement("input", { value, readOnly: true }) };
});
vi.mock("src/core/components/Knob", () => ({ Knob: () => null }));
vi.mock("src/core/components/ReactiveInputDialog", () => ({ ReactiveInputDialog: () => null }));
vi.mock("src/core/db3/components/IconMap", () => ({ gIconMap: { VolumeOff: () => null } }));
vi.mock("src/core/components/featureReports/activityTracking", () => ({ ActivityFeature: {} }));
vi.mock("src/core/components/dashboardContext/DashboardContext", () => {
    const context = { metronomeSilencers: [] as (() => void)[] };
    return { useDashboardContext: () => context, useFeatureRecorder: () => () => undefined };
});

import { MetronomePanel } from "src/core/components/Metronome";

let root: Root;
const errors: unknown[] = [];
const captureError = (event: ErrorEvent) => {
    errors.push(event.error);
    event.preventDefault();
};
const originalActEnvironment = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT");

beforeEach(async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    localStorage.clear();
    errors.length = 0;
    window.addEventListener("error", captureError);
    document.body.innerHTML = "<div id='root'></div><div id='outside'>Outside</div>";
    root = createRoot(document.getElementById("root")!);
    await act(async () => root.render(React.createElement(MetronomePanel)));
});

afterEach(async () => {
    await act(async () => root.unmount());
    window.removeEventListener("error", captureError);
    document.body.replaceChildren();
    localStorage.clear();
    if (originalActEnvironment) Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", originalActEnvironment);
    else Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});

const bpmInput = () => document.querySelector<HTMLInputElement>(".GlobalMetronomeDialog input")!;
const wheel = async (target: EventTarget, deltaY = -100, shiftKey = false) => {
    const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY, shiftKey });
    await act(async () => { target.dispatchEvent(event); });
    return event;
};

describe("metronome wheel input", () => {
    it.each(["document", "text", "comment"])("ignores a %s target without throwing or changing BPM (#678)", async targetKind => {
        const label = document.querySelector(".keyboardShortcutsHelp strong")!;
        const target = targetKind === "document" ? document
            : targetKind === "text" ? label.firstChild!
                : label.appendChild(document.createComment("non-element target"));

        const event = await wheel(target);

        expect(errors).toEqual([]);
        expect(event.defaultPrevented).toBe(false);
        expect(bpmInput().value).toBe("120");
        expect(localStorage.getItem("metronomeBPM")).toBe("120");
    });

    it("leaves scrolling outside the panel alone", async () => {
        const event = await wheel(document.getElementById("outside")!);

        expect(errors).toEqual([]);
        expect(event.defaultPrevented).toBe(false);
        expect(bpmInput().value).toBe("120");
    });

    it("preserves normal and Shift-wheel BPM changes over a nested panel element", async () => {
        const target = document.querySelector(".keyboardShortcutsHelp strong")!;
        for (const [deltaY, shiftKey, expectedBpm] of [
            [-100, false, "124"], [100, false, "120"], [-100, true, "121"], [100, true, "120"],
        ] as const) {
            const event = await wheel(target, deltaY, shiftKey);
            expect(event.defaultPrevented).toBe(true);
            expect(bpmInput().value).toBe(expectedBpm);
            expect(localStorage.getItem("metronomeBPM")).toBe(expectedBpm);
        }
        expect(errors).toEqual([]);
    });
});
