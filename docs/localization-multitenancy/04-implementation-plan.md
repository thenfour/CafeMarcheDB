# Localization and multiband implementation plan

Accepted execution plan, 2026-10-05. This is the checklist for completing the
application work after the SQL migration. Execute the phases in order and record
validation evidence when checking an item off. Existing API scaffolding does not
count as completed behavior.

## Starting point and milestones

The target model is in [db/schema.prisma](../../db/schema.prisma). The data
migration is implemented and rehearsed; its rules and evidence are in
[03-sql-migration.md](03-sql-migration.md). That rehearsal establishes data
preservation, not application readiness or a production deployment.

At plan acceptance, the application was far from buildable under the target
model. Localization and the four settings registries/hooks were partly
scaffolded, DB3 column definitions partly required localization keys, and runtime
consumers still used the old roles, settings, catalogs, and field shapes. Phases
1–2 are now implemented; remaining domain consumers still prevent a build.

There are two delivery milestones:

| Milestone | Required outcome |
| --- | --- |
| A: migrated application works | Phases 1–4 complete. Core Café Marché workflows work on the migrated model, the app builds, authorization and band isolation are enforced, and temporary restrictions are recorded. |
| B: localization and multiband complete | Phases 5–6 complete as well. Routing, band lifecycle and management, scoped localized editing, and locale presentation work together. Deferred features are restored or explicitly accepted for retirement. |

Trusted band context and isolation belong before milestone A. Band request
boundaries must supply a public band identity. Single-band and multiband hosting
share authorization, database, and platform administration; only UX decisions
differ. There is no implicit backend default band.

Follow the settled localization and multiband policies in
[00-localization-multitenancy.md](00-localization-multitenancy.md); this checklist
turns those policies into implementation and acceptance work. The model summary
is in [01-schema.md](01-schema.md). Use the actual schema for constraints and the
SQL runbook for migration behavior; earlier illustrative models are not
additional database guarantees.

## Localization contracts

Keep three responsibilities explicit:

- **Locale preferences:** preserve the explicit route locale and browser language
  preferences, in that priority order, with the system fallback (`en-US`).
  Server request language hints supply the browser preference for initial server
  rendering. Normalize these inputs centrally and retain the requested tags;
  selecting one database-supported locale in advance can discard information.
- **String resolution:** choose a translation separately for each static key or
  dynamic string identity, using the preferences, relevant locale availability,
  band context, and that string's available values. Different strings in one
  response can resolve to different locales. Static chrome, dynamic strings, and
  inherited catalog fields share the same policy.
- **Formatting:** select a clearly named `formattingLocale` for dates, numbers,
  and similar presentation, honoring an explicit route preference before browser
  preferences and the fallback. Formatter support and database translation
  availability are separate concerns; formatting does not require a matching
  stored translation or `Locale` row. This value does not select string values.

Implement the design's
[string lookup priority / fallbacks](00-localization-multitenancy.md#string-lookup-priority--fallbacks)
for each string:

1. Requested language-region at band scope.
2. Requested language at band scope.
3. `en-US` at band scope.
4. Any translation at band scope.
5. Requested language-region at global scope, only when the band has no overrides.
6. Requested language at global scope.
7. `en-US` at global scope.
8. Any translation at global scope.

Any band override for this string prevents global fallback, including registered
English defaults that would restore the global meaning. Empty text counts as a
translation. Choose language-match and last-resort ties deterministically, and
return the selected locale, scope, and fallback reason for inspection. Avoid
special fallback rules per namespace or entity type.

Phase 2 expands the preference order within the selected scope: route exact,
route language match, then each browser preference's exact/language match in
order, then `en-US` and a deterministic last resort. Language and last-resort
ties use canonical tag order. See [06-localization-settings.md](06-localization-settings.md)
for availability, defaults, provenance, and explicit lookup contracts.

Phase 1's `resolveRequestLocale()` and `DashboardContext.locale` are provisional
single-locale scaffolding. They are not the string-resolution foundation or
evidence that these contracts are implemented. Phase 2 replaces that dashboard
contract with preserved preferences and a separate `formattingLocale`; reuse
normalization or matching helpers only where their semantics fit the design.

## Phase 1: context, authorization, and bootstrap

**Outcome:** server operations can identify their platform or band scope and
authorize against the new person/membership/role model.

**Implemented 2026-10-05.** Contracts, operation/scope inventory, permission/grant
choices, seed behavior, and validation are recorded in
[05-authorization-foundation.md](05-authorization-foundation.md). Domain queries,
writers, descriptors, and UI adaptation remain phases 3–4; the foundation does
not establish application readiness or complete isolation of legacy consumers.

- [x] Inventory affected authorization operations and identify whether each
  changes a platform resource, a shared person, or a band resource/membership.
- [x] Establish server authorization containing the authenticated person,
  resolved band when applicable, membership, and applicable grants.
  Resolve a requested band on the server; client IDs and rewrite headers are
  selection hints, not authorization.
- [x] Accept an optional band public ID: always load global/account authorization,
  and add band authorization when supplied. Support platform operations with no
  band and public band access with no membership; omit inferred/default bands.
- [x] Load global-role grants and active-band role grants with explicit scope.
  Grants from another band's membership must not authorize an operation here.
- [x] Keep band, membership, and effective band grants in the request/tab
  dashboard context. Shared session PublicData carries only band-independent
  grants and account/session state. Cover concurrent contexts sharing one session.
- [x] Keep locale selection and availability independent of authorization
  loading, refresh, and caching. Language changes reuse the same authorization
  snapshot. The completed separation does not establish preference collection,
  per-string fallback, or formatting behavior; those remain phase 2 work.
- [x] Define public, pending/roleless, and nonmember behavior explicitly. Preserve
  existing intended access without treating account creation as band membership.
  Deactivated memberships and deleted/merged people must not regain access.
- [x] Adapt signup, session authorization refresh, bootstrap, seeds, and startup
  initialization. Retire startup backfills already performed by the SQL migration.
  Keep `isSysAdmin` handling consistent with the server authorization contract.
- [x] Select the small set of additional permissions needed for known operations:
  platform catalogs/settings/localization and band settings/localization/management.
  Reuse existing capabilities where their meaning still fits. Review user
  management, role assignment, deactivation, recovery, and merge particularly
  carefully because the person is shared while membership is band-owned.
- [x] Add new permissions and selected grants in a follow-up migration and fresh
  install seeds. Keep the completed data migration's original matrices unchanged.
  Global and band role definitions/matrices remain platform-owned in V1.
- [x] Establish focused authorization fixtures with two bands, a shared person
  with different roles, an outsider, public access, and inactive memberships.

**Completion:** focused context/auth/bootstrap checks pass on the target model;
platform privileges and band privileges are distinct, including public and
inactive-account cases. The context is usable by later DB3 and settings work.

## Phase 2: localization and settings foundations

**Outcome:** clients and servers resolve strings and settings through shared,
typed, authorized APIs.

**Implemented 2026-10-06.** Contracts, transport, settings capabilities, cache
refresh behavior, and validation are recorded in
[06-localization-settings.md](06-localization-settings.md). Domain reads/DTOs
consume the batch resolver in phase 3; the foundation does not establish a
buildable application or completed portal routing.

- [x] Define typed locale-preference inputs and centralized semantic routines
  for normalization, preference priority, scope selection, and translation
  matching. Preserve route and browser preferences instead of first reducing
  them to `resolveRequestLocale()`'s single enabled locale. Keep the selection
  policy pure and testable; database access and React hooks supply its inputs.
  Wire browser/server language inputs now and accept a route hint through the
  contract; full portal route extraction follows in phase 5.
- [x] Centralize relevant-locale queries for platform and band contexts. Define
  and test how enabled/deleted locale availability constrains translation
  candidates while preserving the rule that band overrides block global fallback.
- [x] Implement per-string resolution for static keys and dynamic identities
  using the localization contracts above. Specify route/browser candidate order,
  deterministic ties, blank/missing values, and resolution provenance.
- [x] Provide explicit locale/scope lookup with fallbacks disabled for editors
  and tests. Missing translations must remain distinguishable from intentional
  empty text and inherited display values.
- [x] Implement `formattingLocale` separately from string resolution, using the
  shared preferences and formatter support. Replace the generic dashboard
  `locale`/raw-browser `userLocale` presentation contract and route date/number
  consumers through this policy. Deliver the initial preference/formatting context
  to the client so server and client presentation agree.
- [x] Supply registered English defaults for static chrome without stored
  translations. Preserve intentional blank values and band override precedence;
  record the chosen source in resolution details.
- [x] Resolve inherited catalog fields through the same mechanism. Preserve null
  versus empty text and the distinction between custom band content and global
  content. Provide resolution details for tests and the later inspection editor.
- [x] Derive plain-text and Markdown key types from registry formats. Use the
  agreed ICU MessageFormat interpolation for plain-text messages with typed
  parameters; Markdown strings do not interpolate parameters. Provide typed
  string/Markdown getters and React components backed by registered keys,
  without ad hoc inline string definitions.
- [x] Deliver the initial complete resolved UI catalog with the band and locale
  preferences used to resolve it. Client getters are synchronous only after that
  catalog is loaded.
  Missing/unloaded keys have explicit development/loading behavior rather than
  hidden network requests or silent empty-string stubs.
- [x] Batch dynamic values with authorized entity reads. Share the resolver
  between server rendering, DTO hydration, and client chrome; measure payloads
  before introducing catalog bundles or other delivery optimizations.
- [x] Implement all four settings hives: `GlobalSetting`, `BandSetting`,
  `UserSetting`, and `BandUserSetting`, with registry defaults, typed values,
  per-key read/write capabilities, and validated server mutations.
- [x] Use native Prisma JSON for all four settings value columns. Validate stored
  values directly and preserve the migrated types documented in the SQL runbook.
  Correct the latest existing migration instead of introducing another migration
  for this uninstalled schema.
- [x] Make reset explicit. Missing rows use registry defaults; valid empty
  strings, `false`, zero, and any registry-supported null value must survive.
  Keep the hives independent rather than adding an implicit inheritance chain.
- [x] Adapt server settings consumers, including branding and band timezone,
  alongside client hooks. Preserve existing timezone/date reanchoring behavior.
- [x] Partition resolved catalogs and localized query caches by band, the full
  ordered locale preferences, relevant locale availability, and applicable
  authorization/revisions. A single formatting locale is not a sufficient cache
  key. Refresh after string/settings/availability/grant/membership changes and
  prevent stale data or grants from surviving a band switch.

**Completion:** focused tests cover route/browser preferences, scope precedence,
language-region matching, deterministic ties, blank/missing values, explicit
lookup without fallbacks, formatting, settings defaults/types/reset,
authorization, and invalidation. The APIs work without depending on a component
to fetch each individual string. Matching and fallback policies are centralized
and readable independently of database, dashboard, and React orchestration.

## Phase 3: DB3 fields, xTables, and views

**Outcome:** DB3 supports the target model through reusable read/write contracts.

**In progress, reviewed 2026-10-06.** The initial band-instrument/group slice
implements the intended behavior, but duplicates or bypasses DB3's query,
validation, view, and CRUD facilities. Its architectural acceptance is incomplete;
passing the initial tests does not establish that the design should be extended.
[07-db3-band-instruments.md](07-db3-band-instruments.md) records the initial
evidence and the agreed redesign and acceptance criteria. Phase 3 and application
recovery remain incomplete.

**Settled query policy:** treat each localized field as an ordinary string field
containing its resolved value for the request. Preserve existing DB3 token/filter
semantics across quicksearch, autocomplete, and field filters. Use those same
values for display, ordering, counts, and pagination. Only effective displayed
text contributes matches. V1 performs these operations in shared server-side
memory for small catalogs, after authorized loading and batch resolution and
before counting/pagination. Locale-aware order has stable public-ID ties.
SQL/Prisma optimization is deferred, not a prerequisite for this slice.

- [ ] Rework and accept the representative instrument/group slice before
  expansion. Preserve global opt-in/inheritance, custom entries, localized
  fields, authorized list/detail reads, and editing while proving DB3 reuse.
- [ ] Implement localized and inherited values through existing DB3 field,
  query, reference, and hydration seams. Shared field operations provide the
  in-memory query behavior; table-specific readers and string matchers do not.
  Keep full ordered language preferences separate from `formattingLocale`.
- [ ] Keep validation and conversion on DB3 fields, including shared sort-order
  and color fields. Expose that validation for custom commands without copying
  constraints into catalog-specific schemas. Ordinary writes use shared CRUD;
  richer opt-in/inheritance operations compose the same validation,
  authorization, persistence, auditing, and invalidation facilities.
- [ ] Define typed Prisma args, derive view contracts with `deriveViewContract`,
  and pass them to `defineView`/`defineCrudView`. Extend shared support for
  localized/inherited dependencies and DTOs wherever this syntax needs it.
  Remove parallel hand-maintained catalog DTO/validation/hydration contracts.
- [ ] Enforce band constraints centrally for reads and writes, including
  inherited ownership. Validate referenced records against the same band inside
  the mutation transaction; the current schema does not enforce every such link.
- [ ] Put transaction policy and authorization refresh inside shared server
  execution. Callers must not need to know a catalog's isolation level or remember
  a refresh sequence. Generic DB3 entry points use declared table/field metadata
  rather than instrument-specific exceptions or unchecked column-name switches.
- [x] Add a minimal transactional dynamic-string writer so ordinary entity
  creation and name editing work before the full translation editor exists.
  Enforce format, ownership, and exactly one value storage column.
- [ ] Integrate that writer with shared field validation and persistence; its
  initial use by a bespoke instrument command is not the completed DB3 design.
- [ ] Meet the [instrument/group design acceptance criteria](07-db3-band-instruments.md#design-acceptance-criteria),
  including native DB3 UI operations and matching/count/page parity against
  equivalent ordinary string values. Preserve two-band and inheritance coverage.
- [ ] Add one other catalog, preferably a simple tag catalog, as a reuse proof.
  It should require entity/view/label declarations and genuine domain rules,
  without another reader, matcher, validator, form stack, or endpoint family
  duplicating the instrument machinery. Resolve any shared gaps before expansion.
- [ ] Apply the established patterns to other catalogs, shared global catalogs,
  people/memberships, band content, and the four settings hives. Generic settings
  editors must still use registry validation and per-key authorization.
- [ ] Replace obsolete Prisma delegates, selections, field shapes, and DTOs.
  Audit consumers of removed significance/behavior fields and retain the
  platform-owned semantics that remain; do not restore obsolete fields just to
  satisfy compilation.

**Completion:** the instrument/group slice meets the design acceptance criteria
and a second catalog demonstrates reuse of the same DB3 machinery. The remaining
descriptors and views use those contracts, with cross-band reference rejection
covered. Behavioral coverage alone does not satisfy the architectural gate.

## Phase 4: restore the application

**Outcome:** milestone A, a usable application on the migrated data model.

- [ ] Restore authentication/session consumers, dashboard/context delivery, and
  navigation first. Adapt the existing dashboard facade incrementally to expose
  platform/band authorization, locale preferences, and `formattingLocale`.
- [ ] Restore catalogs and membership workflows, then events/invitations/
  attendance, then songs, files, wiki, menus, setlist plans, search, calendars,
  exports, telemetry, and background operations. Validate each functional wave.
- [ ] Keep technical `columnName` stable and require localized keys for visible
  headers/captions/descriptions. Finish factories and renderers; remove raw column
  name/humanized-name fallbacks. Register English labels explicitly.
- [ ] Apply localized labels consistently to grids, forms, validation, dialogs,
  filter controls, and accessibility text. Tag control presentation uses explicit
  settings keys rather than legacy setting names.
- [ ] Make `LocalizedMarkdown` read-only during recovery. Remove its legacy
  inline-editor invocation and write path, while preserving migrated Markdown
  rendering. Record any further temporary restrictions in the register below.
- [ ] Adapt non-page entry points to trusted context: RPC/API, uploads/downloads,
  previews, calendar feeds/tokens, wiki and Custom Link resolution, and jobs.
  Preserve existing Café Marché URLs and serialized public-ID references.
- [ ] Generate the target client as part of coordinated development, resolve
  compilation errors, and run the build, typecheck, applicable lint checks, and
  focused tests. Run the complete repository suite at this milestone.
- [ ] Exercise core read/write workflows on a disposable migrated production
  copy and verify fresh-install/bootstrap behavior. Extend two-band fixtures
  throughout recovery; isolation cannot wait for the management UI.
- [ ] Record remaining restrictions and validation evidence before declaring
  milestone A. Production cutover must pair the new application/client with the
  migrated database and use the rehearsed backup/recovery procedure.

**Completion:** the application builds and core workflows pass against migrated
data. Existing intended access and content are preserved, settings/text resolve,
cross-band reads/writes are rejected, and temporary gaps are explicit.

## Phase 5: routing and multiband lifecycle

**Outcome:** people can use and administer multiple bands through supported
portal URLs and membership workflows.

- [ ] Implement the portal resolver and shared URL/router API for standalone
  hosting and platform `/[locale]/b/<publicBandId>/...` routes. Preserve supported
  URLs without a locale and the intended single-band root or `/backstage` shape.
- [ ] Feed the explicit route locale into phase 2's preference contract for both
  string lookup and formatting. Keep URLs without a locale directly supported,
  using browser preferences without redirecting to a chosen locale; prefer those
  URLs for sharing. Add a language switcher that navigates to the equivalent page.
- [ ] Adapt existing pages through the rewrite strategy without duplicating page
  implementations. Validate host/path/band/locale on the server; middleware alone
  does not authorize requests.
- [ ] Replace Next's static i18n assumptions, locale-dependent links, redirects,
  and document language with application preference/formatting contracts and
  actual resolved content language where applicable. Ensure server rendering and
  client navigation agree without inventing a second string-fallback algorithm.
- [ ] Exercise SSR, RPC/API, files, feeds, Custom Links, notifications, and
  exported links under each portal shape. Preserve Custom Links' agreed band-root
  ownership without adding locale-specific redirect behavior.
- [ ] Add My Bands, band creation/switching, invitations and membership management,
  applicable role assignment, band settings/branding, enabled locales, catalog
  opt-ins/custom entries, and band decommissioning policy.
- [ ] Provide the appropriate platform administration surfaces for global
  catalogs, locales, settings, and role/permission definitions. A newly signed-up
  person with no memberships must have a usable account flow.
- [ ] Verify band changes refresh authorization, preferences, catalogs, settings,
  formatting, and links without retaining another band's state. Locale changes
  refresh localized data and presentation while reusing authorization for the
  same band/person.

**Completion:** two bands are usable through all supported portal shapes, with
working lifecycle/administration and isolation across page and non-page paths.
Separate marketing, pricing, or unrelated product features are not prerequisites
for this infrastructure milestone.

## Phase 6: localized editing and refinement

**Outcome:** milestone B, completed localization and multiband behavior.

- [ ] Add a shared localized-string editing/inspection surface for static chrome
  and dynamic entity strings, with explicit locale and global/band scope,
  inherited values, resolution provenance, override/reset controls, and search.
- [ ] Restore the site-chrome editing mode with a single-string editor and a link
  to the main inspection surface. Use explicit lookup without fallbacks to edit
  stored values while showing the resolved/inherited display value separately.
- [ ] Authorize the specific string/scope on the server and invalidate affected
  catalogs after writes. Keep editing format-aware and share machinery across
  chrome, tags, attendance captions, and other localized fields.
- [ ] Restore the deferred Markdown editing experience through these APIs.
  Review every temporary restriction and restore it or record an explicitly
  accepted retirement before closing the effort.
- [ ] Complete the remaining UI registry/English label coverage and audit
  attendance captions, validation, accessibility, document language, calendar
  locale preferences, and date/number formatting. Song titles/aliases, wiki, and
  other authored content retain the agreed multilingual-text model.
- [ ] Establish a repeatable translation import/export and seed/update path.
  Record the agreed French/Dutch translation coverage separately from functional
  locale support; three locale rows and English fallback do not establish that
  the application has been translated.
- [ ] Run final build/typecheck/applicable lint checks and the full repository
  suite. Rehearse both migrated-production-copy and fresh-install acceptance,
  including routing, management, editing, switching, and backup recovery.

**Completion:** all planned surfaces work together, required translations have
recorded coverage, and no unaccounted temporary disablements remain.

## Temporary restrictions

Rows identify whether a restriction is implemented or still planned. Add an
owner/restoration phase for any additional gap.

| Feature | Recovery behavior | Restoration |
| --- | --- | --- |
| `LocalizedMarkdown` inline editing | Implemented in phase 2: resolved rendering remains; the obsolete inline editor/write path is removed. | Phase 6 supplies scoped localized editing. |
| Generic DB3 settings writes | Implemented in phase 2: mutations reject all settings hives to preserve registry validation and per-key authorization. | Phase 3 adapts generic editors to the registered command API. |
| Full translation editor | The initial phase-3 instrument slice supplies transactional band string writes and explicit locale/field inheritance controls. Their shared DB3 integration remains pending; translation inventory and inspection remain deferred. | Phase 3 integrates ordinary localized editing; phase 6 supplies the shared static/dynamic editing and inspection surface. |
| Full portal routing and band management | Recovery requests select a band explicitly with `?bandPublicId=<publicId>` and may supply `routeLocale`. Server authorization validates the selection; omitting it never selects a default band. | Phase 5 completes host/path routing, links, switching, and lifecycle surfaces. |
| Legacy DB3 operations with selected-band grants | The initial phase-3 slice rejects selected-band execution except its instrument catalog views/command. Its hard-coded exceptions are pending redesign; legacy handlers still lack band ownership enforcement. | Phase 3 replaces exceptions with shared declared policies without weakening the ownership gate. Phases 3–4 admit other domains only after migration. |
| Global instrument administration and instrument consumers outside the catalog pages | Initial band opt-in/custom editing works, but its DB3 design is not yet accepted. Global catalog writers, dashboard/member selectors, file/event associations, and catalog seeds still use obsolete contracts. | Accept the instrument/group design and second-catalog reuse first, then continue phase 3 descriptors and phase 4 recovery; no compatibility delegates were added. |
| Band administrators using old global-account writers | Implemented in phase 1: shared-account changes require platform grants. Separate membership writers and old role/merge consumers still need adaptation. | Phases 3–4 supply BandUser role/offboarding/recovery operations and the appropriate views. |
| Legacy random demo seeds | Implemented in phase 1: the seed entry point now initializes real access-control foundations. Old catalog/demo generators reference removed models. | Phases 3–4 adapt useful catalog/demo seed content with its domains. |
| Legacy synchronous band-permission guards | Implemented in the phase-1 correction: `resolver.authorize` rejects band capabilities; only request-scoped authorization can check them. | Phases 3–4 replace remaining band guards with `cmauthorize` and enforce resource ownership. |

## Acceptance across phases

Use two bands sharing a person and global catalog items but having different
roles, enabled locales, settings, translations, and private content. Include
anonymous, pending, active member, band administrator, platform administrator,
outsider, and inactive/merged cases. Verify reads, writes, references, search,
sorting, cached results, and switches stay within the authorized scope.

Localization acceptance must demonstrate that a Dutch viewer receives a band's
French override even when a global Dutch translation exists; a string without
band overrides can resolve to Dutch on the same page. Cover French region
fallback, route preference over browser preference, intentional blank overrides,
last-resort ties, and explicit lookup with fallbacks disabled. Cover preference
lists with the same `formattingLocale` but different string results to prevent
catalog cache collisions. Verify formatting without a matching stored translation.

Keep focused tests with each behavioral change. Follow [docs/testing.md](../testing.md):
`yarn test <test paths> --reporter=dot`, and use `yarn test --reporter=dot` for
milestone/final suite checks. A build passing alone does not establish usable
workflows or isolation.

## Next execution step

Phases 1–2 are implemented and checked; see
[05-authorization-foundation.md](05-authorization-foundation.md) and
[06-localization-settings.md](06-localization-settings.md). Rework phase 3's
[instrument/group slice](07-db3-band-instruments.md#agreed-design-direction)
around DB3 fields and shared read/write execution, using the settled resolved-text
query policy and in-memory V1 strategy. Meet its design acceptance criteria, then
add one other catalog to prove reuse. Only then extend the contracts to dashboard/
reference and member-instrument consumers, remaining catalogs, membership/
content views, and registered settings editors. Broader application recovery
follows in phase 4. The application remains unbuildable until those consumer
adaptations are complete.
