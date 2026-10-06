-- New capabilities after the data-preserving localization migration.
-- Existing grants remain. Sysadmin receives all seven capabilities; band roles
-- already carrying manage_site_branding receive the two band capabilities.
-- Permission scope/protection is enforced by the code registry, not this table.

CREATE TEMPORARY TABLE `_LsmbAuthorizationContext` (
    `localeId` INTEGER NOT NULL,
    `singletonValid` INTEGER NOT NULL
);
-- Missing active English or duplicate active Sysadmin designations fail before
-- permanent writes. Zero roles is valid for an empty installation seeded later.
INSERT INTO `_LsmbAuthorizationContext`
SELECT
    (SELECT `id` FROM `Locale` WHERE `ietfTag` = 'en-US' AND `isDeleted` = FALSE),
    (SELECT IF(COUNT(*) > 1, NULL, 1) FROM `GlobalRole`
        WHERE `isSysAdminRole` = TRUE AND `isDeleted` = FALSE);

CREATE TEMPORARY TABLE `_LsmbAuthorizationPermissions` (
    `name` VARCHAR(191) NOT NULL PRIMARY KEY,
    `description` TEXT NOT NULL,
    `sortOrder` INTEGER NOT NULL,
    `descriptionPublicId` CHAR(16) NOT NULL
);
INSERT INTO `_LsmbAuthorizationPermissions`
    (`name`, `description`, `sortOrder`, `descriptionPublicId`)
VALUES
    ('manage_band_settings', 'Manage configuration for the active band.', 100, REPLACE(REPLACE(TO_BASE64(RANDOM_BYTES(12)), '+', '-'), '/', '_')),
    ('manage_band_localization', 'Manage localized content and overrides for the active band.', 103, REPLACE(REPLACE(TO_BASE64(RANDOM_BYTES(12)), '+', '-'), '/', '_')),
    ('manage_bands', 'Administer bands across the platform.', 8800, REPLACE(REPLACE(TO_BASE64(RANDOM_BYTES(12)), '+', '-'), '/', '_')),
    ('manage_global_catalogs', 'Manage shared catalogs and behavior definitions across all bands.', 8810, REPLACE(REPLACE(TO_BASE64(RANDOM_BYTES(12)), '+', '-'), '/', '_')),
    ('manage_global_settings', 'Manage platform configuration.', 8820, REPLACE(REPLACE(TO_BASE64(RANDOM_BYTES(12)), '+', '-'), '/', '_')),
    ('manage_global_localization', 'Manage global locales and localized string defaults.', 8830, REPLACE(REPLACE(TO_BASE64(RANDOM_BYTES(12)), '+', '-'), '/', '_')),
    ('manage_global_users', 'Administer shared accounts and global role assignments.', 8840, REPLACE(REPLACE(TO_BASE64(RANDOM_BYTES(12)), '+', '-'), '/', '_'));

START TRANSACTION;

-- Clarify the existing capabilities' band meaning. Keep string identities and
-- non-English translations; startup will preserve subsequently edited wording.
UPDATE `DynamicLocalizedStringValue` v
JOIN `Permission` p ON p.`descriptionId` = v.`stringId`
JOIN `Locale` l ON l.`id` = v.`localeId` AND l.`ietfTag` = 'en-US'
SET v.`indexedValue` = NULL,
    v.`blobValue` = CASE p.`name`
        WHEN 'admin_events' THEN 'Manage event tags and configuration for the active band.'
        WHEN 'admin_songs' THEN 'Manage song tags and configuration for the active band.'
        WHEN 'admin_instruments' THEN 'Manage band instruments and functional groups.'
        WHEN 'manage_user_taxonomy' THEN 'Manage band member tag definitions and presentation.'
        WHEN 'deactivate_users' THEN 'Deactivate memberships in the active band.'
        WHEN 'recover_users' THEN 'View and reactivate memberships within the active band.'
        WHEN 'assign_user_roles' THEN 'Assign preconfigured band roles within the actor''s delegable permission envelope.'
        WHEN 'manage_users' THEN 'Manage membership data and assign existing band tags and instruments.'
    END,
    v.`updatedAt` = NOW(3)
WHERE p.`name` IN ('admin_events', 'admin_songs', 'admin_instruments', 'manage_user_taxonomy',
    'deactivate_users', 'recover_users', 'assign_user_roles', 'manage_users');

INSERT INTO `DynamicLocalizedString` (`publicId`, `format`, `createdAt`, `updatedAt`)
SELECT s.`descriptionPublicId`, 'Markdown', NOW(3), NOW(3)
FROM `_LsmbAuthorizationPermissions` s
LEFT JOIN `Permission` p ON p.`name` = s.`name`
WHERE p.`id` IS NULL OR p.`descriptionId` IS NULL;

INSERT INTO `Permission`
    (`publicId`, `name`, `descriptionId`, `sortOrder`, `isVisibility`, `isDeleted`, `createdAt`, `updatedAt`)
SELECT REPLACE(REPLACE(TO_BASE64(RANDOM_BYTES(12)), '+', '-'), '/', '_'), s.`name`, d.`id`, s.`sortOrder`, FALSE, FALSE, NOW(3), NOW(3)
FROM `_LsmbAuthorizationPermissions` s
JOIN `DynamicLocalizedString` d ON d.`publicId` = s.`descriptionPublicId`
LEFT JOIN `Permission` p ON p.`name` = s.`name`
WHERE p.`id` IS NULL;

UPDATE `Permission` p
JOIN `_LsmbAuthorizationPermissions` s ON s.`name` = p.`name`
JOIN `DynamicLocalizedString` d ON d.`publicId` = s.`descriptionPublicId`
SET p.`descriptionId` = d.`id`, p.`updatedAt` = NOW(3)
WHERE p.`descriptionId` IS NULL;

INSERT INTO `DynamicLocalizedStringValue`
    (`publicId`, `stringId`, `localeId`, `indexedValue`, `blobValue`, `updatedAt`)
SELECT REPLACE(REPLACE(TO_BASE64(RANDOM_BYTES(12)), '+', '-'), '/', '_'), d.`id`, c.`localeId`, NULL, s.`description`, NOW(3)
FROM `_LsmbAuthorizationPermissions` s
JOIN `DynamicLocalizedString` d ON d.`publicId` = s.`descriptionPublicId`
CROSS JOIN `_LsmbAuthorizationContext` c;

INSERT INTO `GlobalRolePermission`
    (`publicId`, `globalRoleId`, `permissionId`, `updatedAt`)
SELECT REPLACE(REPLACE(TO_BASE64(RANDOM_BYTES(12)), '+', '-'), '/', '_'), r.`id`, p.`id`, NOW(3)
FROM `GlobalRole` r
CROSS JOIN `_LsmbAuthorizationPermissions` s
JOIN `Permission` p ON p.`name` = s.`name`
WHERE r.`isSysAdminRole` = TRUE AND r.`isDeleted` = FALSE AND p.`isDeleted` = FALSE
    AND NOT EXISTS (
        SELECT 1 FROM `GlobalRolePermission` g
        WHERE g.`globalRoleId` = r.`id` AND g.`permissionId` = p.`id`
    );

INSERT INTO `BandRolePermission`
    (`publicId`, `bandRoleId`, `permissionId`, `updatedAt`)
SELECT REPLACE(REPLACE(TO_BASE64(RANDOM_BYTES(12)), '+', '-'), '/', '_'), r.`id`, p.`id`, NOW(3)
FROM `BandRole` r
JOIN `BandRolePermission` brandingGrant ON brandingGrant.`bandRoleId` = r.`id`
JOIN `Permission` branding ON branding.`id` = brandingGrant.`permissionId`
    AND branding.`name` = 'manage_site_branding' AND branding.`isDeleted` = FALSE
JOIN `Permission` p ON p.`name` IN ('manage_band_settings', 'manage_band_localization')
WHERE r.`isDeleted` = FALSE AND p.`isDeleted` = FALSE
    AND NOT EXISTS (
        SELECT 1 FROM `BandRolePermission` g
        WHERE g.`bandRoleId` = r.`id` AND g.`permissionId` = p.`id`
    );

COMMIT;

DROP TEMPORARY TABLE `_LsmbAuthorizationPermissions`;
DROP TEMPORARY TABLE `_LsmbAuthorizationContext`;

-- All four settings hives store typed JSON. The preceding migration already
-- encoded legacy global/band text as JSON strings; keep those documents intact.
ALTER TABLE `GlobalSetting` MODIFY `value` JSON NOT NULL;
ALTER TABLE `BandSetting` MODIFY `value` JSON NOT NULL;
