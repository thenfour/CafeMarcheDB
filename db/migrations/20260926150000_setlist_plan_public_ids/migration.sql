-- Startup replaces deployment placeholders before serving requests.

ALTER TABLE `SetlistPlanGroup`
    ADD COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL;
UPDATE `SetlistPlanGroup` SET `publicId` = CONCAT('~', LPAD(CAST(`id` AS CHAR), 15, '0'));
ALTER TABLE `SetlistPlanGroup`
    MODIFY COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;
CREATE UNIQUE INDEX `SetlistPlanGroup_publicId_key` ON `SetlistPlanGroup`(`publicId`);

ALTER TABLE `SetlistPlan`
    ADD COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL;
UPDATE `SetlistPlan` SET `publicId` = CONCAT('~', LPAD(CAST(`id` AS CHAR), 15, '0'));
ALTER TABLE `SetlistPlan`
    MODIFY COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;
CREATE UNIQUE INDEX `SetlistPlan_publicId_key` ON `SetlistPlan`(`publicId`);
