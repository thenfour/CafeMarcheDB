# Band member tags and membership assignments

Implemented 2026-10-06 as the next bounded phase-3 slice after
[membership instruments](08-band-user-instruments.md). The tag catalog,
dashboard references, and manager assignment controls use the target model.
Broader member profiles/search and event invitation consumers remain incomplete.

## Catalog ownership and presentation

`xBandUserTag` declares a band-owned catalog over `BandUserTag`, with optional
`GlobalUserTag` inheritance. It uses the existing DB3 localized/inherited fields,
derived CRUD view, resolved query strategy, transactional string writes, field
validation, and audits. There is no tag-specific reader, matcher, validator,
hydration schema, or endpoint family.

- Authenticated readers can see the selected band's visible tags. Catalog
  creation/editing and hidden-entry reads require `manage_user_taxonomy` in that
  band. Platform context does not infer a band.
- `name` and Markdown `description` resolve through the shared per-string
  localization policy. Color, sort order, and style class inherit independently.
  Null clears an override; an empty style class remains an explicit override.
- Existing public identities are retained. Visible names use `name`; there is
  no compatibility `text` alias in the new catalog/dashboard contract.
- Invitation `significance` remains a read-only inherited field. Existing
  global and band values are preserved; unrelated catalog saves cannot rewrite
  them. Its behavioral cleanup is still separate, as specified in
  [01-schema.md](01-schema.md).
- Ordinary deletion is disabled. Hiding preserves references and allows
  authorized restoration. The shared server opt-in service preserves one
  wrapper per band/global tag; global catalog administration and opt-in UI
  remain later work, as for song tags.

`BandUserTag_Catalog` replaces `UserTag_Editor` on the catalog management page.
The old editor and event-search views remain for unfinished profile/event
consumers and continue to reject selected-band operations.

## Membership assignments

The canonical `xBandUser` descriptor now lives in `bandUser.ts`, separate from
instrument-specific views and commands. Its two assignment fields have explicit
policies: instrument selection is self-service; member tags require
`manage_users` even when the manager edits their own membership. Taxonomy
authority alone does not permit assigning tags, which can affect invitations.

`activeBandMembershipWhere()` centralizes active-membership/person checks for
the descriptor, assignment descriptors, and mutation target loading. A deleted
membership or deleted/merged shared person cannot be edited or returned through
these views. Shared people are not given a band ownership column.

`BandUser_Tags` derives its typed DTO from an explicit membership selection.
It returns the person's public identity/name and public assignment/tag identities;
it does not return another catalog copy. Owners can read their own assignments
with `login`, including roleless active members. Other-membership reads require
`view_users_basic_info`. `BandUserTagAssignment` inherits band and person
ownership through its membership using the shared DB3 parent-scope mechanism.

`BandUser_SetTags` accepts an explicit membership public ID and a unique tag list
of at most 64 public IDs. Numeric identities and undeclared ownership fields are
rejected. The shared command endpoint supplies Serializable execution and fresh
authorization. The command requires the manager capability, loads the active
membership in that band, and composes shared association authorization,
persistence, and auditing.

Instrument and tag commands share `requireEditableBandMembership()` and
`resolveMemberAssignmentTargets()`. New references must resolve through the
visible catalog in the same band. Existing hidden assignments may be retained
or removed; unrelated edits do not silently delete them. Stored cross-band links
are excluded from reads and reject writes. Unchanged lists preserve association
identities and add no audits. List changes and their audits share one transaction
and operation context. There is no standalone assignment CRUD view.

## Dashboard and controls

The dashboard loads member tags with instruments, functional groups, and song
tags in the existing coherent catalog snapshot. Full ordered locale preferences
are preserved. Hidden tag delivery is governed by fresh taxonomy grants,
independently of instrument/song administration. Platform requests return empty
band catalog collections.

`BandUserTag_Dashboard` uses the catalog's derived display contract and is
registered in the shared dashboard reference store. Band/language refreshes
replace its references. Existing tag label consumers use those resolved names;
the event selector resolves its display reference by the stored public identity.
This does not finish the event's membership/attendance query and write migration.

`/backstage/editUserTags` retains its URL and read-only localized Markdown, but
now uses the native DB3 catalog grid with registered localized captions and
inherited/localized editors. Its route capability is `manage_user_taxonomy`.
The new `/backstage/userTags` management page uses `manage_users` and the same
native selection picker as instruments.

Both assignment editors share `useMemberAssignmentSave()`: failed writes retain
the draft/dialog, pending writes prevent duplicate submission, successful edits
refresh membership and dashboard data, and a committed write followed by a
failed refresh reports that reloading is needed. A band/context change discards
the previous editor state. Hidden catalog entries are unavailable as new choices
but existing assignments remain visible as unavailable placeholders.

A trivial instrument-picker visibility gap was also corrected: taxonomy/admin
dashboard entries can include hidden instruments or hidden functional groups.
The assignment picker now excludes both from new choices, matching the command's
visible-reference policy.

## Validation and remaining work

Focused regression coverage includes the existing 32-file instrument/catalog/
localization/settings suite and three new files:

- `tests/bandUserTags.test.ts`: public transport, duplicate/ownership rejection,
  explicit empty replacement, and command registration.
- `tests/bandUserTags.mysql.test.ts`: inheritance and blank style overrides,
  preserved significance, resolved search/order/count/page behavior, dashboard
  references, two-band assignments, hidden retention, manager/taxonomy/owner
  boundaries, fresh grants, inactive/merged people, audits and rollback.
- `tests/bandUserTagsEditor.test.tsx`: native picker interactions, localized
  dashboard labels, manager-only controls, hidden retention, failed-save drafts,
  pending-save protection, refresh failure, and band-switch state replacement.

The focused regression run passes **332 tests across 35 files**, including
**35 native database tests across seven files**. ESLint on all changed/new code
and `git diff --check` pass. Nonincremental TypeScript reports **665 diagnostics**,
versus **668** at starting commit `3e4e9f93`, with no added file/error-code groups.
Remaining errors belong to unfinished migration consumers. The complete suite,
build, and interactive application acceptance were not run for this bounded
slice and remain phase 4 work.

Native validation uses a private MariaDB 10.11.9 server and disposable
target-schema database; no existing application database is changed. The
disposable database is dropped and its server stopped after validation.

Continue with member profile/search and role consumers, respecting the shared
person versus band membership boundary. Then migrate event/default-instrument,
invitation/tag-search and merge consumers, remaining catalogs/global
administration, band content, and registered settings editors. Legacy
person-level assignment DTOs/descriptors still used by those consumers remain
rejected in selected-band operations. Phase 3 and milestone A remain incomplete.
