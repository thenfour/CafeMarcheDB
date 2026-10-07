# Current application recovery evidence

The first A0 bootstrap slice restores a browser path in development. **A0 remains
open.** The [implementation plan](04-implementation-plan.md) owns delivery gates
and the restriction register.

## Restored boundary

- Current-account loading returns shared identity/contact fields, with no role
  grants, credentials, or person-level band assignments. The dashboard loads the
  current membership's instruments separately.
- Dashboard startup uses the existing DB3 read owner, fresh authorization,
  localized Permission metadata, migrated catalogs, settings, and membership
  views. It does not execute deferred event/menu/legacy-role readers. DTOs remain
  unhydrated until the client builds one reference store per snapshot.
- An authenticated account explicitly selects an active membership; a platform
  Sysadmin may select any active band. Names resolve in each band's locale scope.
  An omitted selection stays in account/platform context. Navigation preserves
  the selected band and route locale without discarding existing queries/hashes.
- Page bootstrap crosses the Blitz query boundary on browser navigations, keeping
  server localization/session imports out of the client bundle. SSR establishes
  the session from its request/response. Both paths authorize before invoking
  `getInitialProps` page loaders.
- Suspended band transitions retain their request token across React retries.
  The root has a Suspense boundary for session loading. These fix observed startup
  and context-switch failures, rather than relaxing authorization or compilation.
  The navigation regression test reproduces the stale platform context with the
  old implementation and passes with the retained token.

## Verification

Rehearsal data: restored `tenfour_cmdb_20261002_at_git_094a783a9.sql` into a new
private MariaDB 10.11 database on `127.0.0.1:32694`, then ran the normal migration
deployment. All migrations applied. The resulting copy retained its existing
band, 103 memberships, and 26,764 audit rows. The configured application database
was not used for rehearsal writes.

Development browser check: launched `blitz dev --port 10456` with `DATABASE_URL`
pointing only at that copy. A temporary account used an existing migrated band
role without editing its grants. Playwright exercised login, platform context
with no automatic band selection, explicit selection, a band-preserving profile
link, profile reload, return to platform context, and the no-band profile prompt.
The checked pages returned HTTP 200 and had no browser page errors. The dashboard
screenshot was also inspected. This is development-browser evidence; a built
production server could not be checked because the normal build still fails.

| Check | Result |
| --- | --- |
| New bootstrap/navigation tests, including six native MariaDB cases | Passed: 23 tests across six files. |
| Migrated-production-copy bootstrap/account tests | Passed: eight tests, including six native cases. |
| Broader focused catalog/membership/localization regression | Passed: 240 tests across 31 files, including native MariaDB tests on a separate fresh fixture. |
| Updated Permission-view fixtures and band-selector typing | Passed: 35 tests across two files. |
| ESLint on changed/new TypeScript files; `git diff --check` | Passed. |
| `yarn typecheck` | Fails: 641 diagnostics; baseline was 655. No compiler exclusions or error suppression added. |
| `yarn build` | Fails at obsolete `tx.role` in `src/auth/mutations/assignUserRole.ts:44`, after the unused demo-seed blocker was removed. |
| `yarn test --reporter=dot` | Fails in the Node batch: 343 failed, 1,223 passed, 103 skipped. Later isolated DOM batches are not reached. |

The unchanged commit was checked in a detached temporary worktree: its full-run
Node batch had 345 failures. The final comparison added no failing test names.
The two removed failures belonged to the obsolete dashboard transport fixture,
which assumed removed Role/Instrument models and legacy menus. Its meaningful
DTO/hydration/reference-isolation assertions now run against native migrated
catalog/membership reads. Permission-view fixture data now includes the explicit
localized-string resolution contract.

Focused tests use the repository runner, `yarn test <test paths> --reporter=dot`.
Native tests set `CMDB_PHASE2_TEST_DATABASE_URL` to a private disposable database.
The shared settings fixture now creates its own transactional role/grants so it
does not depend on a production copy having newly introduced permissions.
Broader native suites still assume an empty audit history and default role grants;
they were therefore run against a separate fresh target-schema fixture. Running
those suites directly on preserved production history exposed 12 fixture-dependent
failures; production history/grants were not rewritten to satisfy those tests.

Local diagnostic logs and screenshots are under ignored `temp/a0-*` paths. The
private database server, databases, browser, and baseline worktree are disposable
verification resources, not application configuration.

## Remaining A0 blockers

Fix owning contracts before their cascading consumers: `prismArgs.ts` is the
largest diagnostic root, followed by obsolete shared-user/Role and event/file/
song descriptors and views. Shared-account merge code and legacy authorization
fixtures also retain removed relationships. None are repaired by an implicit band
default or a compatibility alias.
The stricter shared-account payload also exposes three deferred event consumers
that still treat the account as a person carrying instruments. They must consume
membership data when events are restored; band assignments are not added back to
the shared-account payload to satisfy those consumers.

Deferred source, registrations, pages, RPC/API entry points, and background jobs
still need coherent isolation. The home notice and omitted dashboard reads do not
establish that isolation; legacy sidebar/direct links still expose unfinished
surfaces. The browser probe also observed server errors from the old telemetry
writer and the catch-all Custom Link lookup for a missing favicon. Those are
supporting-domain ownership defects requiring migration or deliberate isolation.

After those dependencies compile, rerun the normal checks and start the built app
with `yarn start` against a disposable migrated copy before closing A0. Keep the
existing migrated membership/catalog behavior and the explicit-band browser path
working throughout that work.
