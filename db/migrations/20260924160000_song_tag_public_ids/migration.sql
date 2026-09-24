ALTER TABLE `SongTag`
    ADD COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL;

ALTER TABLE `SongTagAssociation`
    ADD COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL;

-- Populate deployment-safe placeholders. Node instrumentation replaces them
-- with random public IDs before the application begins serving requests.
UPDATE `SongTag`
SET `publicId` = CONCAT('~', LPAD(CAST(`id` AS CHAR), 15, '0'));

UPDATE `SongTagAssociation`
SET `publicId` = CONCAT('~', LPAD(CAST(`id` AS CHAR), 15, '0'));

ALTER TABLE `SongTag`
    MODIFY COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;

ALTER TABLE `SongTagAssociation`
    MODIFY COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;

CREATE UNIQUE INDEX `SongTag_publicId_key`
    ON `SongTag`(`publicId`);

CREATE UNIQUE INDEX `SongTagAssociation_publicId_key`
    ON `SongTagAssociation`(`publicId`);

-- new policy allows dev environments to have multiple claims on the same token
ALTER TABLE `AdminBootstrapClaim`
  DROP INDEX `AdminBootstrapClaim_tokenHash_key`;
