// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { kStaticLocalizedStringRegistry, type LocalizedPlainStringKey } from "src/locale/shared/staticLocalizedStringRegistry";

vi.mock("src/core/components/dashboard/DashboardLayout", () => ({
    default: ({ title, children }: React.PropsWithChildren<{ title: string }>) => <main><h1>{title}</h1>{children}</main>,
}));
vi.mock("next/head", () => ({ default: () => null }));
vi.mock("next/link", () => ({ default: ({ href, children }: React.PropsWithChildren<{ href: string }>) => <a href={href}>{children}</a> }));
vi.mock("src/locale/components/useLocale", () => ({ useLocale: () => ({
    getPlainString: (key: LocalizedPlainStringKey) => `${language}: ${kStaticLocalizedStringRegistry[key].defaultValue}`,
}) }));
vi.mock("@blitzjs/rpc", () => ({
    useQuery: () => { throw new Error("Recovery page mounted a data reader."); },
    useMutation: () => { throw new Error("Recovery page mounted an editor."); },
}));

import Events from "src/pages/backstage/events";
import Event from "src/pages/backstage/event/[...id_slug_tab]";
import EditEvents from "src/pages/backstage/editEvents";
import EditSegments from "src/pages/backstage/editEventSegments";
import Agenda from "src/pages/backstage/frontpageEvents";
import Songs from "src/pages/backstage/songs";
import Song from "src/pages/backstage/song/[...id_slug_tab]";
import EditSongs from "src/pages/backstage/editSongs";
import EditCredits from "src/pages/backstage/editSongCredits";
import Files from "src/pages/backstage/files";
import File from "src/pages/backstage/file/[...id_slug_tab]";
import EditFiles from "src/pages/backstage/editFiles";
import Gallery from "src/pages/backstage/frontpagegallery";
import EditGallery from "src/pages/backstage/editFrontpageGalleryItems";
import Examples from "src/pages/backstage/gallery";
import GridExamples from "src/pages/backstage/test";
import PublicIndex from "src/pages/index";
import WikiSearch from "src/pages/backstage/wikiPages";

let language = "en-US";
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    language = "en-US";
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

const pages = [Events, Event, EditEvents, EditSegments, Agenda, Songs, Song, EditSongs, EditCredits, Files, File, EditFiles, Gallery, EditGallery, Examples, GridExamples, WikiSearch];
describe("reachable deferred application pages", () => {
    it.each(pages.map((Page, index) => ({ Page, index })))("renders page $index without readers/editors and updates its localized notice", async ({ Page }) => {
        await act(async () => root.render(<Page />));
        expect(container.querySelector('[role="alert"]')?.textContent).toContain("temporarily unavailable");
        expect(container.querySelectorAll("input, button, textarea, form")).toHaveLength(0);
        language = "fr-BE";
        await act(async () => root.render(<Page />));
        expect(container.querySelector("h1")?.textContent).toMatch(/^fr-BE:/);
        expect(container.querySelector('[role="alert"]')?.textContent).toMatch(/^fr-BE:/);
    });

    it("renders the public root without its feed request and retains a usable login destination", async () => {
        await act(async () => root.render(<PublicIndex />));
        expect(container.querySelector('[role="status"]')?.textContent).toContain("temporarily unavailable");
        expect(container.querySelector("a")?.getAttribute("href")).toBe("/backstage");
    });
});
