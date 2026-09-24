ALTER TABLE `InstrumentTagAssociation`
    ADD COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL;

-- Populate deployment-safe placeholders. Node instrumentation replaces them
-- with random public IDs before the application begins serving requests.
UPDATE `InstrumentTagAssociation`
SET `publicId` = CONCAT('~', LPAD(CAST(`id` AS CHAR), 15, '0'));

ALTER TABLE `InstrumentTagAssociation`
    MODIFY COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;

CREATE UNIQUE INDEX `InstrumentTagAssociation_publicId_key`
    ON `InstrumentTagAssociation`(`publicId`);
