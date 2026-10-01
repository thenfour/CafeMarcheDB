# Concrete realization of the plan arrived at in 00.

## Key🟢

-  ✨ new table to add
-  🟡 rename table, and/or add bandid
-  🔴 special attention needed

scenarios:

1. new tables (strings, band, global tags)
2. simple association (menulink, customlink)
3. custom migration (settings)
4. tags

## goal overview

-  Localization
   -  ✨`StaticLocalizedStringValue`
   -  ✨`DynamicLocalizedString`
   -  ✨`DynamicLocalizedStringValue`
-  Bands
   -  ✨`Band`
-  Auth/session
   -  🟡`Role` -> `GlobalRole`
   -  `Permission`
   -  `RolePermission`
   -  ✨`BandRole`
   -  ✨`UserBandRole` (+ seed from user.role)
   -  `UserSignInMethod`
   -  `AdminBootstrapClaim`
   -  `Session`
   -  `Token`
-  analytics/logging/diag
   -  🟡`Action` [add `bandId`]
   -  `CustomLinkVisit`
-  User
   -  `User`
   -  ✨`BandUsers`
   -  ✨`GlobalUserTag`
   -  🟡`UserTag` -> `BandUserTag`
   -  🟡`UserTagAssignment` -> `BandUserTagAssignment`
-  Settings/config
   -  `UserSetting`
   -  🟡`Setting` -> `GlobalSetting`, and per-key migration needed
   -  ✨`BandSetting`
   -  🟡`MenuLink` [add `bandId`]
   -  🟡`CustomLink` [add `bandId`]
-  Song
   -  🟡`Song` [add `bandId`]
   -  `SongCreditType`
   -  `SongCredit`
   -  ✨`GlobalSongTag`
   -  🟡`SongTag` -> `BandSongTag`
   -  🟡`SongTagAssociation` -> `BandSongTagAssociation` (song -> BandSongTag)
-  Instruments
   -  ✨`GlobalInstrumentFunctionalGroup`
   -  🟡`InstrumentFunctionalGroup` -> `BandInstrumentFunctionalGroup`
   -  ✨`GlobalInstrument`
   -  🟡`Instrument` -> `BandInstrument`
   -  ✨`GlobalInstrumentTag`
   -  🟡`InstrumentTag` -> `BandInstrumentTag`
   -  🟡`InstrumentTagAssociation` -> `BandInstrumentTagAssociation`
   -  🟡`UserInstrument` -> `BandUserInstrument`
-  Event
   -  🟡`Event` [add `bandId`]
   -  `EventSegment`
   -  `EventType` (global!)
   -  `EventStatus` (global!)
   -  ✨`GlobalEventTag`
   -  🟡`EventTag` -> `BandEventTag`
   -  `EventTagAssignment`
   -  `EventSongList`
   -  `EventSongListSong`
   -  `EventSongListDivider`
   -  `EventAttendance` (global!)
   -  `EventUserResponse`
   -  `EventSegmentUserResponse`
-  File
   -  🔴`FileTag` -> `GlobalEventTag` (because of the use of significance, migrate to global)
   -  ✨`FileBandTag`
   -  🔴`FileTagAssignment` (migration needs to go 1 ref lvl deeper)
   -  🟡`File` (add `bandId`)
   -  `FileUserTag` (file -> band user)
   -  `FileSongTag` (file -> song)
   -  `FileEventTag`
   -  `FileInstrumentTag`
   -  `FileWikiPageTag`
-  Wiki
   -  🟡`WikiPage` (add `bandId`)
   -  `WikiPageRevision`
   -  ✨`GlobalWikiPageTag`
   -  🟡`WikiPageTag` -> `WikiPageTag`
   -  `WikiPageTagAssignment`
-  Setlistplan
   -  🟡`SetlistPlanGroup` (add `bandId`)
   -  🟡`SetlistPlan` (add `bandId`)
-  CM specific
   -  `FrontpageGalleryItem`
