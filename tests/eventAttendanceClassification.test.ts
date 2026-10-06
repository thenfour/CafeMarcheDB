import { describe, expect, it } from "vitest";
import { isAttendanceGoing, isAttendanceNotGoing } from "shared/eventAttendance";

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

