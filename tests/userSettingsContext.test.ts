// @vitest-environment jsdom
import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@blitzjs/rpc", async () => ({
    ...await vi.importActual<typeof import("@blitzjs/rpc")>("@blitzjs/rpc"),
    useQuery: vi.fn(), useMutation: vi.fn(), setQueryData: vi.fn(),
}));
vi.mock("@blitzjs/auth", async () => ({
    ...await vi.importActual<typeof import("@blitzjs/auth")>("@blitzjs/auth"), useSession: vi.fn(),
}));
vi.mock("src/auth/hooks/useCurrentUser", () => ({ useCurrentUser: vi.fn() }));
vi.mock("shared/brandConfig", () => ({ useBrand: vi.fn() }));
vi.mock("src/auth/queries/getDashboardData", () => ({ default: vi.fn() }));
vi.mock("src/auth/mutations/updateMyUserSettings", () => ({ default: vi.fn() }));
vi.mock("src/auth/mutations/setShowingAdminControls", () => ({ default: vi.fn() }));
vi.mock("src/core/components/AppContext", () => ({ useAppContext: vi.fn() }));
vi.mock("src/core/components/SnackbarContext", () => ({ useSnackbar: vi.fn() }));

import { useSession } from "@blitzjs/auth";
import { setQueryData, useMutation, useQuery } from "@blitzjs/rpc";
import { DefaultDbBrandConfig } from "shared/brandConfigBase";
import { useBrand } from "shared/brandConfig";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import getDashboardData from "src/auth/queries/getDashboardData";
import updateMyUserSettings from "src/auth/mutations/updateMyUserSettings";
import { DashboardContextProvider, useDashboardContext } from "src/core/components/dashboardContext/DashboardContext";
import { CalendarUserSettingsControl } from "src/core/components/user/UserSettingsControls";
import { useSnackbar } from "src/core/components/SnackbarContext";

let root: Root;
let container: HTMLDivElement;
let userId = 10;
let data: any;
let notify: () => void;
const update = vi.fn();
const errorMessage = vi.fn();
const originalActEnvironment = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT");

const dashboardData = (showDeclinedEvents: boolean) => ({
    ...Object.fromEntries([
        "permission", "effectivePermissionNames", "userTag", "wikiPageTag", "role",
        "eventType", "eventStatus", "eventTag", "eventAttendance", "fileTag", "instrumentTag", "instrumentFunctionalGroup",
        "songTag", "songCreditType", "relevantEventIds", "dynMenuLinks", "instrument",
    ].map(name => [name, []])),
    bandTimeZone: "Europe/Brussels",
    userSettings: { "calendar.showDeclinedEvents": showDeclinedEvents, "calendar.showUninvitedEvents": true },
});

beforeEach(() => {
    document.body.innerHTML = "<div id='root'></div>";
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.getElementById("root") as HTMLDivElement;
    root = createRoot(container);
    userId = 10;
    data = dashboardData(true);
    vi.mocked(useSession).mockImplementation(() => ({ userId, permissionNames: [] }) as any);
    vi.mocked(useCurrentUser).mockImplementation(() => [{ id: userId }] as any);
    vi.mocked(useBrand).mockReturnValue(DefaultDbBrandConfig);
    vi.mocked(useSnackbar).mockReturnValue({ showSuccess: vi.fn(), showError: errorMessage } as any);
    vi.mocked(useMutation).mockImplementation(resolver => [resolver === updateMyUserSettings ? update : vi.fn()] as any);
    vi.mocked(useQuery).mockImplementation(() => {
        const [, rerender] = React.useState(0);
        notify = () => rerender(value => value + 1);
        return [data, { refetch: vi.fn() }] as any;
    });
    vi.mocked(setQueryData).mockImplementation(async (_query, _args, updater: any) => {
        data = updater(data);
        notify();
    });
});

afterEach(async () => {
    await act(async () => root?.unmount());
    document.body.replaceChildren();
    if (originalActEnvironment) Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", originalActEnvironment);
    else Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});

describe("user settings in dashboard context", () => {
    it("publishes changed preferences to existing consumers while preserving runtime registrations", async () => {
        const Probe = () => {
            const context = useDashboardContext();
            React.useEffect(() => { context.metronomeSilencers.push(() => undefined); }, []);
            return React.createElement("span", null, String(context.userSettings["calendar.showDeclinedEvents"]));
        };
        const child = React.createElement(Probe);
        await act(async () => root.render(React.createElement(DashboardContextProvider, null, child)));
        const original = (window as any).cmdbDashboardContext;
        expect(container.textContent).toBe("true");
        data = dashboardData(false);
        await act(async () => notify());
        expect(container.textContent).toBe("false");
        expect((window as any).cmdbDashboardContext).toBe(original);
        expect(original.metronomeSilencers).toHaveLength(1);
    });

    it.each(["calendar.showDeclinedEvents", "calendar.showUninvitedEvents"] as const)("saves %s and updates every mounted preference control", async name => {
        update.mockResolvedValue({ ...data.userSettings, [name]: false });
        await act(async () => root.render(React.createElement(DashboardContextProvider, null,
            React.createElement(CalendarUserSettingsControl), React.createElement(CalendarUserSettingsControl),
        )));
        const inputs = () => [...container.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)];
        expect(inputs().map(input => input.checked)).toEqual([true, true]);
        await act(async () => inputs()[0]!.click());
        expect(update).toHaveBeenCalledWith({ [name]: false });
        expect(inputs().map(input => input.checked)).toEqual([false, false]);
        expect([...container.querySelectorAll<HTMLInputElement>(`input:not([name="${name}"])`)]
            .every(input => input.checked)).toBe(true);
        expect(setQueryData).toHaveBeenCalledWith(getDashboardData, { userId: 10 }, expect.any(Function), { refetch: false });
    });

    it.each(["calendar.showDeclinedEvents", "calendar.showUninvitedEvents"] as const)("retains %s and reports a failed save", async name => {
        update.mockRejectedValue(new Error("Save failed"));
        await act(async () => root.render(React.createElement(DashboardContextProvider, null, React.createElement(CalendarUserSettingsControl))));
        const input = container.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
        await act(async () => input.click());
        expect(input.checked).toBe(true);
        expect(input.disabled).toBe(false);
        expect(errorMessage).toHaveBeenCalled();
        expect(setQueryData).not.toHaveBeenCalled();
    });
});
