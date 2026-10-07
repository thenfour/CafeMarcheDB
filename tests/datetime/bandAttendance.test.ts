// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { DateTimeRange, Timing } from "shared/time"
import { parsePublicId } from "shared/publicId"
import type { EventParticipant } from "src/core/db3/shared/entities/user/eventParticipant"
import type { DashboardContextDataBase } from "src/core/components/dashboardContext/dashboardContextTypes"

vi.mock("src/core/db3/DB3Client", () => ({
  ...Object.fromEntries([
    "PKColumnClient", "GenericStringColumnClient", "EventDateRangeColumn", "BoolColumnClient", "ForeignSingleFieldClient",
    "ConstEnumStringFieldClient", "TagsFieldClient", "CreatedAtColumn", "MarkdownStringColumnClient",
  ].map(name => [name, class {}])),
  makeClientColumnSet: (factories: Record<string, (columnName: string) => unknown>) => Object.fromEntries(
    Object.entries(factories).map(([columnName, factory]) => [columnName, factory(columnName)]),
  ),
  foreignRefFieldGen: () => (columnName: string) => ({ columnName }),
}))
vi.mock("src/core/db3/components/DB3ClientCore", () => ({}))
vi.mock("src/core/components/event/useEventParticipants", () => ({ useEventParticipants: () => [] }))
vi.mock("src/core/db3/clientAPI", () => ({ API: { events: {} } }))
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({ useDashboardContext: () => context }))
vi.mock("src/core/db3/shared/schema/eventAPI", () => ({ GetEventResponseInfo: () => ({
  getEventResponseForUser: () => ({ isInvited: true, response: {} }),
  getResponsesBySegmentForUser: () => ({ 1: { segment: { id: 1, statusId: null }, response: { attendanceId: null } } }),
}) }))
import { CalculateEventMetadata, CalcEventAttendance } from "src/core/components/event/EventComponentsBase"

const participant: EventParticipant = {
  publicId: parsePublicId<"User">("AttendanceUser01"), membershipId: parsePublicId<"BandUser">("AttendanceMem001"),
  name: "Alice", cssClass: null, bandUserInstruments: [], bandUserTagAssignments: [],
}
// The response-info mock needs only these context services; catalogs and the account are not exercised here.
const context = { bandTimeZone: "Asia/Tokyo", currentUser: { publicId: participant.publicId }, eventStatus: { items: [] }, eventAttendance: { items: [] },
  routingApi: { getURIForEvent: () => "/event/1" } } as unknown as DashboardContextDataBase
const event = { publicId: parsePublicId<"Event">("AttendanceEvt001"), name: "All-day", expectedAttendanceUserTagId: null,
  startsAt: new Date("2026-07-09T15:00:00Z"), durationMillis: BigInt(86_400_000), isAllDay: true, responses: [],
  segments: [{ publicId: parsePublicId<"EventSegment">("AttendanceSeg001"), statusId: null, name: "All-day",
    startsAt: new Date("2026-07-09T15:00:00Z"), durationMillis: BigInt(86_400_000), isAllDay: true, responses: [] }] }
afterEach(() => { vi.useRealTimers() })

describe("band lifecycle reaches production attendance", () => {
  it.each([
    ["2026-07-09T14:59:59.999Z", Timing.Future, false],
    ["2026-07-09T15:00:00.000Z", Timing.Present, false],
    ["2026-07-10T14:59:59.999Z", Timing.Present, false],
    ["2026-07-10T15:00:00.000Z", Timing.Past, true],
  ] as const)("classifies %s using the configured band interval", (now, timing, past) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(now))
    const dateRange = new DateTimeRange({
      startsAtDateTime: event.startsAt,
      durationMillis: Number(event.durationMillis),
      isAllDay: event.isAllDay,
    })
    const metadata = CalculateEventMetadata(event, dateRange, undefined, context, [participant], null, () => null, () => null)
    expect(metadata.eventTiming).toBe(timing)
    const attendance = CalcEventAttendance({ eventData: metadata, userMap: [participant], dashboardContext: context })
    expect(attendance.eventIsPast).toBe(past)
    expect(attendance.alertFlag).toBe(!past)
  })
})
