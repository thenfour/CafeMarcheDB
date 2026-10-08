# Target schema

[db/schema.prisma](../../db/schema.prisma) is the database authority. This guide
explains ownership boundaries and the invariants server code must add. Use the
[migration mappings](02-data-migration.md) for preservation requirements and the
[SQL runbook](03-sql-migration.md) for execution. Never use `prisma db push` to
migrate existing application data. Application, generated client, and migrated
database must switch together at production cutover.

## People, memberships, and roles

-  `User` is a global person. `BandUser` is unique by `(bandId, userId)` and can
   be deactivated/reactivated without losing identity or contributions. Account
   deletion/merge and membership deactivation are distinct states.
-  `User.globalRoleId` and `BandUser.bandRoleId` are separate nullable assignments.
   Both role-definition tables and their matrices are platform-owned; `BandRole`
   has no `bandId`.
-  Instruments, user tags, event responses, and file-user associations reference
   the membership. Authors, uploaders, locks, and song credits reference the person.
   Event/segment responses must match their membership's band.

## Content ownership and references

Songs, events, files, wiki pages, custom links, menu links, setlist plans/groups,
and band catalog entries have required band ownership. Event segments and song
lists inherit ownership from their event. Revisions, dividers, visits, and gallery
items inherit through their page, list, link, or file.

Foreign keys establish the relationships declared in the schema, rather than
every same-band invariant. Reads constrain ownership; mutations verify both the
target and referenced rows in their authorized transaction. This includes
associations, instrument/group links, invitation tags, pinned recordings,
preview/parent files, response instruments, Custom Link files, and setlist groups.
A wiki current revision must belong to that page. Serialized setlist references
and menu `wikiSlug` resolution need the same band checks.

Optional relations using `SetNull` retain that policy. Adding a required ownership
key to such a foreign key could attempt to clear ownership too; server checks
cover these relations. Hard band deletion is restricted until its content is
explicitly removed. Removing an author clears the relevant plan or credit
reference rather than deleting band content.

Wiki and Custom Link slugs are unique within a band. Action band/locale context
is nullable: platform actions need no band, and historical actions may lack a
resolved locale. References attached to a band action must belong to that band.

## Exceptions for exsiting tenants

-  Frontpage Gallery features are specific to Café Marché, who will run in a single-band
   hosting mode. Band context is not required therefore; single-band assumed.

## Catalogs and localized fields

Band catalog wrappers are unique by `(bandId, nullable globalItemId)`: one opt-in
per global item, with multiple custom items allowed. `isHidden` removes an item
from ordinary selection while retaining associations. Nullable metadata inherits
from the global source. Custom items require their own name identity.

`BandInstrument` always references a `BandInstrumentFunctionalGroup`. Both can
opt into global definitions or be custom. Instrument opt-in composes the group
opt-in; custom creation supplies a group explicitly.

Global and band fields use `DynamicLocalizedString` identities, whose format is
`PlainText` or `Markdown`. Global and band values reference a string and locale;
band values additionally belong to a band. A field may inherit its source
identity or reference its own identity. Custom band strings have no global values.
Name, description, and attendance-caption fields resolve independently. Referenced
string deletion is restricted; override removal is explicit.

Static strings use registry keys and separate global/band value tables. Each
value row populates exactly one of `indexedValue` and `blobValue`; writers enforce
this and distinguish empty text from absence. Indexed values have actual indexes;
long values use `MediumText`. Resolution details belong to
[localization and settings](06-localization-settings.md).

Permission names remain technical identifiers. Permission descriptions and role
names/descriptions are localized; menu captions use dynamic strings. Authored
song/wiki content retains its multilingual-text model.

Static/scoped-setting keys use 191-character columns; the renamed `GlobalSetting`
keeps its existing 768-character key column. Band-scoped wiki/Custom Link slugs
use 767 characters to fit the composite utf8mb4 index. Migration rejects overlong
values instead of truncating them.

Event status/type and global file-tag significance remain behavior-driving.
User invitation significance remains effective and read-only in migrated catalog
editing; existing global/band values are preserved.
Role/song-tag/credit-type significance and `Event.segmentBehavior` are absent;
consumers must stop using those removed fields.

## Settings and server invariants

`GlobalSetting`, `BandSetting`, `UserSetting`, and `BandUserSetting` hold independent
native-JSON values. Scoped keys are unique within their owner. Registry validation,
authorization, defaults, and reset behavior are application contracts, described
in [localization and settings](06-localization-settings.md#typed-settings).

The server also enforces singleton active role designations, soft-delete policy,
locale availability, string ownership, and effective grants. Declared uniqueness
or foreign keys never substitute for fresh authorization and same-band checks.
