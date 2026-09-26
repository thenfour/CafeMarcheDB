-- Startup replaces deployment placeholders before serving requests.

ALTER TABLE `FrontpageGalleryItem`
    ADD COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL;
UPDATE `FrontpageGalleryItem` SET `publicId` = CONCAT('~', LPAD(CAST(`id` AS CHAR), 15, '0'));
ALTER TABLE `FrontpageGalleryItem`
    MODIFY COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;
CREATE UNIQUE INDEX `FrontpageGalleryItem_publicId_key` ON `FrontpageGalleryItem`(`publicId`);
