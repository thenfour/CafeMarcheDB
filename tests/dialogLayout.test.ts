// @vitest-environment jsdom
import React from "react";
import { createRoot, Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CMDialog, useDialogAfterMenuClose } from "src/core/components/CMDialog";

class TestVisualViewport extends EventTarget {
    offsetTop = 0;
    offsetLeft = 0;
    width = 390;
    height = 700;
}

let root: Root;
let viewport: TestVisualViewport;
const originalViewport = Object.getOwnPropertyDescriptor(window, "visualViewport");
const originalActEnvironment = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT");

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    document.body.innerHTML = "<div id='root'></div>";
    viewport = new TestVisualViewport();
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
    root = createRoot(document.getElementById("root")!);
});

afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
    if (originalViewport) Object.defineProperty(window, "visualViewport", originalViewport);
    else Reflect.deleteProperty(window, "visualViewport");
    if (originalActEnvironment) Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", originalActEnvironment);
    else Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});

const renderDialog = async () => {
    await act(async () => root.render(React.createElement(CMDialog, {
        open: true,
        title: "Dialog title",
        actions: React.createElement("button", null, "Save"),
    }, React.createElement("div", null, "Scrollable content"))));
};

describe("CMDialog layout", () => {
    it("renders fixed header and actions as siblings of the scrolling content", async () => {
        await renderDialog();

        const paper = document.querySelector(".MuiDialog-paper")!;
        const header = paper.querySelector(":scope > .CMDialogHeader");
        const content = paper.querySelector(":scope > .CMDialogContent");
        const actions = paper.querySelector(":scope > .CMDialogActions");

        expect(header).not.toBeNull();
        expect(content?.textContent).toContain("Scrollable content");
        expect(actions?.textContent).toContain("Save");
        expect(content?.contains(actions)).toBe(false);
        expect(content?.nextElementSibling).toBe(actions);
    });

    it("tracks visual viewport size and position changes while open", async () => {
        await renderDialog();
        const dialogRoot = document.querySelector<HTMLElement>(".MuiDialog-root")!;

        expect(dialogRoot.style.getPropertyValue("--cm-dialog-viewport-width")).toBe("390px");
        expect(dialogRoot.style.getPropertyValue("--cm-dialog-viewport-height")).toBe("700px");

        viewport.offsetTop = 18;
        viewport.height = 410;
        await act(async () => viewport.dispatchEvent(new Event("resize")));

        expect(dialogRoot.style.getPropertyValue("--cm-dialog-viewport-top")).toBe("18px");
        expect(dialogRoot.style.getPropertyValue("--cm-dialog-viewport-height")).toBe("410px");
    });

    it("waits for a launching menu to exit before opening its dialog", async () => {
        const Harness = () => {
            const dialog = useDialogAfterMenuClose();
            const [menuOpen, setMenuOpen] = React.useState(true);
            return React.createElement(React.Fragment, null,
                React.createElement("button", { id: "request", onClick: () => dialog.requestOpen(() => setMenuOpen(false)) }, "Request"),
                React.createElement("button", { id: "exited", onClick: dialog.onMenuExited }, "Menu exited"),
                React.createElement("output", { id: "state" }, `${menuOpen}:${dialog.dialogOpen}`),
            );
        };

        await act(async () => root.render(React.createElement(Harness)));
        expect(document.querySelector("#state")?.textContent).toBe("true:false");

        await act(async () => document.querySelector<HTMLButtonElement>("#request")!.click());
        expect(document.querySelector("#state")?.textContent).toBe("false:false");

        await act(async () => document.querySelector<HTMLButtonElement>("#exited")!.click());
        expect(document.querySelector("#state")?.textContent).toBe("false:true");
    });
});
