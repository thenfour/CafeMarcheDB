# Shared DB3 contracts

Localized per-band domains retain ordinary DB3 declaration-driven queries,
validation, views, forms, writes, and reference hydration. Domain-specific code
expresses genuine operations such as instrument opt-in, rather than duplicating
readers, matchers, DTO schemas, or CRUD stacks. Delivery priorities belong to the
[implementation plan](04-implementation-plan.md).

## Fields and derived contracts

Typed Prisma arguments feed `deriveViewContract` and `defineView`/`defineCrudView`.
Fields declare fetched dependencies, resolved values, and read companions. The
planner loads query dependencies even for narrow views and strips query-only
support data from their DTOs. Public identity, projection, hydration, and
resolution provenance remain part of the derived contract.

`LocalizedStringField` delegates text validation/predicates to ordinary string
fields. Its client value separates display/provenance from an optional explicit
locale edit. No edit means no translation write. `InheritedField` keeps effective,
raw override, and inherited values separate, encodes only the override, and
delegates validation/rendering to the original scalar field. Null inheritance
must remain distinct from explicit empty strings, `false`, and zero.

`deriveFieldWriteSchema` exposes field validation outside forms. Sort order,
palette color, integer, text, and regex rules live on shared DB3 fields. Ordinary
CRUD derives from them; custom commands validate transport/operation structure
and reuse the same field rules. Unrelated saves never materialize a displayed
fallback or inherited value.

## Resolved query execution

A localized field behaves as its effective displayed text for quicksearch,
autocomplete, filters, sorting, counts, and pagination. Resolve using the trusted
band and full locale preferences from
[localization](06-localization-settings.md#string-resolution-and-formatting).
Suppressed/hidden translations cannot cause a match. Authorization constrains
searchable fields as well as returned fields.

`queryStrategy: "resolved"` uses a shared server-side in-memory backend for small
catalogs. It loads structurally eligible rows/dependencies, batch-resolves fields,
applies authorized projection and DB3 token/filter clauses, sorts/counts/pages,
then parses the requested DTO. Text filtering or pagination before resolution
must not change the result. Existing large SQL query pipelines remain separate.

Token composition stays AND across tokens and OR across eligible fields. Shared
matching preserves supported LIKE `%`, `_`, escapes, trailing-space/tab, and SQL
NULL/NOT behavior. The matcher rejects unsupported operators. Native comparisons
cover representative `utf8mb4_unicode_ci` behavior; this is a tested predicate
subset, not a general implementation of every MySQL/Unicode collation. Ordering
uses `formattingLocale`, numeric ordering, and stable public-ID ties.

`executeDB3Read` owns RepeatableRead and authorization refresh on the root Prisma
client. Rows, translations, availability, and grants share its snapshot.
`bandScope` describes ownership independently of query/transaction strategy.
Ordinary Prisma domains can request `readConsistency: "snapshot"` as memberships
do. Pages/RPCs pass the root client; internal transaction owners bind an explicit
RepeatableRead/Serializable `DB3ReadContext` through `bindDB3ReadSnapshot`. Raw
transactions are rejected at that boundary. Detail reads constrain public identity
before loading/resolving rather than scanning an entire catalog for existence.

## Ownership, visibility, and persistence

Declared band policies constrain all reads/writes. Parent-owned relations use
`bandScope.via`, with support fields fetched and stripped by shared machinery.
Selected-band generic queries and row services reject undeclared legacy domains.
Mutations also verify every referenced row in the same authorized transaction.

Hidden functional groups suppress their instruments from ordinary reads. Hidden
catalog delivery requires that catalog's management grant. Administrative identity
lookup can edit/restore hidden entries, while new associations require ordinary
same-band visibility. Association fields may retain existing hidden references
through explicit `readVisibility: "association"`; that does not make those entries
new selectable choices.

`prepareDB3FieldWrites` dispatches `FieldBase.applyTransactionalWrite`.
`LocalizedStringField` owns explicit-edit validation, inherited-source checks,
owned string identity, and the foreign-key patch. The server supplies a dynamic
string writer bound to the authorized mutation transaction. Persistence and
auditing share that transaction; generic orchestration has no localized-field or
instrument-table switch.

Generated CRUD handles ordinary catalog create/update. `BandInstrument_OptIn`
composes the common opt-in row service to ensure the required band group exists.
Source identity and ownership come from the server. Custom instrument creation
requires a group; no synthetic/null group fallback is introduced.

## Native controls and references

Native grids, dialogs, pickers, and create/edit forms use the field-derived
contracts. Writing language is explicit and enabled; drafts never copy another
language's fallback. Failed creates retain dialogs/drafts. Picker creation must
not remount an unsaved parent form.

Queries carry band, route locale, the entire ordered browser list, and presentation
refresh identity. Formatting locale alone is an insufficient cache key. Ordinary
CRUD consumers await dashboard/reference refresh; `useDB3Command` has no automatic
band invalidation policy. Richer opt-in also refreshes its workflow-local choices.
Presentation-affecting membership/grant/settings writers use the shared
presentation invalidation boundary.

`loadDashboardCatalogs` composes canonical instrument, functional-group, song-tag,
and member-tag views in one coherent snapshot with fresh grants/preferences.
Platform context yields empty band collections. Hidden delivery uses the relevant
catalog grant. Derived display contracts expose effective names/colors/orders
while retaining rich companions; editor views retain explicit override metadata.

Dashboard hydration registers groups/tags before instruments and replaces the
reference store for each snapshot. Details, chips, indicators, and native editors
read `dashboard.referenceStore` synchronously. Only richer global opt-in choices
need workflow-local catalog queries. There are no parallel global/band dashboard
DTO schemas or private reference stores for ordinary catalog display.

Instruments/groups, song tags, and member tags use these shared facilities. Adding
another catalog should require its declaration and genuine domain operations,
with equivalent query/write behavior and no new matcher, form stack, or endpoint
family. Broader domain migration follows restoration needs.
