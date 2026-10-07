// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { kStaticLocalizedStringRegistry, type LocalizedPlainStringKey } from "src/locale/shared/staticLocalizedStringRegistry";
import { bandUserLifecycleView } from "src/core/db3/shared/entities/user/bandUserLifecycle";
import { BandUserLifecycleControl } from "src/core/components/user/BandUserLifecycle";
import { BandMemberRecovery } from "src/core/components/user/BandMemberRecovery";

vi.mock("src/core/db3/components/useDB3Command", () => ({ useDB3Command: () => ({ invoke }) }));
vi.mock("src/core/db3/components/useDB3Context", () => ({ useDB3QueryContext: () => ({ bandPublicId: bandId, routeLocale: "fr-BE", browserLanguages: ["nl-BE", "en-US"], clientRequestId: requestId }) }));
vi.mock("src/core/db3/queries/db3paginatedQueries", () => ({ default: vi.fn() }));
vi.mock("src/core/db3/queries/db3queries", () => ({ default: vi.fn() }));
vi.mock("@blitzjs/rpc", () => ({ useQuery: (_resolver: unknown, args: { table: { viewID: string } }) => {
    queries.push(args);
    return [{ items: args.table.viewID === bandUserLifecycleView.viewID ? [inactive] : [], count: 1, hasMore: false }, { refetch, isFetching: false }];
} }));
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({ useDashboardContext: () => ({ refreshCachedData: refreshDashboard }) }));
vi.mock("src/core/components/SnackbarContext", () => ({ useSnackbar: () => ({ showMessage }) }));
vi.mock("src/locale/components/PresentationProvider", () => ({ usePresentation: () => ({ bandPublicId: bandId, data: {
    authorization: { userPublicId: active.user.publicId, effectivePermissionNames: permissions }, input: { clientRequestId: requestId },
}, invalidate: invalidatePresentation }) }));
vi.mock("src/locale/components/useLocale", () => ({ useLocale: () => ({ getPlainString: (key: LocalizedPlainStringKey) => kStaticLocalizedStringRegistry[key].defaultValue }) }));

const active = bandUserLifecycleView.parseDto({ publicId: "Membership000001", userId: "User000000000001", user: { publicId: "User000000000001", name: "Alice" },
    bandRoleId: null, bandRole: null, isDeleted: false });
const inactive = { ...active, isDeleted: true };
const invoke = vi.fn(async (_input: unknown): Promise<unknown> => ({ status: "saved" }));
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
    invoke.mockResolvedValue({ status: "saved" });
    refetch.mockResolvedValue(undefined);
    refreshDashboard.mockResolvedValue(undefined);
    invalidatePresentation.mockResolvedValue(undefined);
    permissions = [Permission.login, Permission.view_users_basic_info, Permission.deactivate_users, Permission.recover_users];
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
const renderEditor = (member = active) => act(async () => root.render(<BandUserLifecycleControl member={member} refetch={refetch} />));
async function openAndSave(member = active) {
    await renderEditor(member);
    await click(member.isDeleted ? "Reactivate band membership" : "Deactivate band membership");
    await click("Confirm membership change");
}

describe("membership lifecycle controls", () => {
    it("explains band ownership, confirms deactivation, and refreshes membership and presentation", async () => {
        await renderEditor();
        await click("Deactivate band membership");
        expect(document.querySelector('[role="dialog"]')?.textContent).toContain("shared account and other band memberships stay active");
        await click("Confirm membership change");
        expect(invoke).toHaveBeenCalledWith({ membershipId: active.publicId, action: "deactivate", acknowledgeContinuityRisk: false });
        expect(refetch).toHaveBeenCalledOnce();
        expect(refreshDashboard).toHaveBeenCalledOnce();
        expect(invalidatePresentation).toHaveBeenCalledOnce();
        expect(showMessage).toHaveBeenCalledWith(expect.objectContaining({ severity: "success" }));
    });
    it("restores the selected membership using the recovery action", async () => {
        await openAndSave(inactive);
        expect(invoke).toHaveBeenCalledWith({ membershipId: inactive.publicId, action: "reactivate", acknowledgeContinuityRisk: false });
    });
    it("requires an explicit acknowledgement of the last administrator warning before retrying", async () => {
        invoke.mockResolvedValueOnce({ status: "confirmationRequired", permissions: [Permission.assign_user_roles, Permission.deactivate_users] });
        await openAndSave();
        expect(refetch).not.toHaveBeenCalled();
        expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Assign member roles");
        const submit = [...document.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent === "Confirm membership change")!;
        expect(submit.disabled).toBe(true);
        await act(async () => document.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
        await click("Confirm membership change");
        expect(invoke).toHaveBeenLastCalledWith({ membershipId: active.publicId, action: "deactivate", acknowledgeContinuityRisk: true });
    });
    it("retains a failed operation for retry and reports refresh failure after a committed change", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        invoke.mockRejectedValueOnce(new Error("denied"));
        await openAndSave();
        expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Could not change this membership");
        expect(refetch).not.toHaveBeenCalled();
        refetch.mockRejectedValueOnce(new Error("refresh failed"));
        await click("Confirm membership change");
        expect(container.textContent).toContain("Membership saved. Reload this page");
    });
    it("blocks duplicate submission and dismissal while the request is pending", async () => {
        let complete: (result: unknown) => void = () => {};
        invoke.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
        await openAndSave();
        await click("Confirm membership change");
        await click("Cancel");
        expect(invoke).toHaveBeenCalledOnce();
        expect(document.querySelector('[role="dialog"]')).not.toBeNull();
        await act(async () => complete({ status: "saved" }));
    });
    it("uses independent lifecycle permissions instead of ownership or member-management grants", async () => {
        permissions = [Permission.login, Permission.manage_users, Permission.recover_users];
        await renderEditor();
        expect(container.textContent).not.toContain("Deactivate band membership");
        await renderEditor(inactive);
        expect(container.textContent).toContain("Reactivate band membership");
    });
    it("loads the recovery list through scoped DB3 with full language preferences and replaces state on band changes", async () => {
        await act(async () => root.render(<BandMemberRecovery />));
        expect(queries[1]).toMatchObject({ bandPublicId: bandId, routeLocale: "fr-BE", browserLanguages: ["nl-BE", "en-US"], includeDeleted: true,
            table: { viewID: bandUserLifecycleView.viewID }, filter: { tableParams: { membershipStatus: "inactive" } } });
        await click("Reactivate band membership");
        bandId = "Band000000000002";
        requestId = "second";
        await act(async () => root.render(<BandMemberRecovery />));
        expect(document.querySelector('[role="dialog"]')).toBeNull();
        expect(queries.at(-1)).toMatchObject({ bandPublicId: bandId, clientRequestId: "second" });
    });
    it("does not query without an explicit band or recovery and basic visibility grants", async () => {
        bandId = null;
        await act(async () => root.render(<BandMemberRecovery />));
        expect(queries).toHaveLength(0);
        bandId = "Band000000000001";
        permissions = [Permission.login, Permission.view_users_basic_info];
        await act(async () => root.render(<BandMemberRecovery />));
        expect(queries).toHaveLength(0);
        permissions = [Permission.login, Permission.recover_users];
        await act(async () => root.render(<BandMemberRecovery />));
        expect(queries).toHaveLength(0);
    });
});
