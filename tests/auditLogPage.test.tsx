// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { kStaticLocalizedStringRegistry, type LocalizedPlainStringKey } from "src/locale/shared/staticLocalizedStringRegistry";
import type { DB3ReferenceStore } from "src/core/db3/shared/core/db3Hydration";
import { hydrateView } from "src/core/db3/shared/core/db3View";
import { auditLogView } from "src/core/db3/shared/audit/auditViews";

vi.mock("src/core/components/dashboard/DashboardLayout", () => ({ default: ({ title, children }: React.PropsWithChildren<{ title: string }>) => <main><h1>{title}</h1>{children}</main> }));
vi.mock("src/locale/components/useLocale", () => ({ useLocale: () => ({ getPlainString: (key: LocalizedPlainStringKey) => `${language}: ${kStaticLocalizedStringRegistry[key].defaultValue}` }) }));
vi.mock("src/core/db3/components/useDB3Context", () => ({ useDB3QueryContext: () => ({ bandPublicId: "AuditBand0000001", routeLocale: language, browserLanguages: ["nl-BE", "en-US"] }) }));
vi.mock("src/locale/components/Localized", () => ({ Localized: ({ id }: { id: string }) => <aside data-help={id} /> }));
vi.mock("@blitzjs/rpc", async () => ({ ...await vi.importActual<typeof import("@blitzjs/rpc")>("@blitzjs/rpc"),
    useQuery: (_query: unknown, input: unknown) => { queryInput = input; return [filters, {}]; },
}));
vi.mock("src/core/db3/queries/getDistinctChangeFilterValues", () => ({ default: vi.fn() }));
vi.mock("src/core/db3/queries/getAdminLogItemInfo", () => ({ default: vi.fn() }));
vi.mock("src/core/db3/components/db3DataGrid", () => ({ DB3EditGrid: (props: GridProps) => { grid = props; return <div role="grid" />; } }));

import AdminLogsPage from "src/pages/backstage/adminLogs";

interface GridProps { tableParams: { tableNames: string[]; userIds: string[] }; readOnly: boolean; referenceProvider: DB3ReferenceStore }
let language: string;
let queryInput: unknown;
let grid: GridProps;
const filters = { tableNames: [{ tableName: "Event" }, { tableName: "Song" }], users: [
    { publicId: "AuditActor000001", name: "Alpha", email: "alpha@test.invalid" },
    { publicId: "AuditActor000002", name: "Beta", email: "beta@test.invalid" },
] };
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    language = "en";
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
async function enter(label: string, value: string) {
    const input = container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
    await act(async () => {
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!.call(input, value);
        input.dispatchEvent(new window.Event("input", { bubbles: true }));
    });
}
async function clickChoice(text: string) {
    const chip = [...container.querySelectorAll<HTMLElement>(".CMChip")].find(node => node.textContent === text)!;
    await act(async () => chip.click());
}
describe("audit log browser", () => {
    it("restores a read-only grid, registered help and full locale preferences", async () => {
        await act(async () => root.render(<AdminLogsPage />));
        expect(container.querySelector("h1")?.textContent).toBe("en: Audit log");
        expect(container.querySelector('[data-help="AdminLogsPage_markdown"]')).not.toBeNull();
        expect(container.querySelector('[role="grid"]')).not.toBeNull();
        expect(grid.readOnly).toBe(true);
        expect(hydrateView(auditLogView, auditLogView.parseDto({ id: 1, action: "update", table: "Event", recordId: 9,
            context: "fixture", operationId: "operation", changedAt: new Date(), oldValues: null, newValues: null,
            userId: 10,
        }), grid.referenceProvider).userId).toBe(10);
        expect(queryInput).toMatchObject({ browserLanguages: ["nl-BE", "en-US"], routeLocale: "en" });
    });
    it("keeps selected chips visible while narrowing available choices", async () => {
        await act(async () => root.render(<AdminLogsPage />));
        await clickChoice("Event");
        await clickChoice("Alpha");
        await enter("en: Filter tables", "Song");
        await enter("en: Filter users", "beta@test.invalid");
        expect(container.textContent).toContain("Event");
        expect(container.textContent).toContain("Alpha");
        expect(grid.tableParams).toEqual({ tableNames: ["Event"], userIds: ["AuditActor000001"] });
        await clickChoice("Event");
        await clickChoice("Alpha");
        expect(container.textContent).not.toContain("Event");
        expect(container.textContent).not.toContain("Alpha");
        expect(grid.tableParams).toEqual({ tableNames: [], userIds: [] });
    });
    it("updates chrome and query preferences on a locale change", async () => {
        await act(async () => root.render(<AdminLogsPage />));
        language = "fr-BE";
        await act(async () => root.render(<AdminLogsPage />));
        expect(container.querySelector("h1")?.textContent).toBe("fr-BE: Audit log");
        expect(queryInput).toMatchObject({ routeLocale: "fr-BE" });
    });
});
