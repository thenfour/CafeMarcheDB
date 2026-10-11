// @vitest-environment jsdom
import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AttendanceControlViewProps } from "src/core/components/event/AttendanceControlView";
import { DateTimeRange } from "shared/time";
import { eventPublicId, segmentPublicId } from "./support/eventResponseFixtures";
import { parsePublicId } from "shared/publicId";
import { userPublicId } from "./support/userFixtures";

vi.mock("src/core/db3/clientAPI", () => ({ API: { events: { updateUserEventAttendance: { useToken: () => ({ invoke }) } } } }));
vi.mock("src/core/components/event/EventComponentsBase", () => ({ CalcEventAttendance: () => ({ eventUserResponse: { user: { publicId: userPublicId(12) } } }) }));
vi.mock("src/core/components/event/AttendanceControlView", () => ({ AttendanceControlView: (props: AttendanceControlViewProps) => { view = props; return null; } }));
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({
    useDashboardContext: () => ({ requireBandPublicId: () => parsePublicId<"Band">("AttendanceBand01"), eventAttendance: { items: [] }, instrument: { items: [] } }),
    useFeatureRecorder: () => recordFeature,
}));
vi.mock("src/core/components/CMCoreComponents2", () => ({ AdminInspectObject: () => null }));
vi.mock("src/setting/client/components/SettingMarkdown", () => ({ BandLocalizedMarkdown: () => null }));

import { EventAttendanceControl, EventAttendanceControlProps } from "src/core/components/EventAttendanceComponents";
import { SnackbarContext } from "src/core/components/SnackbarContext";
const invoke = vi.fn(async () => undefined);
const recordFeature = vi.fn();
let view: AttendanceControlViewProps;
let renderedRoot: ReturnType<typeof createRoot> | undefined;
let environmentDescriptor: PropertyDescriptor | undefined;
afterEach(async () => {
    await act(async () => renderedRoot?.unmount());
    renderedRoot = undefined;
    if (environmentDescriptor) {
        Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", environmentDescriptor);
    } else {
        Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
    }
});

describe("production attendance adapter", () => {
    it("maps local changes to the selected band and public event/person mutation contract and refetches after each save", async () => {
        const instrumentId = parsePublicId<"Instrument">("AbCdEfGhIjKlMn42");
        environmentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT");
        Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
        const container = document.createElement("div");
        const root = createRoot(container);
        renderedRoot = root;
        const refetch = vi.fn();
        const showMessage = vi.fn();
        await act(async () => root.render(React.createElement(SnackbarContext.Provider, {
            value: { showMessage, showSuccess: vi.fn(), showError: vi.fn(), invokeAsync: vi.fn() },
        }, React.createElement(EventAttendanceControl, {
            // This adapter test mocks the metadata calculation, so only the fields read by the adapter are needed.
            eventData: {
                event: { publicId: eventPublicId(42), name: "Concert" },
                dateRange: new DateTimeRange({ startsAtDateTime: null, durationMillis: 0, isAllDay: false }),
            } as unknown as EventAttendanceControlProps["eventData"],
            userMap: [], onRefetch: refetch, minimalWhenNotAlert: true,
        }))));
        await view!.environment.onSave({ type: "segment", segmentId: segmentPublicId(7), attendanceId: null });
        await view!.environment.onSave({ type: "instrument", instrumentId });
        await view!.environment.onSave({ type: "comment", comment: "Need a lift" });
        expect(invoke.mock.calls).toEqual([
            [{ bandPublicId: parsePublicId<"Band">("AttendanceBand01"), eventId: eventPublicId(42), userId: userPublicId(12), segmentResponses: { [segmentPublicId(7)]: { attendanceId: null } } }],
            [{ bandPublicId: parsePublicId<"Band">("AttendanceBand01"), eventId: eventPublicId(42), userId: userPublicId(12), instrumentId }],
            [{ bandPublicId: parsePublicId<"Band">("AttendanceBand01"), eventId: eventPublicId(42), userId: userPublicId(12), comment: "Need a lift" }],
        ]);
        expect(refetch).toHaveBeenCalledTimes(3);
        expect(showMessage).toHaveBeenCalledTimes(3);
        expect(recordFeature).toHaveBeenCalledTimes(3);
        expect(view!.environment.allowUploads).toBe(true);
    });
});
