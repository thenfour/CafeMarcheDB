# Authorization contracts

Request authorization is independent of presentation language and hosting mode.
Delivery status and remaining consumer adaptation belong to the
[implementation plan](04-implementation-plan.md).

## Trusted context

`src/auth/server/serverAuthorization.ts` loads fresh account state and returns
`CMServerAuthorization`: effective permissions, separately attributed global/band
grants, the resolved band, and active membership. Shared session PublicData holds
person/session state and band-independent display grants. Selected band,
membership, locale, and membership-derived grants stay in the request/tab context.

`loadAuthorization(session, bandPublicId?)` always loads global/account grants.
An explicit public ID additionally resolves an active band and membership.
Omission/null produces platform/account context without querying bands; a
supplied missing/deleted band fails. Single-band hosting uses the same contract.
There is no environment-selected or hard-coded backend band.

The request's session context caches snapshots by band public ID/null and session
identity. A → B → A keeps independent snapshots without mutating session selection.
`refresh(database?)` reloads the same band/person/grants, optionally inside a
transaction. `loadAuthorizationForUser` trusts only the supplied person ID and
rereads account/role state. Session creation likewise publishes only shared grants.

`toClientContext()` exposes public person/band/membership identities and effective
permission names. Internal IDs and the server authorization object remain on the
server. Presentation delivery separately supplies
[locale preferences and formatting](06-localization-settings.md).

Shared session permissions include the account baseline, global-role non-band
grants, and applicable shared public/account grants. Even account capabilities
originating only in a selected membership role remain tab-local. A request in
another band cannot overwrite those grants. Retired cookie fields are ignored
while unrelated session metadata is preserved.

`cmauthorize` accepts an optional band public ID. Band consumers constrain queries
to its resolved identity, call `requireBandResource` for loaded ownership, and
`requireMembership` for member-only operations. A capability alone does not prove
resource ownership. Legacy synchronous `resolver.authorize` rejects band
capabilities, including ones present in older cookies.

## Effective grants

- Active people receive active stored `login` and `visibility_logged_in_users`
  independently of membership. Signup creates no membership or global elevation.
- Public-role band grants apply only with a resolved band. Account grants require
  an active person.
- Only the active selected membership supplies its band role. Null uses the
  designated new-member role. Absent/inactive memberships and outsiders do not
  receive that default.
- Active global-role grants apply independently of membership. `isSysAdmin`
  additionally inherits the designated active global Sysadmin role's actual
  grants; it is not a bypass. Missing/ambiguous designation fails for flagged people.
- Registry scope is authoritative. Band roles cannot confer platform capabilities.
  Band capabilities from global roles also require a selected band.
- Deleted definitions, unknown permission names, and `never_grant` do not
  authorize. Unknown names are logged. Ambiguous active public/new-member role
  designations fail instead of combining grants.
- Deleted/merged people lose account access and their sessions are revoked.
  Membership deactivation removes that band's member grants while retaining
  global account access, other memberships, and applicable public access.

## Capability boundaries

Both role-definition tables and their matrices are platform-owned. Band-role
assignment is a membership operation; `BandRole` itself has no band owner.

| Operation | Required authority |
| --- | --- |
| Own shared display profile/preferences | Active account; sensitive sign-in operations keep their dedicated gates. |
| Another person's shared profile, global role, account lifecycle | `manage_global_users`; merge also requires `merge_users`. Credentials/impersonation retain protected gates. |
| Membership instruments/tags/profile management | Their declared owner/`manage_users` policy; taxonomy editing separately uses `manage_user_taxonomy`. |
| Membership role assignment/deactivation/reactivation | `assign_user_roles` / `deactivate_users` / `recover_users`, plus delegation and continuity policy. |
| Role definitions/designations/matrices | Platform `sysadmin`. |
| Global catalogs/behavior definitions | `manage_global_catalogs`. |
| Band catalog opt-ins/customization | Selected-band domain administration capability. |
| Settings/localization | Global or band capability and any per-key override. |
| Band lifecycle | Platform `manage_bands`; membership operations also require their band capabilities. |
| Band content, RPC/API, files, feeds, jobs | Applicable domain capability and verified ownership in trusted context. |

See [band memberships](08-band-memberships.md) for command-specific delegation,
continuity, self-service, and projection rules. Band grants cannot modify shared
accounts or global definitions.

## Permission migration and initialization

The follow-up migration
[20261005120000_696_authorization_foundation](../../db/migrations/20261005120000_696_authorization_foundation/migration.sql)
adds these capabilities without rewriting the preceding migration's original
matrices:

| Added capabilities | Initial grant |
| --- | --- |
| `manage_band_settings`, `manage_band_localization` | Global Sysadmin and active band roles already granted `manage_site_branding`. |
| `manage_bands`, `manage_global_catalogs`, `manage_global_settings`, `manage_global_localization`, `manage_global_users` | Global Sysadmin. |

Platform capabilities are protected/nondelegable; the two band capabilities are
delegable. Existing grants are selected by technical capability, never translated
role name. Fresh defaults grant both band capabilities to Band Admin and all seven
to the designated global Admin. Descriptions are global dynamic Markdown strings;
SQL corrects eight existing descriptions while preserving identity/non-English
values. Startup preserves subsequent wording edits. Apply SQL through the
[runbook](03-sql-migration.md).

`src/setup/accessControl.ts`, shared by instrumentation and seeds, runs Serializable
initialization: ensure the three locale identities/English names, synchronize
known permission metadata and missing descriptions, seed one global/six band roles
only when both role tables are empty, and require exactly one active global
Sysadmin designation with active `login`/`sysadmin` definitions and required grants.

Repeated initialization retains existing matrices and wording. It does not revive
deleted definitions, create memberships, or run random demo generators. Signup
creates only a shared account; bootstrap uses the existing one-time secret,
transaction, and audit protocol to assign global authority without changing
memberships. UID/public-ID/wiki/setlist/chrome backfills belong to SQL rather than
startup code.
