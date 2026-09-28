ALTER TABLE `UserSignInMethod`
    ADD COLUMN `displayId` VARCHAR(320) NULL;

-- The old-user migration marks copied methods with a temporary public ID.
-- Backfill only those Google rows; methods linked later have no known address.
UPDATE `UserSignInMethod` AS method
JOIN `User` AS account ON account.`id` = method.`userId`
SET method.`displayId` = LOWER(TRIM(account.`email`))
WHERE method.`type` = 'google'
  AND method.`publicId` LIKE '~%';
