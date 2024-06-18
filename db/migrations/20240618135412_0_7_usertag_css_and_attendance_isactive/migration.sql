-- AlterTable
ALTER TABLE `EventAttendance` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `UserTag` ADD COLUMN `cssClass` VARCHAR(191) NULL;
