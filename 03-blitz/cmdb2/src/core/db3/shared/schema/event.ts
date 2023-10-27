// TODO: permissions for actions like these needs to be done in a different way.
// for example i should be able to edit my own posts but not others. etc.
// or think about the concept of user blocking, or not being able to see responses of certain kinds of events or people. todo...

import db, { Prisma } from "db";
import { ColorPalette, ColorPaletteEntry, gGeneralPaletteList } from "shared/color";
import { Permission } from "shared/permissions";
import { CoerceToNumberOrNull, Date_MAX_VALUE, KeysOf, TAnyModel, assertIsNumberArray, gIconOptions } from "shared/utils";
import * as db3 from "../db3core";
import { ColorField, ConstEnumStringField, ForeignSingleField, GenericIntegerField, GenericStringField, BoolField, PKField, TagsField, MakePlainTextField, MakeMarkdownTextField, MakeSortOrderField, MakeColorField, MakeSignificanceField, MakeIntegerField, MakeSlugField, MakeTitleField, MakeCreatedAtField, MakeIconField, MakeNullableRawTextField, MakeRawTextField, EventStartsAtField } from "../db3basicFields";
import { CreatedByUserField, VisiblePermissionField, xPermission, xUser } from "./user";
import { xSong } from "./song";
import {
    EventArgs, EventArgs_Verbose, EventAttendanceArgs, EventAttendanceNaturalOrderBy, EventAttendancePayload, EventClientPayload_Verbose, EventNaturalOrderBy, EventPayload, EventPayloadClient,
    EventSegmentArgs, EventSegmentNaturalOrderBy, EventSegmentPayload, EventSegmentUserResponseArgs, EventSegmentUserResponseNaturalOrderBy, EventSegmentUserResponsePayload, EventSongListArgs, EventSongListNaturalOrderBy, EventSongListPayload, EventSongListSongArgs, EventSongListSongNaturalOrderBy, EventSongListSongPayload, EventStatusArgs, EventStatusNaturalOrderBy, EventStatusPayload, EventStatusSignificance, EventTagArgs, EventTagAssignmentArgs, EventTagAssignmentNaturalOrderBy, EventTagAssignmentPayload, EventTagNaturalOrderBy, EventTagPayload, EventTagSignificance, EventTaggedFilesPayload, EventTypeArgs, EventTypeNaturalOrderBy, EventTypePayload, EventTypeSignificance, EventVerbose_EventSegmentPayload, InstrumentArgs, InstrumentPayload, UserPayload
} from "./prismArgs";
import { getUserPrimaryInstrument, xInstrument } from "./instrument";
import { xFileEventTag } from "./file";
import { IsEarlierDateWithLateNull, MinDateOrLateNull } from "shared/time";

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
// - field is required, structured, queryable, and obvious, and only 1 possible

// to go further i could make events & rehearsals separate tables. but i don't think that's a good idea; the idea would be that
// they get separate data for the different types. but that's not really the case because this Events table is quite general for events;
// nothing here is specific to any type of event. should that be the case it can be attached somehow.


// const x : Prisma.EventInclude = {

// };

export const getEventSegmentMinDate = (event: EventPayload) => {
    return event.segments.reduce((acc, seg) => {
        // we want NULLs to count as maximum. The idea is that the date is not "yet" determined.
        const thisSegmentMinDate = MinDateOrLateNull(seg.startsAt, seg.endsAt);
        return MinDateOrLateNull(acc, thisSegmentMinDate);
    }, null);
};

export const xEventType = new db3.xTable({
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.EventTypeInclude => {
        return EventTypeArgs.include;
    },
    tableName: "EventType",
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
    softDeleteSpec: {
        isDeletedColumnName: "isDeleted",
    },
    columns: [
        new PKField({ columnName: "id" }),
        new BoolField({ columnName: "isDeleted", defaultValue: false }),
        MakeTitleField("text"),
        MakeMarkdownTextField("description"),
        MakeSortOrderField("sortOrder"),
        MakeColorField("color"),
        MakeSignificanceField("significance", EventTypeSignificance),
        MakeIconField("iconName", gIconOptions),
    ]
});


////////////////////////////////////////////////////////////////


export const xEventStatus = new db3.xTable({
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.EventStatusInclude => {
        return EventStatusArgs.include;
    },
    tableName: "eventStatus",
    naturalOrderBy: EventStatusNaturalOrderBy,
    createInsertModelFromString: (input: string): Prisma.EventStatusCreateInput => {
        return {
            label: input,
            description: "auto-created",
            sortOrder: 0,
        };
    },
    getRowInfo: (row: EventStatusPayload) => ({
        name: row.label,
        description: row.description,
        color: gGeneralPaletteList.findEntry(row.color),
    }),
    softDeleteSpec: {
        isDeletedColumnName: "isDeleted",
    },
    columns: [
        new PKField({ columnName: "id" }),
        new BoolField({ columnName: "isDeleted", defaultValue: false }),
        MakeTitleField("label"),
        MakeMarkdownTextField("description"),
        MakeSortOrderField("sortOrder"),
        MakeColorField("color"),
        MakeSignificanceField("significance", EventStatusSignificance),
        MakeIconField("iconName", gIconOptions),
    ]
});


////////////////////////////////////////////////////////////////

export const xEventTag = new db3.xTable({
    tableName: "EventTag",
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.EventTagInclude => {
        return EventTagArgs.include;
    },
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
        new BoolField({ columnName: "visibleOnFrontpage", defaultValue: false }),
        MakeMarkdownTextField("description"),
        MakeSortOrderField("sortOrder"),
        MakeColorField("color"),
        MakeSignificanceField("significance", EventTagSignificance),
    ]
});



////////////////////////////////////////////////////////////////

export const xEventTagAssignment = new db3.xTable({
    tableName: "EventTagAssignment",
    editPermission: Permission.edit_events,
    viewPermission: Permission.view_events,
    naturalOrderBy: EventTagAssignmentNaturalOrderBy,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.EventTagAssignmentInclude => {
        return EventTagAssignmentArgs.include;
    },
    getRowInfo: (row: EventTagAssignmentPayload) => {
        return {
            name: row.eventTag.text,
            description: row.eventTag.description,
            color: gGeneralPaletteList.findEntry(row.eventTag.color),
        };
    },
    columns: [
        new PKField({ columnName: "id" }),
        new ForeignSingleField<Prisma.EventTagGetPayload<{}>>({
            columnName: "eventTag",
            fkMember: "eventTagId",
            allowNull: false,
            foreignTableID: "EventTag",
            getQuickFilterWhereClause: (query: string) => false,
        }),
    ]
});


const xEventArgs_Base: db3.TableDesc = {
    tableName: "event",
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.EventInclude => {
        return EventArgs.include;
    },
    naturalOrderBy: EventNaturalOrderBy,
    getRowInfo: (row: EventPayloadClient) => ({
        name: row.name,
        description: row.description,
        color: gGeneralPaletteList.findEntry(row.type?.color || null),
    }),
    getParameterizedWhereClause: (params: { eventId?: number, eventSlug?: string, eventTypeIds?: number[], eventStatusIds: number[] }, clientIntention: db3.xTableClientUsageContext): (Prisma.EventWhereInput[]) => {
        const ret: Prisma.EventWhereInput[] = [];

        console.assert(clientIntention.currentUser?.id !== undefined);
        console.assert(clientIntention.currentUser?.role?.permissions !== undefined);
        //console.log(`getParameterizedWhereClause for event with params:${JSON.stringify(params)}, clientintention:${JSON.stringify([clientIntention.mode, clientIntention.intention])}`);

        if (params.eventId !== undefined) {
            console.assert(params.eventSlug === undefined);
            ret.push({ id: params.eventId, });
        }
        if (params.eventSlug !== undefined) {
            console.assert(params.eventId === undefined);
            ret.push({ slug: params.eventSlug });
        }
        if (params.eventTypeIds !== undefined) {
            assertIsNumberArray(params.eventTypeIds);
            if (params.eventTypeIds.length > 0) {
                const t: Prisma.EventWhereInput = {
                    typeId: { in: params.eventTypeIds }
                };
                ret.push(t);
            }
        }
        if (params.eventStatusIds !== undefined) {
            assertIsNumberArray(params.eventStatusIds);
            if (params.eventStatusIds.length > 0) {
                const t: Prisma.EventWhereInput = {
                    statusId: { in: params.eventStatusIds }
                };
                ret.push(t);
            }
        }

        return ret;
    },
    clientLessThan: (a: EventPayload, b: EventPayload) => {
        // `!`, because we want desc (late dates first)
        return !IsEarlierDateWithLateNull(getEventSegmentMinDate(a), getEventSegmentMinDate(b));
    },
    softDeleteSpec: {
        isDeletedColumnName: "isDeleted",
    },
    visibilitySpec: {
        ownerUserIDColumnName: "createdByUserId",
        visiblePermissionIDColumnName: "visiblePermissionId",
    },
    columns: [
        new PKField({ columnName: "id" }),
        MakeTitleField("name"),
        MakeSlugField("slug", "name"),
        MakeMarkdownTextField("description"),
        new BoolField({ columnName: "isDeleted", defaultValue: false }),
        MakePlainTextField("locationDescription"),
        MakePlainTextField("locationURL"),
        //new CalculatedEventDateRangeField(),
        MakeCreatedAtField("createdAt"),
        new ForeignSingleField<Prisma.EventTypeGetPayload<{}>>({
            columnName: "type",
            fkMember: "typeId",
            allowNull: true,
            foreignTableID: "EventType",
            getQuickFilterWhereClause: (query: string) => false,
        }),
        new CreatedByUserField({
            columnName: "createdByUser",
            fkMember: "createdByUserId",
        }),
        new VisiblePermissionField({
            columnName: "visiblePermission",
            fkMember: "visiblePermissionId",
        }),
        new ForeignSingleField<Prisma.EventStatusGetPayload<{}>>({
            columnName: "status",
            fkMember: "statusId",
            allowNull: true,
            foreignTableID: "EventStatus",
            getQuickFilterWhereClause: (query: string) => false,
        }),

        new BoolField({ columnName: "frontpageVisible", defaultValue: false }),
        MakeRawTextField("frontpageDate"),
        MakeRawTextField("frontpageTime"),
        MakeRawTextField("frontpageDetails"),

        MakeNullableRawTextField("frontpageTitle"),
        MakeNullableRawTextField("frontpageLocation"),
        MakeNullableRawTextField("frontpageLocationURI"),
        MakeNullableRawTextField("frontpageTags"),

        new TagsField<EventTagAssignmentPayload>({
            columnName: "tags",
            associationForeignIDMember: "eventTagId",
            associationForeignObjectMember: "eventTag",
            associationLocalIDMember: "eventId",
            associationLocalObjectMember: "event",
            associationTableID: "EventTagAssignment",
            foreignTableID: "EventTag",
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
            getCustomFilterWhereClause: (query: db3.CMDBTableFilterModel): Prisma.EventWhereInput | boolean => {
                if (!query.tagIds?.length) return false;
                const tagIds = query!.tagIds;

                return {
                    AND: tagIds.map(tagId => ({
                        tags: { some: { eventTagId: { equals: tagId } } }
                    }))
                };

                // the following does not work; it would require that, for an event, all of its tags are being queried.
                // return ({
                //     tags: { every: { eventTagId: { in: query!.tagIds } } }
                // });
            },
        }), // tags
        new TagsField<EventTaggedFilesPayload>({
            columnName: "fileTags",
            foreignTableID: "File",
            associationTableID: "FileEventTag",
            associationForeignIDMember: "fileId",
            associationForeignObjectMember: "file",
            associationLocalIDMember: "eventId",
            associationLocalObjectMember: "event",
            getQuickFilterWhereClause: (query: string): Prisma.EventWhereInput | boolean => false,
            getCustomFilterWhereClause: (query: db3.CMDBTableFilterModel): Prisma.EventWhereInput | boolean => false,
        }), // tags
    ]
};

export const xEvent = new db3.xTable(xEventArgs_Base);

const xEventArgs_Verbose: db3.TableDesc = {
    ...xEventArgs_Base,
    tableUniqueName: "xEventArgs_Verbose",
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.EventInclude => {
        return EventArgs_Verbose.include;
    },
};

export const xEventVerbose = new db3.xTable(xEventArgs_Verbose);

export const xEventSegment = new db3.xTable({
    tableName: "EventSegment",
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.EventSegmentInclude => {
        return EventSegmentArgs.include;
    },
    naturalOrderBy: EventSegmentNaturalOrderBy,
    getRowInfo: (row: EventSegmentPayload) => ({
        name: row.name,
        description: row.description,
    }),
    getParameterizedWhereClause: (params: TAnyModel, clientIntention: db3.xTableClientUsageContext): (Prisma.EventSegmentWhereInput[] | false) => {
        if (params.eventId != null) {
            return [{
                eventId: { equals: params.eventId }
            }];
        }
        return false;
    },
    columns: [
        new PKField({ columnName: "id" }),
        new GenericStringField({ // allow 0-length names in segments. sometimes it's not easy to know what to name them and it's not that important
            columnName: "name",
            allowNull: false,
            format: "plain",
        }),
        MakeMarkdownTextField("description"),
        new EventStartsAtField({
            allowNull: true,
            columnName: "startsAt",
        }),
        new GenericIntegerField({
            allowNull: false,
            columnName: "durationMillis",
        }),
        new BoolField({
            columnName: "isAllDay",
            defaultValue: true,
        }),

        new ForeignSingleField<Prisma.EventGetPayload<{}>>({
            columnName: "event",
            fkMember: "eventId",
            allowNull: false,
            foreignTableID: "Event",
            getQuickFilterWhereClause: (query: string) => false,
        }),
    ]
});



// export const xEventComment = new db3.xTable({
//     tableName: "EventComment",
//     editPermission: Permission.admin_general,
//     viewPermission: Permission.view_general_info,
//     getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.EventCommentInclude => {
//         return EventCommentArgs.include;
//     },
//     naturalOrderBy: EventCommentNaturalOrderBy,
//     getRowInfo: (row: EventCommentPayload) => ({
//         name: "<not supported>",
//     }),
//     getParameterizedWhereClause: (params: TAnyModel, clientIntention: db3.xTableClientUsageContext) => {
//         const ret: Prisma.EventCommentWhereInput[] = [];
//         if (params.eventId != null) {
//             ret.push({
//                 eventId: { equals: params.eventId }
//             });
//         }
//         //db3.ApplyVisibilityWhereClause(ret, clientIntention, "userId");
//         return ret;
//     },
//     visibilitySpec: {
//         ownerUserIDColumnName: "userId",
//         visiblePermissionIDColumnName: "visiblePermissionId",
//     },
//     columns: [
//         new PKField({ columnName: "id" }),
//         MakeMarkdownTextField("text"),
//         MakeCreatedAtField("createdAt"),
//         new DateTimeField({ allowNull: false, columnName: "updatedAt", granularity: "minute", }),
//         new ForeignSingleField<Prisma.EventGetPayload<{}>>({
//             columnName: "event",
//             fkMember: "eventId",
//             allowNull: false,
//             foreignTableID: "Event",
//             getQuickFilterWhereClause: (query: string) => false,
//         }),
//         new ForeignSingleField<Prisma.UserGetPayload<{}>>({
//             columnName: "user",
//             fkMember: "userId",
//             allowNull: false,
//             foreignTableID: "User",
//             getQuickFilterWhereClause: (query: string) => false,
//         }),
//         new VisiblePermissionField({
//             columnName: "visiblePermission",
//             fkMember: "visiblePermissionId",
//         }),
//     ]
// });








////////////////////////////////////////////////////////////////

export const xEventAttendance = new db3.xTable({
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.EventAttendanceInclude => {
        return EventAttendanceArgs.include;
    },
    tableName: "eventAttendance",
    naturalOrderBy: EventAttendanceNaturalOrderBy,
    getRowInfo: (row: EventAttendancePayload) => ({
        name: row.text,
        description: row.description,
        color: gGeneralPaletteList.findEntry(row.color),
    }),
    softDeleteSpec: {
        isDeletedColumnName: "isDeleted",
    },
    columns: [
        new PKField({ columnName: "id" }),
        MakeTitleField("text"),
        new GenericStringField({ allowNull: false, columnName: "personalText", format: "title", caseSensitive: false }),
        MakeMarkdownTextField("description"),
        MakeColorField("color"),
        MakeIntegerField("strength"),
        MakeSortOrderField("sortOrder"),
        new BoolField({ columnName: "isDeleted", defaultValue: false }),
    ]
});




export const xEventSegmentUserResponse = new db3.xTable({
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.EventSegmentUserResponseInclude => {
        return EventSegmentUserResponseArgs.include;
    },
    tableName: "eventSegmentUserResponse",
    naturalOrderBy: EventSegmentUserResponseNaturalOrderBy,
    getRowInfo: (row: EventSegmentUserResponsePayload) => ({
        name: row.user.compactName,
    }),
    getParameterizedWhereClause: (params: TAnyModel, clientIntention: db3.xTableClientUsageContext) => {
        const ret: Prisma.EventSegmentUserResponseWhereInput[] = [];
        if (params.eventSegmentId != null) {
            ret.push({
                eventSegmentId: { equals: params.eventSegmentId }
            });
        }
        return ret;
    },
    columns: [
        new PKField({ columnName: "id" }),
        MakeMarkdownTextField("attendanceComment"),
        new BoolField({ columnName: "expectAttendance", defaultValue: false }),
        new ForeignSingleField<Prisma.EventSegmentGetPayload<{}>>({
            columnName: "eventSegment",
            fkMember: "eventSegmentId",
            allowNull: false,
            foreignTableID: "EventSegment",
            getQuickFilterWhereClause: (query: string) => false,
        }),
        new ForeignSingleField<Prisma.UserGetPayload<{}>>({
            columnName: "user",
            fkMember: "userId",
            allowNull: false,
            foreignTableID: "User",
            getQuickFilterWhereClause: (query: string) => false,
        }),
        new ForeignSingleField<Prisma.EventAttendanceGetPayload<{}>>({
            columnName: "attendance",
            fkMember: "attendanceId",
            allowNull: false,
            foreignTableID: "EventAttendance",
            getQuickFilterWhereClause: (query: string) => false,
        }),
        new ForeignSingleField<Prisma.InstrumentGetPayload<{}>>({
            columnName: "instrument",
            fkMember: "instrumentId",
            allowNull: true,
            foreignTableID: "Instrument",
            getQuickFilterWhereClause: (query: string) => false,
        }),
    ]
});







export const xEventSongList = new db3.xTable({
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.EventSongListInclude => {
        return EventSongListArgs.include;
    },
    tableName: "eventSongList",
    naturalOrderBy: EventSongListNaturalOrderBy,
    getRowInfo: (row: EventSongListPayload) => ({
        name: row.name,
        description: row.description,
    }),
    getParameterizedWhereClause: (params: TAnyModel, clientIntention: db3.xTableClientUsageContext) => {
        const ret: Prisma.EventSongListWhereInput[] = [];
        if (params.eventId != null) {
            ret.push({
                eventId: { equals: params.eventId }
            });
        }
        return ret;
    },
    visibilitySpec: {
        ownerUserIDColumnName: "createdByUserId",
        visiblePermissionIDColumnName: "visiblePermissionId",
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
            foreignTableID: "Event",
            getQuickFilterWhereClause: (query: string) => false,
        }),
        new CreatedByUserField({
            columnName: "createdByUser",
            fkMember: "createdByUserId",
        }),
        new VisiblePermissionField({
            columnName: "visiblePermission",
            fkMember: "visiblePermissionId",
        }),
        new TagsField<Prisma.EventSongListGetPayload<{}>>({
            columnName: "songs",
            foreignTableID: "Song",
            associationTableID: "eventSongListSong",
            associationForeignIDMember: "songId",
            associationForeignObjectMember: "song",
            associationLocalIDMember: "eventSongListId",
            associationLocalObjectMember: "eventSongList",
            getQuickFilterWhereClause: (query: string): Prisma.EventSongListWhereInput | boolean => false,
            getCustomFilterWhereClause: (query: db3.CMDBTableFilterModel): Prisma.EventSongListWhereInput | boolean => false,
        }),
    ]
});



export const xEventSongListSong = new db3.xTable({
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.EventSongListSongInclude => {
        return EventSongListSongArgs.include;
    },
    tableName: "eventSongListSong",
    naturalOrderBy: EventSongListSongNaturalOrderBy,
    getRowInfo: (row: EventSongListSongPayload) => ({
        name: row.song.name,
        description: row.subtitle || "",
    }),
    getParameterizedWhereClause: (params: TAnyModel, clientIntention: db3.xTableClientUsageContext): (Prisma.EventSongListSongWhereInput[] | false) => {
        const ret: Prisma.EventSongListSongWhereInput[] = [];
        if (params.eventSongListId != null) {
            ret.push({
                eventSongListId: { equals: params.eventSongListId }
            });
        }
        return ret;
    },
    columns: [
        new PKField({ columnName: "id" }),
        MakePlainTextField("subtitle"),
        MakeSortOrderField("sortOrder"),
        new ForeignSingleField<Prisma.SongGetPayload<{}>>({
            columnName: "song",
            fkMember: "songId",
            allowNull: false,
            foreignTableID: "Song",
            getQuickFilterWhereClause: (query: string) => false,
        }),
        new ForeignSingleField<Prisma.EventSongListGetPayload<{}>>({
            columnName: "eventSongList",
            fkMember: "eventSongListId",
            allowNull: false,
            foreignTableID: "EventSongList",
            getQuickFilterWhereClause: (query: string) => false,
        }),
    ]
});


////////////////////////////////////////////////////////////////
// by the time the data reaches the UX, ideally it should be a rich object with methods, calculated fields etc.
// unfortunately we're not there yet. helper functions like this exist.
export interface CalculateEventInfoForUserArgs {
    user: UserPayload;
    event: EventClientPayload_Verbose;
}

export interface SegmentAndResponse {
    event: EventPayloadClient;
    segment: EventVerbose_EventSegmentPayload;
    response: EventSegmentUserResponsePayload;
    instrument: InstrumentPayload | null;
};

////////////////////////////////////////////////////////////////
export const getInstrumentForEventSegmentUserResponse = (response: EventSegmentUserResponsePayload, user: UserPayload): (InstrumentPayload | null) => {
    if (response.instrument != null) {
        //console.log(`response instrument null; returning user instrument ${response.instrument?.name} id:${response.instrumentId}`);
        return response.instrument;
    }
    // use default.
    const ret = getUserPrimaryInstrument(user);
    //console.log(`response instrument == null; returning user instrument ${ret?.name} id:${ret?.id}`);
    return ret;
}


export class EventInfoForUser {
    user: UserPayload;
    event: EventClientPayload_Verbose;
    segments: SegmentAndResponse[];  //{ [segmentId: number]: EventSegmentUserResponse }; // all segments in order, together with response. response ALWAYS there for simplicity.

    // (todo) when there is only 1 response type for all segments (1 segment, or all the same), then this will contain that singular one.
    //singularResponse?: EventSegmentUserResponsePayload;

    constructor(args: CalculateEventInfoForUserArgs) {
        this.user = args.user;
        this.event = args.event;

        console.assert(!!args.event.segments);
        this.segments = args.event.segments.map(seg => {
            console.assert(!!seg.responses);
            const response = seg.responses.find(r => r.userId === args.user.id);
            if (!!response) {
                return {
                    event: args.event,
                    segment: seg,
                    response: response,
                    instrument: getInstrumentForEventSegmentUserResponse(response, args.user),
                };
            }

            // mock response when none exists
            const mockResponse: EventSegmentUserResponsePayload = {
                attendance: null,
                attendanceComment: null,
                attendanceId: null,
                eventSegmentId: seg.id,
                eventSegment: seg,
                expectAttendance: false, // no response object means the user is not expected
                id: -1,
                user: this.user,
                userId: this.user.id,
                instrument: null,
                instrumentId: null,
            };

            return {
                event: args.event,
                segment: seg,
                response: mockResponse,
                instrument: getInstrumentForEventSegmentUserResponse(mockResponse, args.user),
            }
        });
    }

    getSegmentUserInfo = (segmentId: number) => {
        const segment = this.segments.find(s => s.segment.id === segmentId);
        if (!segment) {
            throw new Error(`segment id not found: ${segmentId}`);
        }
        console.assert(!!segment.response);
        return segment;
    }
};

// calculate responses for each user who is invited OR has a response.
// requires verbose view of event
interface EventResponsesPerUserArgs {
    event: EventClientPayload_Verbose;
};

// returns array of response info per user. so each element has unique user.
export function GetEventResponsesPerUser({ event }: EventResponsesPerUserArgs): EventInfoForUser[] {
    // calculate a list of distinct users
    const users: UserPayload[] = [];
    event.segments.forEach((seg) => {
        // get user ids for this segment
        seg.responses.forEach(resp => {
            if (users.find(u => u.id === resp.userId) == null) {
                users.push(resp.user);
            }
        });
    });

    // and calculate responses for all those users.
    return users.map(user => new EventInfoForUser({ event, user }));
};

