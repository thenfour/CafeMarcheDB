import { JSDOM } from "jsdom";
import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@mui/material", async () => {
    const React = await vi.importActual<typeof import("react")>("react");
    const wrapper = ({ children }: any) => React.createElement(React.Fragment, null, children);
    return {
        Button: ({ children, onClick, disabled }: any) => React.createElement("button", { onClick, disabled }, children),
        Tooltip: wrapper, Dialog: wrapper, DialogContent: wrapper, DialogTitle: wrapper, TextField: wrapper,
    };
});
vi.mock("@blitzjs/rpc", () => ({ useMutation: () => [vi.fn()] }));
vi.mock("src/auth/mutations/correctUserEmail", () => ({ default: vi.fn() }));
vi.mock("src/core/components/user/UserSignInMethodsButton", () => ({ UserSignInMethodsButton: () => null }));
vi.mock("src/core/components/user/MergeUsersButton", () => ({ MergeUsersButton: () => null }));
vi.mock("src/auth/mutations/setUserSysAdmin", () => ({ default: vi.fn() }));
vi.mock("@blitzjs/next", () => ({ Routes: { UserSearchPage: () => "/backstage/users" } }));
vi.mock("next/router", () => ({ useRouter: vi.fn() }));
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({ useDashboardContext: vi.fn() }));
vi.mock("src/core/components/user/useUserLifecycleActions", () => ({ useUserLifecycleActions: vi.fn() }));
vi.mock("src/core/components/SnackbarContext", () => ({ useSnackbar: () => ({ showSuccess: vi.fn(), showError: vi.fn() }) }));
vi.mock("src/core/components/EditFieldsDialog", () => ({ EditFieldsDialogButton: () => null }));
vi.mock("src/core/components/CMCoreComponents2", () => ({ DialogActionsCM: () => null }));
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
let dom: JSDOM;
const originalGlobals = ["window", "document", "IS_REACT_ACT_ENVIRONMENT"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
const user = { id: 2, name: "Member" } as any;
const capabilities = { canDeactivate: true, canReactivate: false, deactivationContinuityWarnings: [] } as any;

beforeEach(() => {
    dom = new JSDOM("<div id='root'></div>", { url: "http://localhost/backstage/user/2" });
    Object.defineProperties(globalThis, {
        document: { value: dom.window.document, configurable: true, writable: true },
        window: { value: dom.window, configurable: true, writable: true },
        IS_REACT_ACT_ENVIRONMENT: { value: true, configurable: true, writable: true },
    });
    container = document.getElementById("root") as HTMLDivElement;
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root?.unmount());
    dom?.window.close();
    for (const [key, descriptor] of originalGlobals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
    }
});

describe("user profile lifecycle navigation", () => {
    it.each([false, true])("redirects or refreshes after deactivation with recover_users=%s", async canRecover => {
        const replace = vi.fn();
        const refresh = vi.fn();
        const deactivate = vi.fn().mockResolvedValue(true);
        vi.mocked(useRouter).mockReturnValue({ replace } as any);
        vi.mocked(useDashboardContext).mockReturnValue({
            currentUser: { id: 1 },
            isAuthorized: (permission: Permission) => permission === Permission.recover_users ? canRecover : true,
        } as any);
        vi.mocked(useUserLifecycleActions).mockReturnValue({ deactivate, reactivate: vi.fn() });
        await act(async () => root.render(React.createElement(DeactivateUserButton, { user, capabilities, onOK: refresh })));
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
        vi.mocked(useDashboardContext).mockReturnValue({ currentUser: { id: 1 }, isAuthorized: () => false } as any);
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
