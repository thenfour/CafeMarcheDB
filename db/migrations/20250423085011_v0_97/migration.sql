-- AlterTable
ALTER TABLE `Action` ADD COLUMN `browserName` VARCHAR(191) NULL,
    ADD COLUMN `deviceClass` VARCHAR(191) NULL,
    ADD COLUMN `pointerType` VARCHAR(191) NULL,
    ADD COLUMN `screenHeight` INTEGER NULL,
    ADD COLUMN `screenWidth` INTEGER NULL;

-- AlterTable
ALTER TABLE `SongTag` ADD COLUMN `indicator` VARCHAR(191) NULL,
    ADD COLUMN `indicatorCssClass` VARCHAR(191) NULL;
