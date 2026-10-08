# Preserving features during application recovery

Temporary isolation must preserve the original implementation and behavioral
tests as searchable source. A smaller replacement does not establish feature
parity. This applies to partial removals as well as deleted modules.

## Parity reference and source provenance

The functional/UX reference is
`f027830a9790ab2bf015805ef765775a9e40de55`. Production database migration has a
different source, `094a783a94b95ed4ec15089e9372763b7d59f66c`; see the
[baseline contract](00-design%20notes.md#baselines-and-restoration-target).
In CafeMarche hosting mode, restoration preserves the reference screens,
interactions and capabilities on the target schema. Keep safe later fixes and
the migrated ownership/authorization contracts.

Each reference block's `Source` commit identifies the exact code archived during
isolation. Those later snapshots are useful adaptation material; they do not
redefine parity or establish that every reference feature was preserved. Before
working on an obligation, compare its archived/current implementation with the
relevant `f027830a9790` pages, shared components, server owners and tests. Account
for missing behavior even when it has no archived block. Do not rewrite source
headers, hashes or archived code merely to make their commit match the parity
baseline.

Record acceptance as reference behavior retained, schema-driven differences,
approved exceptions, executable regression coverage and built-browser evidence.
Restore the existing UI/query path; a new basic page with passing tests cannot
close a rich reference workflow. Partial checkpoints leave gaps visible and the
owning obligations open.

The [A1 search exception](04-implementation-plan.md#localized-catalog-text-search-exception)
defers only free-text matching against localized catalog names, while retaining
catalog filters/facets, presets, URL state, sorting, exports and familiar result
and detail presentation. Full chrome localization is not required for parity.
The corresponding localized-name search work remains pending after A1, not
retired. Historical reference headers state the original restoration obligation;
the current plan governs delivery order and this narrow exception.

## Preserved source procedure

Search the reference blocks with:

```powershell
rg -n '^// MIGRATION_RESTORE:' src shared db tests
yarn migration:status
```

Each block has a stable feature ID, the full source commit, original path and
line range, the reason for isolation, restoration and verification criteria,
and a SHA256 checksum. The original source is prefixed with line comments,
including its imports and existing comments. Line endings and trailing spaces
are normalized; source statements are retained. Small modules are preserved in
full. Larger shared files preserve the affected statements and surrounding
context, covering every removed line in the audited pending code changes.

Keep references at their original paths or beside the active replacement.
Do not recreate a deleted RPC endpoint merely to store reference code, or add a
`.ts` file that would shadow an active `.tsx` replacement. The preserved
primary-instrument RPC is beside the membership command, for example.

The [reference inventory](feature-restoration.json) records each block
independently and pins both baselines plus the canonical restoration contract.
`yarn migration:verify` checks the inventory, source ranges,
checksums, and deferred test isolation. Deleting a file/block or changing its
content fails this check. The normal test runner performs the same check before
running tests. Neither compiler exclusions nor TypeScript suppressions are used.

## Current restoration obligations

For the search obligations below, localized-name matching is the full completion
target. Its A1 timing follows the narrow exception above; all other reference
search behavior remains required. Feature status stays pending while any part of
that obligation is unfinished.

| Feature ID                  | Behavior to recover or verify                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `directory-search`          | Multi-value tag/role/instrument filter operators, presets, URL state, contact-search permissions, CSV export and their pagination interactions.                                                                                                                                                                                                                                                                                                                   |
| `member-profile`            | Reachable attendance, credits and wiki tabs; permitted account controls; profile activity recording; supported tab URLs.                                                                                                                                                                                                                                                                                                                                          |
| `role-administration`       | GlobalRole/BandRole editors, permission matrix, designations, account assignment, protected grants and continuity safeguards.                                                                                                                                                                                                                                                                                                                                     |
| `account-merge`             | Candidate search, picker, preview and confirmation; policy-specific transfers/deduplication, credentials, sessions, rollback, stale-preview and concurrency guarantees.                                                                                                                                                                                                                                                                                           |
| `account-analysis`          | Authorized dependency counts, risk summaries and two-account comparisons.                                                                                                                                                                                                                                                                                                                                                                                         |
| `dashboard-content`         | Relevant events, calendar, announcements/wiki, custom navigation and the required reference catalogs.                                                                                                                                                                                                                                                                                                                                                             |
| `file-search`               | File quick filtering and association name ordering against resolved band tag/instrument labels, including blanks, hidden assignments, visibility and pagination. General File ownership remains a prerequisite.                                                                                                                                                                                                                                                   |
| `wiki-search`               | Wiki quick filtering by resolved band tag names and menu wiki-slug suggestions, including per-string fallback, intentional blanks, hidden assignments, visibility, consistent counts and pagination. General wiki ownership remains a prerequisite.                                                                                                                                                                                                               |
| `global-search`             | Shell search, authorized domain readers, keyboard behavior, selected-band links and cache isolation.                                                                                                                                                                                                                                                                                                                                                              |
| `quick-search`              | Public/member/administrator visibility within explicit bands; localized inherited catalogs; query grammar, all-tag/type filters, ranking/limits, public identities and context-preserving links; stale responses; association/song selection, clearing and keyboard behavior; song detail loading; Markdown wiki/mention suggestions and the protected explorer. Manual text/link editing and authored reference renderers remain active; separate domain search is tracked independently below. |
| `activity-reports`          | Activity timelines, facets, filtering, detail and CSV exports with explicit band/platform authorization, localized references, public identities and anonymization/redaction. Telemetry recording remains executable.                                                                                                                                                                                                                                             |
| `audit-log`                 | Protected audit browsing, table/user filters, historical JSON/detail links, clipboard and Markdown inspection with explicit platform/band authorization, fresh snapshots, localized references and redaction. Audit recording remains executable.                                                                                                                                                                                                                 |
| `legacy-event-song-filters` | Account for the old event/song facet RPC semantics through the existing search owner: timing/relevance, multi-tag matching, counts, localized facets, pagination and ordering with selected-band snapshots and public identities.                                                                                                                                                                                                                                 |
| `event-song-statistics`     | Event statistics, popular-song occurrences and song performance history; timing/type/status/tag controls, visualization, bucket selection, expansion and event links with fresh band-scoped authorization and localized references.                                                                                                                                                                                                                               |
| `event-import`              | Text/config parsing, dates/year overrides, band-owned defaults, membership and visible-song matching, editable preview, explicit save and saved-event history with fresh authorization, public identities, localized references and band scheduling through migrated event creation.                                                                                                                                                                              |
| `file-creation`             | Multipart/external-URL uploads, public band-owned associations, automatic Partition/Recording and instrument matching, image crop/rotate/resize and metadata processing, gallery bake, generic File creation and file/URL/paste/drop controls with fresh authorization, rollback and filesystem cleanup.                                                                                                                                                          |
| `markdown-editing`          | Inline edit/cancel/save/save-and-close, authorization, feedback and refresh against explicit translation scope and locale.                                                                                                                                                                                                                                                                                                                                        |
| `settings-editors`          | Existing settings/branding workflows through typed hives, including time-zone reanchoring and cache invalidation. Replaced storage APIs are historical references.                                                                                                                                                                                                                                                                                                |
| `catalog-help`              | Song-tag help Markdown alongside the migrated editor. Its rendering call is restored; browser verification remains pending.                                                                                                                                                                                                                                                                                                                                       |
| `demo-seeding`              | Useful sample content generators on the target schema, or an explicitly approved retirement decision for each omitted capability.                                                                                                                                                                                                                                                                                                                                 |

| `event-workflows` | Event search/detail/editing, segments, invitations, frontpage edits and date-picker event highlights through selected-band snapshots, public references and localized catalogs. Migrated creation, attendance and calendars stay active. |
| `song-workflows` | Song search/detail/editing, credits, profile-credit display and pinned recordings with fresh band authorization, visible files and public references. Narrow song lookup and plan persistence stay active. |
| `file-workflows` | File search/detail and metadata/association editing with explicit ownership, public membership/instrument references and fresh visibility. Narrow direct and Custom Link downloads stay active. |
| `public-publication` | Band-specific homepage/feed, agenda, galleries, hosting/language modes, CORS and gallery/image editing with public band routing and authorized content. |
| `domain-search` | Raw search HTTP/direct owner, localized authorized predicates/facets, consistent counts/paging/order, public identities and contextual links. Preserve the event/song and directory search specifications. |
| `developer-examples` | Protected component/grid demonstrations and interactions against recovered domain contracts. Standalone date/attendance/select/dialog tools stay active where their dependencies are migrated. |

These are recovery obligations, not instructions to uncomment obsolete Prisma
relations or restore the old authorization model. Existing migrated membership,
catalog, settings, authorization and bootstrap behavior stays active. Where a
capability already has an equivalent replacement, record the matching tests and
browser evidence instead of creating another implementation.

The demo recovery adds an explicit reset/dev/build/start workflow and target-schema
generators in `db/seeding/demo`, described in [the demo guide](../demo-seeding.md).
CLI counts/locales/seed/date control repeatable fixtures spanning shared people,
band memberships/grants, inherited/localized catalogs, wiki/menu content, songs,
usable local files, events/setlists/attendance and activity. This is useful manual
testing content; it does not establish parity with every preserved random-content
variant. `demo-seeding` remains pending, its reference blocks remain intact, and
no generator is retired. Production seed/startup behavior stays separate.

## Preserved test specifications

The final A0 route/entry-point audit adds 42 source references from `f96ac10c`.
The original event/song/file/publication pages, dedicated endpoints, raw search,
profile-credit rendering and date-picker overlay remain searchable. Three whole
specifications are newly deferred: `searchRecovery.test.ts` (14 cases),
`userSearchAuthorization.test.ts` (four cases) and
`calendarWindowConsumers.test.ts` (three cases). The original credit-read case
and two authorization expectations also remain in partial reference blocks;
active RPC tests now assert intentional unavailability. These are preserved
functional obligations, not passing tests or retired behavior.

`yarn migration:verify` now protects 319 source references and 13 wholly deferred
test specifications across 26 pending features. Ordinary-member wiki reading and
explicit-band direct downloads have native/browser evidence, while the six new
workflow obligations remain pending. A0 can close with coherent isolation; A1/B
still require their restored behavior and executable specifications.


The quick-search isolation adds eighteen references from `66c5806d` across its
global reader/plugins, HTTP route, client selectors, song picker, Markdown
suggestions and protected explorer. Their query/visibility/selection behavior is
preserved for target-model restoration. No existing behavioral test directly
invoked this reader, and no test is newly disabled. Active public-identity and
Markdown mention-rendering checks remain executable. New HTTP/helper, page-guard
and DOM checks verify intentional unavailability; they do not establish search
parity. The `quick-search` obligation is distinct from the existing deferred
shell mount under `global-search`.

The subsequent song-tag payload repair adds an authorized band-scoped
`getFilteredSongs` lookup and updates shared setlist references to the target
association model/key. Its native tests cover song/tag/pinned-file privacy and
fresh snapshots. This is partial progress toward the preserved song-detail
obligation; `quick-search` remains pending, and its original picker/suggestion
references remain intact. No additional feature or test is deferred by that
repair.

The File association payload repair preserves two additional `file-search`
references: the obsolete raw instrument-name filter and its SQL name ordering.
Target selections and client consumers now use band instruments and memberships;
native projection/hydration tests keep person and membership identities distinct.
No test is newly disabled, and the existing File creation, lookup and Custom Link
boundaries remain intact. This does not close File search or workflow recovery.

The wiki-tag catalog/payload repair preserves the former raw `tag.text` predicate
as one `wiki-search` reference. Wiki associations now target BandWikiPageTag and
public `bandWikiPageTagId` identities; their display ordering uses resolved
references. General wiki row services remain guarded. No test is newly disabled,
and catalog/native/browser evidence does not close wiki workflow or search parity.

The MenuLink recovery preserves two additional `wiki-search` references for its
old menu wiki-slug suggestion reader and compatibility-inventory entry. The editor accepts manual slugs and explains
that suggestions are unavailable; it makes no WikiPage query. Caption editing,
band-scoped CRUD/reorder and context-preserving test links remain active. No test
is disabled. Custom sidebar delivery remains a `dashboard-content` obligation.

A wholly disabled test file starts with `// MIGRATION_DEFERRED_TEST` and contains
only comments and `export {};`. The test runner verifies this with the TypeScript
parser before omitting it from execution. An import, test call, re-export or other
executable statement fails the check. The runner reports these files as deferred
specifications; it does not count them as passing tests. Selecting only deferred
files exits unsuccessfully because no executable tests ran.

Partially affected test files retain their active tests, with removed cases
preserved in reference blocks. The current RPC-unavailability tests remain useful
during isolation; they do not replace the preserved functional specifications.
When restoring a workflow, adapt its old specifications to the target model and
make them executable again. Retain the jsdom directive and normal cleanup rules
when reactivating a DOM test.

## Completion rule

Preservation verification checks the inventory/checksums and deferred-test
isolation. It does not compare runtime behavior with `f027830a9790`; reference
behavioral tests and browser comparisons supply that evidence. No feature is
closed by this documentation clarification.

`yarn migration:check` is the final B completion gate. It verifies preservation
and fails while any feature is pending. A0 and A1 may have pending features;
their existing build/browser/workflow requirements still apply.

For each restored feature, implement and verify its complete behavior, then
remove its reference blocks and inventory entries, set its feature status to
`restored`, and record concrete test/browser evidence in `evidence`. A `retired`
status additionally requires `retirementApproval` recording the user's explicit
decision. The inventory retains the feature and decision after its temporary
source references are removed. An agent must not infer retirement approval from
a smaller replacement or from permission to isolate a feature.
Delete reference-only modules when their replacements are verified. Reactivated
test files must remove the deferred-test marker and contain executable tests.

The settings-editor recovery adds five references from `14c644c1`: both obsolete
pages, the generic settings descriptor/view, and its old table-authorization
assertion. The registered editor does not close `settings-editors`: logo/text-color
and upload controls, legacy clipboard accounting, and built-browser verification
remain obligations. Existing reference blocks and deferred specifications remain
intact.

The shared-person selector/editor cleanup adds fourteen references from
`15d112e0`. They preserve the obsolete account assignment selections/descriptors,
editor, grid columns, unreachable profile/directory renderers and enrichment, and
affected command/identity/transport specifications. Active transport checks now
use BandUser associations, and the shared account command has an executable
owner-update regression. The invitation tag-assignment read dependency remains
temporary, with writes disabled. Profile/directory restoration obligations stay
pending; this cleanup does not establish full workflow parity.

The response/invitation recovery removes the obsolete UserTag/UserTagAssignment
metadata and `UserWithInstrumentsArgs`. Original descriptors and person selectors
remain in the existing references; three additional references from `0daa91f9`
preserve the invitation views and retired payload helpers. Response and invitation
joins now use membership IDs, with separate person IDs for profile/write/audit
contracts. Historical response identities remain readable through a narrow scoped
membership reference. Native, DOM and development-browser evidence verifies this
reader slice and existing invitation precedence/unanswered-response behavior.
No feature is newly deferred or closed: full event search/editing, invitation
administration and member-profile recovery obligations remain pending.

Activity-report isolation adds references from `9306d02d` for the page, five RPCs,
report-only helpers and affected specifications. Mixed public-identity files retain
their telemetry and domain tests; only the report assertions are preserved as
inactive source. The dedicated report-redaction specification uses the checked
deferred-test marker. The `activity-reports` obligation remains pending until
the complete reporting workflow is restored and verified.

The checker detects missing references and inconsistent closure records. Review
must still establish that the recorded evidence proves parity and that a
retirement decision was actually authorized.

Audit-log isolation adds fourteen references from `6ee05589` for the page, both
reference-reading RPCs, the JSON viewer, Change descriptor/payload and their
registrations, plus affected audit-specific assertions and the legacy read
inventory entry. Generic table/field authorization regressions remain executable
against the protected sign-in-method table. Existing reference blocks remain
intact. The `audit-log` obligation stays pending; recovery notices and rejection
tests establish isolation, while immutable audit writes remain active.

Legacy event/song reader isolation adds eleven references from `8fdb9fd6`.
The four RPCs, statistics page, song-history component and their obsolete API
contracts remain searchable. Shared date predicates, autocomplete payloads,
calendar helpers and the current search implementation stay executable. No
existing test directly covered these four RPCs, and no test is newly deferred.
New rejection and recovery-notice checks establish isolation, not replacement
search/report parity. Both restoration obligations remain pending.

Experimental event-import isolation adds seven references from `ced31f2c`.
They preserve the complete preview RPC/parser, page with editor/save/history,
API declarations, public-response-identity assertion and its import, old route/RPC
guard assertion and four legacy editor bindings in the compatibility inventory.
One functional preview test is newly inactive; its remaining attendance,
creation and telemetry cases stay executable. The guard now verifies Sysadmin
routing and explicit preview unavailability. No additional whole-file test is
deferred. The existing creation transaction stays executable and has native and
development-browser regression evidence. The `event-import` obligation remains
pending until the complete parser/preview/save workflow and preserved
specifications are restored and verified.

File-creation isolation adds forty references from `1bea5a73`. They preserve the
upload HTTP route/client, FileDrop controls, image-fork/gallery-bake RPCs, shared
creation/resize/metadata helpers and their imports, Markdown upload/paste/input
behavior, gallery bake hook/handler/control and seven image-authorization tests
with their fixtures/imports. The generic File insert boundary is also preserved.
The five existing download/storage cases remain executable; no whole test file
is newly deferred. New recovery tests verify rejection and inert controls, not
upload/image parity. Existing downloads, band-scoped Custom Link delivery and
migrated File-tag catalogs stay active. The `file-creation` obligation remains
pending until its complete workflows and preserved specifications are restored.

Wiki ownership recovery adds one `markdown-editing` reference for the old per-page
`WikiPage_<slug>_Markdown` injection. Those dynamic Setting keys have no registered
localization owner; this feature is considered legacy and is to be removed.

Palette/compiler recovery adds one `role-administration` reference from
`09914973`. It preserves the complete former session-hardening module, including
three consecutive-role-matrix-edit scenarios that cannot execute through the
isolated legacy matrix. Startup Sysadmin-role assertions remain executable against
`GlobalRole`/`GlobalRolePermission`; request refresh checks now use separate global,
public-band and selected-member grants. No whole specification file is newly
deferred. Palette saving and preview tools remain active through the registered
global setting; this change does not close settings/branding or role-editor parity.

## Audit scope

The initial audit covered source/test removals from the October migration history
through `ab71102f`, including `7f9b1224` and `7bcbca62`, plus the pending Role/merge
isolation changes based on `ab71102f`. Every removed line in all 67 pending code
and test files is covered by a preserved source range. The audit also recovered
earlier Markdown/settings behavior and specifications, demo generators, profile
routes, dashboard readers/home content and the shell search mount.

Changes with equivalent active owners do not create separate deferrals. In
`7bcbca62`, role delegation and continuity logic moved to
`db3BandMemberPolicy.ts`, and the warning UI moved to
`BandMemberContinuityWarning.tsx`; those implementations remain executable.
Instrument, instrument-group, song-tag and member-tag/instrument contracts have
migrated implementations and focused/native coverage. The song-tag help content
omission was found and corrected during this audit.

Automatic startup backfills were replaced by deployment SQL migrations. They
must not be reintroduced as application startup behavior. The preserved seed
code is a reference for optional sample-content generation, not permission to
replay historical production transformations or recreate the old schema.

Future isolation must add its source references, behavioral specifications and
inventory entries in the same change. This audit is a baseline for continued
recovery, not permission for later undocumented removals.
