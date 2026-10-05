# Existing-data migration requirements

The reviewed `schema.prisma` is the destination. The executable migration is
`db/migrations/20261004130808_696_lsmb/migration.sql`; its accepted policies,
rehearsal results, and recovery procedure are in [03-sql-migration.md](03-sql-migration.md).
Application consumer changes and cutover follow
[04-implementation-plan.md](04-implementation-plan.md). That plan separates
migrated-app recovery from complete routing, management, and localized editing.
Prisma's default diff for these renames/localized fields would drop data.

## Preparation and order

1. Rehearse on a restored production copy, with writes stopped. Record row
   counts, primary/public IDs, nullable values, role grants, settings, wiki
   revisions, serialized plans, and routes before changing anything.
2. Create the existing band's identity, its locales and enabled-locale rows.
   Keep an explicit mapping from the existing deployment to that band.
   The accepted migration locale for all existing localized fields is `en-US`.
   Create `en-US`, `fr-BE`, and `nl-BE`, without inventing translated values.
   Create string identities before locale/band rows, then their value rows,
   avoiding the locale-name/string-value creation cycle.
3. Move only the designated sysadmin role and its grants to global roles.
   All other definitions/grants become band roles, with the same permission
   matrix. Preserve bootstrap and sysadmin identity rules. Clear stored session
   permissions; rebuild them during the later application cutover.
4. Create one membership for every existing user, including deactivated,
   merged, and pending accounts needed by historical references. Preserve their
   status; a row needed for history must not become an active member merely
   because the migration created it. Resolve pending/default/public roles explicitly.
5. Rename catalogs, introduce band opt-ins/overrides, and localize their fields.
   Preserve both numeric and public IDs when a table is renamed. New wrapper
   and membership rows get new IDs; map through explicit global/person keys.
6. Assign band ownership to content. Preserve inherited ownership through parents
   and remap association FKs using the membership/catalog mappings. Deduplicate
   exact associations before adding new uniqueness constraints, preserving a
   documented survivor's public ID.
7. Classify each existing setting key into a settings registry or chrome-string
   registry. Backfill scoped settings and localized menu captions. Preserve
   value types, intentional empty text, Markdown format, and source locale.
8. Migrate every runtime consumer: Prisma arguments, DB3 descriptors/hydration/
   SQL, seeds, authorization, user merge policies, RPC/API parameters, file
   serving/uploads, wiki/Custom Link resolution, calendars, and serialized plan
   references. Resolve band context on the server and enforce all optional
   same-band references listed in `01-schema.md`. Follow phases 1–4 of the
   implementation plan, with authorization/isolation checks throughout.
9. Validate backfills before requiring new columns and creating destination FKs.
   Switch to the new generated client and application together. Remove old
   string/role fields and obsolete runtime constants only after preservation
   checks pass.

## Model and key mapping

| Current model/field | Destination and preservation rule |
| --- | --- |
| `Role`, `RolePermission` | Split definitions/grants into `GlobalRole`/`GlobalRolePermission` and platform-owned `BandRole`/`BandRolePermission`. This is a privilege mapping, not a blind rename. Localize role names/descriptions; preserve nullable descriptions. |
| `Permission` | Keep registry names/IDs and every existing grant, localize description, backfill timestamps and soft-delete state. |
| `User.roleId` | Explicit `globalRoleId` plus the existing band's `BandUser.bandRoleId`. Ordinary and band-management users receive no platform elevation. |
| `User`, sign-in methods, sessions, tokens, bootstrap claims | Keep global identity, credentials, merge history, IDs and tokens. New memberships must respect deleted/merged accounts. Rebuild session authorization for the new role model. |
| `UserTag` | `GlobalUserTag`, with localized name/description. Create the existing band's `BandUserTag` wrappers. Removed source fields remain in the required source backup. |
| `UserTagAssignment` | `BandUserTagAssignment`: `userId -> bandUserId`, `userTagId -> bandUserTagId`; ownership follows the membership/tag. Existing uniqueness prevents duplicate assignments. |
| `SongTag` | `GlobalSongTag`, plus the existing band's `BandSongTag` wrappers. Localize `text -> name`, description; preserve style, group, indicator, ordering. Remove significance when consumers switch. |
| `SongTagAssociation` | `BandSongTagAssociation`: `tagId -> bandSongTagId`; retain song/association IDs. Ownership follows the song/tag. |
| `InstrumentFunctionalGroup` | `GlobalInstrumentFunctionalGroup`, plus a corresponding `BandInstrumentFunctionalGroup` for the existing band. Preserve catalog/group mappings and style/order. |
| `Instrument` | `GlobalInstrument`, plus matching `BandInstrument` opt-ins. Each local instrument points to the mapped local functional group. Preserve matching regex, localized name/description and ordering. |
| `UserInstrument` | `BandUserInstrument`: map user membership and local instrument, preserve `isPrimary`; exact duplicate pairs retain the smallest source ID/public ID. Reject conflicting flags. |
| `EventType` | Remains global. Localize `text -> name`, description. Preserve significance. |
| `EventStatus` | Remains global. Localize `label -> name`, description. Preserve cancellation/confirmation significance and deleted state. |
| `EventAttendance` | Remains global. `text -> buttonCaption`, `personalText -> personalCaption`, `pastText -> pastCaption`, `pastPersonalText -> personalPastCaption`, plus localized description. Preserve strength, active/deleted state, style and all IDs. |
| `EventTag` | `GlobalEventTag` plus `BandEventTag` wrappers. Localize `text -> name`, description; preserve frontpage visibility in the global row. Remove unused significance with consumers. |
| `EventTagAssignment` | Map `eventTagId -> bandEventTagId`; retain assignment identity and inherited ownership. |
| `Song`, `Event` | Add required existing-band ownership. Keep authored names/aliases/descriptions, visibility and author identity. Remap invitation tag and pinned recording within the band. Preserve UIDs, hashes and revision counters. Remove `Event.segmentBehavior` only with its consumer change and retain its old values in the migration snapshot. |
| `EventSegment`, `EventSongList` | Ownership remains inherited from `Event`. Preserve dates, UIDs, content and ordering. This migration does not convert date-time versions. |
| `EventSongListSong`, `EventSongListDivider` | Ownership remains inherited from their list. Preserve row identity and order. |
| `EventUserResponse`, `EventSegmentUserResponse` | Rename/remap `userId -> bandUserId`. Remap response `instrumentId -> bandInstrumentId`. Preserve comments, invitation/attendance state and calendar identity. Backfill missing audit timestamps from the other timestamp, then migration time. |
| `SongCreditType`, `SongCredit` | Credit types stay global and localize `text -> name`, description. Credits retain person references, text/year and song ownership. Remove type significance with consumers; author hard deletion now clears the person reference. |
| `FileTag` | `GlobalFileTag` plus `BandFileTag` wrappers. Localize `text -> name`, description. Keep behavior-driving significance solely on the global row. |
| `FileTagAssignment` | `BandFileTagAssignment`: `fileTagId -> bandFileTagId`; preserve assignment identity and inherited ownership. |
| `File` | Add required band ownership, preserve physical storage names/paths, URLs, external links, preview/parent links, metadata, uploader and visibility. |
| `FileUserTag` | `userId -> bandUserId`; retain association identity and inherited ownership. |
| `FileInstrumentTag` | `instrumentId -> bandInstrumentId`; retain association identity and inherited ownership. |
| `FileSongTag`, `FileEventTag`, `FileWikiPageTag` | Preserve identities and parent references. All existing parents receive the same band. |
| `WikiPage`, `WikiPageRevision` | Add page ownership, change slug uniqueness to `(bandId, slug)`. Keep revision/history IDs, current-revision pointer, content versions, text, namespace and locking state. Verify the current revision belongs to the page. |
| `WikiPageTag` | `GlobalWikiPageTag` plus `BandWikiPageTag` wrappers. Localize `text -> name`, description; keep style/order and archive any removed significance values. |
| `WikiPageTagAssignment` | `tagId -> bandWikiPageTagId`; retain association identity and inherited ownership. |
| `MenuLink` | Add band ownership. `caption -> captionId` with a localized string/value. Preserve URI/slug references, group/style, order and visibility. |
| `CustomLink`, `CustomLinkVisit` | Add link ownership and `(bandId, slug)` uniqueness. Visits inherit through the link. Preserve destination/file behavior, redirects and visit history; resolve custom URLs under the band's portal root. |
| `SetlistPlanGroup`, `SetlistPlan` | Add band ownership, keep IDs/content/order/visibility, verify each group is in the plan's band. Preserve `payloadJson` and map every contained reference, including ID/public-ID strings and JSON-encoded identifiers. Removing an author must not remove band plans. |
| `Setting` | `GlobalSetting` or `BandSetting` by a complete per-key manifest; chrome text instead moves to localized string values. Preserve names/types/values and make band keys unique within the band. |
| `UserSetting` | Keep existing global user preferences and JSON types. Move genuinely per-band preferences to `BandUserSetting` through membership. Do not duplicate a private calendar bearer token in a public setting. |
| `Action` | Preserve history. Backfill existing-band context where justified; platform/unknown contexts stay null. Remap `instrumentId -> bandInstrumentId`, preserve raw language/locale fields, and set resolved `localeContextId` only from known information. |
| `FrontpageGalleryItem` | Preserve existing model, multilingual captions, file reference, style and visibility. Ownership is inherited through its file. |

For every new required audit timestamp, document its source or the chosen
migration timestamp. Do not infer unknown authors. Slugs longer than 767
characters and keys destined for 191-character columns require an explicit resolution
before constraints are applied; never truncate them silently.

## Acceptance and recovery

- Compare source/destination counts and IDs, accounting explicitly for every
  deduplicated association and every new wrapper/membership/string row.
- Prove all direct and inherited content belongs to the existing band, no
  required cross-band associations exist, optional refs match ownership, and
  all current wiki revisions belong to their pages.
- Compare the before/after permission matrix for anonymous, pending, member,
  editor, band administrator and actual platform administrator accounts.
  Check deactivated/merged accounts and disabled memberships explicitly.
- Compare visible text and Markdown by source locale, including null versus
  empty values. Check menus, tags, attendance captions, catalog regexes,
  partitions/recordings and invitation behavior.
- Exercise uploads/downloads and preview links, pinned recordings, wiki saves
  and history, event/setlist editing, calendars and feed tokens, account merge,
  existing URLs and Custom Links. Validate serialized plan references.
- For the SQL task, run Prisma schema validation, an actual migration deploy,
  destination schema comparison, and source/destination data comparisons on a
  disposable production copy. Application generation/build, the repository test
  suite, and runtime acceptance belong to the later consumer migration.
- The release deployer stops the service, backs up the database, deploys Prisma
  migrations and restarts. It does not automatically restore on failure.
  Rehearse restoring that backup together with the previous application/client
  release before cutover. Keep writes stopped during recovery and account for
  any uploads made after the backup separately.

The SQL implementation follows the current schema's actual keys. Older design
notes describing additional composite band keys are not part of this migration;
same-band validation for future writes remains an application responsibility.
