ALTER TABLE `EventType`
    ADD COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL;

ALTER TABLE `EventStatus`
    ADD COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL;

ALTER TABLE `EventTag`
    ADD COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL;

ALTER TABLE `EventTagAssignment`
    ADD COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL;

-- Populate deployment-safe placeholders. Node instrumentation replaces them
-- with random public IDs before the application begins serving requests.
UPDATE `EventType`
SET `publicId` = CONCAT('~', LPAD(CAST(`id` AS CHAR), 15, '0'));

UPDATE `EventStatus`
SET `publicId` = CONCAT('~', LPAD(CAST(`id` AS CHAR), 15, '0'));

UPDATE `EventTag`
SET `publicId` = CONCAT('~', LPAD(CAST(`id` AS CHAR), 15, '0'));

UPDATE `EventTagAssignment`
SET `publicId` = CONCAT('~', LPAD(CAST(`id` AS CHAR), 15, '0'));

ALTER TABLE `EventType`
    MODIFY COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;

ALTER TABLE `EventStatus`
    MODIFY COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;

ALTER TABLE `EventTag`
    MODIFY COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;

ALTER TABLE `EventTagAssignment`
    MODIFY COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;

CREATE UNIQUE INDEX `EventType_publicId_key`
    ON `EventType`(`publicId`);

CREATE UNIQUE INDEX `EventStatus_publicId_key`
    ON `EventStatus`(`publicId`);

CREATE UNIQUE INDEX `EventTag_publicId_key`
    ON `EventTag`(`publicId`);

CREATE UNIQUE INDEX `EventTagAssignment_publicId_key`
    ON `EventTagAssignment`(`publicId`);
