ALTER TABLE `EventSongList`
    ADD COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL;

-- Startup replaces deployment placeholders before serving requests.
UPDATE `EventSongList`
SET `publicId` = CONCAT('~', LPAD(CAST(`id` AS CHAR), 15, '0'));

ALTER TABLE `EventSongList`
    MODIFY COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;

CREATE UNIQUE INDEX `EventSongList_publicId_key`
    ON `EventSongList`(`publicId`);

ALTER TABLE `EventSongListSong`
    ADD COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL;

-- Startup replaces deployment placeholders before serving requests.
UPDATE `EventSongListSong`
SET `publicId` = CONCAT('~', LPAD(CAST(`id` AS CHAR), 15, '0'));

ALTER TABLE `EventSongListSong`
    MODIFY COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;

CREATE UNIQUE INDEX `EventSongListSong_publicId_key`
    ON `EventSongListSong`(`publicId`);

ALTER TABLE `EventSongListDivider`
    ADD COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL;

-- Startup replaces deployment placeholders before serving requests.
UPDATE `EventSongListDivider`
SET `publicId` = CONCAT('~', LPAD(CAST(`id` AS CHAR), 15, '0'));

ALTER TABLE `EventSongListDivider`
    MODIFY COLUMN `publicId` CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;

CREATE UNIQUE INDEX `EventSongListDivider_publicId_key`
    ON `EventSongListDivider`(`publicId`);
