// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { kStaticLocalizedStringRegistry, type LocalizedPlainStringKey } from "src/locale/shared/staticLocalizedStringRegistry";
import { bandUserRolesView } from "src/core/db3/shared/entities/user/bandUserRoles";
import { bandRoleListView, bandRoleChoicesView } from "src/core/db3/shared/entities/user/bandRoleViews";
import { BandUserRoleEditor, MemberRolesControl } from "src/core/components/user/BandUserRoles";

vi.mock("src/core/db3/components/useDB3Command", () => ({ useDB3Command: () => ({ invoke }) }));
vi.mock("src/core/db3/components/useDB3Context", () => ({ useDB3QueryContext: () => ({ bandPublicId: bandId, browserLanguages: ["fr-BE"] }) }));
vi.mock("src/core/db3/queries/db3queries", () => ({ default: vi.fn() }));
vi.mock("@blitzjs/rpc", () => ({ useQuery: (_resolver: unknown, args: { table: { viewID: string } }) => {
    queries.push(args);
    return [{ items: args.table.viewID === bandUserRolesView.viewID ? [member] : roles }, { refetch }];
} }));
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({ useDashboardContext: () => ({ refreshCachedData: refreshDashboard }) }));
vi.mock("src/core/components/SnackbarContext", () => ({ useSnackbar: () => ({ showMessage }) }));
vi.mock("src/locale/components/PresentationProvider", () => ({ usePresentation: () => ({ bandPublicId: bandId, data: {
    authorization: { bandPublicId: bandId, bandUserPublicId: member.publicId, effectivePermissionNames: permissions }, input: { clientRequestId: requestId },
}, invalidate: invalidatePresentation }) }));
vi.mock("src/locale/components/useLocale", () => ({ useLocale: () => ({ getPlainString: (key: LocalizedPlainStringKey) => kStaticLocalizedStringRegistry[key].defaultValue }) }));

const member = bandUserRolesView.parseDto({ publicId: "Membership000001", userId: "User000000000001", user: { publicId: "User000000000001", name: "Alice" },
    bandRoleId: "BandRole00000001", bandRole: { publicId: "BandRole00000001" } });
const roles = ["Gestionnaires", "Musiciens"].map((name, index) => bandRoleListView.parseDto({
    publicId: `BandRole0000000${index + 1}`, name, description: null, color: null, sortOrder: index,
    nameResolution: { value: name, localeTag: "fr-BE", scope: "band", source: "stored", reason: "exact", requestedTag: "fr-BE" },
    nameStringPublicId: null,
    descriptionResolution: { value: null, localeTag: null, scope: null, source: "missing", reason: "missing", requestedTag: null },
    descriptionStringPublicId: null,
}));
const saved = { status: "saved", membershipId: member.publicId, roleId: roles[1]!.publicId };
const confirmation = { status: "confirmationRequired", membershipId: member.publicId, roleId: roles[1]!.publicId, permissions: [Permission.assign_user_roles] };
const invoke = vi.fn(async (_input: unknown): Promise<unknown> => saved);
const refetch = vi.fn(async () => {});
const refreshDashboard = vi.fn(async () => {});
const invalidatePresentation = vi.fn(async () => {});
const showMessage = vi.fn();
const queries: unknown[] = [];
let permissions: Permission[];
let bandId: string | null;
let requestId: string;
let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.clearAllMocks();
    invoke.mockResolvedValue(saved);
    refetch.mockResolvedValue(undefined);
    refreshDashboard.mockResolvedValue(undefined);
    invalidatePresentation.mockResolvedValue(undefined);
    permissions = [Permission.login, Permission.assign_user_roles];
    bandId = "Band000000000001";
    requestId = "first";
    queries.length = 0;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});
async function click(label: string) {
    const button = [...document.querySelectorAll<HTMLButtonElement>("button")].find(element => element.textContent?.trim() === label);
    if (!button) {
        throw new Error(`Missing button: ${label}`);
    }
    await act(async () => button.click());
}
async function selectRole(label: string) {
    const select = document.querySelector('[role="combobox"]') ?? document.querySelector('[aria-haspopup="listbox"]');
    if (!select) {
        throw new Error("Missing role selector");
    }
    await act(async () => select.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true })));
    const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(element => element.textContent === label);
    if (!option) {
        throw new Error(`Missing role: ${label}`);
    }
    await act(async () => option.click());
}
async function renderEditor(assignableRoleIds = roles.map(role => role.publicId)) {
    await act(async () => root.render(<BandUserRoleEditor member={member} roles={roles} assignableRoleIds={assignableRoleIds} refetch={refetch} />));
}
async function expectClosedDialog() {
    // MUI retains the dialog during its closing transition.
    await act(async () => { await new Promise(resolve => window.setTimeout(resolve, 250)); });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
}

describe("band role editor", () => {
    it("displays localized labels and saves a membership role through the shared command", async () => {
        await renderEditor();
        expect(container.textContent).toContain("Gestionnaires");
        await click("Change band role");
        await selectRole("Musiciens");
        await click("Save role");
        expect(invoke).toHaveBeenCalledWith({ membershipId: member.publicId, roleId: roles[1]!.publicId, acknowledgeContinuityRisk: false });
        expect(refetch).toHaveBeenCalledOnce();
        expect(refreshDashboard).toHaveBeenCalledOnce();
        expect(invalidatePresentation).toHaveBeenCalledOnce();
        await expectClosedDialog();
    });

    it("keeps the requested role and requires explicit continuity acknowledgement before retrying", async () => {
        invoke.mockResolvedValueOnce(confirmation);
        await renderEditor();
        await click("Change band role");
        await selectRole("Musiciens");
        await click("Save role");
        expect(refetch).not.toHaveBeenCalled();
        expect(invalidatePresentation).not.toHaveBeenCalled();
        expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Assign member roles");
        const checkbox = document.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
        expect([...document.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent === "Save role")?.disabled).toBe(true);
        await act(async () => checkbox.click());
        await click("Save role");
        expect(invoke).toHaveBeenLastCalledWith({ membershipId: member.publicId, roleId: roles[1]!.publicId, acknowledgeContinuityRisk: true });
    });

    it("resets acknowledgement when the requested role changes", async () => {
        invoke.mockResolvedValueOnce(confirmation);
        await renderEditor();
        await click("Change band role");
        await selectRole("Musiciens");
        await click("Save role");
        await act(async () => document.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
        await selectRole("Use Public band role");
        await click("Save role");
        expect(invoke).toHaveBeenLastCalledWith({ membershipId: member.publicId, roleId: null, acknowledgeContinuityRisk: false });
    });

    it("retains the dialog and draft after a rejected save and distinguishes a failed refresh", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        invoke.mockRejectedValueOnce(new Error("Grant revoked"));
        await renderEditor();
        await click("Change band role");
        await selectRole("Musiciens");
        await click("Save role");
        expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Could not update this band role");
        expect(document.querySelector('[aria-haspopup="listbox"]')?.textContent).toContain("Musiciens");
        refetch.mockRejectedValueOnce(new Error("Offline"));
        await click("Save role");
        await expectClosedDialog();
        expect(container.textContent).toContain("Role saved. Reload this page");
    });

    it("permits editing only with role-assignment grants and omits choices outside the envelope", async () => {
        permissions = [Permission.login, Permission.manage_users];
        await renderEditor();
        expect(container.textContent).not.toContain("Change band role");
        permissions = [Permission.login, Permission.assign_user_roles];
        await renderEditor([roles[0]!.publicId]);
        await click("Change band role");
        const select = document.querySelector('[aria-haspopup="listbox"]')!;
        await act(async () => select.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true })));
        expect(document.querySelector('[role="listbox"]')?.textContent).not.toContain("Musiciens");
    });

    it("blocks duplicate submissions and cancellation while saving", async () => {
        let complete: ((result: unknown) => void) | undefined;
        invoke.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
        await renderEditor();
        await click("Change band role");
        await selectRole("Musiciens");
        await click("Save role");
        await click("Save role");
        await click("Cancel");
        expect(invoke).toHaveBeenCalledOnce();
        expect(document.querySelector('[role="dialog"]')).not.toBeNull();
        await act(async () => complete!(saved));
    });

    it("loads scoped generic views and discards an open editor after a band switch", async () => {
        await act(async () => root.render(<MemberRolesControl />));
        expect(queries).toEqual(expect.arrayContaining([
            expect.objectContaining({ bandPublicId: bandId, table: expect.objectContaining({ viewID: bandRoleChoicesView.viewID }) }),
            expect.objectContaining({ bandPublicId: bandId, table: expect.objectContaining({ viewID: bandUserRolesView.viewID }) }),
        ]));
        await click("Change band role");
        await selectRole("Musiciens");
        bandId = "Band000000000002";
        requestId = "second";
        await act(async () => root.render(<MemberRolesControl />));
        expect(document.querySelector('[role="dialog"]')).toBeNull();
        bandId = null;
        await act(async () => root.render(<MemberRolesControl />));
        expect(container.textContent).toContain("Select a band");
    });
});
