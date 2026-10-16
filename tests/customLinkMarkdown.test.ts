// @vitest-environment jsdom
import { createTestRouter } from "./support/routing";
import { parsePortalPath } from "src/route/portalRouting";
vi.mock("src/route/useCmdbRouter", () => ({ useCmdbRouter: () => createTestRouter({ baseUri: window.location.origin, hosting: { kind: "multiBand" }, requestPath }) }));
import React from "react";
import { createRoot, Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Markdown } from "src/core/components/markdown/Markdown";
import { getCmdbWindow } from "src/core/components/dashboardContext/DashboardContext";
import { parsePublicId } from "shared/publicId";

let requestPath = parsePortalPath("/backstage", { kind: "multiBand" });
let root: Root;

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    requestPath = parsePortalPath("/backstage", { kind: "multiBand" });
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
    it("retains the app's portal selection when the public page has no dashboard provider", async () => {
        requestPath = parsePortalPath("/fr-BE/b/PublicationBand1/MyPage", { kind: "multiBand" });
        // Routing is available without dashboard data.
        await act(async () => root.render(React.createElement(Markdown, { markdown: "[Wiki](/backstage/wiki/welcome)" })));
        expect(document.querySelector(".renderedContent a")?.getAttribute("href"))
            .toBe("/fr-BE/b/PublicationBand1/backstage/wiki/welcome");
    });
    it("keeps explicit publication band/locale on internal links, mentions and dimensioned File images", async () => {
        const bandPublicId = parsePublicId<"Band">("PublicationBand1");
        const markdown = "[document](/api/files/download/photo.png) [page](/backstage/wiki/welcome) [[welcome|Wiki]] [[event:Event00000000001|Concert]] ![photo](/api/files/download/photo.png?240)";
        await act(async () => root.render(React.createElement(Markdown, {
            markdown, presentation: { bandPublicId, routeLocale: "nl-NL" },
        })));
        for (const anchor of document.querySelectorAll<HTMLAnchorElement>(".renderedContent a")) {
            expect(new URL(anchor.href).pathname).toContain(`/nl-NL/b/${bandPublicId}/`);
            expect(new URL(anchor.href).searchParams.has("bandPublicId")).toBe(false);
        }
        expect(document.querySelectorAll(".renderedContent a")).toHaveLength(4);
        const image = document.querySelector<HTMLImageElement>(".renderedContent img");
        expect(image?.src).toContain("/nl-NL/b/PublicationBand1/api/files/download/");
        expect(image?.style.maxWidth).toBe("240px");
    });
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
