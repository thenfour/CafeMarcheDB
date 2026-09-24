import { describe, expect, it } from "vitest";
import { Timing } from "shared/time";
import {
    applyAttendanceScenarioChange, attendanceScenarioSchema, buildAttendanceScenario, createAttendanceScenario,
} from "src/core/components/event/attendanceScenario";
import { getInstrumentIdentity } from "src/core/db3/db3";

describe("attendance scenario adapter", () => {
    it("replays exported data including cleared answers, dates, comments, and explicit instruments", () => {
        const scenario = createAttendanceScenario();
        scenario.users[1] = { ...scenario.users[1]!, responses: [null, 3, "missing"], instrumentId: 4, comment: "Need a lift" };
        const restored = attendanceScenarioSchema.parse(JSON.parse(JSON.stringify(scenario)));
        expect(restored).toEqual(scenario);
        expect(buildAttendanceScenario(restored, 1)).toEqual(buildAttendanceScenario(scenario, 1));
    });

    it("uses real invitation resolution and primary-instrument defaults", () => {
        const scenario = createAttendanceScenario();
        scenario.users[0]!.individualInvitation = false;
        expect(buildAttendanceScenario(scenario, 0).attendance.isInvited).toBe(true);
        scenario.users[0]!.tagInvited = false;
        expect(buildAttendanceScenario(scenario, 0).attendance.isInvited).toBe(false);
        scenario.users[1]!.primaryInstrumentId = 2;
        expect(getInstrumentIdentity(buildAttendanceScenario(scenario, 1).attendance.eventUserResponse.instrument!)).toBe(2);
        scenario.users[1]!.instrumentId = 4;
        expect(getInstrumentIdentity(buildAttendanceScenario(scenario, 1).attendance.eventUserResponse.instrument!)).toBe(4);
    });

    it.each([["past", Timing.Past], ["ongoing", Timing.Present], ["future", Timing.Future], ["tbd", Timing.Future]] as const)(
        "builds %s relative to the exported clock", (timing, expected) => {
            const scenario = createAttendanceScenario();
            scenario.timing = timing;
            expect(buildAttendanceScenario(scenario, 0).attendance.eventTiming).toBe(expected);
        });

    it("uses production aggregate dates, ignoring cancelled segments", () => {
        const scenario = createAttendanceScenario();
        scenario.segments = [{ cancelled: false, timing: "past" }, { cancelled: false, timing: "future" }];
        expect(buildAttendanceScenario(scenario, 0).attendance.eventTiming).toBe(Timing.Present);
        scenario.segments[1]!.cancelled = true;
        const { attendance } = buildAttendanceScenario(scenario, 0);
        expect(attendance.eventTiming).toBe(Timing.Past);
        expect(attendance.uncancelledSegmentUserResponses.map(r => r.segment.id)).toEqual([1]);
    });

    it("handles zero and all-cancelled segments without inventing controls", () => {
        const scenario = createAttendanceScenario();
        scenario.segments.forEach(segment => { segment.cancelled = true; });
        expect(buildAttendanceScenario(scenario, 0).attendance.visible).toBe(false);
        scenario.segments = [];
        expect(buildAttendanceScenario(scenario, 0).attendance.noSegments).toBe(true);
        expect(buildAttendanceScenario(scenario, 0).attendance.visible).toBe(false);
    });

    it("updates only the chosen field and segment, preserving the fixture being reset to", () => {
        const person = createAttendanceScenario().users[1]!;
        const answered = applyAttendanceScenarioChange(person, { type: "segment", segmentId: 2, attendanceId: 1 });
        const commented = applyAttendanceScenarioChange(answered, { type: "comment", comment: "Local comment" });
        const instrument = applyAttendanceScenarioChange(commented, { type: "instrument", instrumentId: 2 });
        expect(person.responses).toEqual([3, "missing", "missing"]);
        expect(instrument).toEqual({ ...person, responses: [3, 1, "missing"], comment: "Local comment", instrumentId: 2 });
    });

    it("rejects invalid imports before replacing a working scenario", () => {
        const scenario = createAttendanceScenario();
        expect(attendanceScenarioSchema.safeParse({ ...scenario, now: "not a date" }).success).toBe(false);
        expect(attendanceScenarioSchema.safeParse({ ...scenario, version: 999 }).success).toBe(false);
        scenario.users[0]!.responses[0] = 999 as never;
        expect(attendanceScenarioSchema.safeParse(scenario).success).toBe(false);
    });
});
