// TODO: permissions for actions like these needs to be done in a different way.
// for example i should be able to edit my own posts but not others. etc.

import db, { Prisma } from "db";
import { ColorPalette, ColorPaletteEntry, gGeneralPaletteList } from "shared/color";
import { Permission } from "shared/permissions";
import { CoerceToNumberOrNull, KeysOf, TAnyModel } from "shared/utils";
import { xTable } from "../db3core";
import { ColorField, ConstEnumStringField, ForeignSingleField, GenericIntegerField, GenericStringField, BoolField, PKField, TagsField, DateTimeField, MakePlainTextField, MakeMarkdownTextField, MakeSortOrderField, MakeColorField, MakeSignificanceField, MakeIntegerField, MakeSlugField, MakeTitleField, MakeCreatedAtField } from "../db3basicFields";
import { xUser } from "./user";
import { xSong } from "./song";
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
// x events

// xEventComment
// EventSegment
// EventSongList {
// EventSongListSong {
// EventSegmentUserResponse {

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
    createInsertModelFromString: (input: string): Prisma.EventTypeCreateInput => {
        return {
            text: input,
            description: "auto-created",
            sortOrder: 0,
            color: null,
        };
    },
    getRowInfo: (row: EventTypePayload) => ({
        name: row.text,
        description: row.description,
        color: gGeneralPaletteList.findEntry(row.color),
    }),
    columns: [
        new PKField({ columnName: "id" }),
        MakeTitleField("text"),
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
    { sortOrder: 'desc' },
    { label: 'asc' },
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
    createInsertModelFromString: (input: string): Prisma.EventStatusCreateInput => {
        return {
            label: input,
            description: "auto-created",
            sortOrder: 0,
            color: null,
            significance: null,
        };
    },
    getRowInfo: (row: EventStatusPayload) => ({
        name: row.label,
        description: row.description,
        color: gGeneralPaletteList.findEntry(row.color),
    }),
    columns: [
        new PKField({ columnName: "id" }),
        MakeTitleField("label"),
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
    createInsertModelFromString: (input: string): Prisma.EventTagCreateInput => {
        return {
            text: input,
            description: "auto-created",
            sortOrder: 0,
            color: null,
            significance: null,
        };
    },
    getRowInfo: (row: EventTagPayload) => ({
        name: row.text,
        description: row.description,
        color: gGeneralPaletteList.findEntry(row.color),
    }),
    columns: [
        new PKField({ columnName: "id" }),
        MakeTitleField("text"),
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
    getRowInfo: (row: EventTagAssignmentModel) => {
        return {
            name: row.eventTag.text,
            description: row.eventTag.description,
            color: gGeneralPaletteList.findEntry(row.eventTag.color),
        };
    }
    ,
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
    segments: { orderBy: { startsAt: "desc" } },
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
        MakeTitleField("name"),
        MakeSlugField("slug", "name"),
        MakeMarkdownTextField("description"),
        new BoolField({ columnName: "isPublished", defaultValue: false }),
        new BoolField({ columnName: "isDeleted", defaultValue: false }),
        new BoolField({ columnName: "isCancelled", defaultValue: false }),
        MakePlainTextField("locationDescription"),
        MakePlainTextField("locationURL"),
        new DateTimeField({
            allowNull: true,
            columnName: "cancelledAt",
            granularity: "second",
        }),
        MakeCreatedAtField("createdAt"),
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
            associationForeignIDMember: "eventTagId",
            associationForeignObjectMember: "eventTag",
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


////////////////////////////////////////////////////////////////
const EventSegmentInclude: Prisma.EventSegmentInclude = {
    event: true,
    responses: true,
};

export type EventSegmentPayload = Prisma.EventSegmentGetPayload<{
    include: {
        event: true,
        responses: true,
    }
}>;

export const EventSegmentNaturalOrderBy: Prisma.EventSegmentOrderByWithRelationInput[] = [
    { startsAt: "asc" },
    { id: "asc" },
];

export const xEventSegment = new xTable({
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    localInclude: EventSegmentInclude,
    tableName: "eventSegment",
    naturalOrderBy: EventSegmentNaturalOrderBy,
    getRowInfo: (row: EventSegmentPayload) => ({
        name: row.name,
        description: row.description,
    }),
    getParameterizedWhereClause: (params: TAnyModel): (Prisma.EventSegmentWhereInput[] | false) => {
        if (params.eventId != null) {
            return [{
                eventId: { equals: params.eventId }
            }];
        }
        return false;
    },
    columns: [
        new PKField({ columnName: "id" }),
        MakeTitleField("name"),
        MakeMarkdownTextField("description"),
        new DateTimeField({
            allowNull: true,
            columnName: "startsAt",
            granularity: "minute",
        }),
        new DateTimeField({
            allowNull: true,
            columnName: "endsAt",
            granularity: "minute",
        }),
        new ForeignSingleField<Prisma.EventGetPayload<{}>>({
            columnName: "event",
            fkMember: "eventId",
            allowNull: false,
            foreignTableSpec: xEvent,
            getQuickFilterWhereClause: (query: string) => false,
        }),
    ]
});





////////////////////////////////////////////////////////////////
const EventCommentInclude: Prisma.EventCommentInclude = {
    event: true,
    user: true,
};

export type EventCommentPayload = Prisma.EventCommentGetPayload<{
    include: {
        event: true,
        user: true,
    }
}>;

export const EventCommentNaturalOrderBy: Prisma.EventCommentOrderByWithRelationInput[] = [
    { createdAt: "asc" },
    { id: "asc" },
];

export const xEventComment = new xTable({
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    localInclude: EventCommentInclude,
    tableName: "eventComment",
    naturalOrderBy: EventCommentNaturalOrderBy,
    getRowInfo: (row: EventCommentPayload) => ({
        name: "<not supported>",
    }),
    getParameterizedWhereClause: (params: TAnyModel): (Prisma.EventCommentWhereInput[] | false) => {
        if (params.eventId != null) {
            return [{
                eventId: { equals: params.eventId }
            }];
        }
        return false;
    },
    columns: [
        new PKField({ columnName: "id" }),
        MakeMarkdownTextField("text"),
        new BoolField({ columnName: "isPublished", defaultValue: true }),
        MakeCreatedAtField("createdAt"),
        new DateTimeField({ allowNull: false, columnName: "updatedAt", granularity: "minute", }),
        new ForeignSingleField<Prisma.EventGetPayload<{}>>({
            columnName: "event",
            fkMember: "eventId",
            allowNull: false,
            foreignTableSpec: xEvent,
            getQuickFilterWhereClause: (query: string) => false,
        }),
        new ForeignSingleField<Prisma.UserGetPayload<{}>>({
            columnName: "user",
            fkMember: "userId",
            allowNull: false,
            foreignTableSpec: xUser,
            getQuickFilterWhereClause: (query: string) => false,
        }),
    ]
});








////////////////////////////////////////////////////////////////
const EventAttendanceInclude: Prisma.EventAttendanceInclude = {
    responses: true,
};

export type EventAttendancePayload = Prisma.EventAttendanceGetPayload<{
    include: {
        responses: true,
    }
}>;

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
        MakeTitleField("text"),
        MakeMarkdownTextField("description"),
        MakeColorField("color"),
        MakeIntegerField("strength"),
        MakeSortOrderField("sortOrder"),
    ]
});




////////////////////////////////////////////////////////////////
const EventSegmentUserResponseArgs: Prisma.EventSegmentUserResponseArgs = {
    include: {
        attendance: true,
        eventSegment: true,
        user: {
            include: {
                instruments: {
                    include: {
                        instrument: {
                            include: {
                                functionalGroup: true,
                            }
                        },
                    }
                }
            }
        },
    }
}

//export type EventSegmentUserResponsePayload = Prisma.EventSegmentUserResponseGetPayload<typeof EventSegmentUserResponseArgs>;
export type EventSegmentUserResponsePayload = Prisma.EventSegmentUserResponseGetPayload<{
    include: {
        attendance: true,
        eventSegment: true,
        user: {
            include: {
                instruments: {
                    include: {
                        instrument: {
                            include: {
                                functionalGroup: true,
                            }
                        },
                    }
                }
            }
        },
    }
}>;

export const EventSegmentUserResponseNaturalOrderBy: Prisma.EventSegmentUserResponseOrderByWithRelationInput[] = [
    // todo: sort by something else?
    { id: 'asc' },
];

export const xEventSegmentUserResponse = new xTable({
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    localInclude: EventSegmentUserResponseArgs.include,
    tableName: "eventSegmentUserResponse",
    naturalOrderBy: EventSegmentUserResponseNaturalOrderBy,
    getRowInfo: (row: EventSegmentUserResponsePayload) => ({
        name: row.user.compactName,
    }),
    getParameterizedWhereClause: (params: TAnyModel): (Prisma.EventSegmentUserResponseWhereInput[] | false) => {
        if (params.eventSegmentId != null) {
            return [{
                eventSegmentId: { equals: params.eventSegmentId }
            }];
        }
        return false;
    },
    columns: [
        new PKField({ columnName: "id" }),
        MakeMarkdownTextField("attendanceComment"),
        new BoolField({ columnName: "expectAttendance", defaultValue: false }),
        new ForeignSingleField<Prisma.EventSegmentGetPayload<{}>>({
            columnName: "eventSegment",
            fkMember: "eventSegmentId",
            allowNull: false,
            foreignTableSpec: xEventSegment,
            getQuickFilterWhereClause: (query: string) => false,
        }),
        new ForeignSingleField<Prisma.UserGetPayload<{}>>({
            columnName: "user",
            fkMember: "userId",
            allowNull: false,
            foreignTableSpec: xUser,
            getQuickFilterWhereClause: (query: string) => false,
        }),
        new ForeignSingleField<Prisma.EventAttendanceGetPayload<{}>>({
            columnName: "attendance",
            fkMember: "attendanceId",
            allowNull: false,
            foreignTableSpec: xEventAttendance,
            getQuickFilterWhereClause: (query: string) => false,
        }),
    ]
});








////////////////////////////////////////////////////////////////
const EventSongListArgs: Prisma.EventSongListArgs = {
    include: {
        event: true,
    }
}

//export type EventSongListPayload = Prisma.EventSongListGetPayload<typeof EventSongListArgs>;
export type EventSongListPayload = Prisma.EventSongListGetPayload<{
    include: {
        event: true,
    }
}>;

export const EventSongListNaturalOrderBy: Prisma.EventSongListOrderByWithRelationInput[] = [
    { sortOrder: 'desc' },
    { id: 'asc' },
];

export const xEventSongList = new xTable({
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    localInclude: EventSongListArgs.include,
    tableName: "eventSongList",
    naturalOrderBy: EventSongListNaturalOrderBy,
    getRowInfo: (row: EventSongListPayload) => ({
        name: row.name,
        description: row.description,
    }),
    getParameterizedWhereClause: (params: TAnyModel): (Prisma.EventSongListWhereInput[] | false) => {
        if (params.eventId != null) {
            return [{
                eventId: { equals: params.eventId }
            }];
        }
        return false;
    },
    columns: [
        new PKField({ columnName: "id" }),
        MakeTitleField("name"),
        MakeMarkdownTextField("description"),
        MakeSortOrderField("sortOrder"),
        new ForeignSingleField<Prisma.EventGetPayload<{}>>({
            columnName: "event",
            fkMember: "eventId",
            allowNull: false,
            foreignTableSpec: xEvent,
            getQuickFilterWhereClause: (query: string) => false,
        }),
    ]
});




////////////////////////////////////////////////////////////////
const EventSongListSongArgs: Prisma.EventSongListSongArgs = {
    include: {
        song: true,
    }
}

//export type EventSongListSongPayload = Prisma.EventSongListSongGetPayload<typeof EventSongListSongArgs>;
export type EventSongListSongPayload = Prisma.EventSongListSongGetPayload<{
    include: {
        song: true,
    }
}>;

export const EventSongListSongNaturalOrderBy: Prisma.EventSongListSongOrderByWithRelationInput[] = [
    { sortOrder: 'desc' },
    { id: 'asc' },
];

export const xEventSongListSong = new xTable({
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    localInclude: EventSongListSongArgs.include,
    tableName: "eventSongListSong",
    naturalOrderBy: EventSongListSongNaturalOrderBy,
    getRowInfo: (row: EventSongListSongPayload) => ({
        name: row.song.name,
        description: row.subtitle || "",
    }),
    getParameterizedWhereClause: (params: TAnyModel): (Prisma.EventSongListSongWhereInput[] | false) => {
        if (params.eventSongListId != null) {
            return [{
                eventSongListId: { equals: params.eventSongListId }
            }];
        }
        return false;
    },
    columns: [
        new PKField({ columnName: "id" }),
        MakePlainTextField("subtitle"),
        MakeSortOrderField("sortOrder"),
        new ForeignSingleField<Prisma.SongGetPayload<{}>>({
            columnName: "song",
            fkMember: "songId",
            allowNull: false,
            foreignTableSpec: xSong,
            getQuickFilterWhereClause: (query: string) => false,
        }),
        new ForeignSingleField<Prisma.EventSongListGetPayload<{}>>({
            columnName: "eventSongList",
            fkMember: "eventSongListId",
            allowNull: false,
            foreignTableSpec: xEventSongList,
            getQuickFilterWhereClause: (query: string) => false,
        }),
    ]
});
