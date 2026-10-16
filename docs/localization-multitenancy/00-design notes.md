# Localization and multiband design

Restore **pre-migration functionality and UX on the migrated schema**. Complete
broader localization and multiband tooling after the everyday workflows work.

## Baselines and restoration target

| Purpose | Fixed commit |
| --- | --- |
| Production migration source | `094a783a94b95ed4ec15089e9372763b7d59f66c` |
| Functional and UX parity reference | `f027830a9790ab2bf015805ef765775a9e40de55` (`f027830a9790`) |

Production upgrades support the production commit's data, migration history and
uploads, including the required intervening migrations. Intermediate development
schemas do not add compatibility requirements. The parity reference includes
later work and is not another production database input.

For `CMDB_HOSTING_MODE=CafeMarche`, preserve familiar screens, defaults,
interactions, navigation, supported URLs, filters, exports and detail tabs.
Adapt existing components and query pipelines to the target schema. A smaller
replacement or a redesigned search does not establish parity. Preserve safe
later fixes without restoring obsolete models or weakening authorization.

Resolve migrated catalog labels for display. A1 may defer only free-text matching
against newly localized catalog names; the [plan](04-implementation-plan.md#localized-catalog-text-search-exception)
defines the boundary. Full localization of existing site chrome is not required.
Later `MIGRATION_RESTORE` snapshots are adaptation material, not a new parity
baseline; temporary notices and basic recovery screens are checkpoints.

## Documentation map

| Read | For |
| --- | --- |
| [Implementation plan](04-implementation-plan.md) | Current gates, next slice and acceptance. |
| [SQL runbook](03-sql-migration.md) | Data preservation, migration execution and recovery. |
| [Authorization and memberships](05-authorization-foundation.md) | Trusted context, grants, member reads and commands. |
| [Localization and settings](06-localization-settings.md) | Resolution, formatting, delivery and settings policy. |
| [DB3 contracts](07-db3-contracts.md) | Shared fields, queries, writes and references. |
| [Feature preservation](13-feature-preservation.md) | Source preservation and completion procedure. |

The [Prisma schema](../../db/schema.prisma) and implementation define structural
and API details. [feature-restoration.json](feature-restoration.json) owns the
feature inventory. Keep current delivery status in the plan, not in duplicate
registers or dated journals. Superseded detail remains in Git history.

## Ownership

Use **band** in domain and UI language. `User` is a shared person/account;
`BandUser` is a unique membership in one band. Roles, instruments, tags, responses
and preferences attached to a membership can differ across bands. Authors,
uploaders, locks and song credits identify the shared person. Account deletion or
merge and membership deactivation are separate operations. Signup creates an
account without membership or platform elevation.

Songs, events, files, wiki pages, Custom Links, menus, setlist plans/groups and
band catalogs have direct band ownership. Segments, song lists, revisions,
dividers, visits and gallery items inherit ownership through their parent.
Queries constrain ownership; mutations check targets and references together in
the authorized transaction. Foreign keys alone do not prove same-band validity.
This includes invitation tags, response instruments, pinned/preview/parent files,
plan groups, serialized plan references and menu wiki slugs. A wiki current
revision must belong to that page.

Keep optional `SetNull` relations without clearing required ownership. Removing
an author must not delete band plans or credits. Hard band deletion is restricted
until content is explicitly removed. Wiki and Custom Link slugs are band-unique.
Action band/locale context may be null for platform or unknown historical actions;
references on a band action must belong to that band.

Existing hosting exception: Frontpage Gallery is specific to Café Marché's
single-band hosting mode and does not require band context.

Role definitions and permission matrices are platform-owned; `BandRole` has no
band owner. Bands assign existing roles to memberships. Band administration does
not grant authority over shared accounts, global catalogs or role definitions.

## Catalogs, text and settings

Bands explicitly opt into global catalog items through wrappers or create custom
items. A wrapper may inherit metadata, override individual fields or hide the
item while retaining associations. A global item alone is not selectable in a
band. An instrument always has a band functional group: global instrument opt-in
also ensures group opt-in; custom creation supplies a group.

Event types, statuses, attendance options and credit types remain global behavior
definitions. Global File-tag significance retains Partition/Recording behavior.
Invitation behavior uses effective user-tag significance and
`Event.expectedAttendanceUserTagId`; ordinary catalog edits do not change it.

Static UI text uses typed registry keys; entity labels/descriptions use dynamic
string identities. Shared resolution serves every domain. Null metadata inherits;
empty text, `false` and zero are explicit values. Each localized field resolves
independently. Plain text may use ICU parameters; Markdown does not interpolate.
Song titles/aliases, descriptions and wiki revisions remain authored multilingual
content. Referenced string deletion is restricted; removing an override is explicit.

Global, band, user and membership settings are independent native-JSON hives.
Registries own validation, defaults and per-key authority. Hosting mode is
deployment configuration. Exact resolution and settings rules live in the
[localization contract](06-localization-settings.md).

## Routing and later scope

Incoming URLs have an optional locale, an optional band prefix, and the remaining
pathname. Middleware parses these two route-level parameters and serializes the
result in the reserved `x-cmdb-portal-path` rewrite query parameter. Server and
client page adapters deserialize that context instead of reparsing an internal
pathname. Next owns page matching; the route registry owns semantic page keys,
Next patterns, and one permission per page.

Multi-band hosting uses `/[locale]/b/<Band.publicId>/...`. Single-band hosting uses
`/[locale]/b/...`: the server requires exactly one Band in the database and uses
its public ID. There is no environment setting for that ID. An absent `/b`
prefix always means no route-level band, including on a single-band instance.
There is no special `/platform` prefix or query-string alternative for selecting
the route-level band or locale.

`externalPathname` is the incoming pathname; `internalPathname` is the remainder
after removing prefixes. Query parameters and browser fragments are separate
URL state. Explicit account/platform pages retain their own page identities.
Pages validate their required parameters and authorization remains responsible
for current band availability, membership, and grants.

`CMDB_BASE_URL` supplies the public origin for absolute links. Hosting mode is
explicitly configured as `Platform`, `CafeMarche`, or `GenericSingleTenant`.
Request hosts do not choose a tenant. Local authentication return paths must
remain on the configured origin.

The shared router constructs hrefs from internal destinations and route
parameters. Client navigation receives the completed href unchanged. Omitted
overrides inherit current parameters; null explicitly clears a parameter.
Language switching and same-page slug/tab updates preserve query parameters
and fragments. Internal rewrite metadata is excluded from application input
and external custom-link forwarding. Routing configuration is available from
page bootstrap without loading dashboard data; diagnostics remain restricted
to Sysadmins. Bootstrap failures render an explicit error shell.

Full portal routing, band lifecycle/onboarding, platform administration, cross-band
account merge and translation tools follow core restoration. New product features
and optional UX refinements need separate scope.
