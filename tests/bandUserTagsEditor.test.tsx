// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parsePublicId } from "shared/publicId";
import { Permission } from "shared/permissions";
import { kStaticLocalizedStringRegistry, type LocalizedPlainStringKey } from "src/locale/shared/staticLocalizedStringRegistry";
import { bandUserTagsView } from "src/core/db3/shared/entities/user/bandUserTags";
import { BandUserTagsEditor, MemberTagsControl } from "src/core/components/user/BandUserTags";

vi.mock("src/core/db3/components/useDB3Command", () => ({ useDB3Command: () => ({ invoke }) }));
vi.mock("src/core/db3/components/IconMap", () => ({ RenderMuiIcon: () => null, gIconMap: {}, gCharMap: {} }));
vi.mock("src/core/db3/components/useDB3Context", () => ({ useDB3QueryContext: () => ({ bandPublicId: bandId }) }));
vi.mock("src/core/db3/queries/db3queries", () => ({ default: vi.fn() }));
vi.mock("@blitzjs/rpc", () => ({ useQuery: () => [{ items: [member] }, { refetch }] }));
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({
    useDashboardContext: () => ({
        userTag: { items: tags, getById: (publicId: string) => tags.find(tag => tag.publicId === publicId) },
        refreshCachedData: refreshDashboard,
    }),
}));
vi.mock("src/core/components/CMChip", () => ({ CMStandardDBChip: ({ model }: { model: { name: string } }) => <span>{model.name}</span> }));
vi.mock("src/core/components/SnackbarContext", () => ({ useSnackbar: () => ({ showMessage }) }));
vi.mock("src/locale/components/PresentationProvider", () => ({ usePresentation: () => ({ bandPublicId: bandId, data: {
    authorization: { bandUserPublicId: member.publicId, effectivePermissionNames: permissions }, input: { clientRequestId: "snapshot" },
} }) }));
vi.mock("src/locale/components/useLocale", () => ({ useLocale: () => ({ getPlainString: (key: LocalizedPlainStringKey) => kStaticLocalizedStringRegistry[key].defaultValue }) }));

const member = bandUserTagsView.parseDto({
    publicId: "Membership000001", userId: "User000000000001", user: { publicId: "User000000000001", name: "Alice" },
    bandUserTagAssignments: [{ publicId: "Assignment000001", bandUserTagId: "UserTag000000001", bandUserTag: { publicId: "UserTag000000001" } }],
});
const initialTags = [
    { publicId: parsePublicId<"UserTag">("UserTag000000001"), name: "Musiciens", isHidden: false },
    { publicId: parsePublicId<"UserTag">("UserTag000000002"), name: "Volontaires", isHidden: false },
    { publicId: parsePublicId<"UserTag">("UserTag000000003"), name: "Hidden new tag", isHidden: true },
];
let tags = initialTags;
const invoke = vi.fn(async (_input: unknown) => ({ membershipId: member.publicId }));
const refetch = vi.fn(async () => {});
const refreshDashboard = vi.fn(async () => {});
const showMessage = vi.fn();
let permissions: Permission[] = [Permission.login, Permission.manage_users];
let bandId: string | null = "Band000000000001";
let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.clearAllMocks();
    invoke.mockResolvedValue({ membershipId: member.publicId });
    refetch.mockResolvedValue(undefined);
    refreshDashboard.mockResolvedValue(undefined);
    permissions = [Permission.login, Permission.manage_users];
    bandId = "Band000000000001";
    tags = initialTags;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});
async function click(text: string) {
    const button = [...document.querySelectorAll<HTMLButtonElement>("button")].find(element => element.textContent?.trim() === text);
    if (!button) {
        throw new Error(`Missing button: ${text}`);
    }
    await act(async () => button.click());
}
async function toggle(label: string) {
    const option = [...document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find(element => element.getAttribute("aria-label") === label);
    if (!option) {
        throw new Error(`Missing tag option: ${label}`);
    }
    await act(async () => option.click());
}
async function renderEditor() {
    await act(async () => root.render(<BandUserTagsEditor member={member} refetch={refetch} />));
}

describe("member tag editor", () => {
    it("uses localized dashboard references and makes a membership-scoped assignment request", async () => {
        await renderEditor();
        expect(container.textContent).toContain("Musiciens");
        await click("Edit tags");
        expect(document.querySelector('[role="dialog"]')?.textContent).not.toContain("Hidden new tag");
        await toggle("Volontaires");
        await click("Apply");
        expect(invoke).toHaveBeenCalledWith({ membershipId: member.publicId, tagIds: initialTags.slice(0, 2).map(tag => tag.publicId) });
        expect(refetch).toHaveBeenCalledOnce();
        expect(refreshDashboard).toHaveBeenCalledOnce();
        expect(document.querySelector('[role="dialog"]')).toBeNull();
    });

    it("shows assignments to owners but permits editing only with manager grants", async () => {
        for (const grants of [[Permission.login], [Permission.login, Permission.manage_user_taxonomy]]) {
            permissions = grants;
            await renderEditor();
            expect(container.textContent).toContain("Musiciens");
            expect(container.textContent).not.toContain("Edit tags");
        }
        permissions = [Permission.login, Permission.manage_users];
        await renderEditor();
        expect(container.textContent).toContain("Edit tags");
    });

    it("retains unavailable assignments and the changed draft when a save fails", async () => {
        tags = initialTags.map(tag => ({ ...tag, isHidden: tag.publicId === initialTags[0]!.publicId || tag.isHidden }));
        invoke.mockRejectedValueOnce(new Error("Access revoked"));
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        try {
            await renderEditor();
            expect(container.textContent).toContain("Unavailable tag");
            await click("Edit tags");
            await toggle("Volontaires");
            await click("Apply");
            expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Could not update tags.");
            expect(refetch).not.toHaveBeenCalled();
            await click("Apply");
            expect(invoke.mock.calls[1]?.[0]).toEqual({ membershipId: member.publicId, tagIds: initialTags.slice(0, 2).map(tag => tag.publicId) });
            expect(document.querySelector('[role="dialog"]')).toBeNull();
        } finally {
            log.mockRestore();
        }
    });

    it("disables changes and repeat submissions while a save is pending", async () => {
        let finish: ((result: { membershipId: typeof member.publicId }) => void) | undefined;
        invoke.mockImplementationOnce(() => new Promise<{ membershipId: typeof member.publicId }>(resolve => { finish = resolve; }));
        await renderEditor();
        await click("Edit tags");
        await toggle("Volontaires");
        await click("Apply");
        expect(document.querySelector<HTMLInputElement>('input[aria-label="Volontaires"]')?.disabled).toBe(true);
        await click("Apply");
        await click("Cancel");
        expect(invoke).toHaveBeenCalledOnce();
        expect(document.querySelector('[role="dialog"]')).not.toBeNull();
        await act(async () => finish?.({ membershipId: member.publicId }));
        expect(document.querySelector('[role="dialog"]')).toBeNull();
    });

    it("reports a committed write followed by a failed refresh", async () => {
        refetch.mockRejectedValueOnce(new Error("Network unavailable"));
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        try {
            await renderEditor();
            await click("Edit tags");
            await toggle("Volontaires");
            await click("Apply");
            expect(invoke).toHaveBeenCalledOnce();
            expect(document.querySelector('[role="dialog"]')).toBeNull();
            expect(container.textContent).toContain("Tags saved. Reload this page");
            expect(showMessage).not.toHaveBeenCalled();
        } finally {
            log.mockRestore();
        }
    });

    it("requires a band and discards open drafts when the selected band changes", async () => {
        bandId = null;
        await act(async () => root.render(<MemberTagsControl />));
        expect(container.textContent).toContain("Select a band");
        bandId = "Band000000000001";
        await act(async () => root.render(<MemberTagsControl />));
        await click("Edit tags");
        await toggle("Volontaires");
        bandId = "Band000000000002";
        await act(async () => root.render(<MemberTagsControl />));
        expect(document.querySelector('[role="dialog"]')).toBeNull();
        expect(invoke).not.toHaveBeenCalled();
    });
});
