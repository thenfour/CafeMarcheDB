# Band membership instrument assignments

Implemented 2026-10-06 as the next bounded phase-3 slice. This restores instrument
selection in the profile and member-instrument management page on the target
model. Phase 3 and application recovery remain incomplete.

## Ownership and reads

`BandUser_Instruments` is a typed, derived DB3 view of an active membership,
its shared person's public identity/name, and its `BandUserInstrument` rows.
Instrument references use public identities and the existing dashboard catalog;
the membership query does not resolve or return a duplicate instrument catalog.
Existing stored public IDs are preserved.

The band is supplied explicitly through the existing presentation/DB3 request
context. Memberships are constrained to that band and to active, unmerged people.
The owner can read their own membership with `login`, including a roleless active
membership. Reading other memberships requires `view_users_basic_info`.
Account creation does not create membership. No band is inferred for platform
requests, outsiders, or public visitors.

Shared DB3 now supports typed ownership through a parent relation:

```typescript
bandScope: {
    member: "bandId",
    via: { relation: "bandUser", ownerUserMember: "userId" },
    managePermission: Permission.manage_users,
}
```

The shared where clause and row authorization use that parent for band and person
ownership. The selection planner fetches its required authorization fields,
including active-membership state, and strips those support values from the DTO.
Related ownership is used for read-only assignment descriptors in this slice;
assignment writes are owned by the aggregate command below.

Membership reads use Prisma queries with `readConsistency: "snapshot"`.
`executeDB3Read` supplies RepeatableRead and refreshed authorization for ordinary
and paginated generic reads. This is independent of band ownership and of
`queryStrategy: "resolved"`, which continues to select in-memory resolved-text
queries for localized catalogs. Page/RPC callers have no isolation or refresh
obligation.

`TagsField.readVisibility: "association"` retains authorized assignment rows
when their instrument/group is hidden. Other tag declarations retain their
existing selectable-target filtering. Hidden assignments display an unavailable
label when their instrument is absent from dashboard choices; their stored
identity and primary state remain intact until explicitly edited.

## Transactional edits

`BandUser_EditInstruments` is registered on the membership and uses the existing
DB3 command endpoint. Its strict payload supports replacing the instrument list
or selecting an already assigned primary instrument. Numeric identities,
duplicate instruments, and undeclared ownership/primary fields are rejected.

The shared command endpoint supplies Serializable execution and refreshes
authorization in the mutation transaction. The command loads the active target
membership in that band, then applies the DB3 row and assignment-field policies:
the owner needs `login`; editing another member needs `manage_users` in the
selected band. Band roles from another context and stale client grants do not
authorize a write. Deleted memberships and deleted/merged people are rejected.

List replacement composes shared DB3 association persistence and auditing.
New instrument references must resolve through the visible catalog in the same
band, including functional-group visibility. Existing hidden assignments can be
retained or removed without silently losing them during unrelated edits.
Stored cross-band instrument links cause the command to reject the edit.

Every nonempty edited list has exactly one primary. An existing surviving primary
is retained. Otherwise, the first association in public-ID order becomes primary;
the same order supplies the read-only fallback for migrated lists without an
explicit primary. An empty list has none. Choosing an unassigned primary fails
before any write. Primary booleans use the shared DB3 field validation, and all
assignment/primary audits use one operation context and the same transaction.
Unchanged edits preserve association identities and produce no extra audits.

There is no standalone generic assignment CRUD surface: it could bypass the
primary invariant. Membership creation, role assignment, and deactivation are
also outside this view/command.

## Profile and management UI

`OwnInstrumentsControl` now loads the selected membership instead of editing the
shared person's obsolete instrument collection. `/backstage/userInstruments`
uses the same membership editor for band managers; its route capability is
`manage_users`. Both flows use the existing selection picker, dashboard
instrument references, and registered localized labels. Own-profile feature
telemetry is retained.

Band/context replacement remounts the membership editor, and generic query keys
carry the band and complete presentation input. Missing band/membership and
disappearing membership states are explicit. A successful edit refreshes the
membership and dashboard caches. Failed writes retain the open dialog and draft,
with the error inside the dialog. Pending writes disable choices and prevent
duplicate submission. A committed write followed by a failed refresh reports
that the data was saved and needs reloading.

The obsolete nontransactional `updateUserPrimaryInstrumentMutation` and unused
person-level instrument API helper were removed. Trivial stale imports in that
API module were also removed. The selection planner now preserves requested
nested selections when a resolved query also needs that relation as support.

## Validation and remaining work

The focused regression run passed **311 tests across 32 files**, including
**28 native database tests across six files**. This includes the existing
instrument/group/tag/query/reference/localization/settings coverage from
[07-db3-band-instruments.md](07-db3-band-instruments.md#validation-and-remaining-work),
plus these new files:

- `tests/bandUserInstruments.test.ts`: strict command transport, registration,
  parent ownership dependencies, and preservation of requested child selections.
- `tests/bandUserInstruments.mysql.test.ts`: two independent band memberships,
  roleless self-service, manager/owner boundaries, hidden retention, invalid
  references and primaries, inactive/merged people, no-op edits, audits and rollback.
- `tests/bandUserInstrumentsEditor.test.tsx`: resolved reference labels,
  membership-scoped default requests, failed-save draft retention, manager
  controls, hidden assignment retention, and pending-save protection.

`tests/db3ReadExecution.test.ts` additionally proves snapshot execution for
ordinary SQL membership reads. ESLint on all changed/new code and
`git diff --check` pass. Nonincremental TypeScript still reports **668
diagnostics**, versus **674** at starting commit `3bdf5b99`; the new/adapted
membership modules, pages and tests have no diagnostics. Remaining errors belong
to the unfinished migration consumers. The complete suite and build were not
rerun for this bounded slice.

No existing application database was changed. Native checks use a private
MariaDB 10.11.9 server and disposable target-schema database. They establish this
slice's contracts, not a migrated production-copy rehearsal or interactive
application acceptance. Full suite/build/browser acceptance remains phase 4.

Continue with the remaining member-profile/taxonomy, event/default-instrument,
and merge consumers, remaining catalogs/global administration, band content,
and registered settings editors. Legacy `UserInstrument` descriptors and
person-based payloads still used by those consumers remain rejected in selected
band operations; they are not compatibility adapters. Do not mark phase 3 or
milestone A complete until those migrations and phase-4 acceptance pass.
