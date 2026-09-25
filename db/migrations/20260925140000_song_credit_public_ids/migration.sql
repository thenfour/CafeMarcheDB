ALTER TABLE `SongCreditType`
    ADD COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL;

ALTER TABLE `SongCredit`
    ADD COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL;

-- Populate deployment-safe placeholders. Node instrumentation replaces them
-- with random public IDs before the application begins serving requests.
UPDATE `SongCreditType`
SET `publicId` = CONCAT('~', LPAD(CAST(`id` AS CHAR), 15, '0'));

UPDATE `SongCredit`
SET `publicId` = CONCAT('~', LPAD(CAST(`id` AS CHAR), 15, '0'));

ALTER TABLE `SongCreditType`
    MODIFY COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;

ALTER TABLE `SongCredit`
    MODIFY COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;

CREATE UNIQUE INDEX `SongCreditType_publicId_key`
    ON `SongCreditType`(`publicId`);

CREATE UNIQUE INDEX `SongCredit_publicId_key`
    ON `SongCredit`(`publicId`);
