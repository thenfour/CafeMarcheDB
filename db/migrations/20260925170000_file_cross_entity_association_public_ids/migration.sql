ALTER TABLE `FileUserTag`
    ADD COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL;
ALTER TABLE `FileSongTag`
    ADD COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL;
ALTER TABLE `FileEventTag`
    ADD COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL;
ALTER TABLE `FileInstrumentTag`
    ADD COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL;
ALTER TABLE `FileWikiPageTag`
    ADD COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL;

-- Populate deployment-safe placeholders. Node instrumentation replaces them
-- with random public IDs before the application begins serving requests.
UPDATE `FileUserTag`
SET `publicId` = CONCAT('~', LPAD(CAST(`id` AS CHAR), 15, '0'));
UPDATE `FileSongTag`
SET `publicId` = CONCAT('~', LPAD(CAST(`id` AS CHAR), 15, '0'));
UPDATE `FileEventTag`
SET `publicId` = CONCAT('~', LPAD(CAST(`id` AS CHAR), 15, '0'));
UPDATE `FileInstrumentTag`
SET `publicId` = CONCAT('~', LPAD(CAST(`id` AS CHAR), 15, '0'));
UPDATE `FileWikiPageTag`
SET `publicId` = CONCAT('~', LPAD(CAST(`id` AS CHAR), 15, '0'));

ALTER TABLE `FileUserTag`
    MODIFY COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;
ALTER TABLE `FileSongTag`
    MODIFY COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;
ALTER TABLE `FileEventTag`
    MODIFY COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;
ALTER TABLE `FileInstrumentTag`
    MODIFY COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;
ALTER TABLE `FileWikiPageTag`
    MODIFY COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;

CREATE UNIQUE INDEX `FileUserTag_publicId_key`
    ON `FileUserTag`(`publicId`);
CREATE UNIQUE INDEX `FileSongTag_publicId_key`
    ON `FileSongTag`(`publicId`);
CREATE UNIQUE INDEX `FileEventTag_publicId_key`
    ON `FileEventTag`(`publicId`);
CREATE UNIQUE INDEX `FileInstrumentTag_publicId_key`
    ON `FileInstrumentTag`(`publicId`);
CREATE UNIQUE INDEX `FileWikiPageTag_publicId_key`
    ON `FileWikiPageTag`(`publicId`);
