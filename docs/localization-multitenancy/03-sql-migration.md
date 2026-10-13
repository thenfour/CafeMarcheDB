# Localization and band migration SQL

[The localization migration](../../db/migrations/20261004130808_696_lsmb/migration.sql) migrates the schema
immediately preceding localization to the initial localization schema. It preserves
existing data through explicit renames and backfills, independently of application
startup, client generation, and the application build.

The production upgrade starts from
`094a783a94b95ed4ec15089e9372763b7d59f66c`, including its actual migration
history and uploads. The localization SQL alone is not the complete upgrade from
that release: deploy the required intervening migrations in order. Supporting
arbitrary intermediate development schemas is outside this production migration
scope. The application parity reference is separately pinned to `f027830a9790`;
see [baselines](00-design%20notes.md#baselines-and-restoration-target).

The [Prisma schema](../../db/schema.prisma) defines the target; SQL owns exact
source-to-target mappings. The [plan](04-implementation-plan.md) owns application
recovery. SQL rehearsal is complete; application readiness and production cutover
are separate acceptance steps.

The rules below describe the initial data migration. The
[authorization follow-up](../../db/migrations/20261005120000_696_authorization_foundation/migration.sql) adds the
capabilities documented in [authorization](05-authorization-foundation.md) and
corrects `GlobalSetting.value`/`BandSetting.value` to native JSON. Apply both
migrations to reach the current schema; the correction preserves the earlier
migration's JSON documents and original grant matrices.

## Accepted migration rules

- Create band ID `1`, named `Café Marché`, and locales `en-US`, `fr-BE`, and
  `nl-BE`. Enable all three for the band, ordered English, French, Dutch.
  Every migrated localized value uses `en-US`. French/Dutch values remain absent.
- Only the role designated by `isSysAdminRole` becomes `GlobalRole`. Other
  roles become `BandRole`. Keep definition IDs, public IDs, designations, and
  every grant row/permission unchanged; add no roles or permissions.
- A user's former ordinary role becomes their band membership role. A former
  sysadmin role becomes their global role. `isSysAdmin` also retains the old
  inherited sysadmin-role grants, including when the user had an ordinary role.
  The existing `User.isSysAdmin` flag itself is unchanged.
- Create one membership for every user, including deleted and merged users.
  Memberships are deleted when the person is deleted or has been merged.
  Keep the person's creation timestamp; leave unknown audit authors null.
- Rename shared catalogs and create a band opt-in for every catalog entry.
  Catalog text becomes global dynamic strings; nullable override fields remain
  null to inherit it. Menu captions become band dynamic values. The band name
  and migrated chrome strings are also band values.
- Preserve numeric IDs and existing valid public IDs. Repair only `~` public-ID
  placeholders left by earlier migrations. New public IDs use a private random
  seed and the existing 16-character base64url format; mappings remain stable
  within one execution. Discard the seed afterward. New wrapper/membership IDs
  are resolved through their global catalog/person keys, never assumed equal.
- Preserve nullable descriptions as null; an empty string gets its own empty
  localized value. Names/captions are `PlainText`; descriptions are `Markdown`.
  Short plain text uses `indexedValue`; Markdown uses `blobValue`.
- Exact duplicate instrument assignments retain the smallest source row ID
  and its public ID. Conflicting `isPrimary` flags stop the migration.
- New audit fields use the migration timestamp. Existing response timestamps
  remain unchanged; a missing timestamp uses its counterpart, then migration
  time if both are missing. Dates, duration values, date-time versions, UIDs,
  file storage names, tokens, wiki revisions, and content versions are preserved.
- Upgrade version-1 setlist JSON's numeric song IDs and associated
  event/song/user/wiki-page IDs in `columns`, `columnLeds`, and `rowLeds`.
  Rewrite matching numeric backstage URI segments, preserving suffixes and
  unrelated JSON content. Payloads already using public IDs retain their bytes.
  Upgrade exact legacy `EventDescription/<numeric ID>` wiki slugs.
- Clear both `permissionNames` and the older `permissions` session caches,
  disable `showAdminControls`, and retain session handles, tokens, and other
  metadata. Authorization must be rebuilt by the new application at cutover.
- Actions with an existing band-owned content reference receive band context.
  Platform/unknown history stays null. Preserve raw locale/language telemetry;
  only a known IETF locale tag resolves `localeContextId`.

## Production settings manifest

The SQL contains the complete per-key manifest for the 60 keys captured in
`temp/settings20261004.xml`. Read actual database values, not hardcoded XML values.
Unknown keys stop migration before permanent changes; missing keys are not seeded.

Branding/calendar settings become band settings; developer/selection preferences
become global settings; 26 chrome keys become band `en-US` static-string values,
preserving raw Markdown and intentional blanks without creating global defaults.
Four visibility-selection keys use the registry's inline default, and seven
obsolete keys are removed. Exact key mappings belong to SQL rather than a second
table here. The two status-selection aliases merge only if identical, retaining
the smallest source ID/public ID; other moved rows keep their identities.

Migrated values are JSON **strings**, including the text-palette JSON document
inside a string. Existing `UserSetting` values retain their JSON types and global
scope; `BandUserSetting` starts empty. Never expose or duplicate private calendar
bearer tokens as public settings.

`Dashboard_HostingMode` is removed; configure production with
`CMDB_HOSTING_MODE=CafeMarche` and set `CMDB_PUBLIC_BAND_PUBLIC_ID` to the migrated
band's public identity at application cutover. `CMDB_BASE_URL` must match the
public host. See the [routing contract](00-design%20notes.md#routing-and-later-scope).
`BandTimeZone` is absent
from the production manifest, so no timezone setting is invented.

## Data preservation acceptance

Capture source counts, identities, statuses, nullable values, grants, text,
settings, revisions and serialized references before migration. Create ownership,
membership, catalog and string mappings before remapping associations. Backfill
and compare before dropping source columns or requiring destination constraints.
Document the source of new audit timestamps; never invent unknown authors.
Reject overlong destination keys/slugs rather than silently truncating them.

- Account for every retained ID, new membership/wrapper/string and deduplicated
  association. Preserve credentials, sessions/tokens, merge history, content UIDs,
  hashes/revisions, file paths/URLs/metadata and authored content.
- Verify direct/inherited ownership, optional references and serialized plan
  references against the mapped existing band; every current wiki revision must
  belong to its page. Preserve nullable `SetNull` behavior and content on author
  deletion. Same-band checks for future writes remain an application responsibility.
- Compare the permission matrix for anonymous, pending, member, editor, band
  administrator and actual platform administrator accounts, including inactive,
  deleted and merged cases. Ordinary migration must not confer platform elevation.
- Compare visible text/Markdown by source locale, including null versus empty,
  menu/attendance captions, catalog styles/regexes and invitation/Partition/
  Recording behavior. Removed fields/settings remain in the required source backup.
- Run schema validation, actual migration deployment, destination-schema comparison
  and source/destination data comparisons on a disposable production copy.
  Deferred workflows' data must survive even while their app surfaces are guarded.
- Before cutover, exercise restored files/previews/recordings, wiki/history,
  event/setlist editing, feeds/tokens, supported URLs and Custom Links. Application
  parity/testing is a separate gate; schema equality alone is insufficient.

## Execution and recovery

1. Stop application writes and take a restorable database backup. Keep the
   matching application release and uploaded files available for recovery.
2. Restore the production-baseline backup and its migration history into a
   disposable database. Apply every pending migration from the target release in
   order, including those between production and localization. Do not use a moving
   branch name as the source contract or start the old application for startup
   backfills.
   The localization SQL includes the required public-ID/serialized-reference
   repairs. The preceding InstrumentTag removal migration now uses the source
   table casing so it also works on a case-sensitive server. If an environment
   already recorded that older migration, its stored checksum may differ from
   this casing correction; review its migration history before using `migrate dev`.
3. Point `DATABASE_URL` at the restored database. Use an account with normal
   migration DDL/DML privileges plus `CREATE ROUTINE`, `EXECUTE`, and
   `ALTER ROUTINE`. The script creates, calls, and drops one helper procedure.
   It uses MySQL 8 JSON_TABLE/regex features or MariaDB 10.11 equivalents.
4. Run the SQL through Prisma, which accepts the procedure body without
   client-specific `DELIMITER` commands:

   ```powershell
   yarn prisma migrate deploy --schema db/schema.prisma
   yarn prisma migrate diff --from-schema-datasource db/schema.prisma --to-schema-datamodel db/schema.prisma --script --exit-code
   ```

   The diff must report an empty migration, exit code `0`. Use normal migration
   deployment with the production migration history, not standalone SQL execution.
5. Compare IDs, grants, text, content, settings, memberships, and serialized
   references to the source backup. Schema equality alone is insufficient.
6. Production application cutover requires both production-source data preservation
   and application/runtime parity against `f027830a9790`, with explicit evidence
   for any accepted limitation. A0 startup or a smaller recovery page does not
   establish release readiness. The old application cannot use the migrated schema.

Preflight guards reject ambiguous mappings, orphan references, invalid public
IDs/JSON, conflicting duplicate assignments, unknown settings, and overlong
slugs before existing data or permanent tables change. Preservation guards
also run after backfills, before old localized source columns are removed.
Foreign-key checks stay enabled throughout the migration.

DDL commits implicitly. A failure after permanent changes requires restoring
the source backup, including migration history. Do not retry against a partial
migration, use `db push`, or mark a failed partial migration as applied.
The release deployer stops the service, backs up, deploys migrations and restarts;
it does not automatically restore on failure. Rehearse backup restoration with
the matching old application/client, keeping writes stopped and accounting for
uploads made after the backup separately. The old app cannot use the target schema.
Removed significance/segment-behavior fields and obsolete settings remain in
the required source backup; no archive tables are added to the target schema.

## Rehearsal evidence and limits

The initial migration was rehearsed through `prisma migrate deploy` on isolated
MariaDB `10.11.9` using `temp/tenfour_cmdb_20261002_at_git_094a783a9.sql`, brought
to the schema preceding localization. This dump identifies the pinned production
source, not the functional parity reference. Source/destination Prisma comparisons
were empty. Comparisons
covered all 183 original grants, 103 people/memberships, localized fields/settings,
public identities/history, unchanged scalars, and remapped references. All 707
numeric references in 29 plans were upgraded while preserving unrelated content.
No migration helper tables/procedure remained.

Additional fixtures on MariaDB `10.11.9` and MySQL `8.0.37` covered mismatched
numeric identities, null/empty/Unicode/Markdown values, duplicate instruments,
sysadmin inheritance, deleted/merged people, missing timestamps, native JSON,
session data, additional associations, and already upgraded plans. Eleven rejection
fixtures on each engine verified that invalid settings, identities, mappings,
references, and payloads fail before permanent changes.

These were disposable database rehearsals; no production or existing development
database was migrated. They establish SQL preservation behavior, not application
build/runtime acceptance or Linux table-case execution. Repeat the rehearsal on a
current production copy before cutover.
