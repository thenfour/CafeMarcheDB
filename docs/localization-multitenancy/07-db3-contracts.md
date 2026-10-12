# Shared DB3 contracts

Adapt existing declaration-driven queries, forms and writes to the migrated schema.
Domain code expresses genuine operations such as instrument opt-in; it must not
replicate readers, DTO schemas, matchers or CRUD stacks. Restoration follows
`f027830a9790` through the existing UI/query path, as required by [the plan](04-implementation-plan.md).

## Fields and derived views

[View contracts](../../src/core/db3/shared/core/db3ViewContract.ts) derive static
and runtime DTOs from typed Prisma selections and field declarations. Load query
support dependencies even for narrow views, then strip query-only data. Root and
nested DTOs agree on public identity, required/optional presence, localized string
provenance and inherited metadata; do not create parallel payload definitions.

Localized fields separate resolved display/provenance from explicit locale edits.
No edit means no translation write. Inherited fields separate effective value,
raw override and source; only the override is encoded. Null inheritance remains
distinct from blank, false and zero. Unrelated saves must not materialize fallbacks.
Shared field validators serve generated CRUD and custom operations alike.

## Queries and snapshots

Small catalogs may use the shared resolved backend: load structurally eligible
rows/dependencies, batch-resolve text, apply authorized projection and predicates,
then sort/count/page and parse the DTO. Effective displayed text governs supported
matching; hidden/suppressed translations cannot match. Do not filter/page raw
localized values before resolution. Tokens compose AND across tokens and OR across
eligible fields; unsupported operators fail. The matcher implements a tested SQL
predicate subset, not every database collation rule. Resolved ordering uses
formatting locale, numeric ordering and stable public-ID ties.

Existing large SQL/search pipelines remain their owners. Authorized catalog views
resolve eligible names in the search snapshot, including band scope, ordered
preferences, blanks and availability. Each search domain declares its reference
fields and required permissions. Matching public references become trusted
relation identities before existing SQL predicates constrain rows, counts,
facets and paging; labels share a per-request cache with facet presentation.
Song/Event quick search uses the same catalog resolution for every requested
`#tag` before candidate limits, preserving its literal grammar and ranking.
The [earlier A1 exception](04-implementation-plan.md#localized-catalog-text-search-exception)
is closed. Rich search retains its existing filters/operators, sorting, paging,
exports and contextual public links.

[Read execution](../../src/core/db3/server/db3ReadExecution.ts) owns RepeatableRead
and authorization refresh. Rows, translations, availability and grants share the
snapshot. Ownership policy is independent of query strategy; ordinary Prisma
domains can request snapshot consistency. Root clients enter through shared
execution; internal transaction owners bind an explicit supported read context.
Reject raw transactions at that boundary. Detail queries constrain public identity
before loading/resolving rather than scanning catalogs for existence.

## Ownership and transactional writes

Declared band policies constrain reads/writes, including parent-owned relations.
Undeclared legacy domains reject selected-band generic requests. Verify referenced
rows in the same authorized transaction as mutation/auditing. Hidden catalog reads
need the relevant management grant. Existing hidden associations may be retained;
that does not make them new selectable choices. Hidden functional groups also
suppress their instruments from ordinary reads.

[Field writes](../../src/core/db3/server/db3FieldWrites.ts) dispatch transactional
field behavior. Localized fields own explicit-edit validation, inherited-source
checks, string identity and foreign-key patches using a transaction-bound writer.
Generic orchestration must not switch on catalog tables. Generated CRUD handles
ordinary catalogs; instrument opt-in composes group opt-in, and custom instruments
require an explicit group.

## References and controls

[Dashboard references](../../src/core/db3/shared/references/dashboardReferences.ts)
use canonical views in one fresh snapshot. Platform context yields empty band
collections. Display contracts expose effective metadata; editor views retain
raw overrides/string provenance. Register dependencies before dependent rows and
replace the reference store per snapshot. Details, chips and native editors read
it synchronously; richer global opt-in choices may need workflow-local queries.

Use public band-catalog and membership identities in associations, keeping shared
person identities for authors/profile links. Preserve serialized historical
formats through their owning adapter/migration, not a general raw/client union.
Exact entity fields and domain operations belong to declarations/source, rather
than being restated here.

Native grids/dialogs/pickers/forms use derived field contracts and existing app
wrappers. Captions/help use registered keys; technical field names are not UI
labels. Writing locale is explicit and enabled; drafts never copy another
language's fallback. Failed saves retain drafts, and picker creation must not
remount an unsaved parent form. Callers choose selection presentation style;
optional registered UI settings may override it without changing persistence.

Query/cache context carries band, route locale, ordered browser preferences and
presentation refresh identity. Consumers await dashboard/reference refresh after
CRUD; commands do not implicitly choose band invalidation. Presentation-affecting
writers use shared invalidation. Do not introduce private reference stores or
parallel global/band DTO families for ordinary catalog display.
