// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CMButton } from "src/core/components/CMCoreComponents2";
import { Markdown } from "src/core/components/markdown/Markdown";
import { Localized } from "src/locale/components/Localized";
import type { LocalizedStringIdAndParams } from "src/locale/shared/localizationCatalog";
import { kStaticLocalizedStringRegistry } from "src/locale/shared/staticLocalizedStringRegistry";
import { parsePortalPath } from "src/route/portalRouting";
import { createTestRouter } from "./support/routing";

vi.mock("src/core/db3/components/IconMap", () => ({ gCharMap: {}, gIconMap: {} }));
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({ useDashboardContext: vi.fn() }));
vi.mock("src/route/useCmdbRouter", () => ({
    useCmdbRouter: () => router,
}));
vi.mock("src/locale/components/useLocale", () => ({
    useLocale: () => ({ getString: ({ id }: LocalizedStringIdAndParams) => ({
        value: kStaticLocalizedStringRegistry[id].format === "markdown" ? "**Help**" : kStaticLocalizedStringRegistry[id].defaultValue,
        format: kStaticLocalizedStringRegistry[id].format,
    }) }),
}));

const hosting = { kind: "multiBand" } as const;
const router = createTestRouter({ baseUri: "https://test", hosting, requestPath: parsePortalPath("/en-US/platform", hosting) });
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

async function render(element: React.ReactElement) {
    await act(async () => root.render(element));
}

describe("localized DOM roots", () => {
    it("annotates the existing Markdown container without adding another wrapper", async () => {
        await render(<Localized id="GlobalWikiPage_Markdown" className="help" />);
        const markdown = container.querySelector(".markdown.help")!;
        expect(container.firstElementChild).toBe(markdown);
        expect(markdown.getAttribute("data-localized-string-key")).toBe("GlobalWikiPage_Markdown");
        expect(markdown.querySelector(".extraContainerDiv")).not.toBeNull();
        expect(container.querySelectorAll("[data-localized-string-key]")).toHaveLength(1);
        await render(<Markdown markdown="**Help**" id="content" containerProps={{ "data-purpose": "help", title: "Help content" }} />);
        expect(container.querySelector(".markdown")?.getAttribute("data-purpose")).toBe("help");
        expect(container.querySelector(".markdown")?.getAttribute("title")).toBe("Help content");
        expect(container.querySelector("#content strong")?.textContent).toBe("Help");
    });

    it("forwards annotations and other data attributes through CMButton", async () => {
        await render(<Localized id="common.action.ok" component={CMButton} enabled data-purpose="confirm" />);
        const button = container.querySelector("button")!;
        expect(button.textContent).toBe("OK");
        expect(button.getAttribute("data-localized-string-key")).toBe("common.action.ok");
        expect(button.getAttribute("data-purpose")).toBe("confirm");
        expect(button.hasAttribute("enabled")).toBe(false);
        await render(<CMButton type="submit" value="Send" data-purpose="submit" />);
        expect(container.querySelector("input")?.getAttribute("data-purpose")).toBe("submit");
    });
});
