// @vitest-environment jsdom
import React from "react";
import { createRoot, Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CMDialog, useDialogAfterMenuClose } from "src/core/components/CMDialog";
import {
    ApplicationFrameProvider,
    useApplicationFrame,
    useApplicationFrameBackgroundRef,
} from "src/core/components/dashboard/ApplicationFrameContext";

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
    vi.restoreAllMocks();
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

    it("uses the application frame while leaving its media region interactive", async () => {
        vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
            if (this.hasAttribute("data-application-dialog-host")) {
                return {
                    x: 0,
                    y: 18,
                    top: 18,
                    right: 390,
                    bottom: 618,
                    left: 0,
                    width: 390,
                    height: 600,
                    toJSON: () => undefined,
                };
            }
            return {
                x: 0,
                y: 0,
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                width: 0,
                height: 0,
                toJSON: () => undefined,
            };
        });

        const FrameContents = () => {
            const frame = useApplicationFrame()!;
            const backgroundRef = useApplicationFrameBackgroundRef();
            const [dialogOpen, setDialogOpen] = React.useState(true);
            return React.createElement(React.Fragment, null,
                React.createElement("div", { id: "application-background", ref: backgroundRef }, "Page"),
                React.createElement("div", { id: "dialog-host", ref: frame.dialogHostRef, "data-application-dialog-host": true }),
                React.createElement("button", { id: "media-control" }, "Pause"),
                React.createElement("output", { id: "dialog-state" }, String(frame.hasOpenDialogs)),
                React.createElement(CMDialog, {
                    open: dialogOpen,
                    title: "Frame dialog",
                    transitionDuration: 0,
                    actions: React.createElement("button", { id: "close-frame-dialog", onClick: () => setDialogOpen(false) }, "Save"),
                }, React.createElement("div", null, "Content")),
            );
        };

        await act(async () => root.render(React.createElement(
            ApplicationFrameProvider,
            null,
            React.createElement(FrameContents),
        )));

        const host = document.querySelector("#dialog-host")!;
        const dialogRoot = host.querySelector<HTMLElement>(".MuiDialog-root")!;
        const background = document.querySelector("#application-background")!;
        const mediaControl = document.querySelector<HTMLButtonElement>("#media-control")!;

        expect(dialogRoot).not.toBeNull();
        expect(dialogRoot.parentElement).toBe(host);
        expect(window.getComputedStyle(dialogRoot).position).toBe("absolute");
        expect(window.getComputedStyle(dialogRoot.querySelector(".MuiBackdrop-root")!).position).toBe("absolute");
        expect(dialogRoot.style.getPropertyValue("--cm-dialog-viewport-top")).toBe("0px");
        expect(dialogRoot.style.getPropertyValue("--cm-dialog-viewport-height")).toBe("600px");
        expect(background.hasAttribute("inert")).toBe(true);
        expect(document.querySelector("#dialog-state")?.textContent).toBe("true");

        await act(async () => mediaControl.focus());
        expect(document.activeElement).toBe(mediaControl);

        await act(async () => {
            document.querySelector<HTMLButtonElement>("#close-frame-dialog")!.click();
            await new Promise(resolve => setTimeout(resolve, 0));
        });
        expect(document.querySelector("#dialog-state")?.textContent).toBe("false");
        expect(background.hasAttribute("inert")).toBe(false);
    });
});
