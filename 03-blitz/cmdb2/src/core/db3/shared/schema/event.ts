

/*

- EventTag / EventTagAssignment
- EventAttendance (yes, no, count me in, probably not)
- EventApproval - not sure if this is necessary. shouldn't it be a boolean? maybe the idea is that the options may change in the future and i want to preserve the naming etc.
    suggests the need for "significance" in attendance & approvals to know what means "YES"

- Event
- EventComment
- EventSongList
- EventSongListSong

- EventUserResponse

let's think workflow for events.
someone creates the event as a vague option.
    dates TBD
    slug auto-generated from name and date (pukkelpop-2023)
    event approval is requested from directors (business logic?)
    event attendance is requested from any active musicians.
adds a comment, ok
dates added

who are active musicians? let's say users who have been active in the past 2 years in any way.
- suggests the possibility of keeping track of lidgeld
- weekend?
- car sharing...
leave all that for later.



*/

// concerts vs. rehearsals? i originally thought these would be tags, but should it just be a dropdown?
// disadvantages of tag:
// - events may not get a type assignment; that's probably not a good idea.
// - events can get multiple conflicting types
// - type is used for things; tag significance is sorta a lame way to accomplish this.
// advantages of dropdown:
// - field is required, structured, queryable, and obvious

// // to go further i could make events & rehearsals separate tables. but i don't think that's a good idea; the idea would be that
// // they get separate data for the different types. but that's not really the case because this Events table is quite general for events;
// // nothing here is specific to any type of event. should that be the case it can be attached somehow.
// model Event {
//     id                  Int      @id @default(autoincrement())
//     name                String
//     slug                String
//     description         String // what's the diff between a description & comment? description is the pinned general description in markdown.
//     startsAt            DateTime?
//     endsAt              DateTime?
//     locationDescription String   @default("")
//     locationURL         String   @default("")
//     isDeleted           Boolean  @default(false)
//     // status - new -> request responses -> confirmed with organizer  -> confirmed
//     //                                      confirmed with group
//     //                                      confirmed with directors
//     // "status" seems kinda more like business logic than a db field. it depends on approvals and spits out either unconfirmed or confirmed.
//     isCancelled         Boolean  @default(false) // used as an input for calculating status
  
//     createdAt DateTime
  
//     // contact people ?
//     // links ?
//     // workflow confirmation etc.
//     fileTags  FileEventTag[]
//     tags      EventTagAssignment[]
//     responses EventUserResponse[]
//     comments  EventComment[]
//     songLists EventSongList[]
//   }
  
//   model EventTag {
//     id           Int                  @id @default(autoincrement())
//     text         String
//     description  String               @default("")
//     color        String?
//     significance String? // we care about some tags, for example gathering specific statistics (you played N concerts - we need to know which events are concerts specifically which is done via tagging)
//     classification         String?
//     events       EventTagAssignment[]
//   }
  
//   model EventTagAssignment {
//     id         Int      @id @default(autoincrement())
//     eventId    Int
//     event      Event    @relation(fields: [eventId], references: [id], onDelete: Restrict) // events are soft-delete.
//     eventTagId Int
//     eventTag   EventTag @relation(fields: [eventTagId], references: [id], onDelete: Cascade) // delete tag = delete the associations.
  
//     @@unique([eventId, eventTagId]) // 
//   }
  
//   model EventComment {
//     id        Int      @id @default(autoincrement())
//     eventId   Int
//     event     Event    @relation(fields: [eventId], references: [id], onDelete: Restrict) // cascade delete association
//     userId    Int
//     createdAt DateTime
//     updatedAt DateTime
//     text      String
//     user      User     @relation(fields: [userId], references: [id], onDelete: Restrict)
  
//     // we want users to be able to unpublish things they edit.
//     // deletes are always hard.
//     isPublished Boolean @default(false)
//   }
  
//   model EventSongList {
//     id          Int    @id @default(autoincrement())
//     eventId     Int
//     sortOrder   Int    @default(0)
//     name        String
//     description String @default("")
//     event       Event  @relation(fields: [eventId], references: [id], onDelete: Restrict) // when event is deleted, song lists go too.
//   }
  
//   model EventSongListSong {
//     id       Int     @id @default(autoincrement())
//     songId   Int
//     subtitle String? // could be a small comment like "short version"
  
//     song Song @relation(fields: [songId], references: [id], onDelete: Restrict) // when you delete a song, it will disappear from all lists
//   }

//   // things like yes no maybe
// model EventAttendance {
//     id        Int     @id @default(autoincrement())
//     text      String
//     color     String?
//     strength  Int // in order to be able to filter people who aren't coming.
//     isDeleted Boolean @default(false)
  
//     responses EventUserResponse[]
//   }
  
//   model EventApproval {
//     id        Int     @id @default(autoincrement())
//     text      String
//     color     String?
//     strength  Int // in order to be able to filter people who aren't coming.
//     isDeleted Boolean @default(false)
  
//     responses EventUserResponse[]
//   }
  
//   model EventUserResponse {
//     id      Int   @id @default(autoincrement())
//     userId  Int
//     user    User  @relation(fields: [userId], references: [id], onDelete: Restrict)
//     eventId Int
//     event   Event @relation(fields: [eventId], references: [id], onDelete: Restrict)
  
//     expectApproval   Boolean @default(false)
//     expectAttendance Boolean @default(false)
  
//     attendanceId   Int?
//     attendance     EventAttendance? @relation(fields: [attendanceId], references: [id], onDelete: SetDefault)
//     attendanceComment String?
  
//     approvalId   Int?
//     approval     EventApproval? @relation(fields: [approvalId], references: [id], onDelete: SetDefault)
//     approvalComment String?
  
//     @@unique([userId, eventId]) // 
//   }
  