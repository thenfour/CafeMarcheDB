# Band membership contracts

`User` is the shared person; `BandUser` owns one band's role, instruments, tags,
preferences, and active status. These migrated contracts use
[shared DB3](07-db3-contracts.md) and [request authorization](05-authorization-foundation.md).
They do not establish whole-application readiness. Further lifecycle features and
advanced directory work follow the [restoration plan](04-implementation-plan.md).

## Member reads and directory

The canonical membership declaration lives in `bandUser.ts`.
`activeBandMembershipWhere()` excludes inactive memberships and deleted/merged
people. Parent-owned assignment fields use `bandScope.via`; typed selections
derive the views without parallel DTO schemas. Reads use snapshot consistency
with fresh authorization.

All member reads require an explicit band. Owners can read their active membership
with `login`, including roleless owners. Other-member reads require
`view_users_basic_info`. Profile URLs retain the person's public ID and resolve it
through memberships in the selected band. Missing/inactive/foreign memberships
produce no profile. Lazy chips return no label without an explicit band.

| View | Delivered information |
| --- | --- |
| `BandUser_Identity` | Minimal person public identity/name. |
| `BandUser_Instruments`, `BandUser_Tags` | Person public identity/name and public assignment/reference identities. Catalog labels come from dashboard references. |
| `BandUser_Roles` | Person identity/name and public assigned-role identity; no role grants. |
| `BandUser_Profile` | Composed member assignments/profile. Contact fields require ownership or `view_user_contact_info`; membership creation date requires `manage_users`. |
| `BandUser_Lifecycle` | Minimal member status and role identity for status management; no contact/credential data. |

Natural IDs, account credentials, and permission inventories stay off these DTOs.
Hidden existing assignments remain identifiable, with unavailable labels when
their catalog reference is not delivered. Stored cross-band links are excluded
from reads and reject writes.

`/backstage/users` uses ordinary paginated DB3 reads: tokenized name search,
counts, stable ordering, and paging. Declared filters accept public band-tag,
band-instrument, and band-role identities, including an unassigned-role filter.
Generic reference resolution rejects missing/hidden/foreign selections. Name
ordering traverses `user.name`; manager join-date ordering uses `BandUser.createdAt`
rather than account creation. Public identity breaks ties. Search does not probe
phone, email, or sign-in identities. Directory access retains `search_users` and
basic-member visibility; own-profile access does not confer directory access.

Profiles, directory, links, and breadcrumbs preserve band/route locale. Queries
carry the full language preferences and refresh key. Context changes discard old
drafts/query data. The own profile retains calendar preferences and separately
authorized sign-in controls.

## Assignment commands

Commands use strict public-ID payloads and fresh authorization inside Serializable
execution. They reject undeclared ownership/internal IDs. Mutations and audits
share one transaction/operation context. Unchanged values preserve association
identity and do not add audits. Generic field/assignment CRUD cannot bypass them.

| Command | Authority and invariant |
| --- | --- |
| `BandUser_EditInstruments` | Owner with `login`, or `manage_users` for another active same-band member. Replace assignments or select an already assigned primary instrument. |
| `BandUser_SetTags` | `manage_users`, including edits to one's own membership. Accept at most 64 unique tag public IDs. Taxonomy authority alone cannot assign invitation-affecting tags. |
| `BandUser_AssignRole` | `assign_user_roles`; active same-band member; explicit role public ID/null and `acknowledgeContinuityRisk` boolean. |

Instrument/tag commands share editable-membership loading, target resolution,
association persistence, and auditing. New references must be visible and
same-band. Existing hidden references may be retained/removed. Instrument choices
also exclude hidden groups. Duplicate, numeric, cross-band, or invalid primary
identities fail before writes.

Every edited nonempty instrument list has exactly one primary. Retain a surviving
existing primary, otherwise choose the first public ID in stable order. Reads of
migrated lists with no primary use the same fallback. Empty lists have none;
selecting an unassigned primary is rejected.

Member tags use `xBandUserTag` with optional `GlobalUserTag` source, localized
name/Markdown description, and independently inherited color/order/style.
`manage_user_taxonomy` controls catalog edits/hidden reads. Null resets an override;
an empty style is explicit. Invitation significance is read-only and preserved by
unrelated edits. Ordinary deletion is disabled; hiding retains associations.
The common opt-in service enforces one wrapper per band/global tag. There is no
legacy `text` alias in the new label contract.

## Role delegation and continuity

`BandRole_List`/`BandRole_Choices` use one read-only localized descriptor for
platform-owned definitions. Choices require an explicit band and
`assign_user_roles`, and filter to roles within the actor's delegation authority.
Mutation checks are independent of that UI filtering. Deleted roles are absent
from choices; retained assignments remain identifiable as unavailable.

Role assignment checks both current and desired complete active stored grants,
plus effective public/new-member defaults. Unknown/platform grants are not
delegable; deleted definitions are ineffective. Null activates designated
new-member defaults rather than an empty permission set. Missing/deleted desired
roles and ambiguous designations fail. Platform Sysadmins retain their authorized
delegation exception in an explicitly selected band.

`db3BandMemberPolicy.ts` shares delegation and continuity policy across role/status
commands. Before removing a continuity-sensitive capability, check other active
ordinary same-band members, including effective defaults. Foreign/inactive
memberships, deleted/merged people, and platform Sysadmins do not mask the loss.
Sysadmin authority is recognized through the account flag or active global role
granting `sysadmin`. Capabilities retained through public access are not lost.

An unacknowledged risk returns typed `confirmationRequired` without writes/audits.
Confirmation repeats current authorization/delegation/continuity checks. Successful
role assignment changes only `BandUser.bandRoleId` and recordkeeping.

## Shared-person profile edits

`BandUser_EditProfile` requires an active same-band membership, required name, and
optional nullable phone. It uses canonical shared-person field validators and
their 768-character limits. Omitted phone stays unchanged; explicit blank clears
it. Account IDs, email, credentials, roles, and lifecycle fields are rejected.

Owners edit their shared name/phone with account authority. Editing another person
requires `manage_global_users`; `manage_users` is insufficient. A platform writer
still targets an active selected-band membership. The command changes only the
shared person and audits real changes once. The UI explains that values are shared
across bands and omits unreadable contact fields instead of clearing them.

## Membership deactivation and recovery

`BandUser_SetActive` requires a membership public ID, `deactivate`/`reactivate`, and
explicit continuity acknowledgement. Capabilities are `deactivate_users` and
`recover_users` respectively; ownership or `manage_users` cannot substitute.
Both actions require a same-band membership whose person is active/unmerged.
Missing/foreign targets share the same rejection. Both actions check delegation
over the retained role and effective defaults; deactivation also checks lost
continuity. Generic deletion/status writes remain disabled.

Only membership `isDeleted` and recordkeeping change. The shared account, sign-in
methods, sessions, other bands, retained role, assignments, settings, and history
remain intact. Fresh authorization stops using the inactive member role while
retaining applicable global/account/public grants. Reactivation restores the
retained role/assignments; a roleless membership uses new-member defaults. It does
not create a membership or replace the retained role. Repeated status saves are
noops; committed status changes are audited in the transaction.

The canonical declaration defaults to active membership reads. Recovery requires
`membershipStatus: "inactive"`, `recover_users`, and `includeDeleted: true` under
the deleted-row policy. `includeDeleted` alone does not expose inactive members.
Recovery display also needs `view_users_basic_info`; deleted/merged shared accounts
are not recoverable through this view. The ordinary snapshot/pagination/name-search
pipeline supplies recovery, with no separate SQL/endpoint family.

## Controls and refresh

Existing management routes include `/backstage/userInstruments`,
`/backstage/userTags`, `/backstage/userRoles`, and `/backstage/editUserTags`.
Active profiles expose deactivation; `/backstage/recoverMembers` lists inactive
members for authorized recovery. All controls use registered localized messages,
shared references, and their command-specific gates.

Pending writes block duplicate submission and unsafe dismissal. Failures retain
drafts for retry; continuity requires explicit acknowledgement. A changed desired
role clears acknowledgement. Context replacement remounts controls. Successful
writes refresh member/dashboard/query data; presentation-affecting writes also
invalidate shared presentation and notify other tabs. A committed save followed
by refresh failure reports that the save succeeded and reloading is needed.
