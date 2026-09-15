# Date/time policy audit

2026-09-12, updated 2026-09-15. This report tracks the audit, executable regression
baseline, band-timezone foundation, all-day calendar-feed correction, DT-01
all-day hydration, DT-02/DT-08 timed hydration and point-relative labels,
DT-03 range aggregation, DT-04/DT-05 clock controls, DT-06 compact labels,
DT-09 month-calendar display, DT-10 calendar-window queries, and POL-01 band-timezone
authoring, lifecycle and derived bounds. DT-11 status facets and dashboard relevance
are deferred by agreement. Earlier completed-slice notes retain their historical
context; the POL-01 section describes the final integration.
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

This foundation initially established configuration and conversion operations only.
POL-01 below now integrates event editing, lifecycle and cached bounds, including
transactional recalculation after setting changes. The all-day feed repair bypassed the
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
normalization. Timed snapping and union arithmetic are repaired in DT-02 and
DT-03 below. Band-timezone authoring/lifecycle integration and other findings
remain separate repairs.
The control adapters still use the device's local calendar fields; applying the
band timezone to shared event authoring remains part of POL-01.

## Completed DT-02 / DT-08: preserve timed values and separate point labels

- Timed `DateTimeRange` construction now clones the exact start instant and
  retains the supplied duration, including milliseconds and zero. Repeated spec
  copies, JSON restoration, local-date adapter calls, timed self-unions, and TBD
  union copies preserve both. Hydration never reconstructs local clock fields,
  so it preserves either occurrence of a repeated DST hour.
- The all-day toggle's selected 23:50 remains 23:50 on the selected day. The
  control's quarter-hour choices and the existing explicit seeding rounder remain
  authoring operations; the constructor no longer applies them implicitly.
- Zero-duration values have no ongoing interval. Their start timestamp acts as
  the calendar display anchor, preventing a midnight point from highlighting the
  preceding date. `CalcRelativeTimingFromNow` now calls a shared calendar-label
  routine directly; only the event-range entry point checks an ongoing interval.
- The timed feed adapter inherits exact start/end instants. Real adapter and
  serializer tests cover off-grid times, both zones' second DST occurrences, and
  zero duration. Inputs retain milliseconds; the installed serializer emits
  seconds. Timed ranges whose endpoints serialize to the same second omit
  `DTEND`, representing a point as specified by
  [RFC 5545 section 3.6.1](https://www.rfc-editor.org/rfc/rfc5545.html#section-3.6.1);
  an equal end would violate
  [section 3.8.2.2](https://www.rfc-editor.org/rfc/rfc5545.html#section-3.8.2.2).
  These inputs and revision hashes agree across five server timezones.
- Eighteen expected failures become ordinary passing checks: ten timed hydration
  checks, four late-night toggle checks, and four point-timestamp label checks.
  Fifty timed-range checks and six feed checks extend the regression coverage.

DT-03 aggregation and DT-04/DT-05 clock choices are repaired below. The clock
controls now display exact off-grid selections as well as retaining their values.
Band-timezone control integration remains open. These repairs retain the
persisted encoding.

## Completed DT-03: calculate aggregate bounds in one representation

- `DateTimeRange.union(ranges)` considers all original known ranges before
  choosing its representation. Timed-only collections retain exact instant
  extrema. If any known range is all-day, each range contributes calendar-date
  bounds and the result spans their minimum start through maximum exclusive end.
  All-day day counts use UTC calendar markers, so a 25-hour day remains one day.
- Mixed ranges retain the current host-local interpretation of timed calendar
  dates. An exclusive midnight end contributes no following day; an instant one
  millisecond later does. Zero-duration points contribute their own calendar date.
  Gaps remain inside the overall aggregate. Empty/all-TBD collections stay TBD,
  and TBD entries do not force an otherwise timed aggregate to become all-day.
- The event-segment aggregator and seeder now pass full collections. Cancelled
  segments are filtered before choosing the representation. The minimum-segment
  helper uses the same operation without injecting the current time.
- `unionWith` delegates to the same routine for two ranges. For a collection,
  use `union(originalRanges)` directly: a previously collapsed timed range cannot
  remember a terminal midnight point's separate calendar membership. Repeated
  pairwise unions are therefore not a substitute for the collection API in that
  case. Positive-interval binary unions are tested across order and grouping.
- Both DT-03 expected-failure annotations are removed. Sixty new checks cover
  five native timezones, every input order for the fixtures, idempotence,
  reconstruction, coverage, input immutability, cancellation/TBD filtering,
  exact timed ranges, and midnight/leap-day/year/DST boundaries. They execute the
  real event aggregator and aggregate writer, capturing the writer's bounds
  through a database boundary stub.

Band-timezone projection and absolute lifecycle/cache bounds remain part of
POL-01 and the server integration slice. The writer still caches the existing
host-local all-day end and retains its existing exception handling. No stored
events were rewritten and no existing aggregate caches were rebuilt.

## Completed DT-04 / DT-05: resolve clock choices on the edited date

- `TimeOptionsGenerator` now produces civil `HH:mm` values and their nominal
  millisecond-of-day positions. It does not create local `Date` values or use
  today's midnight. The quarter-hour grid stays unchanged across seasons.
- `getDateTimeRangeTimeOptions` resolves those clocks on the edited dates using
  an explicit timezone. Each displayed option carries the actual instant saved
  by the control. End durations are calculated by subtracting the start instant,
  so 01:30-03:30 can correctly show one or three elapsed hours across DST.
- `getClockTimeOccurrences` keeps Temporal behind the shared policy module.
  Dropdowns omit nonexistent clocks and distinguish repeated occurrences with
  UTC offsets. This is explicit occurrence selection; free-form authoring's
  existing `compatible` gap/fold policy remains unchanged.
- The controls preserve the existing end date. On the start date, earlier clocks
  roll to the following calendar date if no remaining occurrence follows the
  start. Dates are shown beside overnight/multi-day choices. A later repeated
  occurrence can remain on the same date even if its clock appears earlier.
- Exact existing starts and ends, including off-grid minutes, seconds,
  milliseconds, zero duration, and the second DST occurrence, remain selectable
  and display accurately. Range edits use option instants directly. Choice
  generation is memoized and omitted for all-day/TBD controls.
- All eight remaining authoring expected failures are now ordinary passing
  checks. Thirty-one additional option tests include Brussels, Los Angeles,
  Sydney, and Lord Howe's half-hour transitions. Three jsdom tests mount the
  real range control, MUI wrappers, and native selects to verify exact display,
  no change on mount, and the saved start/end values. Unrelated query/dashboard
  siblings are isolated.

The component still passes the device timezone. Band-timezone date-picker
integration, showing that zone beside the event editor, and lifecycle adoption
remain part of POL-01. This slice does not change stored data or cached bounds.

## Completed DT-06: compact labels consume the event range

- `EventShortDate` now receives the full `DateTimeRange` and an explicit
  reference time. Timed events say `Happening now` throughout their actual
  interval, including overnight events, with an inclusive start and exclusive
  end. Zero-duration and TBD events do not acquire an ongoing interval.
- Date formatting uses the range's display start: timed instants appear in the
  viewer timezone, while all-day values preserve their selected calendar date.
  Year visibility uses the same supplied reference time as the relative label.
- Compact cards reuse the range and reference time from `RelevantEvents` for
  styling and labels. Refreshing that reference time remains a maintenance item.
- The small presentation component lives in its own module. Tests render it
  directly without intercepting dashboard imports or replacing the global clock.
  All five DT-06 expected failures are now ordinary passing checks; 36 additional
  checks cover interval edges, zero duration, overnight/multi-day events, and
  reference-year formatting in four viewer timezones.

All-day lifecycle boundaries still use the existing host-local range behavior.
Adopting the configured band timezone remains POL-01.

## Completed DT-09: one display range for month-calendar endpoints

- `DateTimeRange.getCalendarDisplayRange()` supplies both endpoints and the
  all-day flag together. All-day endpoints carry local calendar dates for the
  widget; timed endpoints preserve exact instants and elapsed duration. The end
  remains exclusive. TBD ranges have no calendar placement.
- `BigEventCalendarMonth` adapts each uncancelled segment once and passes those
  endpoints to its accessors. It retains the original event, segment, and search
  result for titles, attendance, and selection.
- Seventy checks mount the installed `react-big-calendar` with its Moment
  localizer in five timezone processes. They inspect rendered day spans for
  single/multi-day dates, DST transitions, timed local midnight, overnight
  events, exclusive midnight ends, zero duration, and precise repeated-hour
  instants. Two consumer checks verify the actual month component's accessor
  values, TBD/cancelled filtering, and selection callback data.

This is a display adapter. Band-timezone lifecycle adoption remains POL-01;
calendar query bounds and overlap selection are handled by DT-10 below.

## Completed DT-10: explicit calendar windows and segment overlap

- Month and picker requests now carry a validated `calendarWindow`: inclusive
  start/exclusive end calendar dates, plus the corresponding absolute viewer
  midnight bounds. Each midnight resolves independently across DST. These
  requests no longer encode dates as quick-filter text; ordinary text/year
  searches retain their existing behavior.
- The search core applies one `EXISTS` predicate over uncancelled segments to
  result rows, counts, and facets, alongside existing authorization/visibility
  filters. Timed segments use absolute overlap; all-day segments use stored
  calendar dates and normalized day counts. TBD does not match. Zero-duration
  timed points match their containing window, including its start but not end.
- Cached event starts no longer decide calendar membership. An event starting
  in June with a July segment is returned for July. Picker highlights also use
  individual known, uncancelled segments, preserving zero duration and avoiding
  highlighting gaps between segments.
- Six real MySQL tests execute the production overlap predicate against a
  disposable database, including three SQL session zones, exact/millisecond
  edges, Tokyo midnight, later segments, all-day dates, and 23/25-hour DST days.
  The runner creates and drops only its uniquely named local test database.
  Additional tests cover validation, five viewer-zone request builders, actual
  month/picker request plumbing, and search-core rows/counts/facets wiring.

The existing 100-event page limit in these calendar consumers remains a separate
loading limit. All-day lifecycle/cached bounds remain POL-01, and status facets
and dashboard interval classification remain DT-11.

## Completed POL-01: enforce band authoring and shared lifecycle

- Shared event editors use `dashboardContext.bandTimeZone` and display the zone
  beside the controls. Start dates, clocks, all-day toggles, TBD restoration,
  fallback dates, picker highlights and picker queries use that context.
  Generic personal date/range pickers keep device-local semantics. The import
  parser transports UTC calendar-date markers and defaults to the band date.
- Existing timed instants, seconds/milliseconds, durations and repeated-hour
  occurrences survive loading and unchanged selections. Newly authored ambiguous
  dates use the shared compatible DST policy. Timed presentation remains viewer-local;
  all-day presentation preserves calendar dates.
- Event metadata, search/relevant cards, compact labels and attendance use the
  configured band-midnight interval for all-day lifecycle, with inclusive start
  and exclusive end. Relative `Today` remains a viewer-calendar fact; it can differ
  from the globally shared ongoing bucket. Attendance retains the aggregate interval,
  including gaps between its segments.
- Mixed timed/all-day aggregation projects timed dates in the band timezone.
  Cached `endDateTime` is an absolute band-midnight boundary for all-day aggregates.
  Event/segment writes now propagate recalculation failures and use transactions.
- Generic, bulk, branding and raw Settings writes refresh derived bounds in the
  same serializable transaction, including clear/default and rename/delete paths.
  Failure rolls back configuration, prior bound updates and audit records.
  Unchanged events are skipped; authored segments and calendar revisions are untouched.
  Calendar feed dates remain date-only values, independent of the band lifecycle.

### Existing derived bounds at deployment

Run `node scripts/recalculate-event-date-bounds.cjs` to review event IDs and
before/after values without writing. After reviewing that report, run the same
command with `--apply` to refresh the four derived aggregate fields in one
transaction. No authored segment values or calendar revisions are changed.
The implementation's local dry run inspected 430 events and proposed 37 aggregate
corrections; it did not apply them. Review each target database independently.

DT-11 remains deferred: database status facets and broad dashboard relevance still
use their older predicates. This slice does not claim those queries implement the
shared interval policy.

## Executable evidence

The date/time tests live under [tests/datetime](../tests/datetime). Native `Date` runs in
separate Node processes with `TZ` set before startup. This avoids relying on the
developer machine's timezone or changing timezone globals inside a Vitest worker.
The matrix covers UTC, Brussels, Tokyo, Los Angeles, and Sydney for hydration,
aggregation, and feed cases. Clocks are fixed where an operation depends on the current date.

| Suite | Ordinary passing checks | Known failing checks in strict mode | Boundary exercised |
| --- | ---: | ---: | --- |
| [timePolicy.test.ts](../tests/datetime/timePolicy.test.ts) | 66 | 0 | Real shared range, arithmetic, classification, relative labels, and sorting helpers |
| [allDayHydration.test.ts](../tests/datetime/allDayHydration.test.ts) | 40 | 0 | Stored all-day dates, explicit local authoring, copies, serialization, and calendar boundaries in five zones |
| [timedHydration.test.ts](../tests/datetime/timedHydration.test.ts) | 50 | 0 | Exact instants/durations, copies, DST occurrences, zero-duration display, and point labels in five zones |
| [unionPolicy.test.ts](../tests/datetime/unionPolicy.test.ts) | 60 | 0 | Range algebra, full-list event aggregation, cancellation/TBD filtering, and actual writer bounds in five zones |
| [authoringPolicy.test.ts](../tests/datetime/authoringPolicy.test.ts) | 32 | 0 | Real clock-option/range helpers and the control's selected-end/toggle calculations |
| [clockOptions.test.ts](../tests/datetime/clockOptions.test.ts) | 31 | 0 | Civil clock grid, dated instants, gap/fold choices, precise selections, and overnight/multi-day ends |
| [clockControls.test.ts](../tests/datetime/clockControls.test.ts) | 3 | 0 | Mounted range control and native select changes in jsdom |
| [eventDateConsumers.test.ts](../tests/datetime/eventDateConsumers.test.ts) | 49 | 0 | Actual compact label rendering, interval edges, all-day dates, overnight events, and reference years in four viewer zones |
| [calendarDisplay.test.ts](../tests/datetime/calendarDisplay.test.ts) | 75 | 0 | Display ranges, real month-widget day spans, and local search windows in five viewer zones |
| [calendarConsumer.test.ts](../tests/datetime/calendarConsumer.test.ts) | 3 | 0 | Production month accessors, request bounds, TBD/cancelled filtering, and selection data |
| [calendarWindow.test.ts](../tests/datetime/calendarWindow.test.ts) | 15 | 0 | Explicit window policy, DST boundaries, and request/SQL input validation |
| [calendarWindowConsumers.test.ts](../tests/datetime/calendarWindowConsumers.test.ts) | 3 | 0 | Mounted picker lookup, search-config propagation, and segment highlights |
| [calendarFeed.test.ts](../tests/datetime/calendarFeed.test.ts) | 29 | 0 | Actual application feed adapter and installed `ical-generator` serialization |
| [bandTimePolicy.test.ts](../tests/datetime/bandTimePolicy.test.ts) | 54 | 0 | Named-zone validation, band-time conversion, DST ambiguity, all-day bounds, and host-timezone independence |
| [bandTimeZoneLoading.test.ts](../tests/datetime/bandTimeZoneLoading.test.ts) | 4 | 0 | Fresh server setting reads, default/error behavior, and dashboard delivery |
| [bandTimeZoneWrites.test.ts](../tests/datetime/bandTimeZoneWrites.test.ts) | 25 | 0 | Generic and raw settings validation, partial edits, clears, and retained authorization |
| [bandPolicyConsumers.test.ts](../tests/datetime/bandPolicyConsumers.test.ts) | 45 | 0 | Band lifecycle, DST, authoring and actual aggregate writer across five native zones |
| [bandEditor.test.ts](../tests/datetime/bandEditor.test.ts) | 4 | 0 | Mounted band editor dates, clock selections, all-day and TBD changes |
| [bandAttendance.test.ts](../tests/datetime/bandAttendance.test.ts) | 4 | 0 | Production metadata and attendance adapter at exact band-midnight edges |
| Total | 592 | 0 | All standard date/time checks are ordinary passing regressions |

An additional six [MySQL overlap checks](../tests/datetime/calendarWindow.mysql.test.ts)
and five [POL-01 MySQL checks](../tests/datetime/bandPolicy.mysql.test.ts)
are opt-in and skipped by the standard command. The POL-01 suite verifies real
setting refreshes, raw mutation hooks, rollback, read-only previews and cached-field repairs. They passed via
`node scripts/test-datetime-mysql.cjs`, which requires a local MySQL server with
permission to create and drop a disposable test database. The suite executes
the production SQL predicate; separate search-core tests verify its integration
with row, count, facet, and visibility queries.

The original audit contained 134 checks: 90 ordinary passing checks and 44 known
failures. Slice 1 adds 83 policy/loading/write checks and repairs the five feed failures.
DT-01 adds 40 checks and repairs three more failures.
DT-02/DT-08 add 56 checks and repair another 18 failures.
DT-03 adds 60 checks and repairs two more failures.
DT-04/DT-05 add 34 checks and repair eight more failures.
DT-06 adds 36 checks and repairs five more failures.
DT-09 adds 72 checks for a previously code-traced finding.
DT-10 adds 23 standard date/time checks, six opt-in MySQL checks, and two
search-core integration checks in the authorization suite.
POL-01 adds 54 standard checks and five opt-in MySQL checks, and converts the
last three expected failures to ordinary passing regressions.
[Setting authorization tests](../tests/authorization/settingAuthorization.test.ts)
also cover default reads, valid persistence/readback, invalid updates leaving all
branding values unchanged, and denied or stale permission grants.

All previously annotated failures are now ordinary passing regressions. DT-11
remains deferred and code-traced; a green suite does not cover those SQL semantics.
Run the date/time regressions with:

```powershell
yarn test tests/datetime
```

The earlier `CMDB_DATETIME_AUDIT_STRICT=1` switch now produces the same passing
result: 592 checks, with eleven opt-in MySQL checks skipped.

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

**DT-02 - Resolved 2026-09-15: reading timed values rounded them and could select the wrong DST occurrence.**

[The former constructor](../shared/time.ts) snapped durations to 15 minutes and
reconstructed starts through `roundToNearest15Minutes`.
Loading `07:47:12.345Z` with a 20-minute duration yielded `08:00Z` and 15 minutes.
In Brussels, the second `02:30` on 25 October 2026 (`01:30Z`) became the first
occurrence (`00:30Z`), even though the persisted instant was unambiguous. The
Pacific autumn transition reproduced the same loss.

The [all-day toggle](../src/core/components/DateTime/DateTimeRangeControl.tsx)
combines the selected date with the current clock. Previously, at 23:50, turning
all-day off changed 10 July to 11 July through the constructor's upward rounding;
23:45 was the passing control. Both now preserve their selected date and clock.

The constructor now preserves timed instants and durations exactly, including
zero durations and milliseconds. Copies preserve the specified DST occurrence.
Any snapping is an explicit authoring operation; hydration does not perform it.

**DT-03 - Resolved 2026-09-15: aggregate ranges could gain days or lose segments.**

[The former union routine](../shared/time.ts) estimated calendar days from elapsed
milliseconds. A Brussels all-day event on 25 October 2026 spans 25 elapsed hours;
unioning it with itself produced two calendar days. Mixed timed/all-day unions
also depended on iteration order. In UTC, these segments should cover 9-11 July:

- 9 July 23:00, duration two hours;
- 10 July, all day;
- 11 July 01:00, duration one hour.

Different permutations produced either two or three days; the two-day result
omitted the final segment. The [aggregate writer](../src/core/db3/server/db3mutationCore.ts)
now receives bounds from the full-list aggregate routine, which chooses its
representation before calculating extrema. All tested permutations cover the
three dates. Self-union on the autumn transition preserves one calendar day.
Tests also verify exact timed extrema, coverage, idempotence, and the writer's
persisted bounds. No input sorting or schema change is required.

**DT-04 - Resolved 2026-09-15: clock choices depended on the day the editor opened.**

[The former TimeOptionsGenerator](../shared/time.ts) built nominal clock choices
by adding elapsed milliseconds to today's local midnight. On the Brussels or
Pacific spring clock-change day, a July event's selected 03:00 appeared as
04:00. On the autumn change day it became 02:00, with duplicate clock labels.
The grid now uses civil clock values. Resolved dropdowns use the edited date
and explicit zone, with distinct offsets for repeated clocks and accurate
labels for existing off-grid selections.

**DT-05 - Resolved 2026-09-15: an end-time selection across DST saved a different end time.**

[The former end-time handler](../src/core/components/DateTime/DateTimeRangeControl.tsx)
stored nominal clock distance as elapsed duration. In Brussels on 29 March
2026, start 01:30 and selected end 03:30 saved end 04:30. On 25 October, the same
selection saved 02:30. Pacific equivalents also failed. Options now carry dated
instants, and the handler stores their actual elapsed difference from the start.
Tests verify the one/three-hour cases, half-hour DST changes, overnight and
multi-day ends, and the mounted select's change handler.

**DT-06 - Resolved 2026-09-15: compact event labels discarded event duration and all-day meaning.**

[EventShortDate](../src/core/components/event/EventShortDate.tsx) formerly received
only `startsAt` and used a point-timestamp helper. A four-hour event viewed two
hours after its start said `Today` instead of `Happening now` in all four tested
zones. An all-day 10 July event displayed 9 July in Los Angeles because its raw
UTC marker was formatted as an instant. The component now consumes the caller's
full event range, uses range-aware relative timing, and formats the semantic
display date. All five regressions and 36 additional boundary checks pass.

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
use `DateTimeRange` and now benefit from the DT-02 hydration repair.

**DT-08 - Resolved with DT-02: point timestamps acquired an invented ongoing interval.**

[CalcRelativeTimingFromNow](../shared/time.ts) formerly modeled an instant as a
zero-duration event, while the range constructor expanded zero to 15 minutes.
A timestamp one minute in the past consequently said `Happening now`, affecting
generic [DateValue](../src/core/components/DateTime/DateTimeComponents.tsx#L47)
tooltips and other creation/history timestamps as well as the compact event
label. The constructor now preserves zero, and point-relative descriptions call
the shared calendar-label routine without event lifecycle classification.
Tests cover past, equal, and future points at a local midnight boundary.
Compact labels now consume the full event range under DT-06.

**POL-01 - Resolved 2026-09-15: band-timezone adoption.**

The completed POL-01 section above describes authoring, lifecycle, aggregate bounds
and atomic setting-change refreshes. Five-zone regressions now agree at both
band-midnight boundaries. Existing cached rows have a separate review/apply command;
no target database refresh was applied during implementation.

## Calendar integration and remaining query findings

**DT-09 - Resolved 2026-09-15: the month calendar mixed start and end representations.**

[EventCalendar's accessors](../src/core/components/EventCalendar.tsx) formerly
returned raw persisted `segment.startsAt` for the start and a reconstructed
range end. An all-day UTC date was therefore interpreted as a local timed start,
including the previous local day west of UTC. Both endpoints now come from
`getCalendarDisplayRange()`, and TBD segments are excluded from placement.
Tests mount the installed `react-big-calendar` and inspect its rendered day
spans in UTC, Brussels, Los Angeles, Tokyo, and Sydney. DT-10 now has local
MySQL evidence as described below; DT-11 remains a code trace.

**DT-10 - Resolved 2026-09-15: calendar queries lost viewer boundaries and missed overlapping segments.**

The [month calendar](../src/core/components/EventCalendar.tsx#L307) and
[picker event lookup](../src/core/components/DateTime/useEventsForDateRange.tsx#L25)
formerly sent `YYYYMMDD-YYYYMMDD` quick-filter strings through
[eventSearchConfig](../src/core/hooks/searchConfigs.ts#L51). The
[SQL date filter](../src/core/db3/shared/db3basicFields.ts#L1477) uses
`DATE(startsAt) BETWEEN ...`, without viewer-zone instant bounds or an end bound
for overlap selection.

For stored UTC timed values, a Tokyo 11 July 00:30 event has a 10 July UTC start.
A date-token request for 11 July therefore excluded it even though the tested label says
11 July and `Today`. Month-view padding hides many boundary cases, so this is
not proof of the historical month-calendar report. Separately, an event with
a 1 June first segment and a 10 July later segment was outside July's padded
start-date query even though the calendar renders individual segments.

Both consumers now send structured instant and date-only bounds. The server
selects overlapping uncancelled segments via the shared search filter, preserving
the existing event visibility rules. The production overlap predicate passes
real MySQL boundary tests; search-core tests verify row/count/facet integration.
Simple year-number searches retain their existing behavior.

**DT-11 - Deferred: database status filters disagree with interval classification.**

[Past/Future expressions](../src/core/db3/shared/apiTypes.ts#L357), used by the
[active date facets](../src/core/db3/shared/db3basicFields.ts#L1314), compare only
the start against `CURDATE()`. An event that finished earlier today can still
be `Future`, while an event that started yesterday and is ongoing can be `Past`.
[Dashboard relevance](../src/auth/queries/getDashboardData.ts#L94) uses an
inclusive end (`endDateTime >= now`) rather than the agreed exclusive end.
It also compares the all-day UTC date marker as a start against the cached end.
POL-01 now writes the end in band time, but DT-11 must still give both SQL endpoints
the same absolute meaning and use an exclusive end.

Move shared status semantics into policy and apply equivalent explicit bounds
in SQL. The database clock/timezone should not supply an alternative definition
of today or ongoing. Keep broad relevance windows simple; their one-day margins
do not need a framework for elapsed-versus-calendar-day precision.

**Additional maintenance observations.**

- POL-01 removes the aggregate writer's swallowed-error path and makes event/segment
  edits transactional, so an aggregate failure rolls back the date edit.
- [RelevantEvents](../src/core/components/event/RelevantEvents.tsx) captures
  `now` once without updating it. DT-06 makes its card styling and labels share
  that reference time. [DateValue](../src/core/components/DateTime/DateTimeComponents.tsx#L51)
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
   **DT-01, DT-02, and DT-03 are completed:** all-day hydration and local authoring
   have separate boundaries, timed hydration preserves exact values, and
   full-list aggregation calculates extrema in the appropriate representation.
   Point labels are separated under DT-08. See DT-03's collection API requirement
   for mixed ranges containing terminal midnight points.
3. **Integrate existing controls and presentations.** Event editors, compact
   labels, attendance timing, and calendar adapters consume semantic operations.
   Keep generic personal report/range pickers in the viewer timezone: they share
   lower-level controls with event editing and must not inherit band time
   accidentally. **DT-04/DT-05, DT-06, and DT-09 are completed:** clock options and
   selected-end calculations use resolved instants; compact labels use full event
   ranges; month-calendar endpoints share one display adapter. Band-timezone
   date-picker integration and attendance timing remain open.
4. **Align server aggregation, queries, and remaining feed behavior.** Cache
   absolute event bounds consistently and apply overlap queries. All-day feed
   serialization and timed feed hydration are repaired.
   **DT-10 is completed:** calendar queries use explicit viewer/date bounds and
   segment overlap. Define recalculation of derived all-day bounds when the band
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
occurrence and must remain unchanged. POL-01 now applies that boundary to event authoring and defines transactional
recalculation of derived bounds after setting changes.

## Verification and limits

- POL-01 verification on 2026-09-15: full `yarn test` passed 1,301 cases;
  twenty opt-in MySQL checks were skipped. All 592 standard date/time checks are
  ordinary passing regressions, with no expected-failure annotations remaining.
- Focused ESLint, `git diff --check`, and ordinary `yarn tsc --noEmit` passed.
  The production Next/Blitz build passed using the same configuration with a
  temporary separate output directory; the initial `yarn build` collided with
  the running development server's `.next` output during page-data collection.
  Clean `tsc --noEmit --incremental false` reproduces TS2321/TS2345 in
  `mergeUsers.ts` on both unmodified HEAD and this tree. No merge code was changed.
- `node scripts/test-datetime-mysql.cjs` passed all eleven checks against a fresh
  local schema and dropped that disposable database afterward. Five checks cover
  setting changes, actual raw hooks, atomic rollback, previews and repairs; six
  cover the production calendar-overlap SQL predicate.
- Settings resolver tests retain the existing in-memory authorization harness.
  It does not emulate rollback; the new MySQL failure-injection check supplies
  that evidence. Raw hook integration uses real writes inside a transaction;
  separate resolver tests cover validation and authorization.
- Five native timezone processes exercise actual range helpers and the aggregate
  writer with stubbed database reads. Mounted jsdom tests cover the band editor,
  picker query/highlight adapter, and production metadata-to-attendance policy.
  Unrelated query/response/UI dependencies are isolated in those mounted tests.
- A read-only local refresh preview inspected 430 events and found 37 stale
  aggregate records. No existing event data was changed. This is not evidence
  about historical corruption or the state of a production database.
- DT-09 widget probes use the installed calendar and Moment localizer in jsdom,
  with supplied element heights because jsdom has no layout engine. DT-10
  search-core tests separately verify row/count/facet and visibility integration.
- No production database, deployed server timezone, manual browser journey,
  external calendar application, or production-scale query plan was tested.
  DT-11 remains deliberately deferred. Timed display and ordinary all-day feed
  semantics retain their existing passing regressions.
