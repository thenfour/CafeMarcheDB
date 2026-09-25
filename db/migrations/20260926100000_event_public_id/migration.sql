-- Startup replaces deployment placeholders before serving requests.

ALTER TABLE `Event`
    ADD COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL;
UPDATE `Event` SET `publicId` = CONCAT('~', LPAD(CAST(`id` AS CHAR), 15, '0'));
ALTER TABLE `Event`
    MODIFY COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;
CREATE UNIQUE INDEX `Event_publicId_key` ON `Event`(`publicId`);
