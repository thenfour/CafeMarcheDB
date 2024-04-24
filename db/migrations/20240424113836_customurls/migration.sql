-- CreateTable
CREATE TABLE `CustomLink` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(768) NOT NULL,
    `description` MEDIUMTEXT NOT NULL,
    `slug` VARCHAR(768) NOT NULL,
    `destinationURL` VARCHAR(768) NOT NULL,
    `redirectType` VARCHAR(191) NOT NULL,
    `forwardQuery` BOOLEAN NOT NULL DEFAULT false,
    `intermediateMessage` MEDIUMTEXT NULL,
    `createdByUserId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CustomLink_name_idx`(`name`),
    UNIQUE INDEX `CustomLink_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomLinkVisit` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `customLinkId` INTEGER NOT NULL,
    `visitedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `visitorIP` VARCHAR(256) NULL,
    `userAgent` MEDIUMTEXT NULL,
    `referrerURL` MEDIUMTEXT NULL,
    `URI` MEDIUMTEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CustomLink` ADD CONSTRAINT `CustomLink_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomLinkVisit` ADD CONSTRAINT `CustomLinkVisit_customLinkId_fkey` FOREIGN KEY (`customLinkId`) REFERENCES `CustomLink`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
