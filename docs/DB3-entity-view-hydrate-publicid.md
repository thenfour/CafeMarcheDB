# DB3 entity, view, hydration, and public identity

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
editable draft or client command
    -> validated mutation command
    -> public-ID resolution at the server boundary
    -> authorized transaction using natural database IDs
    -> public DTO/result
```

## Current vocabulary and responsibilities

### `xTable`: policy and persistence metadata

`xTable` is still the authoritative DB3 schema today. It owns table and column
authorization, relation metadata, query/filter behavior, mutation behavior, and
the natural database primary-key member.

The entity/view work is being introduced around `xTable`, not by replacing all
of it at once.

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

### View: one named read contract

`defineView()` represents one use-specific read shape for an entity. A view owns:

- a globally registered `viewID` tied to exactly one entity/table;
- a Prisma selection, optionally derived from trusted server-side authorization
  and filter context;
- a Zod DTO schema for the authorized transport shape;
- a pure hydration function from DTO plus references to a client value; and
- a client-value identity function.

The selection is the maximum data the view may need. DB3 still applies `xTable`
row, field, relation, soft-delete, and visibility authorization before validating
the DTO. A view ID supplied by a client is checked to ensure that it exists and
belongs to the requested table.

One entity may have several views, for example a compact list view, dashboard
reference view, search view, and detail/editor view. This is the replacement for
duplicating table schemas merely to obtain different payload shapes.

### DTO: the authorized transport boundary

A DTO is neither a Prisma model nor the final rich client object. It is the
serializable shape that is allowed to cross the server/client boundary for one
view.

- Its type comes from the view's Zod schema, not from an asserted Prisma payload.
- Fields that field authorization may remove must be optional in the DTO.
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
and finally serialize to one mutation command. Generic DB3 editing still uses
legacy mechanisms in many places, so this pattern is not yet universal.

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
- Entity/view/hydration primitives exist, and initial instrument, event, file,
  song, and event-song-list views use them.
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

## Design principles

- Define an entity once; define multiple named views for its use-specific shapes.
- Keep authorization and visibility policy on the server and schema-owned.
- Treat the DTO schema as a real runtime boundary, not only a TypeScript aid.
- Make relation graphs finite and explicit; do not recursively hydrate an
  unbounded object graph.
- Hydration is deterministic, synchronous, and free of I/O.
- Preserve the difference between absent, null, and empty.
- Prefer semantic client values over persistence-shaped bags of fields.
- Do not use a hydrated read model as an implicit write model.
- Keep natural/public identity conversion at the transport boundary; internal
  persistence code continues to use the database's natural keys.
- Never treat opacity as authorization.

## Roadmap

- [x] Establish typed entity, named-view, DTO, and hydration primitives.
- [x] Establish a normalized reference store and public-ID pilot.
- [x] Prove richer hydration with search/detail views, structured event date
  ranges, and event-song-list content.
- [ ] Complete the setlist draft/edit/mutation design and transactional write.
- [ ] Convert remaining legacy `enrich*` consumers and duplicate query-shape
  declarations to named views.
- [ ] Strengthen `xTable` typing and decide which stable metadata should
  ultimately move to entity definitions.
- [ ] Generalize public-ID translation for association/tag mutation commands.
- [ ] Audit generic sort/reorder, association-matrix, raw SQL, exports, routes,
  and non-DB3 Prisma endpoints for identity assumptions.
- [ ] Migrate all client-facing entities to `publicId`, one bounded model slice at
  a time.
  - [x] `InstrumentFunctionalGroup`
  - [ ] catalog remaining candidate entities and their relation/mutation shapes
