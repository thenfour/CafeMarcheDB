// @vitest-environment jsdom
import React from "react";
import { act, Simulate } from "react-dom/test-utils";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@blitzjs/rpc", () => ({ invoke: vi.fn(), useMutation: () => [vi.fn()] }));
vi.mock("next/router", () => ({ useRouter: () => ({}) }));
vi.mock("src/auth/mutations/mergeUsers", () => ({ default: vi.fn() }));
vi.mock("src/auth/queries/previewUserMerge", () => ({ default: vi.fn() }));
vi.mock("src/auth/queries/searchUserMergeCandidates", () => ({ default: vi.fn() }));
vi.mock("src/core/components/CMCoreComponents2", () => ({ DialogActionsCM: ({ children }: React.PropsWithChildren) => children }));
vi.mock("src/core/db3/components/IconMap", () => ({ RenderMuiIcon: () => null, gIconMap: {} }));
vi.mock("src/core/components/CMLink", () => ({ CMLink: () => null }));

import { invoke } from "@blitzjs/rpc";
import { MergeUsersButton } from "src/core/components/user/MergeUsersButton";
import searchUserMergeCandidates from "src/auth/queries/searchUserMergeCandidates";

let root: Root;
const originalActEnvironment = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT");
beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    document.body.innerHTML = "<div id='root'></div>";
    root = createRoot(document.getElementById("root")!);
    vi.mocked(invoke).mockResolvedValue([{
        id: 55, name: "Other account", email: "other@test.invalid", roleName: "Member", isDeleted: false,
    }]);
});
afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
    if (originalActEnvironment) Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", originalActEnvironment);
    else Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});
const button = (name: string) => [...document.querySelectorAll("button")].find(b => b.textContent?.trim() === name)!;
const click = async (element: HTMLElement) => { await act(async () => element.click()); };
const renderProfile = async (id = 54) => {
    await act(async () => root.render(React.createElement(MergeUsersButton, { user: { id, name: "Profile account" } })));
};

it("loads candidates once across parent rerenders, then reloads for search and profile changes", async () => {
    await renderProfile();
    await click(button("Merge with another user"));
    await click(button("Select account"));
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain("Other account");

    // RPC/query context updates and profile refreshes must not restart an unchanged search.
    await renderProfile();
    await renderProfile();
    expect(invoke).toHaveBeenCalledTimes(1);

    await act(async () => Simulate.change(document.querySelector<HTMLInputElement>('input[type=search]')!, { target: { value: "Other" } } as any));
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(invoke).toHaveBeenLastCalledWith(searchUserMergeCandidates, { query: "Other", excludeUserId: 54 });
    await renderProfile();
    expect(invoke).toHaveBeenCalledTimes(2);

    await renderProfile(56);
    expect(invoke).toHaveBeenCalledTimes(3);
    expect(invoke).toHaveBeenLastCalledWith(searchUserMergeCandidates, { query: "Other", excludeUserId: 56 });
});
