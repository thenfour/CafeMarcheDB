// @vitest-environment jsdom
import React from "react";
import { createRoot, Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Markdown } from "src/core/components/markdown/Markdown";
import { getCmdbWindow } from "src/core/components/dashboardContext/DashboardContext";

let root: Root;

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    delete getCmdbWindow().cmdbDashboardContext;
    document.body.innerHTML = "<div id='root'></div>";
    root = createRoot(document.getElementById("root")!);
});

afterEach(async () => {
    await act(async () => root.unmount());
    delete getCmdbWindow().cmdbDashboardContext;
    document.body.replaceChildren();
    vi.unstubAllGlobals();
});

describe("Markdown on a public custom-link page", () => {
    it("renders formatted text and inline components without dashboard data", async () => {
        await act(async () => root.render(React.createElement(Markdown, { markdown: "**Please read** {{highlight:before continuing}}" })));

        expect(document.querySelector("strong")?.textContent).toBe("Please read");
        expect(document.querySelector(".markdown-class-highlight")).not.toBeNull();
    });

    it("renders inline ABC, ABC blocks, and QR images without dashboard data", async () => {
        await act(async () => root.render(React.createElement(Markdown, { markdown: '{{abc:C D}} {{qr:hello}}\n\n```abc\nC D\n```' })));

        const inlineAbc = document.querySelector<HTMLImageElement>("img.abc-notation-inline");
        const blockAbc = document.querySelector<HTMLImageElement>("img.abc-notation-rendered");
        const qr = document.querySelector<HTMLImageElement>("img.qr-code-inline");
        expect(inlineAbc?.src).toContain(`${window.location.origin}/api/abc/render?notation=`);
        expect(blockAbc?.src).toContain(`${window.location.origin}/api/abc/render?notation=`);
        expect(qr?.src).toContain(`${window.location.origin}/api/qr?`);
    });
});
