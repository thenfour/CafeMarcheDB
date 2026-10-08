# Restoration-first implementation plan

Restore a buildable, runnable, manually testable application first. Then restore
everyday workflows. Complete broader localization and multiband features after
those gates. A task belongs before restoration only when it removes a concrete
build/startup blocker or enables a named core workflow.

## Delivery gates

| Gate | Required outcome |
| --- | --- |
| **A0: runnable and manually testable** | Normal typecheck/build pass. The app starts against disposable migrated data. Login, dashboard, explicit band selection, and an existing migrated page work in a browser. Deferred surfaces are coherently unavailable. |
| **A1: core workflows restored** | Everyday member, event/invitation/attendance, song, and associated-file workflows work end to end, including their required non-page endpoints. Isolation is verified, required checks pass, and remaining restrictions are explicit. |
| **B: localization and multiband complete** | Full portal routing, administration/lifecycle, translation tooling and agreed coverage work together. Remaining restrictions are restored or explicitly accepted for retirement. `yarn migration:check` passes with verification/retirement evidence recorded. |

A0 and A1 have not been achieved. The SQL migration and focused domain checks
establish useful foundations, not application readiness. A0 is a development
recovery gate, not permission to deploy to production.

## Available foundations

The target schema and data-preserving SQL migration exist and have been rehearsed.
Trusted request authorization, access-control initialization, locale resolution,
presentation delivery, and typed settings are implemented. Shared DB3 facilities
support localized/inherited fields, coherent reads, transactional writes, and
dashboard references.

Startup telemetry now writes target-schema actions with explicit band and
presentation-locale context. HTTP and RPC delivery share fresh authorization;
resource references resolve only within the selected band, including ownership
through event/file parents. Account-level server actions retain null context.
This restores recording, while analytics/report readers still need migration.

Migrated slices include instrument/group catalogs, song tags, member instruments
and tags, role assignment, basic profiles/directory, and membership deactivation/
recovery. Their current contracts are in [DB3](07-db3-contracts.md) and
[band memberships](08-band-memberships.md). Preserve this work. Focused validation
does not establish that these pages can currently run in the whole application.
Further recovery/lifecycle features are not a prerequisite for A0 or A1.

## A0: restore the executable application

Work in this order, adjusting the next slice to the actual blocker found:

1. **Establish the current blockers.** Run normal typecheck and build, group
   failures by their owning contract, and trace startup imports, descriptor
   registration, dashboard loading, and navigation. Identify the smallest
   coherent application surface that can run. Counts help diagnosis; a working
   browser path is the progress measure.
2. **Repair shared build/startup dependencies.** Adapt required Prisma payloads,
   DB3 arguments/descriptors, context, authorization, settings, and dashboard
   references to the target model. Fix shared contracts before treating cascading
   consumer errors as independent tasks. Extend infrastructure only when a
   concrete consumer needs it.
3. **Isolate deferred surfaces.** Repair or temporarily disable obsolete
   implementation dependencies, including imports, registrations, routes, RPC
   exposure, and startup/jobs. Deferred source modules themselves must not leave
   compilation broken. Show intentional unavailability where users can reach a
   deferred feature. Hiding navigation alone does not remove a build/runtime
   dependency. Keep normal compiler/build settings and the target schema; do not
   restore obsolete models, add broad compatibility shims, narrow compiler
   coverage, or suppress errors to manufacture a passing build.
   Preserve disabled implementations and behavioral tests as searchable
   `MIGRATION_RESTORE` source references in the same change, following the
   [feature-preservation procedure](13-feature-preservation.md). This also applies
   when a working replacement supports only part of the old behavior.
4. **Restore the minimum browser path.** Verify account login, dashboard loading,
   an explicit authorized band selection, navigation, and an existing migrated
   page against disposable migrated production data. Use seeded role definitions
   and existing assignments. A new role/matrix editor or band-creation flow is
   needed only if evidence shows this path cannot work without it.
5. **Close A0 with evidence.** Pass `yarn typecheck`, `yarn build`, and relevant
   focused tests; start the built app with `yarn start` and manually exercise the
   path. Record commands, data fixture, browser result, and active restrictions.
   Assess the full suite so unrelated failures are visible; do not present focused
   checks as a full-suite pass.

The account/dashboard bootstrap slice now runs in development against a migrated
production copy: login, explicit band selection, member-profile navigation/reload,
and clearing the selected band have browser evidence. Startup reads use migrated
catalogs and membership assignments; deferred dashboard domains are not queried.
This does not close A0: normal typecheck/build still fail, and deferred routes,
RPC/API implementations, and source dependencies still require isolation.
See [current recovery evidence](09-application-recovery.md).

The obsolete single-band Role tables, views, commands, dashboard metadata, and
account controls are disabled, with their source and tests preserved as searchable
references. Their assignment/designation RPCs reject without
database access, and the role-administration URLs show intentional unavailability.
Shared-account merge lookup/preview/commit and dependency reports are likewise
unavailable; their implementations, controls and behavioral tests are preserved
as disabled source. Existing
membership role/lifecycle commands remain available and have native regression
coverage.

**Next implementation slice:** repair the localized SongCreditType payload root
at `songViews.ts:29`, which still selects the removed `text` member. Trace its
descriptor, editor, dashboard reference, credit selections and consumers through
the shared localization contracts. Preserve the working song-tag lookup and File
payloads. Then continue the remaining wiki and obsolete instrument payload roots;
isolate deferred UI and non-page entry points together.

File search/card/detail/editor payloads now use `bandInstrumentId` and
`bandInstrument`, while File-to-person associations resolve through `bandUser`.
Membership identities remain distinct from the shared person identities used by
profile links. Embedded cards fetch instrument public identities before projection;
all instrument display hydration uses the current dashboard reference snapshot.
File-related visibility selections no longer request the removed Permission role
relation. General File queries and writes remain guarded; this repairs payload
contracts without establishing File workflow or ownership recovery. Raw instrument
name filtering and association name ordering are preserved under `file-search`
until the resolved search owner can implement them. Native two-band/two-locale
checks cover distinct memberships, inherited labels and intentional blank overrides.

Song-tag association payloads now use `BandSongTagAssociation` and
`bandSongTagId` consistently in Prisma selections, DB3 field metadata, setlist
transport, indicators and planner consumers. The `getFilteredSongs` RPC requires
explicit public band/song identities and reads within fresh authorization and a
repeatable snapshot. It returns visible undeleted songs in that band, omits
hidden/foreign tag assignments and independently checks pinned File ownership,
visibility and deletion before exposing its public identity. Generic Song/File
writes remain guarded; the picker/search UI remains intentionally unavailable
under `quick-search`. Migrated catalogs and reference rendering remain active.
This clears the song-tag payload root; broader song UI, credits, files and A0 are
still unfinished.

Legacy quick search is now isolated under `quick-search`. Its public HTTP route
returns 503 without inspecting query/body data or loading account/content readers;
the server and client helpers reject before their work. Association/song pickers
show registered localized notices and retain existing authored values and links.
Markdown wiki/mention suggestions are deferred while raw text/HTML editing,
authored references and local inline-class suggestions remain active. The
explorer retains its Sysadmin guard and renders the same notice. Eighteen source
references preserve the reader plugins, query behavior, controls and suggestions.
No existing behavioral tests are newly disabled. The separately owned domain
search remains active; shell search remains its existing `global-search`
obligation. This clears the removed-Instrument build stop without closing A0.

File uploads and image creation are now isolated under `file-creation`.
The upload HTTP route requires login and returns an empty 503 without parsing
multipart data; image-fork/gallery-bake RPCs reject before source or gallery
lookups. Generic File insertion is blocked before its transaction. File/URL
selection, document paste/drop and gallery bake controls explain unavailability;
Markdown text/HTML editing stays active. Forty references preserve creation,
automatic tagging/instrument matching, image processing, controls and affected
specifications. Existing downloads, the narrow Custom Link reader and migrated
File-tag CRUD stay executable. General File metadata, search and ownership remain
unfinished; this slice neither restores uploads nor closes A0.

Experimental event import is now isolated: its Sysadmin-protected page shows a
registered localized notice, and the preview RPC requires login and rejects
before database access. Seven source references preserve the parser, global
matching/default selection, editable preview, save/history controls, API types
and affected specifications under `event-import`. The migrated creation
transaction remains active. Restoring import requires explicit band authorization,
membership/song visibility, localized catalogs, parsing and complete preview/save
workflow verification; this isolation does not close A0.

Four legacy event/song SQL readers are now isolated: the unused event/song facet
RPCs and the statistics/song-history RPCs require login and reject before database
access. Statistics and song history show registered localized notices and retain
their existing page/tab authorization. Their original source and obsolete API
contracts are preserved in eleven references. The current search path, date
predicates, autocomplete/calendar helpers and migrated creation/attendance/Setlist
Plan writes remain active. Search/report parity and A0 remain open.

Audit-log browsing is coherently isolated: the protected page shows registered
localized recovery text, both historical-reference/filter RPCs reject before
database access, and the generic Change reader and JSON viewer are unregistered.
Fourteen source references preserve the original implementation and assertions
under `audit-log`. Existing audit writes, redaction and transactional rollback
remain active and verified. This clears the audit lookup build stop; it does not
close A0 or restore audit browsing.

Setlist Plan persistence now requires explicit band context for save/list/delete
and reorder. Fresh authorization owns repeatable reads and Serializable writes,
including audits; groups use scoped DB3 CRUD. Saves reject client-owned band,
creator, date and ordering fields, and validate JSON references against band
ownership, visibility and active memberships. Public documents retain their
payloads and nullable historical authors. The overview explicitly requests every
visible plan in the selected band, including plans whose author was removed.
Native and development RPC checks pass. The editor still depends on deferred
Song/search workflows, so full planner UI parity and A0 remain open.

Event creation now requires explicit band context and refreshes authorization in
its Serializable transaction. It retains the initial segment, ordered setlist
and membership-owned imported answers, audit records and calendar hooks. Returned
editor DTOs resolve localized/inherited catalogs and omit natural ownership keys.
Existing independent field grants remain enforced. Native and real development
RPC checks pass; the importer preview, ordinary event pages and full creation UI
still need workflow recovery. This removes the creation build stop, not the A0 gate.

File-tag catalogs now use BandFileTag/GlobalFileTag, localized CRUD/editor views,
inherited display references and `bandFileTagId` assignment metadata. Dashboard
snapshots include the selected band's tags. Partition/Recording behavior remains
global. Native and development-browser checks pass; general File editing/uploads
and localized File quick filtering remain separate recovery work. The removed raw
tag-text filter is preserved under `file-search`.
Generic settings storage is no longer registered with DB3; the settings and branding
pages use the authorized registered-hive editor. Activity-report pages, RPCs,
implementation helpers and report-only specifications are coherently isolated and
preserved; recording remains active. Typecheck/build still fail on remaining
migration contracts, so A0 remains open.
Preserve the working bootstrap and migrated membership/catalog contracts.
Platform role administration and membership recovery enhancements remain deferred.

Custom Links now have scoped list/editor/generated writes and explicit-band
public URLs, with all redirect/intermediate/file modes and visit tracking active.
The file target reader is read-only and enforces band/visibility/deletion policy;
general File workflows remain separate. Native and development-browser checks
cover scoped CRUD, direct streaming and public redirects. Full host/path portal
resolution remains after A1; this slice does not close A0.

Shared account selectors, the `User_Editor` view and its generated writes now
contain person fields only. Membership views/commands retain instrument and tag
assignments. The obsolete `UserInstrument` descriptor/editor/CRUD registrations
and unreachable person-profile/directory renderers are disabled and preserved.
Response and invitation read metadata now use BandUser, BandInstrument and
BandUserTagAssignment. The obsolete UserTag/UserTagAssignment descriptors and
`UserWithInstrumentsArgs` are removed, with their original source preserved.
The event participant reader now uses `BandUser_EventParticipant`, carrying
separate person and membership identities, membership instruments/tags and
authorized display metadata. Event detail's participant query and the dashboard's
current membership use this view; attendance consumers use the typed participant
model. The unused `xUserWithInstrument` descriptor is removed, with its original
source retained in the existing references. Empty person filters stay empty,
roleless owners can read their own membership, and client requests carry the
complete presentation context without retaining previous-band results. Native,
DOM and signed-in development-browser RPC checks cover this reader; full event
search/editing payloads and invitation management remain unfinished.
The registered response readers require nonpublic-event access, selected-band
ownership and visible, undeleted parent events. Their membership references
retain historical identities without exposing person profiles. Attendance joins
and actor-scoped search predicates use membership IDs; profile links and dedicated
write inputs retain person IDs. Participant queries accept membership filters,
including empty/unknown lists without widening the query. Native and signed-in
development-browser checks cover both response kinds, invitation assignments,
roleless owners, band switching and fresh grant revocation. Existing invitation
precedence and unanswered-response behavior remain executable. This does not
establish full event UI parity or close A0/A1.
Platform account maintenance now uses a separate `PlatformUser_Editor` view and
generated commands, authorized by `manage_global_users` without band selection.
It searches and edits shared person data; security state is read-only, and email
updates retain their Sysadmin requirement. Native and development-browser checks
cover list/create/update and switching to band context. Shared selectors retain
their existing member/owner read policy. Account lifecycle and role administration
are separate workflows; this grid does not establish their full recovery.

Shared event types, statuses and attendance options now have target-schema DB3
descriptors, localized editor/display contracts and dashboard reads. Platform
catalog managers edit global defaults in account/platform context; band grants
cannot authorize these writes. All four attendance captions and descriptions
use explicit writing locales. Band overrides remain part of scoped display
resolution. Retired options still label history, while new attendance choices
exclude retired/inactive options. Native and development-browser checks cover
this catalog slice.

Event tags now use BandEventTag/GlobalEventTag catalog contracts. The editor
selects the band's catalog or shared defaults according to explicit context;
localized names/descriptions, inherited color/order, hidden entries and hard
deletion are active. Public-site visibility stays on the shared default and is
projected as read-only metadata for band references. Global tags in use cannot
be deleted; hiding a band tag retains assignments. Dashboard bootstrap supplies
fresh band event-tag references, and assignment payloads use bandEventTagId.
Native and development-browser checks cover the catalogs; full event payloads,
frontpage content, search/report readers and invitation management still need
recovery. Existing source references and deferred specifications remain intact.

Dedicated attendance writes, the member-history RPC and the setlist-planner HTTP
reader now require explicit band selection and resolve the requested person to
an active BandUser. Response/invitation grants are independent; validation,
auditing, response revisions and calendar recalculation share the write
transaction. Reads refresh permissions in a consistent snapshot. Native tests
and a signed-in development-browser probe cover these endpoints. Existing
callers forward band context, including cancellation of stale setlist color
requests after a switch. Bulk segment copy/clear now require selected-band event
administration and visible, undeleted parent events; copies require the same
event. They preserve recorded historical answers and former same-band members,
leave matching destination rows unchanged, and update each affected membership's
response revision once with transactional audits and calendar recalculation.
Native, menu DOM and development-browser RPC checks cover this boundary.
Private calendar feeds now require explicit band selection and an active subscriber
membership. They read membership responses and invitation groups, band settings
and calendar locale in a repeatable snapshot with credential and grant checks.
Subscription retrieval/replacement and preview callers forward that context;
replacement remains account-wide. Native, request/UI and development-browser
checks cover the feed boundary. Existing unscoped subscriptions must be replaced
with a selected band's URL; the credential itself need not be rotated.
Event payloads/editing, default/tag invitation management and full attendance UI
parity still require recovery; these endpoints do not close A0 or A1.

## A1: restore everyday workflows

Once A0 passes, keep the application runnable after each slice and manually test
each restored workflow immediately. Do not accumulate another long sequence of
unrunnable domain implementations.

| Priority | Workflow and dependencies | Acceptance |
| --- | --- | --- |
| 1 | Member lookup/profiles, existing instrument/tag assignments, and required catalog references. | Owners/managers can perform ordinary permitted edits; roleless and hidden-reference cases retain their contract. |
| 2 | Events, invitations, default/selected instruments, attendance, segments, and event song lists. | Create/read/edit and member responses preserve identity, dates, invitation behavior, and same-band references. |
| 3 | Songs, tags, credits, associated files, partitions/recordings, previews, uploads/downloads. | Ordinary content and file workflows work through pages and server endpoints with correct visibility and ownership. |
| 4 | Supporting existing workflows needed for actual use: wiki/menu content, plans, search, calendars/feeds, Custom Links, exports, telemetry, and jobs. | Restore dependencies used by core workflows; explicitly account for any remaining deferred surface before accepting A1. |

Apply existing locale/settings machinery and the English labels required by each
restored component. Adapt grids, forms, validation, dialogs, filters, and accessible
labels together. Preserve technical column names; do not use humanized identifiers
as a replacement for registered UI text. Complete French/Dutch translation
coverage and a full editing/inspection UI are later work.

Required RPC/API, files, previews, feeds/tokens, and background entry points need
trusted ownership context just as pages do. Preserve supported Café Marché URLs,
serialized public-ID references, and authored content. Restore useful seed content
only when a workflow or fresh-install check needs it.

Before accepting A1, run typecheck/build, applicable lint checks, relevant focused
tests and the complete repository suite. Resolve failures, or remove/update tests
only when their contract is demonstrably obsolete; do not blanket-skip deferred
feature failures. Exercise core browser workflows on disposable migrated data
and verify access-control initialization/fresh-install behavior. Record remaining
restrictions and account for supporting workflows explicitly.

## After restoration

These are ordered by dependency and product need, not prerequisites for A0/A1:

- Platform GlobalRole/BandRole and permission-matrix editors; remaining global
  catalog/settings administration.
- New band creation, invitations, broader membership lifecycle, onboarding,
  decommissioning, and a complete account-without-membership experience.
- Shared-account global-role/lifecycle and cross-band merge workflows.
- Advanced directory filtering/facets, contact search, CSV/export, saved presets,
  and profile analytics.
- Full standalone/platform portal routing, host/path resolution, language
  switching, supported link generation, and removal of static Next i18n assumptions.
- Shared static/dynamic translation inventory and editing, chrome/Markdown editing,
  translation import/export, and recorded French/Dutch coverage.
- Delivery/query optimizations, automatic command invalidation, and optional UX
  refinements justified by measurements or observed need.

The [design](00-design%20notes.md) and contract references remain the
target for this work. Existing safe implementations stay in place; deferral changes
the order of unfinished work, not ownership or authorization policy.

## Restrictions register

This table is the single register for temporary delivery restrictions. Add any
surface isolated during A0, with its user-visible behavior and restoration gate.
The [source preservation inventory](13-feature-preservation.md) records the exact
implementation/test references and verification obligations for audited removals.

| Surface | Current boundary | Required follow-up |
| --- | --- | --- |
| Song-tag payloads and setlist song lookup | Association metadata, view/setlist transport and planner indicators use public `bandSongTagId` references. The narrow song RPC requires fresh selected-band authorization and enforces song/tag/pinned-File visibility and ownership. Generic Song/File writes and picker/search controls remain guarded. | Restore broader Song ownership, credits, editing/search and complete setlist UI during A0/A1; retain the `quick-search` restoration obligation and verify built-browser delivery. |
| `LocalizedMarkdown` | Resolved rendering is available; legacy inline editing is disabled and preserved in source. | Scoped translation/Markdown editing after A1. |
| Settings and branding | Generic DB3 settings storage/view are inactive and preserved in source. Settings/branding pages use registered commands and per-key capabilities, with explicit scope, save/reset and validated clipboard import. Logo editing, optional primary text color and upload controls remain unavailable; hosting mode belongs to deployment configuration. | Verify editors in the built app during A0/A1; recover remaining branding controls and account for legacy clipboard documents under `settings-editors`. |
| Translation tools | Native catalog controls can edit explicit translations; full inventory/inspection/chrome tooling is incomplete. | Complete after A1. |
| File-tag catalogs and File payloads | Shared/band tag CRUD, explicit translations, inherited color/order, hiding, deletion and dashboard references are migrated. Partition/Recording behavior comes only from GlobalFileTag. File payloads use BandFileTagAssignment, BandUser and BandInstrument public references; general File row services still reject undeclared ownership. Raw tag/instrument name quick filtering and association name ordering are preserved under `file-search`. | Recover File ownership, uploads/downloads and resolved File filtering/ordering; verify the complete workflows in the built application during A0/A1. |
| Shared event catalogs | Type/status/attendance CRUD edits global defaults with platform catalog authority and explicit locales. Dashboard references resolve scoped labels, including retired history. | Verify in the built application during A0/A1; recover event ownership, invitations and responses separately. |
| Attendance endpoints | Dedicated response writes and person-history/setlist readers resolve active memberships within an explicitly selected band. HTTP reads require authentication and band event-read authority. Bulk segment copy/clear use band event administration, preserve recorded history and update affected membership revisions. Native, menu DOM and development-browser endpoint checks pass. | Recover event payload/editor ownership, default/tag invitation management and full attendance UI; verify workflows in the built app before closing A1. |
| Calendar subscriptions | Private feeds and subscription/preview callers require explicit band context and active membership. Preferences, invitation groups, historical attendance, UIDs/revisions, setlists and band locale/branding remain supported. The account credential is shared across its band URLs; replacing it invalidates every band subscription. | Re-subscribe existing unscoped URLs using the selected band; verify in the built app during A0/A1. Full subscription-page localization and general event UI recovery remain separate. |
| Setlist Plan persistence | Save/list/delete, group/plan reorder and group CRUD require explicit band context, fresh grants, public identities and server-owned metadata. JSON references are validated; documents and groups survive author removal. The overview requests all visible plans in its band. | Restore Song/search dependencies and verify the complete planner editor in the built app during A0/A1. |
| Portal routing | Recovery uses explicit `?bandPublicId=<publicId>` and optional `routeLocale`; omission never selects a default band. | Full routing after A1; retain enough explicit selection for A0. |
| Custom Links | Scoped editor CRUD, file selection/serving, all redirect modes and visits are active. Public URLs require explicit `bandPublicId`; missing, malformed/repeated and unavailable bands return 404. The narrow read-only File target does not enable unfinished general file APIs. | Verify in the built application during A0/A1; integrate URLs with band portal roots when full routing lands after A1. |
| Telemetry recording | Recording uses explicit presentation context, server-owned actor/internal IDs and band-scoped associations. The formatting locale is separate from raw device locale/language; unregistered/deleted locales remain null. | Verify recording in the built app during A0. Calendar-feed recording uses the subscriber and band/locale from its authorized snapshot. Activity-report recovery is tracked separately below. |
| Audit log | The Sysadmin-protected page displays a localized recovery notice. Both historical-reference/filter RPCs reject before database access; the generic Change descriptor and audit JSON viewer are unregistered. Original source/assertions are preserved under `audit-log`. Audit recording and redaction remain active. | Restore audit browsing, filters, historical detail links and JSON/clipboard/Markdown inspection with explicit platform/band policy, fresh authorization, localized/public references and redaction; verify the complete built-browser workflow. |
| Legacy event/song facet RPCs | Both unused endpoints reject before database access; their SQL and obsolete response helpers are preserved under `legacy-event-song-filters`. Current search pages use the separate search owner and are unchanged. | Verify equivalent timing/relevance, multi-tag matching, counts/facets, pagination and ordering through the current search owner with explicit band snapshots, localized references and public identities. |
| Event statistics and song history | Statistics page and the song history tab display registered localized notices. Both RPCs reject before database access; original queries, controls, charts, event links and API types are preserved under `event-song-statistics`. Existing report/song authorization remains enforced. | Restore and verify the complete statistics/popular-song/history workflow with fresh band authorization, localized catalogs, public references and consistent aggregation. |
| Experimental event import | The Sysadmin-protected page shows a registered localized notice; the preview RPC requires login and rejects before database access. Parser, default/person/song matching, editable preview, explicit save/history and affected specifications are preserved under `event-import`. Migrated event creation remains active. | Restore parsing, band-owned defaults, membership and visible-song matching, preview editing, explicit saves and saved-event history with fresh authorization, public identities, localized references and band scheduling; reactivate specifications and verify the complete built-browser workflow. |
| Legacy quick search and reference suggestions | The public HTTP route returns 503 before query/account/content reads. Direct server/client helpers reject; association/song controls retain existing values and explain unavailability. Markdown remote suggestions are unmounted, with manual text/HTML and local inline classes retained. The explorer keeps its Sysadmin guard. Eighteen references are preserved under `quick-search`; separate domain search and existing reference renderers remain active. | Restore fresh public/member/administrator visibility within explicit bands, localized/inherited catalogs, query grammar, all-tag/type filters, ranking/limits, public identities and contextual links, stale-response isolation, selection/clearing/keyboard behavior, song detail loading and Markdown suggestions; verify two bands/locales in the built browser. |
| File uploads and image creation | Multipart/external-URL upload returns an empty 503 after login without parsing files. Image fork/gallery bake RPCs and generic File insertion reject before their work. Selection/paste/drop controls show localized recovery text; bake is disabled with an explanation. Forty references preserve creation, automatic tagging, image transforms/metadata and seven image-authorization cases under `file-creation`. Existing downloads and migrated File-tag catalogs stay executable. | Restore explicit band ownership, public membership/instrument/content references, fresh transactional grants, upload validation, filesystem cleanup/rollback, automatic tags, image crop/rotate/resize/metadata and complete browser controls; reactivate specifications and verify two-band workflows. |
| Activity-report delivery | `/backstage/featureReports` explains temporary unavailability. All five report RPCs require login and reject before database access, including CSV export. Report implementations and affected specifications are preserved; telemetry recording remains active. | Restore explicit report ownership/permissions, localized references, timelines, facets, filtering, detail and CSV behavior under `activity-reports`; reactivate specifications and verify two-band/browser isolation. |
| Legacy DB3 domains | Selected-band queries/row services reject undeclared ownership policies. | Migrate required domains for A0/A1; keep other domains coherently unavailable. |
| Dashboard content and search | Bootstrap includes migrated shared event catalogs but omits events, announcements, role metadata, custom menus and other deferred catalogs. Home explains the restriction; global search is removed from the shell. Legacy sidebar/direct routes and non-page entry points are not yet isolated. | Finish coherent route/endpoint/source isolation during A0; restore content required by core workflows during A1. |
| Platform role administration | Legacy Role descriptors, views, commands and account role controls are removed. Assignment/designation RPCs reject before database access; `/backstage/roles` and `/backstage/rolePermissions` explain unavailability. Existing global/band role definitions still authorize requests; membership role assignment remains available. | Build GlobalRole/BandRole and permission editors after A1. |
| Shared-account merging and dependency reports | Merge search, preview, commit and dependency-analysis RPCs explicitly reject without database access. Merge controls and obsolete person-level merge policies are removed; the analysis tab explains unavailability. Capability responses do not advertise merge or account-role assignment. | Restore cross-band account workflows after A1 with complete ownership-aware policies. |
| Other shared-account/platform administration | Band grants cannot authorize shared-account or global-catalog writes; remaining legacy consumers need adaptation or isolation. | Finish isolation during A0; complete broader workflows after A1. |
| Person-level instrument/tag editors | Shared User reads/editor/writes no longer include band assignments. `UserInstrument` storage/editor/CRUD are unregistered; unreachable legacy profile/directory renderers are preserved. Invitation/response metadata now uses BandUserTagAssignment; migrated BandUser assignment commands remain active. | Verify full profile/directory parity under their existing preservation obligations. |
| Catalog/demo seeds | Production seeds initialize access control. Old demo generators are preserved as disabled source. | Restore seed data needed by a named acceptance path before A1; account for remaining generators at B, with explicit approval for retirement. |
| Legacy synchronous band guards | `resolver.authorize` rejects band capabilities. | Required callers use fresh request authorization and loaded resource ownership. |

## Verification and cutover

Use two bands sharing a person and global catalog items, with different roles,
enabled locales, overrides, settings, and private content. Cover anonymous,
pending, ordinary member, roleless member, band administrator, platform
administrator, outsider, inactive membership, and deleted/merged account cases.
Check reads, writes, references, searches, caches, and context switches. Revoked
grants and cross-band references must fail at the server, regardless of UI state.

Localization checks cover band-first overrides, intentional blanks, route/browser
ordering, regional fallback, deterministic ties, and explicit lookup without
fallback. Include different preference lists with the same formatting locale.
Locale support and translated-content coverage are separate acceptance claims.

Follow [testing conventions](../testing.md): focused tests use
`yarn test <test paths> --reporter=dot`; the full suite uses
`yarn test --reporter=dot`. Keep milestone evidence concise and current rather
than appending daily test-count and diagnostic journals to the contract docs.

Production cutover also requires the [SQL runbook](03-sql-migration.md), a fresh
production-copy rehearsal, preservation comparisons, stopped writes, and matching
database/application/upload backups. Deploy migrated database, application,
and generated client together. A1 does not silently authorize dropping workflows
or replacing production data with a fixture.
