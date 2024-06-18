-- AlterTable
ALTER TABLE `eventattendance` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `usertag` ADD COLUMN `cssClass` VARCHAR(191) NULL;
