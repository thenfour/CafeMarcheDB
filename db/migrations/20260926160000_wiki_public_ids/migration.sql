-- Startup replaces deployment placeholders before serving requests.

ALTER TABLE `WikiPage`
    ADD COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL;
UPDATE `WikiPage` SET `publicId` = CONCAT('~', LPAD(CAST(`id` AS CHAR), 15, '0'));
ALTER TABLE `WikiPage`
    MODIFY COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;
CREATE UNIQUE INDEX `WikiPage_publicId_key` ON `WikiPage`(`publicId`);

ALTER TABLE `WikiPageRevision`
    ADD COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL;
UPDATE `WikiPageRevision` SET `publicId` = CONCAT('~', LPAD(CAST(`id` AS CHAR), 15, '0'));
ALTER TABLE `WikiPageRevision`
    MODIFY COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;
CREATE UNIQUE INDEX `WikiPageRevision_publicId_key` ON `WikiPageRevision`(`publicId`);
