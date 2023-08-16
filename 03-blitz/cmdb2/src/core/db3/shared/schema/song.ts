

/*

- SongComment
- SongCredit
- SongTag / SongTagAssociation

- Song


*/

// // NOTE: It's highly recommended to use an enum for the token type
// //       but enums only work in Postgres.
// //       See: https://blitzjs.com/docs/database-overview#switch-to-postgre-sql
// // enum TokenType {
// //   RESET_PASSWORD
// // }

// model Song {
//     id             Int     @id @default(autoincrement())
//     name           String
//     slug           String
//     startKey       String?
//     endKey         String?
//     startBPM       Int?
//     endBPM         Int?
//     introducedYear Int? // purposely fuzzy
  
//     isDeleted Boolean @default(false)
  
//     lengthSeconds Int? // length. this is approximate, and could vary wildly esp. considering variations.
//     // so what about variations like roger variete, or tango long/short versions? do we relate them? or score stuff? i think don't bother; maybe there can be related songs or something but not yet.
  
//     FileSongTag FileSongTag[]
//     tags        SongTagAssociation[]
//     comments    SongComment[]
//     credits     SongCredit[]
//     songLists   EventSongListSong[]
//   }
  
//   model SongComment {
//     id        Int  @id @default(autoincrement())
//     songId    Int
//     song      Song @relation(fields: [songId], references: [id], onDelete: Restrict) // song deleted = comments too. songs are soft-delete.
//     sortOrder Int  @default(0)
  
//     userId    Int
//     createdAt DateTime
//     updatedAt DateTime
//     text      String
//     user      User     @relation(fields: [userId], references: [id], onDelete: Restrict) // users are soft delete; if an admin wants to force delete, then they can go through this.
  
//     // we want users to be able to unpublish things they edit.
//     // deletes are always hard.
//     isPublished Boolean @default(false)
  
//     //@@unique([songId, commentId])
//   }
  
//   model SongCredit {
//     id         Int     @id @default(autoincrement())
//     type       String // composer / arranger / whatever
//     userId     Int?
//     user       User?   @relation(fields: [userId], references: [id], onDelete: Restrict)
//     userString String? // in case there's no user for this, type-in.
//     songId     Int
//     song       Song    @relation(fields: [songId], references: [id], onDelete: Restrict)
//     sortOrder  Int     @default(0)
  
//     @@unique([userId, songId])
//   }
  
//   model SongTag {
//     id           Int                  @id @default(autoincrement())
//     text         String
//     color        String?
//     significance String? // we care about some tags, for example gathering specific statistics (you played N concerts - we need to know which events are concerts specifically which is done via tagging)
//     classification         String?
//     songs        SongTagAssociation[]
//   }
  
//   model SongTagAssociation {
//     id     Int     @id @default(autoincrement())
//     songId Int
//     song   Song    @relation(fields: [songId], references: [id], onDelete: Restrict)
//     tagId  Int
//     tag    SongTag @relation(fields: [tagId], references: [id], onDelete: Restrict)
  
//     @@unique([tagId, songId])
//   }

