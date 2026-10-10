import { describe, expect, it } from "vitest";
import { Timing } from "shared/time";
import { parsePublicId } from "shared/publicId";
import {
    applyAttendanceScenarioChange,
    scenarioAttendances, attendanceScenarioSchema, buildAttendanceScenario, createAttendanceScenario,
    scenarioInstruments, scenarioSegmentPublicId,
    type AttendanceScenario,
} from "src/core/components/event/attendanceScenario";

describe("attendance scenario adapter", () => {
    it.each(["past", "ongoing", "future", "tbd"] as const)("retains the attendance interaction matrix for %s events", timing => {
        const cases = [
            { answers: ["missing", "missing", "missing"], invited: false, visible: false, answered: false, instrument: false },
            { answers: [null, null, null], invited: true, visible: true, answered: false, instrument: false },
            { answers: [3, "missing", "missing"], invited: true, visible: true, answered: false, instrument: false },
            { answers: [1, 1, "missing"], invited: true, visible: true, answered: true, instrument: false },
            { answers: [3, 1, "missing"], invited: false, visible: true, answered: true, instrument: true },
            { answers: [2, 3, "missing"], invited: true, visible: true, answered: true, instrument: true },
        ] satisfies { answers: AttendanceScenario["users"][number]["responses"]; invited: boolean; visible: boolean; answered: boolean; instrument: boolean }[];
        for (const entry of cases) {
            const scenario = createAttendanceScenario();
            scenario.timing = timing;
            scenario.users[1]!.tagInvited = entry.invited;
            scenario.users[1]!.responses = entry.answers;
            const { attendance } = buildAttendanceScenario(scenario, 1);
            expect(attendance).toMatchObject({ visible: entry.visible, allUncancelledSegmentsAnswered: entry.answered,
                allowInstrumentSelect: entry.instrument, alertFlag: entry.invited && !entry.answered && timing !== "past" });
        }
    });

    it("ignores cancelled unanswered segments and uses the first assigned instrument when no primary is set", () => {
        const scenario = createAttendanceScenario();
        scenario.segments[1]!.cancelled = true;
        scenario.users[1]!.primaryInstrumentId = null;
        const { attendance } = buildAttendanceScenario(scenario, 1);
        expect(attendance).toMatchObject({ isSingleSegment: true, alertFlag: false, allowInstrumentSelect: true });
        expect(attendance.eventUserResponse?.instrument?.publicId).toBe(scenarioInstruments[0]!.publicId);
        scenario.users[1]!.instrumentCount = 0;
        expect(buildAttendanceScenario(scenario, 1).attendance.eventUserResponse?.instrument).toBeNull();
    });
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
        expect(buildAttendanceScenario(scenario, 1).attendance.eventUserResponse?.instrument?.publicId)
            .toBe(scenarioInstruments[1]!.publicId);
        scenario.users[1]!.instrumentId = 4;
        expect(buildAttendanceScenario(scenario, 1).attendance.eventUserResponse?.instrument?.publicId)
            .toBe(scenarioInstruments[3]!.publicId);
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
        expect(attendance.uncancelledSegmentUserResponses.map(r => r.segment.publicId)).toEqual([scenarioSegmentPublicId(0)]);
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
        const answered = applyAttendanceScenarioChange(person, { type: "segment", segmentId: scenarioSegmentPublicId(1), attendanceId: scenarioAttendances[0]!.publicId });
        const commented = applyAttendanceScenarioChange(answered, { type: "comment", comment: "Local comment" });
        const instrument = applyAttendanceScenarioChange(commented, { type: "instrument", instrumentId: scenarioInstruments[1]!.publicId });
        expect(person.responses).toEqual([3, "missing", "missing"]);
        expect(instrument).toEqual({ ...person, responses: [3, 1, "missing"], comment: "Local comment", instrumentId: 2 });
    });

    it("clears stored instruments and rejects public identities outside the scenario catalog", () => {
        const person = { ...createAttendanceScenario().users[1]!, instrumentId: 2 };
        expect(applyAttendanceScenarioChange(person, { type: "instrument", instrumentId: null }))
            .toEqual({ ...person, instrumentId: null });
        expect(() => applyAttendanceScenarioChange(person, {
            type: "instrument", instrumentId: parsePublicId<"Instrument">("OtherInstrument1"),
        })).toThrow();
        expect(person.instrumentId).toBe(2);
    });

    it("rejects invalid imports before replacing a working scenario", () => {
        const scenario = createAttendanceScenario();
        expect(attendanceScenarioSchema.safeParse({ ...scenario, now: "not a date" }).success).toBe(false);
        expect(attendanceScenarioSchema.safeParse({ ...scenario, version: 999 }).success).toBe(false);
        scenario.users[0]!.responses[0] = 999 as never;
        expect(attendanceScenarioSchema.safeParse(scenario).success).toBe(false);
    });
});
