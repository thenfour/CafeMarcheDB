/*
  Warnings:

  - You are about to drop the `activity` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `eventcomment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `songcomment` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[consolidationKey]` on the table `WikiPageRevision` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `Activity` DROP FOREIGN KEY `Activity_userId_fkey`;

-- DropForeignKey
ALTER TABLE `EventComment` DROP FOREIGN KEY `EventComment_eventId_fkey`;

-- DropForeignKey
ALTER TABLE `EventComment` DROP FOREIGN KEY `EventComment_userId_fkey`;

-- DropForeignKey
ALTER TABLE `EventComment` DROP FOREIGN KEY `EventComment_visiblePermissionId_fkey`;

-- DropForeignKey
ALTER TABLE `SongComment` DROP FOREIGN KEY `SongComment_songId_fkey`;

-- DropForeignKey
ALTER TABLE `SongComment` DROP FOREIGN KEY `SongComment_userId_fkey`;

-- DropForeignKey
ALTER TABLE `SongComment` DROP FOREIGN KEY `SongComment_visiblePermissionId_fkey`;

-- AlterTable
ALTER TABLE `WikiPageRevision` ADD COLUMN `charsAdded` INTEGER NULL,
    ADD COLUMN `charsRemoved` INTEGER NULL,
    ADD COLUMN `consolidationKey` VARCHAR(191) NULL,
    ADD COLUMN `lineCount` INTEGER NULL,
    ADD COLUMN `linesAdded` INTEGER NULL,
    ADD COLUMN `linesRemoved` INTEGER NULL,
    ADD COLUMN `prevLineCount` INTEGER NULL,
    ADD COLUMN `prevSizeChars` INTEGER NULL,
    ADD COLUMN `sizeChars` INTEGER NULL;

-- DropTable
DROP TABLE `Activity`;

-- DropTable
DROP TABLE `EventComment`;

-- DropTable
DROP TABLE `SongComment`;

-- CreateTable
CREATE TABLE `Action` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` INTEGER NULL,
    `uri` VARCHAR(191) NULL,
    `isClient` BOOLEAN NOT NULL,
    `feature` VARCHAR(191) NOT NULL,
    `fileId` INTEGER NULL,
    `eventId` INTEGER NULL,
    `songId` INTEGER NULL,
    `wikiPageId` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `WikiPageRevision_consolidationKey_idx` ON `WikiPageRevision`(`consolidationKey`);

-- CreateIndex
CREATE UNIQUE INDEX `WikiPageRevision_consolidationKey_key` ON `WikiPageRevision`(`consolidationKey`);

-- AddForeignKey
ALTER TABLE `Action` ADD CONSTRAINT `Action_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Action` ADD CONSTRAINT `Action_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `File`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Action` ADD CONSTRAINT `Action_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Action` ADD CONSTRAINT `Action_songId_fkey` FOREIGN KEY (`songId`) REFERENCES `Song`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Action` ADD CONSTRAINT `Action_wikiPageId_fkey` FOREIGN KEY (`wikiPageId`) REFERENCES `WikiPage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
