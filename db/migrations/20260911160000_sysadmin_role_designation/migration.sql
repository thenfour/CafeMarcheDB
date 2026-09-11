ALTER TABLE `Role`
    ADD COLUMN `isSysAdminRole` BOOLEAN NOT NULL DEFAULT false;

UPDATE `Role`
SET `isSysAdminRole` = true
WHERE `name` = 'Admin';

INSERT IGNORE INTO `RolePermission` (`roleId`, `permissionId`)
SELECT r.`id`, p.`id`
FROM `Role` r
JOIN `Permission` p ON p.`name` = 'practice_tools_use'
WHERE r.`isPublicRole` = true;
