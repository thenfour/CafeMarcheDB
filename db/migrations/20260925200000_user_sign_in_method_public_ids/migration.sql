ALTER TABLE `UserSignInMethod`
    ADD COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL;

-- Startup replaces deployment placeholders before serving requests.
UPDATE `UserSignInMethod`
SET `publicId` = CONCAT('~', LPAD(CAST(`id` AS CHAR), 15, '0'));

ALTER TABLE `UserSignInMethod`
    MODIFY COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;

CREATE UNIQUE INDEX `UserSignInMethod_publicId_key`
    ON `UserSignInMethod`(`publicId`);
