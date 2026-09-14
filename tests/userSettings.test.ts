import { describe, expect, it } from "vitest";
import { isAttendanceGoing, isAttendanceNotGoing } from "shared/eventAttendance";
import { resolveUserSettings, UserSettingsPatchSchema } from "shared/userSettings";

describe("attendance classification", () => {
    it.each([0, 33, 49, 50, 51, 66, 100])("classifies strength %s at the strict going boundary", strength => {
        expect(isAttendanceGoing({ strength })).toBe(strength > 50);
        expect(isAttendanceNotGoing({ strength })).toBe(strength <= 50);
    });

    it.each([null, undefined])("does not treat an unanswered response as a decline (%s)", attendance => {
        expect(isAttendanceGoing(attendance)).toBe(false);
        expect(isAttendanceNotGoing(attendance)).toBe(false);
    });
});

describe("user settings registry", () => {
    it("resolves missing preferences without database rows and preserves false", () => {
        expect(resolveUserSettings()).toEqual({ "calendar.showDeclinedEvents": true, "calendar.showUninvitedEvents": true });
        expect(resolveUserSettings([{ name: "calendar.showDeclinedEvents", value: false }]))
            .toEqual({ "calendar.showDeclinedEvents": false, "calendar.showUninvitedEvents": true });
        expect(resolveUserSettings([{ name: "calendar.showUninvitedEvents", value: false }]))
            .toEqual({ "calendar.showDeclinedEvents": true, "calendar.showUninvitedEvents": false });
    });

    it("ignores retired keys and defaults invalid stored values without coercion", () => {
        expect(resolveUserSettings([
            { name: "calendar.showDeclinedEvents", value: "false" },
            { name: "calendar.showUninvitedEvents", value: "false" },
            { name: "retired.preference", value: 123 },
        ])).toEqual({ "calendar.showDeclinedEvents": true, "calendar.showUninvitedEvents": true });
    });

    it.each([
        { "calendar.showDeclinedEvents": "false" },
        { "calendar.showDeclinedEvents": null },
        { "calendar.showDeclinedEvents": 0 },
        { "calendar.showUninvitedEvents": "false" },
        { "calendar.showUninvitedEvents": null },
        { "calendar.showUninvitedEvents": 0 },
        { "unknown.setting": true },
        { userId: 123, "calendar.showDeclinedEvents": false },
        { calendar: { showDeclinedEvents: false } },
    ])("rejects an invalid settings patch: %j", patch => {
        expect(UserSettingsPatchSchema.safeParse(patch).success).toBe(false);
    });
});
