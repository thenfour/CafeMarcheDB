// @vitest-environment jsdom
import React from "react";
import { act, Simulate } from "react-dom/test-utils";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("src/core/db3/db3", () => ({ xUser: { getRowInfo: (user: any) => ({ pk: user.id, name: user.name }) }, xEvent: { authorizeColumnForEdit: vi.fn() } }));
vi.mock("src/core/db3/clientAPI", () => ({ API: { events: { updateEventBasicFields: { useToken: vi.fn() } } } }));
vi.mock("src/core/db3/components/DB3ClientCore", () => ({ fetchUnsuspended: vi.fn() }));
vi.mock("src/core/db3/components/useCrudViewCreate", () => ({ useCrudViewCreate: vi.fn() }));
vi.mock("src/core/db3/components/useDB3Authorization", () => ({ useDB3Authorization: () => ({}) }));
vi.mock("src/core/db3/components/IconMap", () => ({ RenderMuiIcon: (icon: string) => icon ? React.createElement("svg", { "data-icon": icon, "aria-hidden": true }) : null, gIconMap: { Lock: () => null, Add: () => null } }));
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({ useDashboardContext: vi.fn(), useFeatureRecorder: vi.fn() }));
vi.mock("src/core/components/SettingMarkdown", () => ({ SettingMarkdown: () => null, GenerateDefaultDescriptionSettingName: () => "description" }));
vi.mock("src/core/components/CMLink", () => ({ CMLink: () => null }));
vi.mock("src/core/db3/queries/getUser", () => ({ default: vi.fn() }));
vi.mock("@blitzjs/rpc", () => ({ useQuery: vi.fn() }));

import * as db3 from "src/core/db3/db3";
import { API } from "src/core/db3/clientAPI";
import { fetchUnsuspended } from "src/core/db3/components/DB3ClientCore";
import { IconEditCell } from "src/core/db3/components/IconSelectDialog";
import { useDashboardContext, useFeatureRecorder } from "src/core/components/dashboardContext/DashboardContext";
import { EventAttendanceUserTagControl } from "src/core/components/event/EventAttendanceUserTagControl";
import { VisibilityControl } from "src/core/components/VisibilityControl";
import { AddUserButton } from "src/core/components/user/UserComponents";

const permissions = [
    { id: 1, name: "Members", isVisibility: true, description: "Band members", iconName: "Group" },
    { id: 2, name: "Public", isVisibility: true, description: "Everyone", iconName: "Public" },
    { id: 3, name: "Hidden", isVisibility: true },
    { id: 4, name: "Manage events", isVisibility: false },
];
const tags = [{ id: 1, text: "Performers", color: "blue" }, { id: 2, text: "Volunteers", color: "green" }];
const users = [{ id: 1, name: "Alex Martin" }, { id: 2, name: "Sam Dupont" }, { id: 3, name: "Already invited" }];
const event = { id: 10, createdByUserId: 4, expectedAttendanceUserTag: tags[0] } as any;
const onChange = vi.fn();
const mutate = vi.fn();
const refetch = vi.fn();
const recordFeature = vi.fn();
let queryError = false;
let root: Root;
const originalActEnvironment = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT");
beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    document.body.innerHTML = "<div id='root'></div>";
    root = createRoot(document.getElementById("root")!);
    queryError = false;
    vi.mocked(useDashboardContext).mockReturnValue({
        permission: { items: permissions, getById: (id: number) => permissions.find(p => p.id === id) },
        userTag: { items: tags }, isAuthorized: (name: string) => name !== "Hidden",
        routingApi: { getURIForUser: () => "/user" },
        getVisibilityInfo: () => ({ className: "visibility", getStyleVariablesForColor: () => ({ cssClass: "", style: {} }) }),
    } as any);
    vi.mocked(db3.xEvent.authorizeColumnForEdit).mockReturnValue(true);
    vi.mocked(useFeatureRecorder).mockReturnValue(recordFeature);
    mutate.mockResolvedValue({});
    vi.mocked(API.events.updateEventBasicFields.useToken).mockReturnValue({ invoke: mutate } as any);
    vi.mocked(fetchUnsuspended).mockImplementation((args: any) => ({
        items: users.filter(user => user.name.toLowerCase().includes(args.filterModel.quickFilterValues.join(" ").toLowerCase())),
        isLoading: false, refetch, queryResult: { isError: queryError, isFetching: false, isPreviousData: false },
    }) as any);
});
afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
    if (originalActEnvironment) Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", originalActEnvironment);
    else Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});
const button = (name: string) => [...document.querySelectorAll("button")].find(b => (b.getAttribute("aria-label") || b.textContent)?.trim() === name)!;
const render = async (element: React.ReactElement) => { await act(async () => root.render(element)); };
const click = async (element: HTMLElement) => { await act(async () => element.click()); };
const search = async (value: string) => { await act(async () => Simulate.change(document.querySelector<HTMLInputElement>('input[type=search]')!, { target: { value } } as any)); };
const icon = (props = {}) => React.createElement(IconEditCell, { value: "Alarm", readonly: false, allowNull: true, validationError: null, onOK: onChange, ...props });

describe("migrated domain pickers", () => {
    it("searches named icons, accepts the current choice, and clears with actual null", async () => {
        await render(icon());
        expect(button("Edit Icon").parentElement?.classList.contains("CMChipContainer")).toBe(true);
        await click(button("Edit Icon"));
        expect(button("Alarm icon").querySelector('[data-icon="Alarm"]')).not.toBeNull();
        await click(button("Alarm icon"));
        expect(onChange).toHaveBeenCalledWith("Alarm");
        expect(document.querySelector('[role=dialog]')).toBeNull();
        await click(button("Edit Icon"));
        await search("volume");
        expect(button("Alarm icon")).toBeUndefined();
        expect(button("VolumeUp icon")).toBeDefined();
        await click(button("No icon"));
        expect(onChange).toHaveBeenLastCalledWith(null);
    });

    it("keeps required icons required, shows validation, and respects read-only", async () => {
        await render(icon({ allowNull: false, value: null, validationError: "Choose an icon" }));
        const field = document.querySelector('[role=group]')!;
        expect(document.getElementById(field.getAttribute("aria-describedby")!)?.textContent).toBe("Choose an icon");
        await click(button("Select Icon"));
        expect(button("No icon")).toBeUndefined();
        await click(button("Cancel"));
        expect(onChange).not.toHaveBeenCalled();
        await render(icon({ readonly: true }));
        expect(document.querySelector("button")).toBeNull();
    });

    it("does not publish or restore an earlier field value when Cancel is pressed", async () => {
        await render(icon());
        await render(icon({ value: "VolumeUp" }));
        await click(button("Edit Icon"));
        await search("Alarm");
        await click(button("Cancel"));
        expect(onChange).not.toHaveBeenCalled();
        expect(document.querySelector('[role=dialog]')).toBeNull();
        expect(document.getElementById("root")?.textContent).toContain("VolumeUp");
    });

    it("keeps visibility choices permission-filtered with verbose options and explicit Private", async () => {
        await render(React.createElement(VisibilityControl, { value: 1, variant: "minimal", onChange }));
        expect(document.querySelector('.VisibilityControl .visibilityValue.minimal')).not.toBeNull();
        await click(button("Edit Who can see this"));
        expect(button("Members").querySelector('.visibilityValue.verbose')).not.toBeNull();
        expect(button("Hidden")).toBeUndefined();
        expect(button("Manage events")).toBeUndefined();
        await search("PUBLIC");
        expect(button("Members")).toBeUndefined();
        await click(button("Public"));
        expect(onChange).toHaveBeenLastCalledWith(permissions[1]);
        await click(button("Edit Who can see this"));
        await click(button("Private"));
        expect(onChange).toHaveBeenLastCalledWith(null);
    });

    it("displays read-only visibility without an edit control", async () => {
        await render(React.createElement(VisibilityControl, { value: null, onChange, readonly: true }));
        expect(document.querySelector('.visibilityValue')?.textContent).toContain("private");
        expect(document.querySelector("button")).toBeNull();
    });

    it("preserves attendance mutation, telemetry and refresh while Cancel does nothing", async () => {
        await render(React.createElement(EventAttendanceUserTagControl, { event, readonly: false, refetch }));
        await click(button("Edit Expected attendance group"));
        expect(button("Performers").querySelectorAll('.CMChip')).toHaveLength(1);
        await click(button("Cancel"));
        expect(mutate).not.toHaveBeenCalled();
        await click(button("Edit Expected attendance group"));
        await search("volun");
        await click(button("Volunteers"));
        expect(mutate).toHaveBeenCalledWith({ eventId: 10, expectedAttendanceUserTagId: 2 });
        expect(recordFeature).toHaveBeenCalledTimes(1);
        expect(refetch).toHaveBeenCalledTimes(1);
        await click(button("Edit Expected attendance group"));
        await click(button("No tags are invited"));
        expect(mutate).toHaveBeenLastCalledWith({ eventId: 10, expectedAttendanceUserTagId: null });
    });

    it("blocks attendance editing for read-only callers and denied column authorization", async () => {
        await render(React.createElement(EventAttendanceUserTagControl, { event, readonly: true, refetch }));
        expect(document.querySelector("button")).toBeNull();
        vi.mocked(db3.xEvent.authorizeColumnForEdit).mockReturnValue(false);
        await render(React.createElement(EventAttendanceUserTagControl, { event, readonly: false, refetch }));
        expect(document.querySelector("button")).toBeNull();
        expect(mutate).not.toHaveBeenCalled();
    });

    it("loads Add User only when opened, keeps caller exclusions and user chips, and returns the selected record", async () => {
        await render(React.createElement(AddUserButton, { onSelect: onChange, filterPredicate: user => user.id !== 3 }));
        expect(fetchUnsuspended).not.toHaveBeenCalled();
        await click(button("Add users"));
        expect(button("Already invited")).toBeUndefined();
        expect(button("None")).toBeUndefined();
        expect(button("Alex Martin").querySelectorAll('.CMChip')).toHaveLength(1);
        expect(button("Alex Martin").querySelector("a")).toBeNull();
        await search("Sam");
        expect(vi.mocked(fetchUnsuspended).mock.calls.at(-1)![0].filterModel?.quickFilterValues).toEqual(["sam"]);
        await click(button("Sam Dupont"));
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(users[1]);
        expect(document.querySelector('[role=dialog]')).toBeNull();
    });

    it("exposes Add User query errors and retry, with no selection callback on Cancel", async () => {
        queryError = true;
        await render(React.createElement(AddUserButton, { onSelect: onChange }));
        await click(button("Add users"));
        expect(button("Alex Martin")).toBeUndefined();
        await click(button("Retry"));
        expect(refetch).toHaveBeenCalledTimes(1);
        await click(button("Cancel"));
        expect(onChange).not.toHaveBeenCalled();
    });
});
