-- CreateTable
CREATE TABLE `Role` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(768) NOT NULL,
    `isRoleForNewUsers` BOOLEAN NOT NULL DEFAULT false,
    `isPublicRole` BOOLEAN NOT NULL DEFAULT false,
    `description` MEDIUMTEXT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `Role_name_key`(`name`),
    INDEX `Role_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Permission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(768) NOT NULL,
    `isVisibility` BOOLEAN NOT NULL DEFAULT false,
    `description` MEDIUMTEXT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `color` VARCHAR(768) NULL,
    `iconName` VARCHAR(768) NULL,

    UNIQUE INDEX `Permission_name_key`(`name`),
    INDEX `Permission_name_idx`(`name`),
    INDEX `Permission_sortOrder_idx`(`sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RolePermission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `roleId` INTEGER NOT NULL,
    `permissionId` INTEGER NOT NULL,

    UNIQUE INDEX `RolePermission_roleId_permissionId_key`(`roleId`, `permissionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserTag` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `text` VARCHAR(768) NOT NULL,
    `description` MEDIUMTEXT NOT NULL,
    `color` VARCHAR(191) NULL,
    `significance` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `UserTag_text_idx`(`text`),
    INDEX `UserTag_sortOrder_idx`(`sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserTagAssignment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `userTagId` INTEGER NOT NULL,

    UNIQUE INDEX `UserTagAssignment_userId_userTagId_key`(`userId`, `userTagId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(768) NOT NULL DEFAULT '',
    `isSysAdmin` BOOLEAN NOT NULL DEFAULT false,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,
    `email` VARCHAR(768) NOT NULL,
    `phone` VARCHAR(768) NULL,
    `hashedPassword` VARCHAR(191) NULL,
    `googleId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `roleId` INTEGER NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_name_idx`(`name`),
    INDEX `User_isDeleted_idx`(`isDeleted`),
    INDEX `User_email_idx`(`email`),
    INDEX `User_phone_idx`(`phone`),
    INDEX `User_googleId_idx`(`googleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Setting` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(768) NOT NULL DEFAULT '',
    `value` MEDIUMTEXT NOT NULL,

    UNIQUE INDEX `Setting_name_key`(`name`),
    INDEX `Setting_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Change` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `action` VARCHAR(191) NOT NULL,
    `context` VARCHAR(768) NOT NULL,
    `operationId` VARCHAR(191) NOT NULL,
    `table` VARCHAR(191) NOT NULL,
    `recordId` INTEGER NOT NULL,
    `changedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` INTEGER NULL,
    `sessionHandle` VARCHAR(191) NULL,
    `oldValues` MEDIUMTEXT NULL,
    `newValues` MEDIUMTEXT NULL,

    INDEX `Change_table_idx`(`table`),
    INDEX `Change_recordId_idx`(`recordId`),
    INDEX `Change_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Activity` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NULL,
    `sessionHandle` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `data` MEDIUMTEXT NULL,
    `happenedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `expiresAt` DATETIME(3) NULL,
    `handle` VARCHAR(191) NOT NULL,
    `hashedSessionToken` VARCHAR(191) NULL,
    `antiCSRFToken` VARCHAR(191) NULL,
    `publicData` MEDIUMTEXT NULL,
    `privateData` MEDIUMTEXT NULL,
    `userId` INTEGER NULL,

    UNIQUE INDEX `Session_handle_key`(`handle`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Token` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `hashedToken` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `sentTo` VARCHAR(768) NOT NULL,
    `userId` INTEGER NOT NULL,

    UNIQUE INDEX `Token_hashedToken_type_key`(`hashedToken`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Song` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(768) NOT NULL,
    `aliases` VARCHAR(768) NOT NULL DEFAULT '',
    `slug` VARCHAR(768) NOT NULL,
    `description` MEDIUMTEXT NOT NULL,
    `startBPM` INTEGER NULL,
    `endBPM` INTEGER NULL,
    `introducedYear` INTEGER NULL,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,
    `lengthSeconds` INTEGER NULL,
    `createdByUserId` INTEGER NULL,
    `visiblePermissionId` INTEGER NULL,

    INDEX `Song_name_idx`(`name`),
    INDEX `Song_aliases_idx`(`aliases`),
    INDEX `Song_slug_idx`(`slug`),
    INDEX `Song_isDeleted_idx`(`isDeleted`),
    INDEX `Song_visiblePermissionId_idx`(`visiblePermissionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SongComment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `songId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `text` MEDIUMTEXT NOT NULL,
    `visiblePermissionId` INTEGER NULL,

    INDEX `SongComment_songId_idx`(`songId`),
    INDEX `SongComment_visiblePermissionId_idx`(`visiblePermissionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SongCreditType` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `text` VARCHAR(191) NOT NULL,
    `description` MEDIUMTEXT NOT NULL,
    `color` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `SongCreditType_text_idx`(`text`),
    INDEX `SongCreditType_sortOrder_idx`(`sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SongCredit` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NULL,
    `songId` INTEGER NOT NULL,
    `year` VARCHAR(768) NOT NULL DEFAULT '',
    `comment` MEDIUMTEXT NOT NULL,
    `typeId` INTEGER NOT NULL,

    INDEX `SongCredit_userId_idx`(`userId`),
    INDEX `SongCredit_songId_idx`(`songId`),
    INDEX `SongCredit_typeId_idx`(`typeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SongTag` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `text` VARCHAR(768) NOT NULL,
    `description` MEDIUMTEXT NOT NULL,
    `color` VARCHAR(191) NULL,
    `significance` VARCHAR(191) NULL,
    `showOnSongLists` BOOLEAN NOT NULL DEFAULT false,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `SongTag_text_idx`(`text`),
    INDEX `SongTag_significance_idx`(`significance`),
    INDEX `SongTag_showOnSongLists_idx`(`showOnSongLists`),
    INDEX `SongTag_sortOrder_idx`(`sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SongTagAssociation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `songId` INTEGER NOT NULL,
    `tagId` INTEGER NOT NULL,

    UNIQUE INDEX `SongTagAssociation_tagId_songId_key`(`tagId`, `songId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InstrumentFunctionalGroup` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` MEDIUMTEXT NOT NULL,
    `sortOrder` INTEGER NOT NULL,
    `color` VARCHAR(191) NULL,

    UNIQUE INDEX `InstrumentFunctionalGroup_name_key`(`name`),
    INDEX `InstrumentFunctionalGroup_name_idx`(`name`),
    INDEX `InstrumentFunctionalGroup_sortOrder_idx`(`sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Instrument` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(768) NOT NULL,
    `slug` VARCHAR(768) NOT NULL DEFAULT '',
    `description` MEDIUMTEXT NOT NULL,
    `sortOrder` INTEGER NOT NULL,
    `functionalGroupId` INTEGER NOT NULL,

    UNIQUE INDEX `Instrument_name_key`(`name`),
    INDEX `Instrument_name_idx`(`name`),
    INDEX `Instrument_slug_idx`(`slug`),
    INDEX `Instrument_sortOrder_idx`(`sortOrder`),
    INDEX `Instrument_functionalGroupId_idx`(`functionalGroupId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InstrumentTag` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `text` VARCHAR(768) NOT NULL,
    `description` MEDIUMTEXT NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `color` VARCHAR(191) NULL,
    `significance` VARCHAR(191) NULL,

    INDEX `InstrumentTag_text_idx`(`text`),
    INDEX `InstrumentTag_sortOrder_idx`(`sortOrder`),
    INDEX `InstrumentTag_significance_idx`(`significance`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InstrumentTagAssociation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `instrumentId` INTEGER NOT NULL,
    `tagId` INTEGER NOT NULL,

    UNIQUE INDEX `InstrumentTagAssociation_instrumentId_tagId_key`(`instrumentId`, `tagId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserInstrument` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `instrumentId` INTEGER NOT NULL,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `userId` INTEGER NOT NULL,

    INDEX `UserInstrument_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Event` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(768) NOT NULL,
    `slug` VARCHAR(768) NOT NULL,
    `description` MEDIUMTEXT NOT NULL,
    `typeId` INTEGER NULL,
    `locationDescription` VARCHAR(768) NOT NULL DEFAULT '',
    `locationURL` VARCHAR(768) NOT NULL DEFAULT '',
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,
    `statusId` INTEGER NULL,
    `segmentBehavior` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL,
    `startsAt` DATETIME(3) NULL,
    `durationMillis` BIGINT NOT NULL DEFAULT 0,
    `isAllDay` BOOLEAN NOT NULL DEFAULT true,
    `endDateTime` DATETIME(3) NULL,
    `createdByUserId` INTEGER NULL,
    `visiblePermissionId` INTEGER NULL,
    `expectedAttendanceUserTagId` INTEGER NULL,
    `frontpageVisible` BOOLEAN NOT NULL DEFAULT false,
    `frontpageDate` VARCHAR(768) NOT NULL DEFAULT '',
    `frontpageTime` VARCHAR(768) NOT NULL DEFAULT '',
    `frontpageDetails` VARCHAR(768) NOT NULL DEFAULT '',
    `frontpageTitle` VARCHAR(768) NULL,
    `frontpageLocation` VARCHAR(768) NULL,
    `frontpageLocationURI` VARCHAR(768) NULL,
    `frontpageTags` VARCHAR(768) NULL,

    INDEX `Event_name_idx`(`name`),
    INDEX `Event_slug_idx`(`slug`),
    INDEX `Event_typeId_idx`(`typeId`),
    INDEX `Event_isDeleted_idx`(`isDeleted`),
    INDEX `Event_statusId_idx`(`statusId`),
    INDEX `Event_startsAt_idx`(`startsAt`),
    INDEX `Event_endDateTime_idx`(`endDateTime`),
    INDEX `Event_visiblePermissionId_idx`(`visiblePermissionId`),
    INDEX `Event_frontpageVisible_idx`(`frontpageVisible`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EventSegment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `eventId` INTEGER NOT NULL,
    `name` VARCHAR(768) NOT NULL,
    `description` MEDIUMTEXT NOT NULL,
    `startsAt` DATETIME(3) NULL,
    `durationMillis` BIGINT NOT NULL,
    `isAllDay` BOOLEAN NOT NULL DEFAULT true,

    INDEX `EventSegment_name_idx`(`name`),
    INDEX `EventSegment_startsAt_idx`(`startsAt`),
    INDEX `EventSegment_eventId_idx`(`eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EventType` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `text` VARCHAR(768) NOT NULL,
    `description` MEDIUMTEXT NOT NULL,
    `color` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `significance` VARCHAR(191) NULL,
    `iconName` VARCHAR(191) NULL,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,

    INDEX `EventType_text_idx`(`text`),
    INDEX `EventType_sortOrder_idx`(`sortOrder`),
    INDEX `EventType_significance_idx`(`significance`),
    INDEX `EventType_isDeleted_idx`(`isDeleted`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EventStatus` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `label` VARCHAR(768) NOT NULL,
    `description` MEDIUMTEXT NOT NULL,
    `color` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `significance` VARCHAR(191) NULL,
    `iconName` VARCHAR(191) NULL,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,

    INDEX `EventStatus_label_idx`(`label`),
    INDEX `EventStatus_sortOrder_idx`(`sortOrder`),
    INDEX `EventStatus_significance_idx`(`significance`),
    INDEX `EventStatus_isDeleted_idx`(`isDeleted`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EventTag` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `text` VARCHAR(768) NOT NULL,
    `description` MEDIUMTEXT NOT NULL,
    `color` VARCHAR(191) NULL,
    `significance` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `visibleOnFrontpage` BOOLEAN NOT NULL DEFAULT false,

    INDEX `EventTag_text_idx`(`text`),
    INDEX `EventTag_significance_idx`(`significance`),
    INDEX `EventTag_sortOrder_idx`(`sortOrder`),
    INDEX `EventTag_visibleOnFrontpage_idx`(`visibleOnFrontpage`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EventTagAssignment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `eventId` INTEGER NOT NULL,
    `eventTagId` INTEGER NOT NULL,

    UNIQUE INDEX `EventTagAssignment_eventId_eventTagId_key`(`eventId`, `eventTagId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EventComment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `eventId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `text` MEDIUMTEXT NOT NULL,
    `visiblePermissionId` INTEGER NULL,

    INDEX `EventComment_eventId_idx`(`eventId`),
    INDEX `EventComment_visiblePermissionId_idx`(`visiblePermissionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EventSongList` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `name` VARCHAR(768) NOT NULL,
    `description` MEDIUMTEXT NOT NULL,
    `eventId` INTEGER NOT NULL,
    `userId` INTEGER NULL,

    INDEX `EventSongList_sortOrder_idx`(`sortOrder`),
    INDEX `EventSongList_name_idx`(`name`),
    INDEX `EventSongList_eventId_idx`(`eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EventSongListSong` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `subtitle` MEDIUMTEXT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `songId` INTEGER NOT NULL,
    `eventSongListId` INTEGER NOT NULL,

    INDEX `EventSongListSong_songId_idx`(`songId`),
    INDEX `EventSongListSong_eventSongListId_idx`(`eventSongListId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EventAttendance` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `text` VARCHAR(768) NOT NULL,
    `personalText` VARCHAR(191) NOT NULL DEFAULT '',
    `pastText` VARCHAR(191) NOT NULL DEFAULT '',
    `pastPersonalText` VARCHAR(191) NOT NULL DEFAULT '',
    `description` MEDIUMTEXT NOT NULL,
    `color` VARCHAR(191) NULL,
    `iconName` VARCHAR(191) NULL,
    `strength` INTEGER NOT NULL,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,

    INDEX `EventAttendance_sortOrder_idx`(`sortOrder`),
    INDEX `EventAttendance_strength_idx`(`strength`),
    INDEX `EventAttendance_isDeleted_idx`(`isDeleted`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EventUserResponse` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `eventId` INTEGER NOT NULL,
    `isInvited` BOOLEAN NULL,
    `userComment` MEDIUMTEXT NULL,
    `instrumentId` INTEGER NULL,

    UNIQUE INDEX `EventUserResponse_userId_eventId_key`(`userId`, `eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EventSegmentUserResponse` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `eventSegmentId` INTEGER NOT NULL,
    `attendanceId` INTEGER NULL,

    UNIQUE INDEX `EventSegmentUserResponse_userId_eventSegmentId_key`(`userId`, `eventSegmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FileTag` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `text` VARCHAR(768) NOT NULL,
    `description` MEDIUMTEXT NOT NULL,
    `color` VARCHAR(191) NULL,
    `significance` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `FileTag_text_idx`(`text`),
    INDEX `FileTag_significance_idx`(`significance`),
    INDEX `FileTag_sortOrder_idx`(`sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FileTagAssignment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fileId` INTEGER NOT NULL,
    `fileTagId` INTEGER NOT NULL,

    UNIQUE INDEX `FileTagAssignment_fileId_fileTagId_key`(`fileId`, `fileTagId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `File` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fileLeafName` VARCHAR(768) NOT NULL,
    `storedLeafName` VARCHAR(768) NOT NULL,
    `description` MEDIUMTEXT NOT NULL,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,
    `sizeBytes` INTEGER NULL,
    `externalURI` VARCHAR(768) NULL,
    `fileCreatedAt` DATETIME(3) NULL,
    `uploadedAt` DATETIME(3) NOT NULL,
    `uploadedByUserId` INTEGER NULL,
    `visiblePermissionId` INTEGER NULL,
    `mimeType` VARCHAR(191) NULL,
    `customData` MEDIUMTEXT NULL,
    `previewFileId` INTEGER NULL,
    `parentFileId` INTEGER NULL,

    UNIQUE INDEX `File_storedLeafName_key`(`storedLeafName`),
    INDEX `File_fileLeafName_idx`(`fileLeafName`),
    INDEX `File_storedLeafName_idx`(`storedLeafName`),
    INDEX `File_isDeleted_idx`(`isDeleted`),
    INDEX `File_visiblePermissionId_idx`(`visiblePermissionId`),
    INDEX `File_mimeType_idx`(`mimeType`),
    INDEX `File_previewFileId_idx`(`previewFileId`),
    INDEX `File_parentFileId_idx`(`parentFileId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FileUserTag` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fileId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,

    INDEX `FileUserTag_fileId_idx`(`fileId`),
    INDEX `FileUserTag_userId_idx`(`userId`),
    UNIQUE INDEX `FileUserTag_fileId_userId_key`(`fileId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FileSongTag` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fileId` INTEGER NOT NULL,
    `songId` INTEGER NOT NULL,

    INDEX `FileSongTag_fileId_idx`(`fileId`),
    INDEX `FileSongTag_songId_idx`(`songId`),
    UNIQUE INDEX `FileSongTag_fileId_songId_key`(`fileId`, `songId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FileEventTag` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fileId` INTEGER NOT NULL,
    `eventId` INTEGER NOT NULL,

    INDEX `FileEventTag_fileId_idx`(`fileId`),
    INDEX `FileEventTag_eventId_idx`(`eventId`),
    UNIQUE INDEX `FileEventTag_fileId_eventId_key`(`fileId`, `eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FileInstrumentTag` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fileId` INTEGER NOT NULL,
    `instrumentId` INTEGER NOT NULL,

    INDEX `FileInstrumentTag_fileId_idx`(`fileId`),
    INDEX `FileInstrumentTag_instrumentId_idx`(`instrumentId`),
    UNIQUE INDEX `FileInstrumentTag_fileId_instrumentId_key`(`fileId`, `instrumentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FrontpageGalleryItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,
    `caption` MEDIUMTEXT NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `fileId` INTEGER NOT NULL,
    `displayParams` MEDIUMTEXT NOT NULL,
    `createdByUserId` INTEGER NULL,
    `visiblePermissionId` INTEGER NULL,

    INDEX `FrontpageGalleryItem_isDeleted_idx`(`isDeleted`),
    INDEX `FrontpageGalleryItem_sortOrder_idx`(`sortOrder`),
    INDEX `FrontpageGalleryItem_fileId_idx`(`fileId`),
    INDEX `FrontpageGalleryItem_visiblePermissionId_idx`(`visiblePermissionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `Permission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserTagAssignment` ADD CONSTRAINT `UserTagAssignment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserTagAssignment` ADD CONSTRAINT `UserTagAssignment_userTagId_fkey` FOREIGN KEY (`userTagId`) REFERENCES `UserTag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Change` ADD CONSTRAINT `Change_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Activity` ADD CONSTRAINT `Activity_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Token` ADD CONSTRAINT `Token_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Song` ADD CONSTRAINT `Song_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Song` ADD CONSTRAINT `Song_visiblePermissionId_fkey` FOREIGN KEY (`visiblePermissionId`) REFERENCES `Permission`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SongComment` ADD CONSTRAINT `SongComment_songId_fkey` FOREIGN KEY (`songId`) REFERENCES `Song`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SongComment` ADD CONSTRAINT `SongComment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SongComment` ADD CONSTRAINT `SongComment_visiblePermissionId_fkey` FOREIGN KEY (`visiblePermissionId`) REFERENCES `Permission`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SongCredit` ADD CONSTRAINT `SongCredit_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SongCredit` ADD CONSTRAINT `SongCredit_songId_fkey` FOREIGN KEY (`songId`) REFERENCES `Song`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SongCredit` ADD CONSTRAINT `SongCredit_typeId_fkey` FOREIGN KEY (`typeId`) REFERENCES `SongCreditType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SongTagAssociation` ADD CONSTRAINT `SongTagAssociation_songId_fkey` FOREIGN KEY (`songId`) REFERENCES `Song`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SongTagAssociation` ADD CONSTRAINT `SongTagAssociation_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `SongTag`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Instrument` ADD CONSTRAINT `Instrument_functionalGroupId_fkey` FOREIGN KEY (`functionalGroupId`) REFERENCES `InstrumentFunctionalGroup`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InstrumentTagAssociation` ADD CONSTRAINT `InstrumentTagAssociation_instrumentId_fkey` FOREIGN KEY (`instrumentId`) REFERENCES `Instrument`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InstrumentTagAssociation` ADD CONSTRAINT `InstrumentTagAssociation_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `InstrumentTag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserInstrument` ADD CONSTRAINT `UserInstrument_instrumentId_fkey` FOREIGN KEY (`instrumentId`) REFERENCES `Instrument`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserInstrument` ADD CONSTRAINT `UserInstrument_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Event` ADD CONSTRAINT `Event_typeId_fkey` FOREIGN KEY (`typeId`) REFERENCES `EventType`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Event` ADD CONSTRAINT `Event_statusId_fkey` FOREIGN KEY (`statusId`) REFERENCES `EventStatus`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Event` ADD CONSTRAINT `Event_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Event` ADD CONSTRAINT `Event_visiblePermissionId_fkey` FOREIGN KEY (`visiblePermissionId`) REFERENCES `Permission`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Event` ADD CONSTRAINT `Event_expectedAttendanceUserTagId_fkey` FOREIGN KEY (`expectedAttendanceUserTagId`) REFERENCES `UserTag`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventSegment` ADD CONSTRAINT `EventSegment_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventTagAssignment` ADD CONSTRAINT `EventTagAssignment_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventTagAssignment` ADD CONSTRAINT `EventTagAssignment_eventTagId_fkey` FOREIGN KEY (`eventTagId`) REFERENCES `EventTag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventComment` ADD CONSTRAINT `EventComment_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventComment` ADD CONSTRAINT `EventComment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventComment` ADD CONSTRAINT `EventComment_visiblePermissionId_fkey` FOREIGN KEY (`visiblePermissionId`) REFERENCES `Permission`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventSongList` ADD CONSTRAINT `EventSongList_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventSongList` ADD CONSTRAINT `EventSongList_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventSongListSong` ADD CONSTRAINT `EventSongListSong_songId_fkey` FOREIGN KEY (`songId`) REFERENCES `Song`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventSongListSong` ADD CONSTRAINT `EventSongListSong_eventSongListId_fkey` FOREIGN KEY (`eventSongListId`) REFERENCES `EventSongList`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventUserResponse` ADD CONSTRAINT `EventUserResponse_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventUserResponse` ADD CONSTRAINT `EventUserResponse_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventUserResponse` ADD CONSTRAINT `EventUserResponse_instrumentId_fkey` FOREIGN KEY (`instrumentId`) REFERENCES `Instrument`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventSegmentUserResponse` ADD CONSTRAINT `EventSegmentUserResponse_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventSegmentUserResponse` ADD CONSTRAINT `EventSegmentUserResponse_eventSegmentId_fkey` FOREIGN KEY (`eventSegmentId`) REFERENCES `EventSegment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventSegmentUserResponse` ADD CONSTRAINT `EventSegmentUserResponse_attendanceId_fkey` FOREIGN KEY (`attendanceId`) REFERENCES `EventAttendance`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FileTagAssignment` ADD CONSTRAINT `FileTagAssignment_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `File`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FileTagAssignment` ADD CONSTRAINT `FileTagAssignment_fileTagId_fkey` FOREIGN KEY (`fileTagId`) REFERENCES `FileTag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `File` ADD CONSTRAINT `File_uploadedByUserId_fkey` FOREIGN KEY (`uploadedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `File` ADD CONSTRAINT `File_visiblePermissionId_fkey` FOREIGN KEY (`visiblePermissionId`) REFERENCES `Permission`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `File` ADD CONSTRAINT `File_previewFileId_fkey` FOREIGN KEY (`previewFileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `File` ADD CONSTRAINT `File_parentFileId_fkey` FOREIGN KEY (`parentFileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FileUserTag` ADD CONSTRAINT `FileUserTag_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `File`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FileUserTag` ADD CONSTRAINT `FileUserTag_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FileSongTag` ADD CONSTRAINT `FileSongTag_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `File`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FileSongTag` ADD CONSTRAINT `FileSongTag_songId_fkey` FOREIGN KEY (`songId`) REFERENCES `Song`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FileEventTag` ADD CONSTRAINT `FileEventTag_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `File`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FileEventTag` ADD CONSTRAINT `FileEventTag_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FileInstrumentTag` ADD CONSTRAINT `FileInstrumentTag_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `File`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FileInstrumentTag` ADD CONSTRAINT `FileInstrumentTag_instrumentId_fkey` FOREIGN KEY (`instrumentId`) REFERENCES `Instrument`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FrontpageGalleryItem` ADD CONSTRAINT `FrontpageGalleryItem_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `File`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FrontpageGalleryItem` ADD CONSTRAINT `FrontpageGalleryItem_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FrontpageGalleryItem` ADD CONSTRAINT `FrontpageGalleryItem_visiblePermissionId_fkey` FOREIGN KEY (`visiblePermissionId`) REFERENCES `Permission`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
