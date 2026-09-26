-- Startup replaces deployment placeholders before serving requests.

ALTER TABLE `Song`
    ADD COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL;
UPDATE `Song` SET `publicId` = CONCAT('~', LPAD(CAST(`id` AS CHAR), 15, '0'));
ALTER TABLE `Song`
    MODIFY COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;
CREATE UNIQUE INDEX `Song_publicId_key` ON `Song`(`publicId`);
