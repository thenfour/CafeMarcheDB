// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { kStaticLocalizedStringRegistry, type LocalizedPlainStringKey } from "src/locale/shared/staticLocalizedStringRegistry";

vi.mock("src/core/components/dashboard/DashboardLayout", () => ({
    default: ({ title, children }: React.PropsWithChildren<{ title: string }>) => <main><h1>{title}</h1>{children}</main>,
}));
vi.mock("src/locale/components/useLocale", () => ({ useLocale: () => ({
    getPlainString: (key: LocalizedPlainStringKey) => `${language}: ${kStaticLocalizedStringRegistry[key].defaultValue}`,
}) }));
vi.mock("@blitzjs/rpc", () => ({
    useQuery: () => { throw new Error("Recovery page queried import data."); },
    useMutation: () => { throw new Error("Recovery page mounted an import save."); },
}));

import ImportPage from "src/pages/backstage/eventImport";

let language: string;
let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    language = "en";
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe("event import recovery page", () => {
    it("explains unavailability without preview requests, draft inputs or save controls", async () => {
        await act(async () => root.render(<ImportPage />));
        expect(container.querySelector("h1")?.textContent).toBe("en: Import events");
        expect(container.querySelector('[role="alert"]')?.textContent)
            .toContain("Event import is temporarily unavailable while band support is restored.");
        expect(container.querySelectorAll("form, textarea, input, button")).toHaveLength(0);
    });

    it("updates its title and explanation after a language change", async () => {
        await act(async () => root.render(<ImportPage />));
        language = "fr-BE";
        await act(async () => root.render(<ImportPage />));
        expect(container.querySelector("h1")?.textContent).toBe("fr-BE: Import events");
        expect(container.querySelector('[role="alert"]')?.textContent).toMatch(/^fr-BE:/);
    });
});
