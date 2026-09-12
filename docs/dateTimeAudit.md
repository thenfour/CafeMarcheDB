# Date/time policy audit

2026-09-12. This is an audit and executable regression baseline. Production code,
database settings, event data, and schema are unchanged. The tests expose existing
defects and the gap between current behavior and the timezone policy agreed in the
planning conversation. The Japan report has not been reproduced as a complete user
journey, and none of these findings establishes its historical cause.

## Agreed policy

| Concern | Expected behavior |
| --- | --- |
| Shared event schedule authoring | Create/edit in the band's named timezone, initially `Europe/Brussels`. Show that timezone beside the editor. Both timed and all-day editing use this context. |
| Timed display | Present stored absolute instants in the viewer's device timezone. |
| All-day display | Preserve selected calendar dates worldwide. Treat the period as calendar days, with an exclusive end date. |
| All-day lifecycle | Resolve each midnight boundary in the band timezone into an absolute instant. Everyone observes the same ongoing interval. |
| Event lifecycle | Start inclusive, end exclusive. TBD is never ongoing. Attendance uses the overall aggregate event interval; gaps normally remain inside it. |
| Calendar membership and relative dates | Use the viewer's displayed calendar days. `Today` must agree with calendar placement; it is a different fact from globally shared `Ongoing`. |
| Date-range queries | Select overlapping timed intervals using explicit viewer-local bounds converted to UTC, and all-day entries using calendar-date bounds. Preserve simple, contiguous year-range queries. |
| Calendar feeds | Timed entries convey absolute instants. All-day entries convey selected dates with an exclusive date-only end. Ordinary all-day feeds do not encode the application's band-time lifecycle interval. |
| Public advertised text | Frontpage date/time strings are editorial text and are outside timezone correction. |
| Containment | Utilities own mechanics; a small shared policy module owns semantic choices; existing date/time components adapt inputs and presentation. Tests specify behavior. |

The iCalendar date-only/exclusive-end contract is specified by
[RFC 5545 section 3.6.1](https://www.rfc-editor.org/rfc/rfc5545.html#section-3.6.1).
`TZID` cannot be attached to a `DATE` property, per
[section 3.2.19](https://www.rfc-editor.org/rfc/rfc5545.html#section-3.2.19).

## Executable evidence

The new tests live under [tests/datetime](../tests/datetime). Native `Date` runs in
separate Node processes with `TZ` set before startup. This avoids relying on the
developer machine's timezone or changing timezone globals inside a Vitest worker.
The matrix covers UTC, Brussels, Tokyo, Los Angeles, and Sydney for feed-specific
cases. Clocks are fixed where an operation depends on the current date.

| Suite | Ordinary passing checks | Known failing checks in strict mode | Boundary exercised |
| --- | ---: | ---: | --- |
| [timePolicy.test.ts](../tests/datetime/timePolicy.test.ts) | 44 | 22 | Real shared range, arithmetic, classification, relative labels, and sorting helpers |
| [authoringPolicy.test.ts](../tests/datetime/authoringPolicy.test.ts) | 20 | 12 | Real clock-option/range helpers and the control's selected-end/toggle calculations |
| [eventDateConsumers.test.ts](../tests/datetime/eventDateConsumers.test.ts) | 8 | 5 | Actual compact event-date React rendering with unrelated sibling imports isolated |
| [calendarFeed.test.ts](../tests/datetime/calendarFeed.test.ts) | 18 | 5 | Actual application feed adapter and installed `ical-generator` serialization |
| Total | 90 | 44 | 134 checks; failures repeat root causes across zones and boundaries |

Confirmed gaps use Vitest's `it.fails`, asserting the desired behavior. They are
executed, not skipped. A newly passing gap also fails the normal suite, requiring
its expected-failure annotation to be removed when repaired. A green normal audit
run therefore does **not** mean the date/time policy is implemented.

Normal audit run:

```powershell
yarn test tests/datetime
```

Expose the red regressions in PowerShell:

```powershell
$previousDateAuditMode = $env:CMDB_DATETIME_AUDIT_STRICT
try {
    $env:CMDB_DATETIME_AUDIT_STRICT = '1'
    yarn test tests/datetime
} finally {
    if ($null -eq $previousDateAuditMode) {
        Remove-Item Env:CMDB_DATETIME_AUDIT_STRICT -ErrorAction SilentlyContinue
    } else {
        $env:CMDB_DATETIME_AUDIT_STRICT = $previousDateAuditMode
    }
}
```

The expected strict result is 44 failing test cases and 90 passing test cases.
This is a reproduction command; those failures are the audit output, not test
harness errors. Infrastructure/probe errors are outside expected-failure tests.

## Findings reproduced by tests

**DT-01 - High: reading an all-day date can change the date.**

[DateTimeRange's constructor](../shared/time.ts#L363) calls
`floorLocalTimeToDayUTC` for both newly selected local dates and persisted
UTC-encoded calendar dates. In Los Angeles, loading `2026-07-10T00:00Z` yields
`2026-07-09T00:00Z`. Reconstructing its spec again yields 8 July. This violates
round-trip stability and can spread through rendering, editing, union, and feed
generation. The actual feed adapter exports 9-10 July instead of 10-11 July in
that server timezone (`DT-FEED-02` in the feed tests).

Separate picker-date conversion from hydration of a stored calendar date. Reading
an already normalized spec must preserve it. Retaining the existing database
encoding behind that boundary can avoid an immediate schema migration.

**DT-02 - High: reading timed values rounds them and can select the wrong DST occurrence.**

[The constructor](../shared/time.ts#L388) snaps durations to 15 minutes and
reconstructs starts through [roundToNearest15Minutes](../shared/time.ts#L173).
Loading `07:47:12.345Z` with a 20-minute duration yields `08:00Z` and 15 minutes.
In Brussels, the second `02:30` on 25 October 2026 (`01:30Z`) becomes the first
occurrence (`00:30Z`), even though the persisted instant is unambiguous. The
Pacific autumn transition reproduces the same loss.

The [all-day toggle](../src/core/components/DateTime/DateTimeRangeControl.tsx#L365)
also combines the selected date with the current clock. At 23:50, turning all-day
off changes 10 July to 11 July through the constructor's upward rounding; 23:45
is the passing control.

Keep stored instants and durations exact. Any UI snapping should be an explicit
authoring operation. Existing UTC instants must never be reconstructed from local
clock fields merely to read them.

**DT-03 - High: aggregate ranges can gain days or lose segments.**

[unionWith](../shared/time.ts#L799) estimates calendar days from elapsed
milliseconds. A Brussels all-day event on 25 October 2026 spans 25 elapsed hours;
unioning it with itself produces two calendar days. Mixed timed/all-day unions
also depend on iteration order. In UTC, these segments should cover 9-11 July:

- 9 July 23:00, duration two hours;
- 10 July, all day;
- 11 July 01:00, duration one hour.

Different permutations produce either two or three days; the two-day result
omits the final segment. The [aggregate writer](../src/core/db3/server/db3mutationCore.ts#L138)
reduces segments without an explicit ordering, then persists the result to
`Event`. Sorting the input would conceal the defect rather than make the union
correct. Calculate extrema in the appropriate representation and verify
idempotence, permutation invariance, and coverage of every included segment.

**DT-04 - High: clock choices depend on the day the editor is opened.**

[TimeOptionsGenerator](../shared/time.ts#L301) builds nominal clock choices by
adding elapsed milliseconds to today's local midnight. On the Brussels or
Pacific spring clock-change day, a July event's selected 03:00 is presented as
04:00. On the autumn change day it becomes 02:00, with duplicate clock labels.
UTC and Tokyo controls pass. Clock-of-day options need a stable civil-time
representation independent of today's elapsed day length.

**DT-05 - High: an end-time selection across DST saves a different end time.**

[handleChangeEndTime2](../src/core/components/DateTime/DateTimeRangeControl.tsx#L361)
stores the option's nominal clock distance as elapsed duration. In Brussels on
29 March 2026, start 01:30 and selected end 03:30 result in end 04:30. On
25 October, the same selection results in 02:30. Pacific equivalents also fail.
Resolve the selected end date and clock in the authoring zone, then subtract
absolute instants to obtain elapsed duration. Tests exercise this exact boundary
calculation; they do not mount or interact with MUI.

**DT-06 - Medium: compact event labels discard event duration and all-day meaning.**

[EventShortDate](../src/core/components/event/RelevantEvents.tsx#L42) receives
only `startsAt`. Its caller already computes the full event range, but the label
uses a point-timestamp helper. A four-hour event viewed two hours after its start
is labeled `Today` instead of `Happening now` in all four tested zones. An all-day
10 July event displays 9 July in Los Angeles because its raw UTC marker is
formatted as an instant. This presentation path needs the same semantic range
used by the rest of the event UI.

**DT-07 / DT-FEED-01 - Medium: local DST correction can corrupt all-day feed boundaries.**

[prepareAllDayDateForICal](../src/core/db3/server/icalUtils.ts#L149) applies the
timezone offset through local `setMinutes`. That mutation can cross a clock
change. With server timezone `Australia/Sydney`, all-day 3 October 2026 exports
`DTSTART=20261003` and `DTEND=20261003`, an empty interval. All-day 4 October
exports 3-5 October, an incorrect two-day period. A Sydney autumn case preserves
serialized dates but changes the intermediate timestamp and therefore the
[revision input hash](../src/core/db3/server/icalUtils.ts#L262).

Construct date-only feed values directly from calendar fields using the
serializer's supported boundary representation. Feed output and revision
inputs must be independent of server-local timezone. These failures depend on
the server timezone; a subscriber traveling to Japan does not change it.

**DT-08 - Medium: point timestamps acquire an invented ongoing interval.**

[CalcRelativeTimingFromNow](../shared/time.ts#L986) models an instant as a
zero-duration event, but the range constructor expands zero to 15 minutes.
A timestamp one minute in the past consequently says `Happening now`. This
affects generic [DateValue](../src/core/components/DateTime/DateTimeComponents.tsx#L47)
tooltips and other creation/history timestamps as well as the compact event
label. Keep point-relative descriptions separate from event lifecycle
classification; both can remain in the existing shared date/time files.

**POL-01 - Required policy change: band timezone is not represented at runtime.**

All-day [hitTestDateTime](../shared/time.ts#L787) derives its boundaries from
runtime-local midnight. The same event can be future in UTC or Los Angeles and
already ongoing in Brussels or Tokyo. Tests cover both exact band-midnight
edges of a 10 July event. [Event authoring](../src/core/components/DateTime/DateTimeRangeControl.tsx#L321)
also remains device-local, and [the setting registry](../shared/settingKeys.ts)
has no band timezone setting. This is the newly agreed policy's implementation
gap; it is distinct from corruption of existing representations.

## Findings traced in code, with integration tests still needed

**DT-09 - Medium: the month calendar mixes start and end representations.**

[EventCalendar's accessors](../src/core/components/EventCalendar.tsx#L222) return
raw persisted `segment.startsAt` for the start and a reconstructed range end for
the end. An all-day UTC date is therefore interpreted as a local timed start,
including the previous local day west of UTC. Provide both endpoints through
one calendar adapter. The current tests prove the underlying date drift and
compact rendering; they do not mount `react-big-calendar`.

**DT-10 - Medium: calendar queries lose viewer boundaries and miss overlapping segments.**

The [month calendar](../src/core/components/EventCalendar.tsx#L307) and
[picker event lookup](../src/core/components/DateTime/useEventsForDateRange.tsx#L25)
send `YYYYMMDD-YYYYMMDD` quick-filter strings through
[eventSearchConfig](../src/core/hooks/searchConfigs.ts#L51). The
[SQL date filter](../src/core/db3/shared/db3basicFields.ts#L1477) uses
`DATE(startsAt) BETWEEN ...`, without viewer-zone instant bounds or an end bound
for overlap selection.

For stored UTC timed values, a Tokyo 11 July 00:30 event has a 10 July UTC start.
A request for 11 July therefore excludes it even though the tested label says
11 July and `Today`. Month-view padding hides many boundary cases, so this is
not proof of the historical month-calendar report. Separately, an event with
a 1 June first segment and a 10 July later segment is outside July's padded
start-date query even though the calendar renders individual segments.

Use a structured calendar-window query carrying explicit instant bounds and
date-only bounds. Select overlapping relevant segments or event intervals as
appropriate to the view. Test the real MySQL query against boundary fixtures;
the existing in-memory Prisma harness does not execute this SQL. Simple
year-number searches can remain as they are, with adjacent-year continuity.

**DT-11 - Medium: database status filters disagree with interval classification.**

[Past/Future expressions](../src/core/db3/shared/apiTypes.ts#L357), used by the
[active date facets](../src/core/db3/shared/db3basicFields.ts#L1314), compare only
the start against `CURDATE()`. An event that finished earlier today can still
be `Future`, while an event that started yesterday and is ongoing can be `Past`.
[Dashboard relevance](../src/auth/queries/getDashboardData.ts#L94) uses an
inclusive end (`endDateTime >= now`) rather than the agreed exclusive end.
It also compares the all-day UTC date marker as a start against an end cached
using the server's local zone. Both endpoints need the same absolute meaning.

Move shared status semantics into policy and apply equivalent explicit bounds
in SQL. The database clock/timezone should not supply an alternative definition
of today or ongoing. Keep broad relevance windows simple; their one-day margins
do not need a framework for elapsed-versus-calendar-day precision.

**Additional maintenance observations.**

- [The aggregate writer](../src/core/db3/server/db3mutationCore.ts#L191) silently
  catches every exception. A segment mutation can succeed while aggregate dates
  remain stale. The repair should expose or propagate recalculation failures
  within the existing transaction contract.
- [RelevantEvents](../src/core/components/event/RelevantEvents.tsx#L130) captures
  `now` once without updating it, while its child label reads a fresh clock on
  render. [DateValue](../src/core/components/DateTime/DateTimeComponents.tsx#L51)
  also freezes its reference time. A small shared clock hook in the date/time
  components can refresh time-sensitive presentation, including after tab focus.
- [Attendance metadata](../src/core/components/event/EventComponentsBase.tsx#L71)
  already obtains the overall event interval; the
  [caption selection](../src/core/components/EventAttendanceComponents.tsx#L605)
  consumes its classification. Preserve this ownership. Add caption-boundary
  integration tests after the shared policy is available; no broad attendance
  redesign is needed for these timing defects.

## Bounded implementation sequence

1. **Make the existing range representation lossless.** Separate hydration from
   authoring normalization, preserve UTC instants, repair all-day round trips and
   union algebra, and remove the affected expected-failure markers. Introduce
   explicit semantic calendar-date and absolute-interval operations within the
   shared files. Avoid changing persisted schema merely to rename representations.
2. **Introduce the band-time policy in one place.** Add a validated named timezone
   setting using the existing `Setting` name/value table. Resolve it through
   existing server/dashboard data plumbing. A small `shared/dateTimePolicy.ts`
   can own authoring conversion, band-midnight intervals, local calendar windows,
   and lifecycle/relative-label decisions. Pass `now` and timezone context
   explicitly into pure policy routines. Keep `shared/time.ts` focused on
   mechanical operations and existing representation boundaries.
3. **Integrate existing controls and presentations.** Event editors, compact
   labels, attendance timing, and calendar adapters consume semantic operations.
   Keep generic personal report/range pickers in the viewer timezone: they share
   lower-level controls with event editing and must not inherit band time
   accidentally. Repair clock options and selected-end calculations together.
4. **Align server aggregation, queries, and feeds.** Cache absolute event bounds
   consistently, apply overlap queries, and serialize all-day dates directly.
   Verify an unchanged event yields the same feed and revision input in every
   tested server timezone. Remove the remaining expected-failure markers as the
   behavior is repaired.
5. **Verify persisted data and browser boundaries.** Inspect actual stored event
   and segment values before any correction; compute a reviewable comparison of
   cached bounds against canonical segment-derived bounds. Rebuild derived
   aggregates after the repaired contract is deployed. Existing authored dates
   cannot be automatically inferred to be wrong from these code findings alone.
   Exercise picker selection, timed/all-day toggling, calendar placement, and
   time-boundary refresh in a real browser under emulated timezones.

The currently installed MUI 6.11.1 Day.js adapter already has timezone support;
its installed `AdapterDayjs.js` explicitly checks for the UTC and timezone
plugins. The [MUI timezone documentation](https://mui.com/x/react-date-pickers/timezone/)
describes this integration, and [Day.js](https://day.js.org/docs/en/timezone/timezone)
provides named-zone parsing/conversion. Those capabilities should remain behind
the shared policy boundary.

Enabling plugins alone is not a complete fix. A read-only probe of installed
Day.js 1.11.9 parsed `2026-10-25 02:30 Europe/Brussels` as `01:30Z` with the clock
frozen in January and `00:30Z` with it frozen in July. The wrapper must define
deterministic handling of repeated and nonexistent authoring times and test it.
Existing explicit UTC instants already identify their occurrence and must remain
unchanged. A band-timezone setting change also needs explicit treatment of
existing all-day bounds and cache invalidation; it should not be an incidental
generic setting update with stale derived dates.

## Verification and limits

- Audit tests: 134 checks, including 44 executed expected failures; strict mode
  exposes those failures and leaves 90 passing controls.
- `yarn test`: 481 test cases across 24 files passed, including the 44 expected
  failures described above. Strict date/time mode produced exactly 44 failing
  cases and 90 passing cases across four files, with no harness failures.
- `yarn tsc --noEmit` and `yarn eslint tests/datetime --ext .ts` passed. Tracked
  diff checking plus explicit whitespace/final-newline checks of all ten added
  files passed. Every relative file link in this report resolves.
- No production database, deployed server timezone, existing corrupted row count,
  interactive MUI/calendar behavior, or external calendar application was tested.
  Query findings are code traces, not claims of live SQL execution. Authoring
  tests exercise boundary calculations rather than mounted controls.
- Passing controls cover exact ordinary timed boundaries, TBD, local tomorrow,
  calendar-day membership, ascending date sorting, leap-year adjacency, 23/25-hour
  calendar days, and normal feed serialization. These are useful existing
  contracts to preserve during repairs.
