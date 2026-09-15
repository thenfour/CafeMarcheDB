# Date/time policy audit

2026-09-12, updated 2026-09-15. This report tracks the audit, executable regression
baseline, band-timezone foundation, all-day calendar-feed correction, and DT-01
all-day hydration repair. Event editors still need band-timezone integration;
timed hydration, union arithmetic, lifecycle classification, and SQL queries
still need repairs.
No existing event data or database schema has been changed. The Japan report has
not been reproduced as a complete user journey, and none of these findings
establishes its historical cause.

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

## Completed slice 1: establish the band-timezone foundation

- The existing `Setting` table now supports `BandTimeZone`, exposed as **Band time
  zone** on [the branding page](../src/pages/backstage/brand.tsx). The strict
  [branding aggregate](../shared/siteBranding.ts) validates named zones and uses
  the existing `manage_site_branding` permission, fresh permission check, and
  atomic transaction. Missing or blank configuration resolves to
  `Europe/Brussels` without writing a default row; invalid configured names fail
  validation instead of silently selecting another zone. Generic settings writes
  and raw Settings inserts/updates enforce the same validation, including edits
  that change only a row's name or value. Their existing Sysadmin restriction
  remains in place.
- [The server loader](../src/server/dateTime.ts) reads the setting freshly.
  Dashboard data exposes it as `dashboardContext.bandTimeZone`, and saving the
  branding form refreshes that context. No additional permission or schema
  migration is needed.
- [shared/dateTimePolicy.ts](../shared/dateTimePolicy.ts) contains named-zone
  validation, band-clock authoring conversion, exact-instant formatting,
  all-day calendar-date decoding, and band-midnight interval construction.
  `@js-temporal/polyfill` 0.5.1 stays behind this module; its public APIs use ISO
  strings and native `Date` values. Authoring explicitly uses `compatible` DST
  disambiguation: choose the earlier repeated occurrence and move a nonexistent
  clock time forward by the gap. This follows
  [Temporal's documented conventional behavior](https://tc39.es/proposal-temporal/docs/timezone.html).
  Reading an existing instant preserves its occurrence and precision.
- [The all-day feed adapter](../src/core/db3/server/icalUtils.ts) now decodes
  stored calendar dates through that policy and supplies exclusive date-only
  bounds without server-local arithmetic. All five previously failing feed
  checks are ordinary passing regressions. Feed dates intentionally do not
  depend on the band's absolute midnight interval.

This slice establishes configuration and conversion operations; existing event
editors still interpret input in device-local time. Existing lifecycle checks,
cached aggregate bounds, and SQL date filters retain their previous behavior.
Changing the setting does not rewrite event or segment data or recalculate those
cached bounds. Their adoption and the treatment of timezone changes must be
implemented together in subsequent slices. The all-day feed repair bypassed the
general `DateTimeRange` hydration defect, subsequently repaired under DT-01 below.

## Completed DT-01: preserve all-day dates when loading ranges

- `new DateTimeRange(spec)` now reads all-day dates from UTC fields and clones
  the input before clearing its ignored time component. Loading a normalized
  spec, copying it, and restoring its serialized date preserve the selected day.
- `DateTimeRange.fromLocalDate(spec)` explicitly encodes a native local picker
  date before construction. Start/end selection, all-day toggles, TBD restoration,
  picker fallback ranges, and locally calculated union starts use this boundary.
  Workflow due-date display and generated test data retain their local-date
  interpretation through the same adapter.
- Event-import responses now encode parsed server-local dates before transport,
  and the import form encodes its local default dates. Stored event/segment
  readers and calendar-feed preview values continue through the constructor.
- The three DT-01 expected-failure annotations are removed. Forty additional
  checks cover five native timezones, repeated copies, JSON restoration, early
  and late picker selections, input immutability, TBD union copies, ordinary
  self-union, and year/leap-day/DST boundaries.

This repair retains the existing database encoding and whole-day duration
normalization. Timed snapping (DT-02), union arithmetic (DT-03), band-timezone
authoring/lifecycle integration, and other findings remain separate repairs.
The control adapters still use the device's local calendar fields; applying the
band timezone to shared event authoring remains part of POL-01.

## Executable evidence

The date/time tests live under [tests/datetime](../tests/datetime). Native `Date` runs in
separate Node processes with `TZ` set before startup. This avoids relying on the
developer machine's timezone or changing timezone globals inside a Vitest worker.
The matrix covers UTC, Brussels, Tokyo, Los Angeles, and Sydney for feed-specific
cases. Clocks are fixed where an operation depends on the current date.

| Suite | Ordinary passing checks | Known failing checks in strict mode | Boundary exercised |
| --- | ---: | ---: | --- |
| [timePolicy.test.ts](../tests/datetime/timePolicy.test.ts) | 47 | 19 | Real shared range, arithmetic, classification, relative labels, and sorting helpers |
| [allDayHydration.test.ts](../tests/datetime/allDayHydration.test.ts) | 40 | 0 | Stored all-day dates, explicit local authoring, copies, serialization, and calendar boundaries in five zones |
| [authoringPolicy.test.ts](../tests/datetime/authoringPolicy.test.ts) | 20 | 12 | Real clock-option/range helpers and the control's selected-end/toggle calculations |
| [eventDateConsumers.test.ts](../tests/datetime/eventDateConsumers.test.ts) | 8 | 5 | Actual compact event-date React rendering with unrelated sibling imports isolated |
| [calendarFeed.test.ts](../tests/datetime/calendarFeed.test.ts) | 23 | 0 | Actual application feed adapter and installed `ical-generator` serialization |
| [bandTimePolicy.test.ts](../tests/datetime/bandTimePolicy.test.ts) | 54 | 0 | Named-zone validation, band-time conversion, DST ambiguity, all-day bounds, and host-timezone independence |
| [bandTimeZoneLoading.test.ts](../tests/datetime/bandTimeZoneLoading.test.ts) | 4 | 0 | Fresh server setting reads, default/error behavior, and dashboard delivery |
| [bandTimeZoneWrites.test.ts](../tests/datetime/bandTimeZoneWrites.test.ts) | 25 | 0 | Generic and raw settings validation, partial edits, clears, and retained authorization |
| Total | 221 | 36 | 257 checks; remaining failures repeat root causes across zones and boundaries |

The original audit contained 134 checks: 90 ordinary passing checks and 44 known
failures. Slice 1 adds 83 policy/loading/write checks and repairs the five feed failures.
DT-01 adds 40 checks and repairs three more failures.
[Setting authorization tests](../tests/authorization/settingAuthorization.test.ts)
also cover default reads, valid persistence/readback, invalid updates leaving all
branding values unchanged, and denied or stale permission grants.

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

The expected strict result is 36 failing test cases and 221 passing test cases.
This is a reproduction command; those failures are the audit output, not test
harness errors. Infrastructure/probe errors are outside expected-failure tests.

## Findings reproduced by tests

**DT-01 - Resolved 2026-09-15: reading an all-day date could change the date.**

[DateTimeRange's former constructor](../shared/time.ts) called
`floorLocalTimeToDayUTC` for both newly selected local dates and persisted
UTC-encoded calendar dates. In Los Angeles, loading `2026-07-10T00:00Z` yielded
`2026-07-09T00:00Z`. Reconstructing its spec again yielded 8 July. This violated
round-trip stability and could spread through rendering, editing, union, and feed
generation. The original feed adapter exported 9-10 July instead of 10-11 July in
that server timezone (`DT-FEED-02` in the feed tests). **Slice 1 repaired the feed
path** by decoding stored calendar dates directly. **The DT-01 repair now fixes
the general constructor**, with explicit local-date adapters for its authoring
and calculation callers.

Picker-date conversion is now separate from hydration of a stored calendar date.
Reading an already normalized all-day spec preserves it. The existing database
encoding is retained, with no schema migration or existing-data rewrite.

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

**DT-07 / DT-FEED-01 - Resolved in slice 1: local DST correction corrupted all-day feed boundaries.**

The former `prepareAllDayDateForICal` applied the timezone offset through local
`setMinutes`, which could cross a clock change. With server timezone
`Australia/Sydney`, all-day 3 October 2026 exported `DTSTART=20261003` and
`DTEND=20261003`, an empty interval. All-day 4 October exported 3-5 October, an
incorrect two-day period. A Sydney autumn case preserved serialized dates but
changed the intermediate timestamp and therefore the revision input hash.

[The adapter](../src/core/db3/server/icalUtils.ts) now constructs date-only feed
values directly from stored calendar fields using shared policy operations.
Regression tests verify correct exclusive ends and stable revision input across
the tested server timezones. These historical failures depended on the server
timezone; a subscriber traveling to Japan does not change it. Timed feed entries
still use `DateTimeRange` and remain subject to DT-02.

**DT-08 - Medium: point timestamps acquire an invented ongoing interval.**

[CalcRelativeTimingFromNow](../shared/time.ts#L986) models an instant as a
zero-duration event, but the range constructor expands zero to 15 minutes.
A timestamp one minute in the past consequently says `Happening now`. This
affects generic [DateValue](../src/core/components/DateTime/DateTimeComponents.tsx#L47)
tooltips and other creation/history timestamps as well as the compact event
label. Keep point-relative descriptions separate from event lifecycle
classification; both can remain in the existing shared date/time files.

**POL-01 - Partially resolved: band timezone is configured, but event consumers still need adoption.**

All-day [hitTestDateTime](../shared/time.ts#L787) derives its boundaries from
runtime-local midnight. The same event can be future in UTC or Los Angeles and
already ongoing in Brussels or Tokyo. Tests cover both exact band-midnight
edges of a 10 July event. [Event authoring](../src/core/components/DateTime/DateTimeRangeControl.tsx#L321)
also remains device-local. Slice 1 adds the band setting, runtime access, and
tested shared conversion operations; these existing consumers do not yet use
them. The remaining policy integration is distinct from corruption of existing
representations.

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

1. **Establish the band-time policy first - completed in slice 1.** The validated
   branding setting, fresh server/dashboard access, and shared date/time policy
   now provide the foundation. The all-day feed adapter is its first production
   consumer, with all five feed regressions repaired. Keep calendar-window and
   lifecycle decisions in this module as those consumers are integrated; pass
   `now` and timezone context explicitly. No event data was rewritten.
2. **Make the existing range representation lossless.** Separate hydration from
   authoring normalization, preserve UTC instants, repair all-day round trips and
   union algebra, and remove the affected expected-failure markers. Introduce
   explicit semantic calendar-date and absolute-interval operations within the
   shared files. Avoid changing persisted schema merely to rename representations.
   **DT-01 is completed:** all-day hydration and local authoring now have separate
   boundaries. Timed precision and union algebra remain open.
3. **Integrate existing controls and presentations.** Event editors, compact
   labels, attendance timing, and calendar adapters consume semantic operations.
   Keep generic personal report/range pickers in the viewer timezone: they share
   lower-level controls with event editing and must not inherit band time
   accidentally. Repair clock options and selected-end calculations together.
4. **Align server aggregation, queries, and remaining feed behavior.** Cache
   absolute event bounds consistently and apply overlap queries. All-day feed
   serialization is repaired; timed feed hydration still depends on the general
   range repair. Define recalculation of derived all-day bounds when the band
   timezone changes before lifecycle consumers adopt that setting. Remove the
   remaining expected-failure markers as the behavior is repaired.
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
deterministic handling of repeated and nonexistent authoring times. Slice 1's
shared Temporal policy now specifies and tests that behavior; subsequent picker
adapters should use it. Existing explicit UTC instants already identify their
occurrence and must remain unchanged. Before applying the band timezone to
existing lifecycle consumers, define its effect on derived all-day bounds and
recalculation after setting changes. Slice 1 refreshes configuration only.

## Verification and limits

- DT-01 verification on 2026-09-15: full `yarn test` passed 964 cases; nine
  opt-in MySQL checks were skipped. The 257 date/time checks contain 221 ordinary
  checks and 36 executed expected failures. Strict date/time mode exposes exactly
  those 36 remaining failures.
- Focused ESLint for every changed TypeScript file and `git diff --check` passed.
  `yarn tsc --noEmit` reports TS2321/TS2345 in `src/auth/mutations/mergeUsers.ts:11`
  comparing Prisma client types. A compiler run substituting unchanged `HEAD`
  sources for the edited files and excluding the new tests reproduced both
  diagnostics. No new type diagnostics were reported. A production build was
  not run for DT-01; slice 1's earlier typecheck and build passed.
- Settings resolver tests use the existing in-memory database. It does not
  emulate transaction rollback; the bulk rejection case checks validation before
  writes. Production mutations retain their existing serializable transactions.
- No production database, deployed server timezone, existing corrupted row count,
  interactive MUI/calendar behavior, or external calendar application was tested.
  Query findings are code traces, not claims of live SQL execution. Authoring
  tests exercise boundary calculations and the explicit local-date factory
  rather than mounted controls. DT-01 did not exercise the import UI interactively.
- Passing controls cover exact ordinary timed boundaries, TBD, local tomorrow,
  calendar-day membership, ascending date sorting, leap-year adjacency, 23/25-hour
  calendar days, and normal feed serialization. These are useful existing
  contracts to preserve during repairs.
