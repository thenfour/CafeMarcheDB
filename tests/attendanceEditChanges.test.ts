import { describe, expect, it } from "vitest";
import { parsePublicId } from "shared/publicId";
import { getAttendanceEditChanges } from "src/core/components/event/attendanceEditChanges";

const instrument = parsePublicId<"Instrument">("RetiredInstr0001");
const attendance = parsePublicId<"EventAttendance">("RetiredAnswer001");
const segment = parsePublicId<"EventSegment">("CancelledSet0001");
const initialEvent = { userComment: "", bandInstrumentId: instrument, isInvited: false };
const initialSegments = { [segment]: { attendanceId: attendance } };
const input = { initialEvent, event: initialEvent, initialSegments, segments: initialSegments, canManageInvitations: true };

describe("attendance dialog edits", () => {
    it("saves a comment without resubmitting a hidden instrument or retired/cancelled answer", () => {
        expect(getAttendanceEditChanges({ ...input, event: { ...initialEvent, userComment: "Keep history" } })).toEqual({ comment: "Keep history" });
    });
    it("clears instruments, invitations and segment answers explicitly and preserves blank comments", () => {
        expect(getAttendanceEditChanges({ ...input, initialEvent: { ...initialEvent, userComment: "Previous", isInvited: true },
            event: { ...initialEvent, bandInstrumentId: null, isInvited: null }, segments: { [segment]: { attendanceId: null } } }))
            .toEqual({ comment: "", instrumentId: null, isInvited: null, segmentResponses: { [segment]: { attendanceId: null } } });
    });
    it("submits only changed segments and leaves a delegate's invitation authority independent", () => {
        const other = parsePublicId<"EventSegment">("UnchangedSet0001");
        const segments = { [segment]: { attendanceId: null, publicId: "DisplayRow000001", isPersisted: true }, [other]: { attendanceId: null } };
        expect(getAttendanceEditChanges({ ...input, canManageInvitations: false, event: { ...initialEvent, isInvited: true },
            initialSegments: { ...initialSegments, [other]: { attendanceId: null } },
            segments }))
            .toEqual({ segmentResponses: { [segment]: { attendanceId: null } } });
    });
    it("does not materialize an unanswered response when the dialog is unchanged", () => {
        expect(getAttendanceEditChanges(input)).toEqual({});
    });
});
