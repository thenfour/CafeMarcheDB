ALTER TABLE `EventAttendance`
    ADD COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL;

-- Startup replaces deployment placeholders before serving requests.
UPDATE `EventAttendance`
SET `publicId` = CONCAT('~', LPAD(CAST(`id` AS CHAR), 15, '0'));

ALTER TABLE `EventAttendance`
    MODIFY COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;

CREATE UNIQUE INDEX `EventAttendance_publicId_key` ON `EventAttendance`(`publicId`);
