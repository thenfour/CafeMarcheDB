import { describe, expect, it } from "vitest";
import { isAttendanceGoing, isAttendanceNotGoing } from "shared/eventAttendance";
import { kUserSettingsRegistry } from "src/setting/shared/userSettingsRegistry";
import { getSettingDefinition, SettingCommandSchema, validateSettingValue } from "src/setting/shared/settingsContract";

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

describe("registered user preferences", () => {
    it.each(["calendar.showDeclinedEvents", "calendar.showUninvitedEvents"] as const)("defaults %s to true and preserves native false", key => {
        expect(kUserSettingsRegistry[key].defaultValue).toBe(true);
        expect(validateSettingValue("user", key, false)).toBe(false);
        expect(validateSettingValue("user", key, true)).toBe(true);
    });

    it.each(["false", null, 0, {}, []])("rejects invalid native preferences without coercion: %j", value => {
        for (const key of Object.keys(kUserSettingsRegistry)) {
            expect(() => validateSettingValue("user", key, value)).toThrow();
        }
    });

    it.each(["unknown.setting", "calendar", "__proto__", "Calendar.showDeclinedEvents"])("rejects the unregistered key %s", key => {
        expect(() => getSettingDefinition("user", key)).toThrow("Unknown user setting");
    });

    it.each([
        { userId: 123 }, { bandUserId: 123 }, { calendar: { showDeclinedEvents: false } }, { value: false },
    ])("does not accept ownership or patch fields outside the explicit command: %j", extra => {
        expect(SettingCommandSchema.safeParse({ hive: "user", key: "calendar.showDeclinedEvents",
            operation: { kind: "set", value: false }, ...extra }).success).toBe(false);
    });

    it("requires a value for set and a separate value-free reset", () => {
        const command = { hive: "user", key: "calendar.showDeclinedEvents" };
        expect(SettingCommandSchema.safeParse({ ...command, operation: { kind: "set" } }).success).toBe(false);
        expect(SettingCommandSchema.safeParse({ ...command, operation: { kind: "reset", value: false } }).success).toBe(false);
        expect(SettingCommandSchema.safeParse({ ...command, operation: { kind: "reset" } }).success).toBe(true);
    });
});
