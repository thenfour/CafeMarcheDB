# Current application recovery evidence

The A0 bootstrap path has development-browser evidence, and obsolete Role and
shared-account merge dependencies are now isolated. **A0 remains open.** The
[implementation plan](04-implementation-plan.md) owns delivery gates and the
restriction register.

Removed implementations and behavioral tests are now preserved as searchable
source references under the [feature-preservation procedure](13-feature-preservation.md).
The reference inventory and checksums protect that baseline; restoration still
requires executable tests and browser evidence. No recovery gate is closed by
preserving source alone.

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
- The removed Role model has no DB3 tables, editor/dashboard/matrix views, command
  registrations, or dashboard payload. Old account role controls are removed;
  account projections no longer select its role relation or ID. Existing global
  and band role authorization and membership role assignment are preserved.
- Retired role assignment/designation, merge search/preview/commit, and account
  dependency-analysis RPCs require login and explicitly reject before database
  access. Their obsolete implementations are disabled and preserved in source. Role-administration URLs
  and the dependency-analysis tab display registered localized explanations;
  merge controls are removed and capability responses advertise neither merge
  nor account-role assignment.
- Shared DB3 client fields and callers now declare registered labels and help.
  Named and legacy render paths update headings, form captions and accessible
  names from the current catalog. Composite headings/captions remain distinct,
  intentional blanks are retained, and changing band/language replaces the old
  presentation. Custom Link behavior help uses a finite registered inventory.
  This repairs presentation dependencies without restoring deferred domains.

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
| Source preservation and Git provenance | Passed: 130 references in 98 files. All 4,509 removed lines in the 67 pending code/test files are covered. 57 active files retain identical executable syntax; 39 reference modules contain only an empty export. Existing staging is unchanged. |
| Preservation safeguards, temporary RPC boundaries, member/page contracts and DOM regression | Passed: 108 tests across ten active files, including 23 preservation checks. Nine wholly disabled specifications are retained separately; eight are under the runner's default `tests/` directory. |
| Field localization, selectors, instrument editor, presentation delivery, factory contracts and preservation/recovery boundaries | Passed: 106 tests across nine files. Includes band-first labels/help, band and language switches, intentional blanks, composite captions, accessible names, unchanged scalar writes and explicit dialog captions. |
| Recovery RPC/registration boundaries, table authorization, account/bootstrap and membership role/lifecycle contracts | Passed: 66 tests across six files. A strict database proxy rejects any access from deferred RPCs. |
| Account/bootstrap, membership contracts/pages/editors and suspended presentation navigation | Passed: 67 tests across ten files. |
| Native dashboard/catalog snapshots and membership role/lifecycle/profile/instrument/tag regression | Passed: 60 tests across seven files on a new private MariaDB target-schema fixture. |
| Earlier migrated-production-copy bootstrap/account check | Passed: eight tests, including six native cases; the development browser evidence above predates Role/merge isolation. |
| ESLint on changed/new TypeScript files; `git diff --check` | Passed. |
| `yarn typecheck` | Fails: 422 diagnostics, down from 531 before the field-presentation slice. No compiler exclusions or error suppression added. |
| `yarn build` | Gets past Custom Links and shared field-label callers; fails at the legacy event-search payload in `src/core/components/event/EventComponents.tsx:1392`. The duplicate role-page component-name warning is also fixed. |
| `yarn test --reporter=dot` | Fails in the Node batch: 297 failed, 1,244 passed, 94 skipped, matching the preceding baseline. Later isolated DOM batches are not reached; focused DOM checks above passed. |

The Role/merge slice began with 343 full-run Node failures. The original Role
editor/designation/association and merge policy/native transaction/picker tests
are preserved as commented specifications. Partially affected test files retain
their active cases. Explicit RPC rejection, crafted generic-write rejection,
registration-absence and preserved membership-command checks verify the temporary
boundary; they do not establish feature parity. Permission-view fixtures retain
the explicit localized-string resolution contract, and dashboard DTO/hydration/
isolation checks run on native migrated catalog/membership readers.

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

Fix owning contracts before their cascading consumers: `prismArgs.ts` remains the
largest diagnostic root, followed by obsolete person-level instrument/tag and
event/file/song descriptors and views. Generic settings and legacy authorization
fixtures also retain removed relationships. Role administration and shared-account
merge execution are isolated; other deferred domains still need that boundary.
None are repaired by an implicit band default or a compatibility alias.
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
