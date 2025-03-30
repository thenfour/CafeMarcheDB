-- AlterTable
ALTER TABLE `EventSongListDivider` ADD COLUMN `isSong` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `lengthSeconds` INTEGER NULL,
    ADD COLUMN `subtitleIfSong` VARCHAR(768) NULL;

-- AlterTable
ALTER TABLE `SetlistPlan` ADD COLUMN `groupName` VARCHAR(768) NOT NULL DEFAULT '';
