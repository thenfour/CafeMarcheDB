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

- Permission and role scopes are `global` and `band`; grants must match their
  role's scope. Public access and authentication are not permission scopes.
- Resolve exactly one global role: the account's assignment, or Global Public
  when unassigned or anonymous. With an explicit band, also resolve exactly one
  band role: the active membership's assignment, or Band Public when unassigned,
  inactive or absent. Public roles replace empty slots and never add grants
  alongside assigned roles. An unavailable explicit assignment fails.
- Effective permissions are the union of the selected roles' stored grants.
  `login` and every visibility permission must be granted explicitly. Authentication
  establishes identity independently of grants; Public can be configured with
  `login` without creating an authenticated person. All visibility permissions
  concern band content and are band-scoped.
- Default roles are assigned at account/membership creation. New-member
  designations never add grants at read time. `User.isSysAdmin` is display state;
  only the selected global role's grants establish Sysadmin authority.
- `global_band_admin` explicitly authorizes band feature operations through
  `BandPermission` requirements. It requires a target band and does not expand
  the effective permission list. Resource ownership and operation-specific
  membership checks remain mandatory. Configured row visibility can be read
  under this authority; private rows with null visibility retain owner checks.
- Deleted definitions, unknown permission names and `never_grant` are ineffective.
  Scope mismatches and ambiguous selected Public roles fail. Deleted/merged
  accounts lose identity and their assigned grants; sessions are revoked.
- Deactivating membership replaces its role with Band Public in that band,
  preserving the account's global role and other-band assignments.

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
| Band catalogs/content | Selected-band domain capability or `global_band_admin`, with verified ownership. |
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

Role assignment checks the current and desired selected roles' complete grants.
A null role selects Public rather than an empty grant set. Unknown or mismatched
grants are not delegable; invalid roles or ambiguous Public selections fail. The
authorized global administrator exception still requires an explicit band.
UI-filtered role choices do not replace mutation checks.

Before removing continuity-sensitive authority, inspect other active ordinary
same-band members and their selected roles. Foreign/inactive members, deleted/merged
people and platform Sysadmins must not mask the loss; grants retained through
the selected Public role are not lost. Unacknowledged risk returns `confirmationRequired`
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
requires unique active Public/default designations in each scope and a global
Sysadmin designation with explicit `sysadmin` and `login`. Fresh setup grants
`global_band_admin` to that role; it can be revoked independently.
Repeated startup preserves matrices/wording and does not revive deleted definitions,
create memberships, generate demos or run historical backfills. Signup creates
a shared account with its configured default global role; bootstrap assigns the
designated Sysadmin role through the existing one-time-secret/audit protocol.
Permissions absent from the static registry are deleted at startup. Their role
mappings cascade away, and visibility references become null (private) through
the database foreign-key rules. Known definitions retain their identities and
deleted state. Role-grant changes and historical transformations belong to deployment SQL.

The Permission name column validates against the registry and carries the
`Permission` type through derived DTOs, hydration, and visibility references.
Application consumers query DB3 views for authorized, sanitized values; server
consumers use `queryHydratedView` when they need the hydrated model. Startup
and the reads that construct authorization run before that request boundary.

The `20261019120000_explicit_authorization_roles` migration materializes previous
Public inheritance and automatic account grants into explicit database mappings,
assigns existing roleless accounts/memberships, and removes mismatched grants.
Existing custom valid grants remain. Logged-in nonmembers now use Band Public
visibility, and ordinary global roles no longer carry band grants. Startup
validates configuration without repairing revoked grants.
Previously unused global Public/new-account flags are replaced with safe explicit
defaults while their original roles, grants and account assignments remain.
Previously ineffective platform grants on band roles are discarded, preventing
their accidental promotion into anonymous or account authority.

Context changes clear old drafts/query data. Pending writes block duplicates and
unsafe dismissal; failed writes retain drafts. Changed desired roles clear
continuity acknowledgement. Successful writes refresh member/dashboard data;
presentation-affecting writes also invalidate presentation across tabs. Report a
committed save followed by refresh failure as saved but needing reload.

## Existing account policy follow up

Shared-account deactivation currently checks `manage_global_users` without the
target delegation check used for role assignment, reactivation and merging.
This existing policy difference in
[userManagementPolicy.ts](../../src/auth/server/userManagementPolicy.ts) remains
separate from the scoped-role change and band membership offboarding.
