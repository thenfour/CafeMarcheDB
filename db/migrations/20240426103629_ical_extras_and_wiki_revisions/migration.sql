/*
  Warnings:

  - A unique constraint covering the columns `[uid]` on the table `Event` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[accessToken]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `event` ADD COLUMN `uid` VARCHAR(191) NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `role` ADD COLUMN `color` VARCHAR(768) NULL;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `accessToken` VARCHAR(768) NULL;

-- CreateTable
CREATE TABLE `WikiPage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(768) NOT NULL,
    `latestRevisionId` INTEGER NULL,
    `visiblePermissionId` INTEGER NULL,

    INDEX `WikiPage_slug_idx`(`slug`),
    INDEX `WikiPage_visiblePermissionId_idx`(`visiblePermissionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WikiPageRevision` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `wikiPageId` INTEGER NOT NULL,
    `name` VARCHAR(768) NOT NULL,
    `content` MEDIUMTEXT NOT NULL,
    `createdByUserId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WikiPageRevision_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Event_uid_key` ON `Event`(`uid`);

-- CreateIndex
CREATE UNIQUE INDEX `User_accessToken_key` ON `User`(`accessToken`);


-- Update existing events with UUIDs
UPDATE `event`
SET `uid` = (SELECT md5(uuid()))
WHERE `uid` IS NULL;

-- Update existing users with access tokens
UPDATE `user`
SET `accessToken` = (select concat(md5(uuid()), md5(uuid())))
WHERE `accessToken` IS NULL;

-- AddForeignKey
ALTER TABLE `WikiPage` ADD CONSTRAINT `WikiPage_visiblePermissionId_fkey` FOREIGN KEY (`visiblePermissionId`) REFERENCES `Permission`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WikiPageRevision` ADD CONSTRAINT `WikiPageRevision_wikiPageId_fkey` FOREIGN KEY (`wikiPageId`) REFERENCES `WikiPage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WikiPageRevision` ADD CONSTRAINT `WikiPageRevision_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
