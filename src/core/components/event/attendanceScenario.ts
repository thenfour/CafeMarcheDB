import { z } from "zod";
import { gGeneralPaletteList } from "@/src/core/components/color/palette";
import { parsePublicId } from "shared/publicId";
import * as db3 from "src/core/db3/db3";
import { getEventResponseForUser, getEventSegmentResponseForSegmentAndUser } from "src/core/db3/shared/schema/eventAPI";
import { getEventDateTimeRangeFromSegments } from "src/core/db3/shared/schema/event";
import { calculateEventAttendance } from "./attendanceCalculation";
import type { AttendanceChange } from "./AttendanceControlView";

const timing = z.enum(["past", "ongoing", "future", "tbd"]);
const response = z.union([z.literal("missing"), z.null(), z.literal(1), z.literal(2), z.literal(3)]);
const instrumentId = z.number().int().min(1).max(4).nullable();
const segmentSchema = z.object({ cancelled: z.boolean(), timing: z.union([timing, z.literal("inherit")]) });
const userSchema = z.object({
    name: z.string(),
    tagInvited: z.boolean(), individualInvitation: z.boolean().nullable(),
    instrumentCount: z.number().int().min(0).max(3),
    primaryInstrumentId: instrumentId, instrumentId,
    comment: z.string(),
    responses: z.array(response).length(3),
});

export const attendanceScenarioSchema = z.object({
    version: z.literal(1),
    now: z.string().datetime().refine(value => Number.isFinite(Date.parse(value)), "Clock must be a valid date"),
    eventName: z.string(),
    timing, cancelled: z.boolean(),
    segments: z.array(segmentSchema).max(3),
    //presentation: z.enum(["list", "detail", "both"]),
    users: z.array(userSchema).min(1).max(8),
});
export type AttendanceScenario = z.infer<typeof attendanceScenarioSchema>;
export type AttendanceScenarioUser = z.infer<typeof userSchema>;
export type AttendanceScenarioSegment = z.infer<typeof segmentSchema>;

// Stable synthetic IDs never leave the local adapter. Options are deliberately
// self-contained: changing the site's DB options cannot change a saved scenario.
export const scenarioSegmentPublicId = (index: number) => db3.xEventSegment.parseIdentity(`ScnSegment${String(index + 1).padStart(6, "0")}`);
export const scenarioEventPublicId = db3.xEvent.parseIdentity("ScenarioEvent001");

export const scenarioAttendances: db3.EventAttendanceDisplay[] = [
    { id: 1, text: "No", strength: 0, color: "attendance_no", iconName: "Cancel", description: "I cannot attend." },
    { id: 2, text: "Probably", strength: 66, color: "attendance_yes_maybe", iconName: "HelpOutline", description: "I will probably attend." },
    { id: 3, text: "Yes", strength: 100, color: "attendance_yes", iconName: "CheckCircleOutline", description: "I will attend." },
].map((option, sortOrder) => ({
    publicId: db3.xEventAttendance.parseIdentity(`scenarioAttend0${option.id}`),
    text: option.text, strength: option.strength, iconName: option.iconName, description: option.description,
    color: gGeneralPaletteList.findEntry(option.color), sortOrder, isActive: true, isDeleted: false,
    personalText: "", pastText: "", pastPersonalText: ""
}));

export const scenarioInstruments: db3.InstrumentPayload[] = ["Trumpet", "Saxophone", "Percussion", "Tuba"].map((name, index) => ({
    id: index + 1,
    publicId: `sceninst${String(index + 1).padStart(8, "0")}`,
    name, sortOrder: index, description: name, autoAssignFileLeafRegex: null,
    functionalGroupId: 1, instrumentTags: [],
    functionalGroup: { id: 1, publicId: "scenario_group01", name: "Band", sortOrder: 0, description: "Scenario instruments", color: "blue" },
}));

export const scenarioClientInstruments: db3.InstrumentClientPayload[] = scenarioInstruments.map(instrument => ({
    publicId: parsePublicId<"Instrument">(instrument.publicId),  // fictional, don't need to use xInstrument
    name: instrument.name,
    description: instrument.description,
    sortOrder: instrument.sortOrder,
    autoAssignFileLeafRegex: instrument.autoAssignFileLeafRegex,
    functionalGroupId: parsePublicId<"InstrumentFunctionalGroup">(
        instrument.functionalGroup.publicId,
    ),
    functionalGroup: {
        publicId: parsePublicId<"InstrumentFunctionalGroup">(
            instrument.functionalGroup.publicId,
        ),
        name: instrument.functionalGroup.name,
        description: instrument.functionalGroup.description,
        sortOrder: instrument.functionalGroup.sortOrder,
        color: gGeneralPaletteList.findEntry(instrument.functionalGroup.color),
    },
    instrumentTags: [],
}));

export const createAttendanceScenario = (): AttendanceScenario => ({
    version: 1,
    now: "2026-10-15T12:00:00.000Z",
    eventName: "Scenario concert", timing: "future", cancelled: false,
    segments: [{ cancelled: false, timing: "inherit" }, { cancelled: false, timing: "inherit" }],
    //presentation: "both",
    users: [
        { name: "Alice", tagInvited: true, individualInvitation: null, instrumentCount: 1, primaryInstrumentId: 1, instrumentId: null, comment: "", responses: ["missing", "missing", "missing"] },
        { name: "Bob", tagInvited: true, individualInvitation: null, instrumentCount: 3, primaryInstrumentId: 1, instrumentId: null, comment: "", responses: [3, "missing", "missing"] },
        { name: "Carol", tagInvited: false, individualInvitation: true, instrumentCount: 2, primaryInstrumentId: 1, instrumentId: null, comment: "I am away that weekend.", responses: [1, 1, 1] },
        { name: "David", tagInvited: false, individualInvitation: null, instrumentCount: 0, primaryInstrumentId: null, instrumentId: null, comment: "", responses: ["missing", "missing", "missing"] },
    ],
});

const cancelledStatusId = 99;
const eventId = -100;
const hour = 3_600_000;

export function buildAttendanceScenario(scenario: AttendanceScenario, userIndex: number) {
    const person = scenario.users[userIndex]!;
    const now = new Date(scenario.now);
    const userPublicId = parsePublicId<"User">(`ScenarioUser${String(userIndex + 1).padStart(4, "0")}`);
    const user: db3.UserWithInstrumentsPayload = {
        publicId: userPublicId,
        name: person.name,
        isSysAdmin: false,
        isDeleted: false,
        email: "",
        phone: "",
        createdAt: now,
        roleId: null,
        cssClass: null,
        tags: [],
        instruments: scenarioInstruments.slice(0, person.instrumentCount).map(instrument => ({
            publicId: parsePublicId<"UserInstrument">(
                `ScnUsrInst${String((userIndex + 1) * 10 + instrument.id).padStart(6, "0")}`,
            ),
            instrumentId: parsePublicId<"Instrument">(instrument.publicId),
            instrument: { publicId: parsePublicId<"Instrument">(instrument.publicId) },
            userId: userPublicId,
            isPrimary: instrument.id === person.primaryInstrumentId,
        })),
    };
    const segments = scenario.segments.map((config, index) => {
        const when = config.timing === "inherit" ? scenario.timing : config.timing;
        const offset = when === "past" ? -48 * hour : when === "future" ? 48 * hour : -hour;
        const attendanceId = person.responses[index]!;
        const id = index + 1;
        return {
            publicId: scenarioSegmentPublicId(index), eventId, name: `Segment ${id}`, description: "", uid: `scenario-segment-${id}`,
            startsAt: when === "tbd" ? null : new Date(now.valueOf() + offset + index * 15 * 60_000),
            isAllDay: false,
            durationMillis: BigInt(2 * hour),
            statusId: config.cancelled ? cancelledStatusId : null,
            responses: attendanceId === "missing" ? [] : [{
                eventSegmentId: scenarioSegmentPublicId(index), userId: user.publicId,
                attendanceId: attendanceId === null ? null : scenarioAttendances[attendanceId - 1]!.publicId,
                createdAt: now, updatedAt: now, createdByUserId: null, updatedByUserId: null,
            }],
        };
    });
    // Generate the event's aggregate interval, then use the same lifecycle
    // classifier as production. Individual segment overrides can span now.
    const dateRange = getEventDateTimeRangeFromSegments(segments, [cancelledStatusId]);
    const event = {
        publicId: scenarioEventPublicId, name: scenario.eventName, startsAt: dateRange.getStartDateTime(), segments,
        responses: [{
            id: -1,
            userId: user.publicId,
            instrumentId: person.instrumentId == null
                ? null
                : scenarioClientInstruments[person.instrumentId - 1]!.publicId,
            isInvited: person.individualInvitation, userComment: person.comment
        }],
    };
    const eventUserResponse = getEventResponseForUser({
        user, event, userMap: [user], defaultInvitationUserIds: new Set(person.tagInvited ? [user.publicId] : []),
        dashboardContext: { instrument: { find: predicate => scenarioClientInstruments.find(predicate) } },
        makeMockEventUserResponse: () => event.responses[0]!,
    })!;
    const segmentUserResponses = segments.map(segment => getEventSegmentResponseForSegmentAndUser({
        user, segment, expectedAttendanceTag: null,
        makeMockEventSegmentResponse: () => ({ userId: user.publicId, attendanceId: null }),
    })!);
    const attendance = calculateEventAttendance({
        eventUserResponse,
        segmentUserResponses,
        segments,
        eventTiming: dateRange.hitTestDateTime(now),
        eventIsCancelled: scenario.cancelled,
        cancelledStatusIds: [cancelledStatusId],
        attendances: scenarioAttendances,
    });
    return { event, user, attendance };
}

export function applyAttendanceScenarioChange(person: AttendanceScenarioUser, change: AttendanceChange): AttendanceScenarioUser {
    if (change.type === "comment") return { ...person, comment: change.comment };
    if (change.type === "instrument") {
        const scenarioInstrumentId = change.instrumentId == null
            ? null
            : typeof change.instrumentId === "number"
                ? change.instrumentId
                : scenarioInstruments.find(
                    instrument => instrument.publicId === change.instrumentId,
                )?.id;
        return { ...person, instrumentId: instrumentId.parse(scenarioInstrumentId) };
    }
    // Saved scenarios use local choices 1/2/3, while the rendered control uses public IDs.
    const localChoice = change.attendanceId === null ? null
        : scenarioAttendances.findIndex(option => option.publicId === change.attendanceId) + 1;
    return {
        ...person, responses: person.responses.map((value, index) =>
            scenarioSegmentPublicId(index) === change.segmentId ? response.parse(localChoice) : value)
    };
}

export function describeAttendanceVisibility(result: ReturnType<typeof buildAttendanceScenario>["attendance"]): string {
    if (result.eventIsCancelled) return "Hidden: event is cancelled.";
    if (result.noSegments) return "Hidden: no active segments.";
    if (!result.visible) return "Hidden: user is uninvited and has no attendance answer.";
    if (result.alertFlag) return "Alert: invited, event is not past, and an active segment is unanswered.";
    return "Visible without an alert. Compactness depends on the presentation and local editing state.";
}
