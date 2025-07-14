/*
  Warnings:

  - You are about to alter the column `feature` on the `action` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(64)`.
  - You are about to alter the column `queryText` on the `action` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(64)`.
  - You are about to alter the column `browserName` on the `action` table. The data in that column could be lost. The data in that column will be cast from `VarChar(30)` to `VarChar(16)`.
  - You are about to alter the column `deviceClass` on the `action` table. The data in that column could be lost. The data in that column will be cast from `VarChar(30)` to `VarChar(16)`.
  - You are about to alter the column `pointerType` on the `action` table. The data in that column could be lost. The data in that column will be cast from `VarChar(30)` to `VarChar(16)`.
  - You are about to alter the column `operatingSystem` on the `action` table. The data in that column could be lost. The data in that column will be cast from `VarChar(30)` to `VarChar(16)`.
  - You are about to alter the column `language` on the `action` table. The data in that column could be lost. The data in that column will be cast from `VarChar(30)` to `VarChar(8)`.
  - You are about to alter the column `locale` on the `action` table. The data in that column could be lost. The data in that column will be cast from `VarChar(30)` to `VarChar(8)`.
  - You are about to alter the column `timezone` on the `action` table. The data in that column could be lost. The data in that column will be cast from `VarChar(90)` to `VarChar(48)`.

  - You are about to drop the column `userId` on the `eventsonglist` table. All the data in the column will be lost.
  - You are about to drop the column `groupName` on the `setlistplan` table. All the data in the column will be lost.
  - You are about to drop the column `showOnSongLists` on the `songtag` table. All the data in the column will be lost.

*/

-- ensure namespaces are correct; for some reason on my dev system this was not the case.
update wikipage set namespace = 'eventdescription' where slug like 'EventDescription/%';

-- DropForeignKey
ALTER TABLE `EventSongList` DROP FOREIGN KEY `EventSongList_userId_fkey`;

-- DropIndex
DROP INDEX `SongTag_showOnSongLists_idx` ON `songtag`;

-- custom: truncate long text columns
update `Action`
set `uri` = substring(`uri`, 1, 191),
    `feature` = substring(`feature`, 1, 64),
    `context` = substring(`context`, 1, 256),
    `queryText` = substring(`queryText`, 1, 64),
    `browserName` = substring(`browserName`, 1, 16),
    `deviceClass` = substring(`deviceClass`, 1, 16),
    `pointerType` = substring(`pointerType`, 1, 16),
    `operatingSystem` = substring(`operatingSystem`, 1, 16),
    `language` = substring(`language`, 1, 8),
    `locale` = substring(`locale`, 1, 8),
    `timezone` = substring(`timezone`, 1, 48)
where length(`uri`) > 191
   or length(`feature`) > 64
   or length(`context`) > 256
   or length(`queryText`) > 64
   or length(`browserName`) > 16
   or length(`deviceClass`) > 16
   or length(`pointerType`) > 16
   or length(`operatingSystem`) > 16
   or length(`language`) > 8
   or length(`locale`) > 8
   or length(`timezone`) > 48;

-- AlterTable
ALTER TABLE `Action` MODIFY `uri` VARCHAR(192) NULL,
    MODIFY `feature` VARCHAR(64) NOT NULL,
    MODIFY `context` VARCHAR(256) NULL,
    MODIFY `queryText` VARCHAR(64) NULL,
    MODIFY `browserName` VARCHAR(16) NULL,
    MODIFY `deviceClass` VARCHAR(16) NULL,
    MODIFY `pointerType` VARCHAR(16) NULL,
    MODIFY `operatingSystem` VARCHAR(16) NULL,
    MODIFY `language` VARCHAR(8) NULL,
    MODIFY `locale` VARCHAR(8) NULL,
    MODIFY `timezone` VARCHAR(48) NULL;

-- custom:  make Event.createdAt not null by setting to startsAt or current timestamp
update `Event`
set `createdAt` = if(`startsAt` is not null, `startsAt`, current_timestamp(3))
where `createdAt` is null;

-- AlterTable
ALTER TABLE `Event` ADD COLUMN `relevanceClassOverride` INTEGER NULL,
    ADD COLUMN `updatedByUserId` INTEGER NULL,
    MODIFY `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `EventSegmentUserResponse` ADD COLUMN `createdAt` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `createdByUserId` INTEGER NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updatedByUserId` INTEGER NULL;

-- AlterTable
ALTER TABLE `EventSongList` DROP COLUMN `userId`;

-- AlterTable
ALTER TABLE `SetlistPlan` DROP COLUMN `groupName`,
    ADD COLUMN `groupId` INTEGER NULL,
    ADD COLUMN `sortOrder` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `Song` ADD COLUMN `pinnedRecordingId` INTEGER NULL;

-- AlterTable
ALTER TABLE `SongTag` DROP COLUMN `showOnSongLists`,
    ADD COLUMN `group` VARCHAR(768) NULL;

-- AlterTable
ALTER TABLE `WikiPage` ADD COLUMN `createdAt` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `createdByUserId` INTEGER NULL;

-- CreateTable
CREATE TABLE `FileWikiPageTag` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fileId` INTEGER NOT NULL,
    `wikiPageId` INTEGER NOT NULL,

    INDEX `FileWikiPageTag_fileId_idx`(`fileId`),
    INDEX `FileWikiPageTag_wikiPageId_idx`(`wikiPageId`),
    UNIQUE INDEX `FileWikiPageTag_fileId_wikiPageId_key`(`fileId`, `wikiPageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WikiPageTag` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `text` VARCHAR(768) NOT NULL,
    `description` MEDIUMTEXT NOT NULL,
    `color` VARCHAR(191) NULL,
    `significance` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `WikiPageTag_text_idx`(`text`),
    INDEX `WikiPageTag_significance_idx`(`significance`),
    INDEX `WikiPageTag_sortOrder_idx`(`sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WikiPageTagAssignment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `wikiPageId` INTEGER NOT NULL,
    `tagId` INTEGER NOT NULL,

    INDEX `WikiPageTagAssignment_wikiPageId_idx`(`wikiPageId`),
    INDEX `WikiPageTagAssignment_tagId_idx`(`tagId`),
    UNIQUE INDEX `WikiPageTagAssignment_wikiPageId_tagId_key`(`wikiPageId`, `tagId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SetlistPlanGroup` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(768) NOT NULL,
    `description` MEDIUMTEXT NOT NULL,
    `color` VARCHAR(768) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdByUserId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SetlistPlanGroup_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Song` ADD CONSTRAINT `Song_pinnedRecordingId_fkey` FOREIGN KEY (`pinnedRecordingId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Event` ADD CONSTRAINT `Event_updatedByUserId_fkey` FOREIGN KEY (`updatedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventSegmentUserResponse` ADD CONSTRAINT `EventSegmentUserResponse_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventSegmentUserResponse` ADD CONSTRAINT `EventSegmentUserResponse_updatedByUserId_fkey` FOREIGN KEY (`updatedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FileWikiPageTag` ADD CONSTRAINT `FileWikiPageTag_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `File`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FileWikiPageTag` ADD CONSTRAINT `FileWikiPageTag_wikiPageId_fkey` FOREIGN KEY (`wikiPageId`) REFERENCES `WikiPage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WikiPage` ADD CONSTRAINT `WikiPage_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WikiPageTagAssignment` ADD CONSTRAINT `WikiPageTagAssignment_wikiPageId_fkey` FOREIGN KEY (`wikiPageId`) REFERENCES `WikiPage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WikiPageTagAssignment` ADD CONSTRAINT `WikiPageTagAssignment_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `WikiPageTag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SetlistPlanGroup` ADD CONSTRAINT `SetlistPlanGroup_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SetlistPlan` ADD CONSTRAINT `SetlistPlan_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `SetlistPlanGroup`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
