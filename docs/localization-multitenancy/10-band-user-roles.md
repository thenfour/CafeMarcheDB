# Band membership role assignment

Implemented 2026-10-07 as the next bounded phase-3 slice after
[member tags](09-band-user-tags.md). Role assignment now has a membership-owned
command and manager page. Member profiles/search, membership offboarding and
recovery, and platform role administration remain incomplete.

## Reads and ownership

`BandUser_Roles` derives its DTO from an explicit Prisma membership selection.
It returns the shared person's public identity/name and the membership's public
BandRole identity. It uses the existing active-membership filter, band ownership,
owner/basic-profile authorization, public-ID projection, and snapshot execution.
Roleless owners can read their own membership. Inactive memberships and
deleted/merged people are excluded. No role permissions or internal IDs are
delivered.

`BandRole_List` and `BandRole_Choices` share a typed, read-only descriptor for
platform-owned role metadata.

Role names and Markdown descriptions use the existing localized fields and
resolved query strategy, including snapshot execution, ordered preferences,
band overrides, provenance, effective-text matching, and stable ordering/counts/
pagination. There is no role-specific reader, resolver, matcher, or endpoint.
Deleted roles are absent from the catalog. A retained assignment to a deleted
role remains identifiable and displays an unavailable label.

Choices additionally require an explicit band and `assign_user_roles`. Non-
Sysadmins receive only roles whose active stored grants are delegable and within
their authority. Unknown or protected grants exclude a choice; deleted grants
do not. This filtering helps the UI; the mutation independently checks authority.

## Transactional assignment and continuity

`BandUser_AssignRole` uses the existing DB3 command endpoint. Its strict payload
requires membership public ID, BandRole public ID or null, and an explicit
`acknowledgeContinuityRisk` boolean. Numeric identities, ownership fields, and
shared-account/global-role fields are rejected.

The endpoint provides Serializable execution and refreshed authorization in the
write transaction. The command requires `assign_user_roles`, loads an active
same-band membership, and verifies both the current and desired role grant sets
against the actor's delegation authority. Member management, taxonomy authority,
account ownership, and grants from another band do not substitute for that
capability. Platform Sysadmins can assign roles in an explicitly selected band.
No implicit band is selected.

Null removes the assigned role and enables the designated new-member defaults;
it does not mean an empty permission set. Delegation checks include those defaults
and the public role, preventing escalation through a null assignment. The command
also rejects missing/deleted desired roles and ambiguous active designations.

Before losing a continuity-sensitive band capability, the command checks other
active ordinary memberships in that band, including their public/new-member
defaults. Memberships in another band, deleted/merged people, inactive
memberships, and Sysadmins do not mask loss of ordinary band administration.
Changing a Sysadmin's own membership does not remove an ordinary continuity
holder.

An unacknowledged risk returns the typed `confirmationRequired` result with
capabilities and performs no write or audit. Confirmation re-executes all checks
against current database state. A successful edit updates only `BandUser.bandRoleId`
and recordkeeping, and audits the change in the same transaction. It leaves the
shared person, global role, other memberships, assignments and sessions intact.
An unchanged role adds no audit or recordkeeping update. Generic field writes
cannot bypass this command.

## Manager controls

`/backstage/userRoles` is registered with `assign_user_roles` and linked beside
the instrument/tag management pages. It loads the generic membership, role-label,
and assignable-choice views with the full presentation context. The editor uses
registered localized labels and displays unavailable retained roles explicitly.

Failed saves retain the dialog and selected role. Pending writes prevent duplicate
submission and cancellation. Continuity warnings require an explicit checkbox;
changing the desired role clears the acknowledgement. A successful save refreshes
membership/choice/dashboard data and invalidates presentation authorization and
localized queries through the shared invalidation API, including its browser-tab
notification. A band/context replacement remounts the editor. A committed edit
followed by a refresh failure reports that the role was saved and needs reloading.

## Validation and remaining work

Focused regression coverage passes **146 tests across 19 files**, including
**40 native database tests across six files**. This combines the 15-file
membership/localization/settings/query/route regression with the final seven-file
role/catalog/memory-query run, counting repeated files once at their latest result.
New coverage is in:

-  `tests/bandUserRoles.test.ts`: strict public transport, registration, reset,
   derived references, read-only roles, and typed confirmation results.
-  `tests/bandUserRoles.mysql.test.ts`: two-band isolation, shared-account
   preservation, manager/owner boundaries, target and desired delegation limits,
   null defaults, stale grants through command execution, localized shared reads,
   inactive/deleted state, continuity, no-op audits, generic-write rejection and rollback.
-  `tests/bandUserRolesEditor.test.tsx`: localized labels, scoped generic queries,
   confirmation/reset, failed-save drafts, pending protection, presentation
   invalidation, refresh failure, and band-switch state replacement.

ESLint on changed/new code and `git diff --check` pass. Nonincremental TypeScript
still reports **665 diagnostics**, the same count and file/error-code groups as
starting commit `63dcbeb5`; this slice's new/adapted modules have no diagnostics.
Full suite/build and interactive application acceptance remain phase 4 work.

Native validation uses a private MariaDB 10.11.9 server and disposable
target-schema database. No existing application database is changed. The
disposable database is dropped and its server stopped after validation.

Continue with member profile/search consumers, membership offboarding/recovery,
event invitation/default-instrument and merge consumers, remaining catalogs/
global administration, band content, and registered settings editors. The old
person-level role/profile surfaces remain unadapted and rejected in selected-band
operations; this slice does not add compatibility adapters or finish platform
GlobalRole/BandRole definition/matrix editing. Phase 3 and milestone A remain open.
