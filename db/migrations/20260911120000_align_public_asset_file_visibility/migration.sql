-- Direct file downloads now enforce File.visiblePermissionId. Align assets
-- which were already intentionally exposed by public gallery and branding
-- workflows before that enforcement takes effect.

-- set all (non-deleted) frontpage gallery item files to have public visibility
UPDATE `File` AS f
INNER JOIN `FrontpageGalleryItem` AS g ON g.`fileId` = f.`id`
INNER JOIN `Permission` AS p
    ON p.`id` = g.`visiblePermissionId`
    AND p.`name` = 'visibility_public'
SET f.`visiblePermissionId` = p.`id`
WHERE g.`isDeleted` = false
  AND f.`isDeleted` = false
  AND (f.`visiblePermissionId` IS NULL OR f.`visiblePermissionId` <> p.`id`);

-- set all (non-deleted) site logo and favicon files to have public visibility
UPDATE `File` AS f
INNER JOIN `Setting` AS s
    ON s.`name` IN ('Dashboard_SiteLogoUrl', 'Dashboard_SiteFaviconUrl')
INNER JOIN `Permission` AS p ON p.`name` = 'visibility_public'
SET f.`visiblePermissionId` = p.`id`
WHERE f.`isDeleted` = false
  AND RIGHT(
    s.`value`,
    CHAR_LENGTH(CONCAT('/api/files/download/', f.`storedLeafName`))
  ) = CONCAT('/api/files/download/', f.`storedLeafName`)
  AND (f.`visiblePermissionId` IS NULL OR f.`visiblePermissionId` <> p.`id`);
