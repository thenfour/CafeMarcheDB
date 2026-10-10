// @vitest-environment jsdom
import React from "react";
import { act, Simulate } from "react-dom/test-utils";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Keep attendance decisions, state, and callbacks real. Stub application chrome
// and rich text infrastructure so this suite needs neither a dashboard nor RPC.
vi.mock("src/core/components/CMCoreComponents2", () => ({
    CMButton: ({ children, onClick, className, disabled }: React.ButtonHTMLAttributes<HTMLButtonElement>) => React.createElement("button", { onClick, className, disabled }, children),
    CMSmallButton: ({ children, onClick }: any) => React.createElement("button", { onClick }, children),
    NameValuePair: ({ name, value }: any) => React.createElement("section", {}, name, value),
}));
vi.mock("src/core/components/CMDialog", () => ({
    CMDialog: ({ children, actions, title }: any) => React.createElement("div", { role: "dialog" }, title, children, actions),
}));
vi.mock("src/core/components/CMChip", () => ({
    CMChip: ({ children, onClick, className, variation }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variation?: { selected: boolean } }) => React.createElement("button", { onClick, className, "aria-pressed": variation?.selected }, children),
    CMChipContainer: ({ children }: any) => React.createElement("div", {}, children),
}));
vi.mock("src/core/db3/components/IconMap", () => ({ RenderMuiIcon: () => null, gIconMap: { CheckCircleOutline: () => null } }));
vi.mock("src/core/components/DateTime/DateTimeComponents", () => ({ DateValue: () => null }));
vi.mock("src/core/components/markdown/Markdown", () => ({ Markdown: ({ markdown }: any) => React.createElement("div", {}, markdown) }));
vi.mock("src/core/components/markdown/MarkdownControl3", () => ({
    Markdown3Editor: ({ value, onChange, allowUploads, handleSave }: {
        value: string; onChange: (value: string) => void; allowUploads: boolean; handleSave: () => void;
    }) => React.createElement(React.Fragment, null, React.createElement("textarea", {
        value, onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value), "data-uploads": String(allowUploads),
    }), React.createElement("button", { onClick: handleSave }, "Save without closing")),
}));
import { AttendanceControlView, AttendanceChange, AttendanceControlEnvironment } from "src/core/components/event/AttendanceControlView";
import { AttendanceScenario, applyAttendanceScenarioChange, buildAttendanceScenario, createAttendanceScenario, scenarioAttendances, scenarioInstruments } from "src/core/components/event/attendanceScenario";

let root: Root;
let changeScenario: React.Dispatch<React.SetStateAction<AttendanceScenario>>;
let currentScenario: AttendanceScenario;
const saves = vi.fn();
const originalActEnvironment = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT");
const Harness = ({ initial, userIndex = 1, minimal = false, attendances = scenarioAttendances, instruments = scenarioInstruments, beforeSave }: {
    initial: AttendanceScenario; userIndex?: number; minimal?: boolean;
    attendances?: AttendanceControlEnvironment["attendances"];
    instruments?: AttendanceControlEnvironment["instruments"];
    beforeSave?: AttendanceControlEnvironment["onSave"];
}) => {
    const [scenario, setScenario] = React.useState(initial);
    changeScenario = setScenario;
    currentScenario = scenario;
    const { attendance, event } = buildAttendanceScenario(scenario, userIndex);
    return React.createElement(AttendanceControlView, { attendance, event, minimalWhenNotAlert: minimal, environment: {
        attendances, instruments, allowUploads: false, datePresentation: { bandTimeZone: "UTC", viewerTimeZone: "UTC", locale: "en" },
        commentDialogTitle: "Comment", commentDialogDescription: "Local comment",
        onSave: async (change: AttendanceChange) => {
            saves(change);
            await beforeSave?.(change);
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
    it("keeps the reference editor shortcut save open", async () => {
        await render();
        await click(document.querySelector<HTMLElement>(".ownAttendanceComment")!);
        const editor = document.querySelector("textarea")!;
        editor.value = "Still editing";
        await act(async () => Simulate.change(editor));
        await click(buttons("Save without closing")[0]!);
        expect(currentScenario.users[1]!.comment).toBe("Still editing");
        expect(document.querySelector('[role="dialog"]')).not.toBeNull();
        await click(buttons("Cancel")[0]!);
    });
    it.each(["instrument", "group"] as const)("excludes a hidden %s from new instrument choices", async kind => {
        const scenario = createAttendanceScenario();
        scenario.users[1]!.responses = [3, 3, 3];
        const instruments = scenarioInstruments.map(option => option.name !== "Saxophone" ? option : kind === "instrument"
            ? { ...option, isHidden: true } : { ...option, functionalGroup: { ...option.functionalGroup, isHidden: true } });
        await act(async () => root.render(React.createElement(Harness, { initial: scenario, instruments })));
        await click(buttons("Trumpet")[0]!);
        expect(buttons("Saxophone")).toHaveLength(0);
        expect(buttons("Percussion")).toHaveLength(1);
    });
    it("marks the inherited primary selected and retains an explicit choice when the default changes", async () => {
        const scenario = createAttendanceScenario();
        scenario.users[1]!.responses = [3, 3, 3];
        await render(scenario);
        await click(buttons("Trumpet")[0]!);
        expect(buttons("Trumpet")[0]!.getAttribute("aria-pressed")).toBe("true");
        expect(buttons("Saxophone")[0]!.getAttribute("aria-pressed")).toBe("false");
        await click(buttons("Saxophone")[0]!);
        await act(async () => changeScenario(previous => ({ ...previous, users: previous.users.map((person, index) =>
            index === 1 ? { ...person, primaryInstrumentId: 3 } : person) })));
        expect(buttons("Saxophone")[0]!.getAttribute("aria-pressed")).toBe("true");
        expect(buttons("Percussion")[0]!.getAttribute("aria-pressed")).toBe("false");
    });

    it("retains a localized blank instrument as a selectable identity", async () => {
        const scenario = createAttendanceScenario();
        scenario.users[1]!.responses = [3, 3, 3];
        const instruments = scenarioInstruments.map(option => option.name === "Saxophone" ? { ...option, name: "" } : option);
        await act(async () => root.render(React.createElement(Harness, { initial: scenario, instruments })));
        await click(buttons("Trumpet")[0]!);
        const blank = document.querySelector<HTMLButtonElement>('.attendanceInstrument:not([aria-pressed="true"])')!;
        expect(blank.textContent).toBe("");
        await click(blank);
        expect(currentScenario.users[1]!.instrumentId).toBe(2);
    });

    it("keeps a failed comment draft open, prevents duplicate saves and closes after retry", async () => {
        let rejectSave: (reason: Error) => void = () => { throw new Error("Save did not start"); };
        const beforeSave = vi.fn().mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { rejectSave = reject; }));
        await act(async () => root.render(React.createElement(Harness, { initial: createAttendanceScenario(), beforeSave })));
        await click(document.querySelector<HTMLElement>(".ownAttendanceComment")!);
        const editor = document.querySelector("textarea")!;
        editor.value = "Keep this draft";
        await act(async () => Simulate.change(editor));
        await click(buttons("Save")[0]!);
        expect(buttons("Save")[0]!.disabled).toBe(true);
        await click(buttons("Save")[0]!);
        expect(beforeSave).toHaveBeenCalledTimes(1);
        await act(async () => rejectSave(new Error("Revoked")));
        expect(document.querySelector("textarea")!.value).toBe("Keep this draft");
        expect(buttons("Save")[0]!.disabled).toBe(false);
        expect(currentScenario.users[1]!.comment).toBe("");
        await click(buttons("Save")[0]!);
        expect(currentScenario.users[1]!.comment).toBe("Keep this draft");
        expect(document.querySelector('[role="dialog"]')).toBeNull();
    });

    it("keeps available instrument choices when an assigned catalog entry is unreadable", async () => {
        const scenario = createAttendanceScenario();
        scenario.users[1]!.responses = [3, 3, 3];
        await act(async () => root.render(React.createElement(Harness, {
            initial: scenario, instruments: scenarioInstruments.slice(0, 2),
        })));
        expect(buttons("Trumpet")).toHaveLength(1);
        await click(buttons("Trumpet")[0]!);
        expect(buttons("Saxophone")).toHaveLength(1);
        expect(buttons("Percussion")).toHaveLength(0);
        await click(buttons("Saxophone")[0]!);
        expect(currentScenario.users[1]!.instrumentId).toBe(2);
    });

    it("keeps an intentionally blank option caption distinct from the no-answer control", async () => {
        const attendances = scenarioAttendances.map(option => option.buttonCaption === "Probably"
            ? { ...option, buttonCaption: "" } : option);
        await act(async () => root.render(React.createElement(Harness, { initial: createAttendanceScenario(), attendances })));
        expect(buttons("(no answer)")).toHaveLength(2);
        const blankOptions = [...document.querySelectorAll<HTMLButtonElement>(".attendanceAnswer")].filter(button => button.textContent === "");
        expect(blankOptions).toHaveLength(2);
        await click(blankOptions[1]!);
        expect(currentScenario.users[1]!.responses).toEqual([3, 2, "missing"]);
    });

    it.each(["deleted", "inactive"] as const)("shows an existing %s answer but excludes it from new choices", async retirement => {
        const scenario = createAttendanceScenario();
        scenario.users[1]!.responses = [3, 3, 3];
        const attendances = scenarioAttendances.map(option => option.buttonCaption === "Yes"
            ? { ...option, isDeleted: retirement === "deleted", isActive: retirement !== "inactive" } : option);
        await act(async () => root.render(React.createElement(Harness, { initial: scenario, minimal: true, attendances })));
        expect(document.querySelector(".minimalView")?.textContent).toContain("Yes");
        await click(buttons("Yes")[0]!);
        expect(buttons("Yes")).toHaveLength(0);
        expect(buttons("Probably")).toHaveLength(2);
        expect(buttons("(no answer)")).toHaveLength(2);
        await click(buttons("Probably")[0]!);
        expect(currentScenario.users[1]!.responses).toEqual([2, 3, 3]);
        expect(saves.mock.calls.map(([change]) => change.type)).toEqual(["segment"]);
    });

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
