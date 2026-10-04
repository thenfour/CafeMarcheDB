

-- Legacy announcements / event descriptions
-- have no owner and NULL visibility and were only visible because permissions weren't checked.
-- set them to the 'visibility_members' permission.
UPDATE `WikiPage` AS page
JOIN `Permission` AS permission ON permission.`name` = 'visibility_members'
SET page.`visiblePermissionId` = permission.`id`
WHERE
(page.`slug` = 'special/announcements' or page.`namespace` = 'EventDescription')
  AND page.`visiblePermissionId` IS NULL;
