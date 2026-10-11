// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parsePublicId } from "shared/publicId";
import { AccountRoleControl, AccountRoleAction } from "src/core/components/user/AccountRoleControl";
import { kStaticLocalizedStringRegistry, type LocalizedPlainStringKey } from "src/locale/shared/staticLocalizedStringRegistry";
import { globalRoleListView } from "src/core/db3/shared/entities/user/roleViews";

vi.mock("src/auth/mutations/assignUserRole", () => ({ default: vi.fn() }));
vi.mock("src/auth/queries/getUserManagementCapabilities", () => ({ default: vi.fn() }));
vi.mock("@blitzjs/rpc", () => ({ useMutation: () => [invoke], useQuery: (_query: unknown, args: unknown) => {
    queries.push(args);
    return [capabilities, { refetch: refresh }];
} }));
vi.mock("src/core/db3/components/useDB3Context", () => ({ useDB3QueryContext: () => ({ bandPublicId: "Band000000000001", routeLocale: "fr-BE", browserLanguages: ["nl-BE"] }) }));
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({ useDashboardContext: () => ({ refreshCachedData: refreshDashboard }) }));
vi.mock("src/locale/components/PresentationProvider", () => ({ usePresentation: () => ({ invalidate: invalidate }) }));
vi.mock("src/locale/components/useLocale", () => ({ useLocale: () => ({ getPlainString: (key: LocalizedPlainStringKey) => kStaticLocalizedStringRegistry[key].defaultValue }) }));

const userId = parsePublicId<"User">("Account000000001");
const roles = ["Gestionnaires", "Lecteurs"].map((name, index) => globalRoleListView.parseDto({
    publicId: `GlobalRole00000${index + 1}`, name, description: null, color: null, sortOrder: index,
    nameResolution: { value: name, localeTag: "fr-BE", scope: "global", source: "stored", reason: "exact", requestedTag: "fr-BE" }, nameStringPublicId: null,
    descriptionResolution: { value: null, localeTag: null, scope: null, source: "missing", reason: "missing", requestedTag: null }, descriptionStringPublicId: null,
}));
const invoke = vi.fn(async (_input: unknown) => ({ userId, roleId: roles[1]!.publicId, continuityWarnings: [] }));
const refresh = vi.fn(async () => {});
const refreshDashboard = vi.fn(async () => {});
const invalidate = vi.fn(async () => {});
const queries: unknown[] = [];
let root: Root;
let container: HTMLDivElement;
let capabilities: React.ComponentProps<typeof AccountRoleControl>["capabilities"];

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.clearAllMocks();
    queries.length = 0;
    capabilities = { canAssignRole: true, canMerge: false, canManageSignInMethods: false, canCorrectEmail: false,
        canDeactivate: false, canReactivate: false, canSetSysAdmin: false, canResetPassword: false, canImpersonate: false,
        deactivationContinuityWarnings: [], mergedIntoUserId: null, currentRoleId: roles[0]!.publicId, assignableRoles: roles };
    invoke.mockResolvedValue({ userId, roleId: roles[1]!.publicId, continuityWarnings: [] });
    refresh.mockResolvedValue(undefined); refreshDashboard.mockResolvedValue(undefined); invalidate.mockResolvedValue(undefined);
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks();
});

function button(text: string): HTMLButtonElement {
    const result = [...document.querySelectorAll("button")].find(element => element.textContent === text);
    if (!result) {
        throw new Error(`Missing button ${text}`);
    }
    return result;
}
async function renderControl() {
    await act(async () => root.render(<AccountRoleControl userId={userId} capabilities={capabilities} onChanged={refresh} />));
}
async function openAndChooseRole() {
    await renderControl();
    await act(async () => button("Change global account role").click());
    const select = document.querySelector<HTMLElement>('[aria-haspopup="listbox"]')!;
    await act(async () => select.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })));
    await act(async () => document.querySelector<HTMLElement>(`[data-value="${roles[1]!.publicId}"]`)!.click());
}

describe("global account role control", () => {
    it("saves the chosen public identity with explicit continuity policy and refreshes authorization", async () => {
        await openAndChooseRole();
        await act(async () => button("Save role").click());
        expect(invoke).toHaveBeenCalledWith({ userId, roleId: roles[1]!.publicId, acknowledgeContinuityRisk: false });
        expect(refresh).toHaveBeenCalledOnce(); expect(refreshDashboard).toHaveBeenCalledOnce(); expect(invalidate).toHaveBeenCalledOnce();
        await act(async () => new Promise(done => setTimeout(done, 300)));
        expect(document.querySelector('[role="dialog"]')).toBeNull();
    });
    it("requires an explicit acknowledgement before retrying a continuity rejection", async () => {
        invoke.mockRejectedValueOnce(new Error("CONTINUITY_ACKNOWLEDGEMENT_REQUIRED:manage_global_users"));
        await openAndChooseRole();
        await act(async () => button("Save role").click());
        expect(button("Save role").disabled).toBe(true);
        expect(document.querySelector('[role="dialog"]')?.textContent).toContain("manage_global_users");
        expect(refresh).not.toHaveBeenCalled();
        await act(async () => document.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
        await act(async () => button("Save role").click());
        expect(invoke).toHaveBeenLastCalledWith({ userId, roleId: roles[1]!.publicId, acknowledgeContinuityRisk: true });
    });
    it("retains failed drafts and allows a deliberate retry", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        invoke.mockRejectedValueOnce(new Error("Denied"));
        await openAndChooseRole(); await act(async () => button("Save role").click());
        expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Your selection is retained");
        expect(document.querySelector<HTMLInputElement>('input[value="' + roles[1]!.publicId + '"]')).not.toBeNull();
        await act(async () => button("Save role").click());
        expect(invoke).toHaveBeenCalledTimes(2);
    });
    it("distinguishes a committed write from failed refresh", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        refresh.mockRejectedValueOnce(new Error("Refresh failed"));
        await openAndChooseRole(); await act(async () => button("Save role").click());
        expect(document.body.textContent).toContain("The role was saved, but refreshing failed");
        expect(invoke).toHaveBeenCalledOnce();
    });
    it("blocks overlapping writes and ignores a reply after unmount", async () => {
        let resolve!: (value: Awaited<ReturnType<typeof invoke>>) => void;
        invoke.mockImplementationOnce(() => new Promise<Awaited<ReturnType<typeof invoke>>>(done => { resolve = done; }));
        await openAndChooseRole(); await act(async () => button("Save role").click());
        expect(button("Save role").disabled).toBe(true); expect(button("Cancel").disabled).toBe(true);
        await act(async () => button("Save role").click()); expect(invoke).toHaveBeenCalledOnce();
        await act(async () => root.unmount());
        await act(async () => resolve({ userId, roleId: roles[1]!.publicId, continuityWarnings: [] }));
        expect(refresh).not.toHaveBeenCalled(); expect(invalidate).not.toHaveBeenCalled();
    });
    it("disables saving when current capabilities are revoked", async () => {
        await openAndChooseRole(); capabilities = { ...capabilities, canAssignRole: false }; await renderControl();
        expect(button("Save role").disabled).toBe(true);
        await act(async () => button("Save role").click()); expect(invoke).not.toHaveBeenCalled();
    });
    it("loads grid role choices only when opened and sends locale preferences without band authority", async () => {
        await act(async () => root.render(<AccountRoleAction userId={userId} onChanged={refresh} />));
        expect(queries).toEqual([]);
        await act(async () => button("Change global account role").click());
        expect(queries[0]).toEqual({ userId, routeLocale: "fr-BE", browserLanguages: ["nl-BE"] });
        expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    });
});
