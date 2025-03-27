/*
  Warnings:

  - A unique constraint covering the columns `[descriptionWikiPageId]` on the table `Event` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `event` ADD COLUMN `descriptionWikiPageId` INTEGER NULL;

-- AlterTable
ALTER TABLE `wikipage` ADD COLUMN `lastEditPingAt` DATETIME(3) NULL,
    ADD COLUMN `lockAcquiredAt` DATETIME(3) NULL,
    ADD COLUMN `lockExpiresAt` DATETIME(3) NULL,
    ADD COLUMN `lockId` VARCHAR(191) NULL,
    ADD COLUMN `lockedByUserId` INTEGER NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Event_descriptionWikiPageId_key` ON `Event`(`descriptionWikiPageId`);

-- CreateIndex
CREATE INDEX `WikiPage_namespace_idx` ON `WikiPage`(`namespace`);

-- CreateIndex
CREATE INDEX `WikiPage_lockedByUserId_idx` ON `WikiPage`(`lockedByUserId`);

-- AddForeignKey
ALTER TABLE `Event` ADD CONSTRAINT `Event_descriptionWikiPageId_fkey` FOREIGN KEY (`descriptionWikiPageId`) REFERENCES `WikiPage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WikiPage` ADD CONSTRAINT `WikiPage_lockedByUserId_fkey` FOREIGN KEY (`lockedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- update the structured links to wiki page
update `Event` e
set e.`descriptionWikiPageId` = (
	SELECT
	  wp.id
	FROM
		`WikiPage` wp
	where
		wp.slug = CONCAT('EventDescription/', CAST(e.`id` AS CHAR)) COLLATE utf8mb4_unicode_ci
	limit 1
);
