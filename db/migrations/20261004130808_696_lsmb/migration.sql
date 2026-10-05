-- Localization and the existing Cafe Marche band, from the main schema.
-- Stop application writes and take a database backup before applying this file.
-- MySQL/MariaDB DDL commits implicitly: restore the backup after a failed migration.
-- Do not retry this file against a partially migrated database.
-- Requires CREATE ROUTINE for the temporary serialized-reference backfill.
-- The SQL runs through Prisma without DELIMITER directives or application startup.
-- Only the designated sysadmin role becomes global; all other grants stay band roles.
-- Catalog text is global en-US content. Menu captions and the 26 production chrome
-- settings are Cafe Marche band values. No French/Dutch translations are invented.
-- Preserve valid public IDs; replace only the older migration's '~' placeholders.
-- A private random seed keeps newly generated IDs unpredictable and their mappings
-- stable within this execution. It is discarded with the migration bookkeeping.
-- Settings values become JSON strings; localized values retain their original bytes.
-- Removed significance/segmentBehavior values remain in the required source backup.
-- Dashboard_HostingMode leaves the database. Configure CafeMarche in the environment
-- before the later application cutover; SQL cannot write an environment file.
SET @lsmb_migration_at = CURRENT_TIMESTAMP(3);
SET @lsmb_public_id_seed = HEX(RANDOM_BYTES(32));
SET @lsmb_original_group_concat_max_len = @@SESSION.group_concat_max_len;
SET SESSION group_concat_max_len = 1048576;
CREATE TEMPORARY TABLE `_lsmb_assert` (`checkName` VARCHAR(191) PRIMARY KEY);
-- An assertion failure deliberately reports a duplicate key containing its reason.
CREATE TEMPORARY TABLE `_lsmb_setting_manifest` (
  `sourceName` VARCHAR(768) COLLATE utf8mb4_bin PRIMARY KEY,
  `hive` VARCHAR(16) NOT NULL,
  `destinationName` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL
) CHARACTER SET utf8mb4;
INSERT INTO `_lsmb_setting_manifest` VALUES
  ('Dashboard_SiteTitle', 'band', 'siteCustomization.title'),
  ('Dashboard_SiteTitlePrefix', 'band', 'siteCustomization.titlePrefix'),
  ('Dashboard_SiteFaviconUrl', 'band', 'siteCustomization.faviconUrl'),
  ('Dashboard_Theme_PrimaryMain', 'band', 'siteCustomization.themeColors.primaryMain'),
  ('Dashboard_Theme_SecondaryMain', 'band', 'siteCustomization.themeColors.secondaryMain'),
  ('Dashboard_Theme_BackgroundDefault', 'band', 'siteCustomization.themeColors.backgroundDefault'),
  ('Dashboard_Theme_BackgroundPaper', 'band', 'siteCustomization.themeColors.backgroundPaper'),
  ('Dashboard_Theme_ContrastText', 'band', 'siteCustomization.themeColors.contrastText'),
  ('Ical_CalendarName', 'band', 'ical.calendarName'),
  ('Ical_CalendarCompany', 'band', 'ical.calendarCompany'),
  ('Ical_CalendarProduct', 'band', 'ical.calendarProduct'),
  ('Ical_CalendarEventPrefix', 'band', 'ical.calendarEventPrefix'),
  ('textPalette', 'global', 'global.dev.textPalette'),
  ('event.expectedAttendanceUserTag.SelectStyle', 'global', 'global.ui.event.expectedAttendanceUserTag.selectStyle'),
  ('event.status.SelectStyle', 'global', 'global.ui.event.status.selectStyle'),
  ('EventSegment.status.SelectStyle', 'global', 'global.ui.event.status.selectStyle'),
  ('event.type.SelectStyle', 'global', 'global.ui.event.type.selectStyle'),
  ('eventSegmentUserResponse.attendance.SelectStyle', 'global', 'global.ui.event.attendance.selectStyle'),
  ('Event.tags.SelectStyle', 'global', 'global.ui.event.tags.selectStyle'),
  ('songCredit.type.SelectStyle', 'global', 'global.ui.songCredit.type.selectStyle'),
  ('user.role.SelectStyle', 'global', 'global.ui.user.role.selectStyle'),
  ('Song.tags.SelectStyle', 'global', 'global.ui.song.tags.selectStyle'),
  ('menuLink.visiblePermission.DescriptionMarkdown', 'chrome', 'menuLink.visiblePermission.DescriptionMarkdown'),
  ('event.visiblePermission.DescriptionMarkdown', 'chrome', 'event.visiblePermission.DescriptionMarkdown'),
  ('Song.visiblePermission.DescriptionMarkdown', 'chrome', 'Song.visiblePermission.DescriptionMarkdown'),
  ('File.visiblePermission.DescriptionMarkdown', 'chrome', 'File.visiblePermission.DescriptionMarkdown'),
  ('RolesAdminPage_markdown', 'chrome', 'RolesAdminPage_markdown'),
  ('EditUserTagsPage_markdown', 'chrome', 'EditUserTagsPage_markdown'),
  ('editSongTags_markdown', 'chrome', 'editSongTags_markdown'),
  ('InstrumentFunctionalGroupList_markdown', 'chrome', 'InstrumentFunctionalGroupList_markdown'),
  ('instrumentList_markdown', 'chrome', 'instrumentList_markdown'),
  ('DashboardStats_SongsMarkdown', 'chrome', 'DashboardStats_SongsMarkdown'),
  ('customLink.redirectType.DescriptionMarkdown', 'chrome', 'customLink.redirectType.DescriptionMarkdown'),
  ('CustomLinksPageMarkdown', 'chrome', 'CustomLinksPageMarkdown'),
  ('MenuLinksPageMarkdown', 'chrome', 'MenuLinksPageMarkdown'),
  ('menuLink.groupName.DescriptionMarkdown', 'chrome', 'menuLink.groupName.DescriptionMarkdown'),
  ('menuLink.caption.DescriptionMarkdown', 'chrome', 'menuLink.caption.DescriptionMarkdown'),
  ('menuLink.iconName.DescriptionMarkdown', 'chrome', 'menuLink.iconName.DescriptionMarkdown'),
  ('menuLink.linkType.DescriptionMarkdown', 'chrome', 'menuLink.linkType.DescriptionMarkdown'),
  ('menuLink.externalURI.DescriptionMarkdown', 'chrome', 'menuLink.externalURI.DescriptionMarkdown'),
  ('menuLink.wikiSlug.DescriptionMarkdown', 'chrome', 'menuLink.wikiSlug.DescriptionMarkdown'),
  ('menuLink.groupCssClass.DescriptionMarkdown', 'chrome', 'menuLink.groupCssClass.DescriptionMarkdown'),
  ('menuLink.itemCssClass.DescriptionMarkdown', 'chrome', 'menuLink.itemCssClass.DescriptionMarkdown'),
  ('EditEventTagsPage_markdown', 'chrome', 'EditEventTagsPage_markdown'),
  ('EventSegment.description.DescriptionMarkdown', 'chrome', 'EventSegment.description.DescriptionMarkdown'),
  ('Event.workflowDef.DescriptionMarkdown', 'chrome', 'Event.workflowDef.DescriptionMarkdown'),
  ('NewEventSegmentDialogDescription', 'chrome', 'NewEventSegmentDialogDescription'),
  ('NewEventSegmentDialogTitle', 'chrome', 'NewEventSegmentDialogTitle'),
  ('EnableNewPublicHomepageBackstageLink', 'obsolete', 'EnableNewPublicHomepageBackstageLink'),
  ('EnableOldPublicHomepageBackstageLink', 'obsolete', 'EnableOldPublicHomepageBackstageLink'),
  ('EventSegment', 'obsolete', 'EventSegment'),
  ('MarkdownHelpPage', 'obsolete', 'MarkdownHelpPage'),
  ('info_text', 'obsolete', 'info_text'),
  ('CustomLinkRedirectTypeDescriptionMarkdown_Temporary', 'obsolete', 'CustomLinkRedirectTypeDescriptionMarkdown_Temporary'),
  ('Event.workflowDef.SelectStyle', 'obsolete', 'Event.workflowDef.SelectStyle'),
  ('File.visiblePermission.SelectStyle', 'obsolete', 'File.visiblePermission.SelectStyle'),
  ('Song.visiblePermission.SelectStyle', 'obsolete', 'Song.visiblePermission.SelectStyle'),
  ('event.visiblePermission.SelectStyle', 'obsolete', 'event.visiblePermission.SelectStyle'),
  ('MenuLink.visiblePermission.SelectStyle', 'obsolete', 'MenuLink.visiblePermission.SelectStyle'),
  ('Dashboard_HostingMode', 'environment', 'Dashboard_HostingMode');

-- Preflight: all checks run before existing data or permanent tables change.

INSERT INTO `_lsmb_assert` VALUES ('lsmb: apply with foreign_key_checks enabled');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: apply with foreign_key_checks enabled' WHERE @@foreign_key_checks <> 1;

INSERT INTO `_lsmb_assert` VALUES ('lsmb: expected one designated sysadmin role');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: expected one designated sysadmin role' WHERE (EXISTS (SELECT 1 FROM `Role`) AND (SELECT COUNT(*) FROM `Role` WHERE `isSysAdminRole`) <> 1) OR (EXISTS (SELECT 1 FROM `User` WHERE `isSysAdmin`) AND NOT EXISTS (SELECT 1 FROM `Role` WHERE `isSysAdminRole`));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: sysadmin role cannot be public or new-user default');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: sysadmin role cannot be public or new-user default' WHERE EXISTS (SELECT 1 FROM `Role` WHERE `isSysAdminRole` AND (`isPublicRole` OR `isRoleForNewUsers`));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: multiple public or new-user role designations');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: multiple public or new-user role designations' WHERE (SELECT COUNT(*) FROM `Role` WHERE `isPublicRole`) > 1 OR (SELECT COUNT(*) FROM `Role` WHERE `isRoleForNewUsers`) > 1;

INSERT INTO `_lsmb_assert` VALUES ('lsmb: unknown production setting; extend the manifest');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: unknown production setting; extend the manifest' WHERE EXISTS (SELECT 1 FROM `Setting` s LEFT JOIN `_lsmb_setting_manifest` m ON BINARY m.`sourceName` = BINARY s.`name` WHERE m.`sourceName` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: conflicting setting values for a merged destination');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: conflicting setting values for a merged destination' WHERE EXISTS (SELECT m.`destinationName` FROM `Setting` s JOIN `_lsmb_setting_manifest` m ON BINARY m.`sourceName` = BINARY s.`name` WHERE m.`hive` = 'global' GROUP BY m.`destinationName` HAVING COUNT(DISTINCT BINARY s.`value`) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: selectStyle must be inline or dialog');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: selectStyle must be inline or dialog' WHERE EXISTS (SELECT 1 FROM `Setting` s JOIN `_lsmb_setting_manifest` m ON BINARY m.`sourceName` = BINARY s.`name` WHERE m.`hive` = 'global' AND m.`destinationName` LIKE 'global.ui.%' AND BINARY s.`value` NOT IN ('inline', 'dialog'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: hosting mode must be moved to the environment');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: hosting mode must be moved to the environment' WHERE EXISTS (SELECT 1 FROM `Setting` WHERE BINARY `name` = 'Dashboard_HostingMode' AND BINARY `value` <> 'CafeMarche');

INSERT INTO `_lsmb_assert` VALUES ('lsmb: wiki or custom-link slug exceeds 767 characters');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: wiki or custom-link slug exceeds 767 characters' WHERE EXISTS (SELECT 1 FROM `WikiPage` WHERE CHAR_LENGTH(`slug`) > 767) OR EXISTS (SELECT 1 FROM `CustomLink` WHERE CHAR_LENGTH(`slug`) > 767);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: current wiki revision belongs to another page');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: current wiki revision belongs to another page' WHERE EXISTS (SELECT 1 FROM `WikiPage` p JOIN `WikiPageRevision` r ON r.`id` = p.`currentRevisionId` WHERE r.`wikiPageId` <> p.`id`);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: conflicting duplicate instrument assignments');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: conflicting duplicate instrument assignments' WHERE EXISTS (SELECT `userId`, `instrumentId` FROM `UserInstrument` GROUP BY `userId`, `instrumentId` HAVING MIN(`isPrimary`) <> MAX(`isPrimary`));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: invalid setlist JSON or unsupported payload version');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: invalid setlist JSON or unsupported payload version' WHERE EXISTS (SELECT 1 FROM `SetlistPlan` WHERE NOT JSON_VALID(`payloadJson`)) OR EXISTS (SELECT 1 FROM `SetlistPlan` WHERE JSON_VALID(`payloadJson`) AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(`payloadJson`, '$.version')), '') <> '1');

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan RolePermission.roleId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan RolePermission.roleId' WHERE EXISTS (SELECT 1 FROM `RolePermission` c LEFT JOIN `Role` p ON p.`id` = c.`roleId` WHERE c.`roleId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan RolePermission.permissionId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan RolePermission.permissionId' WHERE EXISTS (SELECT 1 FROM `RolePermission` c LEFT JOIN `Permission` p ON p.`id` = c.`permissionId` WHERE c.`permissionId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan Action.userId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan Action.userId' WHERE EXISTS (SELECT 1 FROM `Action` c LEFT JOIN `User` p ON p.`id` = c.`userId` WHERE c.`userId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan Action.fileId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan Action.fileId' WHERE EXISTS (SELECT 1 FROM `Action` c LEFT JOIN `File` p ON p.`id` = c.`fileId` WHERE c.`fileId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan Action.eventId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan Action.eventId' WHERE EXISTS (SELECT 1 FROM `Action` c LEFT JOIN `Event` p ON p.`id` = c.`eventId` WHERE c.`eventId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan Action.songId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan Action.songId' WHERE EXISTS (SELECT 1 FROM `Action` c LEFT JOIN `Song` p ON p.`id` = c.`songId` WHERE c.`songId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan Action.wikiPageId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan Action.wikiPageId' WHERE EXISTS (SELECT 1 FROM `Action` c LEFT JOIN `WikiPage` p ON p.`id` = c.`wikiPageId` WHERE c.`wikiPageId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan Action.eventSegmentId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan Action.eventSegmentId' WHERE EXISTS (SELECT 1 FROM `Action` c LEFT JOIN `EventSegment` p ON p.`id` = c.`eventSegmentId` WHERE c.`eventSegmentId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan Action.attendanceId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan Action.attendanceId' WHERE EXISTS (SELECT 1 FROM `Action` c LEFT JOIN `EventAttendance` p ON p.`id` = c.`attendanceId` WHERE c.`attendanceId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan Action.customLinkId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan Action.customLinkId' WHERE EXISTS (SELECT 1 FROM `Action` c LEFT JOIN `CustomLink` p ON p.`id` = c.`customLinkId` WHERE c.`customLinkId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan Action.eventSongListId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan Action.eventSongListId' WHERE EXISTS (SELECT 1 FROM `Action` c LEFT JOIN `EventSongList` p ON p.`id` = c.`eventSongListId` WHERE c.`eventSongListId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan Action.frontpageGalleryItemId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan Action.frontpageGalleryItemId' WHERE EXISTS (SELECT 1 FROM `Action` c LEFT JOIN `FrontpageGalleryItem` p ON p.`id` = c.`frontpageGalleryItemId` WHERE c.`frontpageGalleryItemId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan Action.menuLinkId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan Action.menuLinkId' WHERE EXISTS (SELECT 1 FROM `Action` c LEFT JOIN `MenuLink` p ON p.`id` = c.`menuLinkId` WHERE c.`menuLinkId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan Action.setlistPlanId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan Action.setlistPlanId' WHERE EXISTS (SELECT 1 FROM `Action` c LEFT JOIN `SetlistPlan` p ON p.`id` = c.`setlistPlanId` WHERE c.`setlistPlanId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan Action.songCreditTypeId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan Action.songCreditTypeId' WHERE EXISTS (SELECT 1 FROM `Action` c LEFT JOIN `SongCreditType` p ON p.`id` = c.`songCreditTypeId` WHERE c.`songCreditTypeId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan Action.instrumentId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan Action.instrumentId' WHERE EXISTS (SELECT 1 FROM `Action` c LEFT JOIN `Instrument` p ON p.`id` = c.`instrumentId` WHERE c.`instrumentId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan UserTagAssignment.userId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan UserTagAssignment.userId' WHERE EXISTS (SELECT 1 FROM `UserTagAssignment` c LEFT JOIN `User` p ON p.`id` = c.`userId` WHERE c.`userId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan UserTagAssignment.userTagId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan UserTagAssignment.userTagId' WHERE EXISTS (SELECT 1 FROM `UserTagAssignment` c LEFT JOIN `UserTag` p ON p.`id` = c.`userTagId` WHERE c.`userTagId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan User.mergedIntoUserId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan User.mergedIntoUserId' WHERE EXISTS (SELECT 1 FROM `User` c LEFT JOIN `User` p ON p.`id` = c.`mergedIntoUserId` WHERE c.`mergedIntoUserId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan User.roleId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan User.roleId' WHERE EXISTS (SELECT 1 FROM `User` c LEFT JOIN `Role` p ON p.`id` = c.`roleId` WHERE c.`roleId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan UserSignInMethod.userId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan UserSignInMethod.userId' WHERE EXISTS (SELECT 1 FROM `UserSignInMethod` c LEFT JOIN `User` p ON p.`id` = c.`userId` WHERE c.`userId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan UserSetting.userId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan UserSetting.userId' WHERE EXISTS (SELECT 1 FROM `UserSetting` c LEFT JOIN `User` p ON p.`id` = c.`userId` WHERE c.`userId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan Change.userId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan Change.userId' WHERE EXISTS (SELECT 1 FROM `Change` c LEFT JOIN `User` p ON p.`id` = c.`userId` WHERE c.`userId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan Session.userId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan Session.userId' WHERE EXISTS (SELECT 1 FROM `Session` c LEFT JOIN `User` p ON p.`id` = c.`userId` WHERE c.`userId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan Token.userId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan Token.userId' WHERE EXISTS (SELECT 1 FROM `Token` c LEFT JOIN `User` p ON p.`id` = c.`userId` WHERE c.`userId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan Song.createdByUserId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan Song.createdByUserId' WHERE EXISTS (SELECT 1 FROM `Song` c LEFT JOIN `User` p ON p.`id` = c.`createdByUserId` WHERE c.`createdByUserId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan Song.visiblePermissionId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan Song.visiblePermissionId' WHERE EXISTS (SELECT 1 FROM `Song` c LEFT JOIN `Permission` p ON p.`id` = c.`visiblePermissionId` WHERE c.`visiblePermissionId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan Song.pinnedRecordingId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan Song.pinnedRecordingId' WHERE EXISTS (SELECT 1 FROM `Song` c LEFT JOIN `File` p ON p.`id` = c.`pinnedRecordingId` WHERE c.`pinnedRecordingId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan SongCredit.userId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan SongCredit.userId' WHERE EXISTS (SELECT 1 FROM `SongCredit` c LEFT JOIN `User` p ON p.`id` = c.`userId` WHERE c.`userId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan SongCredit.songId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan SongCredit.songId' WHERE EXISTS (SELECT 1 FROM `SongCredit` c LEFT JOIN `Song` p ON p.`id` = c.`songId` WHERE c.`songId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan SongCredit.typeId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan SongCredit.typeId' WHERE EXISTS (SELECT 1 FROM `SongCredit` c LEFT JOIN `SongCreditType` p ON p.`id` = c.`typeId` WHERE c.`typeId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan SongTagAssociation.songId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan SongTagAssociation.songId' WHERE EXISTS (SELECT 1 FROM `SongTagAssociation` c LEFT JOIN `Song` p ON p.`id` = c.`songId` WHERE c.`songId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan SongTagAssociation.tagId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan SongTagAssociation.tagId' WHERE EXISTS (SELECT 1 FROM `SongTagAssociation` c LEFT JOIN `SongTag` p ON p.`id` = c.`tagId` WHERE c.`tagId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan Instrument.functionalGroupId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan Instrument.functionalGroupId' WHERE EXISTS (SELECT 1 FROM `Instrument` c LEFT JOIN `InstrumentFunctionalGroup` p ON p.`id` = c.`functionalGroupId` WHERE c.`functionalGroupId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan UserInstrument.instrumentId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan UserInstrument.instrumentId' WHERE EXISTS (SELECT 1 FROM `UserInstrument` c LEFT JOIN `Instrument` p ON p.`id` = c.`instrumentId` WHERE c.`instrumentId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan UserInstrument.userId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan UserInstrument.userId' WHERE EXISTS (SELECT 1 FROM `UserInstrument` c LEFT JOIN `User` p ON p.`id` = c.`userId` WHERE c.`userId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan Event.typeId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan Event.typeId' WHERE EXISTS (SELECT 1 FROM `Event` c LEFT JOIN `EventType` p ON p.`id` = c.`typeId` WHERE c.`typeId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan Event.statusId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan Event.statusId' WHERE EXISTS (SELECT 1 FROM `Event` c LEFT JOIN `EventStatus` p ON p.`id` = c.`statusId` WHERE c.`statusId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan Event.descriptionWikiPageId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan Event.descriptionWikiPageId' WHERE EXISTS (SELECT 1 FROM `Event` c LEFT JOIN `WikiPage` p ON p.`id` = c.`descriptionWikiPageId` WHERE c.`descriptionWikiPageId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan Event.createdByUserId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan Event.createdByUserId' WHERE EXISTS (SELECT 1 FROM `Event` c LEFT JOIN `User` p ON p.`id` = c.`createdByUserId` WHERE c.`createdByUserId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan Event.updatedByUserId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan Event.updatedByUserId' WHERE EXISTS (SELECT 1 FROM `Event` c LEFT JOIN `User` p ON p.`id` = c.`updatedByUserId` WHERE c.`updatedByUserId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan Event.visiblePermissionId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan Event.visiblePermissionId' WHERE EXISTS (SELECT 1 FROM `Event` c LEFT JOIN `Permission` p ON p.`id` = c.`visiblePermissionId` WHERE c.`visiblePermissionId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan Event.expectedAttendanceUserTagId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan Event.expectedAttendanceUserTagId' WHERE EXISTS (SELECT 1 FROM `Event` c LEFT JOIN `UserTag` p ON p.`id` = c.`expectedAttendanceUserTagId` WHERE c.`expectedAttendanceUserTagId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan EventSegment.eventId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan EventSegment.eventId' WHERE EXISTS (SELECT 1 FROM `EventSegment` c LEFT JOIN `Event` p ON p.`id` = c.`eventId` WHERE c.`eventId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan EventSegment.statusId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan EventSegment.statusId' WHERE EXISTS (SELECT 1 FROM `EventSegment` c LEFT JOIN `EventStatus` p ON p.`id` = c.`statusId` WHERE c.`statusId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan EventTagAssignment.eventId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan EventTagAssignment.eventId' WHERE EXISTS (SELECT 1 FROM `EventTagAssignment` c LEFT JOIN `Event` p ON p.`id` = c.`eventId` WHERE c.`eventId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan EventTagAssignment.eventTagId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan EventTagAssignment.eventTagId' WHERE EXISTS (SELECT 1 FROM `EventTagAssignment` c LEFT JOIN `EventTag` p ON p.`id` = c.`eventTagId` WHERE c.`eventTagId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan EventSongList.eventId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan EventSongList.eventId' WHERE EXISTS (SELECT 1 FROM `EventSongList` c LEFT JOIN `Event` p ON p.`id` = c.`eventId` WHERE c.`eventId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan EventSongListSong.songId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan EventSongListSong.songId' WHERE EXISTS (SELECT 1 FROM `EventSongListSong` c LEFT JOIN `Song` p ON p.`id` = c.`songId` WHERE c.`songId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan EventSongListSong.eventSongListId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan EventSongListSong.eventSongListId' WHERE EXISTS (SELECT 1 FROM `EventSongListSong` c LEFT JOIN `EventSongList` p ON p.`id` = c.`eventSongListId` WHERE c.`eventSongListId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan EventSongListDivider.eventSongListId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan EventSongListDivider.eventSongListId' WHERE EXISTS (SELECT 1 FROM `EventSongListDivider` c LEFT JOIN `EventSongList` p ON p.`id` = c.`eventSongListId` WHERE c.`eventSongListId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan EventUserResponse.userId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan EventUserResponse.userId' WHERE EXISTS (SELECT 1 FROM `EventUserResponse` c LEFT JOIN `User` p ON p.`id` = c.`userId` WHERE c.`userId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan EventUserResponse.eventId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan EventUserResponse.eventId' WHERE EXISTS (SELECT 1 FROM `EventUserResponse` c LEFT JOIN `Event` p ON p.`id` = c.`eventId` WHERE c.`eventId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan EventUserResponse.instrumentId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan EventUserResponse.instrumentId' WHERE EXISTS (SELECT 1 FROM `EventUserResponse` c LEFT JOIN `Instrument` p ON p.`id` = c.`instrumentId` WHERE c.`instrumentId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan EventSegmentUserResponse.userId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan EventSegmentUserResponse.userId' WHERE EXISTS (SELECT 1 FROM `EventSegmentUserResponse` c LEFT JOIN `User` p ON p.`id` = c.`userId` WHERE c.`userId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan EventSegmentUserResponse.eventSegmentId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan EventSegmentUserResponse.eventSegmentId' WHERE EXISTS (SELECT 1 FROM `EventSegmentUserResponse` c LEFT JOIN `EventSegment` p ON p.`id` = c.`eventSegmentId` WHERE c.`eventSegmentId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan EventSegmentUserResponse.attendanceId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan EventSegmentUserResponse.attendanceId' WHERE EXISTS (SELECT 1 FROM `EventSegmentUserResponse` c LEFT JOIN `EventAttendance` p ON p.`id` = c.`attendanceId` WHERE c.`attendanceId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan EventSegmentUserResponse.createdByUserId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan EventSegmentUserResponse.createdByUserId' WHERE EXISTS (SELECT 1 FROM `EventSegmentUserResponse` c LEFT JOIN `User` p ON p.`id` = c.`createdByUserId` WHERE c.`createdByUserId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan EventSegmentUserResponse.updatedByUserId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan EventSegmentUserResponse.updatedByUserId' WHERE EXISTS (SELECT 1 FROM `EventSegmentUserResponse` c LEFT JOIN `User` p ON p.`id` = c.`updatedByUserId` WHERE c.`updatedByUserId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan FileTagAssignment.fileId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan FileTagAssignment.fileId' WHERE EXISTS (SELECT 1 FROM `FileTagAssignment` c LEFT JOIN `File` p ON p.`id` = c.`fileId` WHERE c.`fileId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan FileTagAssignment.fileTagId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan FileTagAssignment.fileTagId' WHERE EXISTS (SELECT 1 FROM `FileTagAssignment` c LEFT JOIN `FileTag` p ON p.`id` = c.`fileTagId` WHERE c.`fileTagId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan File.uploadedByUserId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan File.uploadedByUserId' WHERE EXISTS (SELECT 1 FROM `File` c LEFT JOIN `User` p ON p.`id` = c.`uploadedByUserId` WHERE c.`uploadedByUserId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan File.visiblePermissionId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan File.visiblePermissionId' WHERE EXISTS (SELECT 1 FROM `File` c LEFT JOIN `Permission` p ON p.`id` = c.`visiblePermissionId` WHERE c.`visiblePermissionId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan File.previewFileId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan File.previewFileId' WHERE EXISTS (SELECT 1 FROM `File` c LEFT JOIN `File` p ON p.`id` = c.`previewFileId` WHERE c.`previewFileId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan File.parentFileId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan File.parentFileId' WHERE EXISTS (SELECT 1 FROM `File` c LEFT JOIN `File` p ON p.`id` = c.`parentFileId` WHERE c.`parentFileId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan FileUserTag.fileId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan FileUserTag.fileId' WHERE EXISTS (SELECT 1 FROM `FileUserTag` c LEFT JOIN `File` p ON p.`id` = c.`fileId` WHERE c.`fileId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan FileUserTag.userId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan FileUserTag.userId' WHERE EXISTS (SELECT 1 FROM `FileUserTag` c LEFT JOIN `User` p ON p.`id` = c.`userId` WHERE c.`userId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan FileSongTag.fileId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan FileSongTag.fileId' WHERE EXISTS (SELECT 1 FROM `FileSongTag` c LEFT JOIN `File` p ON p.`id` = c.`fileId` WHERE c.`fileId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan FileSongTag.songId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan FileSongTag.songId' WHERE EXISTS (SELECT 1 FROM `FileSongTag` c LEFT JOIN `Song` p ON p.`id` = c.`songId` WHERE c.`songId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan FileEventTag.fileId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan FileEventTag.fileId' WHERE EXISTS (SELECT 1 FROM `FileEventTag` c LEFT JOIN `File` p ON p.`id` = c.`fileId` WHERE c.`fileId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan FileEventTag.eventId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan FileEventTag.eventId' WHERE EXISTS (SELECT 1 FROM `FileEventTag` c LEFT JOIN `Event` p ON p.`id` = c.`eventId` WHERE c.`eventId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan FileInstrumentTag.fileId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan FileInstrumentTag.fileId' WHERE EXISTS (SELECT 1 FROM `FileInstrumentTag` c LEFT JOIN `File` p ON p.`id` = c.`fileId` WHERE c.`fileId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan FileInstrumentTag.instrumentId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan FileInstrumentTag.instrumentId' WHERE EXISTS (SELECT 1 FROM `FileInstrumentTag` c LEFT JOIN `Instrument` p ON p.`id` = c.`instrumentId` WHERE c.`instrumentId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan FileWikiPageTag.fileId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan FileWikiPageTag.fileId' WHERE EXISTS (SELECT 1 FROM `FileWikiPageTag` c LEFT JOIN `File` p ON p.`id` = c.`fileId` WHERE c.`fileId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan FileWikiPageTag.wikiPageId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan FileWikiPageTag.wikiPageId' WHERE EXISTS (SELECT 1 FROM `FileWikiPageTag` c LEFT JOIN `WikiPage` p ON p.`id` = c.`wikiPageId` WHERE c.`wikiPageId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan FrontpageGalleryItem.fileId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan FrontpageGalleryItem.fileId' WHERE EXISTS (SELECT 1 FROM `FrontpageGalleryItem` c LEFT JOIN `File` p ON p.`id` = c.`fileId` WHERE c.`fileId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan FrontpageGalleryItem.createdByUserId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan FrontpageGalleryItem.createdByUserId' WHERE EXISTS (SELECT 1 FROM `FrontpageGalleryItem` c LEFT JOIN `User` p ON p.`id` = c.`createdByUserId` WHERE c.`createdByUserId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan FrontpageGalleryItem.visiblePermissionId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan FrontpageGalleryItem.visiblePermissionId' WHERE EXISTS (SELECT 1 FROM `FrontpageGalleryItem` c LEFT JOIN `Permission` p ON p.`id` = c.`visiblePermissionId` WHERE c.`visiblePermissionId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan CustomLink.fileId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan CustomLink.fileId' WHERE EXISTS (SELECT 1 FROM `CustomLink` c LEFT JOIN `File` p ON p.`id` = c.`fileId` WHERE c.`fileId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan CustomLink.createdByUserId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan CustomLink.createdByUserId' WHERE EXISTS (SELECT 1 FROM `CustomLink` c LEFT JOIN `User` p ON p.`id` = c.`createdByUserId` WHERE c.`createdByUserId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan CustomLinkVisit.customLinkId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan CustomLinkVisit.customLinkId' WHERE EXISTS (SELECT 1 FROM `CustomLinkVisit` c LEFT JOIN `CustomLink` p ON p.`id` = c.`customLinkId` WHERE c.`customLinkId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan WikiPage.currentRevisionId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan WikiPage.currentRevisionId' WHERE EXISTS (SELECT 1 FROM `WikiPage` c LEFT JOIN `WikiPageRevision` p ON p.`id` = c.`currentRevisionId` WHERE c.`currentRevisionId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan WikiPage.visiblePermissionId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan WikiPage.visiblePermissionId' WHERE EXISTS (SELECT 1 FROM `WikiPage` c LEFT JOIN `Permission` p ON p.`id` = c.`visiblePermissionId` WHERE c.`visiblePermissionId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan WikiPage.lockedByUserId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan WikiPage.lockedByUserId' WHERE EXISTS (SELECT 1 FROM `WikiPage` c LEFT JOIN `User` p ON p.`id` = c.`lockedByUserId` WHERE c.`lockedByUserId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan WikiPage.createdByUserId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan WikiPage.createdByUserId' WHERE EXISTS (SELECT 1 FROM `WikiPage` c LEFT JOIN `User` p ON p.`id` = c.`createdByUserId` WHERE c.`createdByUserId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan WikiPageRevision.wikiPageId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan WikiPageRevision.wikiPageId' WHERE EXISTS (SELECT 1 FROM `WikiPageRevision` c LEFT JOIN `WikiPage` p ON p.`id` = c.`wikiPageId` WHERE c.`wikiPageId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan WikiPageRevision.createdByUserId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan WikiPageRevision.createdByUserId' WHERE EXISTS (SELECT 1 FROM `WikiPageRevision` c LEFT JOIN `User` p ON p.`id` = c.`createdByUserId` WHERE c.`createdByUserId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan WikiPageTagAssignment.wikiPageId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan WikiPageTagAssignment.wikiPageId' WHERE EXISTS (SELECT 1 FROM `WikiPageTagAssignment` c LEFT JOIN `WikiPage` p ON p.`id` = c.`wikiPageId` WHERE c.`wikiPageId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan WikiPageTagAssignment.tagId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan WikiPageTagAssignment.tagId' WHERE EXISTS (SELECT 1 FROM `WikiPageTagAssignment` c LEFT JOIN `WikiPageTag` p ON p.`id` = c.`tagId` WHERE c.`tagId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan MenuLink.visiblePermissionId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan MenuLink.visiblePermissionId' WHERE EXISTS (SELECT 1 FROM `MenuLink` c LEFT JOIN `Permission` p ON p.`id` = c.`visiblePermissionId` WHERE c.`visiblePermissionId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan MenuLink.createdByUserId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan MenuLink.createdByUserId' WHERE EXISTS (SELECT 1 FROM `MenuLink` c LEFT JOIN `User` p ON p.`id` = c.`createdByUserId` WHERE c.`createdByUserId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan SetlistPlanGroup.createdByUserId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan SetlistPlanGroup.createdByUserId' WHERE EXISTS (SELECT 1 FROM `SetlistPlanGroup` c LEFT JOIN `User` p ON p.`id` = c.`createdByUserId` WHERE c.`createdByUserId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan SetlistPlan.groupId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan SetlistPlan.groupId' WHERE EXISTS (SELECT 1 FROM `SetlistPlan` c LEFT JOIN `SetlistPlanGroup` p ON p.`id` = c.`groupId` WHERE c.`groupId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan SetlistPlan.createdByUserId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan SetlistPlan.createdByUserId' WHERE EXISTS (SELECT 1 FROM `SetlistPlan` c LEFT JOIN `User` p ON p.`id` = c.`createdByUserId` WHERE c.`createdByUserId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: orphan SetlistPlan.visiblePermissionId');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: orphan SetlistPlan.visiblePermissionId' WHERE EXISTS (SELECT 1 FROM `SetlistPlan` c LEFT JOIN `Permission` p ON p.`id` = c.`visiblePermissionId` WHERE c.`visiblePermissionId` IS NOT NULL AND p.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in Role');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in Role' WHERE EXISTS (SELECT 1 FROM `Role` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in Role');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in Role' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:Role:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `Role`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in Permission');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in Permission' WHERE EXISTS (SELECT 1 FROM `Permission` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in Permission');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in Permission' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:Permission:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `Permission`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in RolePermission');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in RolePermission' WHERE EXISTS (SELECT 1 FROM `RolePermission` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in RolePermission');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in RolePermission' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:RolePermission:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `RolePermission`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in UserTag');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in UserTag' WHERE EXISTS (SELECT 1 FROM `UserTag` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in UserTag');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in UserTag' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:UserTag:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `UserTag`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in UserTagAssignment');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in UserTagAssignment' WHERE EXISTS (SELECT 1 FROM `UserTagAssignment` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in UserTagAssignment');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in UserTagAssignment' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:UserTagAssignment:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `UserTagAssignment`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in User');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in User' WHERE EXISTS (SELECT 1 FROM `User` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in User');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in User' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:User:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `User`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in UserSignInMethod');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in UserSignInMethod' WHERE EXISTS (SELECT 1 FROM `UserSignInMethod` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in UserSignInMethod');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in UserSignInMethod' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:UserSignInMethod:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `UserSignInMethod`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in Setting');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in Setting' WHERE EXISTS (SELECT 1 FROM `Setting` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in Setting');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in Setting' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:Setting:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `Setting`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in Song');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in Song' WHERE EXISTS (SELECT 1 FROM `Song` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in Song');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in Song' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:Song:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `Song`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in SongCreditType');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in SongCreditType' WHERE EXISTS (SELECT 1 FROM `SongCreditType` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in SongCreditType');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in SongCreditType' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:SongCreditType:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `SongCreditType`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in SongCredit');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in SongCredit' WHERE EXISTS (SELECT 1 FROM `SongCredit` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in SongCredit');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in SongCredit' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:SongCredit:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `SongCredit`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in SongTag');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in SongTag' WHERE EXISTS (SELECT 1 FROM `SongTag` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in SongTag');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in SongTag' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:SongTag:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `SongTag`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in SongTagAssociation');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in SongTagAssociation' WHERE EXISTS (SELECT 1 FROM `SongTagAssociation` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in SongTagAssociation');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in SongTagAssociation' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:SongTagAssociation:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `SongTagAssociation`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in InstrumentFunctionalGroup');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in InstrumentFunctionalGroup' WHERE EXISTS (SELECT 1 FROM `InstrumentFunctionalGroup` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in InstrumentFunctionalGroup');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in InstrumentFunctionalGroup' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:InstrumentFunctionalGroup:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `InstrumentFunctionalGroup`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in Instrument');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in Instrument' WHERE EXISTS (SELECT 1 FROM `Instrument` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in Instrument');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in Instrument' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:Instrument:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `Instrument`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in UserInstrument');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in UserInstrument' WHERE EXISTS (SELECT 1 FROM `UserInstrument` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in UserInstrument');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in UserInstrument' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:UserInstrument:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `UserInstrument`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in Event');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in Event' WHERE EXISTS (SELECT 1 FROM `Event` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in Event');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in Event' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:Event:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `Event`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in EventSegment');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in EventSegment' WHERE EXISTS (SELECT 1 FROM `EventSegment` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in EventSegment');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in EventSegment' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:EventSegment:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `EventSegment`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in EventType');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in EventType' WHERE EXISTS (SELECT 1 FROM `EventType` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in EventType');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in EventType' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:EventType:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `EventType`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in EventStatus');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in EventStatus' WHERE EXISTS (SELECT 1 FROM `EventStatus` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in EventStatus');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in EventStatus' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:EventStatus:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `EventStatus`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in EventTag');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in EventTag' WHERE EXISTS (SELECT 1 FROM `EventTag` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in EventTag');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in EventTag' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:EventTag:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `EventTag`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in EventTagAssignment');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in EventTagAssignment' WHERE EXISTS (SELECT 1 FROM `EventTagAssignment` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in EventTagAssignment');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in EventTagAssignment' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:EventTagAssignment:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `EventTagAssignment`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in EventSongList');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in EventSongList' WHERE EXISTS (SELECT 1 FROM `EventSongList` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in EventSongList');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in EventSongList' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:EventSongList:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `EventSongList`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in EventSongListSong');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in EventSongListSong' WHERE EXISTS (SELECT 1 FROM `EventSongListSong` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in EventSongListSong');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in EventSongListSong' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:EventSongListSong:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `EventSongListSong`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in EventSongListDivider');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in EventSongListDivider' WHERE EXISTS (SELECT 1 FROM `EventSongListDivider` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in EventSongListDivider');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in EventSongListDivider' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:EventSongListDivider:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `EventSongListDivider`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in EventAttendance');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in EventAttendance' WHERE EXISTS (SELECT 1 FROM `EventAttendance` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in EventAttendance');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in EventAttendance' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:EventAttendance:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `EventAttendance`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in EventUserResponse');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in EventUserResponse' WHERE EXISTS (SELECT 1 FROM `EventUserResponse` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in EventUserResponse');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in EventUserResponse' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:EventUserResponse:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `EventUserResponse`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in EventSegmentUserResponse');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in EventSegmentUserResponse' WHERE EXISTS (SELECT 1 FROM `EventSegmentUserResponse` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in EventSegmentUserResponse');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in EventSegmentUserResponse' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:EventSegmentUserResponse:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `EventSegmentUserResponse`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in FileTag');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in FileTag' WHERE EXISTS (SELECT 1 FROM `FileTag` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in FileTag');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in FileTag' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:FileTag:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `FileTag`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in FileTagAssignment');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in FileTagAssignment' WHERE EXISTS (SELECT 1 FROM `FileTagAssignment` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in FileTagAssignment');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in FileTagAssignment' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:FileTagAssignment:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `FileTagAssignment`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in File');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in File' WHERE EXISTS (SELECT 1 FROM `File` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in File');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in File' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:File:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `File`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in FileUserTag');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in FileUserTag' WHERE EXISTS (SELECT 1 FROM `FileUserTag` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in FileUserTag');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in FileUserTag' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:FileUserTag:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `FileUserTag`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in FileSongTag');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in FileSongTag' WHERE EXISTS (SELECT 1 FROM `FileSongTag` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in FileSongTag');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in FileSongTag' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:FileSongTag:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `FileSongTag`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in FileEventTag');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in FileEventTag' WHERE EXISTS (SELECT 1 FROM `FileEventTag` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in FileEventTag');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in FileEventTag' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:FileEventTag:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `FileEventTag`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in FileInstrumentTag');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in FileInstrumentTag' WHERE EXISTS (SELECT 1 FROM `FileInstrumentTag` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in FileInstrumentTag');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in FileInstrumentTag' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:FileInstrumentTag:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `FileInstrumentTag`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in FileWikiPageTag');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in FileWikiPageTag' WHERE EXISTS (SELECT 1 FROM `FileWikiPageTag` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in FileWikiPageTag');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in FileWikiPageTag' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:FileWikiPageTag:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `FileWikiPageTag`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in FrontpageGalleryItem');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in FrontpageGalleryItem' WHERE EXISTS (SELECT 1 FROM `FrontpageGalleryItem` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in FrontpageGalleryItem');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in FrontpageGalleryItem' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:FrontpageGalleryItem:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `FrontpageGalleryItem`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in CustomLink');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in CustomLink' WHERE EXISTS (SELECT 1 FROM `CustomLink` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in CustomLink');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in CustomLink' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:CustomLink:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `CustomLink`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in WikiPage');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in WikiPage' WHERE EXISTS (SELECT 1 FROM `WikiPage` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in WikiPage');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in WikiPage' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:WikiPage:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `WikiPage`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in WikiPageRevision');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in WikiPageRevision' WHERE EXISTS (SELECT 1 FROM `WikiPageRevision` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in WikiPageRevision');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in WikiPageRevision' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:WikiPageRevision:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `WikiPageRevision`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in WikiPageTag');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in WikiPageTag' WHERE EXISTS (SELECT 1 FROM `WikiPageTag` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in WikiPageTag');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in WikiPageTag' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:WikiPageTag:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `WikiPageTag`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in WikiPageTagAssignment');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in WikiPageTagAssignment' WHERE EXISTS (SELECT 1 FROM `WikiPageTagAssignment` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in WikiPageTagAssignment');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in WikiPageTagAssignment' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:WikiPageTagAssignment:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `WikiPageTagAssignment`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in MenuLink');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in MenuLink' WHERE EXISTS (SELECT 1 FROM `MenuLink` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in MenuLink');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in MenuLink' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:MenuLink:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `MenuLink`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in SetlistPlanGroup');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in SetlistPlanGroup' WHERE EXISTS (SELECT 1 FROM `SetlistPlanGroup` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in SetlistPlanGroup');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in SetlistPlanGroup' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:SetlistPlanGroup:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `SetlistPlanGroup`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: malformed public ID in SetlistPlan');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: malformed public ID in SetlistPlan' WHERE EXISTS (SELECT 1 FROM `SetlistPlan` WHERE NOT (CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^[A-Za-z0-9_-]{16}$' OR CONVERT(`publicId` USING utf8mb4) COLLATE utf8mb4_bin REGEXP '^~[0-9]{15}$'));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: public ID repair collision in SetlistPlan');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: public ID repair collision in SetlistPlan' WHERE EXISTS (SELECT BINARY repaired FROM (SELECT IF(LEFT(`publicId`, 1) = '~', LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:SetlistPlan:', `id`))))), '+', '-'), '/', '_'), 16), `publicId`) AS repaired FROM `SetlistPlan`) repaired_ids GROUP BY BINARY repaired HAVING COUNT(*) > 1);

CREATE TEMPORARY TABLE `_lsmb_plan_refs` (
  `planId` INT NOT NULL, `path` VARCHAR(191) NOT NULL,
  `entity` VARCHAR(16) NOT NULL, `oldId` INT NOT NULL,
  `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `uriPath` VARCHAR(191) NULL, `uri` MEDIUMTEXT NULL,
  PRIMARY KEY (`planId`, `path`)
);
INSERT INTO `_lsmb_plan_refs` (`planId`, `path`, `entity`, `oldId`)
SELECT p.`id`, CONCAT('$.rows[', j.`position` - 1, '].songId'), 'song', CAST(j.`oldId` AS SIGNED)
FROM `SetlistPlan` p JOIN JSON_TABLE(p.`payloadJson`, '$.rows[*]' COLUMNS (
  `position` FOR ORDINALITY, `oldId` VARCHAR(64) PATH '$.songId' NULL ON EMPTY
)) j WHERE JSON_TYPE(JSON_EXTRACT(p.`payloadJson`, CONCAT('$.rows[', j.`position` - 1, '].songId'))) = 'INTEGER';

INSERT INTO `_lsmb_plan_refs` (`planId`, `path`, `entity`, `oldId`, `uriPath`, `uri`)
SELECT p.`id`, CONCAT('$.columns[', j.`position` - 1, '].associatedItem.id'), j.`entity`, CAST(j.`oldId` AS SIGNED),
  CONCAT('$.columns[', j.`position` - 1, '].associatedItem.absoluteUri'), j.`uri`
FROM `SetlistPlan` p JOIN JSON_TABLE(p.`payloadJson`, '$.columns[*]' COLUMNS (
  `position` FOR ORDINALITY,
  `entity` VARCHAR(16) PATH '$.associatedItem.itemType' NULL ON EMPTY,
  `oldId` VARCHAR(64) PATH '$.associatedItem.id' NULL ON EMPTY,
  `uri` MEDIUMTEXT PATH '$.associatedItem.absoluteUri' NULL ON EMPTY
)) j WHERE j.`entity` IN ('event', 'song', 'user', 'wikiPage')
  AND JSON_TYPE(JSON_EXTRACT(p.`payloadJson`, CONCAT('$.columns[', j.`position` - 1, '].associatedItem.id'))) = 'INTEGER';

INSERT INTO `_lsmb_plan_refs` (`planId`, `path`, `entity`, `oldId`, `uriPath`, `uri`)
SELECT p.`id`, CONCAT('$.columnLeds[', j.`position` - 1, '].associatedItem.id'), j.`entity`, CAST(j.`oldId` AS SIGNED),
  CONCAT('$.columnLeds[', j.`position` - 1, '].associatedItem.absoluteUri'), j.`uri`
FROM `SetlistPlan` p JOIN JSON_TABLE(p.`payloadJson`, '$.columnLeds[*]' COLUMNS (
  `position` FOR ORDINALITY,
  `entity` VARCHAR(16) PATH '$.associatedItem.itemType' NULL ON EMPTY,
  `oldId` VARCHAR(64) PATH '$.associatedItem.id' NULL ON EMPTY,
  `uri` MEDIUMTEXT PATH '$.associatedItem.absoluteUri' NULL ON EMPTY
)) j WHERE j.`entity` IN ('event', 'song', 'user', 'wikiPage')
  AND JSON_TYPE(JSON_EXTRACT(p.`payloadJson`, CONCAT('$.columnLeds[', j.`position` - 1, '].associatedItem.id'))) = 'INTEGER';

INSERT INTO `_lsmb_plan_refs` (`planId`, `path`, `entity`, `oldId`, `uriPath`, `uri`)
SELECT p.`id`, CONCAT('$.rowLeds[', j.`position` - 1, '].associatedItem.id'), j.`entity`, CAST(j.`oldId` AS SIGNED),
  CONCAT('$.rowLeds[', j.`position` - 1, '].associatedItem.absoluteUri'), j.`uri`
FROM `SetlistPlan` p JOIN JSON_TABLE(p.`payloadJson`, '$.rowLeds[*]' COLUMNS (
  `position` FOR ORDINALITY,
  `entity` VARCHAR(16) PATH '$.associatedItem.itemType' NULL ON EMPTY,
  `oldId` VARCHAR(64) PATH '$.associatedItem.id' NULL ON EMPTY,
  `uri` MEDIUMTEXT PATH '$.associatedItem.absoluteUri' NULL ON EMPTY
)) j WHERE j.`entity` IN ('event', 'song', 'user', 'wikiPage')
  AND JSON_TYPE(JSON_EXTRACT(p.`payloadJson`, CONCAT('$.rowLeds[', j.`position` - 1, '].associatedItem.id'))) = 'INTEGER';

INSERT INTO `_lsmb_assert` VALUES ('lsmb: dangling serialized event reference');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: dangling serialized event reference' WHERE EXISTS (SELECT 1 FROM `_lsmb_plan_refs` r LEFT JOIN `Event` t ON t.`id` = r.`oldId` WHERE r.`entity` = 'event' AND t.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: dangling serialized song reference');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: dangling serialized song reference' WHERE EXISTS (SELECT 1 FROM `_lsmb_plan_refs` r LEFT JOIN `Song` t ON t.`id` = r.`oldId` WHERE r.`entity` = 'song' AND t.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: dangling serialized user reference');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: dangling serialized user reference' WHERE EXISTS (SELECT 1 FROM `_lsmb_plan_refs` r LEFT JOIN `User` t ON t.`id` = r.`oldId` WHERE r.`entity` = 'user' AND t.`id` IS NULL);

INSERT INTO `_lsmb_assert` VALUES ('lsmb: dangling serialized wikiPage reference');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: dangling serialized wikiPage reference' WHERE EXISTS (SELECT 1 FROM `_lsmb_plan_refs` r LEFT JOIN `WikiPage` t ON t.`id` = r.`oldId` WHERE r.`entity` = 'wikiPage' AND t.`id` IS NULL);

-- Create the new tables without foreign keys until their data has been populated.

CREATE TABLE `Locale` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `nameId` INTEGER NOT NULL,
    `langCode` VARCHAR(8) NOT NULL,
    `regionCode` VARCHAR(8) NOT NULL,
    `ietfTag` VARCHAR(16) NOT NULL,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdByUserId` INTEGER NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedByUserId` INTEGER NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `Locale_publicId_key`(`publicId`),
    UNIQUE INDEX `Locale_ietfTag_key`(`ietfTag`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `StaticLocalizedStringValue` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `stringKey` VARCHAR(191) NOT NULL,
    `localeId` INTEGER NOT NULL,
    `indexedValue` VARCHAR(768) NULL,
    `blobValue` MEDIUMTEXT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedByUserId` INTEGER NULL,

    UNIQUE INDEX `StaticLocalizedStringValue_publicId_key`(`publicId`),
    INDEX `StaticLocalizedStringValue_indexedValue_idx`(`indexedValue`),
    UNIQUE INDEX `StaticLocalizedStringValue_stringKey_localeId_key`(`stringKey`, `localeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DynamicLocalizedString` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `format` ENUM('PlainText', 'Markdown') NOT NULL DEFAULT 'PlainText',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DynamicLocalizedString_publicId_key`(`publicId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DynamicLocalizedStringValue` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `localeId` INTEGER NOT NULL,
    `indexedValue` VARCHAR(768) NULL,
    `blobValue` MEDIUMTEXT NULL,
    `stringId` INTEGER NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedByUserId` INTEGER NULL,

    UNIQUE INDEX `DynamicLocalizedStringValue_publicId_key`(`publicId`),
    INDEX `DynamicLocalizedStringValue_indexedValue_idx`(`indexedValue`),
    UNIQUE INDEX `DynamicLocalizedStringValue_localeId_stringId_key`(`localeId`, `stringId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Band` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `nameId` INTEGER NOT NULL,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdByUserId` INTEGER NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedByUserId` INTEGER NULL,

    UNIQUE INDEX `Band_publicId_key`(`publicId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BandLocale` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bandId` INTEGER NOT NULL,
    `localeId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdByUserId` INTEGER NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedByUserId` INTEGER NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `BandLocale_bandId_localeId_key`(`bandId`, `localeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BandStaticLocalizedStringValue` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `bandId` INTEGER NOT NULL,
    `localeId` INTEGER NOT NULL,
    `stringKey` VARCHAR(191) NOT NULL,
    `indexedValue` VARCHAR(768) NULL,
    `blobValue` MEDIUMTEXT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedByUserId` INTEGER NULL,

    UNIQUE INDEX `BandStaticLocalizedStringValue_publicId_key`(`publicId`),
    INDEX `BandStaticLocalizedStringValue_indexedValue_idx`(`indexedValue`),
    UNIQUE INDEX `BandStaticLocalizedStringValue_stringKey_localeId_bandId_key`(`stringKey`, `localeId`, `bandId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BandDynamicLocalizedStringValue` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `bandId` INTEGER NOT NULL,
    `localeId` INTEGER NOT NULL,
    `stringId` INTEGER NOT NULL,
    `indexedValue` VARCHAR(768) NULL,
    `blobValue` MEDIUMTEXT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedByUserId` INTEGER NULL,

    UNIQUE INDEX `BandDynamicLocalizedStringValue_publicId_key`(`publicId`),
    INDEX `BandDynamicLocalizedStringValue_indexedValue_idx`(`indexedValue`),
    UNIQUE INDEX `BandDynamicLocalizedStringValue_stringId_localeId_bandId_key`(`stringId`, `localeId`, `bandId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BandRole` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `nameId` INTEGER NOT NULL,
    `descriptionId` INTEGER NULL,
    `isRoleForNewUsers` BOOLEAN NOT NULL DEFAULT false,
    `isPublicRole` BOOLEAN NOT NULL DEFAULT false,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `color` VARCHAR(768) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BandRole_publicId_key`(`publicId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BandRolePermission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `permissionId` INTEGER NOT NULL,
    `bandRoleId` INTEGER NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedByUserId` INTEGER NULL,

    UNIQUE INDEX `BandRolePermission_publicId_key`(`publicId`),
    UNIQUE INDEX `BandRolePermission_bandRoleId_permissionId_key`(`bandRoleId`, `permissionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BandUserTag` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `isHidden` BOOLEAN NOT NULL DEFAULT false,
    `nameId` INTEGER NULL,
    `descriptionId` INTEGER NULL,
    `globalUserTagId` INTEGER NULL,
    `color` VARCHAR(191) NULL,
    `significance` VARCHAR(191) NULL,
    `sortOrder` INTEGER NULL,
    `cssClass` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `bandId` INTEGER NOT NULL,

    UNIQUE INDEX `BandUserTag_publicId_key`(`publicId`),
    INDEX `BandUserTag_bandId_idx`(`bandId`),
    UNIQUE INDEX `BandUserTag_bandId_globalUserTagId_key`(`bandId`, `globalUserTagId`),
    UNIQUE INDEX `BandUserTag_id_bandId_key`(`id`, `bandId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BandUser` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `userId` INTEGER NOT NULL,
    `bandId` INTEGER NOT NULL,
    `bandRoleId` INTEGER NULL,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdByUserId` INTEGER NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedByUserId` INTEGER NULL,

    UNIQUE INDEX `BandUser_publicId_key`(`publicId`),
    UNIQUE INDEX `BandUser_bandId_userId_key`(`bandId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BandSetting` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `bandId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `value` MEDIUMTEXT NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedByUserId` INTEGER NULL,

    UNIQUE INDEX `BandSetting_publicId_key`(`publicId`),
    INDEX `BandSetting_name_idx`(`name`),
    UNIQUE INDEX `BandSetting_bandId_name_key`(`bandId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BandUserSetting` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bandUserId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `value` JSON NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedByUserId` INTEGER NULL,

    UNIQUE INDEX `BandUserSetting_bandUserId_name_key`(`bandUserId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BandSongTag` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `color` VARCHAR(191) NULL,
    `isHidden` BOOLEAN NOT NULL DEFAULT false,
    `globalSongTagId` INTEGER NULL,
    `nameId` INTEGER NULL,
    `descriptionId` INTEGER NULL,
    `sortOrder` INTEGER NULL,
    `group` VARCHAR(768) NULL,
    `indicator` VARCHAR(191) NULL,
    `indicatorCssClass` VARCHAR(191) NULL,
    `bandId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BandSongTag_publicId_key`(`publicId`),
    INDEX `BandSongTag_sortOrder_idx`(`sortOrder`),
    INDEX `BandSongTag_bandId_idx`(`bandId`),
    UNIQUE INDEX `BandSongTag_bandId_globalSongTagId_key`(`bandId`, `globalSongTagId`),
    UNIQUE INDEX `BandSongTag_id_bandId_key`(`id`, `bandId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BandInstrumentFunctionalGroup` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `sortOrder` INTEGER NULL,
    `color` VARCHAR(191) NULL,
    `isHidden` BOOLEAN NOT NULL DEFAULT false,
    `nameId` INTEGER NULL,
    `descriptionId` INTEGER NULL,
    `bandId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `globalFunctionalGroupId` INTEGER NULL,

    UNIQUE INDEX `BandInstrumentFunctionalGroup_publicId_key`(`publicId`),
    INDEX `BandInstrumentFunctionalGroup_sortOrder_idx`(`sortOrder`),
    INDEX `BandInstrumentFunctionalGroup_bandId_idx`(`bandId`),
    UNIQUE INDEX `BandInstrumentFunctionalGroup_bandId_globalFunctionalGroupId_key`(`bandId`, `globalFunctionalGroupId`),
    UNIQUE INDEX `BandInstrumentFunctionalGroup_id_bandId_key`(`id`, `bandId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BandInstrument` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `sortOrder` INTEGER NULL,
    `isHidden` BOOLEAN NOT NULL DEFAULT false,
    `nameId` INTEGER NULL,
    `descriptionId` INTEGER NULL,
    `bandId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `globalInstrumentId` INTEGER NULL,
    `functionalGroupId` INTEGER NOT NULL,
    `autoAssignFileLeafRegex` VARCHAR(768) NULL,

    UNIQUE INDEX `BandInstrument_publicId_key`(`publicId`),
    INDEX `BandInstrument_sortOrder_idx`(`sortOrder`),
    INDEX `BandInstrument_bandId_idx`(`bandId`),
    UNIQUE INDEX `BandInstrument_bandId_globalInstrumentId_key`(`bandId`, `globalInstrumentId`),
    UNIQUE INDEX `BandInstrument_id_bandId_key`(`id`, `bandId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BandEventTag` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `color` VARCHAR(191) NULL,
    `sortOrder` INTEGER NULL,
    `isHidden` BOOLEAN NOT NULL DEFAULT false,
    `globalEventTagId` INTEGER NULL,
    `nameId` INTEGER NULL,
    `descriptionId` INTEGER NULL,
    `bandId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BandEventTag_publicId_key`(`publicId`),
    INDEX `BandEventTag_bandId_idx`(`bandId`),
    UNIQUE INDEX `BandEventTag_bandId_globalEventTagId_key`(`bandId`, `globalEventTagId`),
    UNIQUE INDEX `BandEventTag_id_bandId_key`(`id`, `bandId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BandFileTag` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `isHidden` BOOLEAN NOT NULL DEFAULT false,
    `globalFileTagId` INTEGER NULL,
    `nameId` INTEGER NULL,
    `descriptionId` INTEGER NULL,
    `color` VARCHAR(191) NULL,
    `sortOrder` INTEGER NULL,
    `bandId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BandFileTag_publicId_key`(`publicId`),
    INDEX `BandFileTag_sortOrder_idx`(`sortOrder`),
    INDEX `BandFileTag_bandId_idx`(`bandId`),
    UNIQUE INDEX `BandFileTag_bandId_globalFileTagId_key`(`bandId`, `globalFileTagId`),
    UNIQUE INDEX `BandFileTag_id_bandId_key`(`id`, `bandId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BandWikiPageTag` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `globalWikiPageTagId` INTEGER NULL,
    `nameId` INTEGER NULL,
    `descriptionId` INTEGER NULL,
    `color` VARCHAR(191) NULL,
    `sortOrder` INTEGER NULL,
    `isHidden` BOOLEAN NOT NULL DEFAULT false,
    `bandId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BandWikiPageTag_publicId_key`(`publicId`),
    INDEX `BandWikiPageTag_sortOrder_idx`(`sortOrder`),
    INDEX `BandWikiPageTag_bandId_idx`(`bandId`),
    UNIQUE INDEX `BandWikiPageTag_bandId_globalWikiPageTagId_key`(`bandId`, `globalWikiPageTagId`),
    UNIQUE INDEX `BandWikiPageTag_id_bandId_key`(`id`, `bandId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Repair deployment placeholders before preserving identities and serialized references.

UPDATE `Role` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:Role:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `Permission` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:Permission:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `RolePermission` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:RolePermission:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `UserTag` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:UserTag:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `UserTagAssignment` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:UserTagAssignment:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `User` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:User:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `UserSignInMethod` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:UserSignInMethod:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `Setting` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:Setting:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `Song` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:Song:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `SongCreditType` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:SongCreditType:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `SongCredit` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:SongCredit:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `SongTag` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:SongTag:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `SongTagAssociation` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:SongTagAssociation:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `InstrumentFunctionalGroup` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:InstrumentFunctionalGroup:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `Instrument` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:Instrument:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `UserInstrument` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:UserInstrument:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `Event` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:Event:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `EventSegment` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:EventSegment:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `EventType` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:EventType:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `EventStatus` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:EventStatus:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `EventTag` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:EventTag:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `EventTagAssignment` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:EventTagAssignment:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `EventSongList` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:EventSongList:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `EventSongListSong` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:EventSongListSong:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `EventSongListDivider` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:EventSongListDivider:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `EventAttendance` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:EventAttendance:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `EventUserResponse` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:EventUserResponse:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `EventSegmentUserResponse` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:EventSegmentUserResponse:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `FileTag` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:FileTag:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `FileTagAssignment` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:FileTagAssignment:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `File` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:File:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `FileUserTag` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:FileUserTag:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `FileSongTag` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:FileSongTag:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `FileEventTag` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:FileEventTag:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `FileInstrumentTag` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:FileInstrumentTag:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `FileWikiPageTag` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:FileWikiPageTag:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `FrontpageGalleryItem` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:FrontpageGalleryItem:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `CustomLink` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:CustomLink:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `WikiPage` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:WikiPage:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `WikiPageRevision` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:WikiPageRevision:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `WikiPageTag` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:WikiPageTag:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `WikiPageTagAssignment` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:WikiPageTagAssignment:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `MenuLink` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:MenuLink:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `SetlistPlanGroup` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:SetlistPlanGroup:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

UPDATE `SetlistPlan` SET `publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:SetlistPlan:', `id`))))), '+', '-'), '/', '_'), 16) WHERE LEFT(`publicId`, 1) = '~';

CREATE TEMPORARY TABLE `_lsmb_identities` (
  `tableName` VARCHAR(64) NOT NULL, `id` INT NOT NULL,
  `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY (`tableName`, `id`)
);

INSERT INTO `_lsmb_identities` SELECT 'Role', `id`, `publicId` FROM `Role`;

INSERT INTO `_lsmb_identities` SELECT 'Permission', `id`, `publicId` FROM `Permission`;

INSERT INTO `_lsmb_identities` SELECT 'RolePermission', `id`, `publicId` FROM `RolePermission`;

INSERT INTO `_lsmb_identities` SELECT 'UserTag', `id`, `publicId` FROM `UserTag`;

INSERT INTO `_lsmb_identities` SELECT 'UserTagAssignment', `id`, `publicId` FROM `UserTagAssignment`;

INSERT INTO `_lsmb_identities` SELECT 'User', `id`, `publicId` FROM `User`;

INSERT INTO `_lsmb_identities` SELECT 'UserSignInMethod', `id`, `publicId` FROM `UserSignInMethod`;

INSERT INTO `_lsmb_identities` SELECT 'Setting', `id`, `publicId` FROM `Setting`;

INSERT INTO `_lsmb_identities` SELECT 'Song', `id`, `publicId` FROM `Song`;

INSERT INTO `_lsmb_identities` SELECT 'SongCreditType', `id`, `publicId` FROM `SongCreditType`;

INSERT INTO `_lsmb_identities` SELECT 'SongCredit', `id`, `publicId` FROM `SongCredit`;

INSERT INTO `_lsmb_identities` SELECT 'SongTag', `id`, `publicId` FROM `SongTag`;

INSERT INTO `_lsmb_identities` SELECT 'SongTagAssociation', `id`, `publicId` FROM `SongTagAssociation`;

INSERT INTO `_lsmb_identities` SELECT 'InstrumentFunctionalGroup', `id`, `publicId` FROM `InstrumentFunctionalGroup`;

INSERT INTO `_lsmb_identities` SELECT 'Instrument', `id`, `publicId` FROM `Instrument`;

INSERT INTO `_lsmb_identities` SELECT 'UserInstrument', `id`, `publicId` FROM `UserInstrument`;

INSERT INTO `_lsmb_identities` SELECT 'Event', `id`, `publicId` FROM `Event`;

INSERT INTO `_lsmb_identities` SELECT 'EventSegment', `id`, `publicId` FROM `EventSegment`;

INSERT INTO `_lsmb_identities` SELECT 'EventType', `id`, `publicId` FROM `EventType`;

INSERT INTO `_lsmb_identities` SELECT 'EventStatus', `id`, `publicId` FROM `EventStatus`;

INSERT INTO `_lsmb_identities` SELECT 'EventTag', `id`, `publicId` FROM `EventTag`;

INSERT INTO `_lsmb_identities` SELECT 'EventTagAssignment', `id`, `publicId` FROM `EventTagAssignment`;

INSERT INTO `_lsmb_identities` SELECT 'EventSongList', `id`, `publicId` FROM `EventSongList`;

INSERT INTO `_lsmb_identities` SELECT 'EventSongListSong', `id`, `publicId` FROM `EventSongListSong`;

INSERT INTO `_lsmb_identities` SELECT 'EventSongListDivider', `id`, `publicId` FROM `EventSongListDivider`;

INSERT INTO `_lsmb_identities` SELECT 'EventAttendance', `id`, `publicId` FROM `EventAttendance`;

INSERT INTO `_lsmb_identities` SELECT 'EventUserResponse', `id`, `publicId` FROM `EventUserResponse`;

INSERT INTO `_lsmb_identities` SELECT 'EventSegmentUserResponse', `id`, `publicId` FROM `EventSegmentUserResponse`;

INSERT INTO `_lsmb_identities` SELECT 'FileTag', `id`, `publicId` FROM `FileTag`;

INSERT INTO `_lsmb_identities` SELECT 'FileTagAssignment', `id`, `publicId` FROM `FileTagAssignment`;

INSERT INTO `_lsmb_identities` SELECT 'File', `id`, `publicId` FROM `File`;

INSERT INTO `_lsmb_identities` SELECT 'FileUserTag', `id`, `publicId` FROM `FileUserTag`;

INSERT INTO `_lsmb_identities` SELECT 'FileSongTag', `id`, `publicId` FROM `FileSongTag`;

INSERT INTO `_lsmb_identities` SELECT 'FileEventTag', `id`, `publicId` FROM `FileEventTag`;

INSERT INTO `_lsmb_identities` SELECT 'FileInstrumentTag', `id`, `publicId` FROM `FileInstrumentTag`;

INSERT INTO `_lsmb_identities` SELECT 'FileWikiPageTag', `id`, `publicId` FROM `FileWikiPageTag`;

INSERT INTO `_lsmb_identities` SELECT 'FrontpageGalleryItem', `id`, `publicId` FROM `FrontpageGalleryItem`;

INSERT INTO `_lsmb_identities` SELECT 'CustomLink', `id`, `publicId` FROM `CustomLink`;

INSERT INTO `_lsmb_identities` SELECT 'WikiPage', `id`, `publicId` FROM `WikiPage`;

INSERT INTO `_lsmb_identities` SELECT 'WikiPageRevision', `id`, `publicId` FROM `WikiPageRevision`;

INSERT INTO `_lsmb_identities` SELECT 'WikiPageTag', `id`, `publicId` FROM `WikiPageTag`;

INSERT INTO `_lsmb_identities` SELECT 'WikiPageTagAssignment', `id`, `publicId` FROM `WikiPageTagAssignment`;

INSERT INTO `_lsmb_identities` SELECT 'MenuLink', `id`, `publicId` FROM `MenuLink`;

INSERT INTO `_lsmb_identities` SELECT 'SetlistPlanGroup', `id`, `publicId` FROM `SetlistPlanGroup`;

INSERT INTO `_lsmb_identities` SELECT 'SetlistPlan', `id`, `publicId` FROM `SetlistPlan`;

-- Upgrade only numeric serialized IDs. Already upgraded payload bytes remain unchanged.

UPDATE `_lsmb_plan_refs` r JOIN `Event` t ON t.`id` = r.`oldId` SET r.`publicId` = t.`publicId` WHERE r.`entity` = 'event';

UPDATE `_lsmb_plan_refs` r JOIN `Song` t ON t.`id` = r.`oldId` SET r.`publicId` = t.`publicId` WHERE r.`entity` = 'song';

UPDATE `_lsmb_plan_refs` r JOIN `User` t ON t.`id` = r.`oldId` SET r.`publicId` = t.`publicId` WHERE r.`entity` = 'user';

UPDATE `_lsmb_plan_refs` r JOIN `WikiPage` t ON t.`id` = r.`oldId` SET r.`publicId` = t.`publicId` WHERE r.`entity` = 'wikiPage';

CREATE PROCEDURE `_lsmb_upgrade_plan_refs`()
BEGIN
  DECLARE finished BOOLEAN DEFAULT FALSE;
  DECLARE plan_id INT;
  DECLARE json_path VARCHAR(191);
  DECLARE new_id CHAR(16);
  DECLARE uri_path VARCHAR(191);
  DECLARE old_uri MEDIUMTEXT;
  DECLARE entity_type VARCHAR(16);
  DECLARE old_id INT;
  DECLARE refs CURSOR FOR SELECT `planId`, `path`, `publicId`, `uriPath`, `uri`, `entity`, `oldId` FROM `_lsmb_plan_refs` ORDER BY `planId`, `path`;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET finished = TRUE;
  OPEN refs;
  reference_loop: LOOP
    FETCH refs INTO plan_id, json_path, new_id, uri_path, old_uri, entity_type, old_id;
    IF finished THEN LEAVE reference_loop; END IF;
    UPDATE `SetlistPlan` SET `payloadJson` = JSON_SET(`payloadJson`, json_path, new_id) WHERE `id` = plan_id;
    IF old_uri IS NOT NULL THEN
      UPDATE `SetlistPlan` SET `payloadJson` = JSON_SET(`payloadJson`, uri_path,
        REGEXP_REPLACE(old_uri, CONCAT('/backstage/', IF(entity_type = 'wikiPage', 'wiki', entity_type), '/', old_id, '(?=/|$)'),
          CONCAT('/backstage/', IF(entity_type = 'wikiPage', 'wiki', entity_type), '/', new_id))) WHERE `id` = plan_id;
    END IF;
  END LOOP;
  CLOSE refs;
END;
CALL `_lsmb_upgrade_plan_refs`();
DROP PROCEDURE `_lsmb_upgrade_plan_refs`;
-- Older public-ID startup also renamed only event-description wiki paths.
UPDATE `WikiPage` p JOIN `Event` e ON e.`descriptionWikiPageId` = p.`id`
SET p.`slug` = CONCAT('EventDescription/', e.`publicId`)
WHERE BINARY p.`slug` = BINARY CONCAT('EventDescription/', e.`id`);

-- Disconnect the old foreign keys, then rename tables and scalar foreign-key columns.

ALTER TABLE `RolePermission` DROP FOREIGN KEY `RolePermission_roleId_fkey`;

ALTER TABLE `RolePermission` DROP FOREIGN KEY `RolePermission_permissionId_fkey`;

ALTER TABLE `Action` DROP FOREIGN KEY `Action_userId_fkey`;

ALTER TABLE `Action` DROP FOREIGN KEY `Action_fileId_fkey`;

ALTER TABLE `Action` DROP FOREIGN KEY `Action_eventId_fkey`;

ALTER TABLE `Action` DROP FOREIGN KEY `Action_songId_fkey`;

ALTER TABLE `Action` DROP FOREIGN KEY `Action_wikiPageId_fkey`;

ALTER TABLE `Action` DROP FOREIGN KEY `Action_eventSegmentId_fkey`;

ALTER TABLE `Action` DROP FOREIGN KEY `Action_attendanceId_fkey`;

ALTER TABLE `Action` DROP FOREIGN KEY `Action_customLinkId_fkey`;

ALTER TABLE `Action` DROP FOREIGN KEY `Action_eventSongListId_fkey`;

ALTER TABLE `Action` DROP FOREIGN KEY `Action_frontpageGalleryItemId_fkey`;

ALTER TABLE `Action` DROP FOREIGN KEY `Action_menuLinkId_fkey`;

ALTER TABLE `Action` DROP FOREIGN KEY `Action_setlistPlanId_fkey`;

ALTER TABLE `Action` DROP FOREIGN KEY `Action_songCreditTypeId_fkey`;

ALTER TABLE `Action` DROP FOREIGN KEY `Action_instrumentId_fkey`;

ALTER TABLE `UserTagAssignment` DROP FOREIGN KEY `UserTagAssignment_userId_fkey`;

ALTER TABLE `UserTagAssignment` DROP FOREIGN KEY `UserTagAssignment_userTagId_fkey`;

ALTER TABLE `User` DROP FOREIGN KEY `User_mergedIntoUserId_fkey`;

ALTER TABLE `User` DROP FOREIGN KEY `User_roleId_fkey`;

ALTER TABLE `UserSignInMethod` DROP FOREIGN KEY `UserSignInMethod_userId_fkey`;

ALTER TABLE `UserSetting` DROP FOREIGN KEY `UserSetting_userId_fkey`;

ALTER TABLE `Change` DROP FOREIGN KEY `Change_userId_fkey`;

ALTER TABLE `Session` DROP FOREIGN KEY `Session_userId_fkey`;

ALTER TABLE `Token` DROP FOREIGN KEY `Token_userId_fkey`;

ALTER TABLE `Song` DROP FOREIGN KEY `Song_createdByUserId_fkey`;

ALTER TABLE `Song` DROP FOREIGN KEY `Song_visiblePermissionId_fkey`;

ALTER TABLE `Song` DROP FOREIGN KEY `Song_pinnedRecordingId_fkey`;

ALTER TABLE `SongCredit` DROP FOREIGN KEY `SongCredit_userId_fkey`;

ALTER TABLE `SongCredit` DROP FOREIGN KEY `SongCredit_songId_fkey`;

ALTER TABLE `SongCredit` DROP FOREIGN KEY `SongCredit_typeId_fkey`;

ALTER TABLE `SongTagAssociation` DROP FOREIGN KEY `SongTagAssociation_songId_fkey`;

ALTER TABLE `SongTagAssociation` DROP FOREIGN KEY `SongTagAssociation_tagId_fkey`;

ALTER TABLE `Instrument` DROP FOREIGN KEY `Instrument_functionalGroupId_fkey`;

ALTER TABLE `UserInstrument` DROP FOREIGN KEY `UserInstrument_instrumentId_fkey`;

ALTER TABLE `UserInstrument` DROP FOREIGN KEY `UserInstrument_userId_fkey`;

ALTER TABLE `Event` DROP FOREIGN KEY `Event_typeId_fkey`;

ALTER TABLE `Event` DROP FOREIGN KEY `Event_statusId_fkey`;

ALTER TABLE `Event` DROP FOREIGN KEY `Event_descriptionWikiPageId_fkey`;

ALTER TABLE `Event` DROP FOREIGN KEY `Event_createdByUserId_fkey`;

ALTER TABLE `Event` DROP FOREIGN KEY `Event_updatedByUserId_fkey`;

ALTER TABLE `Event` DROP FOREIGN KEY `Event_visiblePermissionId_fkey`;

ALTER TABLE `Event` DROP FOREIGN KEY `Event_expectedAttendanceUserTagId_fkey`;

ALTER TABLE `EventSegment` DROP FOREIGN KEY `EventSegment_eventId_fkey`;

ALTER TABLE `EventSegment` DROP FOREIGN KEY `EventSegment_statusId_fkey`;

ALTER TABLE `EventTagAssignment` DROP FOREIGN KEY `EventTagAssignment_eventId_fkey`;

ALTER TABLE `EventTagAssignment` DROP FOREIGN KEY `EventTagAssignment_eventTagId_fkey`;

ALTER TABLE `EventSongList` DROP FOREIGN KEY `EventSongList_eventId_fkey`;

ALTER TABLE `EventSongListSong` DROP FOREIGN KEY `EventSongListSong_songId_fkey`;

ALTER TABLE `EventSongListSong` DROP FOREIGN KEY `EventSongListSong_eventSongListId_fkey`;

ALTER TABLE `EventSongListDivider` DROP FOREIGN KEY `EventSongListDivider_eventSongListId_fkey`;

ALTER TABLE `EventUserResponse` DROP FOREIGN KEY `EventUserResponse_userId_fkey`;

ALTER TABLE `EventUserResponse` DROP FOREIGN KEY `EventUserResponse_eventId_fkey`;

ALTER TABLE `EventUserResponse` DROP FOREIGN KEY `EventUserResponse_instrumentId_fkey`;

ALTER TABLE `EventSegmentUserResponse` DROP FOREIGN KEY `EventSegmentUserResponse_userId_fkey`;

ALTER TABLE `EventSegmentUserResponse` DROP FOREIGN KEY `EventSegmentUserResponse_eventSegmentId_fkey`;

ALTER TABLE `EventSegmentUserResponse` DROP FOREIGN KEY `EventSegmentUserResponse_attendanceId_fkey`;

ALTER TABLE `EventSegmentUserResponse` DROP FOREIGN KEY `EventSegmentUserResponse_createdByUserId_fkey`;

ALTER TABLE `EventSegmentUserResponse` DROP FOREIGN KEY `EventSegmentUserResponse_updatedByUserId_fkey`;

ALTER TABLE `FileTagAssignment` DROP FOREIGN KEY `FileTagAssignment_fileId_fkey`;

ALTER TABLE `FileTagAssignment` DROP FOREIGN KEY `FileTagAssignment_fileTagId_fkey`;

ALTER TABLE `File` DROP FOREIGN KEY `File_uploadedByUserId_fkey`;

ALTER TABLE `File` DROP FOREIGN KEY `File_visiblePermissionId_fkey`;

ALTER TABLE `File` DROP FOREIGN KEY `File_previewFileId_fkey`;

ALTER TABLE `File` DROP FOREIGN KEY `File_parentFileId_fkey`;

ALTER TABLE `FileUserTag` DROP FOREIGN KEY `FileUserTag_fileId_fkey`;

ALTER TABLE `FileUserTag` DROP FOREIGN KEY `FileUserTag_userId_fkey`;

ALTER TABLE `FileSongTag` DROP FOREIGN KEY `FileSongTag_fileId_fkey`;

ALTER TABLE `FileSongTag` DROP FOREIGN KEY `FileSongTag_songId_fkey`;

ALTER TABLE `FileEventTag` DROP FOREIGN KEY `FileEventTag_fileId_fkey`;

ALTER TABLE `FileEventTag` DROP FOREIGN KEY `FileEventTag_eventId_fkey`;

ALTER TABLE `FileInstrumentTag` DROP FOREIGN KEY `FileInstrumentTag_fileId_fkey`;

ALTER TABLE `FileInstrumentTag` DROP FOREIGN KEY `FileInstrumentTag_instrumentId_fkey`;

ALTER TABLE `FileWikiPageTag` DROP FOREIGN KEY `FileWikiPageTag_fileId_fkey`;

ALTER TABLE `FileWikiPageTag` DROP FOREIGN KEY `FileWikiPageTag_wikiPageId_fkey`;

ALTER TABLE `FrontpageGalleryItem` DROP FOREIGN KEY `FrontpageGalleryItem_fileId_fkey`;

ALTER TABLE `FrontpageGalleryItem` DROP FOREIGN KEY `FrontpageGalleryItem_createdByUserId_fkey`;

ALTER TABLE `FrontpageGalleryItem` DROP FOREIGN KEY `FrontpageGalleryItem_visiblePermissionId_fkey`;

ALTER TABLE `CustomLink` DROP FOREIGN KEY `CustomLink_fileId_fkey`;

ALTER TABLE `CustomLink` DROP FOREIGN KEY `CustomLink_createdByUserId_fkey`;

ALTER TABLE `CustomLinkVisit` DROP FOREIGN KEY `CustomLinkVisit_customLinkId_fkey`;

ALTER TABLE `WikiPage` DROP FOREIGN KEY `WikiPage_currentRevisionId_fkey`;

ALTER TABLE `WikiPage` DROP FOREIGN KEY `WikiPage_visiblePermissionId_fkey`;

ALTER TABLE `WikiPage` DROP FOREIGN KEY `WikiPage_lockedByUserId_fkey`;

ALTER TABLE `WikiPage` DROP FOREIGN KEY `WikiPage_createdByUserId_fkey`;

ALTER TABLE `WikiPageRevision` DROP FOREIGN KEY `WikiPageRevision_wikiPageId_fkey`;

ALTER TABLE `WikiPageRevision` DROP FOREIGN KEY `WikiPageRevision_createdByUserId_fkey`;

ALTER TABLE `WikiPageTagAssignment` DROP FOREIGN KEY `WikiPageTagAssignment_wikiPageId_fkey`;

ALTER TABLE `WikiPageTagAssignment` DROP FOREIGN KEY `WikiPageTagAssignment_tagId_fkey`;

ALTER TABLE `MenuLink` DROP FOREIGN KEY `MenuLink_visiblePermissionId_fkey`;

ALTER TABLE `MenuLink` DROP FOREIGN KEY `MenuLink_createdByUserId_fkey`;

ALTER TABLE `SetlistPlanGroup` DROP FOREIGN KEY `SetlistPlanGroup_createdByUserId_fkey`;

ALTER TABLE `SetlistPlan` DROP FOREIGN KEY `SetlistPlan_groupId_fkey`;

ALTER TABLE `SetlistPlan` DROP FOREIGN KEY `SetlistPlan_createdByUserId_fkey`;

ALTER TABLE `SetlistPlan` DROP FOREIGN KEY `SetlistPlan_visiblePermissionId_fkey`;

RENAME TABLE
  `Role` TO `GlobalRole`,
  `RolePermission` TO `GlobalRolePermission`,
  `UserTag` TO `GlobalUserTag`,
  `UserTagAssignment` TO `BandUserTagAssignment`,
  `SongTag` TO `GlobalSongTag`,
  `SongTagAssociation` TO `BandSongTagAssociation`,
  `InstrumentFunctionalGroup` TO `GlobalInstrumentFunctionalGroup`,
  `Instrument` TO `GlobalInstrument`,
  `UserInstrument` TO `BandUserInstrument`,
  `EventTag` TO `GlobalEventTag`,
  `FileTag` TO `GlobalFileTag`,
  `FileTagAssignment` TO `BandFileTagAssignment`,
  `WikiPageTag` TO `GlobalWikiPageTag`,
  `Setting` TO `GlobalSetting`;

ALTER TABLE `GlobalRole`
  ADD COLUMN `nameId` INTEGER NULL,
  ADD COLUMN `descriptionId` INTEGER NULL,
  ADD COLUMN `isDeleted` BOOLEAN NULL DEFAULT false,
  ADD COLUMN `createdAt` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  ADD COLUMN `updatedAt` DATETIME(3) NULL;

ALTER TABLE `Permission`
  ADD COLUMN `descriptionId` INTEGER NULL,
  ADD COLUMN `isDeleted` BOOLEAN NULL DEFAULT false,
  ADD COLUMN `createdAt` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  ADD COLUMN `updatedAt` DATETIME(3) NULL;

ALTER TABLE `GlobalRolePermission` CHANGE COLUMN `roleId` `globalRoleId` INTEGER NOT NULL;

ALTER TABLE `GlobalRolePermission`
  ADD COLUMN `updatedAt` DATETIME(3) NULL,
  ADD COLUMN `updatedByUserId` INTEGER NULL;

ALTER TABLE `Action` CHANGE COLUMN `instrumentId` `bandInstrumentId` INTEGER NULL;

ALTER TABLE `Action`
  ADD COLUMN `bandId` INTEGER NULL,
  ADD COLUMN `localeContextId` INTEGER NULL;

ALTER TABLE `GlobalUserTag`
  ADD COLUMN `nameId` INTEGER NULL,
  ADD COLUMN `descriptionId` INTEGER NULL;

ALTER TABLE `BandUserTagAssignment` CHANGE COLUMN `userId` `bandUserId` INTEGER NOT NULL;

ALTER TABLE `BandUserTagAssignment` CHANGE COLUMN `userTagId` `bandUserTagId` INTEGER NOT NULL;

ALTER TABLE `User` CHANGE COLUMN `roleId` `globalRoleId` INTEGER NULL;

ALTER TABLE `UserSetting`
  ADD COLUMN `updatedAt` DATETIME(3) NULL,
  ADD COLUMN `updatedByUserId` INTEGER NULL;

ALTER TABLE `GlobalSetting`
  ADD COLUMN `updatedAt` DATETIME(3) NULL,
  ADD COLUMN `updatedByUserId` INTEGER NULL;

ALTER TABLE `Song`
  ADD COLUMN `bandId` INTEGER NULL,
  ADD COLUMN `updatedAt` DATETIME(3) NULL,
  ADD COLUMN `updatedByUserId` INTEGER NULL;

ALTER TABLE `SongCreditType`
  ADD COLUMN `nameId` INTEGER NULL,
  ADD COLUMN `descriptionId` INTEGER NULL;

ALTER TABLE `GlobalSongTag`
  ADD COLUMN `nameId` INTEGER NULL,
  ADD COLUMN `descriptionId` INTEGER NULL;

ALTER TABLE `BandSongTagAssociation` CHANGE COLUMN `tagId` `bandSongTagId` INTEGER NOT NULL;

ALTER TABLE `GlobalInstrumentFunctionalGroup`
  ADD COLUMN `nameId` INTEGER NULL,
  ADD COLUMN `descriptionId` INTEGER NULL;

ALTER TABLE `GlobalInstrument`
  ADD COLUMN `nameId` INTEGER NULL,
  ADD COLUMN `descriptionId` INTEGER NULL;

ALTER TABLE `BandUserInstrument` CHANGE COLUMN `userId` `bandUserId` INTEGER NOT NULL;

ALTER TABLE `BandUserInstrument` CHANGE COLUMN `instrumentId` `bandInstrumentId` INTEGER NOT NULL;

ALTER TABLE `Event`
  ADD COLUMN `bandId` INTEGER NULL;

ALTER TABLE `EventType`
  ADD COLUMN `nameId` INTEGER NULL,
  ADD COLUMN `descriptionId` INTEGER NULL;

ALTER TABLE `EventStatus`
  ADD COLUMN `nameId` INTEGER NULL,
  ADD COLUMN `descriptionId` INTEGER NULL;

ALTER TABLE `GlobalEventTag`
  ADD COLUMN `nameId` INTEGER NULL,
  ADD COLUMN `descriptionId` INTEGER NULL;

ALTER TABLE `EventTagAssignment` CHANGE COLUMN `eventTagId` `bandEventTagId` INTEGER NOT NULL;

ALTER TABLE `EventAttendance`
  ADD COLUMN `buttonCaptionId` INTEGER NULL,
  ADD COLUMN `personalCaptionId` INTEGER NULL,
  ADD COLUMN `pastCaptionId` INTEGER NULL,
  ADD COLUMN `personalPastCaptionId` INTEGER NULL,
  ADD COLUMN `descriptionId` INTEGER NULL;

ALTER TABLE `EventUserResponse` CHANGE COLUMN `userId` `bandUserId` INTEGER NOT NULL;

ALTER TABLE `EventUserResponse` CHANGE COLUMN `instrumentId` `bandInstrumentId` INTEGER NULL;

ALTER TABLE `EventSegmentUserResponse` CHANGE COLUMN `userId` `bandUserId` INTEGER NOT NULL;

ALTER TABLE `GlobalFileTag`
  ADD COLUMN `nameId` INTEGER NULL,
  ADD COLUMN `descriptionId` INTEGER NULL;

ALTER TABLE `BandFileTagAssignment` CHANGE COLUMN `fileTagId` `bandFileTagId` INTEGER NOT NULL;

ALTER TABLE `File`
  ADD COLUMN `bandId` INTEGER NULL;

ALTER TABLE `FileUserTag` CHANGE COLUMN `userId` `bandUserId` INTEGER NOT NULL;

ALTER TABLE `FileInstrumentTag` CHANGE COLUMN `instrumentId` `bandInstrumentId` INTEGER NOT NULL;

ALTER TABLE `CustomLink`
  ADD COLUMN `bandId` INTEGER NULL;

ALTER TABLE `WikiPage`
  ADD COLUMN `bandId` INTEGER NULL;

ALTER TABLE `GlobalWikiPageTag`
  ADD COLUMN `nameId` INTEGER NULL,
  ADD COLUMN `descriptionId` INTEGER NULL;

ALTER TABLE `WikiPageTagAssignment` CHANGE COLUMN `tagId` `bandWikiPageTagId` INTEGER NOT NULL;

ALTER TABLE `MenuLink`
  ADD COLUMN `captionId` INTEGER NULL,
  ADD COLUMN `bandId` INTEGER NULL;

ALTER TABLE `SetlistPlanGroup`
  ADD COLUMN `bandId` INTEGER NULL,
  ADD COLUMN `updatedAt` DATETIME(3) NULL;

ALTER TABLE `SetlistPlan`
  ADD COLUMN `bandId` INTEGER NULL,
  ADD COLUMN `updatedAt` DATETIME(3) NULL;

-- Create all dynamic string identities and their en-US values before removing source text.

CREATE TEMPORARY TABLE `_lsmb_strings` (
  `ownerTable` VARCHAR(64) NOT NULL, `ownerId` INT NOT NULL,
  `fieldName` VARCHAR(64) NOT NULL, `format` VARCHAR(16) NOT NULL,
  `value` MEDIUMTEXT NOT NULL, `bandValue` BOOLEAN NOT NULL DEFAULT FALSE,
  `stringId` INT NULL, PRIMARY KEY (`ownerTable`, `ownerId`, `fieldName`)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
INSERT INTO `_lsmb_strings` (`ownerTable`, `ownerId`, `fieldName`, `format`, `value`, `bandValue`) VALUES
  ('Locale', 1, 'name', 'PlainText', 'English (United States)', FALSE),
  ('Locale', 2, 'name', 'PlainText', 'French (Belgium)', FALSE),
  ('Locale', 3, 'name', 'PlainText', 'Dutch (Belgium)', FALSE),
  ('Band', 1, 'name', 'PlainText', 'Café Marché', TRUE);

INSERT INTO `_lsmb_strings` (`ownerTable`, `ownerId`, `fieldName`, `format`, `value`, `bandValue`)
SELECT 'GlobalRole', `id`, 'name', 'PlainText', `name`, FALSE FROM `GlobalRole` WHERE `name` IS NOT NULL;

INSERT INTO `_lsmb_strings` (`ownerTable`, `ownerId`, `fieldName`, `format`, `value`, `bandValue`)
SELECT 'GlobalRole', `id`, 'description', 'Markdown', `description`, FALSE FROM `GlobalRole` WHERE `description` IS NOT NULL;

INSERT INTO `_lsmb_strings` (`ownerTable`, `ownerId`, `fieldName`, `format`, `value`, `bandValue`)
SELECT 'Permission', `id`, 'description', 'Markdown', `description`, FALSE FROM `Permission` WHERE `description` IS NOT NULL;

INSERT INTO `_lsmb_strings` (`ownerTable`, `ownerId`, `fieldName`, `format`, `value`, `bandValue`)
SELECT 'GlobalUserTag', `id`, 'name', 'PlainText', `text`, FALSE FROM `GlobalUserTag` WHERE `text` IS NOT NULL;

INSERT INTO `_lsmb_strings` (`ownerTable`, `ownerId`, `fieldName`, `format`, `value`, `bandValue`)
SELECT 'GlobalUserTag', `id`, 'description', 'Markdown', `description`, FALSE FROM `GlobalUserTag` WHERE `description` IS NOT NULL;

INSERT INTO `_lsmb_strings` (`ownerTable`, `ownerId`, `fieldName`, `format`, `value`, `bandValue`)
SELECT 'GlobalSongTag', `id`, 'name', 'PlainText', `text`, FALSE FROM `GlobalSongTag` WHERE `text` IS NOT NULL;

INSERT INTO `_lsmb_strings` (`ownerTable`, `ownerId`, `fieldName`, `format`, `value`, `bandValue`)
SELECT 'GlobalSongTag', `id`, 'description', 'Markdown', `description`, FALSE FROM `GlobalSongTag` WHERE `description` IS NOT NULL;

INSERT INTO `_lsmb_strings` (`ownerTable`, `ownerId`, `fieldName`, `format`, `value`, `bandValue`)
SELECT 'GlobalInstrumentFunctionalGroup', `id`, 'name', 'PlainText', `name`, FALSE FROM `GlobalInstrumentFunctionalGroup` WHERE `name` IS NOT NULL;

INSERT INTO `_lsmb_strings` (`ownerTable`, `ownerId`, `fieldName`, `format`, `value`, `bandValue`)
SELECT 'GlobalInstrumentFunctionalGroup', `id`, 'description', 'Markdown', `description`, FALSE FROM `GlobalInstrumentFunctionalGroup` WHERE `description` IS NOT NULL;

INSERT INTO `_lsmb_strings` (`ownerTable`, `ownerId`, `fieldName`, `format`, `value`, `bandValue`)
SELECT 'GlobalInstrument', `id`, 'name', 'PlainText', `name`, FALSE FROM `GlobalInstrument` WHERE `name` IS NOT NULL;

INSERT INTO `_lsmb_strings` (`ownerTable`, `ownerId`, `fieldName`, `format`, `value`, `bandValue`)
SELECT 'GlobalInstrument', `id`, 'description', 'Markdown', `description`, FALSE FROM `GlobalInstrument` WHERE `description` IS NOT NULL;

INSERT INTO `_lsmb_strings` (`ownerTable`, `ownerId`, `fieldName`, `format`, `value`, `bandValue`)
SELECT 'EventType', `id`, 'name', 'PlainText', `text`, FALSE FROM `EventType` WHERE `text` IS NOT NULL;

INSERT INTO `_lsmb_strings` (`ownerTable`, `ownerId`, `fieldName`, `format`, `value`, `bandValue`)
SELECT 'EventType', `id`, 'description', 'Markdown', `description`, FALSE FROM `EventType` WHERE `description` IS NOT NULL;

INSERT INTO `_lsmb_strings` (`ownerTable`, `ownerId`, `fieldName`, `format`, `value`, `bandValue`)
SELECT 'EventStatus', `id`, 'name', 'PlainText', `label`, FALSE FROM `EventStatus` WHERE `label` IS NOT NULL;

INSERT INTO `_lsmb_strings` (`ownerTable`, `ownerId`, `fieldName`, `format`, `value`, `bandValue`)
SELECT 'EventStatus', `id`, 'description', 'Markdown', `description`, FALSE FROM `EventStatus` WHERE `description` IS NOT NULL;

INSERT INTO `_lsmb_strings` (`ownerTable`, `ownerId`, `fieldName`, `format`, `value`, `bandValue`)
SELECT 'GlobalEventTag', `id`, 'name', 'PlainText', `text`, FALSE FROM `GlobalEventTag` WHERE `text` IS NOT NULL;

INSERT INTO `_lsmb_strings` (`ownerTable`, `ownerId`, `fieldName`, `format`, `value`, `bandValue`)
SELECT 'GlobalEventTag', `id`, 'description', 'Markdown', `description`, FALSE FROM `GlobalEventTag` WHERE `description` IS NOT NULL;

INSERT INTO `_lsmb_strings` (`ownerTable`, `ownerId`, `fieldName`, `format`, `value`, `bandValue`)
SELECT 'EventAttendance', `id`, 'buttonCaption', 'PlainText', `text`, FALSE FROM `EventAttendance` WHERE `text` IS NOT NULL;

INSERT INTO `_lsmb_strings` (`ownerTable`, `ownerId`, `fieldName`, `format`, `value`, `bandValue`)
SELECT 'EventAttendance', `id`, 'personalCaption', 'PlainText', `personalText`, FALSE FROM `EventAttendance` WHERE `personalText` IS NOT NULL;

INSERT INTO `_lsmb_strings` (`ownerTable`, `ownerId`, `fieldName`, `format`, `value`, `bandValue`)
SELECT 'EventAttendance', `id`, 'pastCaption', 'PlainText', `pastText`, FALSE FROM `EventAttendance` WHERE `pastText` IS NOT NULL;

INSERT INTO `_lsmb_strings` (`ownerTable`, `ownerId`, `fieldName`, `format`, `value`, `bandValue`)
SELECT 'EventAttendance', `id`, 'personalPastCaption', 'PlainText', `pastPersonalText`, FALSE FROM `EventAttendance` WHERE `pastPersonalText` IS NOT NULL;

INSERT INTO `_lsmb_strings` (`ownerTable`, `ownerId`, `fieldName`, `format`, `value`, `bandValue`)
SELECT 'EventAttendance', `id`, 'description', 'Markdown', `description`, FALSE FROM `EventAttendance` WHERE `description` IS NOT NULL;

INSERT INTO `_lsmb_strings` (`ownerTable`, `ownerId`, `fieldName`, `format`, `value`, `bandValue`)
SELECT 'SongCreditType', `id`, 'name', 'PlainText', `text`, FALSE FROM `SongCreditType` WHERE `text` IS NOT NULL;

INSERT INTO `_lsmb_strings` (`ownerTable`, `ownerId`, `fieldName`, `format`, `value`, `bandValue`)
SELECT 'SongCreditType', `id`, 'description', 'Markdown', `description`, FALSE FROM `SongCreditType` WHERE `description` IS NOT NULL;

INSERT INTO `_lsmb_strings` (`ownerTable`, `ownerId`, `fieldName`, `format`, `value`, `bandValue`)
SELECT 'GlobalFileTag', `id`, 'name', 'PlainText', `text`, FALSE FROM `GlobalFileTag` WHERE `text` IS NOT NULL;

INSERT INTO `_lsmb_strings` (`ownerTable`, `ownerId`, `fieldName`, `format`, `value`, `bandValue`)
SELECT 'GlobalFileTag', `id`, 'description', 'Markdown', `description`, FALSE FROM `GlobalFileTag` WHERE `description` IS NOT NULL;

INSERT INTO `_lsmb_strings` (`ownerTable`, `ownerId`, `fieldName`, `format`, `value`, `bandValue`)
SELECT 'GlobalWikiPageTag', `id`, 'name', 'PlainText', `text`, FALSE FROM `GlobalWikiPageTag` WHERE `text` IS NOT NULL;

INSERT INTO `_lsmb_strings` (`ownerTable`, `ownerId`, `fieldName`, `format`, `value`, `bandValue`)
SELECT 'GlobalWikiPageTag', `id`, 'description', 'Markdown', `description`, FALSE FROM `GlobalWikiPageTag` WHERE `description` IS NOT NULL;

INSERT INTO `_lsmb_strings` (`ownerTable`, `ownerId`, `fieldName`, `format`, `value`, `bandValue`)
SELECT 'MenuLink', `id`, 'caption', 'PlainText', `caption`, TRUE FROM `MenuLink` WHERE `caption` IS NOT NULL;

INSERT INTO `DynamicLocalizedString` (`publicId`, `format`, `createdAt`, `updatedAt`)
SELECT LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:string:', `ownerTable`, ':', `ownerId`, ':', `fieldName`) )))), '+', '-'), '/', '_'), 16), `format`, @lsmb_migration_at, @lsmb_migration_at
FROM `_lsmb_strings` ORDER BY `ownerTable`, `ownerId`, `fieldName`;
UPDATE `_lsmb_strings` s JOIN `DynamicLocalizedString` d
ON d.`publicId` = LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:string:', s.`ownerTable`, ':', s.`ownerId`, ':', s.`fieldName`) )))), '+', '-'), '/', '_'), 16)
SET s.`stringId` = d.`id`;
INSERT INTO `Locale` (`id`, `publicId`, `nameId`, `langCode`, `regionCode`, `ietfTag`, `createdAt`, `updatedAt`, `sortOrder`)
SELECT `ownerId`, LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:locale:', `ownerId`))))), '+', '-'), '/', '_'), 16), `stringId`,
  CASE `ownerId` WHEN 1 THEN 'en' WHEN 2 THEN 'fr' ELSE 'nl' END,
  IF(`ownerId` = 1, 'US', 'BE'),
  CASE `ownerId` WHEN 1 THEN 'en-US' WHEN 2 THEN 'fr-BE' ELSE 'nl-BE' END,
  @lsmb_migration_at, @lsmb_migration_at, `ownerId` - 1
FROM `_lsmb_strings` WHERE `ownerTable` = 'Locale';
INSERT INTO `Band` (`id`, `publicId`, `nameId`, `createdAt`, `updatedAt`)
SELECT 1, LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', 'lsmb:band:CafeMarche')))), '+', '-'), '/', '_'), 16), `stringId`, @lsmb_migration_at, @lsmb_migration_at
FROM `_lsmb_strings` WHERE `ownerTable` = 'Band';
INSERT INTO `BandLocale` (`bandId`, `localeId`, `createdAt`, `updatedAt`, `sortOrder`)
SELECT 1, `id`, @lsmb_migration_at, @lsmb_migration_at, `sortOrder` FROM `Locale`;
INSERT INTO `DynamicLocalizedStringValue` (`publicId`, `localeId`, `stringId`, `indexedValue`, `blobValue`, `updatedAt`)
SELECT LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:global-value:', `stringId`))))), '+', '-'), '/', '_'), 16), 1, `stringId`,
  IF(`format` = 'PlainText' AND CHAR_LENGTH(`value`) <= 768, `value`, NULL),
  IF(`format` = 'PlainText' AND CHAR_LENGTH(`value`) <= 768, NULL, `value`), @lsmb_migration_at
FROM `_lsmb_strings` WHERE NOT `bandValue`;
INSERT INTO `BandDynamicLocalizedStringValue` (`publicId`, `bandId`, `localeId`, `stringId`, `indexedValue`, `blobValue`, `updatedAt`)
SELECT LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:band-value:', `stringId`))))), '+', '-'), '/', '_'), 16), 1, 1, `stringId`,
  IF(`format` = 'PlainText' AND CHAR_LENGTH(`value`) <= 768, `value`, NULL),
  IF(`format` = 'PlainText' AND CHAR_LENGTH(`value`) <= 768, NULL, `value`), @lsmb_migration_at
FROM `_lsmb_strings` WHERE `bandValue`;

UPDATE `GlobalRole` t JOIN `_lsmb_strings` s ON s.`ownerTable` = 'GlobalRole' AND s.`ownerId` = t.`id` AND s.`fieldName` = 'name' SET t.`nameId` = s.`stringId`;

UPDATE `GlobalRole` t JOIN `_lsmb_strings` s ON s.`ownerTable` = 'GlobalRole' AND s.`ownerId` = t.`id` AND s.`fieldName` = 'description' SET t.`descriptionId` = s.`stringId`;

UPDATE `Permission` t JOIN `_lsmb_strings` s ON s.`ownerTable` = 'Permission' AND s.`ownerId` = t.`id` AND s.`fieldName` = 'description' SET t.`descriptionId` = s.`stringId`;

UPDATE `GlobalUserTag` t JOIN `_lsmb_strings` s ON s.`ownerTable` = 'GlobalUserTag' AND s.`ownerId` = t.`id` AND s.`fieldName` = 'name' SET t.`nameId` = s.`stringId`;

UPDATE `GlobalUserTag` t JOIN `_lsmb_strings` s ON s.`ownerTable` = 'GlobalUserTag' AND s.`ownerId` = t.`id` AND s.`fieldName` = 'description' SET t.`descriptionId` = s.`stringId`;

UPDATE `GlobalSongTag` t JOIN `_lsmb_strings` s ON s.`ownerTable` = 'GlobalSongTag' AND s.`ownerId` = t.`id` AND s.`fieldName` = 'name' SET t.`nameId` = s.`stringId`;

UPDATE `GlobalSongTag` t JOIN `_lsmb_strings` s ON s.`ownerTable` = 'GlobalSongTag' AND s.`ownerId` = t.`id` AND s.`fieldName` = 'description' SET t.`descriptionId` = s.`stringId`;

UPDATE `GlobalInstrumentFunctionalGroup` t JOIN `_lsmb_strings` s ON s.`ownerTable` = 'GlobalInstrumentFunctionalGroup' AND s.`ownerId` = t.`id` AND s.`fieldName` = 'name' SET t.`nameId` = s.`stringId`;

UPDATE `GlobalInstrumentFunctionalGroup` t JOIN `_lsmb_strings` s ON s.`ownerTable` = 'GlobalInstrumentFunctionalGroup' AND s.`ownerId` = t.`id` AND s.`fieldName` = 'description' SET t.`descriptionId` = s.`stringId`;

UPDATE `GlobalInstrument` t JOIN `_lsmb_strings` s ON s.`ownerTable` = 'GlobalInstrument' AND s.`ownerId` = t.`id` AND s.`fieldName` = 'name' SET t.`nameId` = s.`stringId`;

UPDATE `GlobalInstrument` t JOIN `_lsmb_strings` s ON s.`ownerTable` = 'GlobalInstrument' AND s.`ownerId` = t.`id` AND s.`fieldName` = 'description' SET t.`descriptionId` = s.`stringId`;

UPDATE `EventType` t JOIN `_lsmb_strings` s ON s.`ownerTable` = 'EventType' AND s.`ownerId` = t.`id` AND s.`fieldName` = 'name' SET t.`nameId` = s.`stringId`;

UPDATE `EventType` t JOIN `_lsmb_strings` s ON s.`ownerTable` = 'EventType' AND s.`ownerId` = t.`id` AND s.`fieldName` = 'description' SET t.`descriptionId` = s.`stringId`;

UPDATE `EventStatus` t JOIN `_lsmb_strings` s ON s.`ownerTable` = 'EventStatus' AND s.`ownerId` = t.`id` AND s.`fieldName` = 'name' SET t.`nameId` = s.`stringId`;

UPDATE `EventStatus` t JOIN `_lsmb_strings` s ON s.`ownerTable` = 'EventStatus' AND s.`ownerId` = t.`id` AND s.`fieldName` = 'description' SET t.`descriptionId` = s.`stringId`;

UPDATE `GlobalEventTag` t JOIN `_lsmb_strings` s ON s.`ownerTable` = 'GlobalEventTag' AND s.`ownerId` = t.`id` AND s.`fieldName` = 'name' SET t.`nameId` = s.`stringId`;

UPDATE `GlobalEventTag` t JOIN `_lsmb_strings` s ON s.`ownerTable` = 'GlobalEventTag' AND s.`ownerId` = t.`id` AND s.`fieldName` = 'description' SET t.`descriptionId` = s.`stringId`;

UPDATE `EventAttendance` t JOIN `_lsmb_strings` s ON s.`ownerTable` = 'EventAttendance' AND s.`ownerId` = t.`id` AND s.`fieldName` = 'buttonCaption' SET t.`buttonCaptionId` = s.`stringId`;

UPDATE `EventAttendance` t JOIN `_lsmb_strings` s ON s.`ownerTable` = 'EventAttendance' AND s.`ownerId` = t.`id` AND s.`fieldName` = 'personalCaption' SET t.`personalCaptionId` = s.`stringId`;

UPDATE `EventAttendance` t JOIN `_lsmb_strings` s ON s.`ownerTable` = 'EventAttendance' AND s.`ownerId` = t.`id` AND s.`fieldName` = 'pastCaption' SET t.`pastCaptionId` = s.`stringId`;

UPDATE `EventAttendance` t JOIN `_lsmb_strings` s ON s.`ownerTable` = 'EventAttendance' AND s.`ownerId` = t.`id` AND s.`fieldName` = 'personalPastCaption' SET t.`personalPastCaptionId` = s.`stringId`;

UPDATE `EventAttendance` t JOIN `_lsmb_strings` s ON s.`ownerTable` = 'EventAttendance' AND s.`ownerId` = t.`id` AND s.`fieldName` = 'description' SET t.`descriptionId` = s.`stringId`;

UPDATE `SongCreditType` t JOIN `_lsmb_strings` s ON s.`ownerTable` = 'SongCreditType' AND s.`ownerId` = t.`id` AND s.`fieldName` = 'name' SET t.`nameId` = s.`stringId`;

UPDATE `SongCreditType` t JOIN `_lsmb_strings` s ON s.`ownerTable` = 'SongCreditType' AND s.`ownerId` = t.`id` AND s.`fieldName` = 'description' SET t.`descriptionId` = s.`stringId`;

UPDATE `GlobalFileTag` t JOIN `_lsmb_strings` s ON s.`ownerTable` = 'GlobalFileTag' AND s.`ownerId` = t.`id` AND s.`fieldName` = 'name' SET t.`nameId` = s.`stringId`;

UPDATE `GlobalFileTag` t JOIN `_lsmb_strings` s ON s.`ownerTable` = 'GlobalFileTag' AND s.`ownerId` = t.`id` AND s.`fieldName` = 'description' SET t.`descriptionId` = s.`stringId`;

UPDATE `GlobalWikiPageTag` t JOIN `_lsmb_strings` s ON s.`ownerTable` = 'GlobalWikiPageTag' AND s.`ownerId` = t.`id` AND s.`fieldName` = 'name' SET t.`nameId` = s.`stringId`;

UPDATE `GlobalWikiPageTag` t JOIN `_lsmb_strings` s ON s.`ownerTable` = 'GlobalWikiPageTag' AND s.`ownerId` = t.`id` AND s.`fieldName` = 'description' SET t.`descriptionId` = s.`stringId`;

UPDATE `MenuLink` t JOIN `_lsmb_strings` s ON s.`ownerTable` = 'MenuLink' AND s.`ownerId` = t.`id` AND s.`fieldName` = 'caption' SET t.`captionId` = s.`stringId`;

UPDATE `GlobalRole` SET `createdAt` = @lsmb_migration_at;

UPDATE `GlobalRole` SET `updatedAt` = @lsmb_migration_at;

UPDATE `Permission` SET `createdAt` = @lsmb_migration_at;

UPDATE `Permission` SET `updatedAt` = @lsmb_migration_at;

UPDATE `GlobalRolePermission` SET `updatedAt` = @lsmb_migration_at;

UPDATE `UserSetting` SET `updatedAt` = @lsmb_migration_at;

UPDATE `GlobalSetting` SET `updatedAt` = @lsmb_migration_at;

UPDATE `Song` SET `updatedAt` = @lsmb_migration_at;

UPDATE `SetlistPlanGroup` SET `updatedAt` = @lsmb_migration_at;

UPDATE `SetlistPlan` SET `updatedAt` = @lsmb_migration_at;

-- A missing response timestamp uses its other timestamp, then the migration time.
UPDATE `EventSegmentUserResponse` SET
  `createdAt` = COALESCE(`createdAt`, `updatedAt`, @lsmb_migration_at),
  `updatedAt` = COALESCE(`updatedAt`, `createdAt`, @lsmb_migration_at);

-- Split role definitions and grant rows without changing their identities or matrices.

INSERT INTO `BandRole` (`id`, `publicId`, `nameId`, `descriptionId`, `isRoleForNewUsers`, `isPublicRole`, `sortOrder`, `color`, `createdAt`, `updatedAt`)
SELECT `id`, `publicId`, `nameId`, `descriptionId`, `isRoleForNewUsers`, `isPublicRole`, `sortOrder`, `color`, @lsmb_migration_at, @lsmb_migration_at
FROM `GlobalRole` WHERE NOT `isSysAdminRole`;
INSERT INTO `BandRolePermission` (`id`, `publicId`, `permissionId`, `bandRoleId`, `updatedAt`)
SELECT p.`id`, p.`publicId`, p.`permissionId`, p.`globalRoleId`, @lsmb_migration_at
FROM `GlobalRolePermission` p JOIN `BandRole` r ON r.`id` = p.`globalRoleId`;
INSERT INTO `BandUser` (`publicId`, `userId`, `bandId`, `bandRoleId`, `isDeleted`, `createdAt`, `updatedAt`)
SELECT LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:membership:', u.`id`))))), '+', '-'), '/', '_'), 16), u.`id`, 1, r.`id`,
  (u.`isDeleted` OR u.`mergedIntoUserId` IS NOT NULL), u.`createdAt`, @lsmb_migration_at
FROM `User` u LEFT JOIN `BandRole` r ON r.`id` = u.`globalRoleId` ORDER BY u.`id`;
-- isSysAdmin retains the old inherited admin role, even with an ordinary band role.
UPDATE `User` u LEFT JOIN `GlobalRole` r ON r.`id` = u.`globalRoleId` AND r.`isSysAdminRole`
SET u.`globalRoleId` = IF(u.`isSysAdmin`, (SELECT designated.`id` FROM `GlobalRole` designated WHERE designated.`isSysAdminRole`), r.`id`);
DELETE p FROM `GlobalRolePermission` p JOIN `BandRole` r ON r.`id` = p.`globalRoleId`;
DELETE FROM `GlobalRole` WHERE NOT `isSysAdminRole`;

-- Opt the existing band into every catalog, leaving nullable overrides inherited.

INSERT INTO `BandUserTag` (`publicId`, `bandId`, `globalUserTagId`, `createdAt`, `updatedAt`)
SELECT LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:BandUserTag:', `id`))))), '+', '-'), '/', '_'), 16), 1, `id`, @lsmb_migration_at, @lsmb_migration_at FROM `GlobalUserTag` ORDER BY `id`;

INSERT INTO `BandSongTag` (`publicId`, `bandId`, `globalSongTagId`, `createdAt`, `updatedAt`)
SELECT LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:BandSongTag:', `id`))))), '+', '-'), '/', '_'), 16), 1, `id`, @lsmb_migration_at, @lsmb_migration_at FROM `GlobalSongTag` ORDER BY `id`;

INSERT INTO `BandInstrumentFunctionalGroup` (`publicId`, `bandId`, `globalFunctionalGroupId`, `createdAt`, `updatedAt`)
SELECT LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:BandInstrumentFunctionalGroup:', `id`))))), '+', '-'), '/', '_'), 16), 1, `id`, @lsmb_migration_at, @lsmb_migration_at FROM `GlobalInstrumentFunctionalGroup` ORDER BY `id`;

INSERT INTO `BandEventTag` (`publicId`, `bandId`, `globalEventTagId`, `createdAt`, `updatedAt`)
SELECT LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:BandEventTag:', `id`))))), '+', '-'), '/', '_'), 16), 1, `id`, @lsmb_migration_at, @lsmb_migration_at FROM `GlobalEventTag` ORDER BY `id`;

INSERT INTO `BandFileTag` (`publicId`, `bandId`, `globalFileTagId`, `createdAt`, `updatedAt`)
SELECT LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:BandFileTag:', `id`))))), '+', '-'), '/', '_'), 16), 1, `id`, @lsmb_migration_at, @lsmb_migration_at FROM `GlobalFileTag` ORDER BY `id`;

INSERT INTO `BandWikiPageTag` (`publicId`, `bandId`, `globalWikiPageTagId`, `createdAt`, `updatedAt`)
SELECT LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:BandWikiPageTag:', `id`))))), '+', '-'), '/', '_'), 16), 1, `id`, @lsmb_migration_at, @lsmb_migration_at FROM `GlobalWikiPageTag` ORDER BY `id`;

INSERT INTO `BandInstrument` (`publicId`, `bandId`, `globalInstrumentId`, `functionalGroupId`, `createdAt`, `updatedAt`)
SELECT LEFT(REPLACE(REPLACE(TO_BASE64(UNHEX(MD5(CONCAT(@lsmb_public_id_seed, ':', CONCAT('lsmb:BandInstrument:', i.`id`))))), '+', '-'), '/', '_'), 16), 1, i.`id`, g.`id`, @lsmb_migration_at, @lsmb_migration_at
FROM `GlobalInstrument` i JOIN `BandInstrumentFunctionalGroup` g ON g.`globalFunctionalGroupId` = i.`functionalGroupId` AND g.`bandId` = 1 ORDER BY i.`id`;

UPDATE `Song` SET `bandId` = 1;

UPDATE `Event` SET `bandId` = 1;

UPDATE `File` SET `bandId` = 1;

UPDATE `WikiPage` SET `bandId` = 1;

UPDATE `CustomLink` SET `bandId` = 1;

UPDATE `MenuLink` SET `bandId` = 1;

UPDATE `SetlistPlanGroup` SET `bandId` = 1;

UPDATE `SetlistPlan` SET `bandId` = 1;

-- Remap references through explicit membership/catalog keys, never coincident numeric IDs.

UPDATE `BandUserTagAssignment` t JOIN `BandUser` p ON p.`userId` = t.`bandUserId` AND p.`bandId` = 1 SET t.`bandUserId` = p.`id`;

UPDATE `BandUserTagAssignment` t JOIN `BandUserTag` p ON p.`globalUserTagId` = t.`bandUserTagId` AND p.`bandId` = 1 SET t.`bandUserTagId` = p.`id`;

UPDATE `BandSongTagAssociation` t JOIN `BandSongTag` p ON p.`globalSongTagId` = t.`bandSongTagId` AND p.`bandId` = 1 SET t.`bandSongTagId` = p.`id`;

UPDATE `BandUserInstrument` t JOIN `BandUser` p ON p.`userId` = t.`bandUserId` AND p.`bandId` = 1 SET t.`bandUserId` = p.`id`;

UPDATE `BandUserInstrument` t JOIN `BandInstrument` p ON p.`globalInstrumentId` = t.`bandInstrumentId` AND p.`bandId` = 1 SET t.`bandInstrumentId` = p.`id`;

UPDATE `EventUserResponse` t JOIN `BandUser` p ON p.`userId` = t.`bandUserId` AND p.`bandId` = 1 SET t.`bandUserId` = p.`id`;

UPDATE `EventUserResponse` t JOIN `BandInstrument` p ON p.`globalInstrumentId` = t.`bandInstrumentId` AND p.`bandId` = 1 SET t.`bandInstrumentId` = p.`id`;

UPDATE `EventSegmentUserResponse` t JOIN `BandUser` p ON p.`userId` = t.`bandUserId` AND p.`bandId` = 1 SET t.`bandUserId` = p.`id`;

UPDATE `BandFileTagAssignment` t JOIN `BandFileTag` p ON p.`globalFileTagId` = t.`bandFileTagId` AND p.`bandId` = 1 SET t.`bandFileTagId` = p.`id`;

UPDATE `FileUserTag` t JOIN `BandUser` p ON p.`userId` = t.`bandUserId` AND p.`bandId` = 1 SET t.`bandUserId` = p.`id`;

UPDATE `FileInstrumentTag` t JOIN `BandInstrument` p ON p.`globalInstrumentId` = t.`bandInstrumentId` AND p.`bandId` = 1 SET t.`bandInstrumentId` = p.`id`;

UPDATE `WikiPageTagAssignment` t JOIN `BandWikiPageTag` p ON p.`globalWikiPageTagId` = t.`bandWikiPageTagId` AND p.`bandId` = 1 SET t.`bandWikiPageTagId` = p.`id`;

UPDATE `EventTagAssignment` t JOIN `BandEventTag` p ON p.`globalEventTagId` = t.`bandEventTagId` AND p.`bandId` = 1 SET t.`bandEventTagId` = p.`id`;

UPDATE `Event` t JOIN `BandUserTag` p ON p.`globalUserTagId` = t.`expectedAttendanceUserTagId` AND p.`bandId` = 1 SET t.`expectedAttendanceUserTagId` = p.`id`;

UPDATE `Action` t JOIN `BandInstrument` p ON p.`globalInstrumentId` = t.`bandInstrumentId` AND p.`bandId` = 1 SET t.`bandInstrumentId` = p.`id`;

-- Exact duplicate instrument assignments keep the smallest row ID and its public ID.
DELETE duplicate_row FROM `BandUserInstrument` duplicate_row JOIN `BandUserInstrument` survivor
ON survivor.`bandUserId` = duplicate_row.`bandUserId` AND survivor.`bandInstrumentId` = duplicate_row.`bandInstrumentId` AND survivor.`id` < duplicate_row.`id`;
-- Entity-backed actions have known band context; platform/unknown history stays NULL.
UPDATE `Action` SET `bandId` = 1 WHERE `fileId` IS NOT NULL OR `eventId` IS NOT NULL OR `songId` IS NOT NULL OR `wikiPageId` IS NOT NULL
  OR `eventSegmentId` IS NOT NULL OR `customLinkId` IS NOT NULL OR `eventSongListId` IS NOT NULL OR `frontpageGalleryItemId` IS NOT NULL OR `menuLinkId` IS NOT NULL OR `bandInstrumentId` IS NOT NULL OR `setlistPlanId` IS NOT NULL;
-- Raw locale/language telemetry is preserved. Only an exact known IETF tag resolves.
UPDATE `Action` a JOIN `Locale` l ON LOWER(a.`locale`) = LOWER(l.`ietfTag`) SET a.`localeContextId` = l.`id`;

-- Move only settings present in the source, using the complete production manifest.

CREATE TEMPORARY TABLE `_lsmb_settings` AS SELECT `id`, `publicId`, `name`, `value` FROM `GlobalSetting`;
INSERT INTO `BandSetting` (`id`, `publicId`, `bandId`, `name`, `value`, `updatedAt`)
SELECT s.`id`, s.`publicId`, 1, m.`destinationName`, JSON_QUOTE(s.`value`), @lsmb_migration_at
FROM `_lsmb_settings` s JOIN `_lsmb_setting_manifest` m ON BINARY m.`sourceName` = BINARY s.`name` WHERE m.`hive` = 'band';
INSERT INTO `BandStaticLocalizedStringValue` (`id`, `publicId`, `bandId`, `localeId`, `stringKey`, `blobValue`, `updatedAt`)
SELECT s.`id`, s.`publicId`, 1, 1, m.`destinationName`, s.`value`, @lsmb_migration_at
FROM `_lsmb_settings` s JOIN `_lsmb_setting_manifest` m ON BINARY m.`sourceName` = BINARY s.`name` WHERE m.`hive` = 'chrome';
CREATE TEMPORARY TABLE `_lsmb_global_setting_survivors` AS
SELECT MIN(s.`id`) AS `id`, m.`destinationName` FROM `_lsmb_settings` s JOIN `_lsmb_setting_manifest` m
ON BINARY m.`sourceName` = BINARY s.`name` WHERE m.`hive` = 'global' GROUP BY m.`destinationName`;
DELETE g FROM `GlobalSetting` g LEFT JOIN `_lsmb_global_setting_survivors` survivor ON survivor.`id` = g.`id` WHERE survivor.`id` IS NULL;
UPDATE `GlobalSetting` g JOIN `_lsmb_global_setting_survivors` survivor ON survivor.`id` = g.`id` JOIN `_lsmb_settings` s ON s.`id` = g.`id`
SET g.`name` = survivor.`destinationName`, g.`value` = JSON_QUOTE(s.`value`), g.`updatedAt` = @lsmb_migration_at;
-- UserSetting stays global with its original JSON types. BandUserSetting stays empty.
-- Remove cached grants without deleting session handles/tokens or unrelated metadata.
UPDATE `Session` SET `publicData` = JSON_SET(`publicData`, '$.permissionNames', JSON_ARRAY(), '$.permissions', JSON_ARRAY(), '$.showAdminControls', JSON_EXTRACT('false', '$'))
WHERE `publicData` IS NOT NULL AND JSON_VALID(`publicData`);

-- Preservation assertions run while the source string columns still exist.

INSERT INTO `_lsmb_assert` VALUES ('lsmb: localized text was not preserved byte-for-byte');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: localized text was not preserved byte-for-byte' WHERE EXISTS (SELECT 1 FROM `_lsmb_strings` s LEFT JOIN `DynamicLocalizedStringValue` g ON g.`stringId` = s.`stringId` AND g.`localeId` = 1 LEFT JOIN `BandDynamicLocalizedStringValue` b ON b.`stringId` = s.`stringId` AND b.`localeId` = 1 AND b.`bandId` = 1 WHERE s.`stringId` IS NULL OR NOT (BINARY s.`value` <=> BINARY IF(s.`bandValue`, COALESCE(b.`indexedValue`, b.`blobValue`), COALESCE(g.`indexedValue`, g.`blobValue`))));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: a membership is missing or became active unexpectedly');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: a membership is missing or became active unexpectedly' WHERE EXISTS (SELECT 1 FROM `User` u LEFT JOIN `BandUser` b ON b.`userId` = u.`id` AND b.`bandId` = 1 WHERE b.`id` IS NULL OR b.`isDeleted` <> (u.`isDeleted` OR u.`mergedIntoUserId` IS NOT NULL));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: a global or band role identity was lost');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: a global or band role identity was lost' WHERE EXISTS (SELECT 1 FROM `_lsmb_identities` s LEFT JOIN `GlobalRole` g ON g.`id` = s.`id` LEFT JOIN `BandRole` b ON b.`id` = s.`id` WHERE s.`tableName` = 'Role' AND NOT (BINARY s.`publicId` <=> BINARY COALESCE(g.`publicId`, b.`publicId`)));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: a global or band grant identity was lost');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: a global or band grant identity was lost' WHERE EXISTS (SELECT 1 FROM `_lsmb_identities` s LEFT JOIN `GlobalRolePermission` g ON g.`id` = s.`id` LEFT JOIN `BandRolePermission` b ON b.`id` = s.`id` WHERE s.`tableName` = 'RolePermission' AND NOT (BINARY s.`publicId` <=> BINARY COALESCE(g.`publicId`, b.`publicId`)));

-- Compare encoded JSON: MariaDB 10.11 JSON_UNQUOTE loses supplementary Unicode.

INSERT INTO `_lsmb_assert` VALUES ('lsmb: migrated settings were not preserved');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: migrated settings were not preserved' WHERE EXISTS (SELECT 1 FROM `_lsmb_settings` s JOIN `_lsmb_setting_manifest` m ON BINARY m.`sourceName` = BINARY s.`name` LEFT JOIN `GlobalSetting` g ON BINARY g.`name` = BINARY m.`destinationName` LEFT JOIN `BandSetting` b ON BINARY b.`name` = BINARY m.`destinationName` AND b.`bandId` = 1 LEFT JOIN `BandStaticLocalizedStringValue` v ON BINARY v.`stringKey` = BINARY m.`destinationName` AND v.`bandId` = 1 AND v.`localeId` = 1 WHERE (m.`hive` = 'global' AND NOT (BINARY g.`value` <=> BINARY JSON_QUOTE(s.`value`))) OR (m.`hive` = 'band' AND NOT (BINARY b.`value` <=> BINARY JSON_QUOTE(s.`value`))) OR (m.`hive` = 'chrome' AND NOT (BINARY v.`blobValue` <=> BINARY s.`value`)));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: identity lost in Permission');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: identity lost in Permission' WHERE EXISTS (SELECT 1 FROM `_lsmb_identities` s LEFT JOIN `Permission` t ON t.`id` = s.`id` WHERE s.`tableName` = 'Permission' AND NOT (BINARY t.`publicId` <=> BINARY s.`publicId`));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: identity lost in UserTag');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: identity lost in UserTag' WHERE EXISTS (SELECT 1 FROM `_lsmb_identities` s LEFT JOIN `GlobalUserTag` t ON t.`id` = s.`id` WHERE s.`tableName` = 'UserTag' AND NOT (BINARY t.`publicId` <=> BINARY s.`publicId`));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: identity lost in UserTagAssignment');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: identity lost in UserTagAssignment' WHERE EXISTS (SELECT 1 FROM `_lsmb_identities` s LEFT JOIN `BandUserTagAssignment` t ON t.`id` = s.`id` WHERE s.`tableName` = 'UserTagAssignment' AND NOT (BINARY t.`publicId` <=> BINARY s.`publicId`));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: identity lost in User');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: identity lost in User' WHERE EXISTS (SELECT 1 FROM `_lsmb_identities` s LEFT JOIN `User` t ON t.`id` = s.`id` WHERE s.`tableName` = 'User' AND NOT (BINARY t.`publicId` <=> BINARY s.`publicId`));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: identity lost in UserSignInMethod');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: identity lost in UserSignInMethod' WHERE EXISTS (SELECT 1 FROM `_lsmb_identities` s LEFT JOIN `UserSignInMethod` t ON t.`id` = s.`id` WHERE s.`tableName` = 'UserSignInMethod' AND NOT (BINARY t.`publicId` <=> BINARY s.`publicId`));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: identity lost in Song');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: identity lost in Song' WHERE EXISTS (SELECT 1 FROM `_lsmb_identities` s LEFT JOIN `Song` t ON t.`id` = s.`id` WHERE s.`tableName` = 'Song' AND NOT (BINARY t.`publicId` <=> BINARY s.`publicId`));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: identity lost in SongCreditType');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: identity lost in SongCreditType' WHERE EXISTS (SELECT 1 FROM `_lsmb_identities` s LEFT JOIN `SongCreditType` t ON t.`id` = s.`id` WHERE s.`tableName` = 'SongCreditType' AND NOT (BINARY t.`publicId` <=> BINARY s.`publicId`));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: identity lost in SongCredit');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: identity lost in SongCredit' WHERE EXISTS (SELECT 1 FROM `_lsmb_identities` s LEFT JOIN `SongCredit` t ON t.`id` = s.`id` WHERE s.`tableName` = 'SongCredit' AND NOT (BINARY t.`publicId` <=> BINARY s.`publicId`));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: identity lost in SongTag');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: identity lost in SongTag' WHERE EXISTS (SELECT 1 FROM `_lsmb_identities` s LEFT JOIN `GlobalSongTag` t ON t.`id` = s.`id` WHERE s.`tableName` = 'SongTag' AND NOT (BINARY t.`publicId` <=> BINARY s.`publicId`));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: identity lost in SongTagAssociation');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: identity lost in SongTagAssociation' WHERE EXISTS (SELECT 1 FROM `_lsmb_identities` s LEFT JOIN `BandSongTagAssociation` t ON t.`id` = s.`id` WHERE s.`tableName` = 'SongTagAssociation' AND NOT (BINARY t.`publicId` <=> BINARY s.`publicId`));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: identity lost in InstrumentFunctionalGroup');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: identity lost in InstrumentFunctionalGroup' WHERE EXISTS (SELECT 1 FROM `_lsmb_identities` s LEFT JOIN `GlobalInstrumentFunctionalGroup` t ON t.`id` = s.`id` WHERE s.`tableName` = 'InstrumentFunctionalGroup' AND NOT (BINARY t.`publicId` <=> BINARY s.`publicId`));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: identity lost in Instrument');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: identity lost in Instrument' WHERE EXISTS (SELECT 1 FROM `_lsmb_identities` s LEFT JOIN `GlobalInstrument` t ON t.`id` = s.`id` WHERE s.`tableName` = 'Instrument' AND NOT (BINARY t.`publicId` <=> BINARY s.`publicId`));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: identity lost in Event');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: identity lost in Event' WHERE EXISTS (SELECT 1 FROM `_lsmb_identities` s LEFT JOIN `Event` t ON t.`id` = s.`id` WHERE s.`tableName` = 'Event' AND NOT (BINARY t.`publicId` <=> BINARY s.`publicId`));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: identity lost in EventSegment');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: identity lost in EventSegment' WHERE EXISTS (SELECT 1 FROM `_lsmb_identities` s LEFT JOIN `EventSegment` t ON t.`id` = s.`id` WHERE s.`tableName` = 'EventSegment' AND NOT (BINARY t.`publicId` <=> BINARY s.`publicId`));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: identity lost in EventType');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: identity lost in EventType' WHERE EXISTS (SELECT 1 FROM `_lsmb_identities` s LEFT JOIN `EventType` t ON t.`id` = s.`id` WHERE s.`tableName` = 'EventType' AND NOT (BINARY t.`publicId` <=> BINARY s.`publicId`));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: identity lost in EventStatus');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: identity lost in EventStatus' WHERE EXISTS (SELECT 1 FROM `_lsmb_identities` s LEFT JOIN `EventStatus` t ON t.`id` = s.`id` WHERE s.`tableName` = 'EventStatus' AND NOT (BINARY t.`publicId` <=> BINARY s.`publicId`));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: identity lost in EventTag');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: identity lost in EventTag' WHERE EXISTS (SELECT 1 FROM `_lsmb_identities` s LEFT JOIN `GlobalEventTag` t ON t.`id` = s.`id` WHERE s.`tableName` = 'EventTag' AND NOT (BINARY t.`publicId` <=> BINARY s.`publicId`));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: identity lost in EventTagAssignment');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: identity lost in EventTagAssignment' WHERE EXISTS (SELECT 1 FROM `_lsmb_identities` s LEFT JOIN `EventTagAssignment` t ON t.`id` = s.`id` WHERE s.`tableName` = 'EventTagAssignment' AND NOT (BINARY t.`publicId` <=> BINARY s.`publicId`));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: identity lost in EventSongList');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: identity lost in EventSongList' WHERE EXISTS (SELECT 1 FROM `_lsmb_identities` s LEFT JOIN `EventSongList` t ON t.`id` = s.`id` WHERE s.`tableName` = 'EventSongList' AND NOT (BINARY t.`publicId` <=> BINARY s.`publicId`));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: identity lost in EventSongListSong');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: identity lost in EventSongListSong' WHERE EXISTS (SELECT 1 FROM `_lsmb_identities` s LEFT JOIN `EventSongListSong` t ON t.`id` = s.`id` WHERE s.`tableName` = 'EventSongListSong' AND NOT (BINARY t.`publicId` <=> BINARY s.`publicId`));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: identity lost in EventSongListDivider');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: identity lost in EventSongListDivider' WHERE EXISTS (SELECT 1 FROM `_lsmb_identities` s LEFT JOIN `EventSongListDivider` t ON t.`id` = s.`id` WHERE s.`tableName` = 'EventSongListDivider' AND NOT (BINARY t.`publicId` <=> BINARY s.`publicId`));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: identity lost in EventAttendance');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: identity lost in EventAttendance' WHERE EXISTS (SELECT 1 FROM `_lsmb_identities` s LEFT JOIN `EventAttendance` t ON t.`id` = s.`id` WHERE s.`tableName` = 'EventAttendance' AND NOT (BINARY t.`publicId` <=> BINARY s.`publicId`));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: identity lost in EventUserResponse');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: identity lost in EventUserResponse' WHERE EXISTS (SELECT 1 FROM `_lsmb_identities` s LEFT JOIN `EventUserResponse` t ON t.`id` = s.`id` WHERE s.`tableName` = 'EventUserResponse' AND NOT (BINARY t.`publicId` <=> BINARY s.`publicId`));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: identity lost in EventSegmentUserResponse');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: identity lost in EventSegmentUserResponse' WHERE EXISTS (SELECT 1 FROM `_lsmb_identities` s LEFT JOIN `EventSegmentUserResponse` t ON t.`id` = s.`id` WHERE s.`tableName` = 'EventSegmentUserResponse' AND NOT (BINARY t.`publicId` <=> BINARY s.`publicId`));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: identity lost in FileTag');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: identity lost in FileTag' WHERE EXISTS (SELECT 1 FROM `_lsmb_identities` s LEFT JOIN `GlobalFileTag` t ON t.`id` = s.`id` WHERE s.`tableName` = 'FileTag' AND NOT (BINARY t.`publicId` <=> BINARY s.`publicId`));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: identity lost in FileTagAssignment');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: identity lost in FileTagAssignment' WHERE EXISTS (SELECT 1 FROM `_lsmb_identities` s LEFT JOIN `BandFileTagAssignment` t ON t.`id` = s.`id` WHERE s.`tableName` = 'FileTagAssignment' AND NOT (BINARY t.`publicId` <=> BINARY s.`publicId`));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: identity lost in File');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: identity lost in File' WHERE EXISTS (SELECT 1 FROM `_lsmb_identities` s LEFT JOIN `File` t ON t.`id` = s.`id` WHERE s.`tableName` = 'File' AND NOT (BINARY t.`publicId` <=> BINARY s.`publicId`));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: identity lost in FileUserTag');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: identity lost in FileUserTag' WHERE EXISTS (SELECT 1 FROM `_lsmb_identities` s LEFT JOIN `FileUserTag` t ON t.`id` = s.`id` WHERE s.`tableName` = 'FileUserTag' AND NOT (BINARY t.`publicId` <=> BINARY s.`publicId`));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: identity lost in FileSongTag');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: identity lost in FileSongTag' WHERE EXISTS (SELECT 1 FROM `_lsmb_identities` s LEFT JOIN `FileSongTag` t ON t.`id` = s.`id` WHERE s.`tableName` = 'FileSongTag' AND NOT (BINARY t.`publicId` <=> BINARY s.`publicId`));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: identity lost in FileEventTag');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: identity lost in FileEventTag' WHERE EXISTS (SELECT 1 FROM `_lsmb_identities` s LEFT JOIN `FileEventTag` t ON t.`id` = s.`id` WHERE s.`tableName` = 'FileEventTag' AND NOT (BINARY t.`publicId` <=> BINARY s.`publicId`));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: identity lost in FileInstrumentTag');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: identity lost in FileInstrumentTag' WHERE EXISTS (SELECT 1 FROM `_lsmb_identities` s LEFT JOIN `FileInstrumentTag` t ON t.`id` = s.`id` WHERE s.`tableName` = 'FileInstrumentTag' AND NOT (BINARY t.`publicId` <=> BINARY s.`publicId`));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: identity lost in FileWikiPageTag');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: identity lost in FileWikiPageTag' WHERE EXISTS (SELECT 1 FROM `_lsmb_identities` s LEFT JOIN `FileWikiPageTag` t ON t.`id` = s.`id` WHERE s.`tableName` = 'FileWikiPageTag' AND NOT (BINARY t.`publicId` <=> BINARY s.`publicId`));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: identity lost in FrontpageGalleryItem');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: identity lost in FrontpageGalleryItem' WHERE EXISTS (SELECT 1 FROM `_lsmb_identities` s LEFT JOIN `FrontpageGalleryItem` t ON t.`id` = s.`id` WHERE s.`tableName` = 'FrontpageGalleryItem' AND NOT (BINARY t.`publicId` <=> BINARY s.`publicId`));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: identity lost in CustomLink');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: identity lost in CustomLink' WHERE EXISTS (SELECT 1 FROM `_lsmb_identities` s LEFT JOIN `CustomLink` t ON t.`id` = s.`id` WHERE s.`tableName` = 'CustomLink' AND NOT (BINARY t.`publicId` <=> BINARY s.`publicId`));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: identity lost in WikiPage');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: identity lost in WikiPage' WHERE EXISTS (SELECT 1 FROM `_lsmb_identities` s LEFT JOIN `WikiPage` t ON t.`id` = s.`id` WHERE s.`tableName` = 'WikiPage' AND NOT (BINARY t.`publicId` <=> BINARY s.`publicId`));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: identity lost in WikiPageRevision');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: identity lost in WikiPageRevision' WHERE EXISTS (SELECT 1 FROM `_lsmb_identities` s LEFT JOIN `WikiPageRevision` t ON t.`id` = s.`id` WHERE s.`tableName` = 'WikiPageRevision' AND NOT (BINARY t.`publicId` <=> BINARY s.`publicId`));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: identity lost in WikiPageTag');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: identity lost in WikiPageTag' WHERE EXISTS (SELECT 1 FROM `_lsmb_identities` s LEFT JOIN `GlobalWikiPageTag` t ON t.`id` = s.`id` WHERE s.`tableName` = 'WikiPageTag' AND NOT (BINARY t.`publicId` <=> BINARY s.`publicId`));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: identity lost in WikiPageTagAssignment');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: identity lost in WikiPageTagAssignment' WHERE EXISTS (SELECT 1 FROM `_lsmb_identities` s LEFT JOIN `WikiPageTagAssignment` t ON t.`id` = s.`id` WHERE s.`tableName` = 'WikiPageTagAssignment' AND NOT (BINARY t.`publicId` <=> BINARY s.`publicId`));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: identity lost in MenuLink');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: identity lost in MenuLink' WHERE EXISTS (SELECT 1 FROM `_lsmb_identities` s LEFT JOIN `MenuLink` t ON t.`id` = s.`id` WHERE s.`tableName` = 'MenuLink' AND NOT (BINARY t.`publicId` <=> BINARY s.`publicId`));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: identity lost in SetlistPlanGroup');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: identity lost in SetlistPlanGroup' WHERE EXISTS (SELECT 1 FROM `_lsmb_identities` s LEFT JOIN `SetlistPlanGroup` t ON t.`id` = s.`id` WHERE s.`tableName` = 'SetlistPlanGroup' AND NOT (BINARY t.`publicId` <=> BINARY s.`publicId`));

INSERT INTO `_lsmb_assert` VALUES ('lsmb: identity lost in SetlistPlan');
INSERT INTO `_lsmb_assert` SELECT 'lsmb: identity lost in SetlistPlan' WHERE EXISTS (SELECT 1 FROM `_lsmb_identities` s LEFT JOIN `SetlistPlan` t ON t.`id` = s.`id` WHERE s.`tableName` = 'SetlistPlan' AND NOT (BINARY t.`publicId` <=> BINARY s.`publicId`));

-- Rebuild changed-table indexes, remove migrated columns, and require all backfilled fields.

SET @lsmb_drop_indexes = (SELECT GROUP_CONCAT(CONCAT('DROP INDEX `', REPLACE(i.`INDEX_NAME`, '`', '``'), '`') ORDER BY i.`INDEX_NAME` SEPARATOR ', ')
FROM (SELECT DISTINCT `INDEX_NAME` FROM information_schema.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'GlobalRole' AND `INDEX_NAME` <> 'PRIMARY') i);
SET @lsmb_ddl = IF(@lsmb_drop_indexes IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `GlobalRole` ', @lsmb_drop_indexes));
PREPARE lsmb_statement FROM @lsmb_ddl;
EXECUTE lsmb_statement;
DEALLOCATE PREPARE lsmb_statement;

ALTER TABLE `GlobalRole`
  DROP COLUMN `name`,
  DROP COLUMN `description`,
  DROP COLUMN `significance`,
  MODIFY COLUMN `nameId` INTEGER NOT NULL,
  MODIFY COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false,
  MODIFY COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  MODIFY COLUMN `updatedAt` DATETIME(3) NOT NULL;

CREATE UNIQUE INDEX `GlobalRole_publicId_key` ON `GlobalRole`(`publicId`);

SET @lsmb_drop_indexes = (SELECT GROUP_CONCAT(CONCAT('DROP INDEX `', REPLACE(i.`INDEX_NAME`, '`', '``'), '`') ORDER BY i.`INDEX_NAME` SEPARATOR ', ')
FROM (SELECT DISTINCT `INDEX_NAME` FROM information_schema.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'Permission' AND `INDEX_NAME` <> 'PRIMARY') i);
SET @lsmb_ddl = IF(@lsmb_drop_indexes IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `Permission` ', @lsmb_drop_indexes));
PREPARE lsmb_statement FROM @lsmb_ddl;
EXECUTE lsmb_statement;
DEALLOCATE PREPARE lsmb_statement;

ALTER TABLE `Permission`
  DROP COLUMN `description`,
  MODIFY COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false,
  MODIFY COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  MODIFY COLUMN `updatedAt` DATETIME(3) NOT NULL;

CREATE UNIQUE INDEX `Permission_publicId_key` ON `Permission`(`publicId`);

CREATE UNIQUE INDEX `Permission_name_key` ON `Permission`(`name`);

CREATE INDEX `Permission_name_idx` ON `Permission`(`name`);

CREATE INDEX `Permission_significance_idx` ON `Permission`(`significance`);

CREATE INDEX `Permission_sortOrder_idx` ON `Permission`(`sortOrder`);

SET @lsmb_drop_indexes = (SELECT GROUP_CONCAT(CONCAT('DROP INDEX `', REPLACE(i.`INDEX_NAME`, '`', '``'), '`') ORDER BY i.`INDEX_NAME` SEPARATOR ', ')
FROM (SELECT DISTINCT `INDEX_NAME` FROM information_schema.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'GlobalRolePermission' AND `INDEX_NAME` <> 'PRIMARY') i);
SET @lsmb_ddl = IF(@lsmb_drop_indexes IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `GlobalRolePermission` ', @lsmb_drop_indexes));
PREPARE lsmb_statement FROM @lsmb_ddl;
EXECUTE lsmb_statement;
DEALLOCATE PREPARE lsmb_statement;

ALTER TABLE `GlobalRolePermission`
  MODIFY COLUMN `updatedAt` DATETIME(3) NOT NULL;

CREATE UNIQUE INDEX `GlobalRolePermission_publicId_key` ON `GlobalRolePermission`(`publicId`);

CREATE UNIQUE INDEX `GlobalRolePermission_globalRoleId_permissionId_key` ON `GlobalRolePermission`(`globalRoleId`, `permissionId`);

SET @lsmb_drop_indexes = (SELECT GROUP_CONCAT(CONCAT('DROP INDEX `', REPLACE(i.`INDEX_NAME`, '`', '``'), '`') ORDER BY i.`INDEX_NAME` SEPARATOR ', ')
FROM (SELECT DISTINCT `INDEX_NAME` FROM information_schema.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'Action' AND `INDEX_NAME` <> 'PRIMARY') i);
SET @lsmb_ddl = IF(@lsmb_drop_indexes IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `Action` ', @lsmb_drop_indexes));
PREPARE lsmb_statement FROM @lsmb_ddl;
EXECUTE lsmb_statement;
DEALLOCATE PREPARE lsmb_statement;

CREATE INDEX `Action_feature_createdAt_userId_bandId_localeContextId_conte_idx` ON `Action`(`feature`, `createdAt`, `userId`, `bandId`, `localeContextId`, `context`, `pointerType`, `deviceClass`, `browserName`, `operatingSystem`, `language`, `locale`, `timezone`);

SET @lsmb_drop_indexes = (SELECT GROUP_CONCAT(CONCAT('DROP INDEX `', REPLACE(i.`INDEX_NAME`, '`', '``'), '`') ORDER BY i.`INDEX_NAME` SEPARATOR ', ')
FROM (SELECT DISTINCT `INDEX_NAME` FROM information_schema.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'GlobalUserTag' AND `INDEX_NAME` <> 'PRIMARY') i);
SET @lsmb_ddl = IF(@lsmb_drop_indexes IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `GlobalUserTag` ', @lsmb_drop_indexes));
PREPARE lsmb_statement FROM @lsmb_ddl;
EXECUTE lsmb_statement;
DEALLOCATE PREPARE lsmb_statement;

ALTER TABLE `GlobalUserTag`
  DROP COLUMN `text`,
  DROP COLUMN `description`,
  MODIFY COLUMN `nameId` INTEGER NOT NULL,
  MODIFY COLUMN `descriptionId` INTEGER NOT NULL;

CREATE UNIQUE INDEX `GlobalUserTag_publicId_key` ON `GlobalUserTag`(`publicId`);

CREATE INDEX `GlobalUserTag_nameId_idx` ON `GlobalUserTag`(`nameId`);

CREATE INDEX `GlobalUserTag_sortOrder_idx` ON `GlobalUserTag`(`sortOrder`);

SET @lsmb_drop_indexes = (SELECT GROUP_CONCAT(CONCAT('DROP INDEX `', REPLACE(i.`INDEX_NAME`, '`', '``'), '`') ORDER BY i.`INDEX_NAME` SEPARATOR ', ')
FROM (SELECT DISTINCT `INDEX_NAME` FROM information_schema.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'BandUserTagAssignment' AND `INDEX_NAME` <> 'PRIMARY') i);
SET @lsmb_ddl = IF(@lsmb_drop_indexes IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `BandUserTagAssignment` ', @lsmb_drop_indexes));
PREPARE lsmb_statement FROM @lsmb_ddl;
EXECUTE lsmb_statement;
DEALLOCATE PREPARE lsmb_statement;

CREATE UNIQUE INDEX `BandUserTagAssignment_publicId_key` ON `BandUserTagAssignment`(`publicId`);

CREATE UNIQUE INDEX `BandUserTagAssignment_bandUserId_bandUserTagId_key` ON `BandUserTagAssignment`(`bandUserId`, `bandUserTagId`);

SET @lsmb_drop_indexes = (SELECT GROUP_CONCAT(CONCAT('DROP INDEX `', REPLACE(i.`INDEX_NAME`, '`', '``'), '`') ORDER BY i.`INDEX_NAME` SEPARATOR ', ')
FROM (SELECT DISTINCT `INDEX_NAME` FROM information_schema.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'User' AND `INDEX_NAME` <> 'PRIMARY') i);
SET @lsmb_ddl = IF(@lsmb_drop_indexes IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `User` ', @lsmb_drop_indexes));
PREPARE lsmb_statement FROM @lsmb_ddl;
EXECUTE lsmb_statement;
DEALLOCATE PREPARE lsmb_statement;

CREATE UNIQUE INDEX `User_publicId_key` ON `User`(`publicId`);

CREATE INDEX `User_name_idx` ON `User`(`name`);

CREATE INDEX `User_isDeleted_idx` ON `User`(`isDeleted`);

CREATE INDEX `User_email_idx` ON `User`(`email`);

CREATE INDEX `User_phone_idx` ON `User`(`phone`);

CREATE UNIQUE INDEX `User_accessToken_key` ON `User`(`accessToken`);

CREATE UNIQUE INDEX `User_uid_key` ON `User`(`uid`);

SET @lsmb_drop_indexes = (SELECT GROUP_CONCAT(CONCAT('DROP INDEX `', REPLACE(i.`INDEX_NAME`, '`', '``'), '`') ORDER BY i.`INDEX_NAME` SEPARATOR ', ')
FROM (SELECT DISTINCT `INDEX_NAME` FROM information_schema.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'UserSetting' AND `INDEX_NAME` <> 'PRIMARY') i);
SET @lsmb_ddl = IF(@lsmb_drop_indexes IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `UserSetting` ', @lsmb_drop_indexes));
PREPARE lsmb_statement FROM @lsmb_ddl;
EXECUTE lsmb_statement;
DEALLOCATE PREPARE lsmb_statement;

ALTER TABLE `UserSetting`
  MODIFY COLUMN `updatedAt` DATETIME(3) NOT NULL;

CREATE UNIQUE INDEX `UserSetting_userId_name_key` ON `UserSetting`(`userId`, `name`);

SET @lsmb_drop_indexes = (SELECT GROUP_CONCAT(CONCAT('DROP INDEX `', REPLACE(i.`INDEX_NAME`, '`', '``'), '`') ORDER BY i.`INDEX_NAME` SEPARATOR ', ')
FROM (SELECT DISTINCT `INDEX_NAME` FROM information_schema.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'GlobalSetting' AND `INDEX_NAME` <> 'PRIMARY') i);
SET @lsmb_ddl = IF(@lsmb_drop_indexes IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `GlobalSetting` ', @lsmb_drop_indexes));
PREPARE lsmb_statement FROM @lsmb_ddl;
EXECUTE lsmb_statement;
DEALLOCATE PREPARE lsmb_statement;

ALTER TABLE `GlobalSetting`
  MODIFY COLUMN `updatedAt` DATETIME(3) NOT NULL;

CREATE UNIQUE INDEX `GlobalSetting_publicId_key` ON `GlobalSetting`(`publicId`);

CREATE UNIQUE INDEX `GlobalSetting_name_key` ON `GlobalSetting`(`name`);

CREATE INDEX `GlobalSetting_name_idx` ON `GlobalSetting`(`name`);

SET @lsmb_drop_indexes = (SELECT GROUP_CONCAT(CONCAT('DROP INDEX `', REPLACE(i.`INDEX_NAME`, '`', '``'), '`') ORDER BY i.`INDEX_NAME` SEPARATOR ', ')
FROM (SELECT DISTINCT `INDEX_NAME` FROM information_schema.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'Song' AND `INDEX_NAME` <> 'PRIMARY') i);
SET @lsmb_ddl = IF(@lsmb_drop_indexes IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `Song` ', @lsmb_drop_indexes));
PREPARE lsmb_statement FROM @lsmb_ddl;
EXECUTE lsmb_statement;
DEALLOCATE PREPARE lsmb_statement;

ALTER TABLE `Song`
  MODIFY COLUMN `bandId` INTEGER NOT NULL,
  MODIFY COLUMN `updatedAt` DATETIME(3) NOT NULL;

CREATE UNIQUE INDEX `Song_publicId_key` ON `Song`(`publicId`);

CREATE INDEX `Song_name_idx` ON `Song`(`name`);

CREATE INDEX `Song_aliases_idx` ON `Song`(`aliases`);

CREATE INDEX `Song_isDeleted_idx` ON `Song`(`isDeleted`);

CREATE INDEX `Song_visiblePermissionId_idx` ON `Song`(`visiblePermissionId`);

CREATE INDEX `Song_bandId_idx` ON `Song`(`bandId`);

CREATE UNIQUE INDEX `Song_id_bandId_key` ON `Song`(`id`, `bandId`);

SET @lsmb_drop_indexes = (SELECT GROUP_CONCAT(CONCAT('DROP INDEX `', REPLACE(i.`INDEX_NAME`, '`', '``'), '`') ORDER BY i.`INDEX_NAME` SEPARATOR ', ')
FROM (SELECT DISTINCT `INDEX_NAME` FROM information_schema.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'SongCreditType' AND `INDEX_NAME` <> 'PRIMARY') i);
SET @lsmb_ddl = IF(@lsmb_drop_indexes IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `SongCreditType` ', @lsmb_drop_indexes));
PREPARE lsmb_statement FROM @lsmb_ddl;
EXECUTE lsmb_statement;
DEALLOCATE PREPARE lsmb_statement;

ALTER TABLE `SongCreditType`
  DROP COLUMN `text`,
  DROP COLUMN `description`,
  DROP COLUMN `significance`,
  MODIFY COLUMN `nameId` INTEGER NOT NULL,
  MODIFY COLUMN `descriptionId` INTEGER NOT NULL;

CREATE UNIQUE INDEX `SongCreditType_publicId_key` ON `SongCreditType`(`publicId`);

CREATE INDEX `SongCreditType_sortOrder_idx` ON `SongCreditType`(`sortOrder`);

SET @lsmb_drop_indexes = (SELECT GROUP_CONCAT(CONCAT('DROP INDEX `', REPLACE(i.`INDEX_NAME`, '`', '``'), '`') ORDER BY i.`INDEX_NAME` SEPARATOR ', ')
FROM (SELECT DISTINCT `INDEX_NAME` FROM information_schema.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'GlobalSongTag' AND `INDEX_NAME` <> 'PRIMARY') i);
SET @lsmb_ddl = IF(@lsmb_drop_indexes IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `GlobalSongTag` ', @lsmb_drop_indexes));
PREPARE lsmb_statement FROM @lsmb_ddl;
EXECUTE lsmb_statement;
DEALLOCATE PREPARE lsmb_statement;

ALTER TABLE `GlobalSongTag`
  DROP COLUMN `text`,
  DROP COLUMN `description`,
  DROP COLUMN `significance`,
  MODIFY COLUMN `nameId` INTEGER NOT NULL,
  MODIFY COLUMN `descriptionId` INTEGER NOT NULL;

CREATE UNIQUE INDEX `GlobalSongTag_publicId_key` ON `GlobalSongTag`(`publicId`);

CREATE INDEX `GlobalSongTag_sortOrder_idx` ON `GlobalSongTag`(`sortOrder`);

SET @lsmb_drop_indexes = (SELECT GROUP_CONCAT(CONCAT('DROP INDEX `', REPLACE(i.`INDEX_NAME`, '`', '``'), '`') ORDER BY i.`INDEX_NAME` SEPARATOR ', ')
FROM (SELECT DISTINCT `INDEX_NAME` FROM information_schema.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'BandSongTagAssociation' AND `INDEX_NAME` <> 'PRIMARY') i);
SET @lsmb_ddl = IF(@lsmb_drop_indexes IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `BandSongTagAssociation` ', @lsmb_drop_indexes));
PREPARE lsmb_statement FROM @lsmb_ddl;
EXECUTE lsmb_statement;
DEALLOCATE PREPARE lsmb_statement;

CREATE UNIQUE INDEX `BandSongTagAssociation_publicId_key` ON `BandSongTagAssociation`(`publicId`);

CREATE UNIQUE INDEX `BandSongTagAssociation_bandSongTagId_songId_key` ON `BandSongTagAssociation`(`bandSongTagId`, `songId`);

SET @lsmb_drop_indexes = (SELECT GROUP_CONCAT(CONCAT('DROP INDEX `', REPLACE(i.`INDEX_NAME`, '`', '``'), '`') ORDER BY i.`INDEX_NAME` SEPARATOR ', ')
FROM (SELECT DISTINCT `INDEX_NAME` FROM information_schema.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'GlobalInstrumentFunctionalGroup' AND `INDEX_NAME` <> 'PRIMARY') i);
SET @lsmb_ddl = IF(@lsmb_drop_indexes IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `GlobalInstrumentFunctionalGroup` ', @lsmb_drop_indexes));
PREPARE lsmb_statement FROM @lsmb_ddl;
EXECUTE lsmb_statement;
DEALLOCATE PREPARE lsmb_statement;

ALTER TABLE `GlobalInstrumentFunctionalGroup`
  DROP COLUMN `name`,
  DROP COLUMN `description`,
  MODIFY COLUMN `nameId` INTEGER NOT NULL,
  MODIFY COLUMN `descriptionId` INTEGER NOT NULL;

CREATE UNIQUE INDEX `GlobalInstrumentFunctionalGroup_publicId_key` ON `GlobalInstrumentFunctionalGroup`(`publicId`);

CREATE INDEX `GlobalInstrumentFunctionalGroup_sortOrder_idx` ON `GlobalInstrumentFunctionalGroup`(`sortOrder`);

SET @lsmb_drop_indexes = (SELECT GROUP_CONCAT(CONCAT('DROP INDEX `', REPLACE(i.`INDEX_NAME`, '`', '``'), '`') ORDER BY i.`INDEX_NAME` SEPARATOR ', ')
FROM (SELECT DISTINCT `INDEX_NAME` FROM information_schema.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'GlobalInstrument' AND `INDEX_NAME` <> 'PRIMARY') i);
SET @lsmb_ddl = IF(@lsmb_drop_indexes IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `GlobalInstrument` ', @lsmb_drop_indexes));
PREPARE lsmb_statement FROM @lsmb_ddl;
EXECUTE lsmb_statement;
DEALLOCATE PREPARE lsmb_statement;

ALTER TABLE `GlobalInstrument`
  DROP COLUMN `name`,
  DROP COLUMN `description`,
  MODIFY COLUMN `nameId` INTEGER NOT NULL,
  MODIFY COLUMN `descriptionId` INTEGER NOT NULL;

CREATE UNIQUE INDEX `GlobalInstrument_publicId_key` ON `GlobalInstrument`(`publicId`);

CREATE INDEX `GlobalInstrument_sortOrder_idx` ON `GlobalInstrument`(`sortOrder`);

CREATE INDEX `GlobalInstrument_functionalGroupId_idx` ON `GlobalInstrument`(`functionalGroupId`);

SET @lsmb_drop_indexes = (SELECT GROUP_CONCAT(CONCAT('DROP INDEX `', REPLACE(i.`INDEX_NAME`, '`', '``'), '`') ORDER BY i.`INDEX_NAME` SEPARATOR ', ')
FROM (SELECT DISTINCT `INDEX_NAME` FROM information_schema.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'BandUserInstrument' AND `INDEX_NAME` <> 'PRIMARY') i);
SET @lsmb_ddl = IF(@lsmb_drop_indexes IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `BandUserInstrument` ', @lsmb_drop_indexes));
PREPARE lsmb_statement FROM @lsmb_ddl;
EXECUTE lsmb_statement;
DEALLOCATE PREPARE lsmb_statement;

CREATE UNIQUE INDEX `BandUserInstrument_publicId_key` ON `BandUserInstrument`(`publicId`);

CREATE INDEX `BandUserInstrument_bandUserId_idx` ON `BandUserInstrument`(`bandUserId`);

CREATE UNIQUE INDEX `BandUserInstrument_bandUserId_bandInstrumentId_key` ON `BandUserInstrument`(`bandUserId`, `bandInstrumentId`);

SET @lsmb_drop_indexes = (SELECT GROUP_CONCAT(CONCAT('DROP INDEX `', REPLACE(i.`INDEX_NAME`, '`', '``'), '`') ORDER BY i.`INDEX_NAME` SEPARATOR ', ')
FROM (SELECT DISTINCT `INDEX_NAME` FROM information_schema.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'Event' AND `INDEX_NAME` <> 'PRIMARY') i);
SET @lsmb_ddl = IF(@lsmb_drop_indexes IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `Event` ', @lsmb_drop_indexes));
PREPARE lsmb_statement FROM @lsmb_ddl;
EXECUTE lsmb_statement;
DEALLOCATE PREPARE lsmb_statement;

ALTER TABLE `Event`
  DROP COLUMN `segmentBehavior`,
  MODIFY COLUMN `bandId` INTEGER NOT NULL;

CREATE UNIQUE INDEX `Event_publicId_key` ON `Event`(`publicId`);

CREATE INDEX `Event_name_idx` ON `Event`(`name`);

CREATE INDEX `Event_typeId_idx` ON `Event`(`typeId`);

CREATE INDEX `Event_isDeleted_idx` ON `Event`(`isDeleted`);

CREATE INDEX `Event_statusId_idx` ON `Event`(`statusId`);

CREATE INDEX `Event_startsAt_idx` ON `Event`(`startsAt`);

CREATE INDEX `Event_endDateTime_idx` ON `Event`(`endDateTime`);

CREATE INDEX `Event_visiblePermissionId_idx` ON `Event`(`visiblePermissionId`);

CREATE INDEX `Event_frontpageVisible_idx` ON `Event`(`frontpageVisible`);

CREATE INDEX `Event_bandId_idx` ON `Event`(`bandId`);

CREATE UNIQUE INDEX `Event_uid_key` ON `Event`(`uid`);

CREATE UNIQUE INDEX `Event_descriptionWikiPageId_key` ON `Event`(`descriptionWikiPageId`);

CREATE UNIQUE INDEX `Event_id_bandId_key` ON `Event`(`id`, `bandId`);

SET @lsmb_drop_indexes = (SELECT GROUP_CONCAT(CONCAT('DROP INDEX `', REPLACE(i.`INDEX_NAME`, '`', '``'), '`') ORDER BY i.`INDEX_NAME` SEPARATOR ', ')
FROM (SELECT DISTINCT `INDEX_NAME` FROM information_schema.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'EventType' AND `INDEX_NAME` <> 'PRIMARY') i);
SET @lsmb_ddl = IF(@lsmb_drop_indexes IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `EventType` ', @lsmb_drop_indexes));
PREPARE lsmb_statement FROM @lsmb_ddl;
EXECUTE lsmb_statement;
DEALLOCATE PREPARE lsmb_statement;

ALTER TABLE `EventType`
  DROP COLUMN `text`,
  DROP COLUMN `description`,
  MODIFY COLUMN `nameId` INTEGER NOT NULL,
  MODIFY COLUMN `descriptionId` INTEGER NOT NULL;

CREATE UNIQUE INDEX `EventType_publicId_key` ON `EventType`(`publicId`);

CREATE INDEX `EventType_sortOrder_idx` ON `EventType`(`sortOrder`);

CREATE INDEX `EventType_significance_idx` ON `EventType`(`significance`);

CREATE INDEX `EventType_isDeleted_idx` ON `EventType`(`isDeleted`);

SET @lsmb_drop_indexes = (SELECT GROUP_CONCAT(CONCAT('DROP INDEX `', REPLACE(i.`INDEX_NAME`, '`', '``'), '`') ORDER BY i.`INDEX_NAME` SEPARATOR ', ')
FROM (SELECT DISTINCT `INDEX_NAME` FROM information_schema.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'EventStatus' AND `INDEX_NAME` <> 'PRIMARY') i);
SET @lsmb_ddl = IF(@lsmb_drop_indexes IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `EventStatus` ', @lsmb_drop_indexes));
PREPARE lsmb_statement FROM @lsmb_ddl;
EXECUTE lsmb_statement;
DEALLOCATE PREPARE lsmb_statement;

ALTER TABLE `EventStatus`
  DROP COLUMN `label`,
  DROP COLUMN `description`,
  MODIFY COLUMN `nameId` INTEGER NOT NULL,
  MODIFY COLUMN `descriptionId` INTEGER NOT NULL;

CREATE UNIQUE INDEX `EventStatus_publicId_key` ON `EventStatus`(`publicId`);

CREATE INDEX `EventStatus_sortOrder_idx` ON `EventStatus`(`sortOrder`);

CREATE INDEX `EventStatus_isDeleted_idx` ON `EventStatus`(`isDeleted`);

CREATE INDEX `EventStatus_significance_idx` ON `EventStatus`(`significance`);

SET @lsmb_drop_indexes = (SELECT GROUP_CONCAT(CONCAT('DROP INDEX `', REPLACE(i.`INDEX_NAME`, '`', '``'), '`') ORDER BY i.`INDEX_NAME` SEPARATOR ', ')
FROM (SELECT DISTINCT `INDEX_NAME` FROM information_schema.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'GlobalEventTag' AND `INDEX_NAME` <> 'PRIMARY') i);
SET @lsmb_ddl = IF(@lsmb_drop_indexes IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `GlobalEventTag` ', @lsmb_drop_indexes));
PREPARE lsmb_statement FROM @lsmb_ddl;
EXECUTE lsmb_statement;
DEALLOCATE PREPARE lsmb_statement;

ALTER TABLE `GlobalEventTag`
  DROP COLUMN `text`,
  DROP COLUMN `description`,
  DROP COLUMN `significance`,
  MODIFY COLUMN `nameId` INTEGER NOT NULL,
  MODIFY COLUMN `descriptionId` INTEGER NOT NULL;

CREATE UNIQUE INDEX `GlobalEventTag_publicId_key` ON `GlobalEventTag`(`publicId`);

CREATE INDEX `GlobalEventTag_sortOrder_idx` ON `GlobalEventTag`(`sortOrder`);

CREATE INDEX `GlobalEventTag_visibleOnFrontpage_idx` ON `GlobalEventTag`(`visibleOnFrontpage`);

SET @lsmb_drop_indexes = (SELECT GROUP_CONCAT(CONCAT('DROP INDEX `', REPLACE(i.`INDEX_NAME`, '`', '``'), '`') ORDER BY i.`INDEX_NAME` SEPARATOR ', ')
FROM (SELECT DISTINCT `INDEX_NAME` FROM information_schema.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'EventTagAssignment' AND `INDEX_NAME` <> 'PRIMARY') i);
SET @lsmb_ddl = IF(@lsmb_drop_indexes IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `EventTagAssignment` ', @lsmb_drop_indexes));
PREPARE lsmb_statement FROM @lsmb_ddl;
EXECUTE lsmb_statement;
DEALLOCATE PREPARE lsmb_statement;

CREATE UNIQUE INDEX `EventTagAssignment_publicId_key` ON `EventTagAssignment`(`publicId`);

CREATE UNIQUE INDEX `EventTagAssignment_eventId_bandEventTagId_key` ON `EventTagAssignment`(`eventId`, `bandEventTagId`);

SET @lsmb_drop_indexes = (SELECT GROUP_CONCAT(CONCAT('DROP INDEX `', REPLACE(i.`INDEX_NAME`, '`', '``'), '`') ORDER BY i.`INDEX_NAME` SEPARATOR ', ')
FROM (SELECT DISTINCT `INDEX_NAME` FROM information_schema.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'EventAttendance' AND `INDEX_NAME` <> 'PRIMARY') i);
SET @lsmb_ddl = IF(@lsmb_drop_indexes IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `EventAttendance` ', @lsmb_drop_indexes));
PREPARE lsmb_statement FROM @lsmb_ddl;
EXECUTE lsmb_statement;
DEALLOCATE PREPARE lsmb_statement;

ALTER TABLE `EventAttendance`
  DROP COLUMN `text`,
  DROP COLUMN `personalText`,
  DROP COLUMN `pastText`,
  DROP COLUMN `pastPersonalText`,
  DROP COLUMN `description`,
  MODIFY COLUMN `buttonCaptionId` INTEGER NOT NULL,
  MODIFY COLUMN `personalCaptionId` INTEGER NOT NULL,
  MODIFY COLUMN `pastCaptionId` INTEGER NOT NULL,
  MODIFY COLUMN `personalPastCaptionId` INTEGER NOT NULL,
  MODIFY COLUMN `descriptionId` INTEGER NOT NULL;

CREATE UNIQUE INDEX `EventAttendance_publicId_key` ON `EventAttendance`(`publicId`);

CREATE INDEX `EventAttendance_sortOrder_idx` ON `EventAttendance`(`sortOrder`);

CREATE INDEX `EventAttendance_strength_idx` ON `EventAttendance`(`strength`);

CREATE INDEX `EventAttendance_isDeleted_idx` ON `EventAttendance`(`isDeleted`);

SET @lsmb_drop_indexes = (SELECT GROUP_CONCAT(CONCAT('DROP INDEX `', REPLACE(i.`INDEX_NAME`, '`', '``'), '`') ORDER BY i.`INDEX_NAME` SEPARATOR ', ')
FROM (SELECT DISTINCT `INDEX_NAME` FROM information_schema.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'EventUserResponse' AND `INDEX_NAME` <> 'PRIMARY') i);
SET @lsmb_ddl = IF(@lsmb_drop_indexes IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `EventUserResponse` ', @lsmb_drop_indexes));
PREPARE lsmb_statement FROM @lsmb_ddl;
EXECUTE lsmb_statement;
DEALLOCATE PREPARE lsmb_statement;

CREATE UNIQUE INDEX `EventUserResponse_publicId_key` ON `EventUserResponse`(`publicId`);

CREATE UNIQUE INDEX `EventUserResponse_bandUserId_eventId_key` ON `EventUserResponse`(`bandUserId`, `eventId`);

SET @lsmb_drop_indexes = (SELECT GROUP_CONCAT(CONCAT('DROP INDEX `', REPLACE(i.`INDEX_NAME`, '`', '``'), '`') ORDER BY i.`INDEX_NAME` SEPARATOR ', ')
FROM (SELECT DISTINCT `INDEX_NAME` FROM information_schema.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'EventSegmentUserResponse' AND `INDEX_NAME` <> 'PRIMARY') i);
SET @lsmb_ddl = IF(@lsmb_drop_indexes IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `EventSegmentUserResponse` ', @lsmb_drop_indexes));
PREPARE lsmb_statement FROM @lsmb_ddl;
EXECUTE lsmb_statement;
DEALLOCATE PREPARE lsmb_statement;

ALTER TABLE `EventSegmentUserResponse`
  MODIFY COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  MODIFY COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

CREATE UNIQUE INDEX `EventSegmentUserResponse_publicId_key` ON `EventSegmentUserResponse`(`publicId`);

CREATE UNIQUE INDEX `EventSegmentUserResponse_bandUserId_eventSegmentId_key` ON `EventSegmentUserResponse`(`bandUserId`, `eventSegmentId`);

SET @lsmb_drop_indexes = (SELECT GROUP_CONCAT(CONCAT('DROP INDEX `', REPLACE(i.`INDEX_NAME`, '`', '``'), '`') ORDER BY i.`INDEX_NAME` SEPARATOR ', ')
FROM (SELECT DISTINCT `INDEX_NAME` FROM information_schema.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'GlobalFileTag' AND `INDEX_NAME` <> 'PRIMARY') i);
SET @lsmb_ddl = IF(@lsmb_drop_indexes IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `GlobalFileTag` ', @lsmb_drop_indexes));
PREPARE lsmb_statement FROM @lsmb_ddl;
EXECUTE lsmb_statement;
DEALLOCATE PREPARE lsmb_statement;

ALTER TABLE `GlobalFileTag`
  DROP COLUMN `text`,
  DROP COLUMN `description`,
  MODIFY COLUMN `nameId` INTEGER NOT NULL,
  MODIFY COLUMN `descriptionId` INTEGER NOT NULL;

CREATE UNIQUE INDEX `GlobalFileTag_publicId_key` ON `GlobalFileTag`(`publicId`);

CREATE INDEX `GlobalFileTag_significance_idx` ON `GlobalFileTag`(`significance`);

CREATE INDEX `GlobalFileTag_sortOrder_idx` ON `GlobalFileTag`(`sortOrder`);

SET @lsmb_drop_indexes = (SELECT GROUP_CONCAT(CONCAT('DROP INDEX `', REPLACE(i.`INDEX_NAME`, '`', '``'), '`') ORDER BY i.`INDEX_NAME` SEPARATOR ', ')
FROM (SELECT DISTINCT `INDEX_NAME` FROM information_schema.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'BandFileTagAssignment' AND `INDEX_NAME` <> 'PRIMARY') i);
SET @lsmb_ddl = IF(@lsmb_drop_indexes IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `BandFileTagAssignment` ', @lsmb_drop_indexes));
PREPARE lsmb_statement FROM @lsmb_ddl;
EXECUTE lsmb_statement;
DEALLOCATE PREPARE lsmb_statement;

CREATE UNIQUE INDEX `BandFileTagAssignment_publicId_key` ON `BandFileTagAssignment`(`publicId`);

CREATE UNIQUE INDEX `BandFileTagAssignment_fileId_bandFileTagId_key` ON `BandFileTagAssignment`(`fileId`, `bandFileTagId`);

SET @lsmb_drop_indexes = (SELECT GROUP_CONCAT(CONCAT('DROP INDEX `', REPLACE(i.`INDEX_NAME`, '`', '``'), '`') ORDER BY i.`INDEX_NAME` SEPARATOR ', ')
FROM (SELECT DISTINCT `INDEX_NAME` FROM information_schema.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'File' AND `INDEX_NAME` <> 'PRIMARY') i);
SET @lsmb_ddl = IF(@lsmb_drop_indexes IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `File` ', @lsmb_drop_indexes));
PREPARE lsmb_statement FROM @lsmb_ddl;
EXECUTE lsmb_statement;
DEALLOCATE PREPARE lsmb_statement;

ALTER TABLE `File`
  MODIFY COLUMN `bandId` INTEGER NOT NULL;

CREATE UNIQUE INDEX `File_publicId_key` ON `File`(`publicId`);

CREATE UNIQUE INDEX `File_storedLeafName_key` ON `File`(`storedLeafName`);

CREATE INDEX `File_fileLeafName_idx` ON `File`(`fileLeafName`);

CREATE INDEX `File_storedLeafName_idx` ON `File`(`storedLeafName`);

CREATE INDEX `File_isDeleted_idx` ON `File`(`isDeleted`);

CREATE INDEX `File_visiblePermissionId_idx` ON `File`(`visiblePermissionId`);

CREATE INDEX `File_mimeType_idx` ON `File`(`mimeType`);

CREATE INDEX `File_previewFileId_idx` ON `File`(`previewFileId`);

CREATE INDEX `File_parentFileId_idx` ON `File`(`parentFileId`);

CREATE INDEX `File_bandId_idx` ON `File`(`bandId`);

CREATE UNIQUE INDEX `File_id_bandId_key` ON `File`(`id`, `bandId`);

SET @lsmb_drop_indexes = (SELECT GROUP_CONCAT(CONCAT('DROP INDEX `', REPLACE(i.`INDEX_NAME`, '`', '``'), '`') ORDER BY i.`INDEX_NAME` SEPARATOR ', ')
FROM (SELECT DISTINCT `INDEX_NAME` FROM information_schema.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'FileUserTag' AND `INDEX_NAME` <> 'PRIMARY') i);
SET @lsmb_ddl = IF(@lsmb_drop_indexes IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `FileUserTag` ', @lsmb_drop_indexes));
PREPARE lsmb_statement FROM @lsmb_ddl;
EXECUTE lsmb_statement;
DEALLOCATE PREPARE lsmb_statement;

CREATE UNIQUE INDEX `FileUserTag_publicId_key` ON `FileUserTag`(`publicId`);

CREATE INDEX `FileUserTag_fileId_idx` ON `FileUserTag`(`fileId`);

CREATE INDEX `FileUserTag_bandUserId_idx` ON `FileUserTag`(`bandUserId`);

CREATE UNIQUE INDEX `FileUserTag_fileId_bandUserId_key` ON `FileUserTag`(`fileId`, `bandUserId`);

SET @lsmb_drop_indexes = (SELECT GROUP_CONCAT(CONCAT('DROP INDEX `', REPLACE(i.`INDEX_NAME`, '`', '``'), '`') ORDER BY i.`INDEX_NAME` SEPARATOR ', ')
FROM (SELECT DISTINCT `INDEX_NAME` FROM information_schema.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'FileInstrumentTag' AND `INDEX_NAME` <> 'PRIMARY') i);
SET @lsmb_ddl = IF(@lsmb_drop_indexes IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `FileInstrumentTag` ', @lsmb_drop_indexes));
PREPARE lsmb_statement FROM @lsmb_ddl;
EXECUTE lsmb_statement;
DEALLOCATE PREPARE lsmb_statement;

CREATE UNIQUE INDEX `FileInstrumentTag_publicId_key` ON `FileInstrumentTag`(`publicId`);

CREATE INDEX `FileInstrumentTag_fileId_idx` ON `FileInstrumentTag`(`fileId`);

CREATE INDEX `FileInstrumentTag_bandInstrumentId_idx` ON `FileInstrumentTag`(`bandInstrumentId`);

CREATE UNIQUE INDEX `FileInstrumentTag_fileId_bandInstrumentId_key` ON `FileInstrumentTag`(`fileId`, `bandInstrumentId`);

SET @lsmb_drop_indexes = (SELECT GROUP_CONCAT(CONCAT('DROP INDEX `', REPLACE(i.`INDEX_NAME`, '`', '``'), '`') ORDER BY i.`INDEX_NAME` SEPARATOR ', ')
FROM (SELECT DISTINCT `INDEX_NAME` FROM information_schema.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'CustomLink' AND `INDEX_NAME` <> 'PRIMARY') i);
SET @lsmb_ddl = IF(@lsmb_drop_indexes IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `CustomLink` ', @lsmb_drop_indexes));
PREPARE lsmb_statement FROM @lsmb_ddl;
EXECUTE lsmb_statement;
DEALLOCATE PREPARE lsmb_statement;

ALTER TABLE `CustomLink`
  MODIFY COLUMN `bandId` INTEGER NOT NULL,
  MODIFY COLUMN `slug` VARCHAR(767) NOT NULL;

CREATE UNIQUE INDEX `CustomLink_publicId_key` ON `CustomLink`(`publicId`);

CREATE INDEX `CustomLink_name_idx` ON `CustomLink`(`name`);

CREATE INDEX `CustomLink_fileId_idx` ON `CustomLink`(`fileId`);

CREATE INDEX `CustomLink_bandId_idx` ON `CustomLink`(`bandId`);

CREATE UNIQUE INDEX `CustomLink_bandId_slug_key` ON `CustomLink`(`bandId`, `slug`);

SET @lsmb_drop_indexes = (SELECT GROUP_CONCAT(CONCAT('DROP INDEX `', REPLACE(i.`INDEX_NAME`, '`', '``'), '`') ORDER BY i.`INDEX_NAME` SEPARATOR ', ')
FROM (SELECT DISTINCT `INDEX_NAME` FROM information_schema.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'WikiPage' AND `INDEX_NAME` <> 'PRIMARY') i);
SET @lsmb_ddl = IF(@lsmb_drop_indexes IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `WikiPage` ', @lsmb_drop_indexes));
PREPARE lsmb_statement FROM @lsmb_ddl;
EXECUTE lsmb_statement;
DEALLOCATE PREPARE lsmb_statement;

ALTER TABLE `WikiPage`
  MODIFY COLUMN `bandId` INTEGER NOT NULL,
  MODIFY COLUMN `slug` VARCHAR(767) NOT NULL;

CREATE UNIQUE INDEX `WikiPage_publicId_key` ON `WikiPage`(`publicId`);

CREATE INDEX `WikiPage_visiblePermissionId_idx` ON `WikiPage`(`visiblePermissionId`);

CREATE INDEX `WikiPage_namespace_idx` ON `WikiPage`(`namespace`);

CREATE INDEX `WikiPage_currentRevisionId_idx` ON `WikiPage`(`currentRevisionId`);

CREATE INDEX `WikiPage_lockedByUserId_idx` ON `WikiPage`(`lockedByUserId`);

CREATE INDEX `WikiPage_bandId_idx` ON `WikiPage`(`bandId`);

CREATE UNIQUE INDEX `WikiPage_bandId_slug_key` ON `WikiPage`(`bandId`, `slug`);

CREATE UNIQUE INDEX `WikiPage_currentRevisionId_key` ON `WikiPage`(`currentRevisionId`);

CREATE UNIQUE INDEX `WikiPage_id_bandId_key` ON `WikiPage`(`id`, `bandId`);

SET @lsmb_drop_indexes = (SELECT GROUP_CONCAT(CONCAT('DROP INDEX `', REPLACE(i.`INDEX_NAME`, '`', '``'), '`') ORDER BY i.`INDEX_NAME` SEPARATOR ', ')
FROM (SELECT DISTINCT `INDEX_NAME` FROM information_schema.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'GlobalWikiPageTag' AND `INDEX_NAME` <> 'PRIMARY') i);
SET @lsmb_ddl = IF(@lsmb_drop_indexes IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `GlobalWikiPageTag` ', @lsmb_drop_indexes));
PREPARE lsmb_statement FROM @lsmb_ddl;
EXECUTE lsmb_statement;
DEALLOCATE PREPARE lsmb_statement;

ALTER TABLE `GlobalWikiPageTag`
  DROP COLUMN `text`,
  DROP COLUMN `description`,
  DROP COLUMN `significance`,
  MODIFY COLUMN `nameId` INTEGER NOT NULL,
  MODIFY COLUMN `descriptionId` INTEGER NOT NULL;

CREATE UNIQUE INDEX `GlobalWikiPageTag_publicId_key` ON `GlobalWikiPageTag`(`publicId`);

CREATE INDEX `GlobalWikiPageTag_sortOrder_idx` ON `GlobalWikiPageTag`(`sortOrder`);

SET @lsmb_drop_indexes = (SELECT GROUP_CONCAT(CONCAT('DROP INDEX `', REPLACE(i.`INDEX_NAME`, '`', '``'), '`') ORDER BY i.`INDEX_NAME` SEPARATOR ', ')
FROM (SELECT DISTINCT `INDEX_NAME` FROM information_schema.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'WikiPageTagAssignment' AND `INDEX_NAME` <> 'PRIMARY') i);
SET @lsmb_ddl = IF(@lsmb_drop_indexes IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `WikiPageTagAssignment` ', @lsmb_drop_indexes));
PREPARE lsmb_statement FROM @lsmb_ddl;
EXECUTE lsmb_statement;
DEALLOCATE PREPARE lsmb_statement;

CREATE UNIQUE INDEX `WikiPageTagAssignment_publicId_key` ON `WikiPageTagAssignment`(`publicId`);

CREATE INDEX `WikiPageTagAssignment_wikiPageId_idx` ON `WikiPageTagAssignment`(`wikiPageId`);

CREATE INDEX `WikiPageTagAssignment_bandWikiPageTagId_idx` ON `WikiPageTagAssignment`(`bandWikiPageTagId`);

CREATE UNIQUE INDEX `WikiPageTagAssignment_wikiPageId_bandWikiPageTagId_key` ON `WikiPageTagAssignment`(`wikiPageId`, `bandWikiPageTagId`);

SET @lsmb_drop_indexes = (SELECT GROUP_CONCAT(CONCAT('DROP INDEX `', REPLACE(i.`INDEX_NAME`, '`', '``'), '`') ORDER BY i.`INDEX_NAME` SEPARATOR ', ')
FROM (SELECT DISTINCT `INDEX_NAME` FROM information_schema.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'MenuLink' AND `INDEX_NAME` <> 'PRIMARY') i);
SET @lsmb_ddl = IF(@lsmb_drop_indexes IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `MenuLink` ', @lsmb_drop_indexes));
PREPARE lsmb_statement FROM @lsmb_ddl;
EXECUTE lsmb_statement;
DEALLOCATE PREPARE lsmb_statement;

ALTER TABLE `MenuLink`
  DROP COLUMN `caption`,
  MODIFY COLUMN `captionId` INTEGER NOT NULL,
  MODIFY COLUMN `bandId` INTEGER NOT NULL;

CREATE UNIQUE INDEX `MenuLink_publicId_key` ON `MenuLink`(`publicId`);

CREATE INDEX `MenuLink_captionId_idx` ON `MenuLink`(`captionId`);

CREATE INDEX `MenuLink_realm_idx` ON `MenuLink`(`realm`);

CREATE INDEX `MenuLink_visiblePermissionId_idx` ON `MenuLink`(`visiblePermissionId`);

CREATE INDEX `MenuLink_bandId_idx` ON `MenuLink`(`bandId`);

SET @lsmb_drop_indexes = (SELECT GROUP_CONCAT(CONCAT('DROP INDEX `', REPLACE(i.`INDEX_NAME`, '`', '``'), '`') ORDER BY i.`INDEX_NAME` SEPARATOR ', ')
FROM (SELECT DISTINCT `INDEX_NAME` FROM information_schema.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'SetlistPlanGroup' AND `INDEX_NAME` <> 'PRIMARY') i);
SET @lsmb_ddl = IF(@lsmb_drop_indexes IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `SetlistPlanGroup` ', @lsmb_drop_indexes));
PREPARE lsmb_statement FROM @lsmb_ddl;
EXECUTE lsmb_statement;
DEALLOCATE PREPARE lsmb_statement;

ALTER TABLE `SetlistPlanGroup`
  MODIFY COLUMN `bandId` INTEGER NOT NULL,
  MODIFY COLUMN `updatedAt` DATETIME(3) NOT NULL,
  MODIFY COLUMN `createdByUserId` INTEGER NULL;

CREATE UNIQUE INDEX `SetlistPlanGroup_publicId_key` ON `SetlistPlanGroup`(`publicId`);

CREATE INDEX `SetlistPlanGroup_name_idx` ON `SetlistPlanGroup`(`name`);

CREATE INDEX `SetlistPlanGroup_bandId_idx` ON `SetlistPlanGroup`(`bandId`);

CREATE UNIQUE INDEX `SetlistPlanGroup_id_bandId_key` ON `SetlistPlanGroup`(`id`, `bandId`);

SET @lsmb_drop_indexes = (SELECT GROUP_CONCAT(CONCAT('DROP INDEX `', REPLACE(i.`INDEX_NAME`, '`', '``'), '`') ORDER BY i.`INDEX_NAME` SEPARATOR ', ')
FROM (SELECT DISTINCT `INDEX_NAME` FROM information_schema.`STATISTICS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'SetlistPlan' AND `INDEX_NAME` <> 'PRIMARY') i);
SET @lsmb_ddl = IF(@lsmb_drop_indexes IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `SetlistPlan` ', @lsmb_drop_indexes));
PREPARE lsmb_statement FROM @lsmb_ddl;
EXECUTE lsmb_statement;
DEALLOCATE PREPARE lsmb_statement;

ALTER TABLE `SetlistPlan`
  MODIFY COLUMN `bandId` INTEGER NOT NULL,
  MODIFY COLUMN `updatedAt` DATETIME(3) NOT NULL,
  MODIFY COLUMN `createdByUserId` INTEGER NULL;

CREATE UNIQUE INDEX `SetlistPlan_publicId_key` ON `SetlistPlan`(`publicId`);

CREATE INDEX `SetlistPlan_name_idx` ON `SetlistPlan`(`name`);

CREATE INDEX `SetlistPlan_bandId_idx` ON `SetlistPlan`(`bandId`);

-- Install every destination foreign key. Checks remain enabled throughout.

ALTER TABLE `Locale` ADD CONSTRAINT `Locale_nameId_fkey` FOREIGN KEY (`nameId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Locale` ADD CONSTRAINT `Locale_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Locale` ADD CONSTRAINT `Locale_updatedByUserId_fkey` FOREIGN KEY (`updatedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `StaticLocalizedStringValue` ADD CONSTRAINT `StaticLocalizedStringValue_localeId_fkey` FOREIGN KEY (`localeId`) REFERENCES `Locale`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `StaticLocalizedStringValue` ADD CONSTRAINT `StaticLocalizedStringValue_updatedByUserId_fkey` FOREIGN KEY (`updatedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `DynamicLocalizedStringValue` ADD CONSTRAINT `DynamicLocalizedStringValue_localeId_fkey` FOREIGN KEY (`localeId`) REFERENCES `Locale`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `DynamicLocalizedStringValue` ADD CONSTRAINT `DynamicLocalizedStringValue_stringId_fkey` FOREIGN KEY (`stringId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `DynamicLocalizedStringValue` ADD CONSTRAINT `DynamicLocalizedStringValue_updatedByUserId_fkey` FOREIGN KEY (`updatedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Band` ADD CONSTRAINT `Band_nameId_fkey` FOREIGN KEY (`nameId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Band` ADD CONSTRAINT `Band_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Band` ADD CONSTRAINT `Band_updatedByUserId_fkey` FOREIGN KEY (`updatedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `BandLocale` ADD CONSTRAINT `BandLocale_bandId_fkey` FOREIGN KEY (`bandId`) REFERENCES `Band`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandLocale` ADD CONSTRAINT `BandLocale_localeId_fkey` FOREIGN KEY (`localeId`) REFERENCES `Locale`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandLocale` ADD CONSTRAINT `BandLocale_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `BandLocale` ADD CONSTRAINT `BandLocale_updatedByUserId_fkey` FOREIGN KEY (`updatedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `BandStaticLocalizedStringValue` ADD CONSTRAINT `BandStaticLocalizedStringValue_bandId_fkey` FOREIGN KEY (`bandId`) REFERENCES `Band`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandStaticLocalizedStringValue` ADD CONSTRAINT `BandStaticLocalizedStringValue_localeId_fkey` FOREIGN KEY (`localeId`) REFERENCES `Locale`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandStaticLocalizedStringValue` ADD CONSTRAINT `BandStaticLocalizedStringValue_updatedByUserId_fkey` FOREIGN KEY (`updatedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `BandDynamicLocalizedStringValue` ADD CONSTRAINT `BandDynamicLocalizedStringValue_bandId_fkey` FOREIGN KEY (`bandId`) REFERENCES `Band`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandDynamicLocalizedStringValue` ADD CONSTRAINT `BandDynamicLocalizedStringValue_localeId_fkey` FOREIGN KEY (`localeId`) REFERENCES `Locale`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandDynamicLocalizedStringValue` ADD CONSTRAINT `BandDynamicLocalizedStringValue_stringId_fkey` FOREIGN KEY (`stringId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandDynamicLocalizedStringValue` ADD CONSTRAINT `BandDynamicLocalizedStringValue_updatedByUserId_fkey` FOREIGN KEY (`updatedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `GlobalRole` ADD CONSTRAINT `GlobalRole_nameId_fkey` FOREIGN KEY (`nameId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `GlobalRole` ADD CONSTRAINT `GlobalRole_descriptionId_fkey` FOREIGN KEY (`descriptionId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandRole` ADD CONSTRAINT `BandRole_nameId_fkey` FOREIGN KEY (`nameId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandRole` ADD CONSTRAINT `BandRole_descriptionId_fkey` FOREIGN KEY (`descriptionId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Permission` ADD CONSTRAINT `Permission_descriptionId_fkey` FOREIGN KEY (`descriptionId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `GlobalRolePermission` ADD CONSTRAINT `GlobalRolePermission_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `Permission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `GlobalRolePermission` ADD CONSTRAINT `GlobalRolePermission_globalRoleId_fkey` FOREIGN KEY (`globalRoleId`) REFERENCES `GlobalRole`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `GlobalRolePermission` ADD CONSTRAINT `GlobalRolePermission_updatedByUserId_fkey` FOREIGN KEY (`updatedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `BandRolePermission` ADD CONSTRAINT `BandRolePermission_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `Permission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `BandRolePermission` ADD CONSTRAINT `BandRolePermission_bandRoleId_fkey` FOREIGN KEY (`bandRoleId`) REFERENCES `BandRole`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `BandRolePermission` ADD CONSTRAINT `BandRolePermission_updatedByUserId_fkey` FOREIGN KEY (`updatedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Action` ADD CONSTRAINT `Action_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Action` ADD CONSTRAINT `Action_bandId_fkey` FOREIGN KEY (`bandId`) REFERENCES `Band`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Action` ADD CONSTRAINT `Action_localeContextId_fkey` FOREIGN KEY (`localeContextId`) REFERENCES `Locale`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Action` ADD CONSTRAINT `Action_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Action` ADD CONSTRAINT `Action_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Action` ADD CONSTRAINT `Action_songId_fkey` FOREIGN KEY (`songId`) REFERENCES `Song`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Action` ADD CONSTRAINT `Action_wikiPageId_fkey` FOREIGN KEY (`wikiPageId`) REFERENCES `WikiPage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Action` ADD CONSTRAINT `Action_eventSegmentId_fkey` FOREIGN KEY (`eventSegmentId`) REFERENCES `EventSegment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Action` ADD CONSTRAINT `Action_attendanceId_fkey` FOREIGN KEY (`attendanceId`) REFERENCES `EventAttendance`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Action` ADD CONSTRAINT `Action_customLinkId_fkey` FOREIGN KEY (`customLinkId`) REFERENCES `CustomLink`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Action` ADD CONSTRAINT `Action_eventSongListId_fkey` FOREIGN KEY (`eventSongListId`) REFERENCES `EventSongList`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Action` ADD CONSTRAINT `Action_frontpageGalleryItemId_fkey` FOREIGN KEY (`frontpageGalleryItemId`) REFERENCES `FrontpageGalleryItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Action` ADD CONSTRAINT `Action_menuLinkId_fkey` FOREIGN KEY (`menuLinkId`) REFERENCES `MenuLink`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Action` ADD CONSTRAINT `Action_setlistPlanId_fkey` FOREIGN KEY (`setlistPlanId`) REFERENCES `SetlistPlan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Action` ADD CONSTRAINT `Action_songCreditTypeId_fkey` FOREIGN KEY (`songCreditTypeId`) REFERENCES `SongCreditType`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Action` ADD CONSTRAINT `Action_bandInstrumentId_fkey` FOREIGN KEY (`bandInstrumentId`) REFERENCES `BandInstrument`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Change` ADD CONSTRAINT `Change_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `GlobalUserTag` ADD CONSTRAINT `GlobalUserTag_nameId_fkey` FOREIGN KEY (`nameId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `GlobalUserTag` ADD CONSTRAINT `GlobalUserTag_descriptionId_fkey` FOREIGN KEY (`descriptionId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandUserTag` ADD CONSTRAINT `BandUserTag_nameId_fkey` FOREIGN KEY (`nameId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandUserTag` ADD CONSTRAINT `BandUserTag_descriptionId_fkey` FOREIGN KEY (`descriptionId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandUserTag` ADD CONSTRAINT `BandUserTag_globalUserTagId_fkey` FOREIGN KEY (`globalUserTagId`) REFERENCES `GlobalUserTag`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandUserTag` ADD CONSTRAINT `BandUserTag_bandId_fkey` FOREIGN KEY (`bandId`) REFERENCES `Band`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandUserTagAssignment` ADD CONSTRAINT `BandUserTagAssignment_bandUserTagId_fkey` FOREIGN KEY (`bandUserTagId`) REFERENCES `BandUserTag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `BandUserTagAssignment` ADD CONSTRAINT `BandUserTagAssignment_bandUserId_fkey` FOREIGN KEY (`bandUserId`) REFERENCES `BandUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `User` ADD CONSTRAINT `User_mergedIntoUserId_fkey` FOREIGN KEY (`mergedIntoUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `User` ADD CONSTRAINT `User_globalRoleId_fkey` FOREIGN KEY (`globalRoleId`) REFERENCES `GlobalRole`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `BandUser` ADD CONSTRAINT `BandUser_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandUser` ADD CONSTRAINT `BandUser_bandId_fkey` FOREIGN KEY (`bandId`) REFERENCES `Band`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandUser` ADD CONSTRAINT `BandUser_bandRoleId_fkey` FOREIGN KEY (`bandRoleId`) REFERENCES `BandRole`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `BandUser` ADD CONSTRAINT `BandUser_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `BandUser` ADD CONSTRAINT `BandUser_updatedByUserId_fkey` FOREIGN KEY (`updatedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `UserSignInMethod` ADD CONSTRAINT `UserSignInMethod_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `UserSetting` ADD CONSTRAINT `UserSetting_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `UserSetting` ADD CONSTRAINT `UserSetting_updatedByUserId_fkey` FOREIGN KEY (`updatedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `GlobalSetting` ADD CONSTRAINT `GlobalSetting_updatedByUserId_fkey` FOREIGN KEY (`updatedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `BandSetting` ADD CONSTRAINT `BandSetting_bandId_fkey` FOREIGN KEY (`bandId`) REFERENCES `Band`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `BandSetting` ADD CONSTRAINT `BandSetting_updatedByUserId_fkey` FOREIGN KEY (`updatedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `BandUserSetting` ADD CONSTRAINT `BandUserSetting_bandUserId_fkey` FOREIGN KEY (`bandUserId`) REFERENCES `BandUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `BandUserSetting` ADD CONSTRAINT `BandUserSetting_updatedByUserId_fkey` FOREIGN KEY (`updatedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Token` ADD CONSTRAINT `Token_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Song` ADD CONSTRAINT `Song_bandId_fkey` FOREIGN KEY (`bandId`) REFERENCES `Band`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Song` ADD CONSTRAINT `Song_updatedByUserId_fkey` FOREIGN KEY (`updatedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Song` ADD CONSTRAINT `Song_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Song` ADD CONSTRAINT `Song_visiblePermissionId_fkey` FOREIGN KEY (`visiblePermissionId`) REFERENCES `Permission`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Song` ADD CONSTRAINT `Song_pinnedRecordingId_fkey` FOREIGN KEY (`pinnedRecordingId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `SongCreditType` ADD CONSTRAINT `SongCreditType_nameId_fkey` FOREIGN KEY (`nameId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `SongCreditType` ADD CONSTRAINT `SongCreditType_descriptionId_fkey` FOREIGN KEY (`descriptionId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `SongCredit` ADD CONSTRAINT `SongCredit_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `SongCredit` ADD CONSTRAINT `SongCredit_songId_fkey` FOREIGN KEY (`songId`) REFERENCES `Song`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `SongCredit` ADD CONSTRAINT `SongCredit_typeId_fkey` FOREIGN KEY (`typeId`) REFERENCES `SongCreditType`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `GlobalSongTag` ADD CONSTRAINT `GlobalSongTag_nameId_fkey` FOREIGN KEY (`nameId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `GlobalSongTag` ADD CONSTRAINT `GlobalSongTag_descriptionId_fkey` FOREIGN KEY (`descriptionId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandSongTag` ADD CONSTRAINT `BandSongTag_globalSongTagId_fkey` FOREIGN KEY (`globalSongTagId`) REFERENCES `GlobalSongTag`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandSongTag` ADD CONSTRAINT `BandSongTag_nameId_fkey` FOREIGN KEY (`nameId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandSongTag` ADD CONSTRAINT `BandSongTag_descriptionId_fkey` FOREIGN KEY (`descriptionId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandSongTag` ADD CONSTRAINT `BandSongTag_bandId_fkey` FOREIGN KEY (`bandId`) REFERENCES `Band`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandSongTagAssociation` ADD CONSTRAINT `BandSongTagAssociation_songId_fkey` FOREIGN KEY (`songId`) REFERENCES `Song`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `BandSongTagAssociation` ADD CONSTRAINT `BandSongTagAssociation_bandSongTagId_fkey` FOREIGN KEY (`bandSongTagId`) REFERENCES `BandSongTag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `GlobalInstrumentFunctionalGroup` ADD CONSTRAINT `GlobalInstrumentFunctionalGroup_nameId_fkey` FOREIGN KEY (`nameId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `GlobalInstrumentFunctionalGroup` ADD CONSTRAINT `GlobalInstrumentFunctionalGroup_descriptionId_fkey` FOREIGN KEY (`descriptionId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandInstrumentFunctionalGroup` ADD CONSTRAINT `BandInstrumentFunctionalGroup_nameId_fkey` FOREIGN KEY (`nameId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandInstrumentFunctionalGroup` ADD CONSTRAINT `BandInstrumentFunctionalGroup_descriptionId_fkey` FOREIGN KEY (`descriptionId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandInstrumentFunctionalGroup` ADD CONSTRAINT `BandInstrumentFunctionalGroup_bandId_fkey` FOREIGN KEY (`bandId`) REFERENCES `Band`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandInstrumentFunctionalGroup` ADD CONSTRAINT `BandInstrumentFunctionalGroup_globalFunctionalGroupId_fkey` FOREIGN KEY (`globalFunctionalGroupId`) REFERENCES `GlobalInstrumentFunctionalGroup`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `GlobalInstrument` ADD CONSTRAINT `GlobalInstrument_nameId_fkey` FOREIGN KEY (`nameId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `GlobalInstrument` ADD CONSTRAINT `GlobalInstrument_descriptionId_fkey` FOREIGN KEY (`descriptionId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `GlobalInstrument` ADD CONSTRAINT `GlobalInstrument_functionalGroupId_fkey` FOREIGN KEY (`functionalGroupId`) REFERENCES `GlobalInstrumentFunctionalGroup`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandInstrument` ADD CONSTRAINT `BandInstrument_nameId_fkey` FOREIGN KEY (`nameId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandInstrument` ADD CONSTRAINT `BandInstrument_descriptionId_fkey` FOREIGN KEY (`descriptionId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandInstrument` ADD CONSTRAINT `BandInstrument_bandId_fkey` FOREIGN KEY (`bandId`) REFERENCES `Band`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandInstrument` ADD CONSTRAINT `BandInstrument_globalInstrumentId_fkey` FOREIGN KEY (`globalInstrumentId`) REFERENCES `GlobalInstrument`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandInstrument` ADD CONSTRAINT `BandInstrument_functionalGroupId_bandId_fkey` FOREIGN KEY (`functionalGroupId`, `bandId`) REFERENCES `BandInstrumentFunctionalGroup`(`id`, `bandId`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandUserInstrument` ADD CONSTRAINT `BandUserInstrument_bandInstrumentId_fkey` FOREIGN KEY (`bandInstrumentId`) REFERENCES `BandInstrument`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `BandUserInstrument` ADD CONSTRAINT `BandUserInstrument_bandUserId_fkey` FOREIGN KEY (`bandUserId`) REFERENCES `BandUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Event` ADD CONSTRAINT `Event_bandId_fkey` FOREIGN KEY (`bandId`) REFERENCES `Band`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Event` ADD CONSTRAINT `Event_typeId_fkey` FOREIGN KEY (`typeId`) REFERENCES `EventType`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Event` ADD CONSTRAINT `Event_statusId_fkey` FOREIGN KEY (`statusId`) REFERENCES `EventStatus`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Event` ADD CONSTRAINT `Event_descriptionWikiPageId_fkey` FOREIGN KEY (`descriptionWikiPageId`) REFERENCES `WikiPage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Event` ADD CONSTRAINT `Event_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Event` ADD CONSTRAINT `Event_updatedByUserId_fkey` FOREIGN KEY (`updatedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Event` ADD CONSTRAINT `Event_visiblePermissionId_fkey` FOREIGN KEY (`visiblePermissionId`) REFERENCES `Permission`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Event` ADD CONSTRAINT `Event_expectedAttendanceUserTagId_fkey` FOREIGN KEY (`expectedAttendanceUserTagId`) REFERENCES `BandUserTag`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `EventSegment` ADD CONSTRAINT `EventSegment_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `EventSegment` ADD CONSTRAINT `EventSegment_statusId_fkey` FOREIGN KEY (`statusId`) REFERENCES `EventStatus`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `EventType` ADD CONSTRAINT `EventType_nameId_fkey` FOREIGN KEY (`nameId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `EventType` ADD CONSTRAINT `EventType_descriptionId_fkey` FOREIGN KEY (`descriptionId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `EventStatus` ADD CONSTRAINT `EventStatus_nameId_fkey` FOREIGN KEY (`nameId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `EventStatus` ADD CONSTRAINT `EventStatus_descriptionId_fkey` FOREIGN KEY (`descriptionId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `GlobalEventTag` ADD CONSTRAINT `GlobalEventTag_nameId_fkey` FOREIGN KEY (`nameId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `GlobalEventTag` ADD CONSTRAINT `GlobalEventTag_descriptionId_fkey` FOREIGN KEY (`descriptionId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandEventTag` ADD CONSTRAINT `BandEventTag_globalEventTagId_fkey` FOREIGN KEY (`globalEventTagId`) REFERENCES `GlobalEventTag`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandEventTag` ADD CONSTRAINT `BandEventTag_nameId_fkey` FOREIGN KEY (`nameId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandEventTag` ADD CONSTRAINT `BandEventTag_descriptionId_fkey` FOREIGN KEY (`descriptionId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandEventTag` ADD CONSTRAINT `BandEventTag_bandId_fkey` FOREIGN KEY (`bandId`) REFERENCES `Band`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `EventTagAssignment` ADD CONSTRAINT `EventTagAssignment_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `EventTagAssignment` ADD CONSTRAINT `EventTagAssignment_bandEventTagId_fkey` FOREIGN KEY (`bandEventTagId`) REFERENCES `BandEventTag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `EventSongList` ADD CONSTRAINT `EventSongList_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `EventSongListSong` ADD CONSTRAINT `EventSongListSong_songId_fkey` FOREIGN KEY (`songId`) REFERENCES `Song`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `EventSongListSong` ADD CONSTRAINT `EventSongListSong_eventSongListId_fkey` FOREIGN KEY (`eventSongListId`) REFERENCES `EventSongList`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `EventSongListDivider` ADD CONSTRAINT `EventSongListDivider_eventSongListId_fkey` FOREIGN KEY (`eventSongListId`) REFERENCES `EventSongList`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `EventAttendance` ADD CONSTRAINT `EventAttendance_buttonCaptionId_fkey` FOREIGN KEY (`buttonCaptionId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `EventAttendance` ADD CONSTRAINT `EventAttendance_personalCaptionId_fkey` FOREIGN KEY (`personalCaptionId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `EventAttendance` ADD CONSTRAINT `EventAttendance_pastCaptionId_fkey` FOREIGN KEY (`pastCaptionId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `EventAttendance` ADD CONSTRAINT `EventAttendance_personalPastCaptionId_fkey` FOREIGN KEY (`personalPastCaptionId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `EventAttendance` ADD CONSTRAINT `EventAttendance_descriptionId_fkey` FOREIGN KEY (`descriptionId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `EventUserResponse` ADD CONSTRAINT `EventUserResponse_bandUserId_fkey` FOREIGN KEY (`bandUserId`) REFERENCES `BandUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `EventUserResponse` ADD CONSTRAINT `EventUserResponse_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `EventUserResponse` ADD CONSTRAINT `EventUserResponse_bandInstrumentId_fkey` FOREIGN KEY (`bandInstrumentId`) REFERENCES `BandInstrument`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `EventSegmentUserResponse` ADD CONSTRAINT `EventSegmentUserResponse_bandUserId_fkey` FOREIGN KEY (`bandUserId`) REFERENCES `BandUser`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `EventSegmentUserResponse` ADD CONSTRAINT `EventSegmentUserResponse_eventSegmentId_fkey` FOREIGN KEY (`eventSegmentId`) REFERENCES `EventSegment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `EventSegmentUserResponse` ADD CONSTRAINT `EventSegmentUserResponse_attendanceId_fkey` FOREIGN KEY (`attendanceId`) REFERENCES `EventAttendance`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `EventSegmentUserResponse` ADD CONSTRAINT `EventSegmentUserResponse_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `EventSegmentUserResponse` ADD CONSTRAINT `EventSegmentUserResponse_updatedByUserId_fkey` FOREIGN KEY (`updatedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `GlobalFileTag` ADD CONSTRAINT `GlobalFileTag_nameId_fkey` FOREIGN KEY (`nameId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `GlobalFileTag` ADD CONSTRAINT `GlobalFileTag_descriptionId_fkey` FOREIGN KEY (`descriptionId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandFileTag` ADD CONSTRAINT `BandFileTag_globalFileTagId_fkey` FOREIGN KEY (`globalFileTagId`) REFERENCES `GlobalFileTag`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandFileTag` ADD CONSTRAINT `BandFileTag_nameId_fkey` FOREIGN KEY (`nameId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandFileTag` ADD CONSTRAINT `BandFileTag_descriptionId_fkey` FOREIGN KEY (`descriptionId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandFileTag` ADD CONSTRAINT `BandFileTag_bandId_fkey` FOREIGN KEY (`bandId`) REFERENCES `Band`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandFileTagAssignment` ADD CONSTRAINT `BandFileTagAssignment_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `File`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `BandFileTagAssignment` ADD CONSTRAINT `BandFileTagAssignment_bandFileTagId_fkey` FOREIGN KEY (`bandFileTagId`) REFERENCES `BandFileTag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `File` ADD CONSTRAINT `File_uploadedByUserId_fkey` FOREIGN KEY (`uploadedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `File` ADD CONSTRAINT `File_visiblePermissionId_fkey` FOREIGN KEY (`visiblePermissionId`) REFERENCES `Permission`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `File` ADD CONSTRAINT `File_previewFileId_fkey` FOREIGN KEY (`previewFileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `File` ADD CONSTRAINT `File_parentFileId_fkey` FOREIGN KEY (`parentFileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `File` ADD CONSTRAINT `File_bandId_fkey` FOREIGN KEY (`bandId`) REFERENCES `Band`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `FileUserTag` ADD CONSTRAINT `FileUserTag_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `File`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `FileUserTag` ADD CONSTRAINT `FileUserTag_bandUserId_fkey` FOREIGN KEY (`bandUserId`) REFERENCES `BandUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `FileSongTag` ADD CONSTRAINT `FileSongTag_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `File`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `FileSongTag` ADD CONSTRAINT `FileSongTag_songId_fkey` FOREIGN KEY (`songId`) REFERENCES `Song`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `FileEventTag` ADD CONSTRAINT `FileEventTag_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `File`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `FileEventTag` ADD CONSTRAINT `FileEventTag_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `FileInstrumentTag` ADD CONSTRAINT `FileInstrumentTag_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `File`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `FileInstrumentTag` ADD CONSTRAINT `FileInstrumentTag_bandInstrumentId_fkey` FOREIGN KEY (`bandInstrumentId`) REFERENCES `BandInstrument`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `FileWikiPageTag` ADD CONSTRAINT `FileWikiPageTag_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `File`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `FileWikiPageTag` ADD CONSTRAINT `FileWikiPageTag_wikiPageId_fkey` FOREIGN KEY (`wikiPageId`) REFERENCES `WikiPage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `FrontpageGalleryItem` ADD CONSTRAINT `FrontpageGalleryItem_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `File`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `FrontpageGalleryItem` ADD CONSTRAINT `FrontpageGalleryItem_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `FrontpageGalleryItem` ADD CONSTRAINT `FrontpageGalleryItem_visiblePermissionId_fkey` FOREIGN KEY (`visiblePermissionId`) REFERENCES `Permission`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `CustomLink` ADD CONSTRAINT `CustomLink_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `CustomLink` ADD CONSTRAINT `CustomLink_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `CustomLink` ADD CONSTRAINT `CustomLink_bandId_fkey` FOREIGN KEY (`bandId`) REFERENCES `Band`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CustomLinkVisit` ADD CONSTRAINT `CustomLinkVisit_customLinkId_fkey` FOREIGN KEY (`customLinkId`) REFERENCES `CustomLink`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `WikiPage` ADD CONSTRAINT `WikiPage_currentRevisionId_fkey` FOREIGN KEY (`currentRevisionId`) REFERENCES `WikiPageRevision`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `WikiPage` ADD CONSTRAINT `WikiPage_visiblePermissionId_fkey` FOREIGN KEY (`visiblePermissionId`) REFERENCES `Permission`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `WikiPage` ADD CONSTRAINT `WikiPage_lockedByUserId_fkey` FOREIGN KEY (`lockedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `WikiPage` ADD CONSTRAINT `WikiPage_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `WikiPage` ADD CONSTRAINT `WikiPage_bandId_fkey` FOREIGN KEY (`bandId`) REFERENCES `Band`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `WikiPageRevision` ADD CONSTRAINT `WikiPageRevision_wikiPageId_fkey` FOREIGN KEY (`wikiPageId`) REFERENCES `WikiPage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `WikiPageRevision` ADD CONSTRAINT `WikiPageRevision_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `GlobalWikiPageTag` ADD CONSTRAINT `GlobalWikiPageTag_nameId_fkey` FOREIGN KEY (`nameId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `GlobalWikiPageTag` ADD CONSTRAINT `GlobalWikiPageTag_descriptionId_fkey` FOREIGN KEY (`descriptionId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandWikiPageTag` ADD CONSTRAINT `BandWikiPageTag_globalWikiPageTagId_fkey` FOREIGN KEY (`globalWikiPageTagId`) REFERENCES `GlobalWikiPageTag`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandWikiPageTag` ADD CONSTRAINT `BandWikiPageTag_nameId_fkey` FOREIGN KEY (`nameId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandWikiPageTag` ADD CONSTRAINT `BandWikiPageTag_descriptionId_fkey` FOREIGN KEY (`descriptionId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BandWikiPageTag` ADD CONSTRAINT `BandWikiPageTag_bandId_fkey` FOREIGN KEY (`bandId`) REFERENCES `Band`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `WikiPageTagAssignment` ADD CONSTRAINT `WikiPageTagAssignment_wikiPageId_fkey` FOREIGN KEY (`wikiPageId`) REFERENCES `WikiPage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `WikiPageTagAssignment` ADD CONSTRAINT `WikiPageTagAssignment_bandWikiPageTagId_fkey` FOREIGN KEY (`bandWikiPageTagId`) REFERENCES `BandWikiPageTag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `MenuLink` ADD CONSTRAINT `MenuLink_captionId_fkey` FOREIGN KEY (`captionId`) REFERENCES `DynamicLocalizedString`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `MenuLink` ADD CONSTRAINT `MenuLink_visiblePermissionId_fkey` FOREIGN KEY (`visiblePermissionId`) REFERENCES `Permission`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `MenuLink` ADD CONSTRAINT `MenuLink_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `MenuLink` ADD CONSTRAINT `MenuLink_bandId_fkey` FOREIGN KEY (`bandId`) REFERENCES `Band`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `SetlistPlanGroup` ADD CONSTRAINT `SetlistPlanGroup_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `SetlistPlanGroup` ADD CONSTRAINT `SetlistPlanGroup_bandId_fkey` FOREIGN KEY (`bandId`) REFERENCES `Band`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `SetlistPlan` ADD CONSTRAINT `SetlistPlan_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `SetlistPlanGroup`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `SetlistPlan` ADD CONSTRAINT `SetlistPlan_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `SetlistPlan` ADD CONSTRAINT `SetlistPlan_visiblePermissionId_fkey` FOREIGN KEY (`visiblePermissionId`) REFERENCES `Permission`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `SetlistPlan` ADD CONSTRAINT `SetlistPlan_bandId_fkey` FOREIGN KEY (`bandId`) REFERENCES `Band`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Temporary migration bookkeeping is removed; only the destination schema remains.

DROP TEMPORARY TABLE `_lsmb_global_setting_survivors`, `_lsmb_settings`, `_lsmb_strings`, `_lsmb_identities`, `_lsmb_plan_refs`, `_lsmb_setting_manifest`, `_lsmb_assert`;

SET SESSION group_concat_max_len = @lsmb_original_group_concat_max_len;

SET @lsmb_public_id_seed = NULL;
