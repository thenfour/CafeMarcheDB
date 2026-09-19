ALTER TABLE `InstrumentFunctionalGroup`
    ADD COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL;

-- populate initial values to a special prefixed value; instrumentation startup
-- will repair them. see : CorrectInstrumentFunctionalGroupPublicIds()
UPDATE `InstrumentFunctionalGroup`
SET `publicId` = CONCAT('~', LPAD(CAST(`id` AS CHAR), 15, '0'));

ALTER TABLE `InstrumentFunctionalGroup`
    MODIFY COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;

CREATE UNIQUE INDEX `InstrumentFunctionalGroup_publicId_key`
    ON `InstrumentFunctionalGroup`(`publicId`);
