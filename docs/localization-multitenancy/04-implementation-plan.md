# Restoration plan

The [design contract](00-design%20notes.md#baselines-and-restoration-target) pins
production migration to `094a783a94b95ed4ec15089e9372763b7d59f66c` and functional/UX
parity to `f027830a9790`. Restore existing workflows on the target schema through
their existing components and server owners. Café Marché users should encounter
minimal UX changes. Temporary isolation and reduced screens do not establish parity.

## Gates and current position

| Gate | Acceptance | Status |
| --- | --- | --- |
| A0: runnable development app | Normal typecheck/build, startup on disposable migrated data, login/dashboard/migrated page in the built browser, coherent boundaries for deferred surfaces. | Achieved 2026-10-08. |
| A1: everyday workflow parity | Reference member, event/invitation/attendance, song and associated-file workflows, including their supporting endpoints and browser interactions; isolation and required checks pass. | Open. |
| B: complete localization and multiband support | Routing, administration/lifecycle, translation tooling and agreed coverage; remaining obligations restored or explicitly retired; `yarn migration:check` passes. | Open. |

A0 is a development gate, not production readiness. Production cutover also
requires the supported production upgrade, required Café Marché workflows and
explicit acceptance of any remaining limitation.

Authorization, localization/presentation, typed settings and shared DB3 support
are available. Migrated catalogs, basic member/profile edits, membership status,
wiki content, menus, attendance/calendar endpoints, plan persistence, Custom Links,
telemetry and narrow downloads have implementation and verification evidence.
Preserve them while restoring their wider workflows. Basic member directory and
profile behavior is only a subset: reference filters, presets, contact-search
policy, exports and profile tabs remain A1 work.

Song credit editing, remaining domain/quick/shell search, publication, image
creation and several reports/admin surfaces remain guarded or incomplete.
General File search/detail/metadata pages and associated uploads are restored. The
[restoration manifest](feature-restoration.json) records the individual obligations
and verification criteria; use `yarn migration:status` rather than maintaining a
second restriction table. Keep every deferred page, RPC/API, generic DB3 root,
startup/job and indirect caller coherently unavailable until its owner is safe.

## Event search checkpoint

The existing Events page, `SearchPageContent`, filter/list hooks,
`eventSearchConfig`, result cards and domain-search owner are active for
`Event_Search`. Reference presets/defaults, date/type/status/tag operators,
facets/counts, URL state, semantic sorting, load-more, refresh callbacks and
CSV/TSV export are retained. Rows, counts, facets and public references share a
freshly authorized band snapshot. Shared catalog views resolve localized labels,
inheritance and effective label ordering. Band/language changes abort old requests
and clear their results; event links and exports retain band/route locale.

Authored text matching remains active; localized catalog-name matching follows
the A1 exception below. Detail links retain the reference URLs and open the
restored detail page. Creation and pin/hide controls now use the restored write
owners. Text-only search exposes Reset filter, which also clears the text. These
checkpoints do not close event parity or A1; other domain-search roots remain guarded.

## Event detail and editing checkpoint

The existing detail page, breadcrumbs, tabs and creation/edit dialogs are active.
Page metadata and detail reads use shared snapshot authorization and localized
catalog references; absent, private, deleted and foreign-band events return 404.
Band changes remount detail state and discard previous query results. Event
creation, basic fields, visibility, pin/hide relevance, segment creation/date
editing/deletion and CafeMarche frontpage fields use explicit band/public targets
and the shared field authorization, audit and event-range services.
Creation retains the existing revision/frontpage initialization checks, requiring
`admin_events` and `edit_public_homepage` alongside `manage_events`; its button
now follows those checks. The dialog sends only creation fields and supplies the
first segment's name/description explicitly.

Invitation-group changes and the original invitation/attendance controls reuse
the migrated response owners. The person picker now selects band memberships,
rather than querying shared accounts. Setlist contents and recording playback
use independently authorized Song/File reads. The Song checkpoint below restores
setlist editing through the existing commands and nested ownership declarations.
Event Files now also uses the associated File editors and uploads described below.
Dialog help keys and draft tag associations were repaired so the original
editors can open.

Remaining event parity includes date-picker highlights, the full attendance/
default-instrument interaction matrix and publication consumers/imports.
Editing frontpage fields does not restore the
anonymous homepage or feed. Localized catalog-name matching remains covered by
the A1 exception; these gaps keep `event-workflows` and A1 open.

## Songs and event setlist checkpoint

The original Song search page, presets, tag operators/facets/counts, URL state,
tempo sorting, paging and CSV/TSV export now use the existing domain-search owner
with explicit band snapshots and localized SongTag references. Song detail,
creation, basic/visibility/tag edits and Markdown description saves use the
existing dialogs and shared row/field authorization. Private, deleted and
foreign-band targets remain unavailable, including metadata requests.

The original event setlist editor saves mixed songs/dividers, preserves existing
child identities, deletes children with their parent and reorders lists through
the existing commands. Nested children inherit ownership from the setlist/Event
declarations. The original Song autocomplete uses the Song-only quick-search
plugin and narrow authorized detail reader, public identities and contextual
links. Query/band changes cancel suggestions and discard stale results; keyboard
selection, clearing and Escape retain their reference behavior.

Linked File cards/previews/playback and recording pin/unpin use independently
authorized File rows. An unavailable recording becomes null without hiding its
visible Song or exposing a numeric FK. File metadata/upload controls and general
pages are restored in the checkpoints below. Song credit editing remains
unavailable. Credits retain their reader; editing requires
the shared-person picker. Song history/statistics and other quick-search plugins,
association selects, Markdown suggestions and shell search remain pending. Only
localized catalog-name text predicates, including quick-search tag names, follow
the A1 exception; authored text and identity-based filters remain active.

## Associated File metadata and uploads checkpoint

The original Song/Event File tabs now expose their existing metadata, visibility,
association and soft-delete controls with uploader/manage/admin field permissions.
All six File association declarations inherit ownership and privacy from the File.
Direct association insertion and reparenting also require permission on their
owning File. Member references use BandUser public identities; instrument/catalog
labels use the existing localized band reference views. Narrow Song/Event option
views avoid pulling full editor payloads into association selection.

Multipart and external HTTP/HTTPS uploads require explicit band context and fresh
transactional upload permission. The server supplies storage identity, uploader,
size and MIME/image metadata. Client metadata and natural references are rejected.
The existing Recording/Partition and instrument regex assignment uses visible,
resolved band catalogs. Local images support metadata extraction and the existing
maximum-dimension resize option. A failed batch or commit rolls back File rows,
associations and audits and removes every copied file; the HTTP owner removes its
private staging directory on success or failure. Limits are 20 files and 200 MB
per file/batch, with bounded multipart fields.

The existing selection/drop/paste controls retain read-only/permission boundaries,
block overlapping uploads at zero progress, and preserve ordinary input/text paste.
Failed uploads clear progress; failed metadata saves retain the draft. Downloads,
previews, playback and recording pin/unpin retain independent File authorization.
Soft deletion keeps storage for recovery while denying ordinary reads/downloads.

General File pages/search are restored in the checkpoint below. Image
fork/crop/rotate/gallery bake and uploads from Markdown/profile/brand/gallery
callers remain pending with their guards and source archives intact.

## General File pages and search checkpoint

The original File search, detail and metadata-grid pages are active.
`SearchPageContent`, filter/list hooks and `fileSearchConfig` retain both tag and
instrument filters, all seven operators, facets/counts, authored filename/description
search, four sorts, 20-row paging/load-more, URL state, refresh and CSV/TSV export.
Rows/counts/facets share the selected-band authorization snapshot. Shared catalog
views resolve intentional blanks, inherited/local labels and effective ordering.
Only FileTag/instrument-name free-text matching follows the A1 exception below.
No localized result sort is omitted: the reference sorts use filename, uploaded
time, size and MIME. Band/language changes discard earlier search results.

Detail page metadata and reads use the same shared authorized owner; hidden,
private, deleted and foreign targets return 404. Band changes remount detail
state and discard cached results. The original breadcrumbs, related-file links,
metadata/visibility/association editors, previews/playback and deletion controls
retain public targets, contextual URLs and independent reference authorization.
All six association selectors use shared band/catalog views. Confirmed deletion
returns to the contextual File list without refetching the unavailable target.
The metadata grid retains the reference `admin_files` capability, while
search/detail retain `access_file_landing_page`. Denied SSR requests return an
uncached 403 before page loaders. Narrow `view_files` consumers keep their
independent visibility policy.

The `file-workflows` page obligation is restored and its three source blocks and
manifest references are removed. `file-search` remains pending only for full
localized-name text matching; image creation and remaining upload integrations
have their own pending obligations. A1 and B remain open.

## Next slice: File image transforms

Restore reference image fork/crop/rotate through the existing image controls and
server owners, with explicit band/public targets, independently authorized source
Files, server-owned storage/metadata, parent/preview relationships and rollback
of database/audits/storage. Verify the actual image results in the built browser.
Keep gallery bake and Markdown/profile/brand/gallery upload integrations explicit
until their owning workflows are adapted and verified.

## Localized catalog text search exception

A1 may defer free-text matching against newly localized catalog names such as
tags, statuses, types and instruments. Omit only those predicates. Keep authored
and other nonlocalized text search, identity-based catalog filters and operators,
facets/counts, presets, URL state, sorting, presentation, paging/load-more and
exports. Resolve displayed labels through shared band/locale machinery; do not
query removed raw-name columns or add domain-specific fallback rules.

Account separately for localized-name ordering if it needs adaptation. Record the
omitted name matching in its owning manifest obligation; full matching remains
pending after A1. Keep already working resolved small-catalog searches active.
This exception does not justify disabling a search page or simplifying its UI.

Complete localization of existing site chrome is not required for A1. Keep
working labels, resolve migrated data labels, and use the registry for necessary
new text.

## Remaining sequence

Keep the app runnable and verify each slice immediately. Priorities may change
when a concrete workflow dependency requires it.

| Work | Required parity |
| --- | --- |
| Members | Existing directory filters/facets/presets/URL state/contact search/exports; profile tabs, account controls and activity, retaining migrated membership policy. |
| Events | Retain restored search/detail/creation/editing, setlist editing and invitation/attendance controls; finish default-instrument and attendance parity and date-picker highlights. |
| Songs and files | Retain restored Song search/detail/editing, tags, setlist picking, File search/detail/metadata/associations, associated uploads and recording/file viewers; finish credit editing/history, image processing and remaining upload callers. |
| Supporting workflows | Dashboard/wiki/custom navigation, plans, search, calendars/feeds/tokens, Custom Links, exports, telemetry and jobs used by core workflows. Account explicitly for remaining gaps. |

After core restoration: platform role/matrix and catalog/settings administration;
band onboarding/lifecycle; shared-account lifecycle/merge/dependency reports;
full portal routing; localized-name text matching; translation inventory/editing,
import/export and French/Dutch coverage. Existing workflow parity is not a new
enhancement. Optional product additions and optimizations remain separate.

## Slice acceptance and cutover

Before editing, inspect the reference path/tests and identify observable behavior
to preserve. Adapt shared contracts before adding domain machinery. Do not restore
obsolete models, add broad compatibility shims, narrow compiler coverage or
suppress errors to produce a passing build. Preserve any isolated implementation
and behavioral specifications in the same change using the
[preservation procedure](13-feature-preservation.md).

For each slice, pass normal typecheck/build, applicable lint and focused tests;
exercise the existing workflow in the built app on disposable data. Record only
reference behavior retained, schema-driven differences/accepted exceptions,
meaningful verification and unresolved gaps. Update this plan and the owning
manifest entry rather than appending a journal.

Use two bands sharing people/catalog items but differing in roles, private
content, locales, overrides and settings. Cover anonymous/member/roleless/manager/
platform/outsider/inactive/deleted/merged cases as relevant. Check ownership,
revoked grants, hidden references, caches and context switches at the server.
Localization checks include band-first scope, blanks, ordered route/browser
preferences, deterministic fallback and distinct preference lists sharing a
formatting locale. Locale support and translation coverage are separate claims.

Before accepting A1, assess the full repository suite and resolve failures or
update demonstrably obsolete contracts; do not blanket-skip deferred failures.
Verify core workflows and startup/fresh-install initialization. Use the
[testing conventions](../testing.md). Before production cutover, repeat the
[SQL runbook](03-sql-migration.md) on a current production copy, compare preserved
data, rehearse backup restoration and deploy the migrated database, app and
client together with writes stopped and matching upload backups.

## Verification status

The event-search checkpoint (2026-10-08) passed normal typecheck/build, focused
lint, 123 focused tests across 13 executable files and 30 native MariaDB tests
across four files. Native cases cover all tag operators, combined criteria,
stable paging, localized/blank/inherited facets, hidden/foreign references,
private/deleted events, revoked grants and anonymous/member/roleless/platform/
outsider/inactive/deleted/merged authorization boundaries. Seven built-browser
assertion groups passed on an isolated production demo build: Relevant/All/Past
concerts presets, 30-row paging, contextual links, TSV export, text/filter URL
reload, facet counts/sorting, French labels, Dutch second-band results and
ordinary-member access rejection. No uncaught browser errors occurred.

The event-detail checkpoint passed 294 focused tests across 15 executable files
and 162 native MariaDB tests across eight files, including real invitation-tag
assignments, parent-inherited segment ownership, audit/range updates, hidden and
foreign references, revoked grants, and independent pinned Song/File visibility.
Draft association tests cover new parents and invalid supplied IDs. Normal
typecheck/build and focused lint pass. Twelve assertion groups passed in the
isolated production demo browser: original detail/tab links, creation permission
gating and actual creation, basic/segment/date edits, invitation groups and member
selection, inline attendance, setlist contents and actual two-second WAV playback,
French frontpage saves/visibility, deferred File/setlist action boundaries and
Dutch second-band detail/ordinary-member controls with foreign-band 404s. No
uncaught browser or RPC errors occurred. The browser fixture supplies the existing
event-administration grant only for creation and removes it afterwards.

The Song/setlist checkpoint (2026-10-09) passes normal typecheck/build, isolated
demo build, focused lint, 238 focused tests across 17 executable files and 197
native MariaDB tests across ten files. Native tests retain event creation,
attendance/response and plan regressions, and cover all Song tag operators,
localized/blank facets, two-band visibility, fresh revoked/inactive/deleted/merged
grants, platform explicit-band access, mixed setlist child/audit rollback,
same-event reorder scope and independent pinned File visibility. Narrow selection
tests cover two-hop ownership, own-only predicates and stripping server support
fields. Obsolete deferred-Song assertions and incomplete projection/sort fixtures
were adapted to the selected-band contracts; no deferred specification was lost.

Eight assertion groups pass in the isolated production demo browser: original
Song search/facets/tempo/TSV and URL reload, actual creation and basic/Markdown
saves, File cards with two-second WAV playback and pin/unpin, keyboard Song
picking, setlist create/edit/drag reorder/confirmed child deletion, and Dutch
second-band ordinary-member controls/foreign-Song 404s. No uncaught browser or
RPC errors occurred; temporary edits and created rows are cleaned up. Unused
setting-renderer imports found by the normal build were removed.

The associated File checkpoint (2026-10-09) passes 152 focused checks across six
files and 211 native MariaDB checks across 12 files, including the existing
Song/Event/setlist checks. Upload cases cover local/URL creation, public
associations, inherited automatic tags, image metadata/resizing, fresh revocation
and rollback of database/audit/storage after missing parts, invalid image
processing and failed commit. Empty association lists require no unrelated target read grant; independent band
roles retain upload permission when the first band revokes it. Parent edit
authorization also covers direct child
insertion and reparenting. Normal typecheck/build, isolated demo build, focused
lint and preservation verification pass. Formidable/MIME development typings
were added. Obsolete deferred-upload assertions and manual projection fixtures
were adapted; every archived source and deferred specification remains intact.

Six built-browser assertion groups pass: File metadata saves, multipart PDF/audio
uploads with automatic tags and protected downloads, external Event links and
foreign/forged request rejection, real 21-file limit/staging cleanup, soft deletion
and download denial, and ordinary second-band own-file/member-association edits
with admin fields unavailable. No uncaught page/RPC errors occurred. Temporary
rows, metadata edits, audits and stored files were cleaned up. Selection/drop/
paste and busy/read-only controls are also covered by isolated jsdom tests.

The general File page/search checkpoint (2026-10-09) passes 140 focused checks
across 13 files and 236 native MariaDB checks across 13 files, including retained
File upload/association, Song/Event/setlist and attendance regressions. New native
File cases cover both filters' seven operators, combined authored text, hidden
assignments, blanks/inheritance and ordered language preferences, actual values
for all four ascending/descending sorts, stable paging/counts, public DTOs and
fresh grant/member/account/band revocation. Detail titles and related Files have
independent private/deleted/foreign-reference checks; anonymous/outsider/roleless/
platform cases retain narrow public visibility and explicit selected-band policy.
HTTP/jsdom checks cover File transport, contextual links and uncached 403 before
denied page loaders. Normal typecheck/build, isolated demo build, focused lint
and preservation verification pass. Obsolete deferred-File assertions now target
the still-deferred User domain; no behavioral specification was removed.

Nine built-browser groups pass: original 20-row paging/load-more and contextual
links; TSV columns, one-based order and protected URLs; authored text, sorting,
URL reload and Reset filter; French tag/instrument facets and inherited Cornet
override; persisted description/member-association saves; BandAdmin metadata-grid
access; confirmed soft deletion/list navigation; Dutch second-band isolation and
foreign File detail 404; ordinary-member search/detail/grid rejection. No uncaught
page/RPC errors occurred. Disposable rows, edits and audits were cleaned up.
The browser exposed and verified fixes for missing band/locale File links, ignored
dialog titles, deletion refetching, temporary Sysadmin grid restriction and denied
SSR returning 500. TSV's double-incremented order was corrected. The build also
exposed nullable attendance-response assumptions and an unused Event import;
the narrow guards/type fixes retain the existing attendance test coverage.

The complete-suite run still reports 209 failed tests and ten suite-load failures,
including unscoped authorization/account/setlist fixtures, deferred-domain and
date-policy contracts; the runner stops before the later jsdom batches. Focused
passes do not establish A1 readiness. The latest run passes 1740 tests and skips
425; its 209 failed tests and ten suite-load failure labels match the previous
associated File checkpoint exactly. Earlier built-browser member/profile/wiki/
download checks remain recorded evidence, not workflows rerun by these slices.

The [development seeder](../development-seeding.md) restores the pre-migration
fixed catalogs and random users, songs/files, event schedules/attendance/setlists,
wiki revisions and activity on the current schema. Normal database reset followed
by F5 uses the normal database and upload directory. Platform catalogs, inherited
band catalogs, local entries and localized overrides are supported. The original
generators are accounted for under the restored `demo-seeding` entry. Production
seed/startup only initializes access-control foundations.

Native seed checks, normal typecheck, targeted ESLint and production build pass.
A normal Prisma reset on a disposable database produced two bands, 80 people,
100 songs, 860 events and 2743 real files. Built Chromium checks passed shared
password login, both bands' content, Song detail, welcome wiki, SVG/WAV delivery
and the French inherited trumpet override with no page/RPC errors. The smaller
[isolated demo workflow](../demo-seeding.md) remains available. Repository-wide
tests still report the separate 209 failures and ten suite-load failures above.

`yarn migration:verify` protects the source inventory and deferred specifications;
it does not prove runtime parity. Full feature completion uses the separate
`yarn migration:check` gate.
