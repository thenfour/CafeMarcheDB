-- AlterTable
ALTER TABLE `WikiPage` ADD COLUMN `namespace` VARCHAR(768) NULL;


-- 2) Set `namespace` to the portion before the first slash (if any).
--    We do NOT update `slug` at all, so existing slugs remain unchanged.
UPDATE `WikiPage` w
SET w.`namespace` = SUBSTRING_INDEX(w.`slug`, '/', 1)
WHERE w.`slug` LIKE '%/%';
