ALTER TABLE `WikiPageTag`
    ADD COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL;

ALTER TABLE `WikiPageTagAssignment`
    ADD COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL;

-- Populate deployment-safe placeholders. Node instrumentation replaces them
-- with random public IDs before the application begins serving requests.
UPDATE `WikiPageTag`
SET `publicId` = CONCAT('~', LPAD(CAST(`id` AS CHAR), 15, '0'));

UPDATE `WikiPageTagAssignment`
SET `publicId` = CONCAT('~', LPAD(CAST(`id` AS CHAR), 15, '0'));

ALTER TABLE `WikiPageTag`
    MODIFY COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;

ALTER TABLE `WikiPageTagAssignment`
    MODIFY COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;

CREATE UNIQUE INDEX `WikiPageTag_publicId_key`
    ON `WikiPageTag`(`publicId`);

CREATE UNIQUE INDEX `WikiPageTagAssignment_publicId_key`
    ON `WikiPageTagAssignment`(`publicId`);
