# Event UTC spans

## Representation

`DateTimeRange` stores a real start instant and an elapsed millisecond duration.
Its end is exclusive. `isAllDay` records authoring intent and does not change
hydration, comparison, hit testing, or aggregation. Unions preserve the exact
minimum start and maximum end, including gaps; a mixed union is timed.

`Date` always identifies an instant. `ZonedDate` pairs an instant with the zone
through which it is presented. `CalendarDate` pairs an ISO calendar day with its
zone, and `CalendarRange` contains an inclusive start and exclusive end day.
Native Date carriers exist only at external calendar widget and iCalendar
serialization boundaries.

```ts
range.hitTestDateTime(new Date());
range.getBounds(); // { start, end }, both real UTC instants

createAllDayRange({
    startDate: "2026-03-29",
    endDateExclusive: "2026-03-30",
}, "Europe/Brussels"); // 23 elapsed hours

formatEventDateRange(range, {
    viewerTimeZone: "Asia/Tokyo",
    bandTimeZone: "Europe/Brussels",
    locale: "en",
});
```

Shared event editors resolve dates and clocks in the band zone before saving.
Compact formatters present timed events in the viewer zone, and true all-day
events as their selected band dates everywhere. Timed spans longer than 24 hours
use compact dates without clocks; this never enlarges their stored bounds.
Relative calendar labels compare those displayed dates with the viewer's today;
they are separate from absolute Past/Present/Future classification.

Changing the band timezone reanchors all-day segments: read their calendar dates
in the old zone, resolve the same dates in the new zone, and refresh aggregates.
The setting, segments, aggregates, and setting activity log share a transaction.
Timed segments keep their exact instants. Date-only calendar feeds retain their
selected dates and existing revision numbers during a setting reanchor.

The compact English forms have characterization tests recorded before extraction.
Exact EN/FR/NL assertions also cover explicit zones, all-day DST dates, exclusive
end dates, overnight spans and long timed spans. The multilingual formatter now
uses the final included day instead of accidentally including the ending midnight.

## Existing database conversion

**The schema migration alone is insufficient.** Existing all-day rows encode
calendar dates in UTC fields and durations in nominal 24-hour units. Both fields
must be converted together. Existing cached event aggregates must also change.

1. Stop application processes and other event/setting writers for a maintenance
   window. Take a restorable database backup.
2. Deploy the new code and run the normal Prisma migrations, including
   `20260915230000_event_utc_spans`. Regenerate the Prisma client.
3. Keep the application stopped and review the preview:

   ```sh
   node scripts/migrate-event-utc-spans.cjs
   ```

4. Apply the reviewed conversion:

   ```sh
   node scripts/migrate-event-utc-spans.cjs --apply
   ```

5. Run the preview again. `changes` and `aggregates` must both be empty before
   starting the new application.

The schema migration marks existing segments as version 1 and gives newly
created segments version 2. The converter explicitly handles version 1; it never
guesses from a timestamp's hour. It converts known all-day bounds, preserves
timed instants and TBD values, marks converted rows as version 2, and recalculates
aggregates in one serializable transaction. A failed conversion rolls back. A
successful conversion can be rerun safely. Fresh empty databases already default
to version 2.

The old application must not write between the schema migration and conversion:
its legacy values would receive the new default version. Rolling back requires
restoring the matching pre-conversion data and application together.

`recalculate-event-date-bounds.cjs` repairs derived bounds after conversion; it
does not convert legacy storage. Segment hydration rejects an explicitly supplied
legacy version rather than silently interpreting it as an instant.

## Verification and manual inspection

```sh
yarn vitest run tests/datetime
node scripts/test-datetime-mysql.cjs
```

The MySQL runner creates and drops a separate randomly named local database. It
tests calendar SQL, setting reanchors, rollback, migration previews, and reruns.

The existing `/backstage/test/date` explorer shows shared UTC storage beside two
presentation zones and real editors. Changing a panel zone preserves the sample's
UTC bounds. Changing the simulated band zone explicitly reanchors all-day storage.
The standalone day control displays its `CalendarDate` and resolved midnight.

DT-11 status facets and dashboard relevance remain deferred.
