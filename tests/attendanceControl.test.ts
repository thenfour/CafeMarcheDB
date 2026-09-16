// @vitest-environment jsdom
import React from "react";
import { act, Simulate } from "react-dom/test-utils";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Keep attendance decisions, state, and callbacks real. Stub application chrome
// and rich text infrastructure so this suite needs neither a dashboard nor RPC.
vi.mock("src/core/components/CMCoreComponents2", () => ({
    CMSmallButton: ({ children, onClick }: any) => React.createElement("button", { onClick }, children),
    DialogActionsCM: ({ children }: any) => React.createElement("div", {}, children),
    NameValuePair: ({ name, value }: any) => React.createElement("section", {}, name, value),
}));
vi.mock("src/core/components/CMChip", () => ({
    CMChip: ({ children, onClick, className }: any) => React.createElement("button", { onClick, className }, children),
    CMChipContainer: ({ children }: any) => React.createElement("div", {}, children),
}));
vi.mock("src/core/db3/components/IconMap", () => ({ RenderMuiIcon: () => null, gIconMap: { CheckCircleOutline: () => null } }));
vi.mock("src/core/components/DateTime/DateTimeComponents", () => ({ DateValue: () => null }));
vi.mock("src/core/components/markdown/Markdown", () => ({ Markdown: ({ markdown }: any) => React.createElement("div", {}, markdown) }));
vi.mock("src/core/components/markdown/MarkdownControl3", () => ({
    Markdown3Editor: ({ value, onChange, allowUploads }: any) => React.createElement("textarea", {
        value, onChange: (e: any) => onChange(e.target.value), "data-uploads": String(allowUploads),
    }),
}));
vi.mock("src/core/components/ReactiveInputDialog", () => ({ ReactiveInputDialog: ({ children }: any) => React.createElement("div", { role: "dialog" }, children) }));

import { AttendanceControlView, AttendanceChange } from "src/core/components/event/AttendanceControlView";
import { AttendanceScenario, applyAttendanceScenarioChange, buildAttendanceScenario, createAttendanceScenario, scenarioAttendances, scenarioInstruments } from "src/core/components/event/attendanceScenario";

let root: Root;
let changeScenario: React.Dispatch<React.SetStateAction<AttendanceScenario>>;
let currentScenario: AttendanceScenario;
const saves = vi.fn();
const originalActEnvironment = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT");
const Harness = ({ initial, userIndex = 1, minimal = false }: { initial: AttendanceScenario; userIndex?: number; minimal?: boolean }) => {
    const [scenario, setScenario] = React.useState(initial);
    changeScenario = setScenario;
    currentScenario = scenario;
    const { attendance, event } = buildAttendanceScenario(scenario, userIndex);
    return React.createElement(AttendanceControlView, { attendance, event, minimalWhenNotAlert: minimal, environment: {
        attendances: scenarioAttendances, instruments: scenarioInstruments, allowUploads: false, datePresentation: { bandTimeZone: "UTC", viewerTimeZone: "UTC", locale: "en" },
        commentDialogTitle: "Comment", commentDialogDescription: "Local comment",
        onSave: async (change: AttendanceChange) => {
            saves(change);
            setScenario(previous => ({ ...previous, users: previous.users.map((person, i) => i === userIndex ? applyAttendanceScenarioChange(person, change) : person) }));
        },
    } });
};
beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    document.body.innerHTML = "<div id='root'></div>";
    root = createRoot(document.getElementById("root")!);
});
afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
    if (originalActEnvironment) Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", originalActEnvironment);
    else Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});
const buttons = (text: string) => [...document.querySelectorAll<HTMLButtonElement>("button")].filter(b => b.textContent === text);
const click = async (button: HTMLElement) => { expect(button).toBeDefined(); await act(async () => button.click()); };
const render = async (initial = createAttendanceScenario(), minimal = false, userIndex = 1) => {
    await act(async () => root.render(React.createElement(Harness, { initial, minimal, userIndex })));
};

describe("shared attendance view with a local adapter", () => {
    it("completes attendance, edits the instrument, and saves a comment for only the simulated user", async () => {
        await render();
        expect(document.querySelector(".eventAttendanceControl.alert")).not.toBeNull();
        await click(buttons("Yes")[1]!);
        expect(currentScenario.users[1]!.responses).toEqual([3, 3, "missing"]);
        expect(currentScenario.users[0]!.responses).toEqual(["missing", "missing", "missing"]);
        expect(document.querySelector(".eventAttendanceControl.alert")).toBeNull();
        await click(buttons("Trumpet")[0]!);
        await click(buttons("Saxophone")[0]!);
        expect(currentScenario.users[1]!.instrumentId).toBe(2);
        await click(document.querySelector<HTMLElement>(".ownAttendanceComment")!);
        const editor = document.querySelector("textarea")!;
        expect(editor.dataset.uploads).toBe("false");
        await act(async () => Simulate.change(editor, { target: { value: "Need a lift" } } as any));
        await click(buttons("Save")[0]!);
        expect(currentScenario.users[1]!.comment).toBe("Need a lift");
        expect(document.querySelector('[role="dialog"]')).toBeNull();
        expect(saves.mock.calls.map(([change]) => change.type)).toEqual(["segment", "instrument", "comment"]);
    });

    it("retains the current compact-after-final-answer behavior and lets the user reopen it", async () => {
        await render(createAttendanceScenario(), true);
        await click(buttons("Yes")[1]!);
        expect(document.querySelector(".minimalView")?.textContent).toContain("You responded");
        await click(buttons("Yes")[0]!);
        expect(document.querySelector(".minimalView")).toBeNull();
        expect(buttons("Saxophone")).toHaveLength(1);
        await click(buttons("(no answer)")[0]!);
        expect(currentScenario.users[1]!.responses[0]).toBeNull();
        expect(document.querySelector(".eventAttendanceControl.alert")).not.toBeNull();
    });

    it("hides and restores the same mounted control as cancellation changes", async () => {
        await render();
        await act(async () => changeScenario(s => ({ ...s, cancelled: true })));
        expect(document.querySelector(".eventAttendanceControl")).toBeNull();
        await act(async () => changeScenario(s => ({ ...s, cancelled: false })));
        expect(document.querySelector(".eventAttendanceControl.alert")).not.toBeNull();
        expect(saves).not.toHaveBeenCalled();
    });

    it("does not save a cancelled comment edit", async () => {
        await render();
        await click(document.querySelector<HTMLElement>(".ownAttendanceComment")!);
        await act(async () => Simulate.change(document.querySelector("textarea")!, { target: { value: "Discard this" } } as any));
        await click(buttons("Cancel")[0]!);
        expect(currentScenario.users[1]!.comment).toBe("");
        expect(saves).not.toHaveBeenCalled();
    });
});
