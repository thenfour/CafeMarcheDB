// TODO: permissions for actions like these needs to be done in a different way.
// for example i should be able to edit my own posts but not others. etc.
// or think about the concept of user blocking, or not being able to see responses of certain kinds of events or people. todo...

import { Prisma } from "db";
import { gGeneralPaletteList } from "shared/color";
import { Permission } from "shared/permissions";
import { DateTimeRange } from "shared/time";
import { CoalesceBool, assertIsNumberArray, assertIsStringArray, gIconOptions } from "shared/utils";
import { BoolField, ConstEnumStringField, EventStartsAtField, ForeignSingleField, GenericIntegerField, GenericStringField, GhostField, MakeColorField, MakeCreatedAtField, MakeIconField, MakeIntegerField, MakeMarkdownTextField, MakeNullableRawTextField, MakePlainTextField, MakeRawTextField, MakeSignificanceField, MakeSlugField, MakeSortOrderField, MakeTitleField, PKField, TagsField } from "../db3basicFields";
import * as db3 from "../db3core";
import { getUserPrimaryInstrument } from "./instrument";
import {
    EventArgs, EventArgs_Verbose, EventAttendanceArgs, EventAttendanceNaturalOrderBy, EventAttendancePayload, EventClientPayload_Verbose, EventNaturalOrderBy, EventPayload, EventPayloadClient,
    EventSegmentArgs, EventSegmentBehavior, EventSegmentNaturalOrderBy, EventSegmentPayload, EventSegmentPayloadMinimum, EventSegmentUserResponseArgs, EventSegmentUserResponseNaturalOrderBy,
    EventSegmentUserResponsePayload, EventSongListArgs, EventSongListNaturalOrderBy, EventSongListPayload, EventSongListSongArgs, EventSongListSongNaturalOrderBy,
    EventSongListSongPayload, EventStatusArgs, EventStatusNaturalOrderBy, EventStatusPayload, EventStatusSignificance, EventTagArgs, EventTagAssignmentArgs,
    EventTagAssignmentNaturalOrderBy, EventTagAssignmentPayload, EventTagNaturalOrderBy, EventTagPayload, EventTagSignificance, EventTaggedFilesPayload,
    EventTypeArgs, EventTypeNaturalOrderBy, EventTypePayload, EventTypeSignificance, EventUserResponseArgs, EventUserResponseNaturalOrderBy,
    EventUserResponsePayload,
    EventVerbose_EventSegmentPayload,
    InstrumentPayload,
    UserTagPayload, UserWithInstrumentsPayload
} from "./prismArgs";
import { CreatedByUserField, VisiblePermissionField } from "./user";
import { CMDBTableFilterModel, TAnyModel } from "../apiTypes";


export const xEventAuthMap_UserResponse: db3.DB3AuthContextPermissionMap = {
    PostQueryAsOwner: Permission.view_events_nonpublic,
    PostQuery: Permission.view_events_nonpublic,
    PreMutateAsOwner: Permission.respond_to_events,
    PreMutate: Permission.manage_events,
    PreInsert: Permission.respond_to_events,
};

export const xEventAuthMap_R_EOwn_EManagers: db3.DB3AuthContextPermissionMap = {
    PostQueryAsOwner: Permission.view_events_nonpublic,
    PostQuery: Permission.view_events_nonpublic,
    PreMutateAsOwner: Permission.view_events_nonpublic,
    PreMutate: Permission.manage_events,
    PreInsert: Permission.manage_events,
};

export const xEventAuthMap_R_EManagers: db3.DB3AuthContextPermissionMap = {
    PostQueryAsOwner: Permission.view_events_nonpublic,
    PostQuery: Permission.view_events_nonpublic,
    PreMutateAsOwner: Permission.manage_events,
    PreMutate: Permission.manage_events,
    PreInsert: Permission.manage_events,
};

export const xEventAuthMap_R_EAdmin: db3.DB3AuthContextPermissionMap = {
    PostQueryAsOwner: Permission.view_events_nonpublic,
    PostQuery: Permission.view_events_nonpublic,
    PreMutateAsOwner: Permission.admin_events,
    PreMutate: Permission.admin_events,
    PreInsert: Permission.admin_events,
};

export const xEventAuthMap_CreatedAt = xEventAuthMap_R_EAdmin;

export const xEventAuthMap_Homepage: db3.DB3AuthContextPermissionMap = {
    PostQueryAsOwner: Permission.public,
    PostQuery: Permission.public,
    PreMutateAsOwner: Permission.edit_public_homepage,
    PreMutate: Permission.edit_public_homepage,
    PreInsert: Permission.edit_public_homepage,
};




export const xEventTableAuthMap_R_EManagers: db3.DB3AuthTablePermissionMap = {
    ViewOwn: Permission.public,
    View: Permission.public,
    EditOwn: Permission.manage_events,
    Edit: Permission.manage_events,
    Insert: Permission.manage_events,
};

export const xEventTableAuthMap_R_EAdmins: db3.DB3AuthTablePermissionMap = {
    ViewOwn: Permission.public,
    View: Permission.public,
    EditOwn: Permission.admin_events,
    Edit: Permission.admin_events,
    Insert: Permission.admin_events,
};

export const xEventTableAuthMap_UserResponse: db3.DB3AuthTablePermissionMap = {
    ViewOwn: Permission.view_events,
    View: Permission.view_events,
    EditOwn: Permission.respond_to_events,
    Edit: Permission.manage_events,
    Insert: Permission.respond_to_events, // you can add a response for yourself, but not on behalf of other users. but yea for the moment this is just a limitation.
};






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



export const getEventSegmentDateTimeRange = (segment: EventSegmentPayloadMinimum) => {
    return new DateTimeRange({
        startsAtDateTime: segment.startsAt,
        durationMillis: Number(segment.durationMillis),
        isAllDay: segment.isAllDay,
    });
}


export const getEventSegmentTiming = (segment: EventSegmentPayloadMinimum) => {
    const r = getEventSegmentDateTimeRange(segment);
    return r.hitTestDateTime(null);
}


export const getEventSegmentMinDate = (event: EventPayload): Date | null => {
    const d = event.segments.reduce((acc, seg) => {
        // we want NULLs to count as maximum. The idea is that the date is not "yet" determined.
        const range = getEventSegmentDateTimeRange(seg);
        return range.unionWith(acc);
    }, new DateTimeRange());
    return d.getStartDateTime();
};

export const xEventType = new db3.xTable({
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.EventTypeInclude => {
        return EventTypeArgs.include;
    },
    tableName: "EventType",
    tableAuthMap: xEventTableAuthMap_R_EAdmins,
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
        ownerUserId: null,
    }),
    softDeleteSpec: {
        isDeletedColumnName: "isDeleted",
    },
    columns: [
        new PKField({ columnName: "id" }),
        new BoolField({ columnName: "isDeleted", defaultValue: false, authMap: xEventAuthMap_R_EOwn_EManagers, allowNull: false }),
        MakeTitleField("text", { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeMarkdownTextField("description", { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeSortOrderField("sortOrder", { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeColorField("color", { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeSignificanceField("significance", EventTypeSignificance, { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeIconField("iconName", gIconOptions, { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        new GhostField({ memberName: "events", authMap: xEventAuthMap_R_EOwn_EManagers }),
    ]
});


////////////////////////////////////////////////////////////////


export const xEventStatus = new db3.xTable({
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.EventStatusInclude => {
        return EventStatusArgs.include;
    },
    tableName: "eventStatus",
    tableAuthMap: xEventTableAuthMap_R_EAdmins,
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
        ownerUserId: null,
    }),
    softDeleteSpec: {
        isDeletedColumnName: "isDeleted",
    },
    columns: [
        new PKField({ columnName: "id" }),
        new BoolField({ columnName: "isDeleted", defaultValue: false, authMap: xEventAuthMap_R_EOwn_EManagers, allowNull: false }),
        MakeTitleField("label", { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeMarkdownTextField("description", { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeSortOrderField("sortOrder", { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeColorField("color", { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeSignificanceField("significance", EventStatusSignificance, { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeIconField("iconName", gIconOptions, { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        new GhostField({ memberName: "events", authMap: xEventAuthMap_R_EOwn_EManagers }),
    ]
});


////////////////////////////////////////////////////////////////

export const xEventTag = new db3.xTable({
    tableName: "EventTag",
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.EventTagInclude => {
        return EventTagArgs.include;
    },
    naturalOrderBy: EventTagNaturalOrderBy,
    tableAuthMap: xEventTableAuthMap_R_EAdmins,
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
        ownerUserId: null,
    }),
    columns: [
        new PKField({ columnName: "id" }),
        MakeTitleField("text", { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        new BoolField({ columnName: "visibleOnFrontpage", defaultValue: false, authMap: xEventAuthMap_Homepage, allowNull: false }),
        MakeMarkdownTextField("description", { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeSortOrderField("sortOrder", { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeColorField("color", { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeSignificanceField("significance", EventTagSignificance, { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        new GhostField({ memberName: "events", authMap: xEventAuthMap_R_EOwn_EManagers }),
    ]
});



////////////////////////////////////////////////////////////////

export const xEventTagAssignment = new db3.xTable({
    tableName: "EventTagAssignment",
    naturalOrderBy: EventTagAssignmentNaturalOrderBy,
    tableAuthMap: xEventTableAuthMap_R_EManagers,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.EventTagAssignmentInclude => {
        return EventTagAssignmentArgs.include;
    },
    getRowInfo: (row: EventTagAssignmentPayload) => {
        return {
            name: row.eventTag?.text || "",
            description: row.eventTag?.description || "",
            color: gGeneralPaletteList.findEntry(row.eventTag?.color || null),
            ownerUserId: null,
        };
    },
    columns: [
        new PKField({ columnName: "id" }),
        new ForeignSingleField<Prisma.EventTagGetPayload<{}>>({
            columnName: "eventTag",
            fkMember: "eventTagId",
            allowNull: false,
            foreignTableID: "EventTag",
            authMap: xEventAuthMap_R_EOwn_EManagers,
            getQuickFilterWhereClause: (query: string) => false,
        }),
    ]
});

export interface EventTableParams {
    eventId?: number;
    eventIds?: number[];
    eventUids?: string[];
    eventSlug?: string;
    eventTypeIds?: number[];
    eventStatusIds?: number[];
    minDate?: Date;
    forFrontPageAgenda?: boolean; // returns future + recent events + any event that's showing on front page
};

const xEventArgs_Base: db3.TableDesc = {
    tableName: "event",
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.EventInclude => {
        return EventArgs.include;
    },
    tableAuthMap: xEventTableAuthMap_R_EManagers,
    naturalOrderBy: EventNaturalOrderBy,
    getRowInfo: (row: EventPayloadClient) => ({
        name: row.name,
        description: row.description,
        color: gGeneralPaletteList.findEntry(row.type?.color || null),
        ownerUserId: row.createdByUserId,
    }),
    getParameterizedWhereClause: (params: EventTableParams, clientIntention: db3.xTableClientUsageContext): (Prisma.EventWhereInput[]) => {
        const ret: Prisma.EventWhereInput[] = [];

        if (params.eventId !== undefined) {
            console.assert(params.eventSlug === undefined);
            ret.push({ id: params.eventId, });
        }
        if (params.eventIds !== undefined) {
            assertIsNumberArray(params.eventIds);
            if (params.eventIds.length > 0) {
                const t: Prisma.EventWhereInput = {
                    id: { in: params.eventIds }
                };
                ret.push(t);
            }
        }
        if (params.eventUids !== undefined) {
            assertIsStringArray(params.eventUids);
            if (params.eventUids.length > 0) {
                const t: Prisma.EventWhereInput = {
                    uid: { in: params.eventUids }
                };
                ret.push(t);
            }
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

        // a past event is one that ENDED before now.
        if (params.minDate !== undefined) {
            const t: Prisma.EventWhereInput = {
                OR: [
                    { endDateTime: { gte: params.minDate! } },
                    {
                        endDateTime: null,
                    },]
            };
            ret.push(t);
        }

        // a past event is one that ENDED before now.
        if (params.forFrontPageAgenda) {
            const minDate = new Date();
            minDate.setDate(minDate.getDate() - 10);

            const t: Prisma.EventWhereInput = {
                OR: [
                    {
                        endDateTime: { gte: minDate }
                    },
                    {
                        endDateTime: null,
                    },
                    {
                        frontpageVisible: true,
                    }
                ]
            };
            ret.push(t);
        }

        return ret;
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
        MakeTitleField("name", { authMap: xEventAuthMap_Homepage, }),
        MakeSlugField("slug", "name", { authMap: xEventAuthMap_R_EAdmin, }),
        MakeMarkdownTextField("description", { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        new BoolField({ columnName: "isDeleted", defaultValue: false, authMap: xEventAuthMap_R_EOwn_EManagers, allowNull: false }),
        MakePlainTextField("locationDescription", { authMap: xEventAuthMap_Homepage, }),
        //MakePlainTextField("locationURL", { authMap: xEventAuthMap_R_EOwn_EManagers, }),

        new GenericStringField({
            columnName: "locationURL",
            allowNull: false,
            format: "plain",
            allowQuickFilter: false,
            authMap: xEventAuthMap_Homepage,
        }),

        //new CalculatedEventDateRangeField(),
        MakeCreatedAtField("createdAt", { authMap: xEventAuthMap_CreatedAt, }),
        new ConstEnumStringField({
            columnName: "segmentBehavior",
            allowNull: true,
            defaultValue: "Sets",
            options: EventSegmentBehavior,
            authMap: xEventAuthMap_R_EOwn_EManagers,
        }),
        new ForeignSingleField<Prisma.EventTypeGetPayload<{}>>({
            columnName: "type",
            fkMember: "typeId",
            allowNull: true,
            foreignTableID: "EventType",
            authMap: xEventAuthMap_R_EOwn_EManagers,
            getQuickFilterWhereClause: (query: string) => false,
        }),
        new CreatedByUserField({
            columnName: "createdByUser",
            fkMember: "createdByUserId",
            authMap: xEventAuthMap_CreatedAt,
        }),
        new VisiblePermissionField({
            columnName: "visiblePermission",
            fkMember: "visiblePermissionId",
            authMap: xEventAuthMap_R_EOwn_EManagers,
        }),
        new ForeignSingleField<Prisma.EventStatusGetPayload<{}>>({
            columnName: "status",
            fkMember: "statusId",
            allowNull: true,
            foreignTableID: "EventStatus",
            authMap: xEventAuthMap_R_EOwn_EManagers,
            getQuickFilterWhereClause: (query: string) => false,
        }),
        new ForeignSingleField<Prisma.UserTagGetPayload<{}>>({
            columnName: "expectedAttendanceUserTag",
            fkMember: "expectedAttendanceUserTagId",
            allowNull: true,
            foreignTableID: "UserTag",
            authMap: xEventAuthMap_R_EOwn_EManagers,
            getQuickFilterWhereClause: (query: string) => false,
        }),

        new BoolField({ columnName: "frontpageVisible", defaultValue: false, authMap: xEventAuthMap_Homepage, allowNull: false }),
        MakeRawTextField("frontpageDate", { authMap: xEventAuthMap_Homepage, }),
        MakeRawTextField("frontpageTime", { authMap: xEventAuthMap_Homepage, }),
        MakeMarkdownTextField("frontpageDetails", { authMap: xEventAuthMap_Homepage, }),

        MakeNullableRawTextField("frontpageTitle", { authMap: xEventAuthMap_Homepage, }),
        MakeNullableRawTextField("frontpageLocation", { authMap: xEventAuthMap_Homepage, }),
        MakeNullableRawTextField("frontpageLocationURI", { authMap: xEventAuthMap_Homepage, }),
        MakeNullableRawTextField("frontpageTags", { authMap: xEventAuthMap_Homepage, }),

        new TagsField<EventTagAssignmentPayload>({
            columnName: "tags",
            associationForeignIDMember: "eventTagId",
            associationForeignObjectMember: "eventTag",
            associationLocalIDMember: "eventId",
            associationLocalObjectMember: "event",
            associationTableID: "EventTagAssignment",
            authMap: xEventAuthMap_Homepage,
            foreignTableID: "EventTag",
            // don't allow quick search on tag; it interferes with getEventFilterInfo.ts
            getQuickFilterWhereClause: () => false,
            // getQuickFilterWhereClause: (query: string): Prisma.EventWhereInput => ({
            //     tags: {
            //         some: {
            //             eventTag: {
            //                 text: {
            //                     contains: query
            //                 }
            //             }
            //         }
            //     }
            // }),
            getCustomFilterWhereClause: (query: CMDBTableFilterModel): Prisma.EventWhereInput | boolean => {
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
            authMap: xEventAuthMap_R_EOwn_EManagers,
            associationLocalIDMember: "eventId",
            associationLocalObjectMember: "event",
            getQuickFilterWhereClause: (query: string): Prisma.EventWhereInput | boolean => false,
            getCustomFilterWhereClause: (query: CMDBTableFilterModel): Prisma.EventWhereInput | boolean => false,
        }), // tags

        new GhostField({ memberName: "segments", authMap: xEventAuthMap_R_EOwn_EManagers }),
        new GhostField({ memberName: "responses", authMap: xEventAuthMap_R_EOwn_EManagers }),
        new GhostField({ memberName: "songLists", authMap: xEventAuthMap_R_EOwn_EManagers }),
        new GhostField({ memberName: "updatedAt", authMap: xEventAuthMap_R_EOwn_EManagers }),

        // because this is used for generating icals
        new GhostField({ memberName: "uid", authMap: xEventAuthMap_Homepage }),

        new EventStartsAtField({
            allowNull: true,
            columnName: "startsAt",
            authMap: xEventAuthMap_Homepage,
        }),
        new GenericIntegerField({
            allowNull: false,
            allowSearchingThisField: false,
            columnName: "durationMillis",
            authMap: xEventAuthMap_Homepage,
        }),
        new BoolField({
            columnName: "isAllDay",
            defaultValue: true,
            authMap: xEventAuthMap_Homepage,
            allowNull: false
        }),

        new GhostField({ memberName: "endDateTime", authMap: xEventAuthMap_Homepage }),
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
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.EventSegmentInclude => {
        return EventSegmentArgs.include;
    },
    naturalOrderBy: EventSegmentNaturalOrderBy,
    tableAuthMap: xEventTableAuthMap_R_EManagers,
    getRowInfo: (row: EventSegmentPayload) => ({
        name: row.name,
        description: row.description,
        ownerUserId: null,
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
            authMap: xEventAuthMap_R_EOwn_EManagers,
        }),
        MakeMarkdownTextField("description", { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        new EventStartsAtField({
            allowNull: true,
            columnName: "startsAt",
            authMap: xEventAuthMap_R_EOwn_EManagers,
        }),
        new GenericIntegerField({
            allowNull: false,
            columnName: "durationMillis",
            allowSearchingThisField: false,
            authMap: xEventAuthMap_R_EOwn_EManagers,
        }),
        new BoolField({
            columnName: "isAllDay",
            defaultValue: true,
            authMap: xEventAuthMap_R_EOwn_EManagers,
            allowNull: false
        }),

        new ForeignSingleField<Prisma.EventGetPayload<{}>>({
            columnName: "event",
            fkMember: "eventId",
            allowNull: false,
            foreignTableID: "Event",
            getQuickFilterWhereClause: (query: string) => false,
            authMap: xEventAuthMap_R_EOwn_EManagers,
        }),

        new GhostField({ memberName: "responses", authMap: xEventAuthMap_R_EOwn_EManagers }),
    ]
});



////////////////////////////////////////////////////////////////

export const xEventAttendance = new db3.xTable({
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.EventAttendanceInclude => {
        return EventAttendanceArgs.include;
    },
    tableName: "eventAttendance",
    tableAuthMap: xEventTableAuthMap_R_EAdmins,
    naturalOrderBy: EventAttendanceNaturalOrderBy,
    getRowInfo: (row: EventAttendancePayload) => ({
        name: row.text,
        description: row.description,
        color: gGeneralPaletteList.findEntry(row.color),
        ownerUserId: null,
        iconName: row.iconName,
    }),
    softDeleteSpec: {
        isDeletedColumnName: "isDeleted",
    },
    columns: [
        new PKField({ columnName: "id" }),
        MakeTitleField("text", { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        new GenericStringField({ allowNull: false, columnName: "personalText", format: "title", caseSensitive: false, authMap: xEventAuthMap_R_EOwn_EManagers, }),
        new GenericStringField({ allowNull: false, columnName: "pastText", format: "title", caseSensitive: false, authMap: xEventAuthMap_R_EOwn_EManagers, }),
        new GenericStringField({ allowNull: false, columnName: "pastPersonalText", format: "title", caseSensitive: false, authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeMarkdownTextField("description", { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeIconField("iconName", gIconOptions, { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeColorField("color", { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeIntegerField("strength", { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeSortOrderField("sortOrder", { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        new BoolField({ columnName: "isDeleted", defaultValue: false, authMap: xEventAuthMap_R_EOwn_EManagers, allowNull: false }),
        new GhostField({ memberName: "responses", authMap: xEventAuthMap_R_EOwn_EManagers }),
    ]
});




export const xEventSegmentUserResponse = new db3.xTable({
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.EventSegmentUserResponseInclude => {
        return EventSegmentUserResponseArgs.include;
    },
    tableName: "eventSegmentUserResponse",
    tableAuthMap: xEventTableAuthMap_UserResponse,
    naturalOrderBy: EventSegmentUserResponseNaturalOrderBy,
    getRowInfo: (row: EventSegmentUserResponsePayload) => ({
        name: row.user?.name || "",
        ownerUserId: row.userId,
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
        //MakeMarkdownTextField("attendanceComment"),
        //new BoolField({ columnName: "expectAttendance", defaultValue: false }),
        new ForeignSingleField<Prisma.EventSegmentGetPayload<{}>>({
            columnName: "eventSegment",
            fkMember: "eventSegmentId",
            allowNull: false,
            foreignTableID: "EventSegment",
            getQuickFilterWhereClause: (query: string) => false,
            authMap: xEventAuthMap_UserResponse,
        }),
        new ForeignSingleField<Prisma.UserGetPayload<{}>>({
            columnName: "user",
            fkMember: "userId",
            allowNull: false,
            foreignTableID: "User",
            getQuickFilterWhereClause: (query: string) => false,
            authMap: xEventAuthMap_UserResponse,
        }),
        new ForeignSingleField<Prisma.EventAttendanceGetPayload<{}>>({
            columnName: "attendance",
            fkMember: "attendanceId",
            allowNull: true,
            foreignTableID: "EventAttendance",
            getQuickFilterWhereClause: (query: string) => false,
            authMap: xEventAuthMap_UserResponse,
        }),
        // new ForeignSingleField<Prisma.InstrumentGetPayload<{}>>({
        //     columnName: "instrument",
        //     fkMember: "instrumentId",
        //     allowNull: true,
        //     foreignTableID: "Instrument",
        //     getQuickFilterWhereClause: (query: string) => false,
        // }),
    ]
});



export const xEventUserResponse = new db3.xTable({
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.EventUserResponseInclude => {
        return EventUserResponseArgs.include;
    },
    tableName: "eventUserResponse",
    naturalOrderBy: EventUserResponseNaturalOrderBy,
    tableAuthMap: xEventTableAuthMap_UserResponse,
    getRowInfo: (row: EventUserResponsePayload) => ({
        name: row.user?.name || "",
        ownerUserId: row.user?.id,
    }),
    getParameterizedWhereClause: (params: TAnyModel, clientIntention: db3.xTableClientUsageContext) => {
        const ret: Prisma.EventUserResponseWhereInput[] = [];
        if (params.eventId != null) {
            ret.push({
                eventId: { equals: params.eventId }
            });
        }
        return ret;
    },
    columns: [
        new PKField({ columnName: "id" }),
        MakeMarkdownTextField("userComment", { authMap: xEventAuthMap_UserResponse, }),
        new BoolField({ columnName: "isInvited", defaultValue: false, authMap: xEventAuthMap_R_EOwn_EManagers, allowNull: true }),
        MakeIntegerField("eventId", { authMap: xEventAuthMap_UserResponse, }),
        // new ForeignSingleField<Prisma.EventSegmentGetPayload<{}>>({
        //     columnName: "eventSegment",
        //     fkMember: "eventSegmentId",
        //     allowNull: false,
        //     foreignTableID: "EventSegment",
        //     getQuickFilterWhereClause: (query: string) => false,
        // }),
        new ForeignSingleField<Prisma.UserGetPayload<{}>>({
            columnName: "user",
            fkMember: "userId",
            allowNull: false,
            foreignTableID: "User",
            getQuickFilterWhereClause: (query: string) => false,
            authMap: xEventAuthMap_R_EOwn_EManagers,
        }),
        // new ForeignSingleField<Prisma.EventAttendanceGetPayload<{}>>({
        //     columnName: "attendance",
        //     fkMember: "attendanceId",
        //     allowNull: false,
        //     foreignTableID: "EventAttendance",
        //     getQuickFilterWhereClause: (query: string) => false,
        // }),
        new ForeignSingleField<Prisma.InstrumentGetPayload<{}>>({
            columnName: "instrument",
            fkMember: "instrumentId",
            allowNull: true,
            foreignTableID: "Instrument",
            getQuickFilterWhereClause: (query: string) => false,
            authMap: xEventAuthMap_UserResponse,
        }),
    ]
});









export const xEventSongList = new db3.xTable({
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.EventSongListInclude => {
        return EventSongListArgs.include;
    },
    tableName: "eventSongList",
    naturalOrderBy: EventSongListNaturalOrderBy,
    tableAuthMap: xEventTableAuthMap_R_EManagers,
    getRowInfo: (row: EventSongListPayload) => ({
        name: row.name,
        description: row.description,
        ownerUserId: null,
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
    // visibilitySpec: {
    //     ownerUserIDColumnName: "createdByUserId",
    //     visiblePermissionIDColumnName: "visiblePermissionId",
    // },
    columns: [
        new PKField({ columnName: "id" }),
        MakeTitleField("name", { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeMarkdownTextField("description", { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeSortOrderField("sortOrder", { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        new ForeignSingleField<Prisma.EventGetPayload<{}>>({
            columnName: "event",
            fkMember: "eventId",
            allowNull: false,
            foreignTableID: "Event",
            authMap: xEventAuthMap_R_EOwn_EManagers,
            getQuickFilterWhereClause: (query: string) => false,
        }),
        // new CreatedByUserField({
        //     columnName: "createdByUser",
        //     fkMember: "createdByUserId",
        // }),
        // new VisiblePermissionField({
        //     columnName: "visiblePermission",
        //     fkMember: "visiblePermissionId",
        // }),
        new TagsField<Prisma.EventSongListGetPayload<{}>>({
            columnName: "songs",
            foreignTableID: "Song",
            associationTableID: "eventSongListSong",
            associationForeignIDMember: "songId",
            associationForeignObjectMember: "song",
            associationLocalIDMember: "eventSongListId",
            associationLocalObjectMember: "eventSongList",
            authMap: xEventAuthMap_R_EOwn_EManagers,
            getQuickFilterWhereClause: (query: string): Prisma.EventSongListWhereInput | boolean => false,
            getCustomFilterWhereClause: (query: CMDBTableFilterModel): Prisma.EventSongListWhereInput | boolean => false,
        }),
        new GhostField({ memberName: "userId", authMap: xEventAuthMap_R_EOwn_EManagers }),
    ]
});



export const xEventSongListSong = new db3.xTable({
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.EventSongListSongInclude => {
        return EventSongListSongArgs.include;
    },
    tableName: "eventSongListSong",
    naturalOrderBy: EventSongListSongNaturalOrderBy,
    tableAuthMap: xEventTableAuthMap_R_EManagers,
    getRowInfo: (row: EventSongListSongPayload) => ({
        name: row.song.name,
        description: row.subtitle || "",
        ownerUserId: null,
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
        MakePlainTextField("subtitle", { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeSortOrderField("sortOrder", { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        new ForeignSingleField<Prisma.SongGetPayload<{}>>({
            columnName: "song",
            fkMember: "songId",
            allowNull: false,
            foreignTableID: "Song",
            authMap: xEventAuthMap_R_EOwn_EManagers,
            getQuickFilterWhereClause: (query: string) => false,
        }),
        new ForeignSingleField<Prisma.EventSongListGetPayload<{}>>({
            columnName: "eventSongList",
            fkMember: "eventSongListId",
            allowNull: false,
            foreignTableID: "EventSongList",
            authMap: xEventAuthMap_R_EOwn_EManagers,
            getQuickFilterWhereClause: (query: string) => false,
        }),
    ]
});


////////////////////////////////////////////////////////////////
export interface EventUserResponse {
    event: EventClientPayload_Verbose;
    user: UserWithInstrumentsPayload;
    response: EventUserResponsePayload;

    isInvited: boolean; // NB: invites & comments are per-event, not segment.
    isRelevantForDisplay: boolean;
    //isAlert: boolean;
    //comment: string;
    instrument: InstrumentPayload | null;
};

export interface EventSegmentUserResponse {
    segment: EventVerbose_EventSegmentPayload;
    user: UserWithInstrumentsPayload;
    response: EventSegmentUserResponsePayload;
};

////////////////////////////////////////////////////////////////
export const getInstrumentForEventUserResponse = (response: EventUserResponsePayload, user: UserWithInstrumentsPayload): (InstrumentPayload | null) => {
    if (response.instrument != null) {
        return response.instrument;
    }
    const ret = getUserPrimaryInstrument(user);
    return ret;
};

export interface GetEventResponseForSegmentAndUserArgs {
    user: UserWithInstrumentsPayload;
    segment: EventVerbose_EventSegmentPayload;
    expectedAttendanceTag: UserTagPayload | null;
};

export const createMockEventSegmentUserResponse = ({ segment, user, expectedAttendanceTag }: GetEventResponseForSegmentAndUserArgs): EventSegmentUserResponse => {
    let expectAttendance: boolean = false;
    if (expectedAttendanceTag) {
        expectAttendance = !!expectedAttendanceTag.userAssignments.find(ua => ua.userId === user.id);
    }

    // mock response when none exists
    const mockResponse: EventSegmentUserResponsePayload = {
        attendance: null,
        attendanceId: null,
        eventSegmentId: segment.id,
        eventSegment: segment,
        id: -1,
        user,
        userId: user.id,
    };

    return {
        segment,
        user,
        response: mockResponse,
    };
};

export interface createMockEventUserResponseArgs {
    user: UserWithInstrumentsPayload;
    event: EventClientPayload_Verbose;
    defaultInvitees: Set<number>;
};

export const createMockEventUserResponse = ({ event, user, defaultInvitees }: createMockEventUserResponseArgs): EventUserResponse => {
    const invitedByDefault: boolean = defaultInvitees.has(user.id);

    // mock response when none exists
    const mockResponse: EventUserResponsePayload = {
        userComment: "",
        eventId: event.id,
        id: -1,
        user,
        userId: user.id,
        instrument: null,
        instrumentId: null,
        isInvited: invitedByDefault,
    };

    return {
        user,
        event,
        isInvited: invitedByDefault,
        isRelevantForDisplay: invitedByDefault,
        instrument: getInstrumentForEventUserResponse(mockResponse, user),
        response: mockResponse,
    };
};

// who's relevant? it's not 100% clear how to handle certain cases.
// there should be 2 stages to the decision: is the user invited, and what is their answer?
// first, how to decide if a user is invited?
// it's based on if they have the expected attendance user tag and if it's been specified in EventSegmentUserResponse.expectAttendance.
// this is basically coalesce(Response.ExpectAttendance, hasusertag)
//
// HasUserTag    Response.ExpectAttendance    Invited
// no            no                           = no (explicit)
// no            yes                          = yes (explicit)
// no            null                         = no (use hasusertag)
// yes           no                           = no (explicit -- in this case the user has been explicitly uninvited)
// yes           yes                          = yes (explicit, redundant)
// yes           null                         = yes (use hasusertag)
// 
// INVITED?   ANSWER       RELEVANCE
// no         null         = no
// no         notgoing     = no. but questionable. "no" because it's redundant and unhelpful.
// no         going        = yes. but should be alerted.
// yes        null         = yes
// yes        notgoing     = yes
// yes        going        = yes
//

export const getEventSegmentResponseForSegmentAndUser = ({ segment, user, expectedAttendanceTag }: GetEventResponseForSegmentAndUserArgs): EventSegmentUserResponse => {
    console.assert(!!segment.responses);

    let expectAttendance: boolean = false;
    if (expectedAttendanceTag) {
        expectAttendance = !!expectedAttendanceTag.userAssignments.find(ua => ua.userId === user.id);
    }

    const response = segment.responses.find(r => r.userId === user.id);
    if (!!response) {
        return {
            segment,
            user,
            response,
        };
    }

    return createMockEventSegmentUserResponse({ segment, user, expectedAttendanceTag });
};


export interface GetEventResponseForUserArgs {
    user: UserWithInstrumentsPayload;
    event: EventClientPayload_Verbose;
    defaultInvitationUserIds: Set<number>;
};


export const getEventResponseForUser = ({ event, user, defaultInvitationUserIds }: GetEventResponseForUserArgs): EventUserResponse => {
    const response = event.responses.find(r => r.userId === user.id);
    if (response) {
        const isInvited = CoalesceBool(response.isInvited, defaultInvitationUserIds.has(user.id));
        const instrument = getInstrumentForEventUserResponse(response, user);
        return {
            isInvited,
            event,
            user,
            instrument,
            response,
            isRelevantForDisplay: false, // calculated later.
        };
    }

    return createMockEventUserResponse({ event, user, defaultInvitees: defaultInvitationUserIds });
};




export interface EventResponseInfoBase {
    event: EventClientPayload_Verbose;
    allEventResponses: EventUserResponse[];
    allSegmentResponses: EventSegmentUserResponse[];
    distinctUsers: UserWithInstrumentsPayload[];
    expectedAttendanceTag: UserTagPayload | null;
    defaultInvitationUserIds: Set<number>;
};

export class EventResponseInfo implements EventResponseInfoBase {
    event: EventClientPayload_Verbose;
    allEventResponses: EventUserResponse[];
    allSegmentResponses: EventSegmentUserResponse[];
    distinctUsers: UserWithInstrumentsPayload[];
    expectedAttendanceTag: UserTagPayload | null;
    defaultInvitationUserIds: Set<number>;
    constructor(args: EventResponseInfoBase) {
        Object.assign(this, args);

        // populate calculated stuff
        this.allEventResponses.forEach(r => {
            // relevant for display = invited OR is maybe going
            const segmentResponses = this.getResponsesBySegmentForUser(r.user);
            const segmentEntries = Object.entries(segmentResponses);

            const isMaybeGoing = segmentEntries.some(e => e[1].response.attendance && e[1].response.attendance.strength > 0);

            r.isRelevantForDisplay = isMaybeGoing || r.isInvited;
        });
    };

    // ALWAYS returns a response. if doesn't exist in the list then a mock one is created.
    getResponseForUserAndSegment = ({ user, segment }: { user: UserWithInstrumentsPayload, segment: EventVerbose_EventSegmentPayload }): EventSegmentUserResponse => {
        const f = this.allSegmentResponses.find(resp => resp.user.id === user.id && resp.segment.id === segment.id);
        if (f) return f;
        return createMockEventSegmentUserResponse({ expectedAttendanceTag: this.expectedAttendanceTag, user, segment });
    };

    // returns responses for all event segments
    getResponsesBySegmentForUser = (user: UserWithInstrumentsPayload): Record<number, EventSegmentUserResponse> => {
        const ret: Record<number, EventSegmentUserResponse> = {};
        this.event.segments.forEach(segment => {
            ret[segment.id] = this.getResponseForUserAndSegment({ user, segment });
        });
        return ret;
    };

    getResponsesForSegment = (segmentId: number) => this.allSegmentResponses.filter(r => r.segment.id === segmentId);

    getEventResponseForUser = (user: UserWithInstrumentsPayload) => {
        const ret = this.allEventResponses.find(r => r.user.id === user.id);
        if (!ret) return createMockEventUserResponse({ event: this.event, user: user, defaultInvitees: this.defaultInvitationUserIds });
        return ret;
    }
};

// calculate responses for each user who is invited OR has a response.
// requires verbose view of event
interface EventResponsesPerUserArgs {
    event: EventClientPayload_Verbose;
    expectedAttendanceTag: UserTagPayload | null;
};

// returns array of response info per user. so each element has unique user.
export function GetEventResponseInfo({ event, expectedAttendanceTag }: EventResponsesPerUserArgs): (EventResponseInfo | null) {
    if (!event.segments) return null; // limited users don't see segments.

    let defaultInvitationUserIds = new Set<number>();

    // calculate a list of potentially relevant users to all segments of the event.
    const users: UserWithInstrumentsPayload[] = [];
    if (expectedAttendanceTag) {
        defaultInvitationUserIds = new Set<number>(expectedAttendanceTag.userAssignments.map(ua => ua.userId));
        users.push(...expectedAttendanceTag.userAssignments.map(ua => ua.user));
    }
    event.segments.forEach((seg) => {
        // get user ids for this segment
        seg.responses.forEach(resp => {
            if (users.find(u => u.id === resp.userId) == null) {
                users.push(resp.user);
            }
        });
    });
    event.responses.forEach((eventResponse) => {
        if (users.find(u => u.id === eventResponse.userId) == null) {
            users.push(eventResponse.user);
        }
    });

    const allSegmentResponses: EventSegmentUserResponse[] = [];
    // for each segment, for all users, generate a response.
    for (let iseg = 0; iseg < event.segments.length; ++iseg) {
        const segment = event.segments[iseg]!;
        allSegmentResponses.push(...users.map(user => getEventSegmentResponseForSegmentAndUser({
            user,
            segment,
            expectedAttendanceTag,
        })));
    }

    const allEventResponses: EventUserResponse[] = users.map(user => getEventResponseForUser({
        user,
        event,
        defaultInvitationUserIds,
    }));

    return new EventResponseInfo({
        event,
        defaultInvitationUserIds,
        expectedAttendanceTag,
        distinctUsers: users,
        allSegmentResponses,
        allEventResponses,
    });
};
