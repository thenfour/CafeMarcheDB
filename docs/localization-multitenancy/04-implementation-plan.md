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
Preserve them while restoring their wider workflows. Reference member-directory
filters/presets/contact-search/export and core profile tabs/account controls/activity
are restored below; full profile and localized-name-search obligations remain open.

Remaining domain/quick/shell search and several reports/admin surfaces remain
guarded or incomplete. Song credit editing and performance history, public
homepage/feed delivery and frontpage gallery editing/bake are restored below.
General File search/detail/metadata pages, associated uploads and the image fork
service are restored. The
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

The attendance/default-instrument matrix and date-picker highlights are restored
in their checkpoint below. Remaining event parity includes imports. The public
homepage/feed is restored in its own checkpoint below. Localized catalog-name matching remains covered by
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
pages are restored in the checkpoints below. Song credit editing and performance
history and Event statistics are restored in their checkpoints below. Profile credits and other quick-search plugins,
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

General File pages/search, the image fork service and authenticated frontpage
gallery controls/bake are restored in the checkpoints below. Uploads from
Markdown/profile/brand and the separate general gallery browser remain pending
with their guards and source archives intact.

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
localized-name text matching. Remaining upload integrations have their own
pending obligations. A1 and B remain open.

## File image fork checkpoint

The existing `forkImage` RPC now requires explicit band/source public identities,
strict transform fields, login and freshly authorized upload permission. Its
serializable transaction loads the source through shared DB3 visibility and
ownership policy. Hidden, deleted, foreign, external and non-image sources are
unavailable. Uploads and forks share File creation/storage helpers; the File
declaration owns field authorization, public reference resolution and auditing.
The server generates the storage identity and supplies uploader, band, visibility,
MIME, size and actual image dimensions. The result contains only a File public ID.

Forks retain the reference filename convention, parent relationship and inherited
visibility. They leave the original bytes and preview relationship intact and do
not copy associations. EXIF orientation and crop bounds come from the decoder;
preview and server share crop geometry, including tiny images and fractional
edges. Crop/resize precedes physical rotation. The reference implementation ignored
rotation and encoder quality; physical forks now apply both. PNG, JPEG and WebP
are verified. HEIC requires HEVC encoding, absent in the bundled Sharp library;
an unsupported encoder fails without creating rows, audits or storage. Any File,
audit or commit failure removes the generated image and rolls back the database.

The reference has no standalone File image editor: its controls belong to the
frontpage gallery page, restored in the following checkpoint. This service/RPC
checkpoint verifies outputs through existing File pages/downloads. `file-creation`
remains pending for other upload integrations and its source archives/deferred
specifications are retained.

## Gallery image editing and bake checkpoint

The authenticated frontpage gallery editor and original metadata grid are active.
The existing File supplies the gallery's band through the shared DB3 declaration;
gallery creator privacy stays independent of image uploader privacy. Required
File visibility excludes gallery rows whose source is hidden, private, deleted or
foreign. Captions remain the schema's authored English/Dutch/French fields,
including intentional blanks. Source choices reuse the narrow authorized File
view and registry labels. New gallery items can use an existing local image or
the existing upload/select/drop/paste controls. Upload and gallery registration
retain the reference's separate calls; only bake owns a combined transaction.

The editor retains its homepage SVG preview, five joystick tools, Reset,
caption editors, visibility, drag ordering and confirmed soft deletion. Protected
preview URLs carry band context. Save edits changes display parameters without
creating an image; failed caption saves retain the draft and editor. Band/locale
changes discard editor state. The primary page retains edit_public_homepage;
the metadata grid retains its original Sysadmin capability. Baking also requires
fresh upload_files authority, while caption/display edits require no image
management grant.

Bake composes the shared physical fork with the gallery update and both audits
inside one serializable snapshot/commit. Gallery and source authorization precede
filesystem work. A gallery write, audit or commit failure rolls back both records
and removes the generated image. Bake uses the current source File, preserves
original bytes and resets crop/rotation after applying them to pixels. The shared
fork's crop/resize-before-rotation order remains explicit; the SVG reference
preview retains its own framing. All public results omit natural/storage identity.
Public homepage/feed delivery is restored in the checkpoint below. Other upload
integrations and the separate general gallery browser retain their pending
obligations and source archives.

## Public homepage and feed delivery checkpoint

The original Caf? March? homepage and `/api/public` JSON feed are active. A narrow
Event publication view selects the authored fields; Gallery source visibility uses
the existing File owner. Both content readers, locale availability and current
authorization share one repeatable snapshot. No feed queries bypass those owners.
Public agenda includes listed readable Events only; Gallery entries and their
source Files must each be independently readable, active and in the selected band.
The published homepage always uses anonymous authority. Same-origin member feed
requests retain readable member previews; cross-origin feed requests use anonymous
authority even when a caller supplies a session cookie.

Each authored string uses ordered explicit route and browser preferences against
enabled band locales. Missing text may fall through; authored blanks remain blank.
The English/French/Dutch editor previews use the same resolver. The original wire
shape, chronological agenda with undated items last, gallery order, SVG composition,
photo selection/previous/next/autoplay, crops/rotation and absolute protected image
URLs remain intact. Gallery identity now owns SVG IDs and keys, allowing multiple
entries using one File with distinct edits. The standalone `CafeMarcheHomepage`
consumer includes the matching four-line identity fix. Internal Markdown links,
mentions and File images retain the selected band/locale.

The feed requires `bandPublicId` and accepts either `routeLocale` or the standalone
consumer's `lang`; weighted `Accept-Language` supplies later preferences. Ambiguous,
malformed or extra query inputs return 400, absent/deleted bands 404, denied reads
403 and unsupported methods 405. GET/HEAD/OPTIONS are explicit. OPTIONS and rejected
methods/inputs finish before session loading. Wildcard feed CORS enables anonymous
cross-origin consumption without credentialed access. Protected downloads retain
their existing authorization and CORS policy. Publication responses are uncached.

For the familiar Caf? March? bare root, explicitly configure:

```dotenv
CMDB_HOSTING_MODE=CafeMarche
CMDB_PUBLIC_BAND_PUBLIC_ID=<the public ID of the published Band>
CMDB_BASE_URL=https://your-cmdb-host.example
```

An explicit `/?bandPublicId=...&routeLocale=fr-BE` overrides that root binding.
Missing host binding and invalid/absent bands finish with 404 during bootstrap;
no database-order default band is inferred. Generic hosting redirects directly to
Backstage and retains supplied band/locale. Next's `/fr` and `/nl` routes remain
explicit language preferences; language changes preserve band and other query state.
Set the standalone site's `VITE_PUBLIC_FEED_URI` to
`https://your-cmdb-host.example/api/public?bandPublicId=<Band.publicId>`; its existing
language URL builder preserves that band parameter. Credentials remain omitted.

All four `public-publication` source blocks and reference entries are removed,
and that obligation is restored. This does not close the separate Event/import,
remaining upload, general gallery browser or A1/B obligations.

## Song credit editing and performance history checkpoint

Song detail's original credit controls and the delegated credit grid are active.
Create/edit/confirmed deletion use the existing generated commands, Song ownership,
field authorization and audits. The person selector exposes only public identity
and name for active, unmerged people with active selected-band memberships; the
same declared reference predicate applies to reads and writes. Credit authorship
does not grant Song ownership. Credit types use the existing shared localized
catalog and selection settings. Nullable people, intentional year/comment blanks
and Markdown are retained. Losing only the edit grant rejects save while retaining
the readable page and draft for retry. Losing page-read authority closes access.

The original history filters, expansion/reset, monthly visualization, bucket
selection and Event links are active. Strict public inputs, visible Song checks,
Event visibility, catalog identity resolution and scheduling settings share one
fresh repeatable snapshot. Events appear once even with repeated setlist entries;
undated, private, deleted and foreign Events are excluded. Past excludes the band's
current calendar day; Future includes it. One/five-year windows subtract calendar
years, include the lower boundary and exclude today. Month buckets use the band's
timezone; headings and dates use the formatting locale. Band/locale/filter changes
discard earlier results and bucket selection, and links retain context.

The generic SongCredit recovery gate is removed. The shared User declaration now
uses the existing snapshot mechanism for person references; no parallel descriptor
or domain-specific query bypass was introduced. The chart's existing maximum-year
calculation was corrected. Profile credit reads remain pending under their owner.
Their source archives and deferred specifications remain intact while those wider
obligations and A1/B stay open.

## Event statistics and popular Songs checkpoint

The original statistics page and `getGlobalStats` owner are active. Concert and
FinalConfirmation defaults, every timing/type/status/Event-tag/Song-tag filter,
Event totals, top-ten Songs, expansion/reset, monthly charts, bucket selection and
contextual links are retained. Song tags require all selected tags and affect
Song occurrences only; Event totals still include Events without a visible Song.
Each Song counts once per Event despite duplicate entries or multiple setlists.
Ranking uses distinct Event count, then public identity for deterministic ties.

The shared Event/Song/setlist declarations own band scope, row/field visibility,
public reference projection and catalog identity resolution. Totals and occurrences
share one freshly authorized repeatable snapshot. Hidden, private, deleted and
foreign references are unavailable independently. Without Song filters, Song grant
revocation removes occurrences while retaining permitted Event totals; selected
Song tags still require Song read authority. Report/Event grant revocation denies
the read. Platform authority still requires an explicit band.

Statistics and Song history now share their timing/filter contract and band-calendar
boundaries. Dashboard views supply localized/inherited labels and intentional blanks;
monthly charts use the band timezone and formatting locale. Band/language changes
remount filters/results; new results discard earlier bucket selections and errors
clear displayed rows. New page text uses the registry. The completed
`event-song-statistics` obligation has its five source blocks/references and obsolete
guards removed. Remaining deferred specifications and A1/B gates stay open.

## Member directory and profile checkpoint

The original search composition is active for BandUser: All/New presets, tag,
instrument and permitted role filters/operators/facets, URL state, sorting,
load-more and TSV export. Rows and links distinguish the shared person's identity
from membership assignments. Join-date sorting and the New preset use membership
creation rather than account creation. Catalog presentation uses shared localized
and inherited reads; catalog-name free-text matching remains under the A1 exception.
Name search remains available; contact and sign-in search follow their respective
field permissions. Recovery search requires `recover_users` and includes inactive
memberships while excluding deleted or merged people.

The existing profile owner again exposes attendance, credits and Wiki Contributions
with the original sysadmin tab gate and contextual tab URLs. Credits require fresh
member-management, basic-person and Song-read authority, an active selected-band
person, and independently visible Songs. Public Song metadata replaces the old
all-Songs dependency; localized credit types reuse dashboard references. Account
controls use the independent platform account view and current platform capability
policy in a repeatable snapshot. Profile activity retains the selected band and
person context. Existing account dialogs now use CMButton. Mass Analysis still
shows its explicit recovery notice; account analysis, merging and role administration
retain their separate obligations. This checkpoint does not close those workflows,
the full member-profile obligation or A1/B.

Profile presentation retains the original white surface, title line, contact chips
and compact instrument row; the directory retains the shared search-page width.
The capability reader evaluates each account action through the policy without
blanket `manage_global_users` or deleted-target recovery-read gates. Snapshot
authorization still refreshes the actor; operation writers enforce their own
requirements. The RPC reader and pure capability evaluator have distinct names.
Join-date labels explicitly describe membership creation, and both development
and demo seeds generate historical account/membership and content dates.
Queries retain their current content on window focus by default; presentation
refreshes follow explicit invalidation, cross-tab mutations and context changes.

The presentation/capability/date follow-up passes 58 focused contract/editor
checks and 41 native cases across account capabilities, member search and both
seeders. The final seed chronology changes also pass all 15 seed cases. Nine built
browser groups cover the original directory/profile workflows, focus without
requests or remounts, membership-date labeling, and both profile surfaces.
Typecheck, targeted lint, demo production build and source preservation pass.
The legacy `userRecovery` suite still has its nine previously recorded failures;
this follow-up does not close the full-suite or A1/B gates.

Shared row policy now declares non-null replacement identities unavailable, including
minimal projections and write references. This fixes the previously reproduced
deleted/merged-person Song-credit write failure without a Song-specific fallback.
Nested read resolution batches permitted child rows, preserves recovery access,
skips inaccessible references and avoids translation reads for plain selections.

## Event attendance and date-picker checkpoint

The original inline attendance, instrument chooser, Markdown comment editor and
response-table dialog retain invitation, past/ongoing/future/TBD, unanswered,
cleared, mixed and cancelled-segment behavior. Effective defaults come from the
selected band's membership; changing its primary instrument updates an unpinned
response, an explicit event choice remains pinned, and clearing restores the live
default. The chooser marks that effective selection without persisting a default.
Intentional blank instrument labels remain selectable; hidden instruments and
functional groups cannot become new selections. Shared DB3 reference resolution
enforces the same visibility inside the existing attendance transaction.

Response-table saves submit only changed fields, retaining historical references
that become hidden or inactive while editing. An unchanged dialog creates no
response. Invitation edits require their separate management authority. Busy saves
cannot be submitted twice; failed comment/dialog saves retain drafts for retry.
The Markdown save shortcut retains the original open-editor behavior.

Date pickers again highlight visible Event segments through the existing bounded
100-result month search and shared band/locale request lifecycle. Aggregate gaps,
TBD and cancelled segments/events are excluded; point events occupy one day.
Timed highlights use the picker timezone; all-day dates remain band dates. Empty
cancellation catalogs leave status filtering open. The generic negative-reference
filter now includes unset references, fixing SQL NULL exclusion without Event
special cases. Completed calendar source/deferred-test blocks and the obsolete
recovery notice/test are removed; the behavioral specification is active again.
This checkpoint leaves localized-name obligations and A1/B open; import is restored
in the following checkpoint.

## Event import checkpoint

The original text/config importer retains its two columns, year overrides and
2023 fallback, notes separator, title/type detection, ordered/repeated Songs with
aliases/comments and Carl/Peter/Guido attendance aliases. Name/date/type/status/
tags/invitation/visibility remain editable; explicit saves use the existing Event
aggregate transaction and add contextual links to session history. Preview writes
nothing and retains the original platform-administration gate.

Fresh band snapshots supply visible Songs, active membership-qualified people,
localized catalog labels and band-owned defaults through shared DB3 views. Import
dates use band midnights, including DST, and a missing date uses today's band date.
Missing or ambiguous matches are logged and omitted; tied matches no longer pick
arbitrary identities. Numeric/month-first date parsing and invalid explicit
leap-year fallback are repaired. Busy saves cannot be duplicated, failed saves
retain edits, and new text/config/band/locale context clears the earlier draft.
Completed import source blocks, recovery controls and obsolete assertions are
removed. Remaining localized-name search and full-suite failures leave A1/B open.

## Next slice: Wiki search and navigation suggestions

Restore the reference Wiki search and menu Wiki-slug suggestions through their
existing owners with selected-band visibility, localized labels, catalog filters,
counts/pagination and contextual links. Follow `wiki-search` and the relevant
`quick-search` obligations; preserve original navigation/editing behavior and
record only the localized catalog-name text predicates deferred by the A1
exception. This bounded checkpoint leaves other quick-search plugins, Markdown
mentions, account administration and full localized-name matching separate.

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
| Events | Retain restored search/detail/creation/editing, setlists, invitation/attendance/default-instrument controls, date-picker highlights and import preview/save; finish full localized catalog-name matching separately. |
| Songs and files | Retain restored Song search/detail/editing, credits/performance history/profile credit reads/statistics, tags, setlist picking, File search/detail/metadata/associations, associated uploads, image fork service and recording/file viewers; retain frontpage gallery editing/bake and public feed delivery; finish remaining upload callers. |
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

The image fork checkpoint (2026-10-09) passes normal typecheck/build, isolated
demo build, focused lint, 127 focused checks across five files and 265 native
MariaDB checks across 14 files. The 29 new native cases verify physical crop/
resize/rotation and pixel placement, EXIF orientation, stale metadata, tiny and
fractional edge crops, PNG/JPEG/WebP codecs and quality, HEIC encoder availability,
fork hierarchies, public DTOs, independent bands/privacy, fresh grant/account/
membership/band revocation and database/audit/storage cleanup after insert or
commit failure. Existing upload, File search/detail, Song/Event/setlist and
attendance regressions remain included. Two obsolete deferred-fork assertions
were replaced by active RPC/authorization coverage; all source archives and
deferred specifications remain intact. Preservation verification passes.

Seven built-browser groups pass: actual fork RPC and audited band File creation;
decoder-verified protected 10x20 crop/resize/rotation pixels with the original
unchanged; French File metadata/contextual parent-child links; counterclockwise
JPEG codec/MIME/dimensions; private/deleted/foreign/forged input rejection; fresh
first-band revocation with independent Dutch second-band WebP creation and foreign
detail/download 404s; anonymous denial. No uncaught page or unexpected RPC errors
occurred. Disposable rows, grants, audits and stored files were cleaned up. That
checkpoint exercised the RPC directly; the original gallery controls are now
verified by the following checkpoint.

The gallery checkpoint (2026-10-09) passes normal typecheck/build, isolated demo
build, focused lint, 146 focused checks across eight files and 53 applicable
schema read-policy checks. The policy file's unrelated missing Locale descriptor
assertion remains in the full-suite assessment. Native MariaDB passes 292 checks
across 15 files, retaining the File/image/Song/Event/setlist/attendance regressions.
The 27 new gallery cases cover shared CRUD/public identities, three captions and
blanks, creator/image privacy, visible source choices, decoder-verified bake pixels,
current-source rebake, scoped reorder/audits, soft deletion, fresh grant/account/
membership/band revocation, independent roles and gallery/audit/commit cleanup.
Four obsolete deferred-gallery assertions were removed; active reorder fixtures
now use real selected-band membership and File ownership. Source archives and
deferred specifications remain intact; preservation verification passes.

Fourteen built-browser groups pass: French protected image/caption rendering;
three actual Markdown editors and persisted blanks; failed caption save/retry;
all five joystick tools, Save edits/reload and Reset/crop; actual JPEG bake with
decoder metadata, audit/parent links and unchanged original; revoked-upload bake
denial with draft recovery; independent gallery visibility; drag ordering;
multipart upload/registration; existing-image selection with hidden/foreign
exclusion; confirmed soft deletion; Dutch second-band bake/foreign-download 404
and shared-person band switch; original platform metadata grid/page capability;
anonymous denial. No uncaught page or unexpected RPC errors occurred. Temporary
rows, grants, audits and stored files were cleaned up. Browser inspection also
verified fixes for a missing source reference provider, ignored contextual preview
URLs, invalid crop state after Reset and caption drafts closing after failed saves.

The public publication checkpoint passes normal and isolated demo builds/typechecks,
targeted lint, the standalone SPA build and 45 focused tests in seven files. The
native run passes 302 tests in 16 files, including ten new publication cases.
These cover the public wire contract, per-field preferences/blanks, enabled locales,
member previews, independent Gallery/File privacy, two bands, account/membership/
band revocation, deletion, epoch zero/undated ordering and one root snapshot.
Two obsolete deferred-public assertions were removed; other deferred tests remain.

Ten built Chromium groups pass: anonymous ordered feed content and privacy; second-
band Dutch isolation; method/input/status handling; configured bare homepage and
contextual Markdown; reused-image IDs/crops/rotation/selection/previous/next/autoplay;
decoded and foreign-band images; original language switching and band remounts;
member feed vs. anonymous published/cross-origin content; actual standalone SPA
French/Dutch consumption and image decoding; immediate source deletion without
changing download CORS. Both hosting modes and missing/invalid selection also pass.
French built-homepage and Dutch standalone screenshots were visually inspected
after layout completion. The 14 gallery editor/bake browser groups also pass on the final build, with no
page/RPC errors. They are distinct from these public delivery checks.

The Song credit/history checkpoint passes normal typecheck/build, isolated demo
build, targeted lint and 85 focused tests in six executable files. Native MariaDB
passes 333 tests in 19 files, retaining File/gallery/publication/Song/Event/setlist/
attendance regressions. New credit cases cover generated CRUD/audits, minimal
band-person references, French/Dutch/blank types, public transport, hidden/foreign/
inactive/deleted/merged references, independent roles, fresh edit/read/account/
membership/band revocation and rollback after audit failures. Thirteen history
cases cover all timing modes, DST/calendar-year boundaries, duplicate entries,
combined/all-tag filters, hidden identities, visible Song/Event requirements,
strict inputs, anonymous/platform denial and one root repeatable snapshot.

Seven built Chromium groups pass: actual French person/type selection and Markdown/
year creation; intentional blank edits; all history timing modes, expanded type/
status/tag filters, Reset, band-month chart/bucket links; delegated credit-grid
creation; confirmed deletion; edit-grant revocation with retained draft and retry;
independent Dutch second-band creation/person exclusion and private/foreign Song
404s. No page or unexpected RPC errors occurred. The French history screenshot
was visually inspected. Temporary rows, grant/account changes and audits were
cleaned up. Obsolete credit/history recovery assertions were updated; archives
and remaining deferred specifications stay intact. Preservation verification passes.

The Event statistics checkpoint (2026-10-10) passes normal typecheck/build, isolated
demo build, targeted lint and 97 focused tests across four executable files. All
17 new native statistics checks and 13 retained Song-history checks pass. They cover
every timing mode at band-day/DST/year boundaries, distinct occurrences and stable
top-ten ties, combined/all-tag filters, public catalog references, unavailable
Song/Event identities, root snapshot consistency, explicit platform context,
shared people with independent band roles and fresh grant/account/membership/band
revocation. No domain SQL or authorization bypass was added.

Six built Chromium groups pass: French defaults/catalogs and distinct totals/ranking;
band-month charts, bucket Event/Song links and expansion; every timing filter,
combined Event/inherited Song tags and Reset; fresh report revocation clearing rows
with grant recovery; Dutch shared-person band switch/independent roles and foreign/
forged references; anonymous denial. No uncaught page or unexpected RPC errors
occurred. The French chart layout was visually inspected. Temporary rows, roles,
account changes and actions were cleaned up. Preservation verification passes
after removing the five completed statistics archives/references and obsolete
deferred-statistics assertions/guards; remaining specifications stay intact.

The earlier broad native statistics run passed 349 of 350 checks; unchanged
`11d7a1a1` reproduced the deleted/merged-person Song-credit write failure. The
member checkpoint fixes that gap through shared unavailable-identity policy. Its
final native run passes all 223 checks in 18 files, including 14 member-search,
20 credit-workflow and ten platform-account cases, plus membership, Event, Song,
File, catalog and resolved-query regressions. Native tests cover operators,
contact/sign-in search restrictions, localization/inheritance/blanks, recovery,
two bands, public projections, private/foreign/deleted references and fresh
permission/account/membership/band revocation. Normal typecheck, both normal and
isolated demo production builds, targeted lint and preservation verification pass.
Focused client/endpoint/read checks pass 192 tests in ten files; 78 timezone/date
probe checks pass in two files. Two obsolete assertions
requiring profile credit reads to stay disabled were removed; preserved source
references and deferred specifications remain intact.

Six production Chromium groups pass on disposable two-band data: original directory
counts/loading/TSV export; All/New presets, French catalogs, facets and URL reload;
inactive recovery and immediate contact-search revocation; contextual profile links
and the dashboard band-switch route; management revocation removing operational
controls; profile credit/Wiki/attendance tab URLs, actual sign-in method add/remove
and band-scoped profile activity. No uncaught page or unexpected RPC errors occurred.
The French directory and profile layouts were visually inspected. Temporary rows,
roles, sign-in methods, account changes and actions were cleaned up.

The attendance/calendar slice passes 123 focused checks in 12 files and 217 native
MariaDB cases in 13 files, plus six independent native calendar-window cases.
The interaction matrix covers past/ongoing/future/TBD, invitations, absent/cleared
answers, negative/mixed/positive responses, cancelled segments and missing
instruments. Native additions cover live/pinned/cleared membership defaults,
hidden functional groups, atomic rejection, DST and exclusive picker boundaries,
stale aggregate dates, point events, visibility and one/multiple status exclusions
with unset references. Event/member/File/Song/setlist regressions remain included.
Normal typecheck, normal and isolated demo production builds, targeted lint and
source-preservation verification pass.

Eight production Chromium groups pass on disposable two-band data: original
French multi-segment invitations/declines/affirmative chooser, live defaults and
explicit pin/clear, revoked response authority retaining the real Markdown draft
and retrying, actual calendar highlights/date selection from a Tokyo browser,
past/cancelled controls, response-table comment editing after catalog retirement,
and independent Dutch membership/default behavior with foreign/anonymous denial.
No uncaught page or unexpected RPC errors occurred. The calendar layout was
visually inspected and temporary event/catalog/response/assignment/audit fixtures
were cleaned up. Remaining English chrome is covered by the A1 exception.

The import slice passes 103 focused checks in six files and 233 native MariaDB
cases in fourteen files, including sixteen new import cases and retained Event,
member, File, Song/setlist and catalog regressions. Coverage includes every
advertised date format/year override, comments/repeats/aliases, ambiguity, missing
or inactive catalogs/members, independent bands/defaults, hidden/private/deleted
Songs, fresh authority/account/band revocation, public children/audits/ranges,
band-today and 23/25-hour DST days. Client checks cover explicit edited saves,
pending duplicate prevention, failed-draft retry and text/band/locale resets.
Normal typecheck/build, isolated demo build, targeted lint and preservation
verification pass after removing all seven completed import source blocks and
obsolete recovery controls/assertions.

Seven production Chromium groups pass on disposable two-band data: French
preview with localized captions/defaults and no writes; actual atomic rejection
after Song retirement retaining edits; edited name/date/type/tag creation with
DST-aware dates, ordered children, membership responses, revisions and audits;
history opening the existing contextual Event detail; independent Dutch defaults/
memberships and reset history; fresh platform revocation/recovery; anonymous
sign-in gating with no import controls. No uncaught page or unexpected RPC errors
occurred. The French layout was visually inspected; temporary rows, catalog
changes, audits and actions were cleaned up. Remaining English chrome stays under
the A1 exception.

The complete-suite run still reports 206 failed tests and ten suite-load failures,
including unscoped authorization/account/setlist fixtures, deferred-domain and
date-policy contracts; the runner stops before the later jsdom batches. Focused
passes do not establish A1 readiness. The latest run passes 1824 tests and skips
583. Updated account fixtures change which legacy assertions reach the missing
GlobalRole/designation prerequisites; those changed failures reproduce on baseline
`bce53c20` product code with the same fixture. Newly introduced projection,
translation-read and CommonJS import-order failures were fixed; date probes and
the retained named-view tests pass. The remaining failures still prevent A1
acceptance. Earlier unrelated browser/download evidence remains recorded evidence.

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
tests still report the separate 206 failures and ten suite-load failures above.

`yarn migration:verify` protects the source inventory and deferred specifications;
it does not prove runtime parity. Full feature completion uses the separate
`yarn migration:check` gate.
