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

import EditEvents from "src/pages/backstage/editEvents";
import EditSegments from "src/pages/backstage/editEventSegments";
import Agenda from "src/pages/backstage/frontpageEvents";
import EditSongs from "src/pages/backstage/editSongs";
import Examples from "src/pages/dev/gallery";
import GridExamples from "src/pages/dev/test2";

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

// Restored File, gallery and Wiki workflows have their own active editor/read specifications.
const pages = [EditEvents, EditSegments, Agenda, EditSongs, Examples, GridExamples];
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

});
