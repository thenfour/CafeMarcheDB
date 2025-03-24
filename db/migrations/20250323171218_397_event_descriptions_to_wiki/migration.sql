
-- remove existing pages
delete from `WikiPage` where `slug` like 'EventDescription/%';

-- Insert a new WikiPage for each Event that has a non-empty description.
--    We form the slug as "EventDescription/<eventId>".
INSERT INTO `WikiPage` (`slug`, `visiblePermissionId`)
SELECT
  CONCAT('EventDescription/', CAST(e.`id` AS CHAR)) COLLATE utf8mb4_unicode_ci,
  visiblePermissionId
FROM `Event` e
WHERE e.`description` IS NOT NULL
  AND e.`description` <> '';

-- Create WikiPageRevision rows, linking back to the WikiPage via matching slug.
INSERT INTO `WikiPageRevision` (`wikiPageId`, `content`, `name`)
SELECT
	w.`id`,
    e.`description`,
    concat('description for event ', CAST(e.`id` AS CHAR)) COLLATE utf8mb4_unicode_ci
FROM `Event` e
JOIN `WikiPage` w 
  ON w.`slug` = CONCAT('EventDescription/', CAST(e.`id` AS CHAR)) COLLATE utf8mb4_unicode_ci
WHERE e.`description` IS NOT NULL
  AND e.`description` <> '';


-- Drop the old column from Event once all data is migrated
ALTER TABLE `Event`
  DROP COLUMN `description`;

