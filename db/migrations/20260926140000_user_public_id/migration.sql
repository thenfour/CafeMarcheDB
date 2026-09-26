-- Startup replaces deployment placeholders before serving requests.

ALTER TABLE `User`
    ADD COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL;
UPDATE `User` SET `publicId` = CONCAT('~', LPAD(CAST(`id` AS CHAR), 15, '0'));
ALTER TABLE `User`
    MODIFY COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;
CREATE UNIQUE INDEX `User_publicId_key` ON `User`(`publicId`);
