# Authorization and membership contracts

Authorization is independent of presentation language and hosting mode. These
are policy boundaries; [the plan](04-implementation-plan.md) owns delivery status.
Implementation owners are [serverAuthorization.ts](../../src/auth/server/serverAuthorization.ts),
[bandUser.ts](../../src/core/db3/shared/entities/user/bandUser.ts), membership
[commands](../../src/core/db3/server/commands) and
[db3BandMemberPolicy.ts](../../src/core/db3/server/db3BandMemberPolicy.ts).

## Trusted context and grants

Load fresh account/role state on the server. An explicit band public ID resolves
an active band and membership; omitted/null means platform/account context and
never selects a default band. Missing/deleted supplied bands fail. Keep selected
band, membership, locale and membership-derived permissions request/tab-local;
shared sessions hold only account/person state and band-independent grants.
Client context exposes public identities and permission names, not internal IDs.

Refresh authorization inside the operation's read/write transaction. Constrain
queries by the trusted band and verify loaded resource ownership separately from
capability checks. Member-only operations also require membership. The legacy
synchronous `resolver.authorize` must reject band capabilities, including stale
cookie grants. Supplied account hints are IDs to reread, not trusted role state.

- Active people receive stored `login` and logged-in visibility independently of
  membership. Deleted/merged people lose access and sessions are revoked.
- Public-role band grants require a resolved band. Only an active selected
  membership supplies its role; null uses designated new-member defaults.
  Outsiders and inactive memberships do not receive that default.
- Global-role grants are membership-independent. `isSysAdmin` inherits the actual
  designated active global Sysadmin grants; it is not an authorization bypass.
- Registry scope is authoritative: band roles cannot confer platform authority;
  global-role band grants still require a band. Deleted definitions, unknown
  permission names and `never_grant` are ineffective. Ambiguous active role
  designations fail rather than combining grants.
- Deactivating membership removes that band's member grants while preserving
  account/global, other-band and applicable public access.

## Capability boundaries

| Operation | Authority |
| --- | --- |
| Own shared display profile/preferences | Active account; credentials retain dedicated protected gates. |
| Another person's shared profile/global role/account lifecycle | `manage_global_users`; merge also needs `merge_users`. |
| Own membership instruments | Owner with `login`. |
| Another member's instruments; any member's tags | `manage_users`. Taxonomy editing alone cannot assign tags. |
| Membership role/deactivation/reactivation | `assign_user_roles` / `deactivate_users` / `recover_users`, with delegation/continuity checks. |
| Role definitions/designations/matrices | Platform `sysadmin`. |
| Global catalogs | `manage_global_catalogs`. |
| Band catalogs/content | Selected-band domain capability and verified ownership. |
| Settings/localization | Relevant global/band capability plus per-key rules. |
| Band lifecycle | Platform `manage_bands`; membership operations keep their band gates. |

Role definitions/matrices remain platform-owned. A band assigns an existing
role; band administration cannot modify shared accounts or global definitions.

## Member reads and writes

Membership reads require an explicit band and exclude inactive memberships and
deleted/merged people by default. Owners may read their active membership with
`login`, including roleless owners; other-member reads need `view_users_basic_info`.
Profile URLs retain person public identity and resolve through the selected
membership. Directory access additionally requires `search_users`; own-profile
access does not confer it. The basic directory is not reference parity.

Contact fields require ownership or `view_user_contact_info`; membership creation
date requires `manage_users`. Credentials, internal IDs and grant inventories
stay off member DTOs. Sign-in summaries use the protected platform account reader,
work without band selection and are unavailable to ordinary band managers.

Assignments and catalog references use public membership/band identities, keeping
person IDs distinct. Hidden existing assignments remain identifiable but may lack
labels; hidden functional groups suppress instrument labels and new choices.
Cross-band links are excluded from reads and rejected on writes. New references
must be visible; existing hidden references may be retained or removed.

Commands accept strict public inputs and refresh grants in Serializable execution.
Ownership, reference validation, writes and audits share the transaction; noops
preserve identity/history. Generic account/association CRUD cannot bypass them.
A nonempty edited instrument list has exactly one assigned primary; retain a
surviving primary or choose the first public ID in stable order. Empty lists have
none; migrated primary-less lists use that same read fallback.

Shared-name/phone edits change the person across bands. Another-person edits need
`manage_global_users`, not `manage_users`, and target an active selected membership.
Omitted phone stays unchanged; blank clears it. Forms omit unreadable fields
instead of clearing them. Person-level instrument/tag fields remain rejected.
Invitation significance is read-only in catalog editing; hiding retains assignments.

## Delegation, continuity and membership status

Role assignment checks current and desired complete effective grants, including
public/new-member defaults. Null role is not an empty grant set. Unknown/platform
grants are not delegable; invalid roles or ambiguous defaults fail. The authorized
platform Sysadmin exception still requires an explicit band. UI-filtered role
choices do not replace mutation checks.

Before removing continuity-sensitive authority, inspect other active ordinary
same-band members and effective defaults. Foreign/inactive members, deleted/merged
people and platform Sysadmins must not mask the loss; grants retained through
public access are not lost. Unacknowledged risk returns `confirmationRequired`
without writes/audits. Confirmation reruns current authorization and policy checks.

Deactivation/reactivation requires its distinct capability and delegation over
the retained role; deactivation also checks continuity. Change only membership
status and recordkeeping. Preserve the account, sessions, other memberships,
role, assignments, settings and history. Reactivation restores retained state;
it neither creates a membership nor recovers a deleted/merged person.

Recovery reads require inactive-membership selection, `includeDeleted: true`,
`recover_users` and basic-member visibility. `includeDeleted` alone does not expose
inactive members. Use the ordinary scoped snapshot/pagination pipeline.

## Initialization and UI consistency

[accessControl.ts](../../src/setup/accessControl.ts) initializes known definitions
and missing descriptions, seeds roles only when role tables are empty, and
requires a unique active global Sysadmin designation with required grants.
Repeated startup preserves matrices/wording and does not revive deleted definitions,
create memberships, generate demos or run historical backfills. Signup creates
only a shared account; bootstrap uses the existing one-time-secret/audit protocol.
Permission additions and historical transformations belong to deployment SQL.

Context changes clear old drafts/query data. Pending writes block duplicates and
unsafe dismissal; failed writes retain drafts. Changed desired roles clear
continuity acknowledgement. Successful writes refresh member/dashboard data;
presentation-affecting writes also invalidate presentation across tabs. Report a
committed save followed by refresh failure as saved but needing reload.
