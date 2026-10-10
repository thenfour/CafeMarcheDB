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
while profile/branding and general-gallery callers are pending. Localized Markdown
editing/help and full localized-name matching retain their separate obligations;
this checkpoint does not close `file-creation`, `markdown-editing` or A1/B.

## Next slice: profile and branding uploads

Trace and restore the original profile/branding upload callers through the current
band-owned File and image services. Keep shared-person identity separate from band
membership associations and carry explicit owner, band and visibility policy.
Retain chooser/paste/drop, image processing and existing publication/save behavior;
verify independent bands/locales, fresh revocation, failed processing/rollback,
storage cleanup and actual built-browser saves before enabling each caller.

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
| Supporting workflows | Retain restored dashboard announcements/relevant Events/calendar/custom navigation, global shell search, planner association selection/protected explorer, Markdown suggestions/attachments, Wiki readers/search, plans, calendars/feeds/tokens and Custom Links; finish localized Markdown editing/help, exports, telemetry and jobs used by core workflows. Account explicitly for remaining gaps. |

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
