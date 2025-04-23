-- AlterTable
ALTER TABLE `Action` ADD COLUMN `browserName` VARCHAR(191) NULL,
    ADD COLUMN `deviceClass` VARCHAR(191) NULL,
    ADD COLUMN `pointerType` VARCHAR(191) NULL,
    ADD COLUMN `screenHeight` INTEGER NULL,
    ADD COLUMN `screenWidth` INTEGER NULL,

    ADD COLUMN `operatingSystem` VARCHAR(191) NULL,
    ADD COLUMN `language` VARCHAR(191) NULL,
    ADD COLUMN `locale` VARCHAR(191) NULL,
    ADD COLUMN `timezone` VARCHAR(191) NULL;


-- AlterTable
ALTER TABLE `SongTag` ADD COLUMN `indicator` VARCHAR(191) NULL,
    ADD COLUMN `indicatorCssClass` VARCHAR(191) NULL;
