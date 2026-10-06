# DB3 band-instrument vertical slice

The initial implementation was completed 2026-10-06 as the first execution step
of phase 3 in [04-implementation-plan.md](04-implementation-plan.md). Review found
that its behavior works but its query, validation, view, form, and write paths
duplicate or bypass too much of DB3. **The slice has not met design acceptance.**
Rework it before extending the approach to another catalog. Phase 3 remains in
progress; the application is still unbuildable.

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
authorization, transactional persistence, auditing, and invalidation rather than
reimplementing them. The minimal dynamic-string writer remains shared and must
integrate with these field and persistence contracts.

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

These are the short-term gate for the instrument/group redesign, before adding
another catalog. Retain the initial slice's public-ID, ownership, visibility,
inheritance, translation-writing, audit, and cache-invalidation behavior recorded
below.

- [ ] Native DB3 quicksearch, autocomplete, field filters, sorting, count/page,
  reference hydration, grids, selection dialogs, and ordinary create/edit forms
  use the shared catalog contracts. Create-from-picker works where the entity
  permits it; richer instrument creation may still require its group workflow.
- [ ] Equivalent ordinary and resolved localized string values produce equivalent
  matches and pages under the same DB3 filters. Cover multiple tokens across
  fields, case/accents/patterns, blank/missing values, ordering ties, full counts,
  and pagination after resolution. Hidden translations do not affect matching.
- [ ] Full ordered preference lists, enabled locale changes, and band overrides
  affect queries and display consistently. Contexts with the same
  `formattingLocale` but different resolved values cannot share incorrect caches.
- [ ] All scalar/localized/inherited field values use DB3 validation and
  conversion. Ordinary CRUD and custom domain commands share those rules and
  write facilities. Unrelated edits do not materialize inherited/fallback values.
- [ ] Typed Prisma args derive the view and DTO contract through the preferred
  shared syntax. Column/filter/reference names are checked against declarations;
  no separate catalog sanitization or unchecked field-switch implementation
  remains.
- [ ] Generic DB3 entry points contain no instrument-specific exceptions.
  Ownership and selected-band admission use shared declared policies; legacy
  domains remain rejected until their ownership enforcement is adapted.
- [ ] Shared execution establishes fresh authorization and transaction policy.
  Two-band reads, references, revoked grants, writes, and rollback remain covered;
  page/RPC callers have no silent isolation or authorization-refresh obligations.
- [ ] The common behavior lives in DB3 and shared localization/persistence
  helpers. Catalog declarations and genuine domain operations explain the
  remaining custom code. Passing tests or registering bespoke callbacks alone
  does not satisfy this criterion.

After this gate, add **one other catalog**, preferably a simple tag catalog, to
prove reuse. Its work should primarily be table/field/view/label declarations,
client wiring, genuine domain rules, and relevant behavioral coverage. It must
reuse the query, validation, persistence, and UI machinery without another family
of equivalent readers, matchers, validators, forms, or endpoints. Address shared
gaps revealed by that catalog before broader phase-3 adaptation.

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

Rework the instrument/group slice using the settled query policy and shared DB3
contracts, then meet the design acceptance criteria above. Add one other catalog
as the reuse proof before adapting dashboard/reference and member-instrument
consumers, the remaining catalogs, membership/content views, global catalog
administration, and registered settings editors. Remove obsolete domain
contracts as their consumers migrate. Complete those adaptations and phase 4
acceptance before declaring milestone A.
