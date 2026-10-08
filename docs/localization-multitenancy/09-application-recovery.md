# Current application recovery evidence

The A0 bootstrap path has development-browser evidence, obsolete Role and
shared-account merge dependencies are isolated, and telemetry recording and Custom
Links now use the target schema and explicit ownership. Platform account
maintenance and shared event catalogs have platform-authorized views and
commands. Private calendar feeds and subscription callers now use explicit band
context and membership ownership. Event-tag catalogs now use localized shared
defaults and band-owned overrides. Event participant reads now use band membership
instruments/tags and retain separate person and membership identities. Response
and invitation readers now use membership ownership and selected-band references.
Setlist Plan persistence and group CRUD now enforce selected-band ownership,
transactional authorization and public transport identities.
Audit browsing and its historical-reference readers are coherently isolated;
audit recording remains active.
Legacy event/song facet RPCs and statistics/history readers are now isolated;
statistics and song history show localized recovery notices.
Experimental event import now shows a localized notice on its Sysadmin-protected
page; the preview RPC rejects before database access. Migrated event creation
remains active.
File uploads, image fork/gallery bake and generic File insertion are now isolated;
their controls explain unavailability. Existing downloads, the narrow band-scoped
Custom Link reader and migrated File-tag catalogs remain executable.
**A0 remains open.** The
[implementation plan](04-implementation-plan.md) owns delivery gates and the
restriction register.

Removed implementations and behavioral tests are now preserved as searchable
source references under the [feature-preservation procedure](13-feature-preservation.md).
The reference inventory and checksums protect that baseline; restoration still
requires executable tests and browser evidence. No recovery gate is closed by
preserving source alone.

Activity reporting is now coherently unavailable: its page displays registered
localized recovery text, and all five reporting RPCs (timeline, general detail,
facets, detail and CSV) require login and then reject before database access.
Legacy readers lacked selected-band ownership; their helpers and report-only
assertions are preserved under `activity-reports`. Existing telemetry writes and
unrelated domain assertions remain executable. The duplicate instrument identity
export found during this slice was also repaired by naming the public-ID schema
`BandInstrumentIdentity`, separately from the existing payload identity type.

## Restored boundary

- Current-account loading returns shared identity/contact fields, with no role
  grants, credentials, or person-level band assignments. The dashboard loads the
  current membership's instruments, tags and authorized display data separately.
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
  contracts stay active. Event invitation metadata now uses BandUserTagAssignment;
  the obsolete UserTag/UserTagAssignment descriptors and person-assignment payload
  helpers, including `UserWithInstrumentsArgs`, are removed. Their original source
  remains searchable and checksum-protected.
- Event participants use the read-only `BandUser_EventParticipant` view and
  existing membership/assignment authorization. Detail queries use membership
  filters; person filters remain available. Empty, unknown and foreign membership
  lists return no rows. Dashboard current membership uses the same contract.
  Attendance instruments, styles, invitation joins and answers use membership
  assignments and IDs; profile links and dedicated write inputs use person IDs.
- Registered event/segment response readers require nonpublic-event access,
  snapshot authorization, selected-band membership ownership and visible,
  undeleted parent events. A narrow membership reference retains historical IDs
  without exposing person profiles. Corrupt cross-band parent/instrument links
  are excluded. Invitation groups use band tags and active same-band assignments;
  roleless owners retain their own assignment reads. Actor-scoped search predicates
  use the authenticated membership, independently of the shared person ID.
  Localized invitation metadata uses catalog display hydration. Resolved catalog
  matching no longer fetches unrequested child collections as scalar dependencies.
  Full event search/editing payloads and invitation administration remain pending.
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
  consumers now use `name` and the four target caption fields. Preserved audit-log
  attendance rendering resolves captions through the dashboard snapshot; that
  viewer is now isolated.
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

- File-tag catalogs now use BandFileTag/GlobalFileTag descriptors, generated CRUD
  and explicit localized editor/display contracts. The editor requires
  `admin_files` for the selected band, or `manage_global_catalogs` for platform
  defaults. Band tags inherit color/order, support intentional blank translations
  and hiding, and expose the source's Partition/Recording behavior read-only.
  Shared deletion protects referenced tags; band deletion checks ownership and
  cascades assignments without deleting files. Dashboard snapshots and existing
  File/song consumers use the band tag references and `bandFileTagId` metadata.
  General File execution still needs its own ownership and member/instrument
  relation recovery. Its old raw tag-text quick filter is preserved under
  `file-search` until filtering can use resolved localized labels. The adjacent
  instrument filter now uses the existing dashboard display type rather than
  its obsolete Prisma client-payload annotation.

- Event creation now validates an explicit band public ID, strict public foreign
  identities and server-owned-field exclusion. A fresh authorization snapshot
  owns the whole Serializable aggregate transaction: event, first segment,
  optional ordered setlist (including repeated songs), imported membership-owned
  attendance answers, insert audits and calendar/date updates. Song targets must
  be visible, active and owned by the selected band; answer targets must be active
  members of that band and active shared attendance choices. Existing field
  grants, including `admin_events` for the initial revision and
  `edit_public_homepage` for public event fields, remain enforced independently
  of `manage_events`. Imported answers retain their separate cross-user grant.
  Editor DTOs resolve nested localized/inherited catalogs before authorization
  and public projection. Callers forward band/locale input and first-segment
  defaults. A failed dialog save now re-enables its controls, and the import
  form uses the shared `CMButton` wrapper. Import preview and general event UI
  dependencies remain unfinished.

- Setlist Plan save/list/delete and group/plan reorder require explicit band
  public IDs. Repeatable reads and Serializable writes refresh authorization in
  their database snapshot. Creates supply the band, creator, date and public
  identity on the server; write requests contain editable fields only. Saves
  preserve group-move order reset, visibility and authored JSON, checking song
  rows and column/row-LED/column-LED associations against resource visibility,
  band ownership and active, unmerged members. Existing global-role planner grants
  still require an explicit band. Group CRUD uses scoped DB3 descriptors and
  server-owned band metadata. Every persistence operation audits in its write
  transaction. Plans/groups survive author membership/account removal, with
  nullable author DTOs. The overview requests all visible plans within its band;
  selecting another band remounts editor state and requests carry captured band
  identities. The no-band prompt uses registered localized text. General Song,
  search and full planner editor workflows remain deferred dependencies.

## Verification

The File-creation slice passes 131 focused checks across six files: 77 recovery
RPC/registration/generic-insert cases, nine upload HTTP/client cases, five isolated
DOM cases, 23 preservation checks, 15 Custom Link delivery cases and two targeted
download/storage regressions. Image RPCs reject members, uploaders and Sysadmins
before database access, including legacy, selected-band and malformed inputs;
anonymous requests require login. The upload handler returns empty 503 payloads
without inspecting multipart/body/query data, and explicit 401 payloads for
anonymous requests. Unsupported methods return 405 with `Allow: POST`. The client
stops before FormData, XMLHttpRequest or progress callbacks.

DOM checks verify registered localized notices, language changes, inert file/URL
selection, unhandled ordinary document paste, blocked file/URL drops without
navigation, a disabled bake action with an explanatory tooltip and Markdown
file-paste rejection while text/HTML paste and existing content remain available.
The Markdown toolbar no longer offers file attachment; its text editor has no
native file input. Downloads and File-tag catalog behavior remain separate from
the deferred creation boundary.

All 104 native Setlist Plan, event creation, attendance, event/File-tag and Custom
Link cases pass across six files on a fresh private target-schema MariaDB fixture.
Six development-browser assertion groups pass with no page errors. They verify
deferred image RPCs for an ordinary uploader and a Sysadmin, File-tag pages in
platform/two-band contexts (including a French route locale), multipart/URL 503
responses without File/audit/storage writes, anonymous HTTP 401/RPC login checks,
existing Custom Link content and byte ranges with foreign-band denial, a real
File-tag save and retained event/segment/song-list creation with actor audit.
The catalog screenshot was visually checked
(`temp/a0-file-creation-browser-result.json`). The helper removed its private
database and storage files, and stopped its browser/development server; the owned
MariaDB instance was shut down. Upload/creation UI parity, general File workflows
and built-production delivery remain unverified.

Preservation now protects 253 references, ten wholly deferred specifications and
eighteen pending obligations. Forty references from `1bea5a73` preserve upload,
automatic tags/instrument matching, shared image/metadata helpers, gallery bake,
Markdown/selection controls, the generic insert boundary and seven image
authorization cases. Of those seven cases, five failed and two passed in the
previous full run; they are preserved inactive specifications, not repaired
feature tests. Five existing download/storage cases remain executable. No whole
test file is newly deferred.

The event-import slice passes 104 focused checks across six files: 72 recovery
RPC/registration checks, four page guards, two isolated DOM cases, two legacy
read-inventory checks, 23 preservation checks and one targeted existing route/RPC
guard. The strict database proxy verifies preview rejection before any account,
catalog, person or song lookup for ordinary members, event administrators and
Sysadmins, including legacy, selected-band and malformed inputs. Anonymous
requests require login. The page retains Sysadmin authorization and renders
registered localized text without preview/save hooks or draft controls.

All 98 native Setlist Plan, event creation, attendance and event/file-tag cases
pass on a fresh private target-schema MariaDB fixture. The development browser
verifies that an ordinary event administrator cannot bootstrap the import page,
and that Sysadmin access in platform context and two selected bands (with a French
route locale) renders the notice without preview/save requests or a draft form.
Real preview requests reject legacy, selected-band and malformed inputs;
anonymous requests require login. A real creation RPC still saves a band-owned
event, first segment and initial song list with public transport identity and an
actor-attributed audit. Four browser assertion groups pass with no page errors;
the notice screenshot was visually checked
(`temp/a0-event-import-browser-result.json`). The helper removed its database and
stopped the browser/development server; the owned MariaDB instance was shut down.
This is development-browser evidence, not built-production or importer parity.

The importer checkpoint protected 213 references, ten wholly deferred
specifications and seventeen pending obligations. Seven references from `ced31f2c` preserve the
importer parser/preview RPC, complete editor/save/history page, API declarations
and affected specifications. One previously failing preview public-identity case
is newly inactive and preserved; the remaining attendance/creation/telemetry
cases stay executable. The old route/RPC assertion is preserved and adapted to
verify the recovery boundary. No additional whole-file specification is deferred.

The legacy event/song reader slice passes 100 focused checks across four files:
70 recovery RPC/registration checks, four statistics page guards, three isolated
DOM checks and 23 preservation checks. A strict database proxy proves that all
four RPCs reject before account, domain or reference reads for members, report
readers and Sysadmins, including legacy, selected-band and malformed requests.
Anonymous callers require login. Statistics and song history render localized
notices without queries/charts; language and song changes retain the boundary.
The statistics route retains its report capability check, and the song tab
retains its parent authorization.

All 98 native Setlist Plan, event creation, attendance and event/file-tag cases
pass on a fresh private target-schema MariaDB database. An ordinary report member
opens the real statistics page in two selected bands, including a French route
locale, without mounting report queries/charts. All four real RPCs reject legacy,
band-context and malformed inputs; granting platform Sysadmin does not bypass the
boundary, and anonymous callers require login. A Setlist Plan save still writes
an actor-attributed audit. Four browser assertion groups pass with no page errors;
the statistics notice screenshot was visually checked
(`temp/a0-domain-readers-browser-result.json`). The helper dropped its database
and stopped its browser/development server; the owned private MariaDB instance
was shut down. Song history has component DOM evidence; the complete song detail
page and built-production delivery remain unverified.

The legacy-reader checkpoint protected 206 references and ten deferred
specifications, with sixteen pending obligations. Eleven references from `8fdb9fd6` preserve the
four readers, statistics page, song history and removed API declarations. No
existing behavioral test directly targeted these RPCs, and none is newly
deferred. The current search owner, shared date predicates, autocomplete payloads,
calendar helpers and migrated event/persistence services remain executable.

The audit-log slice passes 108 focused checks across eight files, including the
recovery RPC boundaries, rejected generic Change reads/writes, protected page
authorization, localized notice rendering, generic table/field denial and audit
redaction/persistence. The generic authorization regressions now use the active
Sysadmin-only sign-in-method table. Two query fixtures supply current account
login grants and the explicit unmerged-person state, so paginated rejection reaches
the table policy. The DOM probe also exposed a missing React import in the shared
deferred-page component; that trivial test-runtime dependency is repaired.

The native MariaDB run passes all 98 Setlist Plan, creation, attendance and
event/file-tag tests, including audit-failure rollback. A signed-in development
browser opens the audit recovery page in platform context and two bands, with an
explicit French route locale. No audit/reference query or grid is mounted. Both
real RPCs reject legacy, band-scoped and malformed requests without returning
data; anonymous calls require login. A real Setlist Plan save still persists its
actor's audit record. All three assertion groups pass with no page errors, and
the recovery notice screenshot was visually checked
(`temp/a0-audit-log-browser-result.json`). The helper dropped its disposable
database and stopped its browser/development server; the owned private MariaDB
instance was shut down. This is development delivery evidence; normal build and
the complete audit-browsing workflow remain open.

At the audit-log checkpoint, preservation verification protected 195 source
references and ten deferred test specifications, with fourteen pending features. All previous references
remain intact. Fourteen new references preserve the audit viewer, both readers,
Change registration/payload and affected specifications under `audit-log`.

The Setlist Plan slice passes 68 focused tests across public-ID RPC contracts,
DB3 projection, snapshot execution and preservation. Its native MariaDB run
passes 98 tests across five files, including 29 new persistence cases and the
existing event creation, attendance, event-tag and file-tag checks. These cover
cross-band identities, private/hidden/deleted references, every JSON reference
position, author removal, fresh grant/role/member/person/band revocation, exact
reorder scopes and audit-failure rollback for save/delete/reorder. Group CRUD
retains content on group deletion. A virtual transaction capability on the
in-memory fixture now reports its presence to snapshot readers, and scalar DB3
view fixtures declare their newly required band context. No behavioral tests were
removed or deferred.

A signed-in development-browser probe exercised the real save/list/delete RPCs
against a fresh private target-schema database on `127.0.0.1:32695`. It persisted
the complete JSON document with server ownership, rejected foreign-band song
references/deletes, missing context and forged ownership, created separate content
after a dashboard band switch, and enforced revoked planner grants on the next
read/write. All four assertion groups passed with no browser page errors
(`temp/a0-setlist-plan-browser-result.json`). The helper removed its database and
stopped its development server/browser. This is endpoint evidence; the editor's
deferred Song provider and search dependencies still prevent full planner UI
verification. Whole-repository lint also found two unused imports in calendar
preview/public-ID tests; those trivial errors were removed.

The event-creation slice passes 96 focused transport, integer-boundary, DB3 view,
memory-query and preservation tests across four files. Its private MariaDB run
passes 69 tests across creation, attendance, event tags and file tags, including
32 creation cases. These cover public projection, trusted ownership/actor audits,
large precise durations, undated/private events, shared and inherited French
labels, separate memberships, repeated/empty setlists, independent grants,
revocation, hidden/foreign/unavailable targets and aggregate rollback. Five
failure-injection cases exercise segment, setlist item, response, audit and
calendar persistence. BigInt-backed editor fields now accept safe integer
durations beyond Prisma Int's 32-bit range and reject precision loss; ordinary
Int fields retain their existing range.

The development browser invokes the real signed-in `insertEvent` RPC, creates
the event/segment, initial setlist and membership response, switches bands and
creates a separate event, then rejects foreign songs, missing context, forged
ownership, freshly revoked grants and anonymous requests. Public results omit
natural identity/ownership keys; failed foreign-song creation leaves no event.
No browser page errors occurred. Evidence is under `temp/a0-event-creation-*`.
The helper dropped its private database and stopped its browser/development server;
the private MariaDB instance was shut down after the final native regression.
This verifies RPC delivery, not the ordinary creation dialog or import preview,
and does not establish built-production application readiness.

The File-tag slice passes 114 focused view/identity/transport/preservation tests
and 13 native tests across file tags, event tags and dashboard catalogs on a fresh
private target-schema MariaDB database (`127.0.0.1:32695`). Four native File-tag
cases cover global behavior grants, band-first translations/blanks/inheritance,
resolved label filtering, foreign-band rejection, hidden assignments, protected
shared deletion, band deletion and revoked grants.

The development browser signed in, created a shared tag with Partition behavior
through the real dialog, displayed its inherited band tag, created a local tag,
saved a French band override without changing the shared English text, and
returned to platform mode without retaining band rows. There were no page errors;
the band editor screenshot was visually checked. Logs/screenshots are under
`temp/a0-file-tags-*`; the helper removed its disposable database and stopped its
server/browser, and the private MariaDB instance was shut down. This establishes
development editor delivery, not a successful production build.

At the File-tag checkpoint, typecheck fell from 195 to 145 diagnostics, with no
increased file/error-code groups. The build
gets past the File tag and adjacent instrument filter failures and stops at
`src/core/db3/mutations/insertEvent.ts:28`: the legacy creation command has no
trusted band ownership. The full suite still fails in the Node batch: 278 tests
and ten suites fail, with 1,488 tests passing and 207 skipped across 140 files.
Isolated DOM batches were not reached. The current results are in the table below;
A0/A1 remain open.


The activity-report probe used a fresh private target-schema MariaDB database on
`127.0.0.1:32695`. A signed-in report manager opened the recovery page in account
context and in two authorized bands, including explicit route-locale input. All
five real report RPCs rejected without returning report data, including after
granting platform Sysadmin. Anonymous calls required login. The HTTP telemetry
endpoint still persisted the actor and selected band. Returning to the dashboard
and report page produced no page errors; the rendered recovery notice was visually
checked. The helper dropped its database and stopped its development server/browser;
the private MariaDB instance was shut down (`temp/a0-activity-reports-browser-result.json`).
The page's account-context explanation requires login; selected-band requests retain
the report capability check.

The earlier activity-report isolation passed focused page/RPC, telemetry,
preservation and DOM checks. Report-only specifications remain preserved and
are not counted as passing tests. Its File tag build blocker is repaired by the
current slice; full application readiness still requires the remaining contracts.

The response/participant browser probe used a fresh private target-schema database
on `127.0.0.1:32695`. A signed-in person switched between two bands, including a
roleless membership. Real response and segment RPCs returned separate membership,
instrument and parent identities; audit actors remained person IDs. The invitation
RPC required explicit band input and returned band membership assignments. The
membership participant filter round-tripped those identities. Roleless response
access and missing band inputs rejected; invisible parents removed both response
kinds, and revoked grants blocked the next request. Dashboard switching and return
to platform rendered with no page errors. The helper removed its database and
stopped the development server/browser (`temp/a0-event-responses-browser-result.json`).
This proves development reader delivery; full event UI and built-app verification
remain pending. That checkpoint's activity-report build blocker is now isolated;
the current build blocker is legacy event creation, described above.

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
| Response/participant projection, membership consumers, invitation/attendance behavior, DB3 contracts and read-compatibility inventory | Passed: 167 Node tests across eleven files and 31 isolated DOM tests across six files. Includes same-person/different-membership exclusion, invitation precedence, unanswered answers, context switches, empty/revoked participant results, instrument/tag identities, date-time lifecycle behavior and unavailable instrument entries. |
| Response and participant readers plus membership/catalog/calendar/attendance/bootstrap/account/link/telemetry/profile regression on private MariaDB | Passed: 145 tests across sixteen files, including six new response/invitation cases. Covers historical membership identities and hidden instruments, separate bands, corrupt links, parent visibility/deletion, roleless invitation reads, empty/foreign/unknown membership filters and fresh authorization. Fixture writes roll back and the generated database is removed. |
| Response/invitation/participant development-browser delivery | Passed: real scoped RPCs, separate memberships for the same person, person audit IDs, membership filters, dashboard switching, roleless restrictions, invisible parent exclusion, missing context and grant revocation; no page errors. |
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
| Source preservation and Git provenance | Passed: 253 references, including forty new File-creation references. Ten wholly deferred specifications and eighteen pending obligations remain protected; seven image-authorization cases are newly inactive in a partly active file. |
| File-creation isolation, upload HTTP/client, image RPCs and localized controls | Passed: 131 focused checks across six files, including five isolated DOM cases and retained Custom Link/download regressions. Upload returns empty 503 responses before multipart parsing; anonymous HTTP requests receive explicit 401 responses. File/URL/paste/drop and bake controls remain inert while ordinary Markdown text/HTML paste works. |
| Retained creation/catalog/persistence and Custom Link delivery on fresh private MariaDB | Passed: 104 native cases across six files. Six development-browser assertion groups cover deferred file/image endpoints, ordinary uploader/Sysadmin/anonymous callers, two selected bands, retained File-tag/event saves and existing file content/byte ranges with foreign-band denial; no page errors. |
| Event-import isolation, protected/localized page and retained event creation | Passed: 104 focused checks across six files, including two isolated DOM cases. All 98 native persistence/creation/attendance/event/file-tag cases pass. Four development-browser assertion groups verify protected routing, notice rendering in platform/two-band contexts, deferred RPCs, anonymous rejection and a real event/segment/song-list save with actor audit; no page errors. |
| Legacy event/song reader isolation, statistics page authorization and localized statistics/song history notices | Passed: 100 checks across four files, including three isolated DOM cases. A strict database proxy verifies rejection before any database access for all four RPCs; no tests are newly deferred. |
| Legacy event/song reader development-browser and native regression | Passed: statistics notice for an ordinary report member in two bands; four RPCs unavailable for member/Sysadmin, anonymous calls require login, no queries/charts/page errors, and real audit persistence remains active. All 98 native tests across five files pass. Screenshot inspected and private resources stopped/removed. |
| Audit-log isolation, protected/localized page, generic query denial and audit redaction | Passed: 108 focused checks across eight files, including two isolated DOM cases. Both RPCs reject before any database access; generic audit registration is absent. Generic authorization regressions remain active on the protected sign-in-method table. |
| Audit recording and existing persistence workflows on fresh private MariaDB | Passed: 98 tests across five files, including audit-failure rollback. The development browser also persisted a real actor-attributed audit after the reader was isolated. |
| Audit recovery development-browser check | Passed: protected page in platform context and two bands, no audit queries/grid, both RPCs unavailable, anonymous calls require login, and no page errors. Screenshot inspected; private verification resources stopped/removed. |
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
| `yarn typecheck` | Fails: 119 diagnostics, down from 123 at the importer checkpoint. File-creation paths are isolated with full source preservation; no compiler exclusions or error suppression added. |
| `yarn build` | Gets past File creation; stops at `src/core/db3/server/quickSearchServerCore.ts:51`, which queries the removed global Instrument model. |
| `yarn test --reporter=dot` | Fails in the Node batch: 265 failed, 1,551 passed, 268 skipped across 147 files, with ten suite failures. Failure-entry comparison finds only five newly preserved image-authorization failures removed from the previous 270; no new failure entries. Two passing image cases are also preserved inactive. Native cases pass with the private URL above. Later isolated DOM batches are not reached, so the five new controls cases run separately. The final HTTP 401 correction also passes the focused upload/RPC/DOM run. |

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

Legacy quick search is the next build stop: it queries the removed global
Instrument model at `quickSearchServerCore.ts:51`. Its HTTP owner, association
selectors and Markdown autocomplete need coherent band ownership, visibility and
localized references. File creation, multipart/URL uploads, shared image/metadata
processing and gallery bake are isolated under `file-creation`. Restoring them
requires explicit ownership and fresh authorization, migrated associations and
transaction/filesystem cleanup. Existing downloads and the narrow Custom Link
reader stay executable; general File metadata/member/instrument, search and
broader download/background ownership still need recovery.
Experimental import is isolated under `event-import`; restoring its preserved
parser, defaults, membership/song matching, editable preview and save/history
requires a fresh selected-band contract. The migrated creation RPC does not
establish full importer parity. The old event/song facet and statistics readers
remain isolated under `legacy-event-song-filters` and `event-song-statistics`;
audit lookup and its companion viewer/filter reader remain under `audit-log`.
Setlist Plan storage is recovered; its complete editor still depends on deferred
Song/search workflows.

Fix owning contracts before their cascading consumers: `prismArgs.ts` remains the
largest diagnostic root, followed by obsolete person-level instrument/tag and
event/file/song descriptors and views. Shared event catalogs and dedicated
attendance write/history/HTTP, bulk copy/clear endpoints and private calendar feeds
are migrated. Response/invitation reader ownership and identities are migrated. Full event
search/editing payloads and invitation management remain unfinished, including
removed `segmentBehavior` consumers and broader file/wiki/catalog dependencies. Legacy authorization
fixtures also retain removed relationships. Generic settings storage is isolated;
its editor now uses the registered API. Role administration and shared-account
merge execution are isolated; other deferred domains still need that boundary.
None are repaired by an implicit band default or a compatibility alias.
Attendance consumers now use the selected membership participant model; shared
accounts do not carry band instruments or tags. Full event UI parity still needs
workflow verification after the remaining payloads compile.
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
native/HTTP/RPC/DOM evidence; it still needs built-browser verification. Preserved activity
report readers retain obsolete instrument relations and require a separate
ownership/localization adaptation before analytics can be called restored.

After those dependencies compile, rerun the normal checks and start the built app
with `yarn start` against a disposable migrated copy before closing A0. Keep the
existing migrated membership/catalog behavior and the explicit-band browser path
working throughout that work.
