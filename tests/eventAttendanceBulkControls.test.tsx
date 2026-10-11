// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parsePublicId } from "shared/publicId";

// Keep the real menu, confirmation flow and RPC arguments; omit unrelated editor infrastructure.
vi.mock("src/core/db3/DB3Client", () => ({ makeClientColumnSet: () => ({}) }));
vi.mock("src/core/db3/db3", () => ({}));
vi.mock("src/core/db3/components/useClientAuth", () => ({ useClientAuth: () => ({}) }));
vi.mock("src/auth/hooks/useCurrentUser", () => ({ useCurrentUser: () => [] }));
vi.mock("src/core/components/event/EventComponentsBase", () => ({ EventTableClientColumns: {} }));
vi.mock("src/core/components/DateTime/EventDateRangeText", () => ({ EventDateRangeText: () => null }));
vi.mock("src/core/db3/components/db3NewObjectDialog", () => ({ DB3EditObjectDialog: () => null }));
vi.mock("src/core/components/markdown/Markdown", () => ({ Markdown: () => null }));
vi.mock("src/setting/client/components/SettingMarkdown", () => ({ BandLocalizedMarkdown: () => null }));
vi.mock("src/core/components/event/EventChips", () => ({ EventStatusValue: () => null }));
vi.mock("src/core/components/CMCoreComponents2", () => ({ CMButton: () => null }));
vi.mock("src/core/db3/components/IconMap", () => ({
    gCharMap: { VerticalEllipses: () => "..." },
    gIconMap: { AutoAwesome: () => null, ContentCopy: () => null, Delete: () => null },
}));
vi.mock("@mui/material", () => ({
    Menu: ({ children, open }: { children: React.ReactNode; open: boolean }) => open ? <div>{children}</div> : null,
    MenuItem: ({ children, onClick }: React.PropsWithChildren<Pick<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick">>) => <button onClick={onClick}>{children}</button>,
    ListItemIcon: () => null,
    Divider: () => null,
}));
vi.mock("src/core/db3/mutations/copyEventSegmentResponses", () => ({ default: "copy" }));
vi.mock("src/core/db3/mutations/clearEventSegmentResponses", () => ({ default: "clear" }));
vi.mock("@blitzjs/rpc", () => ({ useMutation: (endpoint: string) => [endpoint === "copy" ? copy : clear] }));
vi.mock("src/core/components/ConfirmationDialog", () => ({ useConfirm: () => confirm }));
vi.mock("src/core/components/SnackbarContext", () => ({
    SnackbarContext: React.createContext({}),
    useSnackbar: () => ({ invokeAsync: async (work: () => Promise<void>) => work(), showMessage: vi.fn() }),
}));
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({
    useDashboardContext: () => ({ requireBandPublicId: () => bandPublicId, isAuthorized: () => authorized }),
}));
import { EventSegmentDotMenu } from "src/core/components/event/EventSegmentComponents";

const copy = vi.fn();
const clear = vi.fn();
const confirm = vi.fn();
const refetch = vi.fn();
const bandPublicId = parsePublicId<"Band">("bulk_menu_band01");
let authorized = true;
let root: Root;
const originalActEnvironment = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT");
const source = { publicId: parsePublicId<"EventSegment">("bulk_menu_source"), name: "Source", responses: [] };
const target = { publicId: parsePublicId<"EventSegment">("bulk_menu_target"), name: "Target", responses: [] };
// Only segment identity, caption and answer count are consumed; omit the unrelated editor payload.
const props = {
    event: { segments: [source, target] }, segment: target, readonly: false, refetch, getAttendeeNames: () => [],
} as unknown as React.ComponentProps<typeof EventSegmentDotMenu>;

beforeEach(() => {
    vi.clearAllMocks();
    confirm.mockResolvedValue(true);
    authorized = true;
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    document.body.innerHTML = "<div id='root'></div>";
    root = createRoot(document.getElementById("root")!);
});
afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
    if (originalActEnvironment) {
        Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", originalActEnvironment);
    } else {
        Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
    }
});

async function openMenu() {
    await act(async () => root.render(<EventSegmentDotMenu {...props} />));
    await act(async () => document.querySelector<HTMLElement>(".eventSegmentDotMenu")!.click());
}

async function chooseAction(caption: string) {
    const button = [...document.querySelectorAll("button")].find(element => element.textContent === caption)!;
    expect(button).toBeDefined();
    await act(async () => button.click());
}

describe("bulk attendance menu context", () => {
    it("copies the chosen segments with explicit selected-band context and refetches after confirmation", async () => {
        await openMenu();
        await chooseAction("Copy responses from Source");
        expect(confirm).toHaveBeenCalledOnce();
        expect(copy).toHaveBeenCalledWith({ bandPublicId, fromEventSegmentId: source.publicId, toEventSegmentId: target.publicId });
        expect(clear).not.toHaveBeenCalled();
        expect(refetch).toHaveBeenCalledOnce();
    });

    it("clears only the chosen segment with explicit selected-band context", async () => {
        await openMenu();
        await chooseAction("Clear all user responses");
        expect(confirm).toHaveBeenCalledOnce();
        expect(clear).toHaveBeenCalledWith({ bandPublicId, eventSegmentId: target.publicId });
        expect(copy).not.toHaveBeenCalled();
        expect(refetch).toHaveBeenCalledOnce();
    });

    it.each(["Copy responses from Source", "Clear all user responses"])("cancels %s without writing or refetching", async caption => {
        confirm.mockResolvedValue(false);
        await openMenu();
        await chooseAction(caption);
        expect(copy).not.toHaveBeenCalled();
        expect(clear).not.toHaveBeenCalled();
        expect(refetch).not.toHaveBeenCalled();
    });

    it("hides the menu without event administration authority", async () => {
        authorized = false;
        await act(async () => root.render(<EventSegmentDotMenu {...props} />));
        expect(document.querySelector(".eventSegmentDotMenu")).toBeNull();
    });
});
