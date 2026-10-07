// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parsePublicId } from "shared/publicId";

const bandA = parsePublicId<"Band">("CalendarBand0001");
const bandB = parsePublicId<"Band">("CalendarBand0002");
let selectedBand: typeof bandA | null = bandA;
const replace = vi.fn();
const refetch = vi.fn();
const confirm = vi.fn();
const snackbar = { showSuccess: vi.fn(), showError: vi.fn() };

vi.mock("@blitzjs/rpc", () => ({
    useQuery: vi.fn((_resolver, args) => [{ subscriptionUrl: `https://calendar.test/${args.bandPublicId}`, webcalUrl: `webcal://calendar.test/${args.bandPublicId}` }, { refetch }]),
    useMutation: () => [replace],
}));
vi.mock("src/auth/queries/getMyCalendarSubscription", () => ({ default: {} }));
vi.mock("src/auth/mutations/replaceMyCalendarSubscription", () => ({ default: {} }));
vi.mock("src/locale/components/PresentationProvider", () => ({ usePresentation: () => ({ bandPublicId: selectedBand }) }));
vi.mock("src/locale/components/useLocale", () => ({ useLocale: () => ({ getPlainString: () => "Select a band to view its calendar." }) }));
vi.mock("src/core/components/CMCoreComponents2", () => ({
    CMButton: ({ children, onClick, href }: React.PropsWithChildren<{ onClick?: () => void; href?: string }>) => <button onClick={onClick} data-href={href}>{children}</button>,
    useURLState: () => ["other", vi.fn()],
}));
vi.mock("src/core/components/TabPanel", () => ({
    CMTabPanel: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    CMTab: ({ children, thisTabId }: React.PropsWithChildren<{ thisTabId: string }>) => thisTabId === "other" ? <div>{children}</div> : null,
}));
vi.mock("src/core/components/ConfirmationDialog", () => ({ useConfirm: () => confirm }));
vi.mock("src/core/components/SnackbarContext", () => ({ useSnackbar: () => snackbar }));
vi.mock("src/core/components/user/UserSettingsControls", () => ({ CalendarUserSettingsControl: () => null }));
vi.mock("src/core/components/CMCoreComponents", () => ({ CMSinglePageSurfaceCard: ({ children }: React.PropsWithChildren) => <div>{children}</div> }));
vi.mock("src/core/components/AppContext", () => ({ AppContextMarker: ({ children }: React.PropsWithChildren) => <div>{children}</div> }));
vi.mock("src/core/components/dashboard/DashboardLayout", () => ({ default: ({ children }: React.PropsWithChildren) => <div>{children}</div> }));

import { useQuery } from "@blitzjs/rpc";
import { SelectedBandCalendar } from "src/pages/backstage/calendar";

let container: HTMLDivElement;
let root: Root;
async function render() {
    await act(async () => { root.render(<SelectedBandCalendar />); });
}
async function clickReplace() {
    const button = Array.from(container.querySelectorAll("button")).find(button => button.textContent === "Replace private link")!;
    await act(async () => { button.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
}
function pending() {
    let resolve!: (value: boolean) => void;
    const promise = new Promise<boolean>(complete => { resolve = complete; });
    return { promise, resolve };
}

describe("selected-band calendar subscription UI", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
        selectedBand = bandA;
        confirm.mockResolvedValue(true);
        replace.mockResolvedValue(undefined);
        refetch.mockResolvedValue(undefined);
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });
    afterEach(async () => {
        await act(async () => { root.unmount(); });
        container.remove();
        vi.unstubAllGlobals();
    });

    it("requires a selected band before fetching a private subscription", async () => {
        selectedBand = null;
        await render();
        expect(container.textContent).toContain("Select a band");
        expect(useQuery).not.toHaveBeenCalled();
    });

    it("passes band context to retrieval and replacement and explains account-wide rotation", async () => {
        await render();
        expect(useQuery).toHaveBeenCalledWith(expect.anything(), { bandPublicId: bandA });
        await clickReplace();
        expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining("all bands") }));
        expect(replace).toHaveBeenCalledWith({ bandPublicId: bandA });
        expect(refetch).toHaveBeenCalledTimes(1);
        expect(snackbar.showSuccess).toHaveBeenCalledWith("Private calendar link replaced");
        selectedBand = bandB;
        await render();
        await clickReplace();
        expect(replace).toHaveBeenLastCalledWith({ bandPublicId: bandB });
    });

    it("drops a pending replacement confirmation when the selected band changes", async () => {
        const confirmation = pending();
        confirm.mockReturnValue(confirmation.promise);
        await render();
        await clickReplace();
        selectedBand = bandB;
        await render();
        await act(async () => { confirmation.resolve(true); });
        expect(replace).not.toHaveBeenCalled();
        expect(refetch).not.toHaveBeenCalled();
        expect(snackbar.showSuccess).not.toHaveBeenCalled();
    });

    it("does not refresh or display success for a replacement completing after a band switch", async () => {
        const mutation = pending();
        replace.mockReturnValue(mutation.promise);
        await render();
        await clickReplace();
        selectedBand = bandB;
        await render();
        await act(async () => { mutation.resolve(true); });
        expect(replace).toHaveBeenCalledWith({ bandPublicId: bandA });
        expect(refetch).not.toHaveBeenCalled();
        expect(snackbar.showSuccess).not.toHaveBeenCalled();
    });
});
