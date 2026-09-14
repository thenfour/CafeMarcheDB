ALTER TABLE `User`
    ADD COLUMN `mergedIntoUserId` INTEGER NULL,
    ADD COLUMN `mergedAt` DATETIME(3) NULL,
    ADD CONSTRAINT `User_mergedIntoUserId_fkey` FOREIGN KEY (`mergedIntoUserId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO `Permission` (`name`, `description`, `sortOrder`, `isVisibility`)
VALUES ('merge_users', 'Merge eligible user accounts and view aggregate merge data across the organization.', 707, false);

-- grant merge_users permission to sysadmin roles
INSERT INTO `RolePermission` (`roleId`, `permissionId`)
SELECT r.`id`, p.`id` FROM `Role` r
JOIN `Permission` p ON p.`name` = 'merge_users'
WHERE r.`isSysAdminRole` = true;
