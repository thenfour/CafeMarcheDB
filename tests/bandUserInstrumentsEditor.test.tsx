// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parsePublicId, type InstrumentPublicId } from "shared/publicId";
import { Permission } from "shared/permissions";
import { kStaticLocalizedStringRegistry, type LocalizedPlainStringKey } from "src/locale/shared/staticLocalizedStringRegistry";
import { bandUserInstrumentsView } from "src/core/db3/shared/entities/user/bandUserInstruments";
import { BandUserInstrumentsEditor, MemberInstrumentsControl } from "src/core/components/user/BandUserInstruments";

vi.mock("src/core/db3/components/useDB3Command", () => ({ useDB3Command: () => ({ invoke }) }));
vi.mock("src/core/db3/components/IconMap", () => ({ RenderMuiIcon: () => null, gIconMap: {}, gCharMap: {} }));
vi.mock("src/core/db3/components/useDB3Context", () => ({ useDB3QueryContext: () => ({ bandPublicId: bandId }) }));
vi.mock("src/core/db3/queries/db3queries", () => ({ default: vi.fn() }));
vi.mock("@blitzjs/rpc", () => ({ useQuery: () => [{ items: [member] }, { refetch }] }));
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({
    useDashboardContext: () => ({ instrument: { items: availableInstruments }, refreshCachedData: refreshDashboard }),
    useFeatureRecorder: () => recordFeature,
}));
vi.mock("src/core/components/CMCoreComponents", () => ({ InstrumentChip: ({ value }: { value: InstrumentPublicId }) => <span>{instruments.find(row => row.publicId === value)?.name}</span> }));
vi.mock("src/core/components/SnackbarContext", () => ({ useSnackbar: () => ({ showMessage }) }));
vi.mock("src/locale/components/PresentationProvider", () => ({ usePresentation: () => ({ bandPublicId: bandId, data: { authorization: {
    bandUserPublicId: membershipId, effectivePermissionNames: permissions,
}, input: { clientRequestId: "snapshot" } } }) }));
vi.mock("src/locale/components/useLocale", () => ({ useLocale: () => ({ getPlainString: (key: LocalizedPlainStringKey) => kStaticLocalizedStringRegistry[key].defaultValue }) }));

const member = bandUserInstrumentsView.parseDto({
    publicId: "Membership000001", userId: "User000000000001", user: { publicId: "User000000000001", name: "Alice" },
    bandUserInstruments: [
        { publicId: "Assignment000001", isPrimary: true, bandInstrumentId: "Instrument000001", bandInstrument: { publicId: "Instrument000001" } },
        { publicId: "Assignment000002", isPrimary: false, bandInstrumentId: "Instrument000002", bandInstrument: { publicId: "Instrument000002" } },
    ],
});
const instruments = [
    { publicId: parsePublicId<"Instrument">("Instrument000001"), name: "Trompette" },
    { publicId: parsePublicId<"Instrument">("Instrument000002"), name: "Flûte" },
    { publicId: parsePublicId<"Instrument">("Instrument000003"), name: "Clarinet" },
];
const invoke = vi.fn(async (_input: unknown) => ({ membershipId: member.publicId }));
let availableInstruments = instruments;
const refetch = vi.fn(async () => {});
const refreshDashboard = vi.fn(async () => {});
const showMessage = vi.fn();
const recordFeature = vi.fn(async () => {});
let permissions: Permission[] = [Permission.login];
let bandId: string | null = "Band000000000001";
let membershipId: string | null = member.publicId;
let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.clearAllMocks();
    invoke.mockResolvedValue({ membershipId: member.publicId });
    permissions = [Permission.login];
    bandId = "Band000000000001";
    membershipId = member.publicId;
    availableInstruments = instruments;
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
async function renderEditor() {
    await act(async () => root.render(<BandUserInstrumentsEditor member={member} refetch={refetch} />));
}

describe("band membership instrument editor", () => {
    it("shows resolved dashboard labels and makes a membership-scoped primary request", async () => {
        await renderEditor();
        expect(container.textContent).toContain("Trompette");
        expect(container.textContent).toContain("Flûte");
        await click("Change default");
        const option = document.querySelector<HTMLInputElement>('input[type="radio"][aria-label="Flûte"]');
        if (!option) {
            throw new Error("Missing primary instrument option.");
        }
        await act(async () => option.click());
        await click("Apply");
        expect(invoke).toHaveBeenCalledWith({ kind: "setPrimary", membershipId: member.publicId, instrumentId: instruments[1]!.publicId });
        expect(refetch).toHaveBeenCalledOnce();
        expect(refreshDashboard).toHaveBeenCalledOnce();
    });

    it("retains the dialog and changed selection after a failed write", async () => {
        invoke.mockRejectedValue(new Error("Access revoked"));
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        try {
            await renderEditor();
            await click("Edit instruments");
            const option = document.querySelector<HTMLInputElement>('input[type="checkbox"][aria-label="Clarinet"]');
            if (!option) {
                throw new Error("Missing new instrument option.");
            }
            await act(async () => option.click());
            await click("Apply");
            expect(document.querySelector('[role="dialog"]')).not.toBeNull();
            expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Could not update instruments.");
            expect(refetch).not.toHaveBeenCalled();
            invoke.mockResolvedValue({ membershipId: member.publicId });
            await click("Apply");
            expect(invoke.mock.calls[1]?.[0]).toEqual({ kind: "replace", membershipId: member.publicId, instrumentIds: instruments.map(row => row.publicId) });
            expect(document.querySelector('[role="dialog"]')).toBeNull();
        } finally {
            log.mockRestore();
        }
    });

    it("hides edit controls for another member and exposes them to a band manager", async () => {
        membershipId = "Membership000002";
        await renderEditor();
        expect(container.textContent).not.toContain("Edit instruments");
        permissions = [Permission.login, Permission.manage_users];
        await renderEditor();
        expect(container.textContent).toContain("Edit instruments");
    });

    it("keeps unavailable assignments selected when adding a visible instrument", async () => {
        availableInstruments = instruments.slice(1);
        await renderEditor();
        expect(container.textContent).toContain("Unavailable instrument");
        await click("Edit instruments");
        const hidden = document.querySelector<HTMLInputElement>('input[type="checkbox"][aria-label="Unavailable instrument"]');
        expect(hidden?.checked).toBe(true);
        const added = document.querySelector<HTMLInputElement>('input[type="checkbox"][aria-label="Clarinet"]');
        if (!added) {
            throw new Error("Missing visible instrument option.");
        }
        await act(async () => added.click());
        await click("Apply");
        expect(invoke).toHaveBeenCalledWith({ kind: "replace", membershipId: member.publicId, instrumentIds: instruments.map(row => row.publicId) });
    });

    it("disables the picker and prevents repeat submissions while the save is pending", async () => {
        let finish: ((result: { membershipId: typeof member.publicId }) => void) | undefined;
        invoke.mockImplementationOnce(() => new Promise<{ membershipId: typeof member.publicId }>(resolve => { finish = resolve; }));
        await renderEditor();
        await click("Change default");
        const option = document.querySelector<HTMLInputElement>('input[type="radio"][aria-label="Flûte"]');
        if (!option) {
            throw new Error("Missing primary option.");
        }
        await act(async () => option.click());
        await click("Apply");
        expect(document.querySelector<HTMLInputElement>('input[type="radio"][aria-label="Flûte"]')?.disabled).toBe(true);
        await click("Apply");
        expect(invoke).toHaveBeenCalledOnce();
        await act(async () => finish?.({ membershipId: member.publicId }));
        expect(document.querySelector('[role="dialog"]')).toBeNull();
    });

    it("requires explicit band context and an active membership for self service", async () => {
        bandId = null;
        await act(async () => root.render(<MemberInstrumentsControl own />));
        expect(container.textContent).toContain("Select a band");
        bandId = "Band000000000002";
        membershipId = null;
        await act(async () => root.render(<MemberInstrumentsControl own />));
        expect(container.textContent).toContain("An active band membership is required");
        expect(container.textContent).not.toContain("Trompette");
    });
});
