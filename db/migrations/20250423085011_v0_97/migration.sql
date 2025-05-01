-- DropIndex
DROP INDEX `Action_createdAt_userId_context_idx` ON `Action`;

-- AlterTable
ALTER TABLE `Action` ADD COLUMN `browserName` VARCHAR(30) NULL,
    ADD COLUMN `deviceClass` VARCHAR(30) NULL,
    ADD COLUMN `pointerType` VARCHAR(30) NULL,
    ADD COLUMN `screenHeight` INTEGER NULL,
    ADD COLUMN `screenWidth` INTEGER NULL,

    ADD COLUMN `operatingSystem` VARCHAR(30) NULL,
    ADD COLUMN `language` VARCHAR(30) NULL,
    ADD COLUMN `locale` VARCHAR(30) NULL,
    ADD COLUMN `timezone` VARCHAR(90) NULL;

-- AlterTable
ALTER TABLE `SongTag` ADD COLUMN `indicator` VARCHAR(191) NULL,
    ADD COLUMN `indicatorCssClass` VARCHAR(191) NULL;


-- CreateIndex
CREATE INDEX `Action_feature_createdAt_userId_context_pointerType_deviceCl_idx` ON `Action`(`feature`, `createdAt`, `userId`, `context`, `pointerType`, `deviceClass`, `browserName`, `operatingSystem`, `language`, `locale`, `timezone`);
