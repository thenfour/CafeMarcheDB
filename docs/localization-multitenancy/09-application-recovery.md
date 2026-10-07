# Current application recovery evidence

The A0 bootstrap path has development-browser evidence, obsolete Role and
shared-account merge dependencies are isolated, and telemetry recording now uses
the target schema and explicit ownership. **A0 remains open.** The
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
- Generic settings storage/view are no longer registered with DB3. Settings and
  branding pages read authorized presentation snapshots and write registered
  commands, with per-key controls, validation, reset and scope-bound clipboard
  import. Failed writes retain drafts; account/band changes discard old drafts
  and pending clipboard imports. The obsolete editors, descriptor/view and
  replaced authorization assertion are preserved in five new source references.
  Logo editing, optional primary text color and uploads remain explicitly
  unavailable; hosting mode is configured by deployment. `settings-editors`
  remains pending until full parity and built-browser verification.
- Generic shared-person selectors, the derived `User_Editor` DTO, its grid and
  generated writes now exclude instrument/tag assignments. Name/phone validation
  matches the database's 768-character limits. `UserInstrument` storage, editor
  and CRUD registrations are removed; unreachable legacy person-detail/list
  renderers and enrichment remain as source references. BandUser assignment
  contracts stay active. Deferred invitation views still resolve old
  tag-assignment metadata during startup; its generic writes/deletion are now
  disabled, and its removal remains coupled to event payload recovery.
- Client telemetry carries the presentation input in both HTTP and RPC requests.
  Actor identity is refreshed with band context in the recording transaction;
  natural/client-owned IDs are rejected. Direct resource associations require
  the selected band; segments/setlists and gallery items inherit ownership
  through their event/file. Global credit-type and attendance references remain
  available in platform context. Instrument actions use `bandInstrumentId`.
  The formatting locale resolves independently of raw device locale/language;
  an unregistered or deleted locale remains null. Asynchronous device collection
  retains the event's original band, locale, URI and associations. Account-level
  Google sign-in and the still-deferred calendar feed explicitly use null band/
  locale context. Recording schemas no longer initialize the DB3 registry.

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
| Source preservation and Git provenance | Passed: 149 references in 105 files. The fourteen new person/profile/assignment references match `15d112e0` exactly. The initial audit covered all 4,509 removed lines in 67 code/test files. Existing references and staging are unchanged. |
| Preservation safeguards, temporary RPC boundaries, member/page contracts and DOM regression | Passed: 108 tests across ten active files, including 23 preservation checks. Nine wholly disabled specifications are retained separately; eight are under the runner's default `tests/` directory. |
| Field localization, selectors, instrument editor, presentation delivery, factory contracts and preservation/recovery boundaries | Passed: 106 tests across nine files. Includes band-first labels/help, band and language switches, intentional blanks, composite captions, accessible names, unchanged scalar writes and explicit dialog captions. |
| Registered settings editor, clipboard validation, settings RPCs/presentation, table authorization and preservation/recovery boundaries | Passed: 122 tests across seven files, including 13 editor DOM checks. Covers explicit scope, blanks/false, failed saves, resets, permissions, band/account switches, batch rejection and pending clipboard cancellation. |
| Shared-person selectors/editor/write boundary, command/identity/transport contracts, recovery registrations and migrated membership contracts | Passed: 164 tests across nine files. Includes strict rejection of account assignment fields, contact redaction, separate sign-in summaries, retired instrument CRUD and retained membership commands. The adapted owner-update case also passes in the otherwise failing direct-mutation fixture suite. |
| Member profile/directory pages and instrument/tag editor DOM regressions | Passed: 22 tests across three isolated jsdom files. |
| Recovery RPC/registration boundaries, table authorization, account/bootstrap and membership role/lifecycle contracts | Passed: 66 tests across six files. A strict database proxy rejects any access from deferred RPCs. |
| Account/bootstrap, membership contracts/pages/editors and suspended presentation navigation | Passed: 67 tests across ten files. |
| Telemetry ownership, HTTP/RPC validation and delivery, preservation/recovery boundaries, member profile, instrument/tag editors and suspended navigation | Passed: 173 tests across nine files, including 20 isolated DOM cases. Nine targeted existing public-ID/actor telemetry cases also pass across seven otherwise partly failing legacy suites. |
| Telemetry persistence, dashboard catalogs and member profiles on a fresh private MariaDB fixture | Passed: 18 tests across three files, including five native telemetry cases. All direct/inherited associations, foreign-band omissions, mixed references, global catalogs, null platform context and calendar credential redaction are covered. The fixture used a new database on `127.0.0.1:32695`; writes were rolled back and the database removed. |
| Native dashboard/catalog snapshots and membership role/lifecycle/profile/instrument/tag regression | Passed: 60 tests across seven files on a new private MariaDB target-schema fixture. |
| Earlier migrated-production-copy bootstrap/account check | Passed: eight tests, including six native cases; the development browser evidence above predates Role/merge isolation. |
| ESLint on changed/new TypeScript files; `git diff --check` | Passed. |
| `yarn typecheck` | Fails: 386 diagnostics, down from 389 before the telemetry slice. No increased file/error-code groups, compiler exclusions or error suppression added. |
| `yarn build` | Gets past Custom Links and shared field-label callers; fails at the legacy event-search payload in `src/core/components/event/EventComponents.tsx:1392`. The duplicate role-page component-name warning is also fixed. |
| `yarn test --reporter=dot` | Fails in the Node batch: 294 failed, 1,360 passed, 99 skipped. Two old telemetry actor fixtures now carry the target account state and pass; no failure groups were added. Later isolated DOM batches are not reached; focused DOM checks above passed. |

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

An additional `tests/domainSelection.test.ts` DOM probe stops during collection:
its RPC mock lacks `BlitzRpcPlugin` when `userChip` imports the presentation
provider through `useDB3Context`. That selection-fixture dependency remains
unresolved; it is not included in the passing focused checks above.

Local diagnostic logs and screenshots are under ignored `temp/a0-*` paths. The
private database server, databases, browser, and baseline worktree are disposable
verification resources, not application configuration.

## Remaining A0 blockers

Fix owning contracts before their cascading consumers: `prismArgs.ts` remains the
largest diagnostic root, followed by obsolete person-level instrument/tag and
event/file/song descriptors and views. Legacy authorization
fixtures also retain removed relationships. Generic settings storage is isolated;
its editor now uses the registered API. Role administration and shared-account
merge execution are isolated; other deferred domains still need that boundary.
None are repaired by an implicit band default or a compatibility alias.
The stricter shared-account payload also exposes three deferred event consumers
that still treat the account as a person carrying instruments. They must consume
membership data when events are restored; band assignments are not added back to
the shared-account payload to satisfy those consumers.
Platform account administration still uses band capabilities for table/field
reads, which are absent in platform context. It needs a separate ownership and
permission adaptation; the account selector/editor repair does not prove that
the platform grid is usable.

Deferred source, registrations, pages, RPC/API entry points, and background jobs
still need coherent isolation. The home notice and omitted dashboard reads do not
establish that isolation; legacy sidebar/direct links still expose unfinished
surfaces. The browser probe also observed server errors from the catch-all Custom
Link lookup for a missing favicon. Its slug lookup still needs explicit band
ownership or deliberate isolation. Telemetry recording is now migrated and has
native/HTTP/RPC/DOM evidence; it still needs built-browser verification. Activity
report readers retain obsolete instrument relations and require a separate
ownership/localization adaptation before analytics can be called restored.

After those dependencies compile, rerun the normal checks and start the built app
with `yarn start` against a disposable migrated copy before closing A0. Keep the
existing migrated membership/catalog behavior and the explicit-band browser path
working throughout that work.
