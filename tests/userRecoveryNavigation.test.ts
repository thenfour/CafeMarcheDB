// @vitest-environment jsdom

import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { userPublicId } from "./support/userFixtures";

vi.mock("@mui/material", async () => {
    const React = await vi.importActual<typeof import("react")>("react");
    const wrapper = ({ children }: any) => React.createElement(React.Fragment, null, children);
    return {
        Button: ({ children, onClick, disabled }: any) => React.createElement("button", { onClick, disabled }, children),
        Tooltip: wrapper, Dialog: wrapper, DialogContent: wrapper, DialogTitle: wrapper, TextField: wrapper,
    };
});
vi.mock("@blitzjs/rpc", () => ({ useMutation: () => [vi.fn()] }));
vi.mock("src/core/components/user/UserSignInMethodsButton", () => ({ UserSignInMethodsButton: () => null }));
vi.mock("src/core/components/user/MergeUsersButton", () => ({ MergeUsersButton: () => null }));
vi.mock("src/auth/mutations/setUserSysAdmin", () => ({ default: vi.fn() }));
vi.mock("@blitzjs/next", () => ({ Routes: { UserSearchPage: () => "/backstage/users" } }));
vi.mock("next/router", () => ({ useRouter: vi.fn() }));
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({ useDashboardContext: vi.fn() }));
vi.mock("src/core/components/user/useUserLifecycleActions", () => ({ useUserLifecycleActions: vi.fn() }));
vi.mock("src/core/components/SnackbarContext", () => ({ useSnackbar: () => ({ showSuccess: vi.fn(), showError: vi.fn() }) }));
vi.mock("src/core/components/EditFieldsDialog", () => ({ EditFieldsDialogButton: () => null }));
vi.mock("src/core/components/CMCoreComponents2", () =>
({
    CMButtonGroup: () => null,
    CMUserMgmtButton: ({ children, onClick, enabled = true }: any) =>
        React.createElement("button", { onClick, disabled: !enabled }, children),
}));
vi.mock("src/core/components/ConfirmationDialog", () => ({ useConfirm: () => vi.fn() }));
vi.mock("src/core/components/user/AdminResetPasswordButton", () => ({ AdminResetPasswordButton: () => null }));
vi.mock("src/core/components/user/ImpersonateUserButton", () => ({ ImpersonateUserButton: () => null }));

import { Permission } from "shared/permissions";
import { useRouter } from "next/router";
import { useDashboardContext } from "src/core/components/dashboardContext/DashboardContext";
import { useUserLifecycleActions } from "src/core/components/user/useUserLifecycleActions";
import { DeactivateUserButton, ReactivateUserButton } from "src/core/components/user/UserAdminPanel";

let root: Root;
let container: HTMLDivElement;
const originalActEnvironment = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT");
const user = { publicId: userPublicId(2), name: "Member" } as any;
const capabilities = { canDeactivate: true, canReactivate: false, deactivationContinuityWarnings: [] } as any;

beforeEach(() => {
    window.history.replaceState({}, "", `/backstage/user/${user.publicId}`);
    document.body.innerHTML = "<div id='root'></div>";
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.getElementById("root") as HTMLDivElement;
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root?.unmount());
    document.body.replaceChildren();
    if (originalActEnvironment) Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", originalActEnvironment);
    else Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});

describe("user profile lifecycle navigation", () => {
    it.each([false, true])("redirects or refreshes after deactivation with recover_users=%s", async canRecover => {
        const replace = vi.fn();
        const refresh = vi.fn();
        const deactivate = vi.fn().mockResolvedValue(true);
        vi.mocked(useRouter).mockReturnValue({ replace } as any);
        vi.mocked(useDashboardContext).mockReturnValue({
            currentUser: { publicId: userPublicId(1) },
            isAuthorized: (permission: Permission) => permission === Permission.recover_users ? canRecover : true,
        } as any);
        vi.mocked(useUserLifecycleActions).mockReturnValue({ deactivate, reactivate: vi.fn() });
        await act(async () => root.render(React.createElement(DeactivateUserButton, { user, capabilities, onOK: refresh })));
        expect(container.querySelector("button")).not.toBeNull();
        await act(async () => container.querySelector("button")!.click());
        expect(deactivate).toHaveBeenCalledWith(user, []);
        if (canRecover) {
            expect(refresh).toHaveBeenCalledTimes(1);
            expect(replace).not.toHaveBeenCalled();
        } else {
            expect(replace).toHaveBeenCalledWith("/backstage/users");
            expect(refresh).not.toHaveBeenCalled();
        }
    });

    it.each([false, true])("does not navigate or refresh a cancelled/failed deactivation (%s)", async fails => {
        const replace = vi.fn();
        const refresh = vi.fn();
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        vi.mocked(useRouter).mockReturnValue({ replace } as any);
        vi.mocked(useDashboardContext).mockReturnValue({ currentUser: { publicId: userPublicId(1) }, isAuthorized: () => false } as any);
        const deactivate = fails ? vi.fn().mockRejectedValue(new Error("Denied")) : vi.fn().mockResolvedValue(false);
        vi.mocked(useUserLifecycleActions).mockReturnValue({ deactivate, reactivate: vi.fn() });
        await act(async () => root.render(React.createElement(DeactivateUserButton, { user, capabilities, onOK: refresh })));
        await act(async () => container.querySelector("button")!.click());
        expect(replace).not.toHaveBeenCalled();
        expect(refresh).not.toHaveBeenCalled();
        expect(container.querySelector("button")!.disabled).toBe(false);
    });

    it("offers reactivation only when authorized and refreshes after success", async () => {
        const refresh = vi.fn();
        const reactivate = vi.fn().mockResolvedValue(true);
        vi.mocked(useUserLifecycleActions).mockReturnValue({ deactivate: vi.fn(), reactivate });
        await act(async () => root.render(React.createElement(ReactivateUserButton, { user, capabilities, onOK: refresh })));
        expect(container.querySelector("button")).toBeNull();
        await act(async () => root.render(React.createElement(ReactivateUserButton, {
            user, capabilities: { ...capabilities, canReactivate: true }, onOK: refresh,
        })));
        expect(container.textContent).toContain("Reactivate");
        await act(async () => container.querySelector("button")!.click());
        expect(reactivate).toHaveBeenCalledWith(user);
        expect(refresh).toHaveBeenCalledTimes(1);
    });
});
