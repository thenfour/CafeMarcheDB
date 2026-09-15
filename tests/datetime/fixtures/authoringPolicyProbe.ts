import {
  combineDateAndTime,
  DateTimeRange,
  floorLocalToLocalDay,
  gMillisecondsPerDay,
  gMillisecondsPerHour,
  TimeOptionsGenerator,
  getDateTimeRangeTimeOptions,
} from "../../../shared/time"

export interface AuthoringPolicyProbe {
  timeZone: string
  clockOptions: {
    ordinaryDay: number
    springTransitionDay: number
    autumnTransitionDay: number
  }
  endSelections: Array<{
    caseName: "ordinary" | "spring" | "autumn"
    expectedEnd: string
    actualEnd: string
  }>
  allDayToggles: Array<{
    currentMinute: 45 | 50
    expectedDay: number[]
    actualDay: number[]
    actualClock: number[]
  }>
}

const NativeDate = Date

function withCurrentDate<T>(now: Date, action: () => T): T {
  // Exercise the production helper with a controlled current day. A fresh Node
  // process supplies its native timezone; the date override is restored below.
  globalThis.Date = new Proxy(NativeDate, {
    construct(target, args) {
      return Reflect.construct(target, args.length ? args : [now.valueOf()])
    },
    get(target, property) {
      return property === "now" ? () => now.valueOf() : Reflect.get(target, property)
    },
  })
  try {
    return action()
  } finally {
    globalThis.Date = NativeDate
  }
}

const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
const springDay = timeZone === "America/Los_Angeles" ? [2026, 2, 8] : [2026, 2, 29]
const autumnDay = timeZone === "America/Los_Angeles" ? [2026, 10, 1] : [2026, 9, 25]
const ordinaryDay = [2026, 8, 12]

function localDate(day: number[], hour: number, minute = 0): Date {
  return new Date(day[0]!, day[1]!, day[2]!, hour, minute)
}

function selectedClockHour(today: number[]): number {
  return withCurrentDate(localDate(today, 12), () => {
    // Editing an unrelated July event must not depend on today's DST boundary.
    const options = new TimeOptionsGenerator(15)
    const selected = options.getOptions().find(option => option.clockTime === "03:00")!
    return selected.millisecondOfDay / 3_600_000
  })
}

function selectEnd(caseName: "ordinary" | "spring" | "autumn", eventDay: number[]) {
  return withCurrentDate(localDate(ordinaryDay, 12), () => {
    const start = localDate(eventDay, 1, 30)
    const expectedEnd = localDate(eventDay, 3, 30)
    const options = getDateTimeRangeTimeOptions(start, expectedEnd, timeZone)
    const selectedEnd = options.endOptions.find(option => option.instant.valueOf() === expectedEnd.valueOf())!
    // Exercise the same resolved choices and elapsed subtraction as the control.
    const range = new DateTimeRange({
      startsAtDateTime: start,
      durationMillis: selectedEnd.instant.valueOf() - start.valueOf(),
      isAllDay: false,
    })
    return {
      caseName,
      expectedEnd: expectedEnd.toISOString(),
      actualEnd: range.getEndDateTime()!.toISOString(),
    }
  })
}

function turnOffAllDay(currentMinute: 45 | 50) {
  return withCurrentDate(localDate(ordinaryDay, 23, currentMinute), () => {
    const value = DateTimeRange.fromLocalDate({
      startsAtDateTime: new Date(2026, 6, 10),
      durationMillis: gMillisecondsPerDay,
      isAllDay: true,
    })
    // Follow handleAllDayChange's production boundary arithmetic. Like the end
    // selection above, this checks the control contract without mounting React.
    const coalescedStartDateTime = value.getStartDateTime(new Date())
    const newStartDateTime = combineDateAndTime(
      floorLocalToLocalDay(coalescedStartDateTime),
      new Date(),
    )
    const updated = DateTimeRange.fromLocalDate({
      ...value.getSpec(),
      isAllDay: false,
      durationMillis: gMillisecondsPerHour,
      startsAtDateTime: newStartDateTime,
    })
    const actual = updated.getStartDateTime()!
    return {
      currentMinute,
      expectedDay: [2026, 7, 10],
      actualDay: [actual.getFullYear(), actual.getMonth() + 1, actual.getDate()],
      actualClock: [actual.getHours(), actual.getMinutes()],
    }
  })
}

const result: AuthoringPolicyProbe = {
  timeZone,
  clockOptions: {
    ordinaryDay: selectedClockHour(ordinaryDay),
    springTransitionDay: selectedClockHour(springDay),
    autumnTransitionDay: selectedClockHour(autumnDay),
  },
  endSelections: [
    selectEnd("ordinary", ordinaryDay),
    selectEnd("spring", springDay),
    selectEnd("autumn", autumnDay),
  ],
  allDayToggles: [turnOffAllDay(45), turnOffAllDay(50)],
}

console.log(JSON.stringify(result))
