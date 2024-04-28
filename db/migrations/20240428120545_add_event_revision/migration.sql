
ALTER TABLE `Event` ADD COLUMN `revision` INTEGER;
UPDATE `Event` SET `revision` = 1;
ALTER TABLE `Event` MODIFY COLUMN `revision` INTEGER NOT NULL;
