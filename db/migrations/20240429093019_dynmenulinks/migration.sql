/*
  Warnings:

  - You are about to drop the column `latestRevisionId` on the `wikipage` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[slug]` on the table `WikiPage` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `WikiPage_slug_idx` ON `WikiPage`;

-- AlterTable
ALTER TABLE `WikiPage` DROP COLUMN `latestRevisionId`;

-- CreateTable
CREATE TABLE `MenuLink` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `realm` VARCHAR(768) NULL,
    `groupName` VARCHAR(768) NOT NULL,
    `groupCssClass` VARCHAR(768) NOT NULL,
    `itemCssClass` VARCHAR(768) NOT NULL,
    `linkType` VARCHAR(768) NOT NULL,
    `externalURI` MEDIUMTEXT NULL,
    `applicationPage` VARCHAR(768) NULL,
    `wikiSlug` VARCHAR(768) NULL,
    `iconName` VARCHAR(768) NULL,
    `caption` VARCHAR(768) NOT NULL,
    `visiblePermissionId` INTEGER NULL,
    `createdByUserId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `WikiPage_slug_key` ON `WikiPage`(`slug`);

-- AddForeignKey
ALTER TABLE `MenuLink` ADD CONSTRAINT `MenuLink_visiblePermissionId_fkey` FOREIGN KEY (`visiblePermissionId`) REFERENCES `Permission`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MenuLink` ADD CONSTRAINT `MenuLink_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
