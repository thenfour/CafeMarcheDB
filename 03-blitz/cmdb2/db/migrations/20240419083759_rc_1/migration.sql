/*
  Warnings:

  - You are about to drop the column `permissionId` on the `EventSongList` table. All the data in the column will be lost.
  - You are about to alter the column `durationMillis` on the `EventSegment` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_File" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fileLeafName" TEXT NOT NULL,
    "storedLeafName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "sizeBytes" INTEGER,
    "externalURI" TEXT,
    "fileCreatedAt" DATETIME,
    "uploadedAt" DATETIME NOT NULL,
    "uploadedByUserId" INTEGER,
    "visiblePermissionId" INTEGER,
    "mimeType" TEXT,
    "customData" TEXT,
    "previewFileId" INTEGER,
    "parentFileId" INTEGER,
    CONSTRAINT "File_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User" ("id") ON DELETE SET DEFAULT ON UPDATE CASCADE,
    CONSTRAINT "File_visiblePermissionId_fkey" FOREIGN KEY ("visiblePermissionId") REFERENCES "Permission" ("id") ON DELETE SET DEFAULT ON UPDATE CASCADE,
    CONSTRAINT "File_previewFileId_fkey" FOREIGN KEY ("previewFileId") REFERENCES "File" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "File_parentFileId_fkey" FOREIGN KEY ("parentFileId") REFERENCES "File" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_File" ("customData", "description", "externalURI", "fileLeafName", "id", "isDeleted", "mimeType", "parentFileId", "previewFileId", "sizeBytes", "storedLeafName", "uploadedAt", "uploadedByUserId", "visiblePermissionId") SELECT "customData", "description", "externalURI", "fileLeafName", "id", "isDeleted", "mimeType", "parentFileId", "previewFileId", "sizeBytes", "storedLeafName", "uploadedAt", "uploadedByUserId", "visiblePermissionId" FROM "File";
DROP TABLE "File";
ALTER TABLE "new_File" RENAME TO "File";
CREATE UNIQUE INDEX "File_storedLeafName_key" ON "File"("storedLeafName");
CREATE INDEX "File_fileLeafName_idx" ON "File"("fileLeafName");
CREATE INDEX "File_storedLeafName_idx" ON "File"("storedLeafName");
CREATE INDEX "File_isDeleted_idx" ON "File"("isDeleted");
CREATE INDEX "File_visiblePermissionId_idx" ON "File"("visiblePermissionId");
CREATE INDEX "File_mimeType_idx" ON "File"("mimeType");
CREATE INDEX "File_previewFileId_idx" ON "File"("previewFileId");
CREATE INDEX "File_parentFileId_idx" ON "File"("parentFileId");
CREATE TABLE "new_SongCredit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER,
    "songId" INTEGER NOT NULL,
    "year" TEXT NOT NULL DEFAULT '',
    "comment" TEXT NOT NULL DEFAULT '',
    "typeId" INTEGER NOT NULL,
    CONSTRAINT "SongCredit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SongCredit_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SongCredit_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "SongCreditType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SongCredit" ("id", "songId", "typeId", "userId") SELECT "id", "songId", "typeId", "userId" FROM "SongCredit";
DROP TABLE "SongCredit";
ALTER TABLE "new_SongCredit" RENAME TO "SongCredit";
CREATE INDEX "SongCredit_userId_idx" ON "SongCredit"("userId");
CREATE INDEX "SongCredit_songId_idx" ON "SongCredit"("songId");
CREATE INDEX "SongCredit_typeId_idx" ON "SongCredit"("typeId");
CREATE TABLE "new_EventAttendance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "text" TEXT NOT NULL,
    "personalText" TEXT NOT NULL DEFAULT '',
    "pastText" TEXT NOT NULL DEFAULT '',
    "pastPersonalText" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "color" TEXT,
    "iconName" TEXT,
    "strength" INTEGER NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_EventAttendance" ("color", "description", "id", "isDeleted", "personalText", "sortOrder", "strength", "text") SELECT "color", "description", "id", "isDeleted", "personalText", "sortOrder", "strength", "text" FROM "EventAttendance";
DROP TABLE "EventAttendance";
ALTER TABLE "new_EventAttendance" RENAME TO "EventAttendance";
CREATE INDEX "EventAttendance_sortOrder_idx" ON "EventAttendance"("sortOrder");
CREATE INDEX "EventAttendance_strength_idx" ON "EventAttendance"("strength");
CREATE INDEX "EventAttendance_isDeleted_idx" ON "EventAttendance"("isDeleted");
CREATE TABLE "new_EventSongList" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "eventId" INTEGER NOT NULL,
    "userId" INTEGER,
    CONSTRAINT "EventSongList_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EventSongList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_EventSongList" ("description", "eventId", "id", "name", "sortOrder", "userId") SELECT "description", "eventId", "id", "name", "sortOrder", "userId" FROM "EventSongList";
DROP TABLE "EventSongList";
ALTER TABLE "new_EventSongList" RENAME TO "EventSongList";
CREATE INDEX "EventSongList_sortOrder_idx" ON "EventSongList"("sortOrder");
CREATE INDEX "EventSongList_name_idx" ON "EventSongList"("name");
CREATE INDEX "EventSongList_eventId_idx" ON "EventSongList"("eventId");
CREATE TABLE "new_Event" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "typeId" INTEGER,
    "locationDescription" TEXT NOT NULL DEFAULT '',
    "locationURL" TEXT NOT NULL DEFAULT '',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "statusId" INTEGER,
    "segmentBehavior" TEXT,
    "createdAt" DATETIME NOT NULL,
    "startsAt" DATETIME,
    "durationMillis" BIGINT NOT NULL DEFAULT 0,
    "isAllDay" BOOLEAN NOT NULL DEFAULT true,
    "endDateTime" DATETIME,
    "createdByUserId" INTEGER,
    "visiblePermissionId" INTEGER,
    "expectedAttendanceUserTagId" INTEGER,
    "frontpageVisible" BOOLEAN NOT NULL DEFAULT false,
    "frontpageDate" TEXT NOT NULL DEFAULT '',
    "frontpageTime" TEXT NOT NULL DEFAULT '',
    "frontpageDetails" TEXT NOT NULL DEFAULT '',
    "frontpageTitle" TEXT,
    "frontpageLocation" TEXT,
    "frontpageLocationURI" TEXT,
    "frontpageTags" TEXT,
    CONSTRAINT "Event_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "EventType" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Event_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "EventStatus" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Event_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET DEFAULT ON UPDATE CASCADE,
    CONSTRAINT "Event_visiblePermissionId_fkey" FOREIGN KEY ("visiblePermissionId") REFERENCES "Permission" ("id") ON DELETE SET DEFAULT ON UPDATE CASCADE,
    CONSTRAINT "Event_expectedAttendanceUserTagId_fkey" FOREIGN KEY ("expectedAttendanceUserTagId") REFERENCES "UserTag" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Event" ("createdAt", "createdByUserId", "description", "expectedAttendanceUserTagId", "frontpageDate", "frontpageDetails", "frontpageLocation", "frontpageLocationURI", "frontpageTags", "frontpageTime", "frontpageTitle", "frontpageVisible", "id", "isDeleted", "locationDescription", "locationURL", "name", "slug", "statusId", "typeId", "visiblePermissionId") SELECT "createdAt", "createdByUserId", "description", "expectedAttendanceUserTagId", "frontpageDate", "frontpageDetails", "frontpageLocation", "frontpageLocationURI", "frontpageTags", "frontpageTime", "frontpageTitle", "frontpageVisible", "id", "isDeleted", "locationDescription", "locationURL", "name", "slug", "statusId", "typeId", "visiblePermissionId" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE INDEX "Event_name_idx" ON "Event"("name");
CREATE INDEX "Event_slug_idx" ON "Event"("slug");
CREATE INDEX "Event_description_idx" ON "Event"("description");
CREATE INDEX "Event_typeId_idx" ON "Event"("typeId");
CREATE INDEX "Event_isDeleted_idx" ON "Event"("isDeleted");
CREATE INDEX "Event_statusId_idx" ON "Event"("statusId");
CREATE INDEX "Event_startsAt_idx" ON "Event"("startsAt");
CREATE INDEX "Event_endDateTime_idx" ON "Event"("endDateTime");
CREATE INDEX "Event_visiblePermissionId_idx" ON "Event"("visiblePermissionId");
CREATE INDEX "Event_frontpageVisible_idx" ON "Event"("frontpageVisible");
CREATE TABLE "new_EventSegment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eventId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startsAt" DATETIME,
    "durationMillis" BIGINT NOT NULL,
    "isAllDay" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "EventSegment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_EventSegment" ("description", "durationMillis", "eventId", "id", "isAllDay", "name", "startsAt") SELECT "description", "durationMillis", "eventId", "id", "isAllDay", "name", "startsAt" FROM "EventSegment";
DROP TABLE "EventSegment";
ALTER TABLE "new_EventSegment" RENAME TO "EventSegment";
CREATE INDEX "EventSegment_name_idx" ON "EventSegment"("name");
CREATE INDEX "EventSegment_startsAt_idx" ON "EventSegment"("startsAt");
CREATE INDEX "EventSegment_eventId_idx" ON "EventSegment"("eventId");
CREATE TABLE "new_Song" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "aliases" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "startBPM" INTEGER,
    "endBPM" INTEGER,
    "introducedYear" INTEGER,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "lengthSeconds" INTEGER,
    "createdByUserId" INTEGER,
    "visiblePermissionId" INTEGER,
    CONSTRAINT "Song_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET DEFAULT ON UPDATE CASCADE,
    CONSTRAINT "Song_visiblePermissionId_fkey" FOREIGN KEY ("visiblePermissionId") REFERENCES "Permission" ("id") ON DELETE SET DEFAULT ON UPDATE CASCADE
);
INSERT INTO "new_Song" ("createdByUserId", "description", "endBPM", "id", "introducedYear", "isDeleted", "lengthSeconds", "name", "slug", "startBPM", "visiblePermissionId") SELECT "createdByUserId", "description", "endBPM", "id", "introducedYear", "isDeleted", "lengthSeconds", "name", "slug", "startBPM", "visiblePermissionId" FROM "Song";
DROP TABLE "Song";
ALTER TABLE "new_Song" RENAME TO "Song";
CREATE INDEX "Song_name_idx" ON "Song"("name");
CREATE INDEX "Song_aliases_idx" ON "Song"("aliases");
CREATE INDEX "Song_slug_idx" ON "Song"("slug");
CREATE INDEX "Song_isDeleted_idx" ON "Song"("isDeleted");
CREATE INDEX "Song_visiblePermissionId_idx" ON "Song"("visiblePermissionId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE INDEX "Change_table_idx" ON "Change"("table");

-- CreateIndex
CREATE INDEX "Change_recordId_idx" ON "Change"("recordId");

-- CreateIndex
CREATE INDEX "Change_userId_idx" ON "Change"("userId");

-- CreateIndex
CREATE INDEX "EventComment_eventId_idx" ON "EventComment"("eventId");

-- CreateIndex
CREATE INDEX "EventComment_visiblePermissionId_idx" ON "EventComment"("visiblePermissionId");

-- CreateIndex
CREATE INDEX "EventSongListSong_songId_idx" ON "EventSongListSong"("songId");

-- CreateIndex
CREATE INDEX "EventSongListSong_eventSongListId_idx" ON "EventSongListSong"("eventSongListId");

-- CreateIndex
CREATE INDEX "EventStatus_label_idx" ON "EventStatus"("label");

-- CreateIndex
CREATE INDEX "EventStatus_sortOrder_idx" ON "EventStatus"("sortOrder");

-- CreateIndex
CREATE INDEX "EventStatus_significance_idx" ON "EventStatus"("significance");

-- CreateIndex
CREATE INDEX "EventStatus_isDeleted_idx" ON "EventStatus"("isDeleted");

-- CreateIndex
CREATE INDEX "EventTag_text_idx" ON "EventTag"("text");

-- CreateIndex
CREATE INDEX "EventTag_significance_idx" ON "EventTag"("significance");

-- CreateIndex
CREATE INDEX "EventTag_sortOrder_idx" ON "EventTag"("sortOrder");

-- CreateIndex
CREATE INDEX "EventTag_visibleOnFrontpage_idx" ON "EventTag"("visibleOnFrontpage");

-- CreateIndex
CREATE INDEX "EventType_text_idx" ON "EventType"("text");

-- CreateIndex
CREATE INDEX "EventType_sortOrder_idx" ON "EventType"("sortOrder");

-- CreateIndex
CREATE INDEX "EventType_significance_idx" ON "EventType"("significance");

-- CreateIndex
CREATE INDEX "EventType_isDeleted_idx" ON "EventType"("isDeleted");

-- CreateIndex
CREATE INDEX "FileEventTag_fileId_idx" ON "FileEventTag"("fileId");

-- CreateIndex
CREATE INDEX "FileEventTag_eventId_idx" ON "FileEventTag"("eventId");

-- CreateIndex
CREATE INDEX "FileInstrumentTag_fileId_idx" ON "FileInstrumentTag"("fileId");

-- CreateIndex
CREATE INDEX "FileInstrumentTag_instrumentId_idx" ON "FileInstrumentTag"("instrumentId");

-- CreateIndex
CREATE INDEX "FileSongTag_fileId_idx" ON "FileSongTag"("fileId");

-- CreateIndex
CREATE INDEX "FileSongTag_songId_idx" ON "FileSongTag"("songId");

-- CreateIndex
CREATE INDEX "FileTag_text_idx" ON "FileTag"("text");

-- CreateIndex
CREATE INDEX "FileTag_significance_idx" ON "FileTag"("significance");

-- CreateIndex
CREATE INDEX "FileTag_sortOrder_idx" ON "FileTag"("sortOrder");

-- CreateIndex
CREATE INDEX "FileUserTag_fileId_idx" ON "FileUserTag"("fileId");

-- CreateIndex
CREATE INDEX "FileUserTag_userId_idx" ON "FileUserTag"("userId");

-- CreateIndex
CREATE INDEX "FrontpageGalleryItem_isDeleted_idx" ON "FrontpageGalleryItem"("isDeleted");

-- CreateIndex
CREATE INDEX "FrontpageGalleryItem_sortOrder_idx" ON "FrontpageGalleryItem"("sortOrder");

-- CreateIndex
CREATE INDEX "FrontpageGalleryItem_fileId_idx" ON "FrontpageGalleryItem"("fileId");

-- CreateIndex
CREATE INDEX "FrontpageGalleryItem_visiblePermissionId_idx" ON "FrontpageGalleryItem"("visiblePermissionId");

-- CreateIndex
CREATE INDEX "Instrument_name_idx" ON "Instrument"("name");

-- CreateIndex
CREATE INDEX "Instrument_slug_idx" ON "Instrument"("slug");

-- CreateIndex
CREATE INDEX "Instrument_sortOrder_idx" ON "Instrument"("sortOrder");

-- CreateIndex
CREATE INDEX "Instrument_functionalGroupId_idx" ON "Instrument"("functionalGroupId");

-- CreateIndex
CREATE INDEX "InstrumentFunctionalGroup_name_idx" ON "InstrumentFunctionalGroup"("name");

-- CreateIndex
CREATE INDEX "InstrumentFunctionalGroup_sortOrder_idx" ON "InstrumentFunctionalGroup"("sortOrder");

-- CreateIndex
CREATE INDEX "InstrumentTag_text_idx" ON "InstrumentTag"("text");

-- CreateIndex
CREATE INDEX "InstrumentTag_sortOrder_idx" ON "InstrumentTag"("sortOrder");

-- CreateIndex
CREATE INDEX "InstrumentTag_significance_idx" ON "InstrumentTag"("significance");

-- CreateIndex
CREATE INDEX "Permission_name_idx" ON "Permission"("name");

-- CreateIndex
CREATE INDEX "Permission_sortOrder_idx" ON "Permission"("sortOrder");

-- CreateIndex
CREATE INDEX "Role_name_idx" ON "Role"("name");

-- CreateIndex
CREATE INDEX "Setting_name_idx" ON "Setting"("name");

-- CreateIndex
CREATE INDEX "SongComment_songId_idx" ON "SongComment"("songId");

-- CreateIndex
CREATE INDEX "SongComment_text_idx" ON "SongComment"("text");

-- CreateIndex
CREATE INDEX "SongComment_visiblePermissionId_idx" ON "SongComment"("visiblePermissionId");

-- CreateIndex
CREATE INDEX "SongCreditType_text_idx" ON "SongCreditType"("text");

-- CreateIndex
CREATE INDEX "SongCreditType_sortOrder_idx" ON "SongCreditType"("sortOrder");

-- CreateIndex
CREATE INDEX "SongTag_text_idx" ON "SongTag"("text");

-- CreateIndex
CREATE INDEX "SongTag_significance_idx" ON "SongTag"("significance");

-- CreateIndex
CREATE INDEX "SongTag_showOnSongLists_idx" ON "SongTag"("showOnSongLists");

-- CreateIndex
CREATE INDEX "SongTag_sortOrder_idx" ON "SongTag"("sortOrder");

-- CreateIndex
CREATE INDEX "User_name_idx" ON "User"("name");

-- CreateIndex
CREATE INDEX "User_isDeleted_idx" ON "User"("isDeleted");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_googleId_idx" ON "User"("googleId");

-- CreateIndex
CREATE INDEX "UserInstrument_userId_idx" ON "UserInstrument"("userId");

-- CreateIndex
CREATE INDEX "UserTag_text_idx" ON "UserTag"("text");

-- CreateIndex
CREATE INDEX "UserTag_sortOrder_idx" ON "UserTag"("sortOrder");
