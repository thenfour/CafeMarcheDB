// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { DateTimeRange, Timing } from "shared/time"

vi.mock("src/core/db3/DB3Client", () => Object.fromEntries([
  "PKColumnClient", "GenericStringColumnClient", "EventDateRangeColumn", "BoolColumnClient", "ForeignSingleFieldClient",
  "ConstEnumStringFieldClient", "TagsFieldClient", "CreatedAtColumn", "MarkdownStringColumnClient",
].map(name => [name, class {}])))
vi.mock("src/core/db3/components/DB3ClientCore", () => ({}))
vi.mock("src/core/db3/clientAPI", () => ({ API: { events: { getEventDateRange: (event: any) => new DateTimeRange({
  startsAtDateTime: event.startsAt, durationMillis: Number(event.durationMillis), isAllDay: event.isAllDay,
}) } } }))
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({ useDashboardContext: () => context }))
vi.mock("src/core/db3/shared/schema/eventAPI", () => ({ GetEventResponseInfo: () => ({
  getEventResponseForUser: () => ({ isInvited: true, response: {} }),
  getResponsesBySegmentForUser: () => ({ 1: { segment: { id: 1, statusId: null }, response: { attendanceId: null } } }),
}) }))
import { CalculateEventMetadata, CalcEventAttendance } from "src/core/components/event/EventComponentsBase"

const context = { bandTimeZone: "Asia/Tokyo", currentUser: { id: 1 }, eventStatus: { items: [] }, eventAttendance: { items: [] },
  routingApi: { getURIForEvent: () => "/event/1" } }
const event = { id: 1, name: "All-day", startsAt: new Date("2026-07-09T15:00:00Z"), durationMillis: BigInt(86_400_000),
  isAllDay: true, segments: [{ id: 1, statusId: null }] }
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
    const metadata = CalculateEventMetadata(event as any, undefined, context as any, [], null, () => null, () => null)
    expect(metadata.eventTiming).toBe(timing)
    const attendance = CalcEventAttendance({ eventData: metadata as any, userMap: [], dashboardContext: context as any })
    expect(attendance.eventIsPast).toBe(past)
    expect(attendance.alertFlag).toBe(!past)
  })
})
