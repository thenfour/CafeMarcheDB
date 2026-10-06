# DB3 band-instrument vertical slice

The instrument/group redesign and the second-catalog reuse proof were implemented
2026-10-06 as a bounded part of phase 3 in
[04-implementation-plan.md](04-implementation-plan.md). The reviewed bespoke
query, validation, view, form, and CRUD paths have been replaced with shared DB3
facilities. The short-term design criteria below are implemented and covered by
focused checks. Remaining descriptors and consumers still need migration;
**phase 3 remains in progress and the application is still unbuildable**.

## Agreed design direction

The purpose of this slice is to prove that localized, per-band catalogs retain
DB3's usual declaration-driven query and editing support. Shared DB3 extensions
are expected where the new model needs them. Catalog-specific code remains
appropriate for richer domain operations, such as opting in a global instrument
and ensuring its functional group exists in the band.

### Resolved text is the query value

The search/order policy is settled: a localized field behaves as if its resolved
text were its only string value. Resolve with the established rules, trusted
band, full ordered route/browser preferences, and enabled locales. Band override
precedence, intentional blank text, missing values, and string-identity
inheritance use the existing shared resolver. `formattingLocale` remains separate
from the preference list used to resolve each string.

Quicksearch, autocomplete, field filters, ordering, counts, pagination, and
presentation all use the same effective values. A translation the user will not
see cannot produce a match; a global translation suppressed by a band override
cannot produce one either. The returned entity presents the value that matched.
Locale-aware ordering uses `formattingLocale` and a stable public-ID tie-breaker.

DB3 retains responsibility for token parsing and filter composition. Localized
fields participate through shared string-field matching and ordering operations,
including tokens matching across different searchable fields. Avoid separate
catalog matchers or reducing quicksearch to a name substring check. Preserve the
existing plain-string behavior used by events, songs, and other entities. Verify
case, accents, and pattern behavior against the existing database semantics; a
new lowercase/substring implementation alone does not establish parity.

### Shared server-side in-memory queries for V1

These catalogs are expected to be small, so V1 prioritizes a simple in-memory
backend within DB3. SQL/Prisma optimization is deferred; demonstrating a database
query for the entire resolution policy is not a prerequisite. Future backends
must preserve the same field and public query contracts.

The shared server query path should:

1. Establish the trusted band and fresh authorization in its database context.
2. Load authorized band rows and the dependencies declared by their DB3 fields,
   applying ownership, visibility, and applicable structural constraints.
3. Batch-resolve localized/inherited values through the shared resolver.
4. Apply existing DB3 token/filter composition and field-driven matching and
   ordering to those effective values; count the full match, then paginate.
5. Return the same values through the derived view contract, sanitization, and
   reference/hydration facilities.

Authorization governs eligible search fields as well as returned data. Do not
apply database text filters or `skip`/`take` before resolution if that changes the
match, count, or page. In-memory execution stays on the server. Measure catalog
size and query cost as evidence for later optimization; this strategy does not
require moving existing large nonlocalized tables to memory.

`LocalizedStringField` declares its fetched dependencies and resolves its value,
then uses shared string-field query operations. Add any missing in-memory field
operations to DB3 itself. The backend must not switch on instrument table names
or use an unchecked list of catalog column names to interpret filters.

### Field validation, views, and writes stay in DB3

DB3 fields remain the authority for validation and conversion. Reuse
`MakeSortOrderField`, `ColorField`/`MakeColorField`, and other existing fields;
improve their shared rules where necessary. `bandInstrumentContracts.ts` must
not maintain copies of those constraints. Command transport schemas can validate
operation kind, identity, and payload structure, while field values use derived
or externally invoked DB3 validation. Inheritance handling delegates explicit
values to the underlying field and keeps inherit/reset operations explicit.

Prefer typed Prisma args, `deriveViewContract`, and `defineView`/`defineCrudView`.
Improve the shared contract syntax and compilation for fetched dependencies,
resolved values, inherited scalars, and DTO hydration where needed. Do not keep
a parallel hand-written DTO/schema/hydration convention for catalogs. Preserve
public-ID typing, reference support, and resolution provenance.

Ordinary create/update behavior uses shared DB3 CRUD facilities. A custom domain
command may compose those facilities for opt-in, inheritance changes, or other
richer operations. Such commands reuse field validation/conversion,
authorization, transactional persistence, and auditing. Existing consumers
refresh dependent data explicitly; automatic command invalidation is deferred.
The minimal dynamic-string writer remains shared and must integrate with these
field and persistence contracts.

Queries likewise use normal DB3 authorization, sanitization, reference, and
hydration contracts. Replace `bandInstrumentRead.ts`'s separate field allowlists
and column-name switches with typed table/field metadata. Remove instrument-only
branches such as `isBandInstrumentTable(...)` from generic query endpoints.
Putting the same bespoke reader behind a registered callback is insufficient:
the shared path must perform the common work and let fields supply their meaning.

Shared server execution owns transaction policy and authorization refresh. Page
and RPC callers must not need to request `RepeatableRead` or remember
`auth.refresh(tx)` for a reader to be safe. Choose and document required isolation
at that shared boundary, and tie authorization and database access to the same
context. Internal transaction helpers must express that requirement in their
types. Detail/existence reads should use the shared authorized query contract
without resolving an entire catalog just to check one public identity.

## Design acceptance criteria

These are the short-term gate for the instrument/group redesign. The shared
implementation also supports the BandSongTag reuse proof described below.
Retain public-ID, ownership, visibility, inheritance, translation-writing, and
audit behavior. Refresh query and dashboard references from their consumers;
automatic invalidation policy is deferred for V1.

- [x] Native DB3 quicksearch, autocomplete, field filters, sorting, count/page,
  reference hydration, grids, selection dialogs, and ordinary create/edit forms
  use the shared catalog contracts. Create-from-picker works where the entity
  permits it; richer instrument creation may still require its group workflow.
- [x] Equivalent ordinary and resolved localized string values produce equivalent
  matches and pages under the same DB3 filters. Cover multiple tokens across
  fields, case/accents/patterns, blank/missing values, ordering ties, full counts,
  and pagination after resolution. Hidden translations do not affect matching.
- [x] Full ordered preference lists, enabled locale changes, and band overrides
  affect queries and display consistently. Contexts with the same
  `formattingLocale` but different resolved values cannot share incorrect caches.
- [x] All scalar/localized/inherited field values use DB3 validation and
  conversion. Ordinary CRUD and custom domain commands share those rules and
  write facilities. Unrelated edits do not materialize inherited/fallback values.
- [x] Typed Prisma args derive the view and DTO contract through the preferred
  shared syntax. Column/filter/reference names are checked against declarations;
  no separate catalog sanitization or unchecked field-switch implementation
  remains.
- [x] Generic DB3 entry points contain no instrument-specific exceptions.
  Ownership and selected-band admission use shared declared policies; legacy
  domains remain rejected until their ownership enforcement is adapted.
- [x] Shared execution establishes fresh authorization and transaction policy.
  Two-band reads, references, revoked grants, writes, and rollback remain covered;
  page/RPC callers have no silent isolation or authorization-refresh obligations.
- [x] Resolved query strategy selects coherent reads independently of ownership.
  Transactional field preparation dispatches through a field hook; localized
  transformations and validation remain on the localized field.
- [x] Instruments, functional groups, and song tags use the dashboard reference
  store. Existing dashboard delivery and field-derived contracts support native
  editor references, details, and chips without duplicate client stores/queries.
- [x] The common behavior lives in DB3 and shared localization/persistence
  helpers. Catalog declarations and genuine domain operations explain the
  remaining custom code. Passing tests or registering bespoke callbacks alone
  does not satisfy this criterion.

**Second-catalog proof implemented:** BandSongTag uses table/field/view/label
and native-grid declarations, plus relevant behavioral coverage. It adds no
reader, matcher, validator, form stack, or endpoint. Broader catalog and consumer
adaptation follows this bounded proof.

## Shared DB3 redesign and reuse proof (2026-10-06)

### Declarations and field contracts

`bandCatalogFields` declares common ownership, name/description identities,
inherited sort order, and visibility fields. Each catalog declares its Prisma
model, public identity, typed `bandScope` members/source relation/source foreign
key, management permission, and `queryStrategy: "resolved"`. Prisma args feed
`deriveViewContract` and `defineCrudView`; the preferred declaration syntax now
supports fetched dependencies and field-owned read companions.

`LocalizedStringField` delegates string predicates and text validation to the
ordinary DB3 string field. Its client value separates display text/provenance
from an optional explicit locale edit. No edit means no translation write.
`InheritedField` wraps an existing scalar field and keeps effective value, raw
override, and inherited value separate. Its codec encodes only the override;
its validation and native renderer delegate to the original color, integer, or
string field. These contracts prevent unrelated saves from materializing a
fallback translation or inherited scalar.

`deriveFieldWriteSchema` exposes the same field transport/conversion/validation
outside forms. Color palette validation and signed-integer validation stay on
their existing fields. Regex validation is a shared string-field format. Ordinary
CRUD schemas derive from the fields; instrument contracts have no duplicate
sort-order, color, text, or regex validators.

### Read execution and query behavior

Generic DB3 reads use declared ownership/visibility policies and the existing
selection planner, row/column authorization, public-ID projection, DTO parsing,
reference store, and hydration. The planner adds field dependencies and strips
query-only support values from narrow DTOs. Default ordering and quicksearch
therefore work even when a view selects only public identity.

The shared server path loads structurally eligible rows, batch-resolves authorized
field values, applies ordinary projection/authorization, then evaluates the
existing DB3-generated token/filter clauses in memory. It sorts, counts, and
pages the effective values before parsing the requested DTO. Token composition
remains AND across tokens and OR across eligible fields. LIKE retains `%`, `_`,
and escapes; comparisons distinguish trailing ordinary spaces, tabs, and SQL
NULL under NOT. Native MariaDB comparisons cover representative case, accent,
ligature, combining-character, Turkish-I, pattern, padding, and NULL cases.
Locale-aware sorting intentionally follows `formattingLocale` with numeric
ordering and stable public-ID ties, rather than storage collation.

The matcher implements the supported DB3 predicate subset and rejects unsupported
operators. Its native comparison matrix establishes those tested cases against
MariaDB 10.11.9's `utf8mb4_unicode_ci`; it is not a general implementation of all
MySQL collations or every Unicode collation version. Large SQL search pipelines
remain separate and cannot inject their ordering/natural keys into this backend.

`queryStrategy: "resolved"` selects `executeDB3Read` in both generic query entry
points. Resolved queries assemble fields across independent reads; `bandScope`
declares ownership and does not decide transaction policy. `executeDB3Read` owns
RepeatableRead and authorization refresh on the root Prisma client. Rows,
translations, availability, and grants share that snapshot. Pages and RPCs pass
the root client. Internal transaction owners explicitly bind a
RepeatableRead/Serializable `DB3ReadContext`; raw transactions are rejected at
this boundary. The legacy dynamic query delegate seam remains during recovery,
while the new execution/composition helpers express snapshot ownership in their
types. Server detail reads constrain the public identity before loading/resolution.

Hidden groups suppress instruments in ordinary reads. Administration reads can
include hidden references only with the target catalog's management grant.
Shared mutation identity lookup permits administrators to edit/restore hidden
entries, while new foreign references still require ordinary visibility.
Legacy descriptors remain rejected in selected-band queries and row services.

`bandInstrumentRead.ts`, the name-only catalog matcher, and all instrument-table
switches in generic read/command entry points have been removed. The remaining
instrument catalog request supplies authorized global opt-in choices only.
Ordinary instruments, functional groups, and song tags arrive through the
existing dashboard request and reference store.

### Writes and native UI

Generated DB3 create/update commands perform ordinary group/instrument CRUD.
The shared field writer joins normal DB3 persistence and audits in the command's
transaction. `BandInstrument_OptIn` contains only global group/instrument opt-in;
its instrument operation composes the common opt-in row service to ensure its
required group exists. Source identity and ownership are server supplied.

`prepareDB3FieldWrites` dispatches `FieldBase.applyTransactionalWrite` for supplied
field values. `LocalizedStringField` owns the explicit-edit validation, inherited
source check, owned string identity, and foreign-key patch. The server supplies
a dynamic-string writer bound to the authorized mutation transaction. The generic
orchestrator has no localized-field type switch. This asynchronous persistence
hook complements the existing client edit codec and field validation.

Catalog pages use native DB3 grids, create/edit dialogs, foreign selection,
reference hydration, and shared localized/inherited field controls. The native
picker can create functional groups through generated CRUD with a visible,
enabled writing-language selector. Instruments still require their group input.
Localized edits never copy another language's displayed fallback into a draft.
Failed create writes retain the native dialog/draft and allow retry.

All native query adapters carry selected band, route locale, the entire ordered
browser list, and the presentation refresh identity. Different resolved-string
contexts cannot share an incorrect formatting-locale-only cache key. Catalog
writes refresh their query and dashboard references from existing CRUD consumers;
`useDB3Command` has no automatic band-scope invalidation. Global opt-in refreshes
its choices, dashboard references, and native query caches. Picker creation does
not remount an unsaved parent form. Broader invalidation policy is deferred.
Settings, availability, membership, and grant writers retain presentation-context
invalidation through the phase-2 API.

BandSongTag and its existing editor page use these same fields, derived CRUD
view, native controls, query/persistence pipeline, and cache context. Its native
fixture covers shared opt-in/inheritance as well as generated CRUD; a separate
global tag-choice/opt-in UI is not added by this proof.

### Shared dashboard references

`getDashboardData` now delivers instruments, functional groups, and song tags
from their canonical band entities. `loadDashboardCatalogs` composes the existing
derived views in one read snapshot, using the full ordered locale preferences
and refreshed grants. Hidden entries are included only with the corresponding
catalog management grant. There are no duplicate global/band descriptors or
parallel dashboard catalog DTO schemas.

Derived display hydration exposes effective names, palette colors, and scalar
sort orders while preserving resolution and override companions. Editor views
retain rich localized/inherited values for explicit edits. Both use the same
field-derived transport contract. The existing dashboard hydration pipeline
registers groups and tags before instruments and builds a new reference store
for every snapshot, clearing old band and locale references on refresh.

The instrument/group and song-tag editors use `dashboard.referenceStore`.
Instrument details, instrument/group chips, and song-tag indicators read these
shared references synchronously. The instrument page has no private reference
store or extra entity/detail queries; only its global opt-in choices remain
workflow-local. Ordinary CRUD awaits the existing dashboard refresh so new
references are available to dependent controls.

### Validation and remaining work

The focused command covers the catalog/native UI paths, shared DB3 contracts,
commands/selection, scoped authorization, and localization/settings:

```powershell
yarn test tests/bandInstrumentCatalog.test.ts tests/bandInstrumentCatalog.mysql.test.ts tests/bandSongTagCatalog.mysql.test.ts tests/bandInstrumentEditor.test.tsx tests/db3MemoryQuery.test.ts tests/db3MemoryQuery.mysql.test.ts tests/db3ReadExecution.test.ts tests/db3CrudSelection.test.ts tests/db3ViewContract.test.ts tests/db3Commands.test.ts tests/authorization/db3Views.test.ts tests/authorization/db3GridSort.test.ts tests/authorization/multibandAuthorization.test.ts tests/authorization/permissionRegistry.test.ts tests/authorization/publicIdTransport.test.ts tests/localizationResolution.test.ts tests/localizationSettings.test.ts tests/localizationSettings.mysql.test.ts tests/userSettingsContext.test.tsx tests/domainSelection.test.ts tests/db3ForeignSingleSelection.test.ts tests/db3TagsSelection.test.ts tests/selectionPicker.test.ts tests/testEnvironment.test.ts tests/db3DashboardCatalogs.mysql.test.ts tests/db3FieldWrites.test.ts tests/db3ColumnFactories.test.ts tests/db3Identity.test.ts tests/authorization/searchSortContract.test.ts --reporter=dot
```

Native tests require `CMDB_PHASE2_TEST_DATABASE_URL` pointing to a private,
disposable database; validation used the private MariaDB 10.11.9 fixture schema.

- Focused checks: **287 tests across 29 files**, including **21 native database
  tests** across five files. Follow-up coverage proves strategy-based transaction
  selection, polymorphic field writes, dashboard hydration/store sharing,
  band/locale replacement, refreshed hidden-entry grants, and synchronous UI
  references without an extra query. Parent-draft preservation remains covered.
- In the earlier redesign run, the three-row tag fixture matched two rows across
  resolved text/scalar fields and returned one-row pages in **3-4 ms per page**. This is a
  tiny correctness-fixture observation, not a production benchmark. Measure
  real catalog sizes/cost before optimizing or applying this backend to large
  tables. The static localization fixture measured **121 keys / 19,034 UTF-8
  bytes**.
- The complete suite's Node batch has **344 failing tests across 36 files**;
  starting baseline `e7d5b79d` has exactly the same failing test groups. The
  follow-up batch passed 1,155 tests versus 1,152 at that baseline, with native
  database tests skipped in both full-suite comparisons. The runner stops before
  its DOM batch; the relevant DOM and native database tests are
  covered by the focused run. Legacy calendar, authorization/bootstrap, wiki,
  merge, and event fixtures/consumers still require migration.
- `yarn tsc --noEmit --pretty false --incremental false` still reports **674
  diagnostics**, versus **693** at starting baseline `e7d5b79d`. The new dashboard
  loader, field hook, display hydration, and adapted catalog pages have no
  diagnostics. Legacy association/file/song descriptors remain incomplete;
  canonical band types also change some diagnostics in those consumers.
  Nonincremental mode avoids an existing incremental-compiler overload
  diagnostic crash.
- ESLint on changed/new code and `git diff --check` pass.

Obsolete tests of the removed name-only matcher were replaced with common
predicate/native comparison coverage. Bespoke-editor tests were replaced with
native field/form/picker tests. Stale selector test mocks/imports were adapted
to the registered settings/context APIs. No valuable selection coverage was
removed. Trivial shared defects fixed during the earlier redesign include integer parsing
returning the original string, palette writes accepting invalid colors, raw
registry keys used as selection captions, and native create dialogs closing
before failed writes finished.

The dashboard follow-up also replaced obsolete global-catalog fixtures with
field-derived band reference fixtures. Generic scalar CRUD/codec tests use an
existing scalar entity. The redundant old instrument query test is superseded
by the native dashboard/query/reference pipeline coverage; nested legacy-domain
projection tests continue to test authorization and DTO transport directly.

Dashboard catalog/reference migration is implemented. Continue phase 3 with
member-instrument consumers, remaining catalogs/global catalog writers,
membership/content descriptors, and registered settings editors. Full application recovery, global tag opt-in
UI, translation inventory/inspection, and portal UX remain in their planned
phases. No application database or migrated association was replaced for tests;
the private validation server was stopped. The earlier redesign's baseline
checkout was removed. Its automatic approval review rejected deletion of the
server's temporary data directory with "blocked by policy", so those files
remain in the system Temp folder.

## Initial implementation and evidence (2026-10-06)

The following sections describe the initial implementation and its validation.
They preserve behavioral requirements and historical evidence; its bespoke
mechanisms and caller-owned transactions are subject to the redesign above.

### Read and presentation contracts

`LocalizedStringField` describes the stored string-identity member and its
PlainText/Markdown format. `db3LocalizedFields.ts` selects a local identity or,
when that identity is null, its global source. An existing local identity with no
translation remains missing; it cannot silently restore the global meaning.

`BandInstrument` and `BandInstrumentFunctionalGroup` have distinct typed DB3
tables and named catalog views. Their DTOs carry public IDs, resolved text,
per-field resolution details, effective scalar values, and raw scalar overrides.
They omit numeric entity, band, and string IDs. The instrument view hydrates its
functional group through the existing typed reference store. Existing public
instrument/group ID brands and instrument detail paths are retained.

The server first loads rows owned by the authorized band, checks their ownership,
then batch-resolves the reached string identities with phase 2's shared resolver.
This includes inherited global identities and their band translation overrides.
Name and description resolve independently; intentional empty text survives.
Global choices available for opt-in are returned only to instrument administrators.

Catalog reads require account `login` and an explicit trusted band. Existing
administration routes retain `admin_instruments`; the existing detail route
retains `login`. No new membership requirement is inferred for the catalog read.
Hidden entries require `admin_instruments` to include. A hidden group suppresses
its instruments from ordinary reads. Hiding retains records and membership
assignments.

Both the catalog UI and named generic DB3 reads filter and order resolved text
before pagination. Locale-aware ordering uses `formattingLocale` and public ID
ties; counts describe the complete resolved match. Generic reads accept public
identities, supported resolved-field equality filters, and name/sort-order
ordering. Functional-group filters use the group's public identity. They reject
natural IDs, unsupported table parameters, and deleted-row access.

RPC and detail-page reads refresh authorization inside a repeatable-read
transaction. Request band selection is validated on the server; DTOs and client
permission snapshots do not authorize operations.

### Write contracts

The strict `BandInstrument_Edit` command supports custom group/instrument
creation, global group/instrument opt-in, and band-entry updates. It requires
`admin_instruments` in the selected band. The RPC refreshes authorization inside
its serializable transaction, and all entity, translation, and audit writes share
that transaction.

Instrument opt-in also opts in its required functional group. Repeating opt-in
returns the existing public identity without duplicating records or audits.
Custom entries have no global source. Null scalar overrides remain inherited;
saving an unrelated field does not copy effective global values into overrides.
The initial implementation supplies no generic insert/update/delete grants on
these tables; the redesign must express authorized ordinary writes through the
shared DB3 facilities.

The command loads each target and referenced functional group from the same
band inside the transaction. It rejects other-band public IDs, forged current
string identities, numeric IDs, undeclared ownership fields, disabled locales,
format mismatches, and invalid file-matcher regular expressions. Revoked grants
and inactive memberships are rechecked before execution. Band administrators
cannot write global catalogs or global translation rows through this command.

`dynamicStringWriter.ts` is the minimal shared writer for authorized entity
fields. The entity command supplies the current owned string ID; the client
supplies its expected public identity and explicit locale. Scope comes from the
trusted band. PlainText uses only `indexedValue` (maximum 768 characters);
Markdown uses only `blobValue`. Blank text is a value. Unchanged translations do
not produce an extra value-row write/audit.

Resetting an inherited field explicitly detaches its local string identity.
Custom entries reject this reset because they have no global value to inherit.
Detached identities/value rows are retained; orphan cleanup is outside this
slice. Global data and membership associations remain intact.

### Forms and recovery boundaries

The instrument and functional-group catalog pages use registered localized
labels and ordinary create/edit forms. Admins can opt in global entries, create
custom entries, select an enabled writing locale, edit fields, reset inherited
strings/scalars, and hide entries. Resolved names, descriptions, and detail-page
groups carry their actual content-language tags where displayed.

Forms send text only when edited or explicitly reset. A resolved field is shown
in the edit input only if its language matches the selected editing language;
switching language never copies a fallback into that language. The minimal form
does not load a complete translation inventory. Exact stored-value inspection
and the shared translation editor remain phase 6. Failed writes retain the open
form and report the error. Successful writes invalidate presentation and entity
query caches.

During recovery, requests use `?bandPublicId=<publicId>` and optional
`&routeLocale=<tag>`. `_app` uses these validated inputs for initial route
authorization, presentation, and branding; detail links retain them. HTTP language
preferences remain separate. Missing band selection does not select a default.
Full host/path portal resolution, navigation, and band switching remain phases
4–5; this is not a new permanent portal URL contract.

Generic DB3 read and command entry points now reject selected-band execution
for legacy descriptors/handlers. Supplying the newly supported band selection
must not expose band grants to old operations without ownership checks. Each
domain must migrate before this gate admits it. Unscoped platform operations
retain their prior behavior.

Global instrument management, existing dashboard/member selectors, file/event
instrument associations, and catalog/demo seeds still reference obsolete
contracts. The old descriptors are not compatibility adapters and are not
evidence that those consumers work. Registered settings editors and remaining
catalog/content/membership domains also remain phase 3 work.

Removed trivial stale `significance` selections/columns from migrated tag and
role surfaces were preventing DB3 module import. Their corresponding completeness
checks and fixtures were corrected; the attendance-tag CSS uses `cssClass`.
Valid platform-owned behavior fields were retained. The domain-selection test's
obsolete Markdown-component mock path was also corrected. No tests were removed.
Two unused imports encountered during linting were removed from the existing
view-contract tests.

### Validation

These results belong to the initial implementation, before the design review.
They have not been rerun for this documentation update and do not establish the
redesign's acceptance.

Focused command:

```powershell
yarn test tests/bandInstrumentCatalog.test.ts tests/bandInstrumentEditor.test.tsx tests/localizationResolution.test.ts tests/localizationSettings.test.ts tests/userSettingsContext.test.tsx tests/authorization/multibandAuthorization.test.ts tests/authorization/permissionRegistry.test.ts tests/authorization/db3Views.test.ts tests/authorization/db3GridSort.test.ts tests/db3Commands.test.ts tests/testEnvironment.test.ts tests/db3ViewContract.test.ts tests/domainSelection.test.ts --reporter=dot
```

Native command, with `CMDB_PHASE2_TEST_DATABASE_URL` set to a private disposable
target-schema database:

```powershell
yarn test tests/bandInstrumentCatalog.mysql.test.ts tests/localizationSettings.mysql.test.ts --reporter=dot
```

Results:

- **197 focused tests passed across 13 files**, including six isolated form
  tests and existing DB3 reference/view/command coverage.
- **14 native tests passed across two files**, using actual Prisma relations,
  translation storage, authorization refresh, audits, rollback, two opted-in
  bands with independent overrides, public reference filters, and hiding that
  preserves a real membership-instrument association.
- The expanded static catalog measured **107 keys and 16,900 UTF-8 bytes** in the
  native fixture. This is a fixture measurement, not a production payload estimate.
- ESLint passed for all **47 changed/new code files**; `git diff --check` passed.
- `yarn typecheck` still fails with **709 diagnostics**, compared with **717**
  before this slice. New slice modules, adapted instrument pages, and new tests
  have no diagnostics. Remaining failures include obsolete delegates, domain
  descriptors, membership/content consumers, seeds, and old fixtures.
- An additional `tests/authorization/db3ReadSelection.test.ts` run reached its
  assertions after the import corrections: **seven passed and four failed**.
  The existing Event_Detail/Event_Search fixtures still lack migrated scoped
  authorization. They remain for the event/membership recovery work.

Native validation used an isolated MariaDB 10.11.9 server and fresh schema. The
database was removed and its private server shut down afterward. No existing
application database was changed. Automatic approval review blocked deletion of
the temporary server data directory; those temporary files remain. Full builds,
the complete suite, and interactive migrated-application acceptance remain phase
4 work; focused tests do not establish a usable application.

## Next execution step

The shared instrument/group design, BandSongTag reuse proof, dashboard catalog
references, and [membership instrument editing](08-band-user-instruments.md)
are implemented. Continue with remaining member-profile/taxonomy, event/default
instrument and merge consumers, the remaining catalogs, membership/content views,
global catalog administration, and registered settings editors. Remove obsolete domain contracts as their
consumers migrate. Complete those adaptations and phase 4 acceptance before
declaring milestone A.
