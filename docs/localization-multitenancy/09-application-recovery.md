# Current application recovery evidence

The A0 bootstrap path has development-browser evidence, obsolete Role and
shared-account merge dependencies are isolated, and telemetry recording and Custom
Links now use the target schema and explicit ownership. Platform account
maintenance and shared event catalogs have platform-authorized views and
commands. Private calendar feeds and subscription callers now use explicit band
context and membership ownership. Event-tag catalogs now use localized shared
defaults and band-owned overrides. **A0 remains open.** The
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
  views, including shared event type/status/attendance metadata. It does not
  execute deferred event-content/menu/legacy-role readers. DTOs remain
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
- Platform account maintenance has a separate `PlatformUser` descriptor and
  `PlatformUser_Editor` view with generated create/update commands. Its table,
  fields, contact search and page use `manage_global_users`; no band capability
  or owner exemption admits access. Snapshot reads refresh grants. The DTO carries
  person details and public identity only. Security state and timestamps are
  read-only, email correction still requires Sysadmin, and creation adds neither
  sign-in methods nor memberships. Existing shared-person/member projections and
  their permissions are unchanged. Member-profile links require selected context
  and the existing owner/read capability. The old generic projection on the
  display-only Sysadmin column was also corrected to the typed mutation API.
  A visible band-selector label overlap in platform context is fixed.
- Client telemetry carries the presentation input in both HTTP and RPC requests.
  Actor identity is refreshed with band context in the recording transaction;
  natural/client-owned IDs are rejected. Direct resource associations require
  the selected band; segments/setlists and gallery items inherit ownership
  through their event/file. Global credit-type and attendance references remain
  available in platform context. Instrument actions use `bandInstrumentId`.
  The formatting locale resolves independently of raw device locale/language;
  an unregistered or deleted locale remains null. Asynchronous device collection
  retains the event's original band, locale, URI and associations. Account-level
  Google sign-in uses null band/locale context; calendar-feed recording uses the
  subscriber and selected band/calendar locale from its authorized snapshot.
  Recording schemas no longer initialize the DB3 registry.
- Shared event types/statuses and attendance options now use localized DB3 fields
  with explicit global write storage. Generated CRUD and the three editor routes
  require `manage_global_catalogs`; band authority and selected-band writes are
  rejected. The editors explain the required platform context. Global edits
  validate owned string identity, format and active locale, and audit translation
  changes inside the entity transaction. They retain intentional blanks and do
  not copy fallback text into another language. Existing band fields explicitly
  retain their band write storage. Dashboard reads include shared metadata without
  a band, resolve band overrides when selected, and retain retired labels for
  history. New attendance choices exclude deleted/inactive options. Catalog
  consumers now use `name` and the four target caption fields; activity-log
  attendance identities resolve captions through the dashboard snapshot.
  This repairs catalog dependencies without establishing event/invitation parity.
- Dedicated attendance writes now resolve public person/event/segment/instrument
  references within the selected band. Responses belong to BandUser; created/
  updated actors remain shared User identities. Self responses, delegated responses
  and explicit invitations keep independent grants. Active membership/account,
  event visibility, segment parent, available band instrument and active global
  choice checks precede all writes. One Serializable transaction refreshes grants,
  writes the batch and its audit records, increments the response revision once
  and recalculates the calendar once. Repeats are idempotent. Retired choices and
  hidden instruments remain readable and can be cleared.
- Attendance history and the setlist-planner HTTP reader use fresh authorization
  inside repeatable snapshots, return public references, and retain intentional
  blank comments and false invitation flags. HTTP reads now require a signed-in
  user with the selected band's event-read grant; missing/repeated/malformed
  context is rejected. Callers supply the band explicitly; setlist color requests
  discard late responses after a band change. Calendar queries now select the
  owning band, and their content hashes exclude the sequence number so unchanged
  calendar content does not repeatedly increment its own revision.
- Bulk segment response copy/clear require explicit band context and fresh
  `admin_events` authority. Source and destination must have visible, undeleted
  parents in that band; copying requires the same event. Responses use BandUser
  ownership and server-owned actor IDs. Maintenance preserves recorded null or
  retired answers and former same-band members, while rejecting corrupt
  cross-band membership references. Copy replaces the destination answer set,
  preserving unchanged row identities; clear removes all answers. Each affected
  member's event response revision changes once, retaining comments, invitations
  and instrument metadata. Audit snapshots include added/removed and null answers;
  retries and empty clears are no-ops. Writes, audits, revisions and calendar
  recalculation share one Serializable transaction. Existing menu confirmation,
  clipboard and refetch behavior remains available with explicit band forwarding.
- Private calendar feeds use a dedicated typed reader, scoped to the subscriber's
  active BandUser and selected band. Credential, fresh principal/grants, settings,
  invitation-tag membership and content reads share a repeatable snapshot. Event
  responses contribute their revision; segment answers retain retired attendance
  meanings. Explicit invitations, group invitations overriding stored false,
  declined/uninvited preferences and whole-event inclusion behavior are retained.
  Calendar UIDs and stored natural-key content hashes remain unchanged. Event
  links carry public identity and band context. Visible setlists/dividers and wiki
  descriptions remain available with their own read capabilities and visibility;
  foreign, private or deleted songs and foreign/private wiki revisions are excluded.
  Twelve-month history uses the band's calendar day, including leap-day clamping.
- Subscription retrieval and replacement require a strict band argument and the
  signed-in account owner, rejecting impersonation and unavailable membership or
  event-read authority. Creation/replacement and nonsecret audit markers share a
  Serializable transaction. One account credential backs its different band URLs;
  replacement invalidates all of them, as the confirmation explains. Old URLs
  lacking `bandPublicId` return 404: re-subscribe from the selected band's page
  without rotating the credential. The preview also forwards band context and
  refreshes platform authority. Band switches discard pending replacement
  confirmations and stale completion notifications. Required iCalendar product
  metadata now tolerates blank band settings; preview dates and its button wrapper
  were also corrected. Full page localization and general event UI parity remain
  separate.

- Event-tag catalogs use typed BandEventTag and GlobalEventTag descriptors,
  generated CRUD and localized editor/display contracts. The editor selects the
  band's catalog with `admin_events`, or shared defaults in platform context
  with `manage_global_catalogs`. Names/descriptions use explicit writing locales;
  band tags inherit color/order and can be hidden without removing assignments.
  Frontpage visibility belongs to GlobalEventTag; band display references expose
  its flag as a read-only, authorized companion. Custom band tags have no shared
  frontpage flag. Hard deletion remains supported: band ownership is enforced,
  band-tag assignments cascade, and referenced global tags are protected by the
  restrictive foreign key. Dashboard snapshots now include band event tags.
  Assignment metadata, references and transports use `bandEventTagId`, supported
  by DB3's explicit nonconventional association-key declaration. This repairs a
  payload dependency; full event editing/frontpage/search/report readers remain
  unfinished.

## Verification

The event-tag browser probe used a fresh private target-schema database on
`127.0.0.1:32695` and a delegated platform catalog manager with a band role. It
created a shared tag with frontpage visibility through the real dialog, displayed
an inherited tag in the selected band, created a custom tag, and saved a French
band translation without modifying the shared English label. Returning to
platform mode replaced the band rows with shared defaults. No page errors
occurred; the band-grid screenshot was inspected (`temp/a0-event-tags-band.png`).
The helper removed its database and stopped the browser/development server.
This is development evidence; built-app verification remains blocked.

The calendar browser probe used a new private target-schema database on
`127.0.0.1:32695`, with a signed-in delegated band member. It obtained a scoped
subscription through the real RPC and fetched its calendar anonymously using the
bearer URL. Missing scope, nonmembership, revoked event-read authority and the old
rotated token returned 404. Replacement restored delivery. Successful feed actions
carried server-owned subscriber/band/locale identity; audit records and action URIs
contained neither credential. The selected-band subscription page rendered without
browser errors, kept its link concealed and retained copy/reveal recovery. Its
screenshot was inspected (`temp/a0-calendar-feed-last.png`). The helper removed
its database and stopped the browser/development server. This is development
verification; the existing build failure still prevents built-app evidence.

The attendance browser probe used a new private target-schema database on
`127.0.0.1:32695` and a signed-in person with a delegated band role. Real RPC
requests saved two segment answers, an instrument, a blank comment and an explicit
false invitation; repeating the request added no audit/revision changes. The
HTTP and history RPC returned public references and retained blank/false values.
Bulk copy/clear preserved source answers and destination identity, retained event
response metadata, incremented member revisions once and audited only changed
batches. Foreign events/segments, missing band context and anonymous HTTP reads
were rejected; revoking response or bulk administration grants rejected the next
RPC without writing. An existing RPC error logger crashed while inspecting a
validation error; logging its text now allows the normal rejection response.
No browser page errors occurred (`temp/a0-event-attendance-bulk-browser-result.json`). The helper
removed its database and stopped the development server/browser. This verifies
endpoint delivery in development; the full event/attendance UI and built app
remain unverified.

The shared event catalog browser probe used a fresh private target-schema database
on `127.0.0.1:32695` and a delegated catalog manager without Sysadmin or localization
administration. It created all three catalog kinds, including all four attendance
captions, saved a French status translation without changing English, verified
route-locale display and the selected-band platform prompt, and checked that no
band translation rows were written. No browser page errors occurred; the French
grid screenshot was inspected (`temp/a0-event-catalog-french.png`). The helper
removed its database and stopped its development server/browser. This is
development evidence; the normal build still blocks production-browser checks.

Custom Links now retain all six modes: permanent/temporary/client redirects,
disabled links, intermediate Markdown pages and direct file responses. The
editor's list, picker and generated writes use the selected band; ownership and
creator IDs remain server-owned. Public lookup uses `(bandId, slug)`. Copied and
preview URLs carry `bandPublicId`; internal band/locale routing parameters are
not forwarded to external destinations. Client hash forwarding replaces an
existing fragment instead of producing two fragments. Visits and visit counts
remain active.

File selection and serving use a narrow read-only File descriptor. They enforce
fresh grants, band ownership, visibility and soft deletion without executing the
unfinished general File descriptor or enabling general file writes. An optional
reference with no file no longer excludes ordinary redirect links. The server
and dashboard shell share an explicit selection-page permission: login before
band selection, then `view_custom_links` in the selected band. App bootstrap
returns 404 for malformed/repeated or unavailable custom-link band context before
it can turn the catch-all request into a server error.

Custom-link development-browser evidence uses a separate fresh target-schema
database on `127.0.0.1:32695`, with its own account, bands and files. The probe
checked same-slug redirects in two bands, exclusion of routing parameters,
missing/malformed/repeated/unknown band responses, byte-range HTML serving,
intermediate Markdown/continuation/hash behavior, the no-band prompt, editor
create/update/delete, scoped display URLs and both bands' editor rows. No browser
page errors occurred. The band selector returns to the dashboard; the probe then
opened the second band's editor. Screenshots are in
`temp/a0-custom-link-intermediate.png` and `temp/a0-custom-link-editor.png`.
The helper removed its database and stopped its server/browser. This is
development evidence, not a production-build check.
Deliberately malformed/unknown context probes still print server diagnostics,
including a `node:util/inspect` formatting TypeError, despite returning 404.
That development logging issue remains unresolved; the passing probe does not
establish that the server log is error-free.

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
| Event-tag/DB3 selection, identity, nested hydration and shared editor/navigation regressions | Passed: 104 Node tests across four files and 17 isolated DOM tests across three files. Association keys use BandEventTag's actual foreign key and inherited/localized codecs. |
| Event-tag catalogs plus calendar, attendance, shared catalogs, bootstrap, accounts, links, telemetry, member profiles and song-tag regression on private MariaDB | Passed: 120 tests across twelve files, including six new event-tag cases. Covers global versus band grants, fresh revocation, translations/blanks/inheritance, sorting/filtering/pagination, forged source/ownership fields, hidden assignments and authorized/restricted deletion. Fixture writes roll back; the generated database is removed. |
| Event-tag development-browser editor | Passed: shared/custom creation, inherited display, French band translation persistence, unchanged shared English label and context switching; no page errors. |
| Calendar attendance/date-time behavior, credential lifecycle, HTTP and subscription UI | Passed: 99 tests across five files, including four isolated DOM cases. Covers both preferences, invitations, stable UIDs/revisions, five host time zones, strict context, token replacement/impersonation, audit-failure rollback, private HTTP status/headers/redaction and stale confirmation/completion cancellation. All existing calendar behavior assertions remain executable. |
| Calendar feeds plus attendance, shared catalogs, bootstrap, accounts, links, telemetry and member profiles on private MariaDB | Passed: 111 tests across ten files, including 13 calendar cases. Covers separate memberships, fresh access revocation, historical attendance/status meaning, group invitations, band branding/locale, child visibility/ownership, leap-day history and shared credential rotation. Fixture writes roll back and the generated database is removed. |
| Calendar development-browser delivery | Passed: real subscription/replacement RPCs, anonymous scoped bearer GET, rejected missing/foreign/revoked/old credentials, nonsecret server-owned telemetry/audits, and selected-band subscription-page rendering; no browser page errors. |
| Attendance RPC/HTTP and bulk boundaries, client menus/control/adapter and preservation/recovery regression | Passed: 124 tests across seven files, including 13 isolated DOM cases. Validates explicit band forwarding, strict public identities, bounded batches/pagination, method/status handling, menu confirmations/cancellation and existing control behavior. |
| Attendance plus shared event catalogs, bootstrap, accounts, links, telemetry, dashboard catalogs and member profiles on fresh private MariaDB | Passed: 98 tests across nine files, including 27 direct attendance and 28 bulk cases. Covers same-person separate memberships, foreign resources/targets, independent grants, revoked/deleted/merged actors, retired history, hidden instruments, visibility, replacement/clear semantics, null answers, unchanged identities, auditing, idempotence and member revisions. Seven bulk failure-injection cases verify rollback at insert, audit, revision and calendar steps. Fixture writes roll back and the generated database is removed. |
| Attendance development-browser endpoint check | Passed: real signed-in direct and bulk RPC writes, HTTP/history projections, replacement/clear and metadata/revision/audit behavior, idempotence, foreign-resource/missing-context/anonymous rejection and fresh revoked-grant denial; no page errors. Full attendance UI recovery remains separate. |
| Shared event catalog contracts, DB3 read/write/view/command authorization, account/membership recovery and attendance DOM regression | Passed: 251 tests across fourteen Node files, plus 31 across five isolated jsdom files. Existing scalar-label assertions now exercise localized contracts; attendance controls cover retired answers and intentional blank captions. |
| Shared event catalogs, dashboard bootstrap and existing account, Custom Links, telemetry, catalog and membership profile behavior on fresh private MariaDB | Passed: 43 tests across seven files, including seven new catalog cases. Covers global writes/audits, exact translations/blanks, resolved filtering/sorting/pagination, public metadata, band overrides, retired history/restore, owned string identity, unavailable locales, selected-band writes and revoked grants. The bootstrap fixture now asserts delivery of a retired localized status instead of treating shared statuses as deferred. Fixture writes roll back and the generated database is removed. |
| Shared event catalog development-browser check | Passed: delegated-manager create/update, all attendance captions, French writing/display and the platform-context guard; no page errors. Does not establish event or invitation recovery. |
| Platform account contracts, shared-person projections, view/bootstrap/page authorization, preservation and membership-role regression | Passed: 169 tests across eight Node files. Member pages, assignment editors and presentation navigation add 24 passing tests across four isolated jsdom files. |
| Platform account reads/generated writes and existing Custom Links, telemetry, dashboard catalogs and member profiles on fresh private MariaDB | Passed: 30 tests across five files, including six new account cases. Covers searches/counts/pagination, public identity, platform-only contacts, default security state, create/update audit records, email correction restrictions, band/owner denial, crafted writes, deleted-account inspection and revoked grants. Fixture writes roll back and the generated database is removed. |
| Platform account development-browser check | Passed: a delegated account manager without Sysadmin or band read capabilities can list contacts/deleted accounts in platform context, create a person and persist a name edit. Security controls and email correction are unavailable to that manager; selecting a band retains access and shared rows. HTTP 200, no browser page errors; the grid screenshot was inspected. This does not establish built-production evidence or lifecycle/role parity. |
| Custom-link routes/URLs/page guards, bootstrap, view contracts, preservation/recovery boundaries, membership roles and public Markdown/Suspense navigation | Passed: 161 tests across ten files, including two isolated jsdom files. All redirect modes, nested slugs, repeated query values, visit details, routing-parameter exclusion, hash forwarding and the selection-page authorization boundary are covered. |
| Custom-link CRUD/file authorization, telemetry persistence, dashboard catalogs and member profiles on a fresh private MariaDB fixture | Passed: 24 tests across four files, including six native custom-link cases. Covers duplicate slugs across bands, create/update/delete and visit cascade, server-owned IDs, missing context/revoked authority, file visibility/ownership and crafted unavailable targets. Fixture writes roll back and the generated database is removed. |
| Existing Custom Link/Menu Link view and schema-wide policy fixtures | The collection view passes with an explicit scoped snapshot. Policy rows now carry band/active-person context and use public identities where natural-ID filtering is forbidden; five earlier failures are recovered. The existing broad metadata assertion still fails because Locale has no DB3 descriptor. |
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
| `yarn typecheck` | Fails: 285 diagnostics, down from 315 before event-tag recovery. No increased file/error-code groups, compiler exclusions or error suppression added. |
| `yarn build` | Gets past Custom Links and shared field-label callers; fails at the existing event-search payload in `src/core/components/event/EventComponents.tsx:1394`. |
| `yarn test --reporter=dot` | Fails in the Node batch: 278 failed, 1,481 passed, 192 skipped. Failure counts by file match the calendar baseline; no new failure groups remain. The six new event-tag native cases skip without the private test URL and pass in the native run above. The 55 direct/bulk attendance and 13 calendar MariaDB cases skip without their private test URL and pass in the native run above. Later isolated DOM batches are not reached; focused DOM checks above passed. |

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
event/file/song descriptors and views. Shared event catalogs and dedicated
attendance write/history/HTTP, bulk copy/clear endpoints and private calendar feeds
are migrated. Event payloads/editing and default/tag invitation management still
need band ownership and membership response contracts. Legacy authorization
fixtures also retain removed relationships. Generic settings storage is isolated;
its editor now uses the registered API. Role administration and shared-account
merge execution are isolated; other deferred domains still need that boundary.
None are repaired by an implicit band default or a compatibility alias.
The stricter shared-account payload also exposes three deferred event consumers
that still treat the account as a person carrying instruments. They must consume
membership data when events are restored; band assignments are not added back to
the shared-account payload to satisfy those consumers.
Platform account maintenance now has native and development-browser evidence
through its separate platform view. Account lifecycle, sign-in-method management,
account merge and platform-role administration remain separate recovery work;
this slice does not establish their parity. The shared grid's remaining generic
toolbar, confirmation and diagnostic text still needs its localization pass.

Deferred source, registrations, pages, RPC/API entry points, and background jobs
still need coherent isolation. The home notice and omitted dashboard reads do not
establish that isolation; legacy sidebar/direct links still expose unfinished
surfaces. The catch-all Custom Link lookup is now band-scoped and returns 404
without a valid band; the missing-favicon lookup no longer uses the obsolete
global slug key. Full portal-root routing remains deferred, so recovery custom
URLs explicitly require `bandPublicId`. General file editing/upload and its
existing download API still need their own ownership/schema migration; this
narrow custom-link file reader does not establish those workflows. Telemetry recording is now migrated and has
native/HTTP/RPC/DOM evidence; it still needs built-browser verification. Activity
report readers retain obsolete instrument relations and require a separate
ownership/localization adaptation before analytics can be called restored.

After those dependencies compile, rerun the normal checks and start the built app
with `yarn start` against a disposable migrated copy before closing A0. Keep the
existing migrated membership/catalog behavior and the explicit-band browser path
working throughout that work.
