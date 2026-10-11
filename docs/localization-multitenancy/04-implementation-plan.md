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

Global shell search, planner association selection, the protected quick-search
explorer, Markdown suggestions and Markdown attachments are restored below. Full localized-name matching
and several reports/admin surfaces remain guarded
or incomplete. Song credit editing and performance history, public
homepage/feed delivery and frontpage gallery editing/bake are restored below.
General File search/detail/metadata pages, associated uploads, the image fork
service and band branding uploads are restored. The File-creation parity audit
is complete, including preserved originals and resized image children. Settings,
preferences and branding parity is also complete, including primary text color,
per-key access, focus refresh and band-only time-zone reanchor. The Song Tag
catalog-help audit is complete, including independent band/language authoring
alongside the existing catalog grid. The
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
history and Event statistics are restored in their checkpoints below. Profile
credits and all five quick-search plugins are restored in later checkpoints;
Markdown suggestions remain pending. Only
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

The remaining profile analytics audit retains populated attendance, credits and
Wiki Contributions through their existing owners. Attendance keeps the original
50/100/250/500/1,000 choices, segment/response/going counts, percentages, sortable
rows, comments and contextual Event links. An unanswered history now shows `--`
for the rate among responders instead of `NaN`. The two analytic queries request
fresh data and omit previous-scope cache results. Wiki contributions retain page
grouping, revision counts, first/latest dates, sorting and contextual links; their
reader is now owned by the Wiki server and composes the existing DB3 contribution
view in the refreshed snapshot. Unknown people reject through shared public-ID
resolution, and a mismatched requested band rejects before querying revisions.

`DateValue` now requires the caller's formatting locale and display timezone for
its label, tooltip and relative calendar text. Profile all-day Event dates and
month colors use the band's calendar; timed Events and contribution/creation
timestamps use the viewer's timezone. Its File, Wiki, directory, planner,
attendance-tooltip and dashboard callers supply the same explicit policy. A
missing-to-present date no longer changes the hook order. Existing profile
telemetry and the Sysadmin-only analytic tab gate are retained. Mass Analysis,
global account administration and the full profile obligation remain separately
open; this audit establishes the populated core analytic behavior only.

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

## Wiki search and navigation suggestions checkpoint

The reference Wiki page, `SearchPageContent`, result cards and domain-search owner
are active for `WikiPage_Search`. Authored slug/current-content matching, all tag
operators, namespace filters, exclude-self facets/counts, sorting, stable paging,
URL state, load-more and TSV export retain the original UI. The default excludes
`EventDescription` and includes unset namespaces. Result/export links carry the
selected band and locale; visible tags resolve inherited labels and intentional
blanks through the shared catalog reader. Hidden assignments stay out of results.

The existing menu editor again previews exact/best Wiki-slug matches through the
same named search view. Arbitrary authored slugs remain editable. Lookup requires
explicit band and full ordered presentation preferences, cancels obsolete requests
and clears stale or denied confirmations. This path originally used DB3 search;
other quick-search plugins and Markdown suggestions retain their own obligations.

Fresh row visibility and the existing public Wiki-view permission are preserved;
the page retains its separate `search_wiki_pages` route gate. Content matching
requires the current revision to belong to the visible parent, including malformed
revision pointers. Obvious tag natural-order, blank filter-caption and TSV
one-based-position bugs are fixed. Only localized tag-name text matching follows
the A1 exception: `wiki-search` and its four preserved source references stay
pending. Other source archives/deferred specifications remain intact.

## Dashboard Wiki content and custom navigation checkpoint

The reference home again renders `special/announcements` through its existing
floating Wiki editor between the original header/footer. Selected band, active
person and Wiki read permission gate the reader. Existing lock/revision writes,
unsaved-draft protection and contextual Markdown links remain intact; no-band and
anonymous home do not mount it. The current membership's missing-instrument warning
retains its contextual profile link.

Dashboard snapshots now query `MenuLink_List` inside the existing fresh authorized
read snapshot and deliver public DTOs. Existing client hydration uses that
snapshot's permission references. Menu reads retain the public grant independently
of customization, row visibility and natural order. The existing sidebar retains
case-insensitive section/group merging, static links, numeric order, icons, item
classes, inherited localized captions, intentional blanks and external URLs.
Nested Wiki links carry band/locale context; visited paths now select and expand
the owning section instead of its group. The obsolete menu-delivery notice was
removed; the remaining Event/calendar gap is closed in the next checkpoint.

At this checkpoint, `dashboard-content` remained pending for relevant Events/cards,
the dashboard calendar and the original limited/new-member warning. All six source
references and the deferred transport specification were preserved until the
Event/calendar checkpoint below. A1/B remain open.

## Dashboard relevant events and calendar checkpoint

The home again renders the original `RelevantEvents`/`SubtleEventCard` and
`BigEventCalendar` between announcements and the footer. One freshly authorized
dashboard snapshot selects only visible selected-band public Event identities.
The shared Event table/column/row policy owns access; the existing classifier
retains twenty candidates, five cards, pins, ongoing/upcoming/recent priority and
the ordinary nearest-future fallback. Hidden overrides are excluded before the
candidate limit, fixing starvation of otherwise visible Events. Cancelled status
meaning remains effective after retirement; an empty status catalog needs no
special fallback. Timing windows measure elapsed UTC time, while authored all-day
spans preserve their band/DST meaning.

The original month-only calendar retains bounded Event search, uncancelled
individual segments, the shared all-day adapter, selection/deselection and the
existing Event result/attendance composition. Next/previous/today controls and
month URL state remain intact. Information/setlist links open the original Event
detail tabs with selected band and locale. Band/locale transitions clear earlier
cards and selected detail through the existing presentation boundary.

The original limited/new-member warning follows fresh GlobalRole designations
outside a band and the selected membership's BandRole inside it. Missing, retired
or new-user roles warn; platform authority is exempt, and anonymous accounts do
not warn. Only the derived notice flag enters the dashboard DTO. Missing-instrument
and contextual profile warnings remain intact. Role administration stays separate;
the legacy shared `User.role` list is not part of the migrated dashboard contract.

The three deferred dashboard transport specifications are active on native
migrated fixtures. Public DTOs, one client hydration, immutable payloads, fresh
reference stores, required-reference/partial-DTO rejection and fresh hidden-row
revocation remain covered. Active BandUser tag/instrument catalogs and assignment/
invitation contracts account for the superseded UserTag/UserInstrument blocks.
All six completed dashboard source references are removed, and `dashboard-content`
is restored. A1/B and full localized-name matching remain open.

## Dashboard Event search follow-up

Dashboard candidate selection now uses the existing Event search pipeline through
its typed page-only reader. The Event-owned `eventRelevance` mode supplies the
candidate predicate, field dependencies and override/proximity order; shared
search retains authorization, ordinary filtering and public-identity pagination.
`Event_Relevance` projects only the classifier's six scalar fields. The same mode
works through the ordinary HTTP search with counts, facets and filter composition.
The twenty-candidate/five-card limits, pins, cancelled/hidden semantics and elapsed
time boundaries retain their native coverage.

The [performance comparison](dashboard-relevance-search-performance.md) records
two native runs with 100, 1,000 and 10,000 Events in each of two bands. Results are
identical. Shared search adds approximately eight milliseconds at the smallest
population and saves approximately twenty-three milliseconds at the largest.
The repeatable benchmark includes query counts and the shared authorization/
projection overhead; its historical query is confined to benchmark fixtures.

Two obsolete notice assertions now follow the current band-only implementation:
no-band accounts do not warn, and a selected-band platform account without
membership has limited access. The earlier GlobalRole/exemption description above
records the preceding checkpoint. The notice implementation is outside this
search change, apart from removing its unused `Permission` import found by the
production build.

## Global shell search checkpoint

The original `MainSiteSearch` is mounted in the app bar and uses the shared
`AssociationAutocomplete` and existing quick-search owner. Its reference Event,
Instrument, Song and Wiki plugins retain authored text, type prefixes, relevance
weights, one hundred candidates per domain and fifteen combined results. Keyboard
navigation, mouse selection, Escape and clearing retain the original controls.
Each result carries a public identity and selected-band/route-locale link; the
original shell does not include person suggestions.

HTTP and direct reads require explicit band and ordered presentation preferences,
fresh login/read grants and shared table/row visibility in one repeatable snapshot.
The caller explicitly chooses `omitUnavailable` for shell domains or `requireAll`
for pickers. Independently authorized current Wiki content can match an Event
description; foreign, private and malformed revision pointers cannot. Event date
matching and displayed suffixes use the band calendar/timezone, including exclusive
DST day boundaries. Instruments use the existing resolved band catalog, preserving
inheritance, band overrides, intentional blanks and localized description matching.

Query, band, ordered language and authority changes discard earlier results and
pending selections, including selections awaiting telemetry. A fresh presentation
snapshot refreshes suggestions after content retirement. Band/locale/grant changes
reset uncontrolled shell input. Anonymous and no-band contexts expose no shell
control. Caller-owned readiness keeps deferred Markdown dialogs unavailable even
though their Wiki plugin is now active.

The two completed `global-search` source references are removed and that obligation
is restored. The following checkpoint restores person suggestions, association
selects and the protected explorer. Markdown suggestions retain the `quick-search`
obligation and its archives. Tag/
localized-catalog-name predicates follow the A1 exception; resolved small-catalog
instrument matching remains active. A1/B stay open.

## Association selection and quick-search explorer checkpoint

The reference `AssociationSelect` is an inline control; the preceding next-slice
note called it a dialog. Its existing planner column, column-LED
and Song-LED callers are active through the same quick-search owner. It retains the
two-character threshold, ranked choices, saved association links and optional
explicit clearing. Mouse and keyboard selection, Arrow navigation and Escape
operate on current suggestions; arbitrary input does not replace an association.
Each caller supplies required permission policy, readiness and clearing behavior.
The reference association type set includes Event, Song, person and Wiki; it does
not include Instrument.

The fifth plugin restores authored-person-name matching and `u`/`user` prefixes
with the original relevance weight and candidate/result limits. Active selected-band
membership eligibility comes from the existing band-person reference contract.
Shared User read policy owns account visibility, deletion and merge rules.
`search_users` remains necessary,
and absence of the basic-info read grant permits only the policy's own-account
name read. Results expose shared person public identity and a selected-band,
route-locale profile link, without contact or membership data. Planner save uses
the same eligibility contract and revalidates every reference before writing,
retaining authored content and cached labels.

The original protected explorer retains its editable match-strength probes,
filter/result inspectors, links and ranking diagnostics. Its server and client
guards use current platform administration authority; no-band context exposes
only the registered selection notice. Session refresh now retains the explicit
inspector preference through the fresh shared Sysadmin grant. Its preceding
flag-only check hid inspectors for GlobalRole administrators without
`User.isSysAdmin`; revoked roles and forged cookie/band grants still clear it.
The explorer and planner explicitly omit unavailable domains. The shell retains
its original four-domain type set, and
the Song picker requires its Song read grant.

The shared client request lifecycle aborts and discards results on query, band,
ordered-language, authority or presentation changes, including pending autocomplete
selections awaiting telemetry. Same-scope refresh preserves the saved association,
independent probe text and unrelated planner draft; authority changes clear
suggestion input. Failed searches retain selected values and allow another query.
Band and locale navigation retain the app's existing presentation remount boundary.
All `quick-search` archives remain preserved while its Markdown and full localized
tag-name obligations are pending. Obsolete deferred-person and explorer recovery
assertions are replaced by active authorization and interaction coverage. A1/B
remain open.

## Markdown wiki and mention suggestions checkpoint

The original Wiki and mention toolbar dialogs and inline `[[`/`@` suggestions are
active in the existing Markdown editor. The shared quick-search owner receives
the explicit selected band, ordered route/browser language preferences and fresh
authorization. Wiki suggestions require their domain grant; mixed references
explicitly omit unavailable domains. The editor owns required readiness and
enables remote suggestions only for a signed-in selected-band context. Manual
Wiki slugs, existing links, ordinary text/HTML paste and local inline classes
remain available independently of search.

The original type-prefix grammar, ranked result composition, keyboard/mouse
selection, clearing and Escape remain intact. Wiki completions insert canonical
slugs, while Song/Event/person mentions insert public `type:id` references with
captions. The reference inline `@` set also includes Wiki; its old `wikiPage:id`
output opened a nonexistent article. It now inserts the supported canonical Wiki
slug/caption form. Person mentions now render contextual profile links instead
of being interpreted as Wiki slugs. Neither fix rewrites stored authored text.

Dialog invocation reads the actual selection, including expansion of an existing
reference from the Wiki toolbar. Reselecting the same mention preserves its
custom caption. Changing its query or presentation/authority snapshot invalidates
the picked mention before confirmation without discarding the caption or editor
draft. Cancel/reopen cannot retain a preceding picked item. Wiki text remains a
manual link draft rather than an authorization confirmation.

The callback-based textarea control uses the same typed search client. Requests
abort on text, band, ordered language, authority or presentation changes; delivered
choices retain a current-query/caret guard through insertion. The library checks
only the trigger on asynchronous completion, so abandoned callbacks cannot settle
and erase a newer token's popup. Stable choice keys remain valid when a stale
choice's output rejects selection. Presentation changes dismiss the popup without
remounting the textarea or losing its caret/history. Necessary dialog/search
labels use the localized registry and the actions use `CMButton`/`CMDialog`.

Built Song and locked Wiki editors verify real saves, existing authored links,
custom captions, undo/redo, fresh grant revocation and independent French/Dutch
band contexts. All quick-search source archives/references remain preserved while
full localized tag-name matching is pending under the exact A1 exception. This
checkpoint does not close `markdown-editing`, account administration or A1/B.

## Markdown file attachments checkpoint

The original attachment toolbar, multiple-file chooser, clipboard file/image
paste, file/URL drop and progress workflow are restored in `MarkdownControl3`
and `RichTextEditor`. The editor supplies an authenticated selected band,
public association identities and the original public-visibility/750px image
policy. A caller's explicit visibility identity or name replaces that default.
Person associations use `BandUser`; instruments use public identities. Existing
Song, attendance Event and Wiki contexts use the same File upload owner, with
fresh transactional authorization and database/audit/storage rollback.

Local attachments retain relative protected-download references; their rendered
links/images receive the current band and locale through the existing Markdown
owners. External records link directly to their URL because they have no stored
bytes. Captions preserve literal filename punctuation and external URL parentheses
are escaped. Successful batches replace the captured selection as one highlighted,
undoable edit. Text/HTML/raw paste, manual links, custom captions and draft/history
remain active. Failed uploads release progress and preserve the draft for retry.

Band, ordered language, authority, association, permission or presentation changes
cancel the client request and discard stale progress/completions. A changed draft
or remounted textarea cannot receive a delayed insertion; same-context uploaded
files remain available through Files with an explanatory message. Readonly,
anonymous, no-band, ungranted and local-only editors mount no chooser or attachment
toolbar and cannot initiate paste/drop uploads. Telemetry failure cannot block an
attachment. The shared `CMButton` now forwards its typed `aria-label`, giving the
paperclip an accessible localized name.

All `file-creation` source archives and deferred specifications remain preserved
pending their final parity audit. Branding callers are restored below. Localized Markdown
editing/help and full localized-name matching retain their separate obligations;
this checkpoint does not close `file-creation`, `markdown-editing` or A1/B.

## Profile and branding upload checkpoint

The reference profile pages edit shared name/phone and membership instruments/tags;
they contain no profile photo or upload caller. The earlier next-slice assumption
is corrected: this checkpoint adds no person image field or membership association.
The protected `/backstage/gallery` page is a developer example, with its separate
`developer-examples` obligation; it is not another production upload caller.

Favicon and logo chooser, scoped clipboard/file/URL paste/drop, progress, preview
and clear controls now compose with the existing registered settings editor.
Generic settings code exposes a small draft-tools contract; branding owns the
upload workflow. Logo persistence uses the new band setting
`siteCustomization.logoUrl`, the existing URL schema and per-key branding authority.
Upload changes the draft; explicit save publishes, cancel restores the stored
value, reset restores the registry default and blank URLs clear publication.
URL paste/drop edits the draft directly without creating an external File record.

Local uploads use the existing upload owner with explicit band and public
visibility. The server owns uploader/storage/MIME/size/image metadata and audits.
Branding retains original bytes, including SVG and ICO; it supplies no resize
limit. The original batch behavior selects the first URL and retains all uploaded
Files. Saved download URLs include the owning public band ID because branding is
rendered outside member-link contextualization. Files receive no person or
membership tags. Cancel/reset or a denied publication save leaves successful
uploads available in Files; failed uploads retain the draft and release progress.

Band/account/language/authority snapshot changes cancel pending uploads and ignore
late progress/completions. Changed drafts cannot be overwritten. Paste belongs to
one asset control even when both choosers are open; ordinary text-field paste is
preserved. Server upload and setting writers retain fresh transactional authority,
so revocation in an already-open form still rejects the operation.

Built-browser testing reproduced a stale header after immediate save/reload: page
and RPC bundles could retain independent brand caches. Page bootstrap now requests
an explicit refresh from the existing loader, retaining its last-known-good error
behavior. Immediate reload displays the committed favicon and logo in each band.
The existing branding lifecycle test's missing bootstrap/router/RPC mocks are
repaired. All source archives and deferred specifications remain preserved;
Their final File/settings parity audits are recorded below, including the restored
optional primary text color. A1/B remain open.

## Localized Markdown editing and page-help checkpoint

Existing page, dialog and field help restores inline edit/cancel/save/save-and-close
through the registered static-string owner. The caller supplies explicit scope,
writing locale and attachment policy. Band chrome uses an enabled writing language
chosen from ordered preferences, independently of displayed fallback text. Exact
reads start absent overrides empty; intentional blank saves and explicit inheritance
resets remain distinct. Failed saves retain drafts, committed saves refresh the
presentation, and band/account/preference changes discard old requests. Fresh
scope permissions, enabled locales, per-key validation/storage and person audits
are enforced in Serializable transactions; disabled-locale overrides remain removable.

Optional per-page Wiki help uses registered Markdown `wikiPagePath` associations,
starting with `welcome`, with independent band/locale values. Unregistered pages
have no injected help. This replaces the retired arbitrary Wiki setting-key
injection without restoring that storage contract. Existing production help content
must be mapped to registered keys during the production-copy inventory/rehearsal.
Band help retains the shared reference/attachment editor and explicit public File
policy; platform editing disables band attachments. The built browser exposed a
shared toolbar hook-order error during read-only transitions; toolbar functions now
render as components, with a real-editor regression covering the transition.

Normal typecheck, targeted lint/build, focused/native checks and seven built-browser
groups pass as recorded below. Only the two completed `markdown-editing` source
archives/references are removed and that feature is marked restored. Remaining
deferred specifications, other source references, broader translation tooling and
A1/B remain open.

## File-creation parity and preservation checkpoint

The audit against `f027830a9790` repaired a remaining upload regression: a requested
image limit was overwriting the original bytes. Uploads now keep the original File,
bytes, filename, dates, metadata and associations. When both original dimensions
exceed the limit, the reply returns a separate JPEG child with its own public/storage
identity and audited parent relationship. It inherits band, uploader and visibility;
associations stay on the original and `previewFileId` stays unset, matching the
reference. EXIF orientation is baked into the child pixels. Long/narrow images and
exact-limit boundaries retain their original identity and bytes.

Both image rows, original associations, audits and storage share the upload
transaction and rollback. A server-created upload parent has explicit actor/band
and active/local checks; it does not require adding File-read grants to upload-only
roles. Client-selected parents still use the shared public-reference read policy.
Generic client File creation remains denied because File metadata is server-owned;
upload, resized-child and fork services use the same DB3 insert/field/audit owner.
The reference profile has no photo upload caller, the general gallery is a separate
developer example, and reference audio post-processing persisted no preview or
audio metadata. These are accounted for without adding unrelated workflows.

All seven preserved image authorization specifications are executable again with
current band grants, public-ID RPCs and transactional owners. Existing delivery
specifications also supply explicit band context; their three previously failing
fixtures now pass. The unused disabled-bake recovery component and its obsolete
placeholder-only test are removed. Disabled upload controls retain their localized
notice, drop-navigation prevention and no clipboard interception, with an accurate
availability message.

Focused/native checks and eleven built-browser groups pass as recorded below.
Only the forty completed `file-creation` source blocks/references are removed and
that feature is marked restored. The ten whole-file deferred specifications, other
feature obligations, settings-editor audit and A1/B remain open.

## Settings-editor parity and preservation checkpoint

The audit against `f027830a9790` restores optional primary text color through the
registered band key, existing color schema/branding authority, typed aggregate and
page theme. Stored blank selects the application theme; reset deletes the row.
The [legacy settings account](06-localization-settings.md#legacy-settings-account)
maps runtime configuration, preferences and selector aliases, and records the
intentional typed-hive differences. Production-copy mapping/rehearsal remains
required; there is no arbitrary-name storage, startup conversion or Wiki injection.

The settings route now admits active accounts while hive/key capabilities protect
values and edits. Band-settings managers can edit scheduling without Sysadmin or
branding authority; the separate branding page retains its branding gate.
Presentation focus refresh is restored and retains same-scope drafts while loading
fresh grants/settings. Calendar preference labels/help/feedback are localized.

Three whole-file user/setting specifications are executable again. They cover both
preferences, strict native values, self ownership, preserved unrelated rows, noops,
audits/reset, invalid batches, inactive/forged principals, per-key/scope grants,
public/private reads and fresh transaction authority. Partial cache/context and
native time-zone specifications are covered by the current owners. Test discovery
now includes feature-owned tests under `src/`, matching Vitest's include patterns;
the previously excluded preference file actually runs in focused/full batches.

Focused/native checks and ten built-browser groups pass as recorded below. Only
the nineteen completed `settings-editors` blocks/references are removed, together
with five reference-only modules and their empty barrel exports. Three deferred
guards are replaced by executable tests. Other references and the seven remaining
whole-file deferred specifications remain intact; settings parity is closed while
other obligations and A1/B stay open.

## Catalog-help parity and preservation checkpoint

The audit against `f027830a9790` and the preserved source confirms that configured
`editSongTags_markdown` help remains immediately above the editable Song Tag grid.
The page already composes the registered `BandLocalizedMarkdown` owner with the
migrated `bandSongTagView`, typed columns and dashboard reference store. Its registry
description now explains the help's location; the empty default and Markdown format
are unchanged. No parallel help/editor path or legacy Setting storage is introduced.

The existing owner keeps inherited display text separate from exact drafts,
preserves intentional blanks, resets only the selected band/key/language override
and refreshes publication after save. Localization authority remains independent
of catalog administration. Fresh revoked grants reject stale writes; focus refresh
disables help controls, retains the draft and leaves authorized catalog editing
available. Band changes discard the old draft. Unscoped access is denied without
selecting an implicit band, and anonymous access displays sign-in without editors.

Focused/native checks and five built-browser groups pass as recorded below.
French/Dutch layouts are visually inspected. The single covered `catalog-help`
block/reference is removed; all other references and seven deferred specifications
remain intact. Production-copy help mapping, localized-name search, other
obligations and A1/B stay open.

## Activity-report timeline checkpoint

The original report page, top-level timeline and general-report RPC are active.
The page retains refresh/last-updated, self/administrator exclusions, feature
All/None/dialog selection, context prefix/parent/clear, calendar date selection,
five presets, all six bucket sizes and selected-bucket highlighting/clear. Necessary
labels resolve through the static registry; dates and counts use the presentation
locale. The caller enables calendar Event highlights only with the Event search
grant, so a report-only reader can select dates without requesting Event data.

The timeline owner requires an explicit public band identity and fresh
`view_feature_reports` authority inside one repeatable snapshot. Actions with
another band or no band never contribute. Counts include the selected band's
actions under the report grant; no person/entity references, routes, contexts or
query text are projected. Self exclusion uses shared User identity; role authority
comes from the selected membership. Administrator exclusion consumes the shared
account-flag/active-global-role predicate and retains anonymous authors. Strict
inputs accept only migrated timeline filters; unsupported facet filters are rejected.

Calendar presets and picker boundaries use the trusted band timezone, with an
inclusive start and exclusive end that includes today in the default preset.
The end-date rule is visible beside the controls. Hour/day/week/month/year grouping
uses real timezone offset periods without requiring MySQL timezone tables.
ISO weeks retain their week-year; spring's missing hour has no bucket and both
occurrences of autumn's repeated wall hour contribute to the same bucket.
Old-band/filter responses cannot replace the current chart; a failed fresh read
removes the chart and explicit Refresh can retry.

The native/built-browser evidence is recorded below. All 28 activity references,
including the deferred detail-redaction specification, remain intact. The full
`activity-reports` obligation and A1/B remain open.

## Activity-report aggregate facet checkpoint

The original `FacetedBreakdown`, `ClientFacetHandlers`, `facetProcessor` and
`getFacetedBreakdown` owners are active for the selected timeline bucket. All
sixteen facet groups have distributions, counts, percentages, summary/individual
tabs and count sorting. Include/isolate, exclude/hide and individual/whole-group
filter removal are restored where the reference supports them. Context selects
a literal prefix; person tokens and screen sizes remain descriptive groups.
Feature/context filters also affect the timeline; additional facet filters refine
the selected bucket, retaining the reference's top-level report behavior.

Fresh report authorization, Action aggregates, trusted band timezone and reference
reads share a repeatable snapshot. New aggregate/filter/reference queries use
compiler-checked Prisma fields. Shared User identity owns self exclusion;
membership authority owns the band grant. NULL authors remain in totals without
inventing an anonymous person. Non-NULL authors receive selection- and band-scoped
HMAC tokens using a private process key, never person identities or account data.
Tokens are stable for the same selection in a running process and change after
a server restart; they are not permanent tracking identifiers.

Song/Event/Wiki/MenuLink/CustomLink facets consume entity-owned authorized views.
Narrow reusable Wiki/MenuLink/CustomLink reference views project only public
identity and label. Authored multilingual labels retain their existing meaning;
MenuLink captions use shared locale availability, resolution and intentional blank
rules. Private/deleted/foreign references do not appear. Hidden/foreign/missing
inclusions match no authorized records, and exclusions cannot probe their counts.
Actions without a dimension/reference remain in totals when excluding a visible
value. Aggregate totals remain governed by the report grant independently of
the entity read grant.

Selected buckets match the timeline's band-local hour/day/ISO week/month/year
grouping, clipped to the report's half-open dates. Repeated autumn hours select
both UTC occurrences. A nonexistent spring hour matches no Actions; an explicit
empty-ID predicate avoids Prisma omitting an empty nested OR. Presentation refreshes
discard loaded counts/references even when their serialized inputs are unchanged.
Late requests cannot replace the current selection, band, locale or filter.

This is the aggregate facet slice. Domain chip presentation, Event reference
metadata, drill-down/ledger rows and CSV remain part of the next detail/export
work. All 28 activity source references and the deferred detail-redaction
specification remain intact; `activity-reports` and A1/B remain open. Validation
and browser cleanup evidence are recorded below.

## Activity-report ledger checkpoint (2026-10-11)

The original `getDetail`, `FacetItemDetailTable`, `FeatureReportBasics` and
`FacetedBreakdown` composition now provides the default Activity ledger and lazy
per-item detail rows in the fourteen filterable facet tabs. Person-token and
screen-size groups remain descriptive, matching the reference. The ledger keeps
the original newest-200 limit, adds a stable timestamp/Action-ID tie-break and
shows the exact matching total and localized truncation notice. Drill-downs
intersect the existing bucket, date range, feature/context and additional facet
filters; they do not replace includes or exclusions. Rows support feature/context/
device isolation and authorized-reference isolation/hiding.

Typed Prisma reads reuse the aggregate selected-band/filter/reference owners
inside one fresh authorization/data/timezone snapshot. The explicit row projection
omits natural identities, person relations and unchecked saved metadata. Only
authorized Song/Event/Wiki/MenuLink/CustomLink references supply public identities
and localized labels. Their domain chips are restored in both rows and facets;
Event start/status/type metadata comes from its existing reference view. Ledger
timestamps and Event reference dates use the trusted report zone and shared
localized formatters. Timestamp offsets distinguish repeated DST occurrences.
The existing Event chip now honors `showDate` in its tooltip too, letting this
caller supply its own explicit report-zone date. Compact reference actions and
horizontal table scrolling keep long contexts and device metadata readable.

Rows and facets share selection-scoped private HMAC person tokens. A server-only
process key is shared across Next's separately bundled RPC modules; it remains
process-local and changes on restart. Row tokens have a separate purpose and never
expose Action IDs. Historical context strings such as `App/profile/<person>/name`
are truncated at identity-bearing suffixes in both projections, and counts merge
under the safe prefix. Numeric/opaque identity segments and email suffixes are
also withheld. Context filters cannot reintroduce identifying suffixes. Anonymous
authors retain NULL tokens and remain in totals. Late replies, changed contexts,
Refresh and same-input presentation invalidation remove old rows/references.

The actual whole-file `featureReportUserIdRedaction.test.ts` specification is
executable again against the new selection/projection owner, with native row
authorization/redaction coverage. Its one source reference is removed; the other
27 activity references remain preserved. Two obsolete `getDetail` availability
guard cases are removed. `getGeneralFeatureDetail` and `getDetailCsv` stay guarded.
CSV, saved query text/raw URLs and File/segment/attendance/setlist/gallery/plan/
credit-type/instrument references still need their disclosure owners and parity
evidence. Those omissions are visible in the report's migration notice.
`activity-reports` and A1/B remain open; verification and cleanup are recorded below.

## Activity-report auxiliary-reference checkpoint (2026-10-11)

The original detail composition now restores File, EventSegment, EventAttendance,
EventSongList, FrontpageGalleryItem, SetlistPlan, SongCreditType and BandInstrument
references. Typed candidate reads use only the capped returned Actions. Narrow
views belong to the respective entities; their table, column, row, selected-band,
deletion and parent-visibility policies determine disclosure inside the same
fresh report/data/timezone snapshot. Event children require a readable parent
Event; galleries require a readable File and their own visibility. Denied,
deleted and foreign references remain NULL without removing Actions from totals.
Attendance and credit types remain shared global catalogs, while instruments use
the selected band's identity and effective fields. Inactive attendance choices
stay identifiable; hidden instruments/groups require the catalog-management grant.

Attendance/credit-type captions and inherited instrument names/group colors use
the existing localized-field owners. Intentional blank translations and band
overrides remain blank. The projection carries only public identities, authorized
labels and the metadata used by the chips, excluding storage/download targets,
uploader/creator/person relations, configuration and plan/setlist contents.
The File reference chip navigates to its existing landing page by public identity
with the current band and locale, replacing the archived storage-dependent link.
SetlistPlan now declares snapshot consistency so its reference view composes
correctly with the report owner and refreshes its grants.

The retained `ContextLabel` provides clickable breadcrumbs, preserving literal
leading/repeated separators and selecting the exact parent prefix. It does not
reintroduce redacted identity suffixes. Feature and all seven device/locale row
values support both isolation and hiding through the existing filter handler;
other filters remain intact. Family labels, tooltips and action names use the
shared localization registry. Saved URLs/search text, general detail and CSV
remain visible restoration obligations. The two guarded RPCs and all 27 activity
references remain; activity reports and A1/B are still open.

## Activity-report metadata and CSV closure (2026-10-11)

The remaining `getGeneralFeatureDetail` and `getDetailCsv` readers now compose
through the existing selected-band detail owner. Ledger, general detail and CSV
use the same strict selection filters, fresh repeatable authorization/data/zone
snapshot, authorized references, safe contexts and scoped participant/row tokens.
The original caps remain 200, 1,000 and 20,000 respectively, with exact matching
totals and stable newest-first ordering. Clients cannot choose another limit or
supply natural identities or a reporting zone.

Saved metadata has an explicit disclosure owner. Recognized application URLs are
reconstructed from authorized reference identities or fixed page paths; legacy
numeric entity routes become public routes. Absolute URLs must match the trusted
deployment origin. Saved slugs, filters, query parameters and fragments are
discarded, and links carry the current band/route locale. Person, authentication,
API/download, external, malformed and unrecognized routes stay NULL. Query text
is shown only for the association-selection producer when it is a confirmed
fragment of an authorized Song/Event/Wiki label and its context is not identifying.
Unverified searches, including person/contact/credential text, and denied
references are withheld. This preserves useful metadata without disclosing text beyond the
reference owner's allowed presentation. The original row search/URL columns are
active again, and the obsolete migration notice is removed.

The original export button/confirmation/progress/success/error/retry workflow uses
the shared CMDialog/ResponsiveDialog and CMButton controls with registered strings.
It exports the complete current bucket/filter selection, reports counts and
truncation, and discards late downloads after selection, band, refresh or mount
changes. CSV retains the original columns, adds authorized auxiliary labels,
uses stable headers even for empty results, quotes Unicode/commas/quotes/newlines
and protects every cell against spreadsheet formulas. Dates remain explicit UTC
ISO values. The original `id` column contains the scoped row token; related IDs
are public identities. Physical storage names and unchecked File download targets
retain empty legacy columns under the identity/disclosure policy. Downloads carry
a UTF-8 marker, band-specific filenames and release their temporary browser
links/object URLs.

The full report restoration covers the original timeline controls, sixteen facet
groups, filters/sorting/distributions, default ledger, fourteen lazy drill-downs,
all thirteen authorized reference families, breadcrumbs/scalar hide controls,
metadata, general details and CSV. The seven archived raw-relation projection/link
filter cases are superseded by the active identity/request-boundary specifications
and native ledger/general/CSV public-reference checks. Four obsolete report-guard
tests are removed. All 27 activity source blocks/reference entries are removed and
`activity-reports` is marked restored; its recovery flag is removed too. The six
whole-file deferred specifications and all other feature obligations remain.
This closes activity reports, with A1/B still open. Verification is recorded below.

## Core workflow parity review

The reference/current caller audit finds no application consumers of
`getEventFilterInfo` or `getSongFilterInfo`. Their timing/relevance, all-tag
matching, counts, facets, paging and ordering obligations are implemented by the
existing Event/Song domain-search owners, with public identities, localized
references and fresh selected-band snapshots. The unused RPCs, payload archives
and four guard tests are removed; `legacy-event-song-filters` is closed with its
six preservation references removed. The unused legacy relevant-Song mode has no
reference page, picker or profile caller; it does not require a second search
implementation. Full localized-name matching remains separately pending under
the owning search features and the A1 exception.

The populated member analytics above, retained Event statistics/popular Songs
and Song performance history account for the identified core statistics callers.
Three obsolete assertions that those restored statistics/history screens remain
unavailable are removed. Their active contract, authorization, native and browser
checks remain. Account analysis and platform account/lifecycle obligations retain
their own deferred implementations and specifications.

## Full-suite readiness

Authorization fixtures now persist explicit GlobalRole and BandRole grants,
selected-band memberships and registry permission IDs. The Prisma double derives
relations and compound identities from the generated schema and supplies no
authorization defaults. Response/instrument/tag expectations use BandUser;
account writes, profile links and audit authors retain User identity. Existing
hostile request, field-policy, visibility and session-refresh checks remain active.

The restored directory and membership picker specifications exercise their current
domain-search/view owners. Six obsolete assertions that restored File, gallery
and Wiki pages remain unavailable are removed; still-deferred pages retain their
guards. Vitest uses Next's automatic JSX runtime. Presentation tests retain the
current provider's stable-focus policy, explicit write/storage invalidation and
scope changes; prior focus-refresh evidence does not describe this current policy.

Verification also repairs two production gaps: account deactivation/reactivation
and deleted-account sign-in summaries require fresh manage_global_users authority,
independent of band lifecycle grants; Permission metadata uses its server-owned
deletion field so retired rows cannot appear in ordinary reads. Ordinary account
deactivation retains memberships and credentials while revoking sessions. Broader
role continuity, account merge/analysis and lifecycle parity remain open.

## Role administration checkpoint

The original role and Permission grids and permission matrix are restored through
GlobalRole/BandRole views and their existing DB3 owners. They retain localized
metadata editing, permission selection, help, unknown-permission filtering,
synchronization indicators and copy. Shared definitions use explicit platform
write authority; the selected band determines displayed labels and contextual
navigation. Band membership role assignment keeps its existing band owner.

The role association field owns protected-grant validation for both editor and
matrix writes. BandRole rejects platform/unknown permissions; never_grant cannot
be assigned; the designated GlobalRole Sysadmin retains sysadmin and login.
Dedicated designation commands require fresh platform authority, validate scope
and public identities, lock definitions in a serializable transaction and repair
duplicate/deleted flags atomically with one audit operation. Idempotent requests
add no audit. Ambiguous band designations confer no public platform grants, while
independent platform authority remains usable for repair. Account-flag Sysadmins
retain the existing fail-closed global designation policy.

Original profile and platform-account-list actions assign or clear the shared
account's GlobalRole with current manage_global_users authority, active localized
choices, delegation checks and explicit continuity acknowledgement. Both band
memberships, their roles, credentials and sessions are preserved. Writes audit the
User field only; final ordinary global-management holders exclude Sysadmins.
Pending controls prevent duplicate writes, failed drafts permit retry and refresh
failures after commit are distinct. Matrix scope changes close their dropdown
before the new query suspends.

The role-administration obligation is closed: its sixty-three source references
are removed, the reference-only RoleChip module is deleted, the designation
specification is active and the obsolete role recovery UI/guards are removed.
Applicable membership chips and current DTO behavior remain in their migrated
owners. Native and built-browser evidence is recorded below. Account
merge, full profile parity, production inventory/rehearsal, A1/B and localized
catalog-name matching remain open. Dependency analysis is closed below.

## Shared-account dependency analysis checkpoint

The original Mass Analysis profile tab retains its summary, content,
participation, system and account-information tables, count bars, advisory risk
cards and two-account comparison. A lazy platform-account-grid action also makes
inactive, merged and membership-free targets inspectable. Reports and the minimal
comparison account list require fresh platform Sysadmin authority in repeatable
snapshots, independently of account-management or selected-band grants.

The reference administrative inventory intentionally counts hidden/deleted content
and retired memberships/bands. User owns authored content, credits, history,
sign-in methods and account settings; BandUser owns responses, tags, instruments
and membership settings. Dependencies leave the server as counts, alongside the
original permitted account metadata and public identities. Credentials and linked
record contents remain private. Each membership resolves its own band/role labels;
the account GlobalRole resolves globally, without the selected band's overrides.

Activity and risk retain the reference heuristic categories and thresholds.
Active platform or band grants on a GlobalRole replace comparisons against raw
role names; flagged administrators remain protected even if their designated
grants are invalid. Merged targets have
an explicit blocker. All sessions count as dependencies, while live-session
warnings exclude expired rows. Typed risk reasons resolve through registered
localized messages. These advisory summaries authorize no lifecycle or merge write.

The shared selection UI searches account name/email/public identity and excludes
the primary account. Comparison and picker state reset on account, band, route,
ordered preferences, presentation revision and actor changes. Old/mismatched
results and failed authorization cannot display a cached report; Refresh retries
both current reports. Dates/numbers use explicit viewer timezone/formatting locale,
unknown activity stays null and comparison-only populated sections remain visible.

The account-analysis obligation is closed: four source blocks/references and its
unused recovery flag/string are removed. Two obsolete availability-guard cases
are removed; the retained page guard now requires Sysadmin. Account merge is
restored in the checkpoint below. Broader profile/lifecycle parity, production
inventory/rehearsal, localized-name matching and A1/B remain open.

## Shared-account merge checkpoint

The original profile action and a lazy platform-account-grid entry open the same
merge dialog. The shared picker searches words across name, email and public
identity, excludes the operator/profile account and retains clear/reopen behavior.
Main/Retiring summaries, swap, aggregate policy report, blockers and one
accept/cancel decision retain the reference workflow. New controls and membership
policy text use registered strings; existing English chrome follows the A1
exception. Account GlobalRole labels resolve globally, preserving locale order
and intentional blanks; dates/counts use explicit viewer presentation.

Search, merge-specific analysis, preview and commit require fresh `merge_users`
and `manage_global_users` authority from an active, unmerged operator, without
impersonation or self-merging. Delegated global authority covers every target's
global and band-role grants, including inactive memberships. Sysadmin can manage
protected targets. Selected-band authority never authorizes this account-wide
operation. The analysis inventory is reused behind that feature boundary;
ordinary Mass Analysis remains separately Sysadmin-only.

Policy version 2 assigns every User/BandUser foreign key exactly once. Main
retains shared identity/contact/global role/account settings and each overlapping
membership identity/role/state/preferences, including blanks/defaults. Missing
responses, attendance, instruments and File tags transfer within their band;
Main wins overlaps, defaults and shared-band member tags. Retiring-only
memberships reparent with their identity/state/preferences/associations intact,
but their band roles are cleared to preserve the never-combine-privileges rule.
Inactive memberships and retired bands stay inactive.

Account-wide sign-in methods, credits, uploaded Files and authored content follow
the fixed policies. Main's password wins when present, both accounts' sessions,
impersonation sessions started by either, and reset tokens are revoked, and only
Main's calendar subscription remains valid. Historical attribution stays on its
original account/editor; Retiring's Wiki editing locks are released. An inactive
Main, no usable login, prior received merges, invalid primary instruments and
embedded/unreadable plan JSON block retirement. The report includes global and
band continuity consequences without exposing private linked content/settings.

Preview and Serializable commit rebuild the same policies under fresh authority.
An opaque HMAC binds direction, operator, version, participants, memberships,
grants and relevant hidden rows. Even a hidden comment change with unchanged
counts requires review again. Policy effects, retirement and one aggregate audit
commit atomically; audit failure rolls everything back. A concurrent/repeated
request cannot duplicate effects or audits: an already merged participant is
rejected by fresh eligibility. No persistent confirmation or operation model is
added. Transaction conflict has a distinct retry response.

The dialog locks selection/confirmation while pending. Failed commit discards
the report; failed authorization hides cached results. Profile, band, route,
ordered preferences, presentation revision and actor changes close the dialog,
reset selection and discard late replies. Four preserved specifications are
executable, six obsolete availability-rejection cases and the unused recovery
flag are removed, and all 29 completed source blocks/references are removed.
The current contract is documented in [userMerge.md](../userMerge.md).

## Next slice: Audit log

Restore the preserved audit browser, filters, historical JSON inspection and
detail/navigation/clipboard actions through their existing page and server
owners. Retain immutable recording while distinguishing account-wide platform
authority from band-owned rows and independently authorizing historical
references. Reactivate the remaining deferred audit specification; verify
redaction, deleted references, fresh revocation, two-band localization and the
original built-browser workflow on disposable data. Keep broader profile parity,
localized-name matching, production inventory/rehearsal and A1/B open.

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
| Songs and files | Retain restored Song search/detail/editing, credits/performance history/profile credit reads/statistics, tags, setlist picking, File search/detail/metadata/associations, associated and Markdown/branding uploads, image fork service and recording/file viewers, including verified original/resized-image creation; retain frontpage gallery editing/bake and public feed delivery. |
| Supporting workflows | Retain restored dashboard announcements/relevant Events/calendar/custom navigation, global shell search, planner association selection/protected explorer, Markdown suggestions/attachments/localized editing/help, Wiki readers/search, plans, calendars/feeds/tokens and Custom Links; finish exports, telemetry and jobs used by core workflows. Account explicitly for remaining gaps. |

After core restoration: retain restored platform role/matrix and catalog/settings administration;
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

The **shared-account merge** checkpoint passes normal `yarn typecheck`,
targeted ESLint across **42 changed TypeScript files** and a normal production
build with isolated output. The complete repository
runner selects **290 files: 2,994 passed and 903 skipped**, with no test or
suite-load failures. Existing native gates remain; the 27 restored merge cases
run separately on their own database rather than skipping an unrelated check.
Focused policy/request/dialog/recovery/analysis checks pass **84 cases in six
files**. Four deferred merge specifications are executable; six obsolete
availability-rejection cases are removed, and the lifecycle navigation spec
isolates the merge component behind its own mounted coverage.

All **65 existing native MySQL specifications** pass **846 cases with 24 existing
fixture-gated skips**, plus **27 merge cases** on a separate disposable database.
Coverage includes every User/BandUser foreign key, Main blanks/defaults and
two-band response/segment revisions, imported inactive memberships/preferences,
role clearing, exact credit deduplication, hidden/deleted current ownership,
unchanged history, credentials/calendar/sessions/reset tokens and Wiki locks.
Delegated authority, every membership ceiling, revoked/deleted/merged/anonymous/
impersonated actors, no-band/numeric/decision rejection, localized global role
blanks/preference order, global/band continuity, same-count hidden changes,
audit rollback, concurrent commits and exact replay are exercised. Both private
databases are dropped. The merge runner now uses the required repository wrapper.

**Seven built Chromium groups** verify lazy original profile and platform-grid
entries, actual shared-picker word search/exclusion without a request loop,
swap/blockers, French/Dutch global labels and explicit Tokyo dates, two-band
aggregate privacy, forged public requests, same-count hidden-comment changes,
captured commits denied after fresh revocation, cache hiding and explicit retry,
held old-context replies and a real inactive-account merge. Main's exact account
values remain, both bands' responses and sign-in methods transfer and one audit
records retirement. Band-only managers and anonymous clients are denied. French
profile/grid layouts are visually inspected; no uncaught page or unexpected RPC
errors occur. The owned server/database/assets are removed.

Evidence is in `temp/user-merge-full-suite.log`, `temp/user-merge-all-native.log`,
`temp/user-merge-native.log`, `temp/user-merge-focused.log` and
`temp/user-merge-browser-result.json`. Final build/lint/compiler and source
correspondence are recorded in `temp/user-merge-final-results.json`. Preservation
verifies **93 source references, one whole-file deferred specification and ten
pending features**. Account merge is restored; audit browsing is next. Broader
profile parity, localized-name matching, production inventory/rehearsal and A1/B
remain open.

The preceding **account dependency analysis** checkpoint passes normal `yarn typecheck`,
targeted ESLint across twenty-one changed TypeScript files and a normal production
build with isolated output. The complete repository runner selects **286 files:
2,965 passed and 876 skipped**, with no test or suite-load failures. Existing
conditional database gates remain; no unrelated skips are added. Focused pure,
request, page-guard and mounted-profile/report checks pass **93 cases in five
files** and cover risk boundaries,
privacy, lazy loading, original table composition, explicit dates/numbers,
comparison/clear/refresh, late results, errors and presentation/actor resets.

All **65 native MySQL specifications** run on a private disposable database:
**846 passed and 24 skipped**, with sixty-one passing and four existing
fixture-gated suites. Ten account cases verify exact original category counts,
hidden/deleted content, retired bands/memberships/roles, inactive/merged targets,
account isolation, fresh revoked/deleted/merged/anonymous actors, Sysadmin without
account-management or selected-band grants, expired/live sessions, locale
preference order and intentional blanks. The private database is dropped.

**Eight built Chromium groups** verify lazy inactive/merged inspection, the
original Mass Analysis profile path and five tables, both membership inventories,
exact private/deleted File counts, French/Dutch account and membership labels,
explicit Tokyo dates, email comparison search/exclusion, side-by-side bars/cards,
band navigation/reset, Clear, held old replies, strict public requests and fresh
revocation/hiding/retry. Band-only managers and anonymous requests are denied.
French/Dutch comparison and inactive-account layouts are visually inspected.
No uncaught page or unexpected RPC errors occur; the owned server/database/assets
are removed. The development database and server are untouched.

Evidence is in `temp/account-analysis-full-suite.log`,
`temp/account-analysis-all-native.log`, `temp/account-analysis-final-focused.log`
and `temp/account-analysis-browser-result.json`. Final build/lint/compiler and
source correspondence are recorded in `temp/account-analysis-final-results.json`.
At that checkpoint, preservation verifies **122 source references, five whole-file deferred
specifications and eleven pending features**. Account analysis is restored;
account merge follows in the checkpoint above. Broader profile parity, production inventory/rehearsal,
localized catalog-name matching and A1/B remain open.

The preceding **role administration** checkpoint passes normal `yarn typecheck`, targeted
ESLint across seventy-one changed TypeScript files and a normal production build
with isolated output. The complete repository
runner selects **283 files: 2,937 passed and 866 skipped**, with no test or
suite-load failures. The new native specification retains the existing
disposable-database gate; no unrelated skip guards are added. Five superseded
role/designation recovery-rejection cases are removed. The focused request,
authorization, write-context and mounted-control boundary run passes **105 cases
across four files**, including retained drafts, acknowledged retry, pending and
unmounted writes, fresh capability revocation and deliberate designation retry.
After preservation cleanup, seventy-three focused cases in five files pass
against the final recovery/request/control sources.

All **64 native MySQL specifications** run through the repository runner on a
private disposable database: **836 passed and 24 skipped**, with sixty passing
and four existing fixture-gated suites. The new role specification passes all
thirty-nine cases. Coverage includes atomic duplicate/deleted designation repair,
Sysadmin grant completeness, no-op audit behavior, fresh grants/deleted/merged
actors, both editor/matrix paths, active public references, protected platform
grants, shared-account delegation/continuity, session/membership preservation and
independent band label overrides/intentional blanks. The runner exits zero and
drops its private database; the development database is untouched.

**Thirteen built Chromium groups** pass on disposable two-band data. They exercise
the original creation dialog, French inline edit/confirmation, Dutch labels,
Permission metadata filter/edit, audited global and band matrices, unknown filter,
copy, protected-cell rejection, designation change/restore, profile assignment,
lazy account-list clearing, explicit continuity acknowledgement and fresh
platform-grant revocation. Band-only managers and anonymous requests are denied.
French/Dutch grids and the band matrix are visually inspected. No uncaught page
or unexpected RPC errors occur. The owned server, database and assets are removed.

Evidence is in `temp/role-admin-final-suite.log`, `temp/role-admin-all-native.log`,
`temp/role-admin-boundary.log` and `temp/role-admin-browser-result.json`.
Final compiler/build/lint and cleanup results are in
`temp/role-admin-final-results.json` and `temp/role-admin-cleanup-tests.log`.
`yarn migration:verify` retains **126 source references, five whole-file deferred
specifications and twelve pending features**. Role administration is restored;
account merge, full profile parity, localized-name matching, production
inventory/rehearsal and A1/B remain open. Its analysis status and inventory totals
are superseded by the account-analysis checkpoint above.

The preceding **full-suite readiness** checkpoint passes `yarn typecheck`, targeted ESLint
across all fifty changed TypeScript files and a normal production build with
isolated output. The tested build's five production changes match the final
workspace sources. `yarn test --reporter=dot` completes all 278 selected files:
2,425 Node cases and 488 cases across 62 isolated jsdom files pass, for **2,913
passed and 827 skipped**, with no test or suite-load failures. Existing conditional
gates remain; no new skip guards are added. Six obsolete recovery-page assertions
are removed, and the old remote-user picker expectations now exercise the current
membership view, local filtering, exclusion, selected identity and cancellation.

The native run selects all 63 `.mysql.test.ts` files through the repository runner
on a disposable phase-two database: **797 passed and 24 skipped** across 59 passing
and four gated suites. Demo/development seeding, calendar-window and performance
suites retain their separate fixture gates. Native checks cover the migrated
authorization/catalog/workflow contracts, hostile view/entity mismatches, fresh
File grant revocation and deleted Permission metadata for members and Sysadmins.
The private database is dropped; the development database is untouched.

Sixteen built Chromium assertion groups pass on disposable two-band data. They
retain the populated profile, French/Dutch date/label, paging, context-switch and
fresh grant checks above. Additional lifecycle checks deny a band manager, allow
an operator with only manage_global_users and no selected band, revoke sessions
while retaining both memberships and credentials, read the deleted account's
Sysadmin sign-in summary, restore it without reviving sessions, reject revoked
global authority and retain two User-owned audits. No uncaught page or unexpected
RPC errors occur. The owned server, disposable database and demo assets are removed.

Evidence is in `temp/readiness-full-final.log`, `temp/readiness-native-final.log`,
`temp/readiness-browser-result.json` and `temp/readiness-results.json`.
`yarn migration:verify` retains **189 source references, six whole-file deferred
specifications and thirteen pending features**. No obligation is closed in this
slice. Complete-suite readiness is achieved; full profile/account parity,
localized-name matching, production inventory/rehearsal and A1/B remain open.

The **core workflow parity review** passes normal typecheck, targeted lint across
all changed TypeScript files and a normal production build with isolated output.
Its 222 focused cases across fourteen files cover populated profile counts,
percentages and all five page sizes, zero-response/empty histories, sortable Wiki
counts/dates/links, explicit date/tooltip/relative formatting, missing-date hook
transitions, strict Wiki public requests, retained Event/Song endpoint guards,
profile field policy and the five-zone date probes. The obsolete four legacy-RPC
guards and three statistics/history recovery assertions are removed.

Native MariaDB passes 155 cases across nine suites, including nine new profile
analytics cases. Wiki pages group only the requested author's authorized revisions
and preserve first/latest/count behavior without bodies, contact fields or natural
IDs. Cases cover private pages, the same author/slug in two bands, requested-band
correlation, missing people, fresh grant removal/restoration, deleted pages and
inactive/deleted/merged actors. Attendance remains membership-owned across two
bands, preserves blanks/false and future-only unanswered histories, and refreshes
its read grants. The retained member/search/credit/Wiki/attendance/Event-statistics/
Song-history cases pass; the disposable native database is removed.

Eleven built Chromium groups cover populated attendance/Wiki/credit tabs, exact
counts/rates, all original page sizes, first/latest contribution dates, localized
credit labels, contextual links and existing profile telemetry. English browser
preferences and a Los Angeles viewer verify French Brussels all-day dates and
viewer-zone timed/tooltips; Dutch second-band results use Tokyo all-day dates and
show `--` for the responder rate. A held old-band attendance reply cannot replace
the new history after the actual band chooser changes context. The separate Mass
Analysis notice issues no query, band managers retain the original tab restriction,
freshly revoked Wiki grants reject captured requests and anonymous RPC access
fails. Existing Event/Song pages retain All/Relevant controls and band-local cards
after the unused RPC removal. No uncaught page or unexpected RPC errors occur.

French/Dutch attendance and French Wiki screenshots are visually reviewed.
The owned browser server is stopped; its new disposable database, sessions,
fixture content and demo assets are removed. The user's development server is
untouched. Evidence is in `temp/core-parity-browser-result.json`, with screenshots
in `temp/core-parity-attendance-fr.png`, `temp/core-parity-attendance-nl.png` and
`temp/core-parity-wiki-fr.png`.

At the preceding core-workflow checkpoint, the complete suite retained 203 failed
tests and ten suite-load failures, with 2,106 passed and 826 skipped. The full-suite
readiness work above resolves those inherited fixture/contract failures and runs
the later isolated jsdom batches too. Its final verification is recorded below.
Full profile/account parity, production inventory/rehearsal and A1/B remain open.

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

The Wiki slice passes 55 focused checks in eight files and 268 native MariaDB
cases in seventeen files, including 29 new Wiki-search cases and retained Wiki,
tag/menu, Event, member, File, Song/setlist and catalog regressions. Native checks
cover all tag operators, unset/negative namespaces, combined filters, counts/facets,
sorts/paging, authored current-content matching, malformed revision pointers,
localized inheritance/blanks/ordered preferences, hidden/private/foreign identities
and fresh account/membership/visibility/band revocation. Typecheck, targeted lint
and preservation verification pass; the demo production build passes. Normal
production settings are built with isolated output to avoid the running development
server's `.next` directory.
Fresh build lint also exposed an obsolete `UserClientBaseTypes.tsx` duplicate,
shadowed by the active `.ts` contract. The unused duplicate was removed without
changing compiler/lint coverage or preserved source references.

Seven production Chromium groups pass on disposable two-band data: French defaults,
blank captions and load-more; contextual TSV export and sort controls; current
authored content, URL reload/reset and tag/namespace counts; existing Wiki reader
navigation; actual menu exact/best/no-match editing and saved links; independent
Dutch labels/links; fresh authority revocation and anonymous sign-in gating. No
uncaught page or unexpected RPC errors occurred. The French layout was visually
inspected and temporary pages/tags/menu rows, account changes, strings, audits and
actions were cleaned up. Remaining English chrome stays under the A1 exception.

The dashboard Wiki/navigation slice passes 21 focused checks in three files and
286 native MariaDB cases in nineteen files, including twelve dashboard cases.
Coverage includes public DTOs and single hydration, same-snapshot references,
natural ordering, band-first blanks/inheritance/ordered locale preferences,
anonymous/no-band/platform boundaries and fresh grant/role/membership/person/band
revocation. Existing Wiki editing/search, menu, catalogs, member, Event, File,
Song and setlist regressions pass. Normal typecheck/build, isolated demo build,
targeted lint and preservation verification pass; normal production settings use
isolated build output to preserve the running development server.

Seven production Chromium groups pass on disposable two-band data: floating
announcements and contextual Markdown links; sidebar order, blank captions,
static section merging, icons/classes/private visibility/external URLs; persisted
collapse and direct nested-route expansion/selection; owned revision save and
unsaved-draft Stay/Leave band transitions; unavailable French fallback and Dutch
labels plus actual menu edit/sidebar refresh/Wiki navigation; fresh authority
revocation/restoration; roleless shared member, anonymous sign-in and explicit
no-band selection. No uncaught page or unexpected RPC errors occurred. The French
layout was visually inspected; temporary rows, strings, account changes, audits
and actions were cleaned up and the test server stopped. At that checkpoint, all
six dashboard source references and its deferred transport specification remained
intact; the completed Event/calendar checkpoint removes them below.

The dashboard Event/calendar slice passes 117 focused checks in six files and
326 native MariaDB cases in twenty-three files, including eighteen Event selection/
notice cases and the three reactivated dashboard transport specifications.
Coverage includes pins and ordinary future fallback, twenty-candidate/five-card
limits, hidden/private/deleted/foreign rows, cancellation after status retirement,
empty catalogs, exact/subsecond/point/DST boundaries, fresh person/grant/membership
changes, independent bands, role designations, public DTOs and immutable single
hydration. Existing Wiki/menu, tag/instrument/role, Event/attendance/creation,
member, File, Song/setlist and catalog regressions pass.

Seven production Chromium groups pass on disposable two-band data: French cards
and contextual Info/setlist navigation; individual calendar segments/all-day spans
from a Tokyo browser and selection/deselection; next/previous/today and month URL
reload; fresh Event grant revocation/recovery; shared-person band changes with
cleared selected detail and Dutch links; fresh roleless notice, recovered role,
explicit no-band and anonymous boundaries. No uncaught page or unexpected RPC
errors occurred. The calendar layout was visually inspected; temporary Event/Wiki,
grant/membership and audit/action fixtures were cleaned up and the test server
stopped. Normal typecheck/build, the isolated demo production build and targeted
lint pass. Normal build output is isolated to preserve the running development
server. All six completed dashboard source blocks/references are removed;
preservation verification reports 287 references,
ten deferred specifications and twenty pending features. Remaining English/calendar
chrome follows the A1 exception.

The complete-suite run still reports 206 failed tests and ten suite-load failures,
including unscoped authorization/account/setlist fixtures, deferred-domain and
date-policy contracts; the runner stops before the later jsdom batches. Focused
passes do not establish A1 readiness. That checkpoint passed 1823 tests and skipped
645; native cases require the explicit MariaDB test environment, including the
eighteen new dashboard Event/notice cases and three reactivated transport cases.
Updated account fixtures change
which legacy assertions reach the missing
GlobalRole/designation prerequisites; those changed failures reproduce on baseline
`bce53c20` product code with the same fixture. Newly introduced projection,
translation-read and CommonJS import-order failures were fixed; date probes and
the retained named-view tests pass. The remaining failures still prevent A1
acceptance. Earlier unrelated browser/download evidence remains recorded evidence.

The Event search follow-up passes 144 focused checks in eight files, 328 native
MariaDB cases in twenty-three files and both three-population performance runs.
Typed page projection, normal HTTP relevance input, filter/facet/count composition,
registered mode/view restrictions and fresh page-reader revocation are covered.
Normal typecheck, targeted lint and the isolated normal production build pass.
An unused `Permission` import in the account-notice file was removed after the
production build identified it.
The complete-suite rerun retains 206
failed tests and ten suite-load failures, with 1828 passed and 650 skipped; the new
native cases and opt-in benchmark account for the additional skipped tests.
Failure-title comparison against the preceding dashboard run adds or removes no
failures.
Preservation verification retains 287 references, ten deferred specifications and
twenty pending features. A1/B remain open.

The global shell-search checkpoint (2026-10-10) passes normal typecheck, targeted
lint, a normal production build with isolated output, 132 focused tests across
eight files and 351 native MariaDB tests across twenty-four files. The 23 new native
cases cover four domains, ranking/candidate/result limits, type/authored/date
grammar, contextual public links, two bands, inherited/blank/ordered-language
instrument labels, independently visible current Wiki content, malformed pointers,
exclusive DST day boundaries and fresh grant/account/membership/band revocation.
HTTP and jsdom checks cover strict permission policy, uncached errors, query aborts,
scope changes, authority refresh, keyboard/click/clear/Escape and delayed selections.

Seven built Chromium groups pass on disposable two-band data: French ranked
results and contextual links; actual keyboard detail navigation; prefixes/Escape/
clear/mouse Instrument navigation; retired-content refresh; actual read-grant
revocation; shared-person band switch with an old request in flight and independent
Dutch results; no-band/anonymous control and HTTP boundaries. No uncaught page,
RPC or unexpected search errors occurred. French/Dutch layouts were visually
inspected; temporary content, instruments, localized strings, grants and actions
were cleaned up and the test server stopped. The restored component's missing
React import was fixed. Preservation verification reports 285 source references,
ten deferred specifications and nineteen pending features after closing only
`global-search`.

The complete-suite rerun retains 206 failed tests and ten suite-load failures,
with 1838 passed and 673 skipped; the runner stops before later jsdom batches and
native cases need their disposable MariaDB environment. Failure-title comparison
against the preceding Event-search run adds or removes no failures. A1/B remain
open; focused/native/browser success does not close those broader failures.

The association-selection/explorer checkpoint (2026-10-10) passes normal
typecheck, targeted lint, a normal production build with isolated output, 119
focused tests across ten files and 398 native MariaDB tests across twenty-six
files. The eighteen new native cases cover selected-band active people,
name-only/type-prefix matching, public contextual profile links, private DTO
boundaries, candidate/result limits, independent platform/roleless/second-band
reads and fresh grant/role/membership/account/band revocation. All three planner
association positions persist the picked person and reject changed eligibility
without mutating stored plans or audit rows. Twelve new jsdom cases cover inline
selection/clear/keyboard behavior, the query threshold, failures and stale
query/band/language/authority/presentation responses, actual person autocomplete,
the explorer's probes/inspectors/diagnostics and no-band/current-admin boundaries.

Eight built Chromium groups pass on disposable two-band data: the original
explorer's match probes, actual filter/result console inspectors, ranked domains
and person exclusions; explicit no-band notice; French planner column links,
threshold/keyboard/mouse/clear and persistence with authored draft data; Event/Wiki
column/Song-LED saves; actual search-grant revocation with a pending response;
reference-membership revocation and rejected-save rollback/draft preservation;
pending-query band switch and an independent Dutch planner save; fresh member/
anonymous explorer denial and uncached anonymous person search. The browser found
and verified the shared session inspector-preference fix for GlobalRole
administrators; four added authorization cases cover both preference values,
role revocation and forged cookie/band grants. No uncaught page, unexpected RPC
or search errors occurred. French/Dutch explorer, column and LED layouts were
visually inspected. Temporary content, memberships, planner grants, actions and
audits were removed, the original search grant/administrator role were verified
intact, and the owned test server stopped. Evidence is in
`temp/association-search-browser-result.json` and
`temp/association-search-browser-cleanup.json`.

The complete-suite rerun retains 206 failed tests and ten suite-load failures,
with 1841 passed and 691 skipped. Its normalized failure titles add or remove
none against the preceding shell-search run. The runner stops before later
jsdom batches; native cases require their disposable MariaDB environment.
Preservation verification retains 285 source references, ten deferred
specifications and nineteen pending features. The full `quick-search` obligation,
Markdown suggestions, localized tag-name matching and A1/B remain open.

The Markdown-suggestion checkpoint (2026-10-10) passes normal typecheck, targeted
lint, a normal production build with isolated output, 175 focused checks across
sixteen files and 103 native MariaDB checks across five files. Twenty-seven new
jsdom cases exercise the actual textarea library and dialogs: bracket/type grammar,
ordered preferences/public identities, canonical output, keyboard/mouse selection,
manual links/local classes, captions, cancellation/reopen, undo, denied-request
recovery, old-token responses, visible/pending band/language/authority/presentation
changes, changed insertion points and selection awaiting telemetry. Person-renderer
coverage verifies public contextual profile links. Native coverage retains current
Wiki/Song/person visibility, membership/role/grant revocation, privacy and independent
band reads; it uses a newly created and dropped disposable MariaDB database.

Eight built Chromium groups pass on disposable two-band data: French Wiki/mention
shortcuts, prefixes, keyboard/clear behavior, captions, preview links and undo/redo;
existing-person caption editing and manual nonexistent Wiki links; inline Song/
Wiki/person keyboard/mouse selection and real Song persistence; an older held
token response and Escape; actual search-grant revocation before confirmation,
draft/caption preservation and recovery; a pending-response band switch with
independent Dutch labels/content and save; a public Song mention saved through the
locked Wiki editor into a new revision; and uncached anonymous Wiki rejection.
The built run identified the textarea library's required stable choice key when
an outdated output rejects selection; that fix is covered by the changed-caret
case and the rebuilt browser run. No uncaught page, unexpected RPC or search errors
occurred. French/Dutch editor/dialog layouts were visually inspected. Temporary
content, memberships, localized labels, grants, actions and audits were removed,
and the owned test server stopped. Evidence is in
`temp/markdown-reference-browser-result.json` and
`temp/markdown-reference-browser-cleanup.json`.

The complete-suite rerun retains 206 failed tests and ten suite-load failures,
with 1842 passed and 691 skipped. Its 164 normalized failure titles add or remove
none against the association-selection baseline. The runner stops before later
jsdom batches; native cases require their disposable MariaDB environment.
Preservation verification retains 285 source references, ten deferred
specifications and nineteen pending features. Full localized tag-name matching
keeps `quick-search` pending; all its archives remain intact. A1/B remain open.

The Markdown-attachment checkpoint (2026-10-10) passes normal typecheck, targeted
lint and a normal production build with isolated output. Focused coverage passes
162 checks across thirteen files, including 23 attachment cases in the actual
editor, chooser, textarea and undo controls. They cover batch selection/progress,
paste/drop/URL insertion, text/HTML/raw paste, failure/retry, literal captions,
external URL syntax, explicit visibility, ungranted/local/readonly/anonymous
controls, telemetry failure, draft changes, fullscreen remounts, unmounting and
band/language/authority/association/presentation cancellation. Transport cases
cover cancellation before sending, during upload and after completion. All 106
native MariaDB checks across seven files pass on a newly created/dropped database,
including Wiki association visibility revocation and existing upload/image
processing, commit rollback, storage cleanup and two-band authorization cases.

Nine built Chromium groups pass: French multi-file chooser with real PDF/image
bytes, public associations, 750px metadata, literal captions, undo/redo and
contextual downloads; native clipboard image paste and file/URL drops with exact
Song persistence; actual HTML/raw paste and undo; invalid-image batch rollback of
File/association/audit/storage with a preserved draft and retry; fresh upload
revocation; fresh parent visibility revocation before copying files; pending
presentation cancellation followed by independent Dutch labels/ownership/save
and a contextual saved reference after reload; a locked Event-description Wiki
upload with both Wiki/Event associations and exact saved revision; and uncached
anonymous rejection. No uncaught page or unexpected RPC errors occurred. French
and Dutch layouts were visually inspected. Created content/files, localized
labels, grants, actions, audits and the private upload directory were cleaned up;
the owned server stopped. Evidence is in
`temp/markdown-attachments-browser-result.json`.

The complete suite retains 206 failed tests and ten suite-load failures, with
1845 passed and 692 skipped. Its 164 normalized failure titles add or remove none
against the Markdown-suggestion baseline. The runner stops before later jsdom
batches; native cases require their disposable MariaDB environment. Preservation
verification retains 285 source references, ten deferred specifications and
nineteen pending features. `file-creation`, `markdown-editing` and A1/B remain open.

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

The **profile and branding upload checkpoint** passes normal typecheck, targeted
lint, the normal production build with isolated output and 181 focused checks
across fourteen files. These include 21 new branding UI cases, brand cache/loading,
page bootstrap freshness, settings authorization/editor/lifecycle, upload transport,
Markdown attachments, profile ownership, presentation navigation and preservation.
Seven new native branding cases plus retained settings/File/image/profile coverage
pass 63 MariaDB checks in five files. PNG/SVG/ICO bytes, available image metadata,
public/foreign-band reads, blank/reset semantics, no membership associations,
independent roles, fresh upload/publication revocation and storage/processing/commit
rollback are exercised. Private native databases and storage fixtures are removed.

Ten built Chromium groups pass chooser/batch, native clipboard and SVG drop,
direct-URL paste/drop, explicit save/cancel/clear/reset and immediate header reload.
They verify public bytes and foreign/missing-band 404s, actual ICO pixels,
French/Dutch labels and independent publications, a held request during band
switch, fresh grants revoked in already-open forms, real multipart batch rollback
and no-store anonymous 401. Both profiles preserve the same shared identity and
Files have no membership tags. No uncaught page or unexpected RPC errors occur;
French/Dutch layouts are visually inspected. Owned Files, settings, localized
labels, grants, actions, audits and private storage are cleaned up, and the owned
server is stopped. Evidence is in `temp/branding-uploads-browser-result.json`.

The complete suite retains 206 failed tests and ten suite-load failures, with
1846 passed and 699 skipped. Its 164 normalized failure titles add or remove none
against the Markdown-attachment checkpoint. Preservation verification retains
285 source references, ten deferred specifications and nineteen pending features.
No source archive/specification is removed or feature prematurely marked complete.

The **localized Markdown editing and page-help checkpoint** passes normal
typecheck, targeted lint, a normal production build with isolated output and 202
focused checks across fifteen files. These include twelve new static-string owner
cases, 22 new editor DOM cases, a real Markdown toolbar transition regression,
exact localization/settings, references/attachments, presentation changes, existing
dashboard/dialog/field callers, branding controls and preservation. Seven new native
translation cases plus retained localization/File/branding checks pass 31 MariaDB
checks in four files. They verify native indexed/blob storage, Unicode/long values,
blank/reset semantics, exact scope isolation, fresh authority and locale revocation,
person audits/noops and transactional rollback. Private native databases are removed.

Seven built Chromium groups pass inline edit/cancel/save/save-and-close, intentional
blank versus inherited display and explicit reset/reload, French/Dutch registered
Wiki help and an unregistered path, independent writing-language selection, fresh
revocation with failed-draft retry, actual PDF insertion/save/contextual public
download, a held exact-locale read across a band switch, and a Songs list-help
save/reload. No uncaught page or unexpected RPC errors occur. French/Dutch reader
and editor layouts are visually inspected. Owned content/global fallback rows,
labels, grants, Files, actions, audits and private storage are restored/cleaned up;
the owned server is stopped. Evidence is in
`temp/localized-markdown-browser-result.json`.

The complete suite retains 206 failed tests and ten suite-load failures, with 1858
passed and 706 skipped. Its 164 normalized failure titles add or remove none
against the branding-upload checkpoint. The runner stops before later jsdom batches.
The separately selected legacy `domainSelection.test.ts` still cannot load because
its RPC mock omits `BlitzRpcPlugin`; the same failure is reproduced against unchanged
HEAD source in the isolated checkout. Its fixture repair belongs to the remaining
picker parity work. Preservation verifies 283 source references, ten deferred
specifications and eighteen pending features. Only `markdown-editing` is closed;
File/settings parity audits, broader translation tooling and A1/B remain open.

The **File-creation parity and preservation checkpoint** passes normal typecheck,
targeted lint, a normal production build with isolated output, and 238 focused
checks across thirteen files. All seven preserved image authorization cases now
run, and the existing direct/private/HTML delivery cases use current band grants.
The focused run also retains upload HTTP/transport, image geometry/RPC, gallery,
creation controls, Markdown/branding/editor, page authorization, service-owned
creation and preservation coverage. The obsolete disabled-bake placeholder test is
removed along with its unused component.

Native MariaDB and physical-storage checks pass 128 cases across eight files,
including eleven new upload cases for byte preservation, exact/long/narrow resize
boundaries, JPEG child identity and public relationships, EXIF orientation,
upload-only roles, trusted-parent ownership and failed child insert/audit/commit
rollback. Existing upload, image fork, gallery, branding, File associations/catalogs/
search and shared-person profile checks pass. Private databases are removed.

Eleven built Chromium groups pass actual French/Dutch chooser, clipboard image
paste, file/URL drop and undo/raw paste; original and resized JPEG downloads;
contextual public-ID navigation between original/child File details; long/narrow
image preservation; actual Song and locked Event-description Wiki saves; fresh
upload and parent-visibility revocation; stale presentation/band switches;
anonymous rejection; and a failed batch after a successful original/child pair.
No uncaught page or unexpected RPC errors occur. Native fixture checks verify
content, labels, grants, original/child Files, actions, audits and private storage
cleanup; the owned server is stopped. The browser harness also tracks clipboard
originals through its private storage leaves. Evidence is in
`temp/file-parity-browser-result.json` and `temp/file-parity-cleanup-inspection.json`.

The complete suite has 203 failed tests and ten suite-load failures, 1868 passed
and 717 skipped. Its 163 normalized failure titles add none against the localized
Markdown checkpoint; the removed File delivery failure group contained the three
now-passing fixtures. The runner still stops before later jsdom batches. Preservation
verifies 243 source references, ten whole-file deferred specifications and seventeen
pending features. Only `file-creation` is closed in this slice; settings parity,
broader translation tooling, other feature obligations and A1/B remain open.

The **settings-editor parity and preservation checkpoint** passes normal typecheck,
targeted lint and a normal production build with isolated output. Its 276 focused
cases across sixteen files include the three reactivated specifications, registered
editors/clipboard, both mounted calendar controls and failed saves, brand loading/
lifecycle/uploads, fresh page/key authority, strict timezone writes/loading and
preservation. Branding validation also rejects padded colors and uppercase color
functions that MUI cannot apply. Native MariaDB checks pass 36 cases across five files, covering
independent text color and blank/reset, shared account preferences versus membership
locales, revoked per-key batches, native JSON migration, branding Files, personalized
feeds and the retained transactional time-zone/DST/rollback/migration specifications.
Private native databases are removed.

Ten built Chromium groups pass French/Dutch branding color validation/cancel/save/
clear/reset/reload, DST reanchor/reset with timed/foreign-band preservation, stale
Save rejection and focus-driven per-key controls with retained drafts/retry, typed
clipboard copy/import and invalid-batch no-write, both preferences through settings
and localized profile controls, independent normalized membership locales/account
reset, color-draft discard on band switch, role-carried platform enum save/reset
without a band or legacy Sysadmin flag, independent other-account preferences and
anonymous denial. French/Dutch color-editor layouts are visually inspected. No
uncaught page or unexpected RPC errors occur. Original settings, labels, grants,
Event/segment rows and revisions are restored; fixture Events, actions and audits
are removed, and the owned server is stopped. Evidence is in
`temp/settings-parity-browser-result.json`.

The complete suite retains 203 failed tests and ten suite-load failures, with 1943
passed and 720 skipped. Its 163 normalized failure labels add or remove none versus
the File checkpoint; the runner still stops before later jsdom batches, which pass
in the focused run. Preservation verifies 224 references, seven whole-file deferred
specifications and sixteen pending features. Only `settings-editors` is closed in
this slice; production inventory/rehearsal, other obligations and A1/B remain open.

The **catalog-help parity and preservation checkpoint** passes normal typecheck,
targeted lint, a normal production build with isolated output, 140 focused cases
across seven files and 19 native MariaDB cases across three files. Existing
specifications cover registered translation ownership, strict writes, fallback,
blank/reset, failed saves/retry, context changes, localized catalog columns/view
contracts and native Song Tag CRUD/privacy/audits. No redundant page-composition
test is added; the actual built page establishes that composition.

Five production Chromium groups pass French inherited help above the catalog,
empty exact drafts/cancel/intentional blank/reload/reset; independent language and
band save/reload; fresh grant rejection, focus-driven help disablement and retained
draft retry alongside catalog editing/cancel; actual band-switch draft discard
and unscoped HTTP 403; and anonymous sign-in without help or catalog editors.
French/Dutch layouts are visually inspected. No uncaught page or unexpected RPC
errors occur. Original platform/band translations are restored exactly; fixture
tags, dependent dynamic values, grants, enabled locales, sessions, actions and
audits are removed, the private native database is dropped, and the owned server
is stopped. Evidence is in `temp/catalog-help-browser-result.json`.

The complete suite retains 203 failed tests and ten suite-load failures, with
1943 passed and 720 skipped. Its 163 normalized failure labels add or remove none
versus the settings checkpoint; later jsdom batches still require the focused
run. Preservation verifies 223 references, seven deferred specifications and
fifteen pending features. Only `catalog-help` is closed; production inventory/
rehearsal, localized-name search, other obligations and A1/B remain open.

The **activity-report timeline checkpoint** passes normal typecheck, targeted lint
and a normal production build with isolated output. Its 239 focused cases across
eight files cover strict public context/filter/date contracts, calendar arithmetic
and DST periods, mounted late-response/refresh/error handling, actual report
calendar selection/localization/highlight ownership, page policy, retained guards
and existing date-display/calendar-window consumers. Two obsolete timeline guard
cases are removed because that RPC is active; all remaining report guards and
the preserved detail-redaction specification remain intact.

Native MariaDB checks pass 29 cases across the timeline and membership-role
suites. They verify two-band counts, exclusion of unowned Actions, aggregate-only
payloads, anonymous/current-person/both administrator policies, parameterized
feature/context filters, exact half-open boundaries, all six buckets, ISO
week-year/local year boundaries, spring/autumn DST and fresh grant/permission/
membership/role/account/merge/band revocation before aggregation. Platform
authority requires an explicit band. The unchanged role-continuity tests verify
the shared administrator predicate extraction; the private database is removed.

Seven built Chromium groups pass French/Dutch controls/counts/dates, both timezone
policies, actual calendar selection, feature/context/date/bucket controls,
selection/clear, Refresh, the real band chooser and a held old-band response,
fresh grant rejection/chart removal/retry, report-only calendar access without
Event requests, role-carried platform access/unscoped notice and anonymous
page/RPC rejection. Successful payloads contain no person/entity identities or
private routes/query text. French/Dutch charts are visually inspected. No uncaught
page or unexpected RPC errors occur. Original translations, timezone settings
and membership role/timestamps are restored; fixture role/string/grants/locales,
sessions, actions and audits are removed, and the owned server is stopped.
Evidence is in `temp/activity-timeline-browser-result.json`.

The complete suite retains 203 failed tests and ten suite-load failures, with
1969 passed and 737 skipped. Its 163 normalized failure labels add or remove
none versus the catalog-help checkpoint; later jsdom batches still require the
focused run. Preservation remains at 223 references, seven deferred
specifications and fifteen pending features. All 28 activity references remain;
facets, detail rows/redaction and CSV are the next slice. Full report parity,
production inventory/rehearsal, other obligations and A1/B stay open.

The **activity-report aggregate facet checkpoint** passes normal typecheck,
targeted lint and a normal production build with isolated output. Its 143 focused
cases across seven files cover strict facet inputs, band-calendar bucket selection,
ISO week-year and DST, token scope, immutable isolate/hide/clear controls, mounted
sorting/filter actions, late replies, refresh/denial/retry and same-input presentation
refreshes, alongside timeline/date-picker/page policy and the retained guards.
Two obsolete facet-RPC guard cases are removed because that reader is active;
three detail/export readers and the actual detail-redaction specification remain
guarded/preserved.

Native MariaDB passes 53 cases across the facet, timeline and membership-role
suites, including 24 new facet cases. These verify all sixteen groups, all seven
additional scalar filter families, all five public reference filters and precedence,
literal context metacharacters, NULL dimensions/authors, both administrator policies,
public projections and private/deleted/foreign references, intentional blanks,
forged filters, independent entity/report grants, exact repeated/missing DST hours
and timezone refresh. Fresh grant/permission/membership/role/account/merge/band
revocations reject before aggregation. One shared person's two memberships have
independent totals/token scopes; platform readers require explicit selected-band
context. The private database is removed after the run.

Nine built Chromium groups verify the preserved timeline controls plus facet
sorting, Song isolation, browser hiding/removal, anonymized person groups,
authorized/localized French/Dutch reference labels and two reporting timezones.
Held old-band replies cannot replace either timeline or facets. Fresh report
revocation removes both loaded results; restoration permits Refresh. The report-only
calendar boundary, role-carried platform authority and anonymous page/RPC rejection
remain covered. Successful facet payloads expose no person identifiers, private
routes/query text or link targets. No uncaught page or unexpected RPC errors occur.
French/Dutch distribution screenshots are visually inspected. Translations,
timezone settings and membership role/timestamps are restored; fixture references,
localized strings, grants/locales/roles, sessions, Actions and audits are removed,
and the owned server is stopped. Evidence is in
`temp/activity-facets-browser-result.json`.

The complete suite retains 203 failed tests and ten suite-load failures, with
1996 passed and 761 skipped. All 163 normalized failure labels are unchanged
versus the timeline checkpoint; later jsdom batches still require the focused
run. Preservation verifies 223 references, seven deferred specifications and
fifteen pending features. All 28 activity references remain until domain chips,
Event reference metadata, detail/ledger projections and CSV are restored and the
actual deferred redaction specification is reactivated. Full activity report
parity, production inventory/rehearsal, other obligations and A1/B remain open.

The **activity-report ledger checkpoint** passes normal typecheck, targeted lint
and a normal production build with isolated output. Its 178 focused cases across
nine files cover strict detail selection, explicit projections and safe historical
contexts, timestamp/metadata presentation, mounted ledger/drill-down composition,
row filter actions, truncation, fresh denial/retry, late replies and same-input
invalidation alongside the retained timeline/facet/date-picker/page/guard checks.
The reactivated identity specification contributes 25 executable cases; the new
mounted detail suite contributes twelve. The shared CMButton forwards
`aria-expanded`, verified through the real drill-down button's mounted state.

Native MariaDB passes 76 cases across four suites, including 23 new detail cases.
These verify the stable newest-200 limit and exact total, all seven scalar
drill-downs, public reference/filter intersections and literal SQL metacharacters,
private/deleted/foreign/hard-deleted references and intentional localized blanks.
Rows correlate with facet person tokens without leaking person IDs or saved
query/URL metadata. Hidden reference drill-downs match nothing; separate reference
and report grants refresh before reads. Anonymous authors, both administrator
policies, explicit platform band context, a shared person's two memberships,
half-open dates and repeated/skipped DST hours remain covered. The disposable
native database is removed.

Thirteen built Chromium groups retain the prior timeline/facet controls and add
default ledger navigation, localized French/Dutch rows and related-chip filtering,
per-facet lazy detail loading, consistent tokens across separately bundled RPCs,
identicons and safe profile contexts. A Tokyo browser shows Brussels report/Event
dates correctly; Dutch second-band rows use Tokyo. Held old-band replies cannot
replace timeline, facets or detail rows. Fresh report revocation removes mounted
results and rejects a captured detail RPC; restoration permits Refresh. Anonymous
requests to all three active report RPCs fail. Successful facet/detail payloads
contain no shared-person/membership identities, private reference names or saved
URLs/search text. No uncaught page or unexpected RPC errors occur. French/Dutch
ledger and drill-down screenshots are visually reviewed after the layout fix.
Translations, timezone settings and membership roles/timestamps are restored;
fixture references, localized strings, grants/locales/roles, sessions, Actions and
audits are removed and the owned server is stopped. Evidence is in
`temp/activity-details-browser-result.json`.

The complete suite still has 203 failed tests and ten suite-load failures; all 163
normalized failure labels are unchanged from the facet checkpoint. It has 2019
passed and 784 skipped. Later jsdom batches still need the focused run. Preservation
verifies 222 references, six whole-file deferred specifications and fifteen pending
features. Activity reports retain 27 references with the actual identity spec now
active. At that checkpoint, remaining detail metadata/references, general detail
and CSV, other parity obligations, production inventory/rehearsal and A1/B remained
open.

The **activity-report auxiliary-reference checkpoint** passes normal typecheck,
targeted lint and a normal production build with isolated output. Its 203 focused
cases across ten files retain timeline/facet/date-picker/page/guard coverage and
the eight existing SetlistPlan authorization cases. The actual identity spec now
has 32 executable cases, including literal breadcrumb prefixes and auxiliary-ID
redaction; the mounted detail suite has 22, including eight reference families,
all eight scalar hide actions and exact parent-prefix clicks.

Native MariaDB passes 111 cases across seven suites, including 22 auxiliary
reference cases and the existing detail/facet/timeline/membership/event-catalog/
credit-type checks. These cover inherited names/colors and blank overrides,
global catalogs, inactive attendance, hidden/private/deleted/foreign/hard-deleted
references, independent parent visibility and all eight reference-field denials.
A denied group color withholds its Instrument too. Report membership and
independent File/Event/plan/catalog grants refresh before each read, including
public-role grant sources, restoration/retry and two-band identity/label isolation.
The disposable database is removed.

The separate instrument-catalog suite still has its existing Event-read rejection
assertion failure (eight cases pass). The same failure reproduces in the prior
ledger build, before this slice, so it remains an unrelated test obligation.
The full suite retains 203 failed tests and ten suite-load failures, with all 163
normalized failure labels unchanged; it now has 2026 passed and 806 skipped.
Later jsdom batches are covered by the focused run. Preservation still verifies
222 references, six whole-file deferred specifications and fifteen pending
features; all 27 activity references remain.

Seventeen built Chromium groups retain the prior timeline/facet/detail checks
and add all eight authorized auxiliary references, literal context breadcrumbs,
row hide/clear controls and independent plan-grant revocation/restoration. French
River Fanfare rows use Brussels dates; Dutch Harbour Brass rows use Tokyo dates
and the second band's instrument identity/name. File navigation carries the
current band and route locale to the public landing page. Private/deleted/foreign
references, denied parents and unrelated band labels stay absent. Successful
detail payloads contain no storage paths, external URLs, person fields or private
reference metadata. The existing held old-band replies, fresh report revocation,
retry, token correlation and anonymous RPC checks also pass. No uncaught page or
unexpected RPC errors occur.

French/Dutch ledger screenshots are visually reviewed after fixing breadcrumb
wrapping between complete labels. Strings, settings and membership roles are
restored; fixture grants/locales/roles, references, localized strings, Actions,
audits and sessions are removed. The owned server is stopped and the user's
development server is untouched. Evidence is in
`temp/activity-references-browser-result.json`, with ledger screenshots in
`temp/activity-references-ledger-fr.png` and
`temp/activity-references-ledger-nl.png`. Saved query/URL disclosure, the general
detail reader and CSV remain pending; the two RPC guards and activity reports/A1/B
remain open.

The **activity-report metadata/CSV closure** passes normal typecheck, targeted
lint across all 37 changed TypeScript files and a normal production build with
isolated output. Its 288 focused cases across thirteen files cover strict
general/CSV requests, saved-metadata disclosure, stable CSV headers and quoting,
formula protection, download resource cleanup, confirmation/progress/error/retry,
stale selection/band/refresh/unmounted replies and the retained timeline/facet/
ledger/date-picker/page/authorization checks. Four obsolete remaining-RPC guard
tests are removed. The seven archived raw-relation projection/link-filter cases
are superseded by executable public-identity and request-boundary coverage.

Native MariaDB passes 122 cases across eight suites, including eleven new export
cases. Ledger/general/CSV share all thirteen authorized reference families,
localized labels, tokens and selection filters. Tests cover the original
200/1,000/20,000 limits against 20,003 rows, exact totals/stable ordering, private/
deleted/foreign metadata, fresh independent reference/report revocation, inactive
membership, two-band isolation, anonymous authors, self exclusion and both
platform-administrator policies. The disposable native database is removed.

Twenty-three built Chromium groups retain the prior report controls and add
safe saved routes/search fragments, the general reader, localized confirmation/
progress/count dialogs and four real CSV downloads. Downloaded bytes verify the
UTF-8 marker, all 47 stable headers, Unicode/commas/quotes/newlines, public related
identities, scoped row tokens, empty storage targets and formula protection.
French River Fanfare uses Brussels report dates; Dutch Harbour Brass uses Tokyo
dates from the same person's independent membership. Held old-band CSV replies
cannot download, freshly revoked grants reject captured general/CSV requests and
anonymous requests to all five active report RPCs fail. A 20,003-action fixture
also verifies the 1,000/20,000 caps, exact totals and order through the built RPCs.
No uncaught page or unexpected RPC errors occur.

French/Dutch export-dialog screenshots and the French saved-metadata ledger are
visually reviewed. Strings, settings and membership roles are restored; owned
fixture grants/locales/roles, references, localized strings, Actions, audits and
sessions are removed. The owned server is stopped and the user's development
server is untouched. Evidence is in `temp/activity-export-browser-result.json`,
with screenshots in `temp/activity-export-dialog-fr.png`,
`temp/activity-export-dialog-nl.png` and `temp/activity-export-metadata-fr.png`.

The complete suite retains 203 failed tests and ten suite-load failures, with
2,100 passed and 817 skipped. All 163 normalized failure labels are unchanged
from the auxiliary-reference checkpoint; later jsdom batches are covered by the
focused run. Preservation verifies 195 references, six whole-file deferred
specifications and fourteen pending features after all 27 activity source
blocks/reference entries and the unused recovery flag are removed. Activity
reports are restored; other feature parity, production inventory/rehearsal and
A1/B remain open.
