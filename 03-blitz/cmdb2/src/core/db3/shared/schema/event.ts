
import db, { Prisma } from "db";
import { ColorPalette, ColorPaletteEntry, gGeneralPaletteList } from "shared/color";
import { Permission } from "shared/permissions";
import { CoerceToNumberOrNull, KeysOf, TAnyModel } from "shared/utils";
import { xTable } from "../db3core";
import { ColorField, ConstEnumStringField, ForeignSingleField, GenericIntegerField, GenericStringField, BoolField, PKField, TagsField, DateTimeField, MakePlainTextField, MakeMarkdownTextField, MakeSortOrderField, MakeColorField, MakeSignificanceField, MakeIntegerField } from "../db3basicFields";
/*

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

// to go further i could make events & rehearsals separate tables. but i don't think that's a good idea; the idea would be that
// they get separate data for the different types. but that's not really the case because this Events table is quite general for events;
// nothing here is specific to any type of event. should that be the case it can be attached somehow.



// admin pages:
// x event types
// x event status
// x event tags / EventTagAssignment
// x EventAttendance
// - events

// event segment
//   model EventSegmentSongList {
//   model EventSongListSong {
//   model EventSegmentUserResponse {

////////////////////////////////////////////////////////////////
const EventTypeInclude: Prisma.EventTypeInclude = {
    events: true,
};

export type EventTypePayload = Prisma.EventTypeGetPayload<{}>;

export const EventTypeNaturalOrderBy: Prisma.EventTypeOrderByWithRelationInput[] = [
    { text: 'asc' },
    { id: 'asc' },
];

export const xEventType = new xTable({
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    localInclude: EventTypeInclude,
    tableName: "eventType",
    naturalOrderBy: EventTypeNaturalOrderBy,
    getRowInfo: (row: EventTypePayload) => ({
        name: row.text,
        description: row.description,
        color: gGeneralPaletteList.findEntry(row.color),
    }),
    columns: [
        new PKField({ columnName: "id" }),
        MakePlainTextField("text"),
        MakeMarkdownTextField("description"),
        MakeSortOrderField("sortOrder"),
        MakeColorField("color"),
    ]
});


////////////////////////////////////////////////////////////////
const EventStatusInclude: Prisma.EventStatusInclude = {
    events: true, // not sure the point of including this; too much?
};

export type EventStatusPayload = Prisma.EventStatusGetPayload<{}>;

export const EventStatusNaturalOrderBy: Prisma.EventStatusOrderByWithRelationInput[] = [
    { label: 'desc' },
    { id: 'asc' },
];

export const EventStatusSignificance = {
    New: "New",
} as const satisfies Record<string, string>;

export const xEventStatus = new xTable({
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    localInclude: EventStatusInclude,
    tableName: "eventStatus",
    naturalOrderBy: EventStatusNaturalOrderBy,
    getRowInfo: (row: EventStatusPayload) => ({
        name: row.label,
        description: row.description,
        color: gGeneralPaletteList.findEntry(row.color),
    }),
    columns: [
        new PKField({ columnName: "id" }),
        MakePlainTextField("label"),
        MakeMarkdownTextField("description"),
        MakeSortOrderField("sortOrder"),
        MakeColorField("color"),
        MakeSignificanceField("significance", EventStatusSignificance),
    ]
});


////////////////////////////////////////////////////////////////
const EventTagInclude: Prisma.EventTagInclude = {
    events: true,
};

export type EventTagPayload = Prisma.EventTagGetPayload<{}>;

export const EventTagNaturalOrderBy: Prisma.EventTagOrderByWithRelationInput[] = [
    { sortOrder: 'desc' },
    { text: 'asc' },
    { id: 'asc' },
];

export const EventTagSignificance = {
    Majorettes: "Majorettes",
} as const satisfies Record<string, string>;

export const xEventTag = new xTable({
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    localInclude: EventTagInclude,
    tableName: "eventTag",
    naturalOrderBy: EventTagNaturalOrderBy,
    getRowInfo: (row: EventTagPayload) => ({
        name: row.text,
        description: row.description,
        color: gGeneralPaletteList.findEntry(row.color),
    }),
    columns: [
        new PKField({ columnName: "id" }),
        MakePlainTextField("text"),
        MakeMarkdownTextField("description"),
        MakeSortOrderField("sortOrder"),
        MakeColorField("color"),
        MakeSignificanceField("significance", EventTagSignificance),
    ]
});



////////////////////////////////////////////////////////////////
export type EventTagAssignmentModel = Prisma.EventTagAssignmentGetPayload<{
    include: {
        event: true,
        eventTag: true,
    }
}>;

// not sure this is needed or used at all.
const EventTagAssignmentInclude: Prisma.EventTagAssignmentInclude = {
    event: true,
    eventTag: true,
};
const EventTagAssignmentNaturalOrderBy: Prisma.EventTagAssignmentOrderByWithRelationInput[] = [
    { eventTag: { sortOrder: 'desc' } },
    { eventTag: { text: 'asc' } },
    { eventTag: { id: 'asc' } },
];
export const xEventTagAssignment = new xTable({
    tableName: "EventTagAssignment",
    editPermission: Permission.edit_events,
    viewPermission: Permission.view_events,
    localInclude: EventTagAssignmentInclude,
    naturalOrderBy: EventTagAssignmentNaturalOrderBy,
    getRowInfo: (row: EventTagAssignmentModel) => ({
        name: row.eventTag.text,
        description: row.eventTag.description,
        color: gGeneralPaletteList.findEntry(row.eventTag.color),
    }),
    columns: [
        new PKField({ columnName: "id" }),
        new ForeignSingleField<Prisma.EventTagGetPayload<{}>>({
            columnName: "eventTag",
            fkMember: "eventTagId",
            allowNull: false,
            foreignTableSpec: xEventTag,
            getQuickFilterWhereClause: (query: string) => false,
        }),
    ]
});









////////////////////////////////////////////////////////////////
const EventInclude: Prisma.EventInclude = {
    status: true,
    tags: {
        orderBy: EventTagAssignmentNaturalOrderBy,
    },
    type: true,
    segments: { orderBy: { startsAt: "desc" }},
};

export type EventPayload = Prisma.EventGetPayload<{
    include: {
        status: true,
        tags: true, // todo: order by
        type: true,
        }
}>;

export const EventNaturalOrderBy: Prisma.EventOrderByWithRelationInput[] = [
    { id: 'desc' }, // TODO: we should find a way to order by segment! can be done in SQL but not prisma afaik
];

export const xEvent = new xTable({
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    localInclude: EventInclude,
    tableName: "event",
    naturalOrderBy: EventNaturalOrderBy,
    getRowInfo: (row: EventPayload) => ({
        name: row.name,
        description: row.description,
        color: gGeneralPaletteList.findEntry(row.type?.color || null),
    }),
    columns: [
        new PKField({ columnName: "id" }),
        MakePlainTextField("name"),
        MakePlainTextField("slug"),
        MakeMarkdownTextField("description"),
        new BoolField({columnName: "isPublished", defaultValue: false }),
        new BoolField({columnName: "isDeleted", defaultValue: false }),
        new BoolField({columnName: "isCancelled", defaultValue: false }),
        MakePlainTextField("locationDescription"),
        MakePlainTextField("locationURL"),
        new DateTimeField({
            allowNull: true,
            columnName: "cancelledAt",
            granularity: "second",
        }),
        new DateTimeField({
            allowNull: false,
            columnName: "createdAt",
            granularity: "second",
        }),
        new ForeignSingleField<Prisma.EventTypeGetPayload<{}>>({
            columnName: "type",
            fkMember: "typeId",
            allowNull: true,
            foreignTableSpec: xEventType,
            getQuickFilterWhereClause: (query: string) => false,
        }),
        new ForeignSingleField<Prisma.EventStatusGetPayload<{}>>({
            columnName: "status",
            fkMember: "statusId",
            allowNull: true,
            foreignTableSpec: xEventStatus,
            getQuickFilterWhereClause: (query: string) => false,
        }),
        new TagsField<EventTagAssignmentModel>({
            columnName: "tags",
            associationForeignIDMember: "tagId",
            associationForeignObjectMember: "tag",
            associationLocalIDMember: "eventId",
            associationLocalObjectMember: "event",
            associationTableSpec: xEventTagAssignment,
            foreignTableSpec: xEventTag,
            getQuickFilterWhereClause: (query: string): Prisma.EventWhereInput => ({
                tags: {
                    some: {
                        eventTag: {
                            text: {
                                contains: query
                            }
                        }
                    }
                }
            }),
        }),
    ]
});



//   // events have multiple segments, for example the CM weekend can be broken into saturday, sunday, monday
//   // concerts may have one or more multiple sets
//   model EventSegment {
//     id          Int        @id @default(autoincrement())
//     eventId    Int
//     event      Event    @relation(fields: [eventId], references: [id], onDelete: Restrict) // events are soft-delete.
  
//     name        String
//     description String // short description, like 
  
//     startsAt            DateTime? // date null means TBD
//     endsAt              DateTime?
  
//     responses EventSegmentUserResponse[]
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
  







////////////////////////////////////////////////////////////////
const EventAttendanceInclude: Prisma.EventAttendanceInclude = {
    responses: true,
};

export type EventAttendancePayload = Prisma.EventAttendanceGetPayload<{}>;

export const EventAttendanceNaturalOrderBy: Prisma.EventAttendanceOrderByWithRelationInput[] = [
    { sortOrder: 'desc' },
    { text: 'asc' },
    { id: 'asc' },
];

export const xEventAttendance = new xTable({
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    localInclude: EventAttendanceInclude,
    tableName: "eventAttendance",
    naturalOrderBy: EventAttendanceNaturalOrderBy,
    getRowInfo: (row: EventAttendancePayload) => ({
        name: row.text,
        description: row.description,
        color: gGeneralPaletteList.findEntry(row.color),
    }),
    columns: [
        new PKField({ columnName: "id" }),
        MakePlainTextField("text"),
        MakeMarkdownTextField("description"),
        MakeColorField("color"),
        MakeIntegerField("strength"),
        MakeSortOrderField("sortOrder"),
    ]
});


  
//   model EventSegmentUserResponse {
//     id      Int   @id @default(autoincrement())
//     userId  Int
//     user    User  @relation(fields: [userId], references: [id], onDelete: Restrict)
  
//     eventSegmentId Int
//     eventSegment   EventSegment @relation(fields: [eventSegmentId], references: [id], onDelete: Restrict)
  
//     expectAttendance Boolean @default(false)
//     attendanceId      Int?
//     attendance        EventAttendance? @relation(fields: [attendanceId], references: [id], onDelete: SetDefault)
//     attendanceComment String? // comment
  
//     @@unique([userId, eventSegmentId]) // 
//   }





//   model EventSegmentSongList {
//     id          Int    @id @default(autoincrement())
//     sortOrder   Int    @default(0)
//     name        String
//     description String @default("")
  
//     eventId     Int
//     event       Event  @relation(fields: [eventId], references: [id], onDelete: Restrict) // when event is deleted, song lists go too.
//   }
  
//   model EventSongListSong {
//     id       Int     @id @default(autoincrement())
//     songId   Int
//     subtitle String? // could be a small comment like "short version"
  
//     song Song @relation(fields: [songId], references: [id], onDelete: Restrict) // when you delete a song, it will disappear from all lists
//   }
  
