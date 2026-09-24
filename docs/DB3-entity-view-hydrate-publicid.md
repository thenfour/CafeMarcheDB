# DB3 entity/view architecture and public-ID migration

GitHub issues:

- [#519 use publicId on clientside instead of raw db id](https://github.com/thenfour/CafeMarcheDB/issues/519)
- [#697 introduce entity/view/hydrate for better design, automation, typesafety](https://github.com/thenfour/CafeMarcheDB/issues/697)
- [#698 xTable to strengthen typesafety](https://github.com/thenfour/CafeMarcheDB/issues/698)

This is a living design document. The entity/view/hydration/command architecture
described here is the supported DB3 baseline. The active project is no longer to
prove those primitives: it is to remove their remaining compatibility paths and
then migrate client-facing identity from numeric database IDs to `publicId`, one
bounded entity slice at a time.

## Motivation

- Client-facing information should be opaque to database implementation details.
  Client-visible entity identity therefore uses a UUID-like `publicId`, rather
  than the raw monotonic numeric database `id`.
- Translating identity at the transport boundary puts pressure on the old DB3
  assumption that a Prisma row, RPC payload, and useful client object all have
  roughly the same shape. They do not.
- Different uses of the same entity need different query shapes. Duplicating an
  `xTable` for each shape would also duplicate policy and relation metadata.
- Legacy `enrich*` functions such as `enrichSong` perform ad hoc and inconsistent
  DTO-to-client transformations. That transformation should instead be an
  explicit, typed DB3 responsibility.
- Some useful client objects are deliberately not database-shaped. Examples are
  `EventSongListContent` and `DateTimeRange`: they present semantic values and
  behavior while hiding the persistence representation.
- Authorization must remain effective across nested selections and hydration.
  Hydration must never reconstruct a field or relation that the server omitted.

The intended read pipeline is:

```text
Prisma selection
    -> recursive row/field authorization
    -> public-ID projection
    -> runtime-validated DTO
    -> transport
    -> synchronous hydration using explicit references
    -> client value
```

Writes have a separate pipeline:

```text
operation-specific client input
    -> named command serializer
    -> runtime-validated command DTO
    -> generic command RPC envelope
    -> server registry and repeated DTO validation
    -> authorized transaction and public-ID resolution
    -> command handler composed from DB3 row services
    -> runtime-validated result DTO
```

The two pipelines are intentionally not inverses. Hydration constructs a useful
read value from an authorized DTO. A command accepts whatever client-side input
best expresses an operation and serializes it to a purpose-specific write DTO.
The server remains authoritative for validation, authorization, persisted-state
invariants, and transactionality.

The intended converged client boundary is therefore:

```text
reads:  Entity -> View -> DTO -> hydrated client value
writes: row or action input -> Command DTO -> command handler -> persistence
```

Commands are intended to become the only DB3 client-to-server write transport.
That does not mean every write needs a bespoke aggregate implementation. The
command system should support two authoring levels:

- generated entity CRUD commands for ordinary single-row create, update, and
  delete operations; and
- handwritten domain commands for aggregates, workflows, and other operations
  whose contract is not meaningfully row-shaped.

The result is one mutation architecture with a simple form and an expressive
form, not an easy legacy path beside a more type-safe command path. The
TableClient CRUD facade retains useful automatic editor ergonomics, but it is now
command-backed; the former generic mutation transport has been removed.

## Current vocabulary and responsibilities

### `xTable`: policy and persistence metadata

`xTable` is the authoritative DB3 schema. It owns table and column
authorization, relation metadata, query/filter behavior, mutation behavior, and
the natural database primary-key member.

Entities and views form the typed transport and client boundary around that
schema; they do not replace its persistence policy.

Tables use `defineTable({ fields: makeColumnSet({ ... }) })`. The object key is
the single source of each field name: `makeColumnSet()` supplies it to the field
factory, verifies the resulting runtime member, and preserves object insertion
order in `xTable.columns`. The keyed field map is therefore the compile-time
authority while `xTable.columns` remains the ordered runtime representation. A
field whose database/DTO value differs from its client value declares a
`DB3FieldCodec<ReadTransport, Client, WriteTransport>`. Its `decode()` and
`encode()` implementations are the shared runtime authority, and its strict
one-way `readTransportSchema` validates a selected database value before decode
while its strict write schema describes the command-side value. Authorization
presence is derived separately: a selected field is required only when every
read branch uses `inheritRow`. Field authorization maps are declared through
`defineAuthMap()`, which records that result in an opaque type-level marker and
prevents raw or widened maps from silently losing required presence.
`DB3SchemaClientModel<Dto,
Fields>` applies decoding to a DTO while preserving its optional members;
`DB3SchemaMutationModel<Client, Fields>` derives the corresponding same-key
command values while allowing authorization to omit fields. The historical
`new xTable({ columns })`
constructor shape remains only as an explicit runtime-only compatibility path;
in-tree schema declarations no longer use it.

Domain-specific query behavior belongs with the table/entity or view that owns
it, not in DB3 core. `CMDBTableFilterModel.tableParams` is the transitional
carrier for table-level filtering, with `xTable.queryParameters` providing
runtime validation and field-authorization mapping. View-specific Prisma
behavior belongs directly in the view selection callback. For example,
`Event_Search` limits nested responses to the authenticated actor without a
client-supplied `limitResponsesToActor` flag. The longer-term type-safe API
should infer a view's query parameters just as it infers its DTO and client
result.

### xTable: stable identity and model anchor

The typed `xTable` is the stable, view-independent application description of a
database model. It binds together:

- keyed field and policy metadata;
- type-only Prisma delegate metadata, from which views derive their selected
  database payload type;
- an explicit `getIdentity()`, including whether consumer identity is a numeric
  legacy ID or a branded `publicId`.

The former `DB3Entity`/`defineEntity()` wrapper duplicated the table, delegate,
and identifier and has been removed. A view's `entity` property now references
its xTable directly. `DB3IdentityOf<TTable>` and
`DB3PrismaDelegateOf<TTable>` expose identity and Prisma contracts without
coupling callers to a particular view. Reference value types instead come from
the view-bound provider contract.

### View: one named read contract

`defineView()` represents one use-specific read shape for an entity. A view owns:

- a globally registered `viewID` tied to exactly one entity/table;
- a Prisma selection describing exactly what the database should return;
- a Zod DTO schema for the authorized transport shape;
- a reference contract describing which entity values may be grafted and their
  exact consumer types;
- a pure hydration function from DTO plus references to a client value.

For migrated views, `deriveViewContract(xTable, selection)` preserves the
literal Prisma selection unchanged and compiles the DTO schema plus default
hydrator from xTable field read contracts. Scalars use their transport schemas
and codecs; embedded relations recurse through their target xTables; a selected
normalized foreign key can resolve its consumer relation through the view's
reference contract and runtime provider. This keeps primitive database meaning
on xTable, query shape on the view, and normalized consumer shape on the
provider contract. A view may then compose domain hydration such as the Event date-range
transform without teaching DB3 core that domain concept.

The xTable relation graph may itself be cyclic, but generated DTO and client
graphs are not expanded from that graph eagerly. Relation fields may retain a
stable table-ID descriptor, which a type registry resolves only as the compiler
walks the view's finite explicit selection. This makes recursive schema
relationships type-safe without a recursion-depth cutoff or widened `any`
fallback. If a Prisma query also needs fields solely for authorization,
`deriveViewContract` accepts a recursively validated `transportSelection`
subset; the full selection is executed while only the subset defines the DTO and
hydration graph.

Association collections follow the same rule through `tagsRef`. The helper uses
Prisma's flat model metadata to validate the registered association and foreign
table IDs, both relation member names, their supported `${member}Id` scalar
members, and the exact foreign target without resolving the recursive xTable
types. The association xTable is resolved through `DB3TableTypeRegistry` only
when a view selection traverses that collection.

`File_Search` is the association-heavy proof: its five relation collections are
derived from a transport subset, normalized IDs use the reference provider, and
embedded targets recurse through their registered xTables. The small remaining
view transform maps the canonical Permission reference and drops associations
whose target was removed by authorization.

`ZodToPrismaSelection()` remains a supported primitive and existing explicit
DTO-first views remain valid. It recursively maps DTO shape to a Prisma select,
but it is no longer the preferred authority for a migrated read view because it
cannot obtain field nullability, codec behavior, or authorization presence from
the entity. Dynamic or exceptional views may retain handwritten schemas and
hydrators rather than weakening the derived contract.

The selection is the maximum data the view may need. DB3 still applies `xTable`
row, field, relation, soft-delete, and visibility authorization before validating
the DTO. A view ID supplied by a client is checked to ensure that it exists and
belongs to the requested table.

One entity may have several views, for example a compact list view, dashboard
reference view, search view, and detail/editor view. This is the replacement for
duplicating table schemas merely to obtain different payload shapes.

The view is also the source of result-type inference:

- `DbPayloadOf<TView>` is the selected pre-authorization Prisma payload;
- `DtoOf<TView>` is inferred from the Zod transport schema; and
- `ClientOf<TView>` is inferred from the hydration return type.

`useDb3Query({ view })` carries `ClientOf<typeof view>` through to `items`.
Consumers should not need assertions such as
`songsClient.items as SomePrismaPayload[]`. A cast at that boundary is a sign
that the view, DTO schema, hydration type, or query API is not expressing its
contract completely. Named-view query execution validates and hydrates results
automatically; ordinary consumers should not remember to call `enrich*` or a
hydrator manually.

The former Song filter path's `xSong_Verbose` table variant and
`SongPayload_Verbose` alias have been removed. It now queries canonical `xSong`
through `Song_Search`; the view owns the payload shape while its transport subset
keeps authorization-only selection members out of the DTO. `Song_Detail` now
uses the same derived contract mechanism over a narrower embedded File-card
projection, instead of inheriting unrelated File-detail reverse collections.
The final `enrichSong` caller and module have consequently been removed.

`FileTag_Editor`, `File_Detail`, and `File_Editor` likewise derive their DTO and
recursive hydration contracts from explicit Prisma selections. The full File
queries can still select hidden authorization-support members, while their
transport selections define the smaller public payload. File reverse relations
are registered, finite collection edges rather than untyped ghost fields. A
single typed File client normalizer removes association rows whose protected
target was elided and guarantees that every retained association has a concrete
target; Song's embedded File cards reuse the same boundary. The unused
`xFileVerbose` duplicate has been removed. The remaining `enrichFile` call is
confined to the legacy Event payload path and can disappear with that view's
migration.

### DTO: the authorized transport boundary

A DTO is neither a Prisma model nor the final rich client object. It is the
serializable shape that is allowed to cross the server/client boundary for one
view.

- Its type comes from the view's Zod schema, not from an asserted Prisma payload.
- Fields that field authorization may remove must be optional in the DTO.
- The compiler cannot know the requesting actor's runtime permissions. A field
  selected by a view but removable by field authorization is therefore
  optional for **every** client role, including Sysadmins. Callers must narrow
  it before use; there is no role-dependent TypeScript payload type.
- `undefined`/absent, `null`, and an empty collection have different meanings:
  unauthorized or unselected, explicitly no value, and an authorized empty
  collection respectively.
- Converted entities and references contain public identity, never their natural
  database identity.
- DTO validation happens after authorization/public-ID projection on the server,
  and may be repeated before hydration on the client.

### Hydration: pure DTO-to-client transformation

Hydration is a view responsibility and may return an arbitrary semantic client
value. It can:

- replace foreign-key values with canonical reference objects;
- combine persistence fields into a value object;
- merge several persistence collections into one ordered model; and
- attach behavior through a class or other non-transport client type.

Hydration is deliberately synchronous and performs no fetching. All fetching,
authorization, DTO validation, and reference-store population happen first. A
missing promised reference throws `DB3HydrationError` with its precise object
path; a relation remains absent when its authorized foreign-key member is absent.

`DB3ReferenceStore` is a request/session-scoped normalized store. The provider
registers already-constructed consumer values with its own identity extractor;
the value need not be a Prisma row or contain its identity. This avoids
repeatedly embedding the same lookup value, gives hydrated objects stable shared
references, and prevents each legacy `enrich*` function from inventing its own
lookup mechanism.

Hydration must preserve authorization omissions. In particular, it must not turn
an omitted collection into `[]` or restore an omitted object from a global cache
unless that reference was explicitly present in the DTO contract.

Hydration depth is defined by the named view, not by unrestricted recursion or a
client-provided depth number. Each view selects a finite graph and its hydrator
walks only that graph. Cyclic domain relationships such as
`Instrument -> Tags -> Instrument` therefore do not imply cyclic object
expansion: a relation either stops at an identity/reference view or names a
different finite nested shape. Hydration never discovers and fetches another
level on demand.

### Command: one named write contract

`defineCommand()` is the write-side sibling of `defineView()`. A command owns:

- a globally meaningful `commandID` and root entity;
- an arbitrary typed client input;
- a pure serializer from that client input to a strict transport DTO;
- Zod schemas for both the command DTO and result; and
- the corresponding inferred client-input, DTO, and result types.

The client descriptor and server handler are deliberately separate. The shared
command describes the transport contract without importing server code. A
server-only `defineCommandHandler()` binds that descriptor to its implementation,
and the handler must be added to the server command registry. The generic RPC
entry point rejects unknown command IDs, opens one serializable transaction,
revalidates the DTO, builds fresh request authorization, executes the registered
handler, and validates its result.

A handler receives a `DB3CommandExecutionContext` containing the transaction,
request authorization, and DB3 row services. Those services wrap the existing
server `insertImpl`, `updateImpl`, and `deleteImpl` primitives rather than
reimplementing row mutation policy. They therefore preserve authoritative
`xTable` validation and authorization, public-ID and foreign-ID resolution,
auditing, and mutation hooks. The context also provides explicit visibility
checks for referenced entities and an aggregate-level post-mutation hook.

Commands may operate on aggregates. This is analogous to a view selecting and
authorizing a finite graph rather than only one table row: the command handler
coordinates the finite write graph, while each participating row still passes
through its entity's DB3 policy. Aggregate invariants such as child ownership,
reference visibility, omission-as-deletion, ordering, and final domain effects
belong to the command handler.

#### Why `useDB3Command()` exists

`useDB3Command(command)` is more than a naming wrapper around Blitz
`useMutation()`:

- it preserves one compile-time chain from the command's client input through
  its DTO to its result;
- it calls the command-owned serializer, so a component does not construct or
  know the transport shape;
- it validates the serialized DTO on the client, sends the generic
  `{ commandID, payload }` envelope, and validates the returned result;
- one save command can choose insert versus update from the input instead of
  making the component select separate RPC endpoints; and
- callers depend on a shared operation contract, not on a server resolver
  module or its incidental parameter shape.

| Concern | Raw `useMutation()` | Retired generic TableClient transport | `useDB3Command()` |
| --- | --- | --- | --- |
| Client input | Resolver input | Table/client-column row | Arbitrary command input |
| Client transformation | Caller or endpoint-specific helper | Generic `prepareMutation()` | Command-owned `serialize()` |
| Transport contract | One imported RPC resolver | Generic table-mutation envelope | Named strict command DTO and result |
| Server unit of work | Whatever that resolver implements | One generic row operation | One registered aggregate-capable handler |
| Authorization | Resolver-defined | DB3 table/row/field policy | Handler invariants plus the same DB3 row policy |
| Transaction | Resolver-defined | One row mutation request | One serializable command transaction |
| Refetch/editor lifecycle | Caller-defined | Partly integrated | Currently caller-defined |

These are client ergonomics and contract guarantees, not the security boundary.
The server reparses the DTO and performs all authoritative authorization and
persisted-state checks. The hook also does not currently refetch queries or
manage editor state automatically; callers still choose their cache/refetch and
success/error behavior.

Raw Blitz `useMutation()` remains appropriate for endpoints that have not been
migrated or that do not need a DB3 command contract. It leaves input shaping,
endpoint selection, result interpretation, and any client-side runtime checking
to each caller.

The former generic TableClient mutation transport combined row preparation,
transport, and refetching behind a table-name envelope. The supported
TableClient remains a useful query/render and row-preparation facade, but writes
now invoke generated entity CRUD commands. `prepareMutation()` still walks the
configured client columns and `xTable` fields, converts client values to
database-shaped command values, and performs advisory client-side authorization
filtering. It no longer selects a generic mutation endpoint.

Generated entity CRUD commands make conventional row editing as automatic as
the old path while providing strict operation-specific input and result types.
They reuse existing column transformation, validation, authorization, auditing,
hook, and public-ID machinery internally. The public client contract does not
expose `TAnyModel`, table names, numeric table IDs, or a generic mutation
envelope merely because the implementation delegates to mature DB3 row
services.

`defineEntityCrudCommands()` is the low-level foundation for that contract. It
establishes the enabled operation descriptors from an entity, explicit
operation flags, its runtime identity schema, and create/update field schemas.
The returned contract always has fixed `create`, `update`, and `delete` slots;
unsupported optional operations are `undefined`, while every enabled operation
carries its discriminating `kind` and command descriptor:

- create accepts the strict create DTO directly; natural and public identity
  fields are server-owned and cannot be declared by the writable schema;
- update accepts `{ identity, patch }`, where the patch is shallow, strict,
  non-empty, and applies only its present keys; `undefined` is rejected rather
  than being confused with omission, while `null` remains field-schema-defined;
- delete accepts only `{ identity }`; hard-versus-soft behavior comes from the
  trusted `xTable.deletePolicy`, not from client input; and
- all enabled operations return the strict `{ identity }` result needed to find
  or refetch the affected row without returning a persistence-shaped object.

The shared generated handlers compose `DB3CommandExecutionContext.rowServices`,
so validation and authorization failures continue to use the existing thrown
DB3/Zod error path and the generic command RPC transaction. They do not convert
failures into a second result union. Command descriptors declare affected entity
IDs with `invalidation.mode: "caller"`; `useDB3Command()` exposes that metadata,
but callers still own refetching until DB3 has a normalized client query cache.

That low-level factory is not intended to be the per-entity authoring surface
for ordinary editors. Requiring each simple table to repeat writable schemas,
serializers, three command hooks, a handler module, registry entries, and a grid
adapter would discard the main ergonomic benefit of the existing TableClient:
a conventional editor is automatic once its schema and columns are declared.

#### CRUD-enabled views and automatic editors

Ordinary row editing should be exposed through a CRUD-enabled named view. A
generic `defineCrudView()` composes the normal `defineView()` contract with the
generated CRUD command foundation. It receives the same entity, selection, DTO
schema, and hydration as a normal view, plus an explicit capability object such
as `operations: { create: true, update: true, delete: true }`. Update is the
required baseline; create or delete can be omitted independently. The returned
view carries the same fixed operation slots at `view.crud.operations`, so
consumers use `create?.command`, `update.command`, and `delete?.command` without
permutation-specific view types or presence guards.

The CRUD contract is derived from two existing authorities:

- the view supplies the selected DTO shape and hydrated client type; and
- the view's entity supplies the typed client identity and links to the existing
  `xTable`, which continues to supply
  new-row defaults, writable-column behavior, validation, field and row
  authorization, client-to-database transformation, delete policy, and
  public-versus-natural identity metadata.

`defineCrudView()` does not perform an implicit table conversion. Its hydrator
receives the declared DTO and must explicitly return the client type. A typed
table may make that concise and checked, for example
`hydrate: dto => table.getClientModel(dto, "view")`. This preserves established
field behavior such as `ColorField.ApplyDbToClient`, where a stored color ID is
represented by a `ColorPaletteEntry`, without falsely typing the hydrator input
as the unchanged DTO.

All in-tree CRUD views now use `defineCrudView()` and explicitly own DTO-to-client
hydration. The zero-consumer `defineLegacyCrudView()` compatibility constructor
and its unsound DTO/client cast have been removed. Prepared command values still
travel in the opposite, database-shaped direction;
generated command schemas convert each value back through the table contract
before invoking the field's client-value validator.

This is deliberately the same limited CRUD model supported by TableClient
today. A CRUD-enabled view does not make arbitrary computed fields, nested
relations, or rich hydrated objects automatically writable, and hydration does
not need to become generally reversible. The existing table/client-column
mutation preparation path determines which configured editor values can be
serialized. Existing `xTable` column types and authorization maps continue to
govern server-owned fields such as `createdAt`; the CRUD-view layer must not
introduce a parallel writable-field policy or require per-view omit lists for
facts already expressed by the table schema.

The client counterpart is a generic `useCrudTableRenderContext()` with arguments
similar to `useTableRenderContext()`, plus a CRUD-enabled view. It:

- queries and hydrates through the supplied view;
- infers its row type as `ClientOf<TView>` and its identity as
  `DB3IdentityOf<TableOf<TView>>`;
- uses typed client-column mutation projections followed by field codec
  encoding for create and update values;
- computes an update patch from the prepared previous and next values;
- invokes the view's generated commands; and
- owns the conventional refetch and invalidation lifecycle.

The new `defineTableClientSpec({ view, columns })` path binds presentation to the
same concrete view. Its keyed factories receive the object key as their runtime
column name, and every key and declared client value type is checked against
`ClientOf<TView>`. Reusable declarations use `makeClientColumnSet()` for the
same single-name contract. Table-only callers use the explicitly named
`defineLegacyTableClientSpec()`, which checks field keys but deliberately carries
no view-derived row type. The few callers whose schema or column name is chosen
at runtime use `defineLegacyDynamicTableClientSpec()` and receive no static key
validation. Direct construction is deprecated. A runtime guard also rejects
pairing a view-bound spec with a different CRUD view.

`TView` propagates from the spec through `useTableRenderContext()` and
`xTableRenderClient<TView>`. The spec's view is the single runtime source for
the query `viewID` and hydration, so `items` is `ClientOf<TView>[]` without a
caller-supplied row generic. Table-only callers use the separately named
`useLegacyTableRenderContext()` and retain the old caller-declared row type.
The named-view overload of `useDb3Query()` accepts only a view-bound spec; when
the caller needs no presentation columns, it constructs an empty typed spec for
that view. The former `bindLegacyTableClientSpecToView()` adapter has been
removed rather than silently upgrading a table-only spec.

Mutation preparation follows three distinct stages: a client column returns a
mutation patch (composite date-range columns can return several fields), xTable
field codecs encode rich values such as `ColorPaletteEntry`, and authorization
may remove keys. `prepareMutation()` therefore returns the view-derived partial
command-value model. The old mutable `ApplyClientToPostClient` fallback is
accepted only by an explicitly legacy spec.

`DB3EditGrid` uses that hook internally. The ordinary call site remains
limited to presentation metadata and the semantic view:

```tsx
<DB3EditGrid
    tableSpec={tableSpec}
    view={instrumentFunctionalGroupEditorView}
/>
```

It does not require per-entity command hooks, DTO mappers, mutation adapters, or
knowledge of command IDs. Creation intentionally retains the current row-shaped
TableClient model and limitations. A more general first-class edit-draft
abstraction is separate, deferred work.

Because command descriptors and handlers must also exist on the server,
`defineCrudView()` performs module-level composition and registration while
`useCrudTableRenderContext()` only performs client-side invocation. Generated
CRUD views are discoverable by one operation-driven server handler factory,
which iterates the enabled descriptors and dispatches on their `kind`. An
ordinary entity therefore does not need its own handler file, manual
command-registry entries, or a factory for each capability permutation. This
registration remains an allowlist of declared CRUD views; clients cannot
nominate arbitrary database tables.

A handwritten command is preferable to generated CRUD when the operation:

- accepts a rich client value that is not a table row;
- has an operation-specific strict DTO or result;
- spans multiple entities or tables;
- must enforce aggregate invariants in one transaction; or
- should hide insert/update choice and persistence layout from the component.

Handwritten commands do not call the row-shaped `prepareMutation()` path.
Their serializer is the explicit client-input-to-DTO transformation, while the
server command row services reuse the authoritative DB3 row mutation core. A
generated CRUD view may reuse TableClient's current mutation preparation because
its purpose is precisely the same constrained row-shaped editing behavior. This
does not make that table-shaped serializer responsible for aggregate semantics.

The TableClient CRUD facade now delegates to generated commands. Its old generic
mutation transport, table-name envelope, capability flag, and RPC endpoint have
been removed. The high-level grid/editor facade remains because its automatic
editor ergonomics are useful independently of the retired transport.

### Client values, editable drafts, and mutation commands are distinct

A hydrated client value is optimized for reading and application behavior; it is
not automatically an editing or persistence model.

Complex editors should use an explicit progression:

1. hydrated client value;
2. editable draft, including temporary client identities for new items;
3. validated mutation command; and
4. a server-owned transactional write.

The event-song-list work is the current example: separate persistence
collections hydrate into `EventSongListContent`, then adapt to an editor draft,
and finally serialize through `saveEventSongListCommand` to one
runtime-validated command DTO. The draft owns one ordered `items` collection
and temporary client identities. The command serializer alone recreates
persistence's split `songs`/`dividers` collections and their `sortOrder` values;
the component and draft module no longer know the RPC DTO shape.

`useDB3Command(saveEventSongListCommand)` accepts that draft for both creation
and update. Its registered server handler performs parent and child writes in
one serializable transaction, verifies that persisted child IDs belong to the
setlist, checks referenced event/song visibility, composes the DB3 row services,
and runs final aggregate mutation effects. Authorization-incomplete client
values cannot become editable drafts. This is a domain-specific aggregate
model, not a required abstraction for ordinary DB3 row editing.

A read DTO's optional fields must not silently become optional write semantics.
An editor should either require the complete fields needed to construct its
draft or use a purpose-specific patch command. The server always validates and
authorizes a command again against persisted state.

### Deferred: first-class edit models

The setlist migration exposes a useful general DB3 enhancement: draft creation,
hydrated-client-to-draft adaptation, deep cloning, and temporary client identity
allocation could be expressed by a typed `DB3EditModel`. That enhancement is
explicitly outside the active public-ID migration.

The current supported boundary is sufficient for identity conversion:

- ordinary row editors use the command-backed CRUD-view/TableClient model;
- aggregates may define purpose-specific drafts and handwritten commands; and
- commands that represent actions such as publish, approve, reorder, or merge
  accept their operation-specific inputs directly.

A future edit-model project may compose `create`, `beginEdit`, and `clone`
operations through a `useDB3Editor()`-style API. It must keep drafts detached
from hydrated query values and should distinguish persisted identity from an
opaque local key. None of those decisions blocks converting an entity or its
relations to public identity, so they are not roadmap prerequisites here.

### Remaining compatibility boundaries

The target design has no generic query/view `customData` bag. A domain that
needs an unusual shape should define that shape in its view DTO and hydration
result so it remains typed and authorized. This does not by itself remove
domain persistence columns that happen to be named `customData`, such as file
metadata; those are separate schema/migration decisions.

`GhostField` remains a transitional way to acknowledge a Prisma member that DB3
does not fully model. It may remain for deliberately opaque or server-owned
fields when no richer behavior is needed. It must not be used for a relation
that needs recursive authorization, visibility filtering, public-ID
translation, or hydration. Such a relation needs a real relation descriptor,
for example `ForeignCollectionField`, so generic traversal can enforce policy.

### Ordering is semantic, not identity-based

Natural database IDs are not a client-visible ordering contract. Generic search
and grid APIs must not expose `id` as a sort option, choose it as their default,
or append it as an implicit tie-breaker. A request supplies at least one
authorized semantic sort; table/view defaults use fields such as name, date, or
explicit `sortOrder`. If deterministic pagination needs additional ordering,
the view must define another appropriate semantic key rather than leaking
insertion order through the primary key.

### Module organization

The historical concentration of Prisma selections, payload aliases, schemas,
and API types in files such as `prismArgs.ts` and `apiTypes.ts` is not the target
layout. New entity/view work should be colocated under
`shared/entities/<entity>/`, with separate modules where useful for:

- stable entity metadata;
- named views and DTO schemas;
- hydrated value objects;
- editable drafts; and
- handwritten command descriptors, DTO/result schemas, and serializers.

Handwritten server command handlers remain under `server/commands/`, beside the
generic dispatcher, handler registry, and command execution context. This keeps
the shared command contract importable by clients without pulling server
mutation code into the domain's shared module. Generated CRUD commands are
instead composed and registered generically by `defineCrudView()` and must not
require per-entity command or handler modules.

This does not require a big-bang move of every existing `xTable`, but a migrated
slice should not add another payload alias or domain command to a historical
catch-all file merely because similar legacy definitions are there.

### Design pressure cases

The abstraction should continue to be tested against materially different
shapes, not only simple row queries:

- a scalar foreign reference such as `eventTagId -> eventTag`, resolved through
  the normalized reference provider;
- a field-authorized partial DTO where scalar fields or whole nested
  collections are absent;
- a semantic value object such as event timing hydrated into `DateTimeRange`,
  with useful behavior rather than only renamed fields;
- a heterogeneous aggregate such as a setlist, where separate persistence
  collections become one ordered client model and a distinct editor draft;
- a cyclic domain model whose named view deliberately stops at a finite
  reference boundary; and
- a converted public-ID entity participating in reads, filters, foreign keys,
  mutation commands, caches, React keys, and routes.

Future rich objects may also expose domain operations such as URI generation,
provided those operations are deterministic client behavior and do not conceal
I/O or authorization decisions.

## `publicId` design

### Purpose and non-goals

`publicId` is the canonical identity for an entity wherever that entity crosses
the client boundary. It prevents URLs and payloads from exposing monotonic table
keys, reduces accidental coupling to database layout, and makes casual entity
enumeration impractical.

It is **not** a credential or authorization mechanism. Knowledge of a valid
`publicId` grants nothing. Every query and mutation must still enforce route,
table, row, field, relation, visibility, and soft-delete authorization. Errors
should not become an existence oracle for rows the actor cannot view.

The human-readable slug in a URL is presentation only and contributes no
security. A future canonical URL would use `publicId` plus an optional slug.

### Representation

The current contract is:

- 96 cryptographically random bits, generated server-side with `randomBytes(12)`;
- base64url encoding, producing exactly 16 characters;
- alphabet `A-Z`, `a-z`, `0-9`, `_`, and `-`;
- stored as unique, non-null `CHAR(16)` with an ASCII binary/case-sensitive
  collation;
- immutable after creation; and
- represented in TypeScript as `PublicId<"EntityName">`, so IDs from different
  entities are not accidentally interchangeable in typed code.

The 16 characters are the full encoding of the 96 random bits; this is not a
truncated textual UUID. No entity prefix is used. A prefix such as `usr_` would
consume URL space without adding useful information while IDs live in
entity-specific routes and fields. Revisit prefixes only if IDs must share a
single polymorphic/global namespace.

### Natural IDs remain internal

Numeric `id` remains the database primary key and numeric foreign keys remain the
normal persistence representation. Server code, Prisma joins, transactions,
auditing, and diagnostics may use them. Existing natural identities such as the
Blitz session `userId: number` are not automatically part of this migration.

For a converted entity:

- canonical client DTOs omit the natural ID for every role, including Sysadmins;
- client references to that entity use its public ID, even when the referring
  entity itself has not yet been converted;
- grids, selectors, caches, and React keys use the client/entity identity rather
  than assuming `.id`; and
- update and delete commands identify the target with the entity's canonical
  identity. Inserts may not supply `publicId`.

If a Sysadmin diagnostic or export genuinely needs the numeric ID, expose it via
an explicitly internal/admin-only view or server operation. Do not make the
canonical public DTO dual-shaped according to the viewer's role.

`xTable.clientIdMember` is the compatibility bridge used by legacy generic DB3
components: it resolves to `publicIdMember` for converted tables and `pkMember`
otherwise. New entity/view code should prefer the typed entity or view
`getIdentity()` contract instead of inspecting either member directly.

### Translation boundary

Translation belongs at the trusted server boundary:

- incoming public mutation targets are resolved to natural IDs only after format,
  visibility, and authorization checks;
- scalar foreign keys pointing to converted entities are resolved from public to
  natural IDs before Prisma mutation code runs;
- inner mutation, hook, audit, and transaction code continues to use natural IDs;
- query and mutation results recursively replace converted foreign keys with
  public IDs and remove converted natural IDs before DTO validation/transport;
  and
- `filter.publicIds` is the client-facing identity filter for converted tables.

This translation must be centralized in DB3 or explicitly invoked by a
non-DB3 server endpoint. A raw Prisma result must not be returned directly merely
because the endpoint itself is trusted.

Command row services resolve both scalar `ForeignSingleField` references and
many-to-many/tag identity arrays at their trusted boundary. Generated tag-field
command DTOs derive the array element type and runtime identity schema from the
association target, so converted targets accept only public identities before
the row service resolves them to natural join keys.

### Creation, collision handling, and migration

Normal inserts generate `publicId` on the server. The database unique constraint
is authoritative; a detected `publicId` collision generates a new value and
retries a bounded number of times.

For a legacy table migration:

1. add a nullable `publicId` column;
2. populate unique deterministic placeholders beginning with `~`;
3. make the column non-null and add its unique index;
4. deploy/start the server, whose Node instrumentation replaces placeholders in
   batches with real random IDs using conditional updates and collision retries;
5. verify that no placeholders remain; and
6. switch all client routes, DTOs, references, filters, and commands together.

`~` is outside the valid public-ID alphabet, so a placeholder can never be
accepted as client identity. Conditional updates make concurrent application
startups safe.

Legacy numeric URLs are intentionally invalidated rather than supported through
a per-row compatibility flag or a second lookup mode.

### Established baseline and remaining migration limits

- `InstrumentFunctionalGroup` is the public-ID pilot. `InstrumentTag` is the
  second converted DB3 entity and proves the association/tag mutation path.
- The entity/view/hydration/command boundaries are established well enough to
  begin broad public-ID migration. Further general DB3 architecture work is not
  a prerequisite unless a concrete entity conversion exposes a missing identity
  capability.
- Public-ID rollout remains incremental rather than a big-bang schema exercise.
  Every converted slice must include its reads, writes, relations, filters,
  caches, routes, and non-DB3 boundaries before its numeric client identity is
  considered removed.
- Entity/view/hydration/command primitives exist, and initial instrument, event,
  file, song, and event-song-list views use the read-side primitives.
- `defineView()`, `DbPayloadOf<>`, `DtoOf<>`, `ClientOf<>`,
  `DB3ReferenceValueOf<>`, and typed `useDb3Query({ view })` establish the intended
  inference chain without result casts.
- `defineTable()`, field `DB3FieldCodec`s, explicit mutation projections,
  `DB3SchemaClientModel<>`, and `DB3SchemaMutationModel<>` establish both
  directions of the typed schema link. The `InstrumentFunctionalGroup` pilot's
  hydrated `color` member is
  inferred as `ColorPaletteEntry | null | undefined`; its prepared and generated
  command value is `string | null | undefined`; and its public-ID identity
  remains statically checked through the TableClient.
- `TView` now propagates through view-bound TableClient specs and
  `useTableRenderContext()`, so query results expose `ClientOf<TView>[]` and
  client columns are checked against the hydrated row type. Explicitly legacy
  table-only and runtime-dynamic specs remain cleanup targets rather than an
  alternate typed architecture.
- All in-tree `xTable` declarations now use keyed `makeColumnSet()` factories,
  and fixed-name TableClient declarations use keyed client factories. Reusable
  column sets follow the same contract. Composite event date-range columns are
  keyed by their actual primary field, `startsAt`, while companion fields remain
  explicit configuration. Runtime-selected legacy clients are separately named
  and intentionally retain no inferred key or row contract.
- Event timing proves hydration into a behavioral `DateTimeRange` value rather
  than merely renaming fields. `Event_Frontpage` now proves that this transform
  composes after xTable-derived scalar/relation hydration; EventStatus,
  EventType, and EventTag editor views derive their full read contracts from
  explicit Prisma selections.
- Event song lists prove collection reshaping and a separate write model:
  `EventSongListContent` merges songs and dividers, the editor consumes an
  `EventSongListDraft`, and `saveEventSongListCommand` owns draft-to-DTO
  serialization for both creation and update.
- `defineCommand()`, typed `useDB3Command()`, the generic command RPC, the
  server handler registry, and `DB3CommandExecutionContext` establish the first
  named write-contract path. DTO and result validation occur on both sides of
  transport as appropriate; server authorization remains authoritative.
- `defineEntityCrudCommands()` and `defineEntityCrudCommandHandlers()` establish
  strict create/update/delete contracts for ordinary rows. Generated deletes
  derive hard-versus-soft behavior from trusted table metadata, update patches
  use present-keys-only semantics, results return canonical identity, and
  callers explicitly own refetching declared by command invalidation metadata.
- Generic CRUD-enabled views now compose named reads with generated entity CRUD
  commands. The command-backed table-render context retains existing
  TableClient/client-column preparation, computes present-keys-only update
  patches, invokes generated commands, and owns refetching. Server handlers are
  discovered from registered CRUD views rather than wired per entity.
- The `InstrumentFunctionalGroup` grid proves that generic path against the
  public-ID pilot. Its view-bound table spec checks all configured column keys
  and value types against the hydrated row. Its call site supplies only that
  `tableSpec` and editor view;
  it has no entity-specific writable schema, serializer, handler file, registry
  entry, command hooks, mutation adapter, numeric ID, or generic mutation
  envelope.
- Selection creation can now opt into the same CRUD view. Both the generic DB3
  selection source, `ForeignSingleFieldRenderContext`, and tag-field selector
  query and hydrate
  through that view, invoke its generated create command, and read the returned
  canonical identity back through an authorized exact-identity view query
  before publishing it as the selected value. A successful create that is not
  readable through the view fails explicitly rather than manufacturing a
  partial client row. The Instrument editor's functional-group and tag selectors
  prove this path with public IDs. Create-from-string has no generic mutation
  fallback: a creatable selector must name the matching CRUD view, and a
  mismatched or missing view fails explicitly.
- `DB3NewObjectDialog` now requires its table-render client to be injected. The
  grid-owned dialog therefore cannot silently construct a second legacy
  mutation client underneath a command-backed grid.
- `DB3AssociationMatrix` now requires an explicit association command and no
  longer requests TableClient mutation capability or posts a client-built tags
  array. `defineAssociationCommand()` standardizes rich-row-to-identity
  serialization and strict desired-state DTO/result validation. The
  RolePermission handler reloads both authorized endpoints and the current join
  set inside the command transaction, then applies the idempotent change through
  the schema-owned `Permission.roles` association field so its authorization,
  auditing, and mutation hooks remain authoritative. Role and Permission still
  use numeric identities; the same identity-aware command transport can use
  public identities when either endpoint is converted.
- The registered event-song-list save handler now performs parent, song, and
  divider synchronization atomically in one serializable transaction by
  composing authorized DB3 row services. The two legacy insert/update RPCs and
  the raw `UpdateEventSongListSongs` path have been removed.
- Setlist divider persistence fields needed by the command are real DB3 fields
  rather than `GhostField`s, so normal validation, transformation, and field
  authorization apply. Setlist delete and generic list reordering remain on
  legacy endpoints, and the server does not yet normalize or reject malformed
  combined song/divider `sortOrder` namespaces independently of the trusted
  serializer.
- Legacy queries without a named view still use `xTable.getClientModel()` and the
  generic public-ID projector.
- Some server-owned dashboard loaders query Prisma directly, then explicitly
  project and validate named DTOs. The desired endpoint is for view execution to
  own this consistently.
- Legacy `enrich*` helpers and asserted Prisma payload aliases remain and should
  disappear as their consumers move to named views.
- Association-matrix assumptions, generic sorting/reordering, and raw-SQL/search
  boundaries must be audited as their participating entities are converted.
  Generated many-to-many/tag command inputs and row-service resolution are
  already identity-aware.
- Raw SQL returned in `SearchResultsRet` is intentionally unchanged for now and
  is expected to be removed separately.
- Most unconverted named views still expose numeric identities. They are the
  input inventory for the active migration, not a permanent client contract.
- The legacy TableClient mutation transport has been removed. Ordinary row
  editors use generated entity CRUD commands; aggregate and workflow operations
  use their existing explicit endpoints or named domain commands while those
  boundaries are migrated independently.

### Retired TableClient mutation transport guard

The source test `tests/db3LegacyMutationInventory.test.ts` now enforces an empty
legacy inventory: there may be no `xTableClientCaps.Mutation` acquisition and no
call to `doInsertMutation()`, `doUpdateMutation()`, or `doDeleteMutation()`. It
also asserts that every writable `DB3EditGrid` supplies a command-backed CRUD
view. A new legacy capability or call therefore fails the test.

Writable grids make this boundary visible in their type contract. A grid must
now supply a CRUD-enabled `view`; the writable legacy branch and its
`legacyMutationTransport` escape hatch have been removed. A read-only grid can
still use the query-only TableClient facade without requesting mutation
capability.

The resulting stable writer boundaries are:

| Category | Remaining generic-transport surfaces | Supported boundary |
| --- | --- | --- |
| Row CRUD grids | None | Every writable `DB3EditGrid` now uses a command-backed editor view. File creation remains owned by the upload workflow rather than the metadata grid. |
| Entity detail editors | None | Song, Event, File, User/Profile, and Wiki tag metadata now use generated CRUD commands for row-shaped patches. Privileged and operation-specific actions remain named workflows. |
| Nested rows and relationships | None | Embedded Event Segment, Song Credit, File metadata, profile instrument-set, and Setlist Plan Group edits now use generated CRUD commands. Setlist group reordering remains an explicit ordered operation. |
| Collection editors | None | Custom Link and Menu Link row edits use generated CRUD commands over narrow editor DTOs. Menu Link ordering remains an explicit scoped collection operation. |
| Workflows and aggregates | None use the generic TableClient transport. | Gallery baking/reordering, setlist planning, and similar multi-step flows remain explicit endpoints or named commands according to their existing domain boundary; redesign is not a public-ID prerequisite. |
| Compatibility infrastructure | None in production | The capability flag, client mutation methods/helpers, selection fallbacks, and generic table-selected mutation RPC have been deleted. |

The retired RPC's hostile-input and row-authorization coverage remains in a
clearly test-only compatibility resolver. It composes the same production row
services but is not an application RPC endpoint.

The completed conversion history is intentionally not reproduced here. The
current source and tests are authoritative; the relevant stable result is
that all production writers use generated CRUD or explicit workflow/aggregate
boundaries, and none use the retired generic TableClient mutation transport.

## Design principles

- Define an entity once; define multiple named views for its use-specific shapes.
- Keep authorization and visibility policy on the server and schema-owned.
- Treat the DTO schema as a real runtime boundary, not only a TypeScript aid.
- Make view relation graphs finite and explicit. Cycles in the schema metadata
  are valid, but derive only the edges named by the Prisma selection; do not
  recursively hydrate an unbounded object graph.
- Hydration is deterministic, synchronous, and free of I/O.
- Hydration traverses only the finite graph declared by its named view.
- Do not pretend arbitrary view hydration is reversible. Use field codecs only
  for genuinely reversible values and named command serializers for semantic or
  aggregate models.
- Preserve the difference between absent, null, and empty.
- Prefer semantic client values over persistence-shaped bags of fields.
- Do not use a hydrated read model as an implicit write model.
- Define named commands for operation-specific or aggregate writes; keep their
  client input, strict DTO, strict result, and server handler connected by one
  typed contract.
- Use generated entity CRUD commands for ordinary row writes so commands become
  the sole DB3 client mutation boundary without making simple editors verbose.
- Compose ordinary CRUD from a named view and its linked `xTable`; do not repeat
  table policy, writable schemas, field serializers, handlers, or registry
  wiring for each simple entity.
- Preserve the command-backed TableClient/grid facade as the supported automatic
  row-editor API.
- Treat `useDB3Command()` serialization and validation as client contract
  ergonomics, never as a replacement for server validation or authorization.
- Compose aggregate command handlers from the existing authoritative DB3 row
  mutation services instead of copying table authorization and mutation rules.
- Do not reintroduce the retired generic TableClient mutation transport or add a
  second write path beside commands.
- Keep domain-specific filters and selection behavior out of DB3 core.
- Do not add generic untyped payload bags where a named DTO/client shape can
  express the requirement.
- Never use natural identity as a client sort contract or hidden default sort.
- Keep natural/public identity conversion at the transport boundary; internal
  persistence code continues to use the database's natural keys.
- Never treat opacity as authorization.

## Migration method

Migration proceeds through vertical slices with deletion gates. The read and
write foundations and command-backed generic CRUD path are complete. First
remove or normalize the remaining explicitly transitional view/query adapters;
then convert entities to public IDs one bounded model slice at a time.
Compatibility seams are acceptable only while a named entity slice is in
flight, and must be removed when that slice lands.

Migrate one bounded entity/view/consumer slice at a time:

1. Trace the current Prisma selection, `xTable`, manual enrichment, casts,
   mutation inputs, raw-SQL paths, and all consumers for that use case.
2. Reuse or define the stable entity, then define a named view with the maximum
   required selection and an authorization-compatible Zod DTO.
3. Replace relation `GhostField`s needed by that graph with real relation
   metadata so recursive policy remains generic.
4. Hydrate to the semantic client value and consume it through typed
   `useDb3Query({ view })`; remove the corresponding manual enrichment and
   result casts in the migrated slice.
5. For a rich or aggregate operation, use an explicit client input and
   handwritten command rather than sending the hydrated read model back to the
   server. A domain-specific draft is appropriate when the editor needs one,
   but no generic edit-model contract is required. Put client-input-to-DTO
   transformation on the command and compose its writes from DB3 row services
   inside the command transaction.
6. For ordinary row editing, define a CRUD-enabled view and let the generic
   table-render context derive and invoke generated CRUD. Preserve the current
   limited TableClient payload behavior rather than adding per-entity adapters;
   reserve handwritten commands for aggregates and domain actions.
7. Audit identity, sorting, caches, keys, URLs, filters, mutations, associations,
   raw SQL, routes, and exports before converting that entity to `publicId`.
8. Add tests for complete and field-stripped DTOs, nested authorization,
   hydration failure paths, inferred result types, and relevant write/identity
   behavior.
9. Migrate every consumer in the bounded capability, then remove the replaced
   enrichment, compatibility adapter, dual identity, or numeric-identity
   surface.

Do not combine all public-ID migrations into one architecture refactor. Convert
entities individually once each bounded slice has coherent read and write
boundaries. New generic facilities must remain compatible with the existing
public-ID pilot so the first-stage migration does not introduce fresh numeric-ID
assumptions, but converting an individual consumer to commands does not also
require converting that entity's identity.

### Definition of a migrated entity

An entity is complete only when the applicable items below are true:

- it has stable typed entity metadata and named client views;
- view DTOs are runtime validated and hydrate without result casts or
  supplemental `enrich*` work;
- ordinary editable rows use generated CRUD commands, while aggregates and
  actions use explicit operation inputs and handwritten commands as needed;
- all client writes use strict generated or handwritten commands;
- no consumer uses the legacy TableClient generic mutation transport for the
  entity, although a command-backed TableClient CRUD facade may remain;
- public identity is used across client-facing DTOs, command inputs and results,
  foreign references, filters, caches, and React keys;
- associations, routes, search, imports/exports, and raw SQL have been audited;
- recursive authorization and projection do not leak natural IDs or provide an
  existence oracle; and
- the replaced compatibility code and legacy endpoints have been removed.

Track these facts per entity. This is more useful than counting converted schema
columns, because it records whether an entity has actually crossed every client
boundary safely.

## Active roadmap

### Completed foundation

- [x] Establish typed entities, named views, runtime DTOs, hydration, normalized
  references, and inferred `ClientOf<TView>` query results.
- [x] Establish keyed typed `xTable` and TableClient declarations, field codecs,
  typed mutation projection, and view-bound `useTableRenderContext()` results.
- [x] Establish typed commands, generated entity CRUD, aggregate command
  composition, and command-backed generic editors.
- [x] Remove the generic TableClient mutation transport, its capability flag,
  table-name envelope, and production RPC.
- [x] Prove the complete read/write/public-identity chain with
  `InstrumentFunctionalGroup`.
- [x] Establish selection-first read derivation from xTable field contracts,
  including `inheritRow` presence, scalar codecs, embedded and normalized
  foreign relations, and explicit Event date-range composition.

### Stabilization gate

This is a bounded cleanup pass, not another exploratory architecture phase. Its
purpose is to leave one clearly supported path before multiplying public-ID
conversions.

- [x] Establish a categorized, non-growth source inventory for
  `defineLegacyCrudView()`, `defineLegacyTableClientSpec()`,
  `defineLegacyDynamicTableClientSpec()`, `bindLegacyTableClientSpecToView()`,
  and `useLegacyTableRenderContext()`. Delete the zero-consumer legacy CRUD-view
  constructor and convert the direct Custom Link and Menu Link view adapters to
  typed `defineTableClientSpec()` declarations.
- [x] Remove `bindLegacyTableClientSpecToView()`. The named-view overload of
  `useDb3Query()` now accepts a typed view-bound spec or creates an empty typed
  query-only spec; Song detail supplies its typed presentation columns.
- [x] Convert the embedded Event Segment, Song Credit, and File editors that
  already own CRUD views to typed view-bound specs, render contexts, and command
  clients. The shared edit-dialog callback remains a documented untyped draft
  boundary; File editing normalizes its detail row into the editor view shape
  before entering that boundary.
- [x] Convert the bespoke front-page gallery editor to its typed CRUD-view
  facade. Its strict view DTO now carries the nested file metadata the editor
  actually reads while generated writes remain limited to the gallery entity's
  prepared fields. Delete the unused WikiPage TableClient module instead of
  manufacturing a view consumer for it.
- [x] Move the backstage File detail page onto `fileDetailView`, expand that
  read DTO only with the relationship-panel and image-metadata fields the page
  renders, retain `fileEditorView` as the narrower write contract, and remove
  the page from the legacy-read compatibility inventory.
- [x] Move the homepage-agenda editor onto a finite `eventFrontpageView`, apply
  its intended `forFrontPageAgenda` query parameter, and replace the verbose
  Event graph plus manual enrichment with the typed summary and frontpage-field
  contract the page actually renders.
- [ ] Convert the remaining view-backed inventory to the typed path. Retain a
  separately documented
  runtime-dynamic/query-only API only where static view binding is genuinely
  impossible.
- [ ] Convert remaining `enrich*` consumers and duplicate asserted Prisma query
  shapes to named views where those values cross a client boundary.
- [ ] Replace relation `GhostField`s that participate in client projection,
  recursive authorization, hydration, or mutation. Keep deliberately opaque
  server-only fields explicit rather than treating every `GhostField` as a
  migration failure.
- [ ] Normalize the remaining query parameter boundary so a view declares and
  validates its parameter type instead of callers depending on an untyped
  `tableParams` bag.
- [ ] Remove obsolete compatibility constructors, markers, and casts once their
  inventories reach zero. Retain focused source guards that prevent the retired
  paths from returning. Any necessary cast at an external or dynamic boundary
  must state the runtime invariant that makes it safe.

### Public-ID migration

- [ ] Catalog client-facing entities and order them by identity dependencies:
  independent lookup entities first, then scalar foreign-key dependants,
  association/tag graphs, and finally central routed entities such as Event and
  User.
- [x] Generalize public-ID translation for association/tag command inputs before
  converting an entity used through those mutation shapes.
- [ ] Audit and adapt the shared identity-sensitive infrastructure: exact lookup,
  generic sorting/reordering, association matrices, caches, React keys, raw SQL,
  search results, imports/exports, routes, and non-DB3 Prisma endpoints.
- [ ] Convert every client-facing entity to `publicId`, one bounded model slice
  at a time. Each slice must satisfy the definition of a migrated entity above
  and delete its numeric client-identity compatibility path before the next
  dependent slice begins.
  - [x] `InstrumentFunctionalGroup`
  - [x] `InstrumentTag`
  - [x] Exercise a scalar public foreign key (`Instrument.functionalGroupId`).
  - [x] Exercise an association/tag command with public identities
    (`Instrument.instrumentTags`).
  - [ ] Exercise route and search identity before converting Event and User.

### Deferred DB3 enhancements

The following may be worthwhile, but they are not prerequisites for public-ID
migration and should be tracked separately from this roadmap:

- a first-class `DB3EditModel`/edit-session abstraction;
- generalized draft cloning and local identity allocation;
- setlist concurrency, combined-position normalization, and delete/reorder
  workflow redesign beyond correctness fixes required independently; and
- broader reshaping of stable `xTable` metadata that is not required by a
  concrete public-ID slice.
