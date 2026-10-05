# Localization and band migration SQL

`db/migrations/20261004130808_696_lsmb/migration.sql` migrates the `main`
schema to the current `db/schema.prisma`, preserving existing data through
explicit renames and backfills. It runs independently of application startup,
client generation, and the application build.

The application recovery and completion checklist is
[04-implementation-plan.md](04-implementation-plan.md). SQL rehearsal is complete;
application readiness and production cutover are separate acceptance steps.

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

The manifest covers the 60 keys in `temp/settings20261004.xml`. SQL reads
their actual database values; the XML is evidence of which keys need migration,
not a source of hardcoded replacement values. Missing keys are not seeded.
An unknown key stops the migration before permanent changes.

All migrated setting values are JSON **strings**, including the `textPalette`
JSON document stored inside a string. Existing `UserSetting` rows remain global
with their original JSON types. `BandUserSetting` starts empty.

| Old setting | Band setting |
| --- | --- |
| `Dashboard_SiteTitle` | `siteCustomization.title` |
| `Dashboard_SiteTitlePrefix` | `siteCustomization.titlePrefix` |
| `Dashboard_SiteFaviconUrl` | `siteCustomization.faviconUrl` |
| `Dashboard_Theme_PrimaryMain` | `siteCustomization.themeColors.primaryMain` |
| `Dashboard_Theme_SecondaryMain` | `siteCustomization.themeColors.secondaryMain` |
| `Dashboard_Theme_BackgroundDefault` | `siteCustomization.themeColors.backgroundDefault` |
| `Dashboard_Theme_BackgroundPaper` | `siteCustomization.themeColors.backgroundPaper` |
| `Dashboard_Theme_ContrastText` | `siteCustomization.themeColors.contrastText` |
| `Ical_CalendarName` | `ical.calendarName` |
| `Ical_CalendarCompany` | `ical.calendarCompany` |
| `Ical_CalendarProduct` | `ical.calendarProduct` |
| `Ical_CalendarEventPrefix` | `ical.calendarEventPrefix` |

| Old setting | Global setting |
| --- | --- |
| `textPalette` | `global.dev.textPalette` |
| `event.expectedAttendanceUserTag.SelectStyle` | `global.ui.event.expectedAttendanceUserTag.selectStyle` |
| `event.status.SelectStyle`, `EventSegment.status.SelectStyle` | `global.ui.event.status.selectStyle` |
| `event.type.SelectStyle` | `global.ui.event.type.selectStyle` |
| `eventSegmentUserResponse.attendance.SelectStyle` | `global.ui.event.attendance.selectStyle` |
| `Event.tags.SelectStyle` | `global.ui.event.tags.selectStyle` |
| `songCredit.type.SelectStyle` | `global.ui.songCredit.type.selectStyle` |
| `user.role.SelectStyle` | `global.ui.user.role.selectStyle` |
| `Song.tags.SelectStyle` | `global.ui.song.tags.selectStyle` |

The two status keys merge only when their values are identical. The smallest
source ID/public ID survives. All other moved setting rows retain their IDs
and public IDs in the destination hive.

The 26 chrome keys marked `TO LOCALIZED STRING` in
`src/locale/staticLocalizedStringRegistry.ts` become
`BandStaticLocalizedStringValue` rows for band `1`, `en-US`, under the same key.
Their raw Markdown, including intentional empty strings, is preserved.
They do not create global static defaults. The registry includes every migrated
key, and the global registry includes the attendance select-style destination.

The four `*.visiblePermission.SelectStyle` keys are removed in favor of the
registry's inline default. Seven obsolete keys are removed:
`EnableNewPublicHomepageBackstageLink`, `EnableOldPublicHomepageBackstageLink`,
`EventSegment`, `MarkdownHelpPage`, `info_text`,
`CustomLinkRedirectTypeDescriptionMarkdown_Temporary`, and
`Event.workflowDef.SelectStyle`.

`Dashboard_HostingMode` is removed; its production value is `CafeMarche`.
The later application cutover must supply that value through environment
configuration. SQL cannot configure an environment file. `BandTimeZone` is
absent from the production manifest, so no timezone setting is invented.

## Execution and recovery

1. Stop application writes and take a restorable database backup. Keep the
   matching application release and uploaded files available for recovery.
2. Restore into a disposable database. Apply all preceding migrations from
   `main`; do not start the old application to perform its startup backfills.
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

   The diff must report an empty migration, exit code `0`. For a main-schema
   copy without migration history, use `prisma db execute --schema
   db/schema.prisma --file db/migrations/20261004130808_696_lsmb/migration.sql`
   instead of migration deploy. `db execute` does not record migration history.
5. Compare IDs, grants, text, content, settings, memberships, and serialized
   references to the source backup. Schema equality alone is insufficient.
6. Production application cutover happens only after consumer/build work and
   runtime acceptance. The old application cannot use the migrated schema.

Preflight guards reject ambiguous mappings, orphan references, invalid public
IDs/JSON, conflicting duplicate assignments, unknown settings, and overlong
slugs before existing data or permanent tables change. Preservation guards
also run after backfills, before old localized source columns are removed.
Foreign-key checks stay enabled throughout the migration.

DDL commits implicitly. A failure after permanent changes requires restoring
the source backup, including migration history. Do not retry against a partial
migration, use `db push`, or mark a failed partial migration as applied.
Removed significance/segment-behavior fields and obsolete settings remain in
the required source backup; no archive tables are added to the target schema.

## Rehearsal evidence

Rehearsed on an isolated MariaDB `10.11.9` instance using
`temp/tenfour_cmdb_20261002_at_git_094a783a9.sql`, brought to the main schema.
The source and destination Prisma schema comparisons were both empty; the
localization migration ran through `prisma migrate deploy`.

| Check | Verified outcome |
| --- | --- |
| Roles/grants | 1 global role / 49 grants, 6 band roles / 134 grants; all 183 grants preserved |
| People/memberships | 103 people and 103 memberships, deleted/merged state preserved |
| Localized fields | 340 source fields compared exactly; 344 identities including band/locale names |
| Production settings | 12 band settings, 9 global settings, 26 band chrome values; all 48 migrated source values preserved |
| Serialized references | All 707 numeric references in 29 plans upgraded; unrelated JSON content preserved |
| Identity/history | 22,352 public identities checked; 132,206 actions and 26,764 change records retained |
| Scalar/FK preservation | 4,292,073 unchanged scalar values and 14,379 remapped references checked |
| Destination | 72 models, no leftover migration tables/procedure, empty Prisma diff |

Additional fixtures passed on MariaDB `10.11.9` and MySQL `8.0.37`, covering
nonmatching numeric IDs, null/empty strings, Markdown, supplementary Unicode,
quotes/backslashes, inherited sysadmin grants, merged/deleted users, exact
duplicate instrument assignments, missing timestamps, native JSON user
preferences, null session data, wiki tags/file-user tags absent from the dump,
and already upgraded setlist payloads.

Eleven rejection fixtures on each engine checked that permanent schema/data
remained unchanged: unknown settings, conflicting merged settings, invalid
enum values, conflicting instrument duplicates, overlong slugs, malformed
public IDs, dangling serialized/relational references, public-ID repair
collisions, missing sysadmin designation, and invalid setlist JSON.

The DB instances and databases used for these checks were disposable. No
production or existing development database was migrated. Application build,
client generation, runtime behavior, and Linux table-case execution remain
outside these database rehearsals.
