ALTER TABLE `CustomLink`
    MODIFY `destinationURL` VARCHAR(768) NULL,
    ADD COLUMN `fileId` INTEGER NULL;

CREATE INDEX `CustomLink_fileId_idx` ON `CustomLink`(`fileId`);

ALTER TABLE `CustomLink`
    ADD CONSTRAINT `CustomLink_fileId_fkey`
    FOREIGN KEY (`fileId`) REFERENCES `File`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
