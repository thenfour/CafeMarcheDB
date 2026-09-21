# DB3 entity, view, hydration, commands, and public identity

GitHub issues:

- [#519 use publicId on clientside instead of raw db id](https://github.com/thenfour/CafeMarcheDB/issues/519)
- [#697 introduce entity/view/hydrate for better design, automation, typesafety](https://github.com/thenfour/CafeMarcheDB/issues/697)
- [#698 xTable to strengthen typesafety](https://github.com/thenfour/CafeMarcheDB/issues/698)

This is a living design document. It describes the intended boundaries and the
current transitional implementation; it is not a claim that all DB3 consumers
have already been migrated.

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
arbitrary client input (often an editable draft)
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
writes: edit model or action input -> Command DTO -> command handler -> persistence
```

Commands are intended to become the only DB3 client-to-server write transport.
That does not mean every write needs a bespoke aggregate implementation. The
command system should support two authoring levels:

- generated entity CRUD commands for ordinary single-row create, update, and
  delete operations; and
- handwritten domain commands for aggregates, workflows, and other operations
  whose contract is not meaningfully row-shaped.

The goal is one mutation architecture with a simple form and an expressive form,
not an easy legacy path beside a more type-safe command path. The current
TableClient CRUD facade provides useful automatic editor ergonomics and may
remain, but its legacy generic mutation transport is migration infrastructure
until the facade is command-backed.

## Current vocabulary and responsibilities

### `xTable`: policy and persistence metadata

`xTable` is still the authoritative DB3 schema today. It owns table and column
authorization, relation metadata, query/filter behavior, mutation behavior, and
the natural database primary-key member.

The entity/view work is being introduced around `xTable`, not by replacing all
of it at once.

New tables can use `defineTable({ fields: { ... } })`. The keyed field map is
the compile-time authority for column names while `xTable.columns` remains its
ordered runtime representation. A field whose database/DTO value differs from
its client value declares a `DB3ReadCodec<Transport, Client>` next to the runtime
conversion. `DB3SchemaClientModel<Dto, Fields>` applies those declarations to a
DTO while preserving its optional members. Legacy `new xTable({ columns })`
definitions remain runtime-only and intentionally do not gain inferred keys or
conversion results.

Domain-specific query behavior belongs with the table/entity or view that owns
it, not in DB3 core. `CMDBTableFilterModel.tableParams` is the transitional
carrier for this behavior, with `xTable.queryParameters` providing runtime
validation and field-authorization mapping. For example, limiting event
responses to the requesting actor is an event-search concern expressed as
`limitResponsesToActor`; it is not a generic `userIdForResponses` DB3 feature.
The longer-term type-safe API should infer a view's query parameters just as it
infers its DTO and client result.

### Entity: stable identity and table-level type anchor

`defineEntity()` describes the stable, view-independent identity of an entity.
It currently binds together:

- the existing `xTable` schema;
- type-only Prisma delegate metadata, from which views can derive their selected
  database payload type;
- the canonical client entity type; and
- `getIdentity()`, including whether that identity is a numeric legacy ID or a
  `publicId`.

At this stage an entity does **not** define its own columns and does not replace
`xTable`. It is the typed anchor shared by multiple views and by the reference
store. Moving more stable metadata out of `xTable` may be a later refactor, but
views must remain independent of query shape either way.

`ClientEntityOf<TEntity>` is the canonical normalized reference shape for an
entity; it need not be the richest client shape available for that entity.
`EntityIdOf<TEntity>` and `PrismaDelegateOf<TEntity>` expose the corresponding
identity and type-only Prisma delegate contracts without coupling callers to a
particular view.

### View: one named read contract

`defineView()` represents one use-specific read shape for an entity. A view owns:

- a globally registered `viewID` tied to exactly one entity/table;
- a Prisma selection, derived from its Zod DTO schema by default or supplied
  explicitly when query behavior requires it;
- a Zod DTO schema for the authorized transport shape;
- a pure hydration function from DTO plus references to a client value.

`ZodToPrismaSelection()` recursively maps DTO scalars to `true`, nested objects
to nested `select` clauses, and arrays to their element selection. Optionality,
nullability, defaults, brands, and refinements do not affect which database
member is selected. Its mapped return type preserves the literal selection
shape used by Prisma payload inference. Consequently, ordinary views declare
only `dtoSchema`; `defineView()` and `defineCrudView()` derive their selection.

An explicit selection remains part of the view contract when it adds meaning
that a transport schema cannot express: relation ordering or filtering,
request-authorization-dependent clauses, authorization-only fields that must
not enter the DTO, or hidden relation data required for public-ID projection.
Such selections can spread the result of `ZodToPrismaSelection(dtoSchema)` and
add only those query concerns. Ambiguous Zod relation shapes fail explicitly
rather than producing a guessed Prisma query.

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
`songsClient.items as SongPayload_Verbose[]`. A cast at that boundary is a sign
that the view, DTO schema, hydration type, or query API is not expressing its
contract completely. Named-view query execution validates and hydrates results
automatically; ordinary consumers should not remember to call `enrich*` or a
hydrator manually.

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
missing required reference throws `DB3HydrationError` with its precise object
path; optional references may remain absent.

`DB3ReferenceStore` is a request/session-scoped normalized store keyed by an
entity's `getIdentity()`. This avoids repeatedly embedding the same lookup row,
gives hydrated objects stable shared references, and prevents each legacy
`enrich*` function from inventing its own lookup mechanism.

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

| Concern | Raw `useMutation()` | Legacy DB3 TableClient | `useDB3Command()` |
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

The legacy DB3 TableClient (`xTableRenderClient`) currently solves a different
problem. Its mutation methods provide generic single-table CRUD.
`prepareMutation()` walks configured client columns and `xTable` columns,
converts client fields to database-shaped fields, performs advisory client-side
authorization filtering, selects numeric or public identity, invokes the
generic table mutation endpoint, and may refetch the table query. Those are
important capabilities to preserve, but the TableClient mutation transport is
not part of the target architecture.

Generated entity CRUD commands should make conventional row editing as easy as
the legacy path while providing strict operation-specific input and result
types. They may reuse existing column transformation, validation, authorization,
auditing, hook, and public-ID machinery internally. The public client contract
must not expose `TAnyModel`, table names, numeric table IDs, or the generic
mutation envelope merely because the implementation delegates to mature DB3
row services.

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

Existing CRUD views that depended on the old hidden conversion must opt into
`defineLegacyCrudView()`. That constructor is migration-only: it contains the
single unsound DTO/client compatibility cast and makes the old intention
visible at every remaining declaration. New views must not use it. Prepared
command values still travel in the opposite, database-shaped direction;
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
  `EntityIdOf<EntityOf<TView>>`;
- uses the existing TableClient/client-column preparation behavior for create
  and update values;
- computes an update patch from the prepared previous and next values;
- invokes the view's generated commands; and
- owns the conventional refetch and invalidation lifecycle.

The new `defineTableClientSpec({ view, columns })` path binds presentation to the
same concrete view. Every column name and its declared client value type are
checked against `ClientOf<TView>`, and the view type continues through
`DB3EditGrid`, its row callbacks, and `xTableRenderClient`. The historical
`new xTableClientSpec({ table, columns })` constructor remains an explicitly
table-only migration path and carries no view-derived typing. A runtime guard
also rejects pairing a view-bound spec with a different CRUD view.

`DB3EditGrid` should use that hook internally. The ordinary call site remains
limited to presentation metadata and the semantic view:

```tsx
<DB3EditGrid
    tableSpec={tableSpec}
    view={instrumentFunctionalGroupEditorView}
/>
```

It must not require per-entity command hooks, DTO mappers, mutation adapters, or
knowledge of command IDs. Creation may initially retain the same new-row model
and limitations as the current TableClient; defining a more general first-class
edit-draft abstraction is separate work.

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

Handwritten commands do not call the legacy client `prepareMutation()` path.
Their serializer is the explicit client-input-to-DTO transformation, while the
server command row services reuse the authoritative DB3 row mutation core. A
generated CRUD view may reuse TableClient's current mutation preparation because
its purpose is precisely the same constrained row-shaped editing behavior. This
does not make that table-shaped serializer responsible for aggregate semantics.

During migration, the existing TableClient CRUD facade may delegate to generated
commands so generic editors can move without a flag day. The high-level
automatic CRUD ergonomics may remain; the compatibility seam to remove is its
legacy generic mutation transport, table-name envelope, and RPC endpoint. Once
all consumers of that transport have moved, remove the legacy mutation
capability flag and generic mutation RPC surface. Do not remove a useful
high-level grid/editor facade merely because its implementation used to call
the legacy endpoint.

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
values cannot become editable drafts. Generic DB3 editing still uses legacy
mechanisms in many places, so this pattern is not yet universal.

A read DTO's optional fields must not silently become optional write semantics.
An editor should either require the complete fields needed to construct its
draft or use a purpose-specific patch command. The server always validates and
authorizes a command again against persisted state.

### Direction: first-class edit models

The setlist migration also exposes a remaining client-side seam. Draft creation,
hydrated-client-to-draft adaptation, deep cloning, and temporary client identity
allocation are still separate domain functions, with some identity allocation
visible in components. These operations describe one edit-model lifecycle and
are candidates for a typed `DB3EditModel` contract.

Such a contract could provide `create`, `beginEdit`, and `clone` operations and
be referenced by an editable command. `useDB3Command()` could expose those pure
facilities for convenient call sites, or a later `useDB3Editor()` could compose
a view, edit model, save command, and optional delete command. The underlying
draft should remain detached mutable data; hydrated query objects should not
gain hidden I/O methods or be mutated in place because they may share canonical
references or query-cache identity.

This direction is not implemented yet and must be proved before it becomes a
mandatory abstraction for editable entity commands. Commands that represent
actions such as publish, approve, reorder, or merge may have no meaningful edit
model, so draft lifecycle must not become mandatory for every command. Setlist
temporary identity should also eventually distinguish an optional persisted
identity from an opaque always-local key instead of encoding persistence in the
sign of `clientId`.

### Transitional escape hatches

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
- update and delete commands identify the target with `updatePublicId` or
  `deletePublicId`. Inserts may not supply `publicId`.

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

The current generic mutation translator has been validated for scalar
`ForeignSingleField` references. Public-ID resolution for many-to-many/tag
mutation inputs remains future work and must be implemented before converting a
target used through those mutation shapes.

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

### Current status and known transition limits

- `InstrumentFunctionalGroup` is the public-ID pilot and currently the only
  converted DB3 entity.
- Broad public-ID rollout should not proceed as a big-bang schema exercise while
  entity/view/command boundaries are still being proved. However, `publicId` is
  now an acceptance criterion for those primitives rather than a distant final
  phase: new generic CRUD, association, filtering, and edit-model facilities
  should be proved against the existing public-ID pilot.
- Entity/view/hydration/command primitives exist, and initial instrument, event,
  file, song, and event-song-list views use the read-side primitives.
- `defineView()`, `DbPayloadOf<>`, `DtoOf<>`, `ClientOf<>`,
  `ClientEntityOf<>`, and typed `useDb3Query({ view })` establish the intended
  inference chain without result casts.
- `defineTable()`, field `DB3ReadCodec`s, and
  `DB3SchemaClientModel<>` establish the typed schema-to-client link for the
  `InstrumentFunctionalGroup` pilot. Its `color` member is inferred as
  `ColorPaletteEntry | null | undefined`, while its table keys and public-ID
  identity remain statically checked.
- Event timing proves hydration into a behavioral `DateTimeRange` value rather
  than merely renaming fields.
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
  selection source and `ForeignSingleFieldRenderContext` query and hydrate
  through that view, invoke its generated create command, and read the returned
  canonical identity back through an authorized exact-identity view query
  before publishing it as the selected value. A successful create that is not
  readable through the view fails explicitly rather than manufacturing a
  partial client row. The Instrument editor's functional-group selector proves
  this path with public IDs; unmigrated selection entities retain their legacy
  create path until they define a CRUD view.
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
  use numeric identities; generalized public-ID association transport remains a
  separate migration slice.
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
- Many-to-many/tag mutation resolution, association-matrix assumptions, generic
  sorting/reordering, and raw-SQL/search boundaries must be audited as their
  participating entities are converted.
- Raw SQL returned in `SearchResultsRet` is intentionally unchanged for now and
  is expected to be removed separately.
- Most unconverted named views still expose numeric identities. That is
  transitional evidence for the view/hydration design, not permission to treat
  numeric IDs as part of the final client contract.
- Legacy TableClient mutation transport is still broadly used. The intended
  replacement is generated entity CRUD commands for ordinary row editors and
  handwritten commands for aggregate or workflow operations.

### Legacy TableClient mutation inventory and deletion gate

The legacy mutation transport is now a closed migration inventory. The source
test `tests/db3LegacyMutationInventory.test.ts` records every remaining
`xTableClientCaps.Mutation` acquisition, every direct call to
`doInsertMutation()`, `doUpdateMutation()`, or `doDeleteMutation()`, and asserts
that every writable `DB3EditGrid` supplies a command-backed CRUD view. A new
legacy file or call fails the test. Counts are recorded as well as paths so
adding another writer inside an already-inventoried file also fails. The
inventory may shrink; it must not be expanded to make a new failure pass.

Writable grids make this boundary visible in their type contract. A grid must
now supply a CRUD-enabled `view`; the writable legacy branch and its
`legacyMutationTransport` escape hatch have been removed. A read-only grid can
still use the query-only TableClient facade without requesting mutation
capability.

The existing writers are grouped by the replacement they need:

| Category | Remaining surfaces | Intended replacement |
| --- | --- | --- |
| Row CRUD grids | None | Every writable `DB3EditGrid` now uses a command-backed editor view. File creation remains owned by the upload workflow rather than the metadata grid. |
| Entity detail editors | None | Song, Event, File, User/Profile, and Wiki tag metadata now use generated CRUD commands for row-shaped patches. Privileged and operation-specific actions remain named workflows. |
| Nested rows and relationships | None | Embedded Event Segment, Song Credit, File metadata, profile instrument-set, and Setlist Plan Group edits now use generated CRUD commands. Setlist group reordering remains an explicit ordered operation. |
| Collection editors | None | Custom Link and Menu Link row edits use generated CRUD commands over narrow editor DTOs. Menu Link ordering remains an explicit scoped collection operation. |
| Workflows and aggregates | New-song creation, frontpage gallery composition, setlist planning, and similar multi-step flows | Use handwritten named commands with strict DTOs and one authorized transaction. |
| Compatibility infrastructure | The selection-creation fallback, generic mutation-capable query helpers, and the TableClient transport implementation | Delete each bridge after its callers migrate; remove the capability flag and generic mutation RPC last. The standalone edit dialog's mutation-capable fallback is already gone. |

The first post-inventory category slice migrates the Event Type, Event Status,
and Event Tag administration grids. Each now has one registered editor CRUD
view and uses generated create/update/delete commands. Their editor DTOs keep
authorization-removable fields optional, omit relation collections that the
grid does not edit, and retain the existing `xTable` client-value conversion
behavior for fields such as color.

The second slice completes the standalone lookup-grid category: File Tag,
Instrument Tag, Song Tag, Song Credit Type, User Tag, and Wiki Page Tag now use
the same CRUD-view path. Song Tag's additional grouping and indicator fields
and User Tag's CSS class are part of their strict editor DTOs; schema-owned
association collections are deliberately absent. This migrates the admin-grid
writers only. Create-from-string behavior in foreign/tag selection controls is
still represented by the separate selection-fallback inventory and must be
wired to these CRUD views at its actual consumers before those entity write
surfaces are complete.

The third slice starts the remaining ordinary-grid category with the two scalar
configuration grids: Permission and Setting. Their command-backed editor views
generate create/update commands but no delete command, preserving both tables'
schema-owned disabled-delete policy. Each view exposes only the columns edited
by its grid. In particular, the Permission DTO omits
the `roles` association, which remains owned by the explicit role-permission
command, while Setting writes continue through the existing row service and
therefore retain setting-name/value validation. The Role grid and the larger
User/Event/File/Song/Instrument/gallery grids are not part of this scalar
batch: their visible columns include associations, privileged operations, or
workflow semantics that must be separated before selecting CRUD or a named
domain command.

The fourth slice migrates the standalone Frontpage Gallery Item administration
grid. Its editor view owns the finite file, creator, and visibility-permission
reference shapes required by the grid, while mutations carry only their scalar
foreign keys. The table's existing soft-delete and recovery policy remains the
authority for generated deletion. This does not migrate the separate
frontpage-gallery composition workflow: upload, crop/display adjustment,
caption editing, deletion/restoration, and reorder remain inventoried as a
multi-step workflow that needs named domain commands.

The fifth slice migrates the Role administration grid. Its strict editor view
contains the editable role metadata and the finite permission-association shape
needed by the tag column. The generated `Role_Create` and `Role_Update`
commands apply the desired permission-ID set through the existing schema-owned
association service in the command transaction; deletion remains disabled.
Built-in-role designations are deliberately absent from the editor DTO and
continue through `setRoleDesignation`. The separate role-permission matrix
continues to use its explicit pairwise `RolePermission_Set` command.

The sixth slice migrates the Instrument administration grid. Its strict editor
view carries editable scalar fields, the functional-group public reference,
and the finite instrument-tag association shape. Generated Instrument CRUD
uses the existing public-FK resolver and schema-owned association service in
the command transaction, retaining the table's hard-delete policy. The grid's
stale link to the removed Instrument `slug` column is replaced with its numeric
identity, which is the value consumed by the current placeholder detail route.

The seventh slice migrates the Song administration grid. Its strict editor
view contains the displayed scalar fields, creator and visibility references,
and the finite Song-tag association shape. Tagged files, credits, and the
pinned-recording workflow remain outside this row contract. Generated Song
CRUD reconciles the desired tag-ID set transactionally and retains the table's
soft-delete policy and existing recovery authorization.

The eighth slice completes the ordinary administration grids. User, Event,
and File now read through finite editor views and write through their generated
entity commands. The User view preserves the grid's profile and taxonomy sets
while keeping role and Sysadmin state display-only; dedicated account
lifecycle, role-assignment, authentication, and impersonation flows remain
separate. The Event view owns only the displayed event row, lookup references,
and event-tag set; segments and song lists remain separate nested editors. The
File view owns editable metadata, visibility, and tag sets while storage name,
upload provenance, size, and derived custom data are display-only. File
creation is disabled in this grid because upload and derived-file creation own
the storage transaction; generated File updates still retain schema-enforced
storage-field rejection and soft-delete/recovery policy.

The ninth slice migrates the four remaining writable `DB3EditGrid` surfaces:
Event Attendance, Event Segment, Song Credit, and User Instrument. Although
three are parent-associated rows and one is a direct relationship row, each
grid edits one independently addressable record at a time, so generated CRUD
is the truthful contract. Their finite editor views retain parent query
parameters, foreign-reference display shapes, table-owned authorization, and
the existing hard- or soft-delete policy. With every writable grid now
command-backed, the `legacyMutationTransport` prop and writable legacy grid
branch are deleted. Embedded detail editors for the same entities remain in
the direct TableClient inventory and can migrate separately by reusing these
commands where their interaction remains row-shaped.

The tenth slice begins the entity-detail category with Song. The page continues
to query and hydrate the finite `songDetailView`, while its edit dialog prepares
the existing TableClient editor values and invokes the generated update/delete
commands owned by `songEditorView`. The dialog accepts the query-only render
client instead of acquiring legacy mutation capability for itself, and update
patches are computed from explicit previous and next values. Embedded song
credit editing and the new-song workflow remain in their later nested-row and
workflow categories. This slice intentionally preserves Song's current natural
identity; public-ID conversion follows the entity/view/command migration.

The eleventh slice migrates Event detail update/delete. The full detail page
continues to use its existing verbose query and enrichment because the current
`eventSearchView` deliberately omits richer attendance, file, segment, and
setlist data needed by this consumer. That render client is now query-only and
is injected into the edit dialog for field rendering; `eventEditorView` owns
the generated update/delete commands and strict write DTO. Event segments,
attendance, setlists, description content, and other nested actions remain on
their existing boundaries for later slices. Event retains its natural identity.

The twelfth slice migrates File detail update/delete. The landing page retains
its existing query and `enrichFile()` path because its parent/child, preview,
gallery, and pinned-song graph is broader than the current finite
`fileDetailView`, and several of those relations still use transitional
`GhostField` metadata. Its query-only render client is injected into the dialog
for editor-value preparation, while `fileEditorView` supplies the generated
update/delete commands. Upload remains the only File creation workflow;
storage-owned fields and file-association workflows remain outside this slice.
File retains its natural identity.

The thirteenth slice completes the entity-detail category as one larger batch.
The User detail page, self-profile editor, admin profile editor, and inline role
control now read through `userEditorView` and send row-shaped changes through
its generated update command. Existing account lifecycle, authentication,
email-correction, merge, password, impersonation, and Sysadmin operations stay
on their dedicated boundaries. Wiki tag metadata now has a finite
`wikiPageEditorView` over a typed WikiPage entity; it owns only the complete tag
projection and an update command. Wiki content/revisions, edit locking, and
visibility remain explicit workflows. Both entities retain their natural
identities.

The fourteenth slice completes the nested-row and relationship category as one
larger batch. Embedded Event Segment and Song Credit create/update/delete,
embedded File metadata update/delete, the self-profile instrument set, and
Setlist Plan Group create/update/delete now invoke generated CRUD commands.
The finite Song Credit write DTO now includes the dialog's `year` and `comment`
fields, and the File editor DTO includes its editable `fileCreatedAt` metadata.
Setlist Plan Group gains its own entity and finite editor view; drag reordering
stays on the existing explicit scoped sort operation because it mutates an
ordered set rather than one row. The standalone edit dialog no longer has a
mutation-capable fallback: every caller must inject a query-only or render-only
TableClient for editor preparation. Dedicated Event response-copy/clear and
primary-instrument commands remain separate domain operations.

The fifteenth slice completes the collection-editor category. Custom Link and
Menu Link each gain a typed entity, a finite list view for display-only data,
and a narrower CRUD editor view for independent row create/update/delete. The
Custom Link list view owns creator metadata and visit counts without exposing
either to its command DTO. The Menu Link list view hydrates visibility from the
shared reference store, while its editor command deliberately excludes
`sortOrder`, realm, and creator metadata. Drag reordering therefore stays on
the existing authorization-tested scoped sort operation, which owns the
collection-wide ordering change. Both component trees now query through their
named list views and contain no legacy TableClient mutation capability or
direct mutation calls.

## Design principles

- Define an entity once; define multiple named views for its use-specific shapes.
- Keep authorization and visibility policy on the server and schema-owned.
- Treat the DTO schema as a real runtime boundary, not only a TypeScript aid.
- Make relation graphs finite and explicit; do not recursively hydrate an
  unbounded object graph.
- Hydration is deterministic, synchronous, and free of I/O.
- Hydration traverses only the finite graph declared by its named view.
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
- Preserve the automatic TableClient/grid facade while replacing its legacy
  generic mutation transport underneath it.
- Treat `useDB3Command()` serialization and validation as client contract
  ergonomics, never as a replacement for server validation or authorization.
- Compose aggregate command handlers from the existing authoritative DB3 row
  mutation services instead of copying table authorization and mutation rules.
- Treat the legacy TableClient mutation transport as temporary migration
  infrastructure. Do not add new consumers, and delete each legacy transport
  capability once its consumers have moved to commands.
- Keep domain-specific filters and selection behavior out of DB3 core.
- Do not add generic untyped payload bags where a named DTO/client shape can
  express the requirement.
- Never use natural identity as a client sort contract or hidden default sort.
- Keep natural/public identity conversion at the transport boundary; internal
  persistence code continues to use the database's natural keys.
- Never treat opacity as authorization.

## Migration method

Migration proceeds through vertical slices with deletion gates. The current
stage adapts the as-is database schema and natural identities to the
entity/view/command system: each slice must prove its replacement, migrate the
relevant consumers, and remove the superseded path. After those read and write
boundaries are established and the legacy mutation transport is gone, convert
entities to public IDs one bounded model slice at a time. Compatibility seams
are acceptable only while a known set of consumers is in flight.

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
5. For a rich or aggregate editable value, introduce an explicit draft and
   handwritten command rather than sending the hydrated read model back to the
   server. Put the client-input-to-DTO transformation on the command and compose
   its writes from DB3 row services inside the command transaction.
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
   TableClient transport, RPC, enrichment, compatibility, or numeric-identity
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
- editable uses have an appropriate edit model or action input; ordinary
  row-shaped CRUD may retain the limited table-client edit model;
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

## Roadmap

- [x] Establish typed entity, named-view, DTO, and hydration primitives.
- [x] Establish a normalized reference store and public-ID pilot.
- [x] Prove richer hydration with search/detail views, structured event date
  ranges, and event-song-list content.
- [x] Separate setlist hydrated content, editable draft, and validated mutation
  command.
- [x] Establish typed command descriptors, `useDB3Command()`, a generic RPC and
  registry, an authorized transactional context, and reusable DB3 row services.
- [x] Migrate setlist create/update to one atomic aggregate save command and
  remove its legacy RPC and raw child-synchronization paths.
- [x] Define strict generated entity CRUD command contracts and shared handlers,
  including create/update/delete identity, patch semantics, result types,
  validation, error behavior, and refetch/invalidation expectations.
- [x] Define a generic CRUD-enabled view and command-backed table-render context
  that derive typed row/identity behavior and generated command invocation from
  a named view plus its linked `xTable`.
- [x] Prove generated CRUD against `InstrumentFunctionalGroup`, the existing
  public-ID pilot. Its `DB3EditGrid` call site should need only `tableSpec` and
  the CRUD-enabled view, without entity-specific command schemas, serializers,
  handler files, registry wiring, command hooks, mutation adapters, table names,
  numeric table IDs, `TAnyModel`, or the generic mutation envelope.
- [x] Make generic editing infrastructure command-backed.
  - [x] `DB3EditGrid` and its injected-client `DB3NewObjectDialog` path.
  - [x] Selection-source creation, proved through the public-ID
    `InstrumentFunctionalGroup` CRUD view.
  - [x] `DB3AssociationMatrix`, using an explicit association-command contract
    rather than ordinary row CRUD.
- [ ] Prohibit new consumers of the legacy TableClient mutation transport, then
  migrate existing writers by category: generated CRUD for ordinary rows and
  named commands for aggregates or workflows.
  - [x] Add a source-enforced deletion inventory for mutation capability,
    direct legacy method calls, and legacy writable-grid call sites.
  - [x] Require remaining writable legacy grids to opt in explicitly; ensure
    read-only grids never acquire mutation capability.
  - [x] Migrate the Event Type, Event Status, and Event Tag lookup-grid batch to
    generated CRUD views and commands.
  - [x] Migrate the remaining standalone lookup grids: File Tag, Instrument
    Tag, Song Tag, Song Credit Type, User Tag, and Wiki Page Tag.
  - [x] Migrate the scalar Permission and Setting configuration grids with
    generated create/update commands and no delete command, keeping
    permission-role associations and bulk setting import on their existing
    explicit command/RPC boundaries.
  - [x] Migrate the standalone Frontpage Gallery Item administration grid,
    retaining the separate gallery-composition workflow in the named-command
    migration inventory.
  - [x] Migrate the Role administration grid, preserving bulk permission-set
    editing while keeping built-in designations and the pairwise permission
    matrix on their explicit command boundaries.
  - [x] Migrate the Instrument administration grid, including its public-ID
    functional-group reference and finite tag set, while retaining the existing
    hard-delete policy.
  - [x] Migrate the Song administration grid, retaining creator/visibility
    references, tag-set editing, and the existing soft-delete/recovery boundary.
  - [x] Migrate the remaining User, Event, and File ordinary grids while
    retaining privileged User workflows, nested Event editors, and File upload
    creation on their existing explicit boundaries.
  - [x] Migrate the remaining writable Event Attendance, Event Segment, Song
    Credit, and User Instrument grids, removing the writable legacy-grid branch.
  - [x] Begin the entity-detail category with Song update/delete, retaining the
    rich detail view for reads and using `songEditorView` commands for writes.
  - [x] Migrate Event detail update/delete through `eventEditorView`, retaining
    the existing verbose read/enrichment path until a finite detail view owns
    that complete graph.
  - [x] Migrate File detail update/delete through `fileEditorView`, preserving
    upload-owned creation and the broader legacy detail read graph.
  - [x] Complete the entity-detail category by migrating User/Profile,
    user-administration profile and role edits, and Wiki tag metadata through
    finite named views and generated update commands.
  - [x] Migrate embedded Event Segment, Song Credit, File metadata, profile
    instrument-set, and Setlist Plan Group writes through generated CRUD,
    retaining ordered group reordering and dedicated domain actions on their
    explicit boundaries.
  - [x] Migrate Custom Link and Menu Link collection editors through finite
    list/editor views and generated row CRUD, retaining Menu Link reorder on its
    explicit scoped sort boundary.
  - [ ] Migrate the workflow category. Split out named domain commands wherever
    row CRUD is not truthful, and separately migrate selection
    create-from-string consumers to the matching CRUD views.
- [ ] Validate or normalize the combined setlist song/divider position namespace
  on the server, independent of the client serializer.
- [ ] Decide and prove the first-class edit-model contract for draft creation,
  hydrated-client adaptation, cloning, and local identity allocation.
- [ ] Decide whether setlist delete/reorder should become commands or remain
  separate generated/domain commands based on their actual aggregate semantics.
- [ ] Finish the setlist aggregate proof, including edit-model lifecycle,
  ordering invariants, concurrency/lost-update policy, deletion/reordering, and
  removal of every remaining legacy setlist write path.
- [ ] Remove the legacy TableClient mutation implementation, mutation capability
  flag, table-name envelope, and generic DB3 mutation RPC after their final
  consumers have moved; retain a command-backed high-level CRUD facade where it
  preserves automatic editor ergonomics.
- [ ] Convert remaining legacy `enrich*` consumers and duplicate query-shape
  declarations to named views.
- [ ] Remove remaining generic query/view escape hatches and replace relation
  `GhostField`s where recursive policy or hydration is required.
- [ ] Complete `xTable` typing beyond the pilot and decide which stable metadata
  should ultimately move to entity definitions.
  - [x] Add keyed typed-table construction, field-level read codecs, inferred
    DTO-to-client results, and a view-bound TableClient spec; prove them with
    `InstrumentFunctionalGroup` and its public identity.
- [ ] Infer and validate typed view-specific query parameters instead of exposing
  untyped `tableParams` to callers.
- [ ] Generalize public-ID translation for association/tag mutation commands
  before converting entities used through those mutation shapes.
- [ ] Audit generic sort/reorder, association-matrix, raw SQL, exports, routes,
  and non-DB3 Prisma endpoints for identity assumptions.
- [ ] Migrate all client-facing entities to `publicId`, one bounded model slice at
  a time.
  - [x] `InstrumentFunctionalGroup`
  - [ ] catalog remaining candidate entities and their relation/mutation shapes
  - [ ] choose successive pilots that exercise scalar foreign keys,
    associations/tags, and route/search identity before converting central
    entities such as Event and User
