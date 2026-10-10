# Dashboard relevance through Event search

Recorded 2026-10-10.

`loadRelevantEventCandidates` now calls `searchViewPage` in the existing domain
search owner. Event search declares the `eventRelevance` mode, including its field
dependencies, candidate predicate and override/proximity ordering. The shared
pipeline applies authorization, visibility, ordinary filters, public-identity tie
breaking and pagination. The mode also works through the normal search endpoint
with counts and facets.

The dashboard requests the six scalar fields in `Event_Relevance`, with twenty
candidates and the existing five-card classifier. Its page-only execution shares
the normal search preparation, pagination and named-view projection, and omits
counts, facets, attendance, descriptions and other card relations. Explicit
overrides can fall outside the ordinary time window; hidden overrides are excluded
before the candidate limit. Cancelled status meaning includes retired statuses.
Ordinary candidates have a lower end-time bound and include later future Events
for fallback. The classifier retains the seven-day/24-hour elapsed-time boundaries.

## Comparison

The baseline is the dashboard reader from commit `350e3ac5`. Its SQL and parsing
live only in `tests/performance/support/historicalDashboardRelevance.ts`; product
readers use shared search.

Both variants ran in the same freshly authorized native database snapshot with
the same fixed clock, rows and actor. Each population contains equally sized
selected and foreign bands. Dates cover approximately two years around the clock;
three pins include past, future and undated Events. Fixtures also contain ordinary
undated Events, hidden overrides, retired cancelled statuses, deleted Events,
private Events and private creator-owned Events. Setup and initial authorization
are outside the measurements. Measured time includes each reader's queries,
validation, projection and final classification.

Environment: MariaDB 10.11.9, Prisma 5.12, Node 24.13.0, Windows 11 Pro,
AMD Ryzen 7 7700, loopback database connection. Ten warmups per variant precede
fifty timed calls per variant and population. First-call order alternates between
variants. A second independent disposable database run checks repeatability.
Every warmup and measured call asserts identical ordered public Event IDs.

Wall-clock times in milliseconds, from the first run:

| Events per band | Total Events | Previous median | Previous p95 | Shared search median | Shared search p95 | Median difference |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 200 | 1.243 | 1.416 | 9.528 | 10.270 | +8.285 |
| 1,000 | 2,000 | 5.416 | 6.003 | 10.437 | 11.189 | +5.021 |
| 10,000 | 20,000 | 41.775 | 44.729 | 18.796 | 19.960 | -22.979 |

Repeat-run medians were respectively 1.240/9.415, 5.488/10.628 and
42.651/19.083 ms for previous/shared search. Both runs selected four cards in the
smallest fixture and five in the others, with identical identities and order.

The previous reader issues one statement inside the already established snapshot.
Shared search issues eighteen on this fixture: two Event selection/projection
statements and the authorization refreshes at the shared search and DB3 view
boundaries. The page reader does not issue facet or count queries. This explains
the fixed overhead at smaller populations. Median summed SQL durations reported
by Prisma were 0/0, 4/1 and 41/8 ms for previous/shared search; those durations have
millisecond resolution. At the largest population, faster candidate SQL outweighs
the additional shared-reader overhead on this workload.

These are warm-cache, single-reader measurements on synthetic local data. They
document the tradeoff, rather than predict remote-database latency, throughput or
all production data distributions. No schema or index changes were made.

## Reproduce

Start the repository's disposable MariaDB test server, then run:

```powershell
node scripts/benchmark-dashboard-relevance.cjs
```

The default server is `127.0.0.1:32695`. An alternative can be supplied through
`CMDB_BENCHMARK_DATABASE_SERVER_URL`, for example
`mysql://root@127.0.0.1:32694/mysql`. The wrapper accepts only the existing loopback
test-server ports, creates a random `lsmb_phase2_*` database, applies the current
Prisma schema, invokes `yarn test ... --reporter=dot`, and drops the database in
`finally`. Output includes versions, population sizes, median/p95 wall time,
median SQL duration, query counts and result parity. Normal test runs skip the
three benchmark cases; the wrapper explicitly enables them. There are no timing
threshold assertions.
