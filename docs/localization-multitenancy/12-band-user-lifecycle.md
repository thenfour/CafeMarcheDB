# Phase 3: membership offboarding and recovery

Implemented 2026-10-07, following [member profiles and directory](11-band-user-profiles.md).
This completes the bounded membership-status slice. Phase 3, platform role
administration and application recovery remain open.

## Ownership and authorization

`BandUser_SetActive` uses the shared DB3 command endpoint and its Serializable
transaction and authorization refresh. Its strict payload requires a membership
public ID, `deactivate` or `reactivate`, and an explicit continuity acknowledgement
boolean. Account IDs, natural IDs, ownership and role changes are rejected.

Deactivation requires `deactivate_users`; reactivation requires `recover_users`.
Account ownership and `manage_users` do not substitute for either capability.
Both actions require an explicit band and a same-band membership whose shared
person is active and unmerged. Missing and foreign memberships are rejected with
the same error. Platform Sysadmins can act in an explicitly selected band.

The command changes only membership `isDeleted` and recordkeeping. It preserves
the shared account, sign-in methods, sessions, other bands, the retained band
role, instrument/tag assignments, preferences and contributions. It does not
revoke global login state. Fresh authorization immediately stops using the
inactive membership's role; account/global and public-band grants remain governed
by the existing authorization policy. Reactivation restores the retained role
and assignments, rather than creating a new membership or granting a default role.
A roleless membership still receives new-member defaults when restored.

Both actions check delegation over the retained role's complete stored grants
and its effective public/new-member grants. Recovery cannot restore authority
outside the actor's delegation envelope. Unknown or platform grants cannot be
smuggled through a band role. Deleted role/grant definitions remain ineffective.
The shared role-assignment policy supplies these checks; no lifecycle-specific
permission matcher was added.

Before deactivation removes a continuity-sensitive band capability, the shared
policy checks other active ordinary same-band members. An unacknowledged risk
returns `confirmationRequired` without a write or audit. Retrying repeats current
authorization, role and continuity checks. Public capabilities that remain after
offboarding are not reported as lost. Inactive/foreign memberships and
deleted/merged people cannot supply continuity.

The shared policy now recognizes platform Sysadmin authority from either the
account flag or an active global role granting `sysadmin`. Previously the role
assignment check recognized only the flag. Both role assignment and offboarding
now exclude either kind of Sysadmin from ordinary band continuity.

Committed changes are audited with membership identity in the same transaction.
Repeated saves of the current status are noops and produce no duplicate audit.
Generic DB3 status writes and deletion remain disabled; lifecycle does not add
an ordinary CRUD bypass.

## Reads and presentation

`BandUser_Lifecycle` derives its minimal public DTO from the canonical `BandUser`
declaration and shared role selection. Recovery uses the ordinary paginated DB3
endpoint, snapshot execution, tokenized name search, stable name/public-ID order,
counts and paging. There is no separate recovery SQL or endpoint family.

The canonical membership declaration defaults to active rows. Explicit
`membershipStatus: "inactive"` requires `recover_users`, and callers must also
request `includeDeleted: true`, enforced through DB3's deleted-row policy.
`includeDeleted` alone does not change active profile/directory behavior. Both
statuses exclude deleted or merged shared people. Recovery display also retains
the ordinary `view_users_basic_info` requirement. Contact and account credentials
are absent from the recovery DTO.

Active profiles expose a deactivation confirmation. `/backstage/recoverMembers`
lists inactive memberships with their existing localized role labels and a
reactivation confirmation. Drawer and directory links preserve the current band
and route locale through the existing link helpers. Queries carry the complete
language preferences and refresh identity. Page access requires `recover_users`;
the UI checks basic visibility as well before reading the recovery list.

Interface messages use registered static strings. Failed writes remain available
for retry, pending requests block duplicate submission/dismissal, and continuity
warnings require an explicit checkbox. Successful writes refresh membership,
dashboard and presentation/query caches, including the existing other-tab
notification. Refresh failures after a commit have a distinct message. Band,
person or presentation-context replacement remounts the controls and drafts.

## Validation

- **222 focused tests across 24 files passed**, including **51 native MariaDB
  tests across five files**. Coverage includes membership instruments/tags/roles/
  profiles, localization/settings, shared DB3 reads/commands/field contracts,
  route metadata and isolated DOM controls.
- New lifecycle coverage: 11 transport/query tests, 15 native tests and eight DOM
  tests. Cases cover two-band preservation, retained assignments/preferences/
  sessions, active/inactive reads, counts/paging, delegation/default roles,
  malformed grants, stale deactivation/recovery grants, generic-write rejection,
  continuity, audit noops and transaction rollback.
- Role regression coverage now checks both carriers of Sysadmin authority.
  Existing profile DOM fixtures explicitly include the new membership-status
  selection. No tests were removed.
- The broader `authorization/backstageServerGuard.test.ts` probe has **seven
  failures**, with identical failing names on starting revision `7f9b1224` in an
  isolated comparison checkout. Its legacy account/event/instrument fixtures
  still need recovery; these failures were not hidden or rewritten here.
- Nonincremental TypeScript remains at **655 diagnostics**, with no increased
  file/error-code groups compared with the starting revision. New/adapted modules
  have no diagnostics. Focused ESLint and `git diff --check` pass.

Native checks used a new private MariaDB 10.11.9 server and disposable database
initialized from the target schema. The database was dropped and server stopped
after validation. No application database was used. Full-suite, build and
interactive browser acceptance remain application-recovery work.

## Next recovery

Continue with platform GlobalRole/BandRole definition/matrix administration,
then event invitation/default-instrument and shared-account merge consumers,
remaining catalogs/global administration, band content and registered settings
editors. Shared-account lifecycle endpoints remain separate platform work; band
recovery does not reactivate a deleted or merged shared person. Advanced directory
features, account-only profiles and member analytics retain their phase 4 owners.
Band creation, invitations and complete portal lifecycle/routing follow in phase 5.
