/*
  Warnings:

  - A unique constraint covering the columns `[currentRevisionId]` on the table `WikiPage` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `WikiPage` ADD COLUMN `currentRevisionId` INTEGER NULL;


UPDATE `WikiPage` w
SET w.`currentRevisionId` = (
  SELECT r.`id`
  FROM `WikiPageRevision` r
  WHERE r.`wikiPageId` = w.`id`
  ORDER BY r.`createdAt` DESC
  LIMIT 1
);


-- CreateIndex
CREATE INDEX `WikiPage_currentRevisionId_idx` ON `WikiPage`(`currentRevisionId`);

-- CreateIndex
CREATE UNIQUE INDEX `WikiPage_currentRevisionId_key` ON `WikiPage`(`currentRevisionId`);

-- AddForeignKey
ALTER TABLE `WikiPage` ADD CONSTRAINT `WikiPage_currentRevisionId_fkey` FOREIGN KEY (`currentRevisionId`) REFERENCES `WikiPageRevision`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
