// TODO: permissions for actions like these needs to be done in a different way.
// for example i should be able to edit my own posts but not others. etc.
// or think about the concept of user blocking, or not being able to see responses of certain kinds of events or people. todo...

import { assert } from "blitz";
import { Prisma } from "db";
import { gGeneralPaletteList } from "shared/color";
import { Permission } from "shared/permissions";
import { DateTimeRange } from "shared/time";
import { assertIsNumberArray, assertIsStringArray, gIconOptions } from "shared/utils";
import { CMDBTableFilterModel, SearchCustomDataHookId, TAnyModel } from "../apiTypes";
import { BoolField, ConstEnumStringField, EventStartsAtField, ForeignSingleField, GenericIntegerField, GenericStringField, GhostField, MakeColorField, MakeCreatedAtField, MakeIconField, MakeIntegerField, MakeMarkdownTextField, MakeNullableRawTextField, MakePlainTextField, MakeRawTextField, MakeSignificanceField, MakeSlugField, MakeSortOrderField, MakeTitleField, PKField, RevisionField, TagsField } from "../db3basicFields";
import * as db3 from "../db3core";
import {
    DashboardContextDataBase,
    EventArgs, EventArgs_Verbose, EventAttendanceArgs, EventAttendanceNaturalOrderBy, EventAttendancePayload,
    EventNaturalOrderBy, EventPayload, EventPayloadClient,
    EventSegmentArgs, EventSegmentBehavior, EventSegmentNaturalOrderBy, EventSegmentPayload,
    EventSegmentUserResponseArgs, EventSegmentUserResponseNaturalOrderBy,
    EventSegmentUserResponsePayload, EventSongListArgs, EventSongListNaturalOrderBy, EventSongListPayload, EventSongListSongArgs, EventSongListSongNaturalOrderBy,
    EventSongListSongPayload, EventStatusArgs, EventStatusNaturalOrderBy, EventStatusPayload, EventStatusSignificance, EventTagArgs, EventTagAssignmentArgs,
    EventTagAssignmentNaturalOrderBy, EventTagAssignmentPayload, EventTagNaturalOrderBy, EventTagPayload, EventTagSignificance, EventTaggedFilesPayload,
    EventTypeArgs, EventTypeNaturalOrderBy, EventTypePayload, EventTypeSignificance, EventUserResponseArgs, EventUserResponseNaturalOrderBy,
    EventUserResponsePayload,
    InstrumentPayload,
    UserWithInstrumentsPayload
} from "./prismArgs";
import { CreatedByUserField, EventResponses_ExpectedUserTag, VisiblePermissionField } from "./user";


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



export const getEventSegmentDateTimeRange = (segment: Prisma.EventSegmentGetPayload<{ select: { startsAt: true, durationMillis: true, isAllDay } }>) => {
    return new DateTimeRange({
        startsAtDateTime: segment.startsAt,
        durationMillis: Number(segment.durationMillis),
        isAllDay: segment.isAllDay,
    });
}


export const getEventSegmentTiming = (segment: Prisma.EventSegmentGetPayload<{ select: { startsAt: true, durationMillis: true, isAllDay } }>) => {
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
    SqlGetSpecialColumns: {
        color: "color",
        iconName: "iconName",
        label: "text",
        sortOrder: "sortOrder",
        tooltip: "description",
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
    SqlGetSpecialColumns: {
        label: "label",
        sortOrder: "sortOrder",
        color: "color",
        iconName: "iconName",
        tooltip: "description",
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
    SqlGetSpecialColumns: {
        label: "text",
        sortOrder: "sortOrder",
        color: "color",
        iconName: undefined,
        tooltip: "description",
    },
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
    refreshSerial?: number; // ignored but useful to force a refresh
    userIdForResponses?: number; // when searching for multiple events, include this to limit returned responses to this user. prevents huge bloat.
};

export interface EventSearchCustomData {
    userTags: unknown[],
};

export const xEventArgs_Base: db3.TableDesc = {
    tableName: "event",
    getInclude: (clientIntention: db3.xTableClientUsageContext, filterModel): Prisma.EventInclude => {
        return EventArgs.include;
    },
    SearchCustomDataHookId: SearchCustomDataHookId.Events,
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

            // SHOW:
            // - frontpage visible: ALWAYS
            // - OR, concerts matching date range

            const t2: Prisma.EventWhereInput = {
                OR: [
                    { frontpageVisible: true },
                    {
                        AND: [
                            { type: { significance: EventTypeSignificance.Concert } },
                            {
                                OR: [
                                    { endDateTime: { gte: minDate } },
                                    { endDateTime: null, },
                                ]
                            },
                        ]
                    }
                ],
            };
            ret.push(t2);
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

        new RevisionField({ columnName: "revision", authMap: xEventAuthMap_CreatedAt, }),

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
        new GhostField({ memberName: "calendarInputHash", authMap: xEventAuthMap_R_EAdmin }),

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







// parameterized
export const EventSearchArgs = (userId: number) => Prisma.validator<Prisma.EventDefaultArgs>()({
    include: {
        tags: true,
        // NOTE: responses will be limited to only the current user! for efficiency.
        responses: {
            where: {
                userId,
            }
        }, // instrument and isinvited are the only things we care about.
        segments: {
            include: {
                responses: {
                    where: {
                        userId,
                    }
                },
            }
        },
    },
});

// not parameterized so easier to use in types
export const EventSearchArgsNP = Prisma.validator<Prisma.EventDefaultArgs>()({
    include: {
        tags: true,
        // NOTE: responses will be limited to only the current user! for efficiency.
        responses: true, // instrument and isinvited are the only things we care about.
        segments: {
            include: {
                responses: true,
            }
        },
    },
});

export type EventSearch_Event = Prisma.EventGetPayload<typeof EventSearchArgsNP>;
export type EventSearch_EventUserResponse = Prisma.EventUserResponseGetPayload<typeof EventSearchArgsNP.include.responses>;
export type EventSearch_EventSegment = Prisma.EventSegmentGetPayload<typeof EventSearchArgsNP.include.segments>;
export type EventSearch_EventSegmentUserResponse = Prisma.EventSegmentUserResponseGetPayload<typeof EventSearchArgsNP.include.segments.include.responses>;






const xEventArgs_Search: db3.TableDesc = {
    ...xEventArgs_Base,
    tableUniqueName: "xEventArgs_Search",
    getInclude: (clientIntention: db3.xTableClientUsageContext, filterModel): Prisma.EventInclude => {
        const tableParams = filterModel.tableParams as EventTableParams;
        assert(tableParams.userIdForResponses, "when searching for events you must provide a userid to limit responses");
        return EventSearchArgs(tableParams.userIdForResponses).include;
    },
};

export const xEventSearch = new db3.xTable(xEventArgs_Search);










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
        new GenericStringField({
            columnName: "userComment",
            allowNull: true,
            allowQuickFilter: false,
            format: "markdown",
            authMap: xEventAuthMap_UserResponse,
        }),
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
        name: row.song?.name || "?",
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
export type EnrichEventInput = Partial<Prisma.EventGetPayload<{ include: { tags: true } }>>;
export type EnrichedEvent<T extends EnrichEventInput> = Omit<T, 'tags'> & Prisma.EventGetPayload<{
    select: {
        status: true,// add the fields we are treating
        type: true,
        visiblePermission: true,
        tags: {
            include: {
                eventTag: true,
            }
        }
    },
}>;

export type EnrichedSearchEventPayload = EnrichedEvent<EventSearch_Event>;

// takes a bare event and applies eventstatus, type, visiblePermission, et al
export function enrichSearchResultEvent<T extends EnrichEventInput>(
    event: T,
    data: DashboardContextDataBase,
): EnrichedEvent<T> {
    // original payload type,
    // removing items we're replacing,
    // + stuff we're adding/changing.
    return {
        ...event,
        status: data.eventStatus.getById(event.statusId),
        type: data.eventType.getById(event.typeId),
        visiblePermission: data.permission.getById(event.visiblePermissionId),
        tags: (event.tags || []).map((t) => {
            const ret = {
                ...t,
                eventTag: data.eventTag.getById(t.eventTagId)! // enrich!
            };
            return ret;
        }).sort((a, b) => a.eventTag.sortOrder - b.eventTag.sortOrder), // respect ordering
    };
}





export const EventResponses_MinimalEventUserResponseArgs = Prisma.validator<Prisma.EventUserResponseFindManyArgs>()({
    select: {
        id: true,
        instrumentId: true,
        isInvited: true,
        userComment: true,
        userId: true,
    }
});
export type EventResponses_MinimalEventUserResponse = Prisma.EventUserResponseGetPayload<typeof EventResponses_MinimalEventUserResponseArgs>;

export const EventResponses_MinimalEventSegmentUserResponseArgs = Prisma.validator<Prisma.EventSegmentUserResponseFindManyArgs>()({
    select: {
        id: true,
        attendanceId: true,
        userId: true,
    }
});
export type EventResponses_MinimalEventSegmentUserResponse = Prisma.EventSegmentUserResponseGetPayload<typeof EventResponses_MinimalEventSegmentUserResponseArgs>;



export const EventResponses_MinimalEventSegmentArgs = Prisma.validator<Prisma.EventSegmentFindManyArgs>()({
    select: {
        id: true,
        responses: true,
        name: true, // for attendance control
        startsAt: true, // for attendance control
        durationMillis: true, // for attendance control
        isAllDay: true, // for attendance control
    }
});
export type EventResponses_MinimalEventSegment = Prisma.EventSegmentGetPayload<typeof EventResponses_MinimalEventSegmentArgs>;


export type EventResponses_MinimalEvent = Prisma.EventGetPayload<{
    select: {
        id: true,
        responses: typeof EventResponses_MinimalEventUserResponseArgs,
        segments: {
            select: {
                id: true,
                responses: typeof EventResponses_MinimalEventSegmentUserResponseArgs,
            }
        }
    }
}>;

export interface EventUserResponse<TEvent extends EventResponses_MinimalEvent, TResponse extends EventResponses_MinimalEventUserResponse> {
    event: TEvent;//EventClientPayload_Verbose;
    user: UserWithInstrumentsPayload;
    response: TResponse;

    isInvited: boolean; // NB: invites & comments are per-event, not segment.

    // if the user is invited, they are relevant for display; show them.
    // if the user is not invited but has responded, show them.
    isRelevantForDisplay: boolean;

    instrument: InstrumentPayload | null;
};

export interface EventSegmentUserResponse<
    TEventSegment extends EventResponses_MinimalEventSegment,
    TSegmentResponse extends EventResponses_MinimalEventSegmentUserResponse,
> {
    segment: TEventSegment;
    user: UserWithInstrumentsPayload;
    response: TSegmentResponse;
};

////////////////////////////////////////////////////////////////

export type fn_makeMockEventSegmentResponse<TEventSegment extends EventResponses_MinimalEventSegment, TSegmentResponse extends EventResponses_MinimalEventSegmentUserResponse,> =
    (segment: TEventSegment, user: UserWithInstrumentsPayload) => TSegmentResponse | null;

export type fn_makeMockEventUserResponse<TEvent extends EventResponses_MinimalEvent, TEventResponse extends EventResponses_MinimalEventUserResponse> =
    (event: TEvent, user: UserWithInstrumentsPayload, isInvited: boolean) => TEventResponse | null;


export type UserInstrumentList = UserWithInstrumentsPayload[];

export function getUserPrimaryInstrument(user: UserWithInstrumentsPayload, data: DashboardContextDataBase): (InstrumentPayload | null) {
    if (user.instruments.length < 1) return null;
    const p = user.instruments.find(i => i.isPrimary);
    if (p) {
        return data.instrument.getById(p.instrumentId);
    }
    return data.instrument.getById(user.instruments[0]!.instrumentId);
}

export function getInstrumentForEventUserResponse<TEventResponse extends EventResponses_MinimalEventUserResponse>(response: TEventResponse, userId: number, data: DashboardContextDataBase, users: UserInstrumentList): (InstrumentPayload | null) {
    if (response.instrumentId != null) {
        return data.instrument.getById(response.instrumentId);
    }
    const ret = getUserPrimaryInstrument(users.find(u => u.id === userId)!, data);
    return ret;
};

export interface GetEventResponseForSegmentAndUserArgs<
    TEventSegment extends EventResponses_MinimalEventSegment,
    TSegmentResponse extends EventResponses_MinimalEventSegmentUserResponse,
> {
    user: UserWithInstrumentsPayload;
    segment: TEventSegment;
    expectedAttendanceTag: EventResponses_ExpectedUserTag | null;
    makeMockEventSegmentResponse: fn_makeMockEventSegmentResponse<TEventSegment, TSegmentResponse>;
};

export function createMockEventSegmentUserResponse
    <
        TEventSegment extends EventResponses_MinimalEventSegment,
        TSegmentResponse extends EventResponses_MinimalEventSegmentUserResponse,
    >(
        args: GetEventResponseForSegmentAndUserArgs<TEventSegment, TSegmentResponse>
    )
    : EventSegmentUserResponse<TEventSegment, TSegmentResponse> | null {
    let expectAttendance: boolean = false;
    if (args.expectedAttendanceTag) {
        expectAttendance = !!args.expectedAttendanceTag.userAssignments.find(ua => ua.userId === args.user.id);
    }

    // // mock response when none exists
    // const mockResponse = args.createMockResponse(args.segment, args.user) : EventResponses_MinimalEventSegmentUserResponse = {
    //     attendanceId: null,
    //     //eventSegmentId: args.segment.id,
    //     //eventSegment: args.segment,
    //     id: -1,
    //     //user: args.user,
    //     userId: args.user.id,
    // };
    const resp = args.makeMockEventSegmentResponse(args.segment, args.user);
    if (!resp) return null;

    return {
        segment: args.segment,
        user: args.user,
        response: resp,
    };
};

export interface createMockEventUserResponseArgs<TEvent extends EventResponses_MinimalEvent, TEventResponse extends EventResponses_MinimalEventUserResponse> {
    userId: number,
    event: TEvent;
    defaultInvitees: Set<number>;
    data: DashboardContextDataBase;
    users: UserInstrumentList;
    makeMockEventUserResponse: fn_makeMockEventUserResponse<TEvent, TEventResponse>;
};

export function createMockEventUserResponse<TEvent extends EventResponses_MinimalEvent, TResponse extends EventResponses_MinimalEventUserResponse>(
    args: createMockEventUserResponseArgs<TEvent, TResponse>
): EventUserResponse<TEvent, TResponse> | null {
    const invitedByDefault: boolean = args.defaultInvitees.has(args.userId);
    const user = args.users.find(u => u.id === args.userId)!;

    // mock response when none exists
    const mockResponse = args.makeMockEventUserResponse(args.event, user, invitedByDefault);
    if (!mockResponse) return null;
    //     const mockResponse: EventUserResponsePayload = {
    //         userComment: "",
    //     eventId: event.id,
    //     id: -1,
    //     user,
    //     userId: user.id,
    //     instrument: null,
    //     instrumentId: null,
    //     isInvited: invitedByDefault,
    // };

    return {
        user,
        event: args.event,
        isInvited: invitedByDefault,
        isRelevantForDisplay: invitedByDefault,
        instrument: getInstrumentForEventUserResponse(mockResponse, args.userId, args.data, args.users),
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

export function getEventSegmentResponseForSegmentAndUser<
    TEventSegment extends EventResponses_MinimalEventSegment,
    TSegmentResponse extends EventResponses_MinimalEventSegmentUserResponse,
>(args: GetEventResponseForSegmentAndUserArgs<TEventSegment, TSegmentResponse>)
    : EventSegmentUserResponse<TEventSegment, TSegmentResponse> | null {
    console.assert(!!args.segment.responses);

    let expectAttendance: boolean = false;
    if (args.expectedAttendanceTag) {
        expectAttendance = !!args.expectedAttendanceTag.userAssignments.find(ua => ua.userId === args.user.id);
    }

    const responseNullable = args.segment.responses.find(r => r.userId === args.user.id);
    if (!!responseNullable) {
        // makes the assumption that the caller has properly typed TSegmentResponse as the result of TSegment.responses[n]
        const response = responseNullable as unknown as TSegmentResponse;
        return {
            segment: args.segment,
            user: args.user,
            response,
        };
    }

    return createMockEventSegmentUserResponse(args);
};


export interface GetEventResponseForUserArgs<
    TEvent extends EventResponses_MinimalEvent,
    TEventResponse extends EventResponses_MinimalEventUserResponse
> {
    user: UserWithInstrumentsPayload;
    event: TEvent;
    defaultInvitationUserIds: Set<number>;
    data: DashboardContextDataBase;
    userMap: UserInstrumentList;
    makeMockEventUserResponse: fn_makeMockEventUserResponse<TEvent, TEventResponse>;
};


export function getEventResponseForUser<TEvent extends EventResponses_MinimalEvent,
    TEventResponse extends EventResponses_MinimalEventUserResponse
>({ event, user, defaultInvitationUserIds, data, userMap, makeMockEventUserResponse }: GetEventResponseForUserArgs<TEvent, TEventResponse>): EventUserResponse<TEvent, TEventResponse> | null {
    const response = event.responses.find(r => r.userId === user.id);
    if (response) {
        const isInvited = response.isInvited || defaultInvitationUserIds.has(user.id); // #162 default invitation overrides "uninvite"
        const instrument = getInstrumentForEventUserResponse(response, user.id, data, userMap);
        return {
            isInvited,
            event,
            user,
            instrument,
            response: response as unknown as TEventResponse, // ASSUMES TEventResponse is type of TEvent.responses[x]
            isRelevantForDisplay: false, // calculated later.
        };
    }

    return createMockEventUserResponse({ event, defaultInvitees: defaultInvitationUserIds, userId: user.id, data, users: userMap, makeMockEventUserResponse });
};




export interface EventResponseInfoBase<
    TEvent extends EventResponses_MinimalEvent,
    TEventSegment extends EventResponses_MinimalEventSegment,
    TEventResponse extends EventResponses_MinimalEventUserResponse,
    TSegmentResponse extends EventResponses_MinimalEventSegmentUserResponse,
> {
    event: TEvent;
    allEventResponses: EventUserResponse<TEvent, TEventResponse>[];
    allSegmentResponses: EventSegmentUserResponse<TEventSegment, TSegmentResponse>[];
    distinctUsers: UserWithInstrumentsPayload[];
    expectedAttendanceTag: EventResponses_ExpectedUserTag | null;
    defaultInvitationUserIds: Set<number>;

    makeMockEventSegmentResponse: fn_makeMockEventSegmentResponse<TEventSegment, TSegmentResponse>;
    makeMockEventUserResponse: fn_makeMockEventUserResponse<TEvent, TEventResponse>;

};

export class EventResponseInfo<
    TEvent extends EventResponses_MinimalEvent,
    TEventSegment extends EventResponses_MinimalEventSegment,
    TEventResponse extends EventResponses_MinimalEventUserResponse,
    TSegmentResponse extends EventResponses_MinimalEventSegmentUserResponse,
>
    implements EventResponseInfoBase<TEvent, TEventSegment, TEventResponse, TSegmentResponse> {
    event: TEvent;
    allEventResponses: EventUserResponse<TEvent, TEventResponse>[];
    allSegmentResponses: EventSegmentUserResponse<TEventSegment, TSegmentResponse>[];
    distinctUsers: UserWithInstrumentsPayload[];
    expectedAttendanceTag: EventResponses_ExpectedUserTag | null;
    defaultInvitationUserIds: Set<number>;

    makeMockEventSegmentResponse: fn_makeMockEventSegmentResponse<TEventSegment, TSegmentResponse>;
    makeMockEventUserResponse: fn_makeMockEventUserResponse<TEvent, TEventResponse>;

    constructor(args: EventResponseInfoBase<TEvent, TEventSegment, TEventResponse, TSegmentResponse>, data: DashboardContextDataBase, users: UserInstrumentList) {
        Object.assign(this, args);

        // populate calculated stuff
        this.allEventResponses.forEach(r => {
            // relevant for display = invited OR is maybe going
            const segmentResponses = this.getResponsesBySegmentForUser(r.user);
            const segmentEntries = Object.entries(segmentResponses);

            const isMaybeGoing = segmentEntries.some(e => {
                const a = data.eventAttendance.getById(e[1].response.attendanceId);
                return a && (a.strength > 0);

            });

            r.isRelevantForDisplay = isMaybeGoing || r.isInvited;
        });
    };

    // ALWAYS returns a response. if doesn't exist in the list then a mock one is created.
    getResponseForUserAndSegment({ user, segment }: { user: UserWithInstrumentsPayload, segment: TEventSegment }):
        EventSegmentUserResponse<TEventSegment, TSegmentResponse> | null {
        const f = this.allSegmentResponses.find(resp => resp.user.id === user.id && resp.segment.id === segment.id);
        if (f) return f;
        return createMockEventSegmentUserResponse({ expectedAttendanceTag: this.expectedAttendanceTag, user, segment, makeMockEventSegmentResponse: this.makeMockEventSegmentResponse });
    };

    // returns responses for all event segments
    getResponsesBySegmentForUser = (user: UserWithInstrumentsPayload): Record<number, EventSegmentUserResponse<TEventSegment, TSegmentResponse>> => {
        const ret: Record<number, EventSegmentUserResponse<TEventSegment, TSegmentResponse>> = {};
        this.event.segments.forEach(segment1 => {
            const segment = segment1 as unknown as TEventSegment; // assumes TEventSegment is type of TEvent.segment[n]
            const resp = this.getResponseForUserAndSegment({ user, segment });
            if (resp) {
                ret[segment.id] = resp;
            }
        });
        return ret;
    };

    getResponsesForSegment = (segmentId: number) => this.allSegmentResponses.filter(r => r.segment.id === segmentId);

    getEventResponseForUser = (user: UserWithInstrumentsPayload, data: DashboardContextDataBase, userMap: UserInstrumentList) => {
        const ret = this.allEventResponses.find(r => r.user.id === user.id);
        if (!ret) return createMockEventUserResponse({ event: this.event, defaultInvitees: this.defaultInvitationUserIds, data, users: userMap, userId: user.id, makeMockEventUserResponse: this.makeMockEventUserResponse });
        return ret;
    }
};



// calculate responses for each user who is invited OR has a response.
// requires verbose view of event
interface EventResponsesPerUserArgs<
    TEvent extends EventResponses_MinimalEvent,
    TEventResponse extends EventResponses_MinimalEventUserResponse,
    TEventSegment extends EventResponses_MinimalEventSegment,
    TSegmentResponse extends EventResponses_MinimalEventSegmentUserResponse,
> {
    event: TEvent;
    expectedAttendanceTag: EventResponses_ExpectedUserTag | null;
    data: DashboardContextDataBase;
    userMap: UserInstrumentList;

    makeMockEventSegmentResponse: fn_makeMockEventSegmentResponse<TEventSegment, TSegmentResponse>;
    makeMockEventUserResponse: fn_makeMockEventUserResponse<TEvent, TEventResponse>;

};

// returns array of response info per user. so each element has unique user.
export function GetEventResponseInfo<
    TEvent extends EventResponses_MinimalEvent,
    TEventSegment extends EventResponses_MinimalEventSegment,
    TEventResponse extends EventResponses_MinimalEventUserResponse,
    TSegmentResponse extends EventResponses_MinimalEventSegmentUserResponse,
>
    ({ event, expectedAttendanceTag, data, userMap, makeMockEventSegmentResponse, makeMockEventUserResponse }: EventResponsesPerUserArgs<TEvent, TEventResponse, TEventSegment, TSegmentResponse>
    ):
    (null | EventResponseInfo<TEvent, TEventSegment, TEventResponse, TSegmentResponse>) {
    if (!event.segments) return null; // limited users don't see segments.

    let defaultInvitationUserIds = new Set<number>();

    // calculate a list of potentially relevant users to all segments of the event.
    const users: UserWithInstrumentsPayload[] = [];
    if (expectedAttendanceTag) {
        defaultInvitationUserIds = new Set<number>(expectedAttendanceTag.userAssignments.map(ua => ua.userId));
        expectedAttendanceTag.userAssignments.forEach(ua => {
            const user = userMap.find(u => u.id === ua.userId);
            if (user) {
                users.push(user);
            }
        });
    }
    event.segments.forEach((seg) => {
        // get user ids for this segment
        seg.responses.forEach(resp => {
            if (users.find(u => u.id === resp.userId) == null) { // doesn't already exist
                const mapUser = userMap.find(u => u.id === resp.userId);
                if (!mapUser) {
                    // console.log(`resp.userId=${resp.userId}`);
                    // console.log(userMap);
                    // throw new Error("your user map is missing someone. check console for requested user, and usermap");
                } else {
                    users.push(mapUser);
                }
            }
        });
    });
    event.responses.forEach((eventResponse) => {
        // if (users.find(u => u.id === eventResponse.userId) == null) {
        //     users.push(userMap.find(u => u.id === eventResponse.userId)!);
        // }
        if (users.find((u) => {
            //if (!u) debugger;
            return u.id === eventResponse.userId;
        }) == null) {
            const mappedUser = userMap.find(u => u.id === eventResponse.userId);
            if (!mappedUser) {
                // console.log(`resp.userId=${eventResponse.userId}`);
                // console.log(userMap);
                // throw new Error("your user map is missing someone. check console for requested user, and usermap");
            } else {
                users.push(mappedUser);
            }
        }
    });

    const allSegmentResponses: EventSegmentUserResponse<TEventSegment, TSegmentResponse>[] = [];
    // for each segment, for all users, generate a response.
    for (let iseg = 0; iseg < event.segments.length; ++iseg) {
        const segment = event.segments[iseg]!;
        const segAsT = segment as unknown as TEventSegment; // type assumption

        users.forEach(user => {
            const resp = getEventSegmentResponseForSegmentAndUser({
                user,
                segment: segAsT,
                expectedAttendanceTag,
                makeMockEventSegmentResponse,
            });
            if (resp) {
                allSegmentResponses.push(resp);
            }
        });

    }

    const allEventResponses: EventUserResponse<TEvent, TEventResponse>[] = [];

    users.forEach(user => {
        const resp = getEventResponseForUser({
            user,
            event,
            defaultInvitationUserIds,
            data,
            makeMockEventUserResponse,
            userMap,
        });
        if (resp) allEventResponses.push(resp);
    });

    return new EventResponseInfo({
        event,
        defaultInvitationUserIds,
        expectedAttendanceTag,
        distinctUsers: users,
        allSegmentResponses,
        allEventResponses,
        makeMockEventSegmentResponse,
        makeMockEventUserResponse,
    }, data, userMap);

};
