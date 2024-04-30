-- DropForeignKey
ALTER TABLE `Activity` DROP FOREIGN KEY `Activity_userId_fkey`;

-- DropForeignKey
ALTER TABLE `Change` DROP FOREIGN KEY `Change_userId_fkey`;

-- DropForeignKey
ALTER TABLE `EventComment` DROP FOREIGN KEY `EventComment_eventId_fkey`;

-- DropForeignKey
ALTER TABLE `EventComment` DROP FOREIGN KEY `EventComment_userId_fkey`;

-- DropForeignKey
ALTER TABLE `EventSegment` DROP FOREIGN KEY `EventSegment_eventId_fkey`;

-- DropForeignKey
ALTER TABLE `EventSongList` DROP FOREIGN KEY `EventSongList_eventId_fkey`;

-- DropForeignKey
ALTER TABLE `EventSongListSong` DROP FOREIGN KEY `EventSongListSong_songId_fkey`;

-- DropForeignKey
ALTER TABLE `EventTagAssignment` DROP FOREIGN KEY `EventTagAssignment_eventId_fkey`;

-- DropForeignKey
ALTER TABLE `FileEventTag` DROP FOREIGN KEY `FileEventTag_eventId_fkey`;

-- DropForeignKey
ALTER TABLE `FileSongTag` DROP FOREIGN KEY `FileSongTag_songId_fkey`;

-- DropForeignKey
ALTER TABLE `FileTagAssignment` DROP FOREIGN KEY `FileTagAssignment_fileId_fkey`;

-- DropForeignKey
ALTER TABLE `FileUserTag` DROP FOREIGN KEY `FileUserTag_userId_fkey`;

-- DropForeignKey
ALTER TABLE `Instrument` DROP FOREIGN KEY `Instrument_functionalGroupId_fkey`;

-- DropForeignKey
ALTER TABLE `SongComment` DROP FOREIGN KEY `SongComment_songId_fkey`;

-- DropForeignKey
ALTER TABLE `SongComment` DROP FOREIGN KEY `SongComment_userId_fkey`;

-- DropForeignKey
ALTER TABLE `SongCredit` DROP FOREIGN KEY `SongCredit_songId_fkey`;

-- DropForeignKey
ALTER TABLE `SongCredit` DROP FOREIGN KEY `SongCredit_typeId_fkey`;

-- DropForeignKey
ALTER TABLE `SongCredit` DROP FOREIGN KEY `SongCredit_userId_fkey`;

-- DropForeignKey
ALTER TABLE `SongTagAssociation` DROP FOREIGN KEY `SongTagAssociation_songId_fkey`;

-- DropForeignKey
ALTER TABLE `SongTagAssociation` DROP FOREIGN KEY `SongTagAssociation_tagId_fkey`;

-- DropForeignKey
ALTER TABLE `UserInstrument` DROP FOREIGN KEY `UserInstrument_userId_fkey`;

-- AddForeignKey
ALTER TABLE `Change` ADD CONSTRAINT `Change_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Activity` ADD CONSTRAINT `Activity_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SongComment` ADD CONSTRAINT `SongComment_songId_fkey` FOREIGN KEY (`songId`) REFERENCES `Song`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SongComment` ADD CONSTRAINT `SongComment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SongCredit` ADD CONSTRAINT `SongCredit_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SongCredit` ADD CONSTRAINT `SongCredit_songId_fkey` FOREIGN KEY (`songId`) REFERENCES `Song`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SongCredit` ADD CONSTRAINT `SongCredit_typeId_fkey` FOREIGN KEY (`typeId`) REFERENCES `SongCreditType`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SongTagAssociation` ADD CONSTRAINT `SongTagAssociation_songId_fkey` FOREIGN KEY (`songId`) REFERENCES `Song`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SongTagAssociation` ADD CONSTRAINT `SongTagAssociation_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `SongTag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Instrument` ADD CONSTRAINT `Instrument_functionalGroupId_fkey` FOREIGN KEY (`functionalGroupId`) REFERENCES `InstrumentFunctionalGroup`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserInstrument` ADD CONSTRAINT `UserInstrument_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventSegment` ADD CONSTRAINT `EventSegment_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventTagAssignment` ADD CONSTRAINT `EventTagAssignment_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventComment` ADD CONSTRAINT `EventComment_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventComment` ADD CONSTRAINT `EventComment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventSongList` ADD CONSTRAINT `EventSongList_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventSongListSong` ADD CONSTRAINT `EventSongListSong_songId_fkey` FOREIGN KEY (`songId`) REFERENCES `Song`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FileTagAssignment` ADD CONSTRAINT `FileTagAssignment_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `File`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FileUserTag` ADD CONSTRAINT `FileUserTag_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FileSongTag` ADD CONSTRAINT `FileSongTag_songId_fkey` FOREIGN KEY (`songId`) REFERENCES `Song`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FileEventTag` ADD CONSTRAINT `FileEventTag_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
