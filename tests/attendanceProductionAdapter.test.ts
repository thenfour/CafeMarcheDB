// @vitest-environment jsdom
import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { AttendanceControlViewProps } from "src/core/components/event/AttendanceControlView";
import { DateTimeRange } from "shared/time";
import { parsePublicId } from "shared/publicId";

vi.mock("src/core/db3/clientAPI", () => ({ API: { events: { updateUserEventAttendance: { useToken: () => ({ invoke }) } } } }));
vi.mock("src/core/components/event/EventComponentsBase", () => ({ CalcEventAttendance: () => ({ eventUserResponse: { user: { id: 12 } } }) }));
vi.mock("src/core/components/event/AttendanceControlView", () => ({ AttendanceControlView: (props: AttendanceControlViewProps) => { view = props; return null; } }));
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({
    useDashboardContext: () => ({ eventAttendance: { items: [] }, instrument: { items: [] } }),
    useFeatureRecorder: () => recordFeature,
}));
vi.mock("src/core/components/CMCoreComponents2", () => ({ AdminInspectObject: () => null }));
vi.mock("src/core/components/SettingMarkdown", () => ({ SettingMarkdown: () => null }));

import { EventAttendanceControl, EventAttendanceControlProps } from "src/core/components/EventAttendanceComponents";
import { SnackbarContext } from "src/core/components/SnackbarContext";
const invoke = vi.fn(async () => undefined);
const recordFeature = vi.fn();
let view: AttendanceControlViewProps;

describe("production attendance adapter", () => {
    it("maps local changes to the original event/user mutation contract and refetches after each save", async () => {
        const instrumentId = parsePublicId<"Instrument">("AbCdEfGhIjKlMn42");
        const descriptor = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT");
        Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
        const container = document.createElement("div");
        const root = createRoot(container);
        const refetch = vi.fn();
        const showMessage = vi.fn();
        try {
            await act(async () => root.render(React.createElement(SnackbarContext.Provider, {
                value: { showMessage, showSuccess: vi.fn(), showError: vi.fn(), invokeAsync: vi.fn() },
            }, React.createElement(EventAttendanceControl, {
                eventData: {
                    event: { id: 42, name: "Concert" },
                    dateRange: new DateTimeRange({ startsAtDateTime: null, durationMillis: 0, isAllDay: false }),
                } as EventAttendanceControlProps["eventData"],
                userMap: [], onRefetch: refetch, minimalWhenNotAlert: true,
            }))));
            await view!.environment.onSave({ type: "segment", segmentId: 7, attendanceId: null });
            await view!.environment.onSave({ type: "instrument", instrumentId });
            await view!.environment.onSave({ type: "comment", comment: "Need a lift" });
            expect(invoke.mock.calls).toEqual([
                [{ eventId: 42, userId: 12, segmentResponses: { 7: { attendanceId: null } } }],
                [{ eventId: 42, userId: 12, instrumentId }],
                [{ eventId: 42, userId: 12, comment: "Need a lift" }],
            ]);
            expect(refetch).toHaveBeenCalledTimes(3);
            expect(showMessage).toHaveBeenCalledTimes(3);
            expect(recordFeature).toHaveBeenCalledTimes(3);
            expect(view!.environment.allowUploads).toBe(true);
        } finally {
            await act(async () => root.unmount());
            if (descriptor) Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", descriptor);
            else Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
        }
    });
});
