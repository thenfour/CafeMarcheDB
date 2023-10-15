
import db, { Prisma } from "db";
import { ColorPalette, ColorPaletteEntry, gGeneralPaletteList } from "shared/color";
import { Permission } from "shared/permissions";
import { CoerceToNumberOrNull, Date_MAX_VALUE, KeysOf, TAnyModel, assertIsNumberArray, gIconOptions } from "shared/utils";
import * as db3 from "../db3core";
import { ColorField, ConstEnumStringField, ForeignSingleField, GenericIntegerField, GenericStringField, BoolField, PKField, TagsField, DateTimeField, MakePlainTextField, MakeMarkdownTextField, MakeSortOrderField, MakeColorField, MakeSignificanceField, MakeIntegerField, MakeSlugField, MakeTitleField, MakeCreatedAtField, MakeIconField } from "../db3basicFields";
import { CreatedByUserField, VisiblePermissionField, xPermission, xUser } from "./user";
import { xSong } from "./song";
import { InstrumentArgs, InstrumentPayload, SongArgs, UserArgs, UserPayload, getUserPrimaryInstrument, xInstrument } from "./instrument";


// // tech rider, partition, invoice, contract, event media, other, what is the usage? needed to:
// // - find similar things at an application level like finding partitions
// // - display relevant info for context
// model FileSignificance {
//     id          Int     @id @default(autoincrement())
//     name        String  @unique
//     description String?
//     Files       File[]
//   }
  
//   // files can also just be floating uploads for example dropped into a markdown field
//   model File {
//     id             Int     @id @default(autoincrement())
//     subtitle       String? // could be a small comment like "short version"
//     fileLeafName   String // the name of the file as it was uploaded, visible to users. IMG20113.jpg for example.
//     storedLeafName String // a unique filename used in server storage; a guid probably.
//     uri            String // if this is a link, then here's the URI
//     description    String
//     type           String // enum (video, photo, link, partition)
//     significanceId Int?
//     isDeleted      Boolean @default(false)
  
//     significance      FileSignificance?   @relation(fields: [significanceId], references: [id], onDelete: SetNull) // when you delete a significance, set null.
//     taggedUsers       FileUserTag[]
//     taggedSongs       FileSongTag[]
//     taggedEvents      FileEventTag[]
//     taggedInstruments FileInstrumentTag[]
//   }
  
//   model FileUserTag {
//     id     Int     @id @default(autoincrement())
//     fileId Int
//     file   File    @relation(fields: [fileId], references: [id], onDelete: Cascade)
//     name   String? // if userid is not there...
//     user   User?   @relation(fields: [userId], references: [id], onDelete: Restrict)
//     userId Int?
  
//     @@unique([fileId, userId]) // 
//   }
  
//   model FileSongTag {
//     id     Int     @id @default(autoincrement())
//     fileId Int
//     file   File    @relation(fields: [fileId], references: [id], onDelete: Cascade)
//     name   String? // if songid is not there...
//     song   Song?   @relation(fields: [songId], references: [id], onDelete: Restrict)
//     songId Int?
  
//     @@unique([fileId, songId]) // 
//   }
  
//   model FileEventTag {
//     id      Int     @id @default(autoincrement())
//     fileId  Int
//     file    File    @relation(fields: [fileId], references: [id], onDelete: Cascade)
//     name    String? // if eventid is not there...
//     event   Event?  @relation(fields: [eventId], references: [id], onDelete: Restrict)
//     eventId Int?
  
//     @@unique([fileId, eventId]) // 
//   }
  
//   // this is hm. i suppose this is correct, but tagging instrument groups may be more accurate in some scenarios?
//   model FileInstrumentTag {
//     id           Int         @id @default(autoincrement())
//     fileId       Int
//     file         File        @relation(fields: [fileId], references: [id], onDelete: Cascade)
//     name         String? // if instrumentid is not there...
//     instrument   Instrument? @relation(fields: [instrumentId], references: [id], onDelete: Cascade)
//     instrumentId Int?
  
//     @@unique([fileId, instrumentId]) // 
//   }
  