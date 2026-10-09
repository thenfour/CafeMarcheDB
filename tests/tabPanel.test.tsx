// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CMTab, CMTabPanel } from "src/core/components/TabPanel";

type TabId = React.ComponentProps<typeof CMTabPanel>["selectedTabId"];
let container: HTMLDivElement;
let root: Root;

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

function ControlledTabs({ initialTab }: { initialTab: TabId }) {
    const [selectedTab, setSelectedTab] = React.useState(initialTab);
    return <CMTabPanel selectedTabId={selectedTab} handleTabChange={(_event, tab) => setSelectedTab(tab)}>
        <CMTab thisTabId="info" summaryTitle="Info">Event info</CMTab>
        <CMTab thisTabId="setlists" summaryTitle="Setlists" canBeDefault>Event setlists</CMTab>
        <CMTab thisTabId="frontpage" summaryTitle="Frontpage" enabled={false}>Event frontpage</CMTab>
    </CMTabPanel>;
}

describe("tab panel selection", () => {
    it.each([undefined, null, "-repetitie-2", "frontpage"])("selects a default for %s without updating the parent during render", async initialTab => {
        const errors = vi.spyOn(console, "error").mockImplementation(() => {});
        await act(async () => root.render(<ControlledTabs initialTab={initialTab} />));
        expect(container.querySelector(".CMTabExpanded")?.textContent).toBe("Event setlists");
        expect(container.querySelector(".selected")?.textContent).toBe("Setlists");
        expect(errors.mock.calls).toEqual([]);
    });

    it("notifies the parent after the default content commits", async () => {
        const handleTabChange = vi.fn(() => {
            expect(container.querySelector(".CMTabExpanded")?.textContent).toBe("Event setlists");
        });
        await act(async () => root.render(
            <CMTabPanel selectedTabId="missing" handleTabChange={handleTabChange}>
                <CMTab thisTabId="setlists" canBeDefault>Event setlists</CMTab>
            </CMTabPanel>,
        ));
        expect(handleTabChange).toHaveBeenCalledOnce();
        expect(handleTabChange).toHaveBeenCalledWith(undefined, "setlists");
    });

    it("honors the requested tab and allows switching by clicking a header", async () => {
        await act(async () => root.render(<ControlledTabs initialTab="info" />));
        expect(container.querySelector(".CMTabExpanded")?.textContent).toBe("Event info");
        await act(async () => container.querySelectorAll(".CMTabHeaderRoot")[1]!.dispatchEvent(new window.MouseEvent("click", { bubbles: true })));
        expect(container.querySelector(".CMTabExpanded")?.textContent).toBe("Event setlists");
        expect(container.querySelectorAll(".CMTabHeaderRoot")).toHaveLength(2);
    });

    it("shows the first enabled tab when no default is nominated", async () => {
        const handleTabChange = vi.fn();
        await act(async () => root.render(
            <CMTabPanel selectedTabId="missing" handleTabChange={handleTabChange}>
                <CMTab thisTabId="disabled" enabled={false}>Disabled</CMTab>
                <CMTab thisTabId="info">Event info</CMTab>
            </CMTabPanel>,
        ));
        expect(container.querySelector(".CMTabExpanded")?.textContent).toBe("Event info");
        expect(handleTabChange).not.toHaveBeenCalled();
    });

    it("renders no content when all tabs are disabled", async () => {
        const handleTabChange = vi.fn();
        await act(async () => root.render(
            <CMTabPanel selectedTabId="info" handleTabChange={handleTabChange}>
                <CMTab thisTabId="info" canBeDefault enabled={false}>Event info</CMTab>
            </CMTabPanel>,
        ));
        expect(container.querySelector(".CMTabExpanded")).toBeNull();
        expect(handleTabChange).not.toHaveBeenCalled();
    });
});
