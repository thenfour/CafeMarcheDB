# DB3 Field Read Contracts and Derived Views

Status: design reference and linear implementation plan.

This document defines a low-impact path for making DB3 read values more
consistent. It refines the read side of
[`DB3-entity-view-hydrate-publicid.md`](./DB3-entity-view-hydrate-publicid.md);
it does not replace that broader architecture document.

The first implementation step is explicit field read authorization through
`inheritRow`. Derived DTO schemas and hydration depend on that guarantee, so
they must not be implemented first.

## Summary

The intended ownership model is:

```text
Prisma schema
    -> xTable fields: application meaning, read value shape, and field policy
    -> DB3 view: Prisma selection and any view-specific composition
    -> derived DTO schema and default hydration
    -> consumer
```

In particular:

-  `xTable` fields own reusable leaf-value knowledge: the read transport shape,
   nullability, field authorization, and transport-to-consumer conversion.
-  A view continues to own its Prisma selection. DB3 must not invent or replace
   Prisma's selection language.
-  DB3 derives the DTO schema and ordinary hydration from the entity plus that
   selection.
-  A view may explicitly extend or replace derived hydration for composed or
   calculated consumer values.
-  Existing explicit `dtoSchema`, `hydrate`, and `ZodToPrismaSelection` usage
   remains supported while views migrate incrementally.

The proposed first public helper is provisionally called
`deriveViewContract`:

```ts
const derived = deriveViewContract(xEventStatus, eventStatusSelection)

const eventStatusView = defineView({
   viewID: "eventStatus",
   entity: xEventStatus,
   selection: derived.prismaSelection,
   dtoSchema: derived.dtoSchema,
   hydrate: derived.hydrate,
})
```

The helper returns the supplied selection unchanged in the first iteration.
It validates and interprets that selection; it does not silently add columns.

## Why this change exists

Today the same read contract is distributed across several places:

-  a Prisma selection says which database values are returned;
-  a view DTO Zod schema repeats the selected scalar shapes;
-  `FieldBase` subclasses know some validation, authorization, persistence, and
   client-conversion behavior;
-  `DB3FieldCodec` knows some transport/client conversion behavior;
-  `getClientModel` and view `hydrate` functions perform overlapping conversion;
-  `ForeignSingleField` represents both a relation member and its scalar foreign
   key without both members being visible as ordinary table fields;
-  authorization can remove selected fields, so DTO schemas frequently use
   `optional()` even where the application has a stronger invariant.

This makes it difficult to answer basic questions from one authority:

-  What is the wire value of this selected field?
-  Is it guaranteed to be present after row authorization?
-  Which field owns a selected Prisma member?
-  Does hydration apply a codec?
-  Does a foreign relation use an embedded object or a reference provider?

The goal is not to redesign all of DB3. The goal is to make those answers
explicit enough that a helper can derive the common view contract safely.

## Goals

1. Express when a readable field inherits the already-established row read
   decision.
2. Put each scalar field's read transport schema beside its other field
   semantics.
3. Make selected Prisma members resolvable through the entity, including the
   two members owned by a foreign-single field.
4. Derive a sound DTO Zod schema from an entity and a Prisma selection.
5. Derive ordinary consumer hydration, including `DB3FieldCodec.decode`.
6. Support reference-provider hydration for deliberately normalized foreign
   selections.
7. Keep custom view hydration as the escape hatch for composed values such as
   an event date range.
8. Preserve existing views and mutation behavior during incremental rollout.

## Non-goals for the first implementation

-  Replacing Prisma selections or creating a DB3-specific query language.
-  Deriving a Prisma selection from a DTO schema.
-  Redesigning `ApplyToNewRow`, `ApplyClientToDb`, mutation validation,
   `separateMutationValues`, or `FieldAssociationWithTable`.
-  Automatically fetching missing references. Hydration may consume an already
   available reference provider, but it does not perform I/O.
-  Supporting arbitrary calculated objects or arbitrary nested consumer shapes
   in `FieldBase`.
-  Introducing a general compound-field abstraction in the first pilot.
-  Inferring authorization implications from the current contents of permission
   maps. Such implications are dynamic and are not a stable type contract.
-  Migrating every existing DB3 view before the design has been proven on a
   small representative slice.

## Ownership boundaries

### Prisma owns persistence and selection syntax

The view supplies a normal, typed Prisma selection. Relation arguments,
filters, ordering, and nested selections remain Prisma concepts.

### `xTable` owns reusable field read semantics

An entity field should be able to describe:

-  the Prisma member or members it owns;
-  the transport value schema for each readable member;
-  whether successful row authorization guarantees the member is readable;
-  how a present transport value becomes its default consumer value;
-  for supported relation fields, how a selected nested object is recursively
   interpreted.

This is a description of a finite read projection. It is not permission to make
the entity an arbitrary application-object orchestrator.

### A view owns composition

A view chooses the selected graph and may add semantics that cannot be inferred
from individual fields. For example, a view can compose `startsAt`,
`durationMillis`, and `isAllDay` into an event date-range object after the
derived scalar hydrator has run.

### Authorization owns presence

Zod optionality must follow the authorization contract, not convention or
optimism. The derived type may remove `| undefined` only when the field
explicitly promises that every row-readable path also makes that field
readable.

## Phase 1: explicit `inheritRow` read authorization

### Decision

Widen only the read entries of the existing field authorization map so that
they can state `inheritRow` explicitly. The write entries remain permission
requirements.

The implemented exported contract is:

```ts
const DB3FieldReadAuth = Object.freeze({
  inheritRow: "inheritRow",
} as const)

type DB3FieldReadAuthRequirement =
  | Permission
  | typeof DB3FieldReadAuth.inheritRow

type DB3AuthContextPermissionMap = {
  PostQuery: DB3FieldReadAuthRequirement
  PostQueryAsOwner: DB3FieldReadAuthRequirement
  PreInsert: Permission
  PreMutate: Permission
  PreMutateAsOwner: Permission
}
```

This preserves the current map and current permission-based behavior. It adds
one explicit invariant without introducing a parallel authorization system.

Example:

```ts
authMap: {
  PostQuery: DB3FieldReadAuth.inheritRow,
  PostQueryAsOwner: DB3FieldReadAuth.inheritRow,
  PreInsert: Permission.manage_events,
  PreMutate: Permission.manage_events,
  PreMutateAsOwner: Permission.manage_events,
}
```

### Meaning

`inheritRow` means:

> If DB3 has authorized this row for this query path, field authorization must
> not remove this selected field.

It does not mean that the field is globally public, and a direct field check
must never substitute for row authorization.

The current read sanitizer authorizes the row before authorizing its fields.
For that path, `inheritRow` succeeds because its precondition has already been
established.

Query construction also performs field checks before a concrete row exists,
for example for filtering and ordering. In those preflight paths,
`inheritRow` means that the field is usable after the table query itself has
been authorized and only if the eventual query continues to enforce the row
authorization predicate. Each such call site must be covered by tests; a
standalone `inheritRow` field result is not proof that a table query is allowed.

### When a derived field is required

A selected field is required in the derived DTO schema only when all applicable
row-readable branches guarantee it. In the initial map this normally means both
`PostQuery` and `PostQueryAsOwner` are `inheritRow`.

If one branch still has independent permission or custom authorization, the
field remains optional. DB3 must not attempt to prove that the current role
permission configuration happens to imply the field permission.

`Permission.always_grant` may happen to produce the same runtime result after
row authorization, but `inheritRow` is the preferred schema-level statement:
it documents the invariant and can be checked without interpreting a mutable
permission configuration.

### Exposure warning

Changing an existing field to `inheritRow` can broaden data exposure. If a
table admits public or otherwise limited row reads, every inherited field is
readable on those rows.

Each migration must therefore audit the table's `View` and `ViewOwn` policy as
well as the field policy. Lookup tables such as event status are useful pilots,
but their apparently intrinsic fields must not be marked `inheritRow` merely to
obtain nicer TypeScript types.

## Phase 2: scalar read transport schemas

### `readTransportSchema` is one-way

`readTransportSchema` validates the value that crosses the DB3 read boundary.
It is not itself a codec and does not need to be bidirectional.

```ts
abstract class FieldBase<TReadTransport = unknown, TConsumer = TReadTransport> {
   abstract readonly readTransportSchema: z.ZodType<TReadTransport>
   readonly codec?: DB3FieldCodec<TReadTransport, TConsumer, unknown>
}
```

The generic sketch is illustrative; the implementation should minimize churn
to existing field type parameters.

Rules for the schema:

-  It describes a value when the selected member is present.
-  Database nullability is expressed here with `nullable()` where applicable.
-  Authorization absence is not expressed here with `optional()`; the derivation
   step adds optionality from field read policy.
-  It should validate rather than transform. Consumer transformation belongs to
   hydration and `codec.decode`.
-  A field without a custom codec still has a read transport schema and uses
   identity hydration.

This cleanly separates two contracts:

```text
readTransportSchema: unknown -> validated DTO value
DB3FieldCodec.decode: validated DTO value -> default consumer value
```

The existing write side of `DB3FieldCodec` remains unchanged in the pilot.

### Initial scalar coverage

Implement schemas first for the field classes needed by the pilot, then for the
ordinary scalar field set. Coverage should include at least identifiers,
strings, numbers, booleans, enums, dates, nullable variants, and color fields.

An unsupported field class must fail derivation with a message containing the
entity, selected member path, and field class. It must not silently fall back to
`z.any()`.

Implementation status: the scalar field classes now expose this schema and the
base field contract provides parse, identity-hydration, and codec-hydration
helpers. Prisma `Int` and `BigInt` members are distinguished explicitly because
they share the existing `GenericIntegerField` class. Relations and compound
fields intentionally remain unsupported until selection-member ownership is
introduced in Phase 3. Existing view and `getClientModel` behavior is unchanged;
the new helpers validate more strictly before hydrating.

Scalar field types retain literal nullability, and the field contract carries a
type-level `required`/`optional` read-presence marker. Auth maps intended to
produce required fields must preserve their literal `inheritRow` values (for
example with `satisfies DB3AuthContextPermissionMap`); a widened map is treated
as optional at compile time. This is deliberately conservative and mirrors the
runtime rule that both owner and non-owner read branches must inherit row access.

## Phase 3: selection-aware DTO derivation

### Proposed helper

```ts
const derived = deriveViewContract(entity, selection)
```

The result should contain:

```ts
{
  prismaSelection: selection,
  dtoSchema,
  hydrate,
  referenceDependencies,
}
```

`referenceDependencies` makes normalized relation requirements inspectable
without causing hydration to fetch data. Each dependency names the source
table, selected foreign-key member, logical relation member, target xTable, and
complete selection path.

`deriveDtoSchema(entity, selection)` can also be exposed as a narrower helper
if useful. Internally, DTO derivation and hydration should use the same compiled
selection description so they cannot drift.

Implementation status: `deriveDtoSchema` is public and preserves a literal
Prisma selection in its inferred schema output. Selected root scalar members use
the xTable field's transport value, nullability, and read-presence contract.
Foreign-key members use the Prisma payload type and remain conservatively
optional. Nested relation value/null/array shapes come from the Prisma payload;
their selected row members are also conservatively optional. Every typed
`xTable` now declares a type-only Prisma delegate through `prismaModel()` and an
explicit application identity through `getIdentity()`. Views and commands use
that xTable directly; the duplicative `DB3Entity` wrapper has been removed.
`foreignRef(() => xTarget, options)` derives the referenced Prisma payload,
concrete target table type, and runtime table ID from the target xTable. Its
target resolver remains lazy through the Prisma-member registry, so forward and
cross-module references are not evaluated during table construction. The two
recursive `File -> File` fields retain the legacy constructor as the explicit
self-type escape hatch.
Callers must preserve the literal selection (for example with
`Prisma.validator`) rather than first widening it to `Prisma.*DefaultArgs` if
they want an exact derived DTO type.

### Selection rules

The first implementation should support a deliberately small, explicit subset:

-  scalar members selected with `true`;
-  supported single and collection relations with explicit nested `select`
   shapes that the walker can interpret safely;
-  nested selection recursion through registered DB3 entities;
-  Prisma relation modifiers such as `where`, `orderBy`, pagination, and
   `distinct` that do not alter the selected value shape. The compiler ignores
   these while returning the original Prisma arguments unchanged.

`include` remains unsupported in the first derived contract. Prisma `include`
implicitly returns all scalar members, and the current xTable catalog cannot
soundly distinguish every persisted scalar from legacy ghost/calculated
members. An explicit `select` at each level keeps the returned shape finite and
auditable.

The helper should reject:

-  selected members that the entity cannot resolve;
-  field classes without a read contract;
-  unsupported relation shapes;
-  ambiguous ownership of a Prisma member;
-  selections whose runtime shape depends on information unavailable to the
   compiler.

The error must name the complete selection path.

### Presence rules

For a selected scalar member:

| Database shape | Field read policy                   | Derived DTO member          |
| -------------- | ----------------------------------- | --------------------------- | ---------- | ---------- |
| non-null       | all read branches inherit row       | `T`                         |
| nullable       | all read branches inherit row       | `T                          | null`      |
| non-null       | any independent field authorization | `T                          | undefined` |
| nullable       | any independent field authorization | `T                          | null       | undefined` |
| not selected   | any                                 | absent from schema and type |

Relation-edge optionality is separate from the requiredness of fields inside a
selected related row. A relation can be nullable while the related entity's
`label`, for example, is required whenever that related row is present.

## Phase 4: derived hydration

Derived hydration runs only after `dtoSchema` has parsed the read payload.

For an ordinary scalar field it:

1. preserves absence caused by field authorization;
2. preserves database `null` according to the field contract;
3. calls `DB3FieldCodec.decode` when a codec exists;
4. otherwise returns the validated transport value unchanged.

This makes codec application automatic for views that opt into derivation. It
does not change current views implicitly, and it does not require codecs to be
Zod transforms.

Implementation status: `deriveViewContract(entity, selection)` returns the
original selection, its derived DTO schema, the shared compiled member
description, and a default hydrator. The hydrator validates the complete DTO
before applying any conversion, skips authorization-absent members, and invokes
each present scalar field's codec once. Embedded single and collection relations
recurse through the same compiled member tree, preserving absent and null edges.
A foreign key selected without its relation declares a reference dependency;
hydration retains the key and adds the relation from the supplied provider.
Target xTable identity metadata determines the transport and consumer types, so
public-ID targets do not fall back to Prisma's numeric database-key type.

`EventStatus_Editor` is the first end-to-end migrated view. It now owns an
explicit Prisma selection and supplies the selection, DTO schema, and hydrator
from `deriveViewContract` to `defineCrudView`. Its `viewID` and selected members
are unchanged. Compared with the previous explicit schema, selected
`inheritRow` fields are now required at compile time and runtime, nullable
fields remain nullable, and complete DTOs hydrate to the same client values as
the former xTable hydrator.

`Event_Frontpage` is the event-level proof. The view now owns one explicit
Prisma selection and derives its DTO schema plus scalar and embedded-relation
hydration from `xEvent`. It then composes `hydrateEventDateRange` as an ordinary
view-level transform. A complete selected timing tuple produces a required
consumer `dateRange`; the three transport members do not leak into the consumer
shape. Both the TableClient and public feed query through the named view, so the
selection, authorization projection, DTO parse, and hydration form one read
path. This demonstrates that date-range composition does not require a general
compound-field abstraction. The migration also removes the frontpage-only
type/status/tag default-filling helpers: audited `inheritRow` fields are
required instead of being silently fabricated.

`EventType_Editor` and `EventTag_Editor` are the first incremental lookup-view
rollout after the pilots. Like `EventStatus_Editor`, they retain their view IDs
and selected members while deriving the read schema and codec hydration.

The generated hydrator accepts the same reference-provider input shape used by
current view hydration, even when a scalar-only view does not need it:

```ts
hydrate(dto, references)
```

That keeps a uniform view API and permits relation support to be added without
changing the caller contract.

For normalized optional foreign keys, provider registration expresses whether
consumer enrichment was requested. An unregistered target table leaves the
relation absent; a registered table with a missing identity is an error. A
required normalized relation always requires successful resolution. Embedded
relations remain authoritative and never consult the provider.

### Pilot assessment

The safe broad-rollout boundary is now concrete:

- Explicit `select` trees over scalar fields, typed foreign-single relations,
  and typed association collections derive cleanly. `include` remains rejected.
- Legacy collection fields that identify targets only by string table ID can be
  compiled at runtime, but they do not retain enough target type information to
  infer useful nested DTO types. Adding eager target types to the recursive
  Event/EventSegment graph creates circular inference problems; that is not part
  of this migration.
- `TagsField` still widens its own authorization spec, so an outer tag collection
  can remain compile-time optional even when its runtime map uses `inheritRow`.
  Its typed association target still gives correct nested field types. Fixing
  the outer presence type can be a separate, narrow follow-up.
- Dynamic `Event_Search` still combines per-actor selection additions and legacy
  collection descriptors. It remains explicit rather than weakening the
  derived contract or introducing casts.
- `ForeignCollectionField` and ghost members need an explicit read transport
  contract before a selected primitive can derive. This is deliberate: unknown
  transport values are rejected rather than guessed.
- The mutation path remains unchanged. Nothing here attempts to unify
  `ApplyToNewRow`, `ApplyClientToDb`, `separateMutationValues`, or association
  mutation behavior.

## Foreign-single fields and multiple Prisma members

A foreign-single field already represents a compound persistence relationship:

```text
statusId  <->  status
```

The entity must expose both Prisma members through a member registry even if it
continues to present one logical `ForeignSingleField` in its ordinary field
catalog.

A minimal read contract therefore allows one field to declare multiple owned
members. This is not yet a general compound consumer field abstraction.

### Embedded relation selection

If the view selects `status { ... }`, the returned nested object is
authoritative. The derived hydrator recursively hydrates that object using the
related entity contract.

~~If authorization removes the selected relation, the hydrator preserves its
absence. It must not use `statusId` or a reference provider to reconstruct data
that field authorization removed.~~

The hydrator doesn't know if a field is `undefined` because of auth, or because
of other reasons. Hydrator should not be an auth gateway; it should only be given
data that the user already has access to. That includes reference provider data.
It is therefore safe to assume if the reference provider can hydrate an object,
the user has access to it.

### Normalized foreign-key selection

If the view deliberately selects `statusId` without `status`, it is requesting
a normalized reference representation. The foreign field contract makes that
expectation visible to the compiler.

For a selected key:

-  a non-null ID is resolved through the supplied reference provider;
-  a null ID hydrates to a null relation;
-  an authorization-removed or unselected ID remains absent;
-  an expected non-null ID missing from the provider is an error with the entity,
   field, and ID in its message.

The derived contract may report this as a reference dependency. Fetching or
populating the provider remains the caller's responsibility.

This behavior is specific to a normalized selection. The auto-hydrator does not
guess that an object is expected merely because an ID exists somewhere in the
payload.

## Date ranges and other compound consumer values

Automatic event date-range hydration is practical without a general compound
field system:

```ts
const derived = deriveViewContract(xEvent, eventSelection)

const hydrate = (dto, references) => {
   const event = derived.hydrate(dto, references)
   return hydrateEventDateRange(event)
}
```

The derived layer validates and hydrates `startsAt`, `durationMillis`, and
`isAllDay` as ordinary selected scalar fields. The view then performs the
composition it owns.

This is the preferred pilot because DB3 core does not yet need to understand a
date range. A reusable projection/composition helper may live near `xEvent` so
views do not repeat it.

A true compound field should be considered later only if multiple concerns need
the same atomic grouping, for example:

-  one authorization declaration must govern all members;
-  mutations must read and write the members as one value;
-  defaults and validation are defined on the combined value;
-  many views repeat the same projection and hydration contract.

Foreign-single fields receive earlier multi-member support because DB3 mutation
and reference behavior already gives that relationship special semantics.

## Compatibility and escape hatches

During rollout, `defineView` continues to accept the current explicit pieces:

```ts
defineView({
   selection,
   dtoSchema,
   hydrate,
})
```

It also accepts the results of derivation. A view may wrap the generated
hydrator or provide its own hydrator. There should be no fallback that partially
derives an unsupported selection and quietly uses `unknown` values.

`ZodToPrismaSelection` remains available. It is still useful for schemas that
are intentionally authored DTO-first. New selection-first views should prefer
derivation from the entity and Prisma selection.

The current write and mutation path remains authoritative until a separate
design explicitly replaces it. Read-contract work may reveal duplication in
`ApplyToNewRow`, `ApplyClientToDb`, `ApplyDbToClient`,
`separateMutationValues`, and `FieldAssociationWithTable`, but that is evidence
for a later cleanup rather than scope for this pilot.

## Linear implementation checklist

Complete these steps in order. Each step should leave the repository in a
passing, usable state; later steps must not be required to make an earlier step
sound.

1. [x] **Capture current authorization behavior.** Add focused tests for row
       authorization followed by field sanitization, owner versus non-owner reads,
       field removal, and preflight filter/order authorization. Include a table with
       public row access so exposure changes are visible.

2. [x] **Add the `inheritRow` read-auth value.** Widen only `PostQuery` and
       `PostQueryAsOwner`; reject it in mutation contexts at the type level. Keep all
       existing permission entries working without migration.

3. [x] **Implement `inheritRow` runtime semantics.** Update row sanitization and
       every model-free read preflight call site. Prove with tests that row denial
       still wins, inherited fields survive field sanitization, and filters/order do
       not bypass table or row authorization.

4. [x] **Expose a field presence guarantee.** Add one core predicate used by
       schema derivation, such as `field.isReadRequiredAfterRowAuth()`. It returns
       true only when every applicable read branch inherits the row decision. Test
       mixed owner/non-owner maps.

5. [x] **Pilot `inheritRow` on an audited entity.** Choose a small lookup entity,
       review its table `View`/`ViewOwn` policy, migrate only genuinely intrinsic
       fields, and add an authorization snapshot or integration test. Do not change
       a field solely to eliminate `| undefined`. The pilot is EventStatus scalar
       display metadata; its `events` and `eventSegments` relations remain
       independently authorized.

6. [x] **Add `readTransportSchema` to the scalar field contract.** Define
       presence and nullability rules, add schemas to the scalar classes needed by
       the pilot, and add field-level parse tests. Leave authorization optionality
       out of the field's base schema.

7. [x] **Unify default scalar decode behavior.** Make the new read contract
       expose identity hydration or `DB3FieldCodec.decode`. Characterize any
       differences from current `ApplyDbToClient` before sharing or delegating its
       implementation.

8. [x] **Add an entity Prisma-member registry.** Resolve each selected Prisma
       member to exactly one field read contract. Register the ordinary member for
       all fields and both relation/object and foreign-key members for
       `ForeignSingleField`. Detect duplicate and unknown ownership early.

9. [x] **Implement the selection compiler for scalars.** Walk an explicit Prisma
       selection, resolve members, apply transport schemas, and add authorization
       optionality. Return the original selection unchanged. Errors must include
       the entity and complete selection path.

10. [x] **Expose `deriveDtoSchema` and/or `deriveViewContract`.** Ensure DTO
        schema construction and hydration share one compiled description. Add type
        tests for selected versus unselected, nullable versus non-null, and inherited
        versus independently authorized fields.

11. [x] **Implement scalar automatic hydration.** Parse first, then apply codec
        decode or identity conversion. Test nullable and authorization-absent values
        and prove codecs run exactly once.

12. [x] **Add nested embedded relation support.** Recursively compile supported
        relation selections through the related entity. Preserve relation
        nullability and authorization absence; never repair an authorization-removed
        relation from an ID.

13. [x] **Centralize Prisma model and foreign-reference metadata.** Make each
        typed xTable the Prisma delegate, canonical reference-value, and identity
        authority. Remove the duplicative `DB3Entity` wrapper, and provide a lazy
        `foreignRef()` declaration that derives payload type, target table type,
        and runtime table ID. Keep an explicit legacy escape hatch for recursively
        typed self-relations.

14. [x] **Add normalized `ForeignSingleField` hydration.** When a view selects
        the ID rather than the object, declare the reference dependency and resolve
        it from the supplied provider. Test null, absent, present, and missing
        provider entries.

15. [x] **Convert one small view end to end.** Use an audited lookup view to
        compare the old explicit DTO and hydrator with the derived versions at both
        compile time and runtime. Preserve its `viewID` and selection.

16. [x] **Convert one event view with explicit date-range composition.** Derive
        scalar/relation hydration, then wrap it with the existing or new
        event-date-range helper. This is the test that compound-field support is not
        required for the initial value. `Event_Frontpage` is the proof; its
        complete inherited timing tuple produces a required consumer date range.

17. [x] **Assess the pilot before broad rollout.** Record unsupported selection
        patterns, type-quality regressions, authorization surprises, and remaining
        duplication. The assessment above keeps legacy/cyclic collection typing,
        general compound fields, and mutation refactoring outside this rollout.

18. [x] **Migrate simple views incrementally.** Prefer views whose selections are
        entirely covered by the compiler. Keep explicit schemas and hydration for
        exceptional views rather than weakening the derived contract.
        `EventType_Editor` and `EventTag_Editor` now join `EventStatus_Editor`;
        `Event_Search` remains explicit as an intentional exception.

19. [x] **Update the architecture documentation.** Once behavior is proven,
        update the broader entity/view/hydration document and mark superseded
        examples. Keep this checklist as the record of the migration sequence and
        decisions.

## Pilot completion criteria

The pilot is successful when all of the following are true:

-  `inheritRow` has tested runtime semantics and has not broadened unaudited
   exposure.
-  A selected, non-null inherited scalar is required in the derived DTO type.
-  An independently authorized selected scalar remains optional.
-  Nullability is preserved independently of authorization absence.
-  Scalar codecs are applied automatically and exactly once by derived
   hydration.
-  A foreign field can resolve both its relation member and foreign-key member.
-  Embedded foreign objects never trigger provider lookup.
-  Normalized foreign IDs declare and use provider dependencies predictably.
-  An event date range can be composed after derived hydration without a general
   compound-field abstraction.
-  Existing explicit views and the existing mutation path continue to work.

## Deferred questions

The pilot should collect evidence for, but not pre-answer, these questions:

-  Should a general field projection own an arbitrary Prisma selection patch,
   rather than a finite set of members?
-  Should compound fields become first-class for authorization and mutation as
   well as reads?
-  Should `ApplyDbToClient` be replaced by, or delegate to, the derived hydrator?
-  Can mutation transport schemas eventually share value-shape declarations
   with read transport schemas without conflating their different presence
   rules?
-  Should reference dependencies be statically collectable for server-side
   preloading, or remain a client hydration concern?

Those decisions are intentionally downstream of the smallest useful read-side
contract.
