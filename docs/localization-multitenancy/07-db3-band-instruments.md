# DB3 band-instrument vertical slice

Implemented 2026-10-06 as the first execution step of phase 3 in
[04-implementation-plan.md](04-implementation-plan.md). This slice exercises the
target model through authorized entity reads, localized DB3 fields, reference
hydration, ordinary forms, and transactional commands. Phase 3 remains in
progress; the application is still unbuildable.

## Read and presentation contracts

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

## Write contracts

The strict `BandInstrument_Edit` command supports custom group/instrument
creation, global group/instrument opt-in, and band-entry updates. It requires
`admin_instruments` in the selected band. The RPC refreshes authorization inside
its serializable transaction, and all entity, translation, and audit writes share
that transaction.

Instrument opt-in also opts in its required functional group. Repeating opt-in
returns the existing public identity without duplicating records or audits.
Custom entries have no global source. Null scalar overrides remain inherited;
saving an unrelated field does not copy effective global values into overrides.
There are no generic insert/update/delete grants on these tables.

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

## Forms and recovery boundaries

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

## Validation

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

Continue phase 3 with dashboard/reference and member-instrument adaptation, then
apply these contracts to the remaining catalogs, membership/content views, global
catalog administration, and registered settings editors. Remove obsolete domain
contracts as their consumers migrate. Complete those adaptations and phase 4
acceptance before declaring milestone A.
