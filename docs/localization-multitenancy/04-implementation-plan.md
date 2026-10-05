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

The application is currently far from buildable under the target model. The
localization and four settings registries/hooks are partly scaffolded, DB3 column
definitions partly require localization keys, and runtime consumers still use
the old roles, settings, catalogs, and field shapes.

There are two delivery milestones:

| Milestone | Required outcome |
| --- | --- |
| A: migrated application works | Phases 1–4 complete. Core Café Marché workflows work on the migrated model, the app builds, authorization and band isolation are enforced, and temporary restrictions are recorded. |
| B: localization and multiband complete | Phases 5–6 complete as well. Routing, band lifecycle and management, scoped localized editing, and locale presentation work together. Deferred features are restored or explicitly accepted for retirement. |

Trusted band context and isolation belong before milestone A. The initial
deployment can select Café Marché through server configuration while the full
portal routing and management experience is developed later.

The earlier design rationale remains in
[00-localization-multitenancy.md](00-localization-multitenancy.md), and the model
summary is in [01-schema.md](01-schema.md). Use the actual schema for constraints
and the SQL runbook for migration behavior; earlier illustrative models are not
additional database guarantees.

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
- [x] Establish a shared server context containing the authenticated person,
  resolved band when applicable, membership, applicable grants, and locale.
  Resolve a requested band on the server; client IDs and rewrite headers are
  selection hints, not authorization.
- [x] Initially resolve Café Marché through server configuration. Support
  platform operations with no band and public band access with no membership.
- [x] Load global-role grants and active-band role grants with explicit scope.
  Grants from another band's membership must not authorize an operation here.
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

- [ ] Implement shared locale matching and string resolution for static keys
  and dynamic string identities. Preserve the agreed scope-first fallback order:
  band exact locale, band language match, band `en-US`, other band translation;
  then the corresponding global candidates only when no band translations exist.
  Choose ties deterministically. Empty text is a translation, not absence.
- [ ] Supply registered English defaults for static chrome without stored
  translations. Preserve intentional blank values and band override precedence;
  record the chosen source in resolution details.
- [ ] Resolve inherited catalog fields through the same mechanism. Preserve null
  versus empty text and the distinction between custom band content and global
  content. Provide resolution details for tests and the later inspection editor.
- [ ] Derive plain-text and Markdown key types from registry formats. Keep
  interpolation parameters typed; Markdown strings do not interpolate parameters.
- [ ] Deliver the initial complete UI catalog with the resolved band/locale
  context. Client getters are synchronous only after that catalog is loaded.
  Missing/unloaded keys have explicit development/loading behavior rather than
  hidden network requests or silent empty-string stubs.
- [ ] Batch dynamic values with authorized entity reads. Share the resolver
  between server rendering, DTO hydration, and client chrome; measure payloads
  before introducing catalog bundles or other delivery optimizations.
- [ ] Implement all four settings hives: `GlobalSetting`, `BandSetting`,
  `UserSetting`, and `BandUserSetting`, with registry defaults, typed values,
  per-key read/write capabilities, and validated server mutations.
- [ ] Normalize storage at the server boundary: global/band values are serialized
  JSON in text columns; user/membership values are native Prisma JSON. Decode
  each once and preserve the migrated types documented in the SQL runbook.
- [ ] Make reset explicit. Missing rows use registry defaults; valid empty
  strings, `false`, zero, and any registry-supported null value must survive.
  Keep the hives independent rather than adding an implicit inheritance chain.
- [ ] Adapt server settings consumers, including branding and band timezone,
  alongside client hooks. Preserve existing timezone/date reanchoring behavior.
- [ ] Partition delivery/cache data by relevant band, locale, and authorization
  context. Refresh after string/settings/grant/membership changes and prevent
  stale data or grants from surviving a band switch.

**Completion:** focused tests cover scope precedence, locale matching, blank and
missing values, settings defaults/types/reset, authorization, and invalidation.
The APIs work without depending on a component to fetch each individual string.

## Phase 3: DB3 fields, xTables, and views

**Outcome:** DB3 supports the target model through reusable read/write contracts.

- [ ] Complete one representative vertical slice first: band instruments,
  including global opt-in/inheritance, custom instruments, localized names,
  functional groups, authorized list/detail reads, forms, and mutations.
- [ ] Implement localized-field handling in the existing DB3 field, query,
  reference, and hydration seams. DTOs carry resolved text while write commands
  retain explicit string identity, locale, and scope.
- [ ] Make display, search/filtering, sorting, and pagination use the same
  resolution semantics. Locale-dependent sorting must have a stable tie-breaker.
- [ ] Enforce band constraints centrally for reads and writes, including
  inherited ownership. Validate referenced records against the same band inside
  the mutation transaction; the current schema does not enforce every such link.
- [ ] Add a minimal transactional dynamic-string writer so ordinary entity
  creation and name editing work before the full translation editor exists.
  Enforce format, ownership, and exactly one value storage column.
- [ ] Apply the established patterns to other catalogs, shared global catalogs,
  people/memberships, band content, and the four settings hives. Generic settings
  editors must still use registry validation and per-key authorization.
- [ ] Replace obsolete Prisma delegates, selections, field shapes, and DTOs.
  Audit consumers of removed significance/behavior fields and retain the
  platform-owned semantics that remain; do not restore obsolete fields just to
  satisfy compilation.

**Completion:** the representative slice supports authorized reads and writes,
localized search/sort, custom creation, and inheritance. The remaining descriptors
and views use those contracts, with cross-band reference rejection covered.

## Phase 4: restore the application

**Outcome:** milestone A, a usable application on the migrated data model.

- [ ] Restore authentication/session consumers, dashboard/context delivery, and
  navigation first. Adapt the existing dashboard facade incrementally to expose
  platform, band, and locale context.
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
- [ ] Adapt existing pages through the rewrite strategy without duplicating page
  implementations. Validate host/path/band/locale on the server; middleware alone
  does not authorize requests.
- [ ] Replace Next's static i18n assumptions, locale-dependent links, redirects,
  and document language with application locale context. Ensure server rendering
  and client navigation agree, including initial locale selection.
- [ ] Exercise SSR, RPC/API, files, feeds, Custom Links, notifications, and
  exported links under each portal shape. Preserve Custom Links' agreed band-root
  ownership without adding locale-specific redirect behavior.
- [ ] Add My Bands, band creation/switching, invitations and membership management,
  applicable role assignment, band settings/branding, enabled locales, catalog
  opt-ins/custom entries, and band decommissioning policy.
- [ ] Provide the appropriate platform administration surfaces for global
  catalogs, locales, settings, and role/permission definitions. A newly signed-up
  person with no memberships must have a usable account flow.
- [ ] Verify switching band or locale refreshes context, catalogs, grants,
  settings, and links without retaining another band's state.

**Completion:** two bands are usable through all supported portal shapes, with
working lifecycle/administration and isolation across page and non-page paths.
Separate marketing, pricing, or unrelated product features are not prerequisites
for this infrastructure milestone.

## Phase 6: localized editing and refinement

**Outcome:** milestone B, completed localization and multiband behavior.

- [ ] Add a shared localized-string editing/inspection surface for static chrome
  and dynamic entity strings, with explicit locale and global/band scope,
  inherited values, resolution provenance, override/reset controls, and search.
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
| `LocalizedMarkdown` inline editing | Phase 4 keeps rendering and removes the legacy editor/write path. | Phase 6 supplies scoped localized editing. |
| Full translation editor | Phase 3 provides the minimal dynamic writer needed for ordinary creation/name editing. | Phase 6 supplies locale/scope selection, inspection, and override/reset UX. |
| Full portal routing and band management | Phases 1–4 use trusted server context with the initial Café Marché selection. Isolation is enforced throughout. | Phase 5 completes routing and lifecycle surfaces. |
| Band administrators using old global-account writers | Implemented in phase 1: shared-account changes require platform grants. Separate membership writers and old role/merge consumers still need adaptation. | Phases 3–4 supply BandUser role/offboarding/recovery operations and the appropriate views. |
| Legacy random demo seeds | Implemented in phase 1: the seed entry point now initializes real access-control foundations. Old catalog/demo generators reference removed models. | Phases 3–4 adapt useful catalog/demo seed content with its domains. |

## Acceptance across phases

Use two bands sharing a person and global catalog items but having different
roles, enabled locales, settings, translations, and private content. Include
anonymous, pending, active member, band administrator, platform administrator,
outsider, and inactive/merged cases. Verify reads, writes, references, search,
sorting, cached results, and switches stay within the authorized scope.

Keep focused tests with each behavioral change. Follow [docs/testing.md](../testing.md):
`yarn test <test paths> --reporter=dot`, and use `yarn test --reporter=dot` for
milestone/final suite checks. A build passing alone does not establish usable
workflows or isolation.

## Next execution step

Phase 1 foundations are implemented and checked; see
[05-authorization-foundation.md](05-authorization-foundation.md). Start phase 2
with shared locale/string resolution and authorized typed settings lookup
contracts. Phase 3 follows with the band-instrument vertical slice, then broader
domain and application recovery. The application remains unbuildable until those
consumer adaptations are complete.
