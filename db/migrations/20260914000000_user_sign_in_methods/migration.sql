-- Populate the new authority BEFORE removing the old columns/constraints.
-- Duplicate normalized emails or Google subjects (including inactive users)
-- deliberately fail the unique constraint; never choose an owner implicitly.
CREATE TABLE `UserSignInMethod` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `type` ENUM('email', 'google') NOT NULL,
    `identifier` VARCHAR(320) COLLATE utf8mb4_bin NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `UserSignInMethod_type_identifier_key` (`type`, `identifier`),
    INDEX `UserSignInMethod_userId_idx` (`userId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `UserSignInMethod_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;

INSERT INTO `UserSignInMethod` (`userId`, `type`, `identifier`)
SELECT `id`, 'email', LOWER(TRIM(`email`)) FROM `User`;

INSERT INTO `UserSignInMethod` (`userId`, `type`, `identifier`)
SELECT `id`, 'google', `googleId` FROM `User` WHERE `googleId` IS NOT NULL;

ALTER TABLE `User` DROP INDEX `User_email_key`, DROP INDEX `User_googleId_idx`, DROP COLUMN `googleId`;
