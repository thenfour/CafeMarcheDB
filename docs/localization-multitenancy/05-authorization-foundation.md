# Authorization foundation: phase 1

Implemented 2026-10-05. This completes the context, authorization, and bootstrap
foundation in [04-implementation-plan.md](04-implementation-plan.md). It does
not establish application readiness: domain descriptors, queries, mutations,
and UI consumers still need phases 3–4.

Phase 2 is now implemented. Its preserved preference lists, per-string resolution,
`formattingLocale`, and four-hive settings transport replace the provisional
dashboard locale contract described below. See
[06-localization-settings.md](06-localization-settings.md) for the current APIs.
The scalar `resolveRequestLocale` module is no longer used by application delivery.

## Trusted context

`src/auth/server/serverAuthorization.ts` loads the person from the database and
returns `CMServerAuthorization` with the effective permissions, separately
attributed global and band permissions, resolved band, and active membership.
Presentation locale is resolved separately. Shared session PublicData contains
person/session-wide state and band-independent display grants. It contains no selected band, membership,
presentation locale, or band grants. Server band operations use the resolved
request context, never session display grants.

`loadAuthorization(session, bandPublicId?)` always loads global/account grants.
With a band public ID it also resolves the active band and the person's active
membership, adding the applicable band grants. An omitted or null ID produces
global/account authorization without querying bands. A supplied missing/deleted
band fails. There is no auth scope selector, environment-selected band, or
hard-coded database identity.

Single-band and multiband hosting use this same backend contract. Portal or
request boundaries supply the nominal band's public ID when a band operation is
requested; hosting mode affects UX, not authorization or database behavior.

`src/locale/server/requestLocale.ts` provides provisional single-locale selection.
`resolveRequestLocale(database, bandId, requested?)` accepts a trusted resolved
band ID, or `null` for platform presentation. It considers the band's enabled
active locales, or all active platform locales, ordered by `Locale.sortOrder`
then identity; it does not use `BandLocale.sortOrder`. Matching chooses an
exact locale, then a matching language, then `en-US`, then the first candidate.
Malformed hints and missing active candidates fail presentation resolution.
Authorization does not query locales and remains usable when locale data is
missing or its query fails. Translation fallback and catalog delivery remain
unimplemented. This scalar selection is not the foundation for string lookup:
phase 2 preserves route/browser preferences, resolves each string with the design's
scope-first policy, and selects a separate `formattingLocale`. See the
[localization contracts](04-implementation-plan.md#localization-contracts).

`loadAuthorization(session, bandPublicId?)` caches a database snapshot within that
request's session context, separately for each band public ID (or null) and session identity.
Switching A → B → A preserves the independent snapshots and does not write a
selected band/locale into the shared session. `refresh(database?)` reloads person,
grants, and membership for the same band, or stays global, optionally inside the mutation
transaction. Non-session callers use `loadAuthorizationForUser`; only the supplied
person ID is trusted, and account/role state is read afresh. Session creation
rereads the person and publishes only band-independent grants, without resolving
a band or presentation locale.

`CMServerAuthorization.toClientContext()` returns public person, band and
membership identities and effective permission names. It has no locale field.
`getDashboardData` composes this as `DashboardDataDto.authorization` alongside
the separately resolved `DashboardDataDto.locale`. The React provider exposes
them as `DashboardContext.authorizationContext` and `DashboardContext.locale`.
The dashboard currently supplies no requested-locale hint to the resolver, and
date presentation still uses the raw browser `userLocale`. These fields are
provisional; explicit route/browser negotiation and formatting adoption are
phase 2/5 work, not completed phase-1 behavior.
Each tab receives its own response and uses that response's grants for client
hints. Numeric database identities and the
server authorization object do not cross this boundary. Explicit band identity
must be wired through remaining domain and portal entry points in phases 3–5;
calls without it load global/account data. The legacy dashboard catalogs and
domain descriptors still need phases 3–4 for a working app.

The shared session's `permissionNames` contains non-band grants from global roles,
the account baseline, and public/account grants from the shared public-role
definition. Even public/account grants originating only in a selected membership
role remain in that tab's context. A request in another band therefore cannot
overwrite a tab's context or populate the shared session with its role grants.
Retired fields in an intermediate session cookie are ignored; unrelated session
metadata is preserved.

`cmauthorize` accepts an optional `bandPublicId`. Domain adapters must use the resolved
band when querying and writing, call `requireBandResource` for loaded ownership,
and use `requireMembership` for member-only operations. Possessing a capability
alone does not prove a supplied entity belongs to the selected band. Central
DB3 filtering and same-band reference validation remain phase 3 work.

Legacy synchronous `resolver.authorize` reads only shared session grants. It
rejects band capabilities, including when an older session cookie contains them.
Remaining band guards must switch to `cmauthorize`/request authorization in
phases 3–4. This restriction keeps those consumers from trusting another tab's
stale band grants during recovery.

## Grant and account rules

- Active people receive active stored `login` and `visibility_logged_in_users`
  capabilities independently of membership. Signup creates neither membership
  nor global role elevation.
- Public-role grants provide the existing public baseline. Band-scoped public
  grants apply only with a resolved band. Account grants require an active person.
- Only the active selected band's membership supplies its assigned BandRole.
  An active membership with no role uses the designated new-member role. An
  outsider, absent membership, or inactive membership does not receive that role.
- Active assigned GlobalRole grants apply independently of membership.
  `isSysAdmin` additionally inherits the active designated global Sysadmin role's
  actual grants. The flag is not a permission bypass, and missing/ambiguous
  Sysadmin designation fails for flagged people.
- Registry scope is authoritative. BandRole grants cannot supply platform
  capabilities, even if such grants are accidentally persisted. Band grants from
  global roles require a resolved band; they disappear in platform context.
- Deleted roles/permissions, unknown technical permission names, and
  `never_grant` never authorize. Unknown names are logged. Ambiguous active public
  or new-member role designations fail rather than combining them.
- Deleted or merged people lose account access and their session is revoked.
  Deleting a membership removes that band's member grants while keeping the
  global account and other memberships usable. Public access remains available.

Role definitions and both grant matrices remain platform-owned. BandRole has no
band ownership field; memberships choose from those shared definitions.

## Operation and scope inventory

This table distinguishes the foundation that is implemented from consumers that
still need adaptation. Band operations require a supplied band public ID at
their request boundary; global/account operations omit it.

| Operation family / current entry points | Scope and capability | Current implementation / remaining adaptation |
| --- | --- | --- |
| Signup and bootstrap (`signup`, `createSignupUser`, `claimAdminBootstrap`, `getAdminBootstrapStatus`) | Shared person / platform; bootstrap requires active account and the existing secret protocol. | Signup creates a global account without a membership. Bootstrap selects GlobalRole, retains one-time claim/transaction/audit behavior, and leaves memberships untouched. |
| Login, password reset, OAuth, impersonation start/stop | Shared identity; session creation is independent of band/locale selection. | Sessions publish only shared grants from fresh account state. Page/API boundaries supply a band public ID when applicable. Deleted/merged sign-in targets are excluded. Existing dedicated sensitive-operation gates remain. |
| Self-service profile and user preferences | Shared person / account. | Account `login` remains independent of band membership. Settings APIs and descriptor adaptation follow in phases 2–4. |
| Shared person edits and global-role/account changes (`assignUserRole`, `deactivateUser`, `reactivateUser`, merge, User fields) | Platform: `manage_global_users`; merge also retains `merge_users`. Sensitive credentials/impersonation retain their existing protected gates. | Policy and non-owner User field writes now require platform grants. The old role delegates, aggregate merge relations, descriptors, and UI still require phases 3–4. Band permissions must not modify the shared account. |
| Band membership role assignment, offboarding/recovery, tags, instruments, member presentation | Band: existing `assign_user_roles`, `deactivate_users`, `recover_users`, `manage_users`, `manage_user_taxonomy`. | Separate membership instrument/tag commands and role assignment with delegation/continuity checks are implemented; see [membership roles](10-band-user-roles.md). Profile/search and membership offboarding/recovery remain phases 3–4. |
| GlobalRole/BandRole definitions and matrices (`getAllRoles`, `setRoleDesignation`, role descriptors) | Platform: existing `sysadmin`. | Global scope is available; the role-list entry point uses it. Replacing legacy Role/RolePermission descriptors and designation mutations remains phase 3. |
| Shared catalogs and behavior definitions | Platform: `manage_global_catalogs`. | Capability added. Global/band catalog descriptors and writers follow in phase 3, beginning with instruments. Old `admin_*` band grants must not authorize global catalog writes. |
| Band catalog opt-ins, custom items and overrides | Band: existing domain `admin_*` capabilities. | Capability meanings clarified. Ownership, inheritance, localized fields, and writers follow in phase 3. |
| Global/band settings and localization | Platform: `manage_global_settings` / `manage_global_localization`; band: `manage_band_settings` / `manage_band_localization`. | Capabilities and grants added. Phase 2 supplies typed APIs and per-key authorization; phase 6 supplies full editing. |
| Band lifecycle and administration | Platform: `manage_bands`; membership operations also use their band capabilities. | Platform capability added. Lifecycle policies, commands, and portal surfaces follow in phase 5. |
| Events, songs, files, wiki, menus, links, plans, search and reports | Resolved band, using existing domain capabilities and loaded ownership. | Authorization accepts a band public ID. DB3/domain ownership constraints and removed field/delegate adaptations remain phases 3–4. |
| API/RPC, page guards, upload/download, feeds, telemetry and jobs | Supply a band public ID when needed; non-session identity refreshed from the database. | Calls without an ID load global/account authorization. Explicit portal selection, feed/file ownership and all remaining consumer boundaries must be audited during phases 3–5. |

## Added permissions and SQL

The follow-up migration is
`db/migrations/20261005120000_696_authorization_foundation/migration.sql`.
The completed data migration and its original grant matrices are unchanged.

| Added key | Scope | Initial grant |
| --- | --- | --- |
| `manage_band_settings` | Band | Global Sysadmin and active band roles already granted `manage_site_branding`. |
| `manage_band_localization` | Band | Same as band settings. |
| `manage_bands` | Platform | Global Sysadmin. |
| `manage_global_catalogs` | Platform | Global Sysadmin. |
| `manage_global_settings` | Platform | Global Sysadmin. |
| `manage_global_localization` | Platform | Global Sysadmin. |
| `manage_global_users` | Platform | Global Sysadmin. |

Platform capabilities are protected and nondelegable. The two band capabilities
are delegable. Initial band grants are selected by the existing branding grant,
not a localized role name. Fresh defaults add them to Band Admin and all seven
to the designated global Admin. No other existing grants are rewritten.

Descriptions are global dynamic Markdown strings with English values. The SQL
also clarifies eight existing band-capability descriptions while preserving
string identity and non-English values. Startup preserves subsequent edits.
The preflight requires active English and rejects duplicate active Sysadmin
designations before permanent writes. An empty role database can receive the
permissions before fresh-install initialization supplies its default roles.

Apply this SQL after the localization migration through normal Prisma migration
deployment. The rehearsal used `prisma db execute` on private main-schema fixtures
without migration history; that command does not record migration history.
Do not deploy the intermediate application before milestone A.

## Startup and fresh installations

`src/setup/accessControl.ts` is shared by instrumentation and `db/seeds.ts`.
Inside a serializable transaction it:

1. Ensures the three locale identities and their English names.
2. Synchronizes known permission metadata and creates missing localized descriptions.
3. Seeds one global role and six band roles with the default matrices only when
   both role tables are empty. Existing matrices are retained on subsequent runs.
4. Requires exactly one active global Sysadmin designation, with active `login`
   and `sysadmin` definitions, and adds those required grants if absent.

Existing locale/permission wording, deleted/unknown permission history, and role
matrices survive repeated initialization. Initialization does not revive deleted
definitions or create band memberships. A fresh install receives access-control
foundations; catalog/demo seed adaptation and a usable no-membership account flow
remain part of application recovery/lifecycle work.

The previous random demo seed was replaced because it writes the removed model.
The old demo modules remain for domain adaptation. Startup no longer regenerates
migrated chrome or performs UID/public-ID/wiki/setlist data backfills. Those
repairs belong to the reviewed SQL migration. The obsolete
`tests/setlistPlanPublicIdMigration.test.ts` was removed with its startup helpers;
SQL rehearsal remains the evidence for the migrated serialized references.

## Validation and limits

- Target Prisma client generated successfully.
- `yarn prisma db seed` succeeded on an isolated MariaDB 10.11.9 target-schema
  database. Focused checks cover repeat initialization, real relations and FK
  behavior, edited English descriptions, and retained matrices/history.

```powershell
yarn test tests/requestLocale.test.ts tests/authorization/multibandAuthorization.test.ts tests/authorization/multibandDatabase.test.ts tests/authorization/permissionRegistry.test.ts tests/authorization/permissionSet.test.ts --reporter=dot
```

- All 61 focused checks passed after the locale/authorization separation,
  including 3 real-database checks. Native database tests require
  `CMDB_PHASE1_TEST_DATABASE_URL` pointing to a private loopback database on port
  32693/32694 with name starting `lsmb_phase1_`; otherwise those three skip.
- Regression checks use distinct request contexts with a shared session handle
  and cookie state. Concurrent requests retain separate bands, locales, membership
  IDs, and client permissions without shared-session writes. Offboarding one band
  preserves the other tab's snapshot and shared account grants. Additional checks
  cover member-role grant provenance, session creation without a band/locale,
  rejection of cookie-based band guards, authorization without locale data,
  independent locale matching, and reuse of authorization across language changes.
  The native relation fixture also checks enabled-locale filtering and authorization
  refresh after removing a band's enabled locales.
  This is server/transport coverage, not a browser/portal acceptance rehearsal.
- Populated main-schema fixture → localization SQL → follow-up SQL passed on
  MariaDB 10.11.9: all original grant rows/IDs retained; seven global and two band
  grants added; new descriptions have Markdown/en-US storage; other-language
  descriptions retained. Empty-role, repeat-run, duplicate-Sysadmin and missing
  active-English fixtures also passed their expected outcomes.
- Changed TypeScript files pass ESLint. Repository typecheck still fails in
  legacy descriptors, domain consumers, merge operations, and older test fixtures.
  The new context/grant/bootstrap/initializer modules and focused tests have no
  diagnostics in that run. Build and full-suite acceptance remain phase 4.

No production or existing development database was changed. This follow-up SQL
was not rehearsed against the production dump or MySQL in this phase; the broader
original data-migration evidence remains in [03-sql-migration.md](03-sql-migration.md).

## Next step

Phase 2 is implemented; see [06-localization-settings.md](06-localization-settings.md).
Proceed to phase 3's band-instrument vertical slice using trusted authorization,
the shared resolver and settings APIs, before expanding domain writers and views.
