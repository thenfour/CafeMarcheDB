// @vitest-environment jsdom
import { createTestRouter } from "./support/routing";
import { parsePortalPath } from "src/route/portalRouting";
vi.mock("src/route/useCmdbRouter", () => ({ useCmdbRouter: () => createTestRouter({ baseUri: "https://test", hosting: { kind: "multiBand" }, requestPath: parsePortalPath("/b/FixtureBand00001", { kind: "multiBand" }) }) }));
import React from "react";
import { act, Simulate } from "react-dom/test-utils";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parsePublicId } from "shared/publicId";
import { userPublicId } from "./support/userFixtures";
import { userTagReferenceFixture } from "./support/catalogReferenceFixtures";

vi.mock("src/core/db3/db3", async () => {
    const actual = await vi.importActual<typeof import("src/core/db3/db3")>("src/core/db3/db3");
    return {
        ...actual,
        xEvent: Object.assign(actual.xEvent, { authorizeColumnForEdit: vi.fn() }),
    };
});
vi.mock("src/core/db3/clientAPI", () => ({ API: { events: { updateEventBasicFields: { useToken: vi.fn() } } } }));
vi.mock("src/core/db3/components/DB3ClientCore", async () => ({ ...await vi.importActual<typeof import("src/core/db3/components/DB3ClientCore")>("src/core/db3/components/DB3ClientCore"),
    fetchUnsuspended: vi.fn(), useTableRenderContext: vi.fn() }));
vi.mock("src/core/db3/components/useCrudViewCreate", () => ({ useCrudViewCreate: vi.fn() }));
vi.mock("src/core/db3/components/useDB3Authorization", () => ({ useDB3Authorization: () => ({}) }));
vi.mock("src/core/db3/components/IconMap", async () => ({ ...await vi.importActual<typeof import("src/core/db3/components/IconMap")>("src/core/db3/components/IconMap"),
    RenderMuiIcon: (icon: string) => icon ? React.createElement("svg", { "data-icon": icon, "aria-hidden": true }) : null }));
vi.mock("src/core/db3/components/useDB3Context", () => ({ useDB3QueryContext: () => ({ bandPublicId: "FixtureBand00001" }) }));
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({ useDashboardContext: vi.fn(), useFeatureRecorder: vi.fn() }));
vi.mock("src/setting/client/components/SettingMarkdown", () => ({ LocalizedMarkdown: () => null, BandLocalizedMarkdown: () => null }));
vi.mock("src/core/components/CMLink", () => ({ CMLink: () => null }));
vi.mock("src/core/db3/queries/getUser", () => ({ default: vi.fn() }));
vi.mock("@blitzjs/rpc", async () => ({ ...await vi.importActual<typeof import("@blitzjs/rpc")>("@blitzjs/rpc"), useQuery: vi.fn() }));

import * as db3 from "src/core/db3/db3";
import { API } from "src/core/db3/clientAPI";
import { useTableRenderContext } from "src/core/db3/components/DB3ClientCore";
import { IconEditCell } from "src/core/db3/components/IconSelectDialog";
import { useDashboardContext, useFeatureRecorder } from "src/core/components/dashboardContext/DashboardContext";
import { EventAttendanceUserTagControl } from "src/core/components/event/EventAttendanceUserTagControl";
import { VisibilityControl } from "src/core/components/VisibilityControl";
import { AddUserButton } from "src/core/components/user/UserComponents";

const permissions = [
    { publicId: parsePublicId<"Permission">("PermissionMem001"), name: "Members", isVisibility: true, description: "Band members", iconName: "Group" },
    { publicId: parsePublicId<"Permission">("PermissionPub001"), name: "Public", isVisibility: true, description: "Everyone", iconName: "Public" },
    { publicId: parsePublicId<"Permission">("PermissionHid001"), name: "Hidden", isVisibility: true },
    { publicId: parsePublicId<"Permission">("PermissionMng001"), name: "Manage events", isVisibility: false },
];
const tags: db3.UserTagDisplay[] = [
    userTagReferenceFixture(parsePublicId<"UserTag">("UserTagPublic001"), "Performers"),
    userTagReferenceFixture(parsePublicId<"UserTag">("UserTagPublic002"), "Volunteers"),
];
const users = [
    { publicId: userPublicId(1), name: "Alex Martin" },
    { publicId: userPublicId(2), name: "Sam Dupont" },
    { publicId: userPublicId(3), name: "Already invited" },
];
const membershipRows = users.map((user, index) => db3.eventParticipantView.parseDto({
    publicId: `SelectMember${String(index).padStart(4, "0")}`, userId: user.publicId,
    user: { ...user, cssClass: null }, bandUserInstruments: [], bandUserTagAssignments: [],
}));
const participants = membershipRows.map(db3.eventParticipantFromMembership);
const eventPublicId = parsePublicId<"Event">("EventPublic00010");
const bandPublicId = parsePublicId<"Band">("FixtureBand00001");
const event: React.ComponentProps<typeof EventAttendanceUserTagControl>["event"] = {
    publicId: eventPublicId,
    createdByUser: { publicId: userPublicId(4) },
    expectedAttendanceUserTag: tags[0]!,
};
const onChange = vi.fn();
const mutate = vi.fn();
const refetch = vi.fn();
const recordFeature = vi.fn();
let root: Root;
const originalActEnvironment = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT");
beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    document.body.innerHTML = "<div id='root'></div>";
    root = createRoot(document.getElementById("root")!);
    vi.mocked(useDashboardContext).mockReturnValue({
        portalHosting: { kind: "platform" },
        permission: { items: permissions, getById: (id: string) => permissions.find(p => p.publicId === id) },
        userTag: { items: tags, getById: (id: string) => tags.find(tag => tag.publicId === id) }, isAuthorized: (name: string) => name !== "Hidden",
        routingApi: { getURIForUser: () => "/user" },
        requireBandPublicId: () => bandPublicId,
        getVisibilityInfo: () => ({ className: "visibility", getStyleVariablesForColor: () => ({ cssClass: "", style: {} }) }),
    } as any);
    vi.mocked(db3.xEvent.authorizeColumnForEdit).mockReturnValue(true);
    vi.mocked(useFeatureRecorder).mockReturnValue(recordFeature);
    mutate.mockResolvedValue({});
    vi.mocked(API.events.updateEventBasicFields.useToken).mockReturnValue({ invoke: mutate } as any);
    // Only the selected membership rows are consumed from this full grid-hook contract.
    vi.mocked(useTableRenderContext).mockReturnValue({ items: membershipRows } as unknown as ReturnType<typeof useTableRenderContext>);
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
        await render(React.createElement(VisibilityControl, { value: permissions[0]!.publicId, variant: "minimal", onChange }));
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
        expect(mutate).toHaveBeenCalledWith({ eventId: eventPublicId, bandPublicId, expectedAttendanceUserTagId: "UserTagPublic002" });
        expect(recordFeature).toHaveBeenCalledTimes(1);
        expect(refetch).toHaveBeenCalledTimes(1);
        await click(button("Edit Expected attendance group"));
        await click(button("No tags are invited"));
        expect(mutate).toHaveBeenLastCalledWith({ eventId: eventPublicId, bandPublicId, expectedAttendanceUserTagId: null });
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
        await render(React.createElement(AddUserButton, { onSelect: onChange, filterPredicate: user => user.publicId !== userPublicId(3) }));
        expect(useTableRenderContext).not.toHaveBeenCalled();
        await click(button("Add users"));
        expect(button("Already invited")).toBeUndefined();
        expect(button("None")).toBeUndefined();
        expect(button("Alex Martin").querySelectorAll('.CMChip')).toHaveLength(1);
        expect(button("Alex Martin").querySelector("a")).toBeNull();
        await search("Sam");
        expect(button("Alex Martin")).toBeUndefined();
        expect(vi.mocked(useTableRenderContext).mock.calls.at(-1)![0].tableSpec.args.view).toBe(db3.eventParticipantView);
        await click(button("Sam Dupont"));
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(participants[1]);
        expect(document.querySelector('[role=dialog]')).toBeNull();
    });

    it("keeps Add User empty without membership rows and calls no selection on Cancel", async () => {
        // The picker consumes only items from this grid-hook contract.
        vi.mocked(useTableRenderContext).mockReturnValue({ items: [] } as unknown as ReturnType<typeof useTableRenderContext>);
        await render(React.createElement(AddUserButton, { onSelect: onChange }));
        await click(button("Add users"));
        expect(button("Alex Martin")).toBeUndefined();
        await click(button("Cancel"));
        expect(onChange).not.toHaveBeenCalled();
    });
});
