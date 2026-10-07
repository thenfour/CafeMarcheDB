# Phase 3: member profiles and directory

Implemented 2026-10-07, following [membership-role assignment](10-band-user-roles.md).
This is a bounded recovery of member reads, shared display-profile edits and
directory navigation. Application recovery is still incomplete.

## Ownership and reads

`BandUser_Profile` derives its DTO from the canonical `BandUser` declaration and
typed Prisma selection. It composes the existing instrument, tag and role view
selections. `BandUser_Identity` supplies the smaller person-name lookup used by
user chips. Both use shared DB3 reads and membership snapshot policy; there is no
separate profile reader or hand-maintained DTO schema.

All member reads require an explicit band. Active membership filtering also
excludes deleted or merged shared people. Profile URLs keep the **person's** public
ID; their lookup starts from authorized memberships in the selected band. Missing,
inactive and other-band memberships do not produce a profile. Natural IDs, account
credentials and role grant inventories do not appear in the DTO.

Basic viewers receive the person's name and membership assignment identities.
Contact fields are independently projected for the owner or
`view_user_contact_info` holders. Membership creation dates require `manage_users`.
Roleless members can read their own profile without gaining directory access.
The detail route admits `login`; SSR and client queries enforce target access.
The directory route retains `search_users`, and its UI requires basic-member
visibility. Lazy chip lookup returns no label without an explicitly selected band.

## Directory and presentation

`/backstage/users` uses the ordinary `db3paginatedQueries` endpoint. Shared DB3
supplies authorized rows and totals, tokenized name search, paging and ordering.
Declared membership parameters filter by public band-tag, band-instrument and
band-role identities, including an explicit unassigned-role filter. Generic
reference resolution rejects missing, hidden or other-band catalog selections.
Existing hidden assignments remain in profile reads with unavailable labels.

Foreign-single fields can declare a typed display member for Prisma ordering.
DB3 validates that member and appends a public-identity tie breaker for stable
pages. Member name ordering traverses `user.name`; manager join-date order uses
`BandUser.createdAt`, rather than shared-account creation dates. Name search
does not probe phone, contact email or sign-in identities.

Catalog labels come from existing localized dashboard catalogs and the read-only
band-role view. Interface strings are registered static strings; join dates use
ICU formatting with the request's formatting locale. Person links, dashboard links
and breadcrumbs preserve band and route locale. Queries carry the full browser
language list and presentation refresh key. Context changes remount drafts and
directory state, with previous query data disabled.
Lazy chips also preserve their color/link options and avoid conditional query
hooks when selection becomes empty.

The detail route and `/backstage/profile` reuse migrated instrument, tag and role
editors. Role assignment retains delegation and continuity checks. The own-profile
page retains calendar preferences and separately authorized sign-in controls.

## Shared-person edits

`BandUser_EditProfile` accepts an active membership identity, required name and
optional nullable phone. Its strict contract rejects account identity, email,
credentials, role and lifecycle fields. It composes canonical shared-person DB3
field validators; those fields declare the schema's 768-character limit. An
omitted phone stays unchanged; an explicit blank clears it.

Owners can edit their own shared name and phone. Editing another person's profile
requires `manage_global_users`; `manage_users` alone is insufficient. The selected
membership must still exist in the same band, even for a platform administrator.
The endpoint refreshes grants in its Serializable write transaction. Only the
shared person changes; memberships and assignments remain independent. Real
changes are audited once, and unchanged saves are noops.

The editor explains that these values are shared across bands. Failed saves keep
drafts for retry, duplicate pending saves are blocked, and post-commit refresh
failures have a distinct message. Success refreshes the profile, dashboard, query
caches and presentation context, including other tabs. If a platform writer cannot
read a contact field, the editor omits it instead of clearing it.

## Validation

- **233 focused tests across 22 files passed**, including **36 native MariaDB
  tests across five files**, shared DB3 contracts, membership commands, isolated
  DOM editors, route metadata and test-environment conventions.
- New coverage: 15 transport/query tests, 10 native profile/directory tests,
  five page/chip boundary tests and eight DOM tests. Native cases cover two bands
  sharing a person, roleless ownership, outsiders, contact privacy, inactive/merged
  people, filters, sorting, totals, paging, hidden assignments, self/platform
  edits, auditing/noops and stale-grant rejection.
- A broader legacy authorization probe has **nine failures** in
  `db3ReadSelection.test.ts` and `userDataVisibility.test.ts`. The same probe on
  starting revision `17683522` had **ten failures**. Remaining failures have the
  same names and concern unmigrated event/user fixtures; chip lookup denial now
  passes. These fixtures were not rewritten in this slice.
- Non-incremental TypeScript diagnostics fell from **665 to 655**, with no
  increased file/error-code groups. Adapted pages and new modules/tests have no
  diagnostics.
- Focused ESLint and `git diff --check` passed. Full-suite, build and interactive
  browser validation were not repeated; the application remains unbuildable.

Native checks used a private database initialized from the target Prisma schema.
No application database was used for validation.

## Remaining recovery

The directory exposes one choice per catalog filter and authorized total counts.
Advanced multi-choice/exclusion filters, per-option facet counts, saved presets,
query-string state and CSV export still need shared DB3 search recovery. Old
unscoped facet SQL would give incorrect membership authorization and counts.
Contact/sign-in search is also pending.

Membership offboarding/recovery, account-only profile editing without membership,
shared-account lifecycle/merge operations and platform role administration remain
separate work. Old account-admin and analytics components remain for their domain
recovery; the migrated member profile does not render them. Attendance, credits,
wiki contribution and mass-analysis tabs await event/song/wiki consumers. Full
portal routing follows in phase 5.

Continue with membership offboarding/recovery and platform role administration,
then event invitation/default-instrument and merge consumers, remaining catalogs,
band content and registered settings editors. Track outstanding directory and
analytics features with phase 4 workflow acceptance.
