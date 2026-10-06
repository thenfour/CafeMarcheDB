# Concrete realization of the plan arrived at in 00.

## Reviewed target schema

`db/schema.prisma` describes the target model. The data-preserving migration is
implemented and rehearsed; see [03-sql-migration.md](03-sql-migration.md).
The target client has been generated and phase 1's context, authorization,
signup/bootstrap and access-control seeds are implemented; see
[05-authorization-foundation.md](05-authorization-foundation.md). DB3 descriptors,
domain operations, other seed content, and runtime consumers still need coordinated
adaptation. Follow [04-implementation-plan.md](04-implementation-plan.md) for that work. Do not run
`prisma db push` against existing application data; production must switch the
application/client and migrated database together.

The target schema can be checked independently with `yarn prisma validate`.
The earlier schema constraint harness is archived at
`scripts/archived/test-localization-mysql.cjs`. Its original constraint tests
describe an earlier model and need review before reuse. Current SQL rehearsal
evidence is recorded in the migration runbook; application isolation tests belong
to the implementation plan.

### Ownership and references

- `User` is the global person; `BandUser` is their membership. There is exactly
  one membership per `(bandId, userId)`. Memberships can be soft-deleted and
  reactivated without losing their identity or responses.
- `User.globalRoleId` and `BandUser.bandRoleId` are separate, nullable role
  selections. Both `GlobalRole` and `BandRole` and their permission matrices
  are platform-owned in V1. Band role definitions have no `bandId`.
- User tag assignments, instrument assignments, and file-user associations
  reference `BandUser`. Authorship, uploads, locks, and song credits reference
  the person. Event responses replace `userId` with `bandUserId`; their event or
  segment must belong to the membership's band, checked by server mutation code.
- Songs, events, files, wiki pages, custom links, menu links, setlist plans,
  setlist groups, and band catalog entries have required band ownership.
  Hard deletion of a band is restricted until its content is removed explicitly.
  An author disappearing clears the author reference on plans and credits.
- Event segments and song lists inherit band ownership through their parent
  event. The current foreign keys establish record identity but do not enforce
  all same-band associations. Required tag/file/song links and instrument/group
  links need explicit same-band validation in server mutations as well as
  ownership-aware reads. Existing composite unique keys alone do not imply that
  a relation uses a composite foreign key.
- Revisions, dividers, visits, and gallery items inherit ownership through
  their page, list, link, or file. They do not need an independent band selection.
- Optional references retain `SetNull`: pinned recordings; file previews and
  parents; event description wiki pages and invitation tags; response instruments;
  custom-link files; setlist groups. These need an explicit same-band check in
  server mutation code. A wiki current revision must belong to that page.
  Adding the required ownership key to a `SetNull` foreign key would attempt to
  clear ownership as well. These checks are part of the consumer migration.
- Action band and locale context are nullable: platform actions have no band,
  and historical/server actions may have no resolved presentation locale.
  Entity references in a band action must match its band in server code.

### Catalogs and localization

- All band catalogs use `(bandId, nullable globalItemId)` uniqueness. A band
  can have one override/opt-in per global item and multiple custom items with
  no global reference. `isHidden` permits opt-out without deleting associations.
  Nullable metadata inherits global values. Custom items
  must supply their own name identity; validate this when writing them.
- `BandInstrument` opts into a `GlobalInstrument` or defines a custom instrument,
  and always references a `BandInstrumentFunctionalGroup`. Groups can likewise
  opt into the global catalog or be custom. Create a local group automatically
  for custom instruments when the user does not choose one.
- Both global and band fields reference the single `DynamicLocalizedString`
  identity table. Global values and band values use the same `stringId` and
  locale shape. The identity records `PlainText` or `Markdown` format.
  An override may reuse a global field's identity or reference a new one.
  Custom band strings have band values and no global values.
- Each name, description, and attendance caption resolves independently.
  Once a field has band translations, apply the band's locale fallbacks before
  considering global content; do not fall through to a different global meaning.
  Deleting a referenced string is restricted; clearing an override is explicit.
- Static string keys and setting keys are registry identifiers. Permission names
  remain technical identifiers. Permission descriptions and role names/descriptions
  are localized; song titles/aliases and authored content remain multilingual text.
  Menu captions are dynamic localized strings.
- Store exactly one of `indexedValue` or `blobValue` per value row. Empty text is
  a value, not a missing translation. The value writer must enforce this invariant.
  Indexed values have actual indexes; long values remain `MediumText`.
- Static string keys and scoped setting keys use 191 characters. The renamed
  `GlobalSetting` retains its existing 768-character key column. Band-scoped
  wiki/custom-link slugs use 767
  characters, leaving room for the integer band key in MySQL's utf8mb4 index.
  Migration must reject overlong existing values rather than truncate them.
- `EventStatus.significance`, `EventType.significance`, and global file-tag
  significance still drive behavior and are retained. Band file tags inherit
  significance from their global definition; they do not override it.
  User invitation significance remains pending its separate behavioral cleanup.
  Role/song-tag/credit-type significance and `Event.segmentBehavior` are absent
  from the target schema. Their current runtime constants remain until consumers migrate.

### Settings and remaining server invariants

`GlobalSetting`, `BandSetting`, `UserSetting`, and `BandUserSetting` provide
separate scopes. Band/membership setting names are unique within their scope,
not across bands. Membership settings can hold calendar locale preferences.
All four value columns use native Prisma `Json`. The settings registry provides
per-key authorization, defaults, and value validation; strings remain strings
without a second JSON decode.

The server must enforce singleton role designations, prohibit granting a deleted
role/permission or using a deactivated membership, select default/enabled locales,
and authorize band/string ownership. SQL foreign keys enforce the relationships
declared in the current schema; server code must establish
same-band consistency, caller permissions, and soft-delete policy.
Setlist `payloadJson` and menu `wikiSlug` also need band-aware reference resolution.

## Key🟢

-  ✨ new table to add
-  🟡 rename table, and/or add bandid
-  🔴 special attention needed

⏹️❎🟥🟧🟨🟩🟦🟪🟫⬛⬜◼️
⭕🔴🟠🟡🟢🔵🟣

scenarios:

1. new tables (strings, band, global tags)
2. simple association (menulink, customlink)
3. custom migration (settings)
4. tags

## general

-  🅾️🔤🔡🅱️ℹ️©️Ⓜ️®️🟫®️🟧🟪👁️🅾️🔤🔡🅱️ℹ️©️Ⓜ️®️
-  🟫®️👁️Ⓜ️

---

-  🟫soft deletion for large entities, or where already exists.
   -  band = soft delete
   -  roles, permission = soft delete
   -  band user membership is debatable
-  ®️recordkeeping. tiny overhead so in general do it.
   -  createdAt - most models should get this; it's small, simple, and often useful for search
   -  updatedAt - most models should get this as well
   -  createdBy - less useful but still simple. not that useful and creates more relations/schema complexity.
   -  updatedBy - less useful; actual audits
-  👁️visibility permission / private items
   -  keep same concept as today: if bands want to hide entities by role, do this.
-  xtable
   -  "row owner" should likely not be needed / no exceptional auth
   -  name + description in general
   -  Ⓜ️color / icon / sortorder as well

## relation strategy

-  for example, a song credit: relate to the `banduser` or the `user`?

```prisma
model Band {
   id       Int        @id
   BandUser BandUser[]
}

model User {
   id       Int        @id
   BandUser BandUser[]
}

model BandUser {
   id     Int  @id
   bandId Int
   band   Band @relation(fields: [bandId], references: [id])
   userId Int
   user   User @relation(fields: [userId], references: [id])
}

model SongCredit {
   id         Int @id
   songId     Int
   // should it be:
   bandId     Int
   userId     Int
   // or,
   bandUserId Int
}
```

Need to just consider the difference. If `bandUser` can be deleted or modified,
or if `user` gets deleted for example.

Also if queries to `SongCredit` would _like_ to see membership, or the user. Which
relation is most logical? Either may be necessary, careful thought should be put into
the semantics of that relation. Is it the PERSON, or the PERSON's MEMBERSHIP that
needs to be recorded.

## goal overview

-  Localization
   -  ✨`Locale` - locales available globally
   -  ✨`BandLocale` - locales the band offers (simple opt-in)
   -  ✨`StaticLocalizedStringValue`
   -  ✨`DynamicLocalizedString`
   -  ✨`DynamicLocalizedStringValue`
   -  ✨`BandStaticLocalizedStringValue` - band-specific site chrome overrides
   -  ✨`BandDynamicLocalizedStringValue` - band-specific tag (et al) string values
-  Bands
   -  ✨`Band`
-  Auth/session
   -  🟡`Role` -> `GlobalRole`
   -  `Permission`
   -  🟡`RolePermission` -> `GlobalRolePermission`
   -  ✨`BandRole`
   -  ✨`BandRolePermission`
   -  `UserSignInMethod`
   -  `AdminBootstrapClaim`
   -  `Session`
   -  `Token`
-  analytics/logging/diag
   -  🟡`Action` [add `bandId`]
   -  `CustomLinkVisit`
-  User
   -  `User`
   -  ✨`BandUser` -- includes Role just as `User.globalRoleId`
   -  ✨`BandUserTag`
   -  🟡`UserTag` -> `GlobalUserTag`
   -  🟡`UserTagAssignment` -> `BandUserTagAssignment`
-  Settings/config
   -  `UserSetting`
   -  ✨`BandUserSetting`
   -  🟡`Setting` -> `GlobalSetting`, and per-key migration needed
   -  ✨`BandSetting`
   -  🟡`MenuLink` [add `bandId`]
   -  🟡`CustomLink` [add `bandId`]
-  Song
   -  🟡`Song` [add `bandId`]
   -  `SongCreditType`
   -  `SongCredit`
   -  🟡`SongTag` -> `GlobalSongTag`
   -  ✨`BandSongTag`
   -  🟡`SongTagAssociation` -> `BandSongTagAssociation` (song -> BandSongTag)
-  Instruments
   -  🟡`InstrumentFunctionalGroup` -> `GlobalInstrumentFunctionalGroup`
   -  ✨`BandInstrumentFunctionalGroup`
   -  🟡`Instrument` -> `GlobalInstrument`
   -  ✨`BandInstrument`
   -  🟡`UserInstrument` -> `BandUserInstrument`
-  Event
   -  🟡`Event` [add `bandId`]
   -  `EventSegment`
   -  `EventType` (global!)
   -  `EventStatus` (global!)
   -  🟡`EventTag` -> `GlobalEventTag`
   -  ✨`BandEventTag`
   -  `EventTagAssignment`
   -  `EventSongList`
   -  `EventSongListSong`
   -  `EventSongListDivider`
   -  `EventAttendance` (global!)
   -  `EventUserResponse`
   -  `EventSegmentUserResponse`
-  File
   -  🔴`FileTag` -> `GlobalFileTag` (because of the use of significance, migrate to global)
   -  ✨`BandFileTag`
   -  🔴`FileTagAssignment` -> `BandFileTagAssignment` (migration needs to go 1 ref lvl deeper)
   -  🟡`File` (add `bandId`)
   -  `FileUserTag` (file -> band user)
   -  `FileSongTag` (file -> song)
   -  `FileEventTag`
   -  `FileInstrumentTag`
   -  `FileWikiPageTag`
-  Wiki
   -  🟡`WikiPage` (add `bandId`)
   -  `WikiPageRevision`
   -  🟡`WikiPageTag` -> `GlobalWikiPageTag`
   -  ✨`BandWikiPageTag`
   -  `WikiPageTagAssignment`
-  Setlistplan
   -  🟡`SetlistPlanGroup` (add `bandId`)
   -  🟡`SetlistPlan` (add `bandId`)
-  CM specific
   -  `FrontpageGalleryItem`
