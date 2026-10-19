// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parsePublicId } from "shared/publicId";
import * as DB3Client from "src/core/db3/DB3Client";
import * as BlitzRpc from "@blitzjs/rpc";
import { RoleDesignationControls } from "src/core/components/user/RoleAdministration";
import type { SetRoleDesignation } from "src/auth/roleDesignations";
import { kStaticLocalizedStringRegistry, type LocalizedPlainStringKey } from "src/locale/shared/staticLocalizedStringRegistry";

vi.mock("src/auth/mutations/setRoleDesignation", () => ({ default: vi.fn() }));
vi.mock("@blitzjs/rpc", async () => ({ ...await vi.importActual<typeof BlitzRpc>("@blitzjs/rpc"), useMutation: () => [mutate] }));
vi.mock("src/core/db3/DB3Client", async () => ({ ...await vi.importActual<typeof DB3Client>("src/core/db3/DB3Client"),
    useDb3Query: ({ view }: { view: { viewID: string } }) => ({ items: view.viewID === "GlobalRole_Editor" ? globalRoles : bandRoles, refetch }) }));
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({ useDashboardContext: () => ({ refreshCachedData: refreshDashboard }) }));
vi.mock("src/locale/components/PresentationProvider", () => ({ usePresentation: () => ({ invalidate }) }));
vi.mock("src/locale/components/useLocale", () => ({ useLocale: () => ({ getPlainString: (key: LocalizedPlainStringKey) => kStaticLocalizedStringRegistry[key].defaultValue }) }));

const mutate = vi.fn(async (edit: SetRoleDesignation) => edit);
const refetch = vi.fn(async () => {});
const refreshDashboard = vi.fn(async () => {});
const invalidate = vi.fn(async () => {});
const globalRoles = [
    { publicId: "GlobalRole000001", name: { value: "Sysadmin" }, isSysAdminRole: true, isPublicRole: false, isRoleForNewUsers: false },
    { publicId: "GlobalRole000002", name: { value: "Global Public" }, isSysAdminRole: false, isPublicRole: true, isRoleForNewUsers: false },
    { publicId: "GlobalRole000003", name: { value: "Account" }, isSysAdminRole: false, isPublicRole: false, isRoleForNewUsers: true },
];
let bandRoles: Array<{ publicId: string; name: { value: string }; isPublicRole: boolean; isRoleForNewUsers: boolean }>;
let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.clearAllMocks();
    mutate.mockImplementation(async edit => edit);
    refetch.mockResolvedValue(undefined); refreshDashboard.mockResolvedValue(undefined); invalidate.mockResolvedValue(undefined);
    bandRoles = [{ publicId: "BandRole00000001", name: { value: "Public" }, isPublicRole: true, isRoleForNewUsers: true },
        { publicId: "BandRole00000002", name: { value: "Membres" }, isPublicRole: false, isRoleForNewUsers: false }];
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks();
});
async function renderControl() {
    await act(async () => root.render(<RoleDesignationControls />));
}
async function selectNewMembers() {
    const control = document.querySelector<HTMLElement>('[aria-labelledby="role-designation-band-newUsers-label"]')!;
    await act(async () => control.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })));
    await act(async () => document.querySelector<HTMLElement>('[data-value="BandRole00000002"]')!.click());
}

describe("role designation controls", () => {
    it.each(["public", "newUsers"] as const)("writes the global %s designation independently of its band counterpart", async designation => {
        await renderControl();
        const control = document.querySelector<HTMLElement>(`[aria-labelledby="role-designation-global-${designation}-label"]`)!;
        await act(async () => control.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })));
        await act(async () => document.querySelector<HTMLElement>('[data-value="GlobalRole000001"]')!.click());
        expect(mutate).toHaveBeenCalledWith({ scope: "global", designation, roleId: "GlobalRole000001" });
        expect(document.querySelector('[aria-labelledby="role-designation-band-public-label"]')?.textContent).toBe("Public");
    });
    it("writes the band definition identity and refreshes both editors and authorization", async () => {
        await renderControl(); await selectNewMembers();
        expect(mutate).toHaveBeenCalledWith({ scope: "band", designation: "newUsers", roleId: "BandRole00000002" });
        expect(refetch).toHaveBeenCalledTimes(2); expect(refreshDashboard).toHaveBeenCalledOnce(); expect(invalidate).toHaveBeenCalledOnce();
    });
    it("retains a rejected selection for retry instead of presenting it as committed", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        mutate.mockRejectedValueOnce(new Error("Revoked authority"));
        await renderControl(); await selectNewMembers();
        expect(document.querySelector('[aria-labelledby="role-designation-band-newUsers-label"]')?.textContent).toBe("Membres");
        expect(document.querySelector('[role="alert"]')?.textContent).toContain("Your selection is retained");
        expect(refetch).not.toHaveBeenCalled();
        await act(async () => [...document.querySelectorAll("button")].find(element => element.textContent === "Retry role change")!.click());
        expect(mutate).toHaveBeenCalledTimes(2);
    });
    it("blocks overlap and ignores the result of a request after its scope is unmounted", async () => {
        let resolve!: (edit: SetRoleDesignation) => void;
        mutate.mockImplementationOnce(() => new Promise<SetRoleDesignation>(done => { resolve = done; }));
        await renderControl(); await selectNewMembers();
        expect([...document.querySelectorAll('[aria-haspopup="listbox"]')].every(element => element.getAttribute("aria-disabled") === "true")).toBe(true);
        await act(async () => root.unmount());
        await act(async () => resolve({ scope: "band", designation: "newUsers", roleId: parsePublicId<"BandRole">("BandRole00000002") }));
        expect(refetch).not.toHaveBeenCalled(); expect(invalidate).not.toHaveBeenCalled();
    });
    it("makes missing singleton assignments explicit and repairable", async () => {
        bandRoles = bandRoles.map(role => ({ ...role, isRoleForNewUsers: false }));
        await renderControl();
        expect(document.body.textContent).toContain("repair the missing or duplicate assignment");
        await selectNewMembers(); expect(mutate).toHaveBeenCalledOnce();
    });
});
