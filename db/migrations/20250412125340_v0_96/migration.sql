-- DropForeignKey
ALTER TABLE `action` DROP FOREIGN KEY `Action_eventId_fkey`;

-- DropForeignKey
ALTER TABLE `action` DROP FOREIGN KEY `Action_fileId_fkey`;

-- DropForeignKey
ALTER TABLE `action` DROP FOREIGN KEY `Action_songId_fkey`;

-- DropForeignKey
ALTER TABLE `action` DROP FOREIGN KEY `Action_wikiPageId_fkey`;

-- AlterTable
ALTER TABLE `action` ADD COLUMN `attendanceId` INTEGER NULL,
    ADD COLUMN `customLinkId` INTEGER NULL,
    ADD COLUMN `eventSegmentId` INTEGER NULL,
    ADD COLUMN `eventSongListId` INTEGER NULL,
    ADD COLUMN `frontpageGalleryItemId` INTEGER NULL,
    ADD COLUMN `instrumentId` INTEGER NULL,
    ADD COLUMN `menuLinkId` INTEGER NULL,
    ADD COLUMN `setlistPlanId` INTEGER NULL,
    ADD COLUMN `songCreditTypeId` INTEGER NULL;

-- AlterTable
ALTER TABLE `setlistplan` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `visiblePermissionId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `Action_createdAt_userId_context_idx` ON `Action`(`createdAt`, `userId`, `context`);

-- AddForeignKey
ALTER TABLE `Action` ADD CONSTRAINT `Action_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Action` ADD CONSTRAINT `Action_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Action` ADD CONSTRAINT `Action_songId_fkey` FOREIGN KEY (`songId`) REFERENCES `Song`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Action` ADD CONSTRAINT `Action_wikiPageId_fkey` FOREIGN KEY (`wikiPageId`) REFERENCES `WikiPage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Action` ADD CONSTRAINT `Action_eventSegmentId_fkey` FOREIGN KEY (`eventSegmentId`) REFERENCES `EventSegment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Action` ADD CONSTRAINT `Action_attendanceId_fkey` FOREIGN KEY (`attendanceId`) REFERENCES `EventAttendance`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Action` ADD CONSTRAINT `Action_customLinkId_fkey` FOREIGN KEY (`customLinkId`) REFERENCES `CustomLink`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Action` ADD CONSTRAINT `Action_eventSongListId_fkey` FOREIGN KEY (`eventSongListId`) REFERENCES `EventSongList`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Action` ADD CONSTRAINT `Action_frontpageGalleryItemId_fkey` FOREIGN KEY (`frontpageGalleryItemId`) REFERENCES `FrontpageGalleryItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Action` ADD CONSTRAINT `Action_menuLinkId_fkey` FOREIGN KEY (`menuLinkId`) REFERENCES `MenuLink`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Action` ADD CONSTRAINT `Action_setlistPlanId_fkey` FOREIGN KEY (`setlistPlanId`) REFERENCES `SetlistPlan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Action` ADD CONSTRAINT `Action_songCreditTypeId_fkey` FOREIGN KEY (`songCreditTypeId`) REFERENCES `SongCreditType`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Action` ADD CONSTRAINT `Action_instrumentId_fkey` FOREIGN KEY (`instrumentId`) REFERENCES `Instrument`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SetlistPlan` ADD CONSTRAINT `SetlistPlan_visiblePermissionId_fkey` FOREIGN KEY (`visiblePermissionId`) REFERENCES `Permission`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
