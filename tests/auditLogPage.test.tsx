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
vi.mock("@blitzjs/rpc", () => ({ useQuery: () => { throw new Error("Recovery page queried legacy data."); } }));

import AdminLogsPage from "src/pages/backstage/adminLogs";

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

describe("deferred audit page", () => {
    it("explains unavailable browsing and continued recording without querying history", async () => {
        await act(async () => root.render(<AdminLogsPage />));
        expect(container.querySelector("h1")?.textContent).toBe("en: Audit log");
        expect(container.querySelector('[role="alert"]')?.textContent)
            .toContain("Audit browsing and historical record details are temporarily unavailable");
        expect(container.textContent).toContain("Audit recording remains available.");
        expect(container.querySelector('[role="grid"]')).toBeNull();
    });

    it("updates both the title and explanation after a language change", async () => {
        await act(async () => root.render(<AdminLogsPage />));
        language = "fr-BE";
        await act(async () => root.render(<AdminLogsPage />));
        expect(container.querySelector("h1")?.textContent).toBe("fr-BE: Audit log");
        expect(container.querySelector('[role="alert"]')?.textContent).toMatch(/^fr-BE:/);
    });
});
