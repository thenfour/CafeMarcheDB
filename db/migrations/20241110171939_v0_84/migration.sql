-- AlterTable
ALTER TABLE `EventSegment` ADD COLUMN `statusId` INTEGER NULL;

-- AlterTable
ALTER TABLE `EventSongListDivider` ADD COLUMN `color` VARCHAR(191) NULL,
    ADD COLUMN `isInterruption` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `SongCreditType` ADD COLUMN `significance` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `EventSegment_statusId_idx` ON `EventSegment`(`statusId`);

-- CreateIndex
CREATE INDEX `SongCreditType_significance_idx` ON `SongCreditType`(`significance`);

-- AddForeignKey
ALTER TABLE `EventSegment` ADD CONSTRAINT `EventSegment_statusId_fkey` FOREIGN KEY (`statusId`) REFERENCES `EventStatus`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
