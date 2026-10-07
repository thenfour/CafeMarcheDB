# Localization and multiband design

The migration introduces shared accounts, band-owned content, localized UI and
catalog text, and scoped settings. Restore a buildable, runnable application and
its everyday workflows first. Complete broader administration and localization
tooling after restoration.

## Reading guide

| Document | Purpose |
| --- | --- |
| [Implementation plan](04-implementation-plan.md) | Restoration gates, next work, deferred scope, and acceptance. |
| [Schema](01-schema.md) | Target ownership, relationships, and server invariants. |
| [Data migration](02-data-migration.md) | Source-to-target mappings and preservation requirements. |
| [SQL runbook](03-sql-migration.md) | Executable migration, settings manifest, deployment, and recovery. |
| [Authorization](05-authorization-foundation.md) | Trusted context, grants, and startup policy. |
| [Localization and settings](06-localization-settings.md) | Resolution, formatting, delivery, refresh, and settings APIs. |
| [DB3 contracts](07-db3-contracts.md) | Shared query, field, write, and reference architecture. |
| [Band memberships](08-band-memberships.md) | Member reads, assignments, profile edits, and membership status. |

These documents describe settled contracts and remaining work. The actual
[Prisma schema](../../db/schema.prisma) defines database constraints; the SQL
runbook defines migration behavior. The implementation plan owns delivery status
and temporary restrictions. Superseded proposals and journals remain in Git history.

## Ownership and roles

Use **band** in domain names and user-facing language. A `User` is a shared
person/account; a `BandUser` is that person's membership in one band. Instruments,
tags, roles, and preferences attached to a membership can differ across bands.
Authorship and song credits continue to identify the shared person.

Ordinary content belongs to a band. Authorization uses an explicit,
server-validated band selection and verifies the loaded resource's ownership.
Single-band and multiband hosting share the backend, database, and authorization
policy. Hosting conveniences never supply an implicit backend default band.

Global roles and band-role definitions/permission matrices are platform-owned.
A band assigns an existing band role to a membership. Band administration does
not confer authority over shared accounts, global catalogs, or role definitions.
Signup creates a shared account without a membership or platform elevation.

## Catalog ownership and customization

Platform-owned catalogs supply reusable vocabulary. Bands explicitly opt into
items through band-owned wrappers, or create custom items with no global source.
An opted-in item can inherit metadata, override fields, or be hidden without
destroying existing associations. Global catalog membership alone does not make
an item selectable in every band.

An instrument always references a band functional group. Opting into a global
instrument ensures its global group has a corresponding band opt-in. Custom
instruments require a band group; a future onboarding wizard may simplify this
workflow without changing the ownership contract.

Behavior-driving definitions remain platform-owned: event types, statuses,
attendance options, and song-credit types. Global file-tag significance retains
Partition/Recording behavior. Invitation behavior continues through effective
user-tag significance and `Event.expectedAttendanceUserTagId`. Bands customize
presentation without redefining those behaviors.

## Localization boundaries

Static UI text uses typed registry keys. Entity-owned labels and descriptions use
dynamic string identities. Central resolution, matching, and editing facilities
serve every domain; catalogs do not implement their own fallback rules. Registry
keys describe UI concepts and never embed entity IDs.

Song titles/aliases, authored descriptions, and wiki content remain multilingual
authored text. The migration does not split that content into translation columns.
Short searchable plain text and long text/Markdown use different value columns,
with exactly one column populated per stored value. Empty text is intentional.

A band override takes precedence for the whole string, before language selection.
Once present, it prevents fallback to a different global meaning. Resolution uses
the route preference, ordered browser preferences, English, and deterministic
remaining candidates. String language and date/number formatting locale are
independent. The exact algorithm is in
[localization and settings](06-localization-settings.md#string-resolution-and-formatting).

Plain text supports ICU parameters; Markdown does not interpolate. Static strings
arrive as a complete authorized catalog for synchronous client reads. Dynamic
strings are batch-resolved with authorized entity reads. Optimize delivery or
query execution only when measurements justify it.

## Settings

Global, band, user, and membership settings are four independent hives, with no
inheritance hierarchy. Registries own types, defaults, per-key read/write gates,
and reset behavior. Values are native JSON; a JSON string remains a string.
Hosting mode is deployment configuration rather than a database setting.

## Eventual routing and management

Standalone hosting retains the intended root or `/backstage` shape. Platform
portals use `/[locale]/b/<publicBandId>/...`, with the locale optional. URLs without
a locale work directly, use browser preferences, and are preferred for sharing;
they do not redirect to a selected language. A language switch links to the
equivalent page. Rewrites adapt existing page implementations.

The server validates host, band, and locale. Middleware hints do not authorize
requests. Full routing work replaces Next's static i18n assumptions and carries
the same context through SSR, RPC, files, feeds, notifications, and exported links.
Band-owned Custom Links resolve under the band's portal root and do not implement
locale-dependent redirects. Public band IDs remain identity; mutable band names
are not routing identity.

Band creation, switching, invitations, decommissioning, platform administration,
and full translation editing belong after restoration. Cross-band account merge
also remains shared-account work. Ensemble templates, onboarding wizards,
marketing, pricing, and other product additions are separate optional work.
