// TODO: permissions for actions like these needs to be done in a different way.
// for example i should be able to edit my own posts but not others. etc.
// or think about the concept of user blocking, or not being able to see responses of certain kinds of events or people. todo...

import db, { Prisma } from "db";
import { ColorPalette, ColorPaletteEntry, gGeneralPaletteList } from "shared/color";
import { Permission } from "shared/permissions";
import { CoerceToNumberOrNull, Date_MAX_VALUE, KeysOf, TAnyModel, assertIsNumberArray, gIconOptions } from "shared/utils";
import * as db3 from "../db3core";
import { ColorField, ConstEnumStringField, ForeignSingleField, GenericIntegerField, GenericStringField, BoolField, PKField, TagsField, DateTimeField, MakePlainTextField, MakeMarkdownTextField, MakeSortOrderField, MakeColorField, MakeSignificanceField, MakeIntegerField, MakeSlugField, MakeTitleField, MakeCreatedAtField, MakeIconField } from "../db3basicFields";
import { CreatedByUserField, VisiblePermissionField, xPermission, xUser } from "./user";
import { xSong } from "./song";
import { InstrumentArgs, InstrumentPayload, UserArgs, UserPayload, getUserPrimaryInstrument, xInstrument } from "./instrument";

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


////////////////////////////////////////////////////////////////

export const EventSongListSongNaturalOrderBy: Prisma.EventSongListSongOrderByWithRelationInput[] = [
    { sortOrder: 'desc' },
    { id: 'asc' },
];


const EventSongListArgs = Prisma.validator<Prisma.EventSongListArgs>()({
    include: {
        event: true,
        visiblePermission: true,
        songs: {
            include: {
                song: {
                    include: {
                        visiblePermission: true,
                    }
                }
            }
        }
    },
});

export type EventSongListPayload = Prisma.EventSongListGetPayload<typeof EventSongListArgs>;

export const EventSongListNaturalOrderBy: Prisma.EventSongListOrderByWithRelationInput[] = [
    { sortOrder: 'desc' },
    { id: 'asc' },
];


////////////////////////////////////////////////////////////////
const EventSongListSongArgs = Prisma.validator<Prisma.EventSongListSongArgs>()({
    include: {
        song: true,
    }
});

//export type EventSongListSongPayload = Prisma.EventSongListSongGetPayload<typeof EventSongListSongArgs>;
export type EventSongListSongPayload = Prisma.EventSongListSongGetPayload<typeof EventSongListSongArgs>;


////////////////////////////////////////////////////////////////
export const EventTypeSignificance = {
    Concert: "Concert",
    Rehearsal: "Rehearsal",
    Weekend: "Weekend",
} as const satisfies Record<string, string>;

const EventTypeInclude: Prisma.EventTypeInclude = {
    events: true,
};

export type EventTypePayload = Prisma.EventTypeGetPayload<{}>;

export const EventTypeNaturalOrderBy: Prisma.EventTypeOrderByWithRelationInput[] = [
    { text: 'asc' },
    { id: 'asc' },
];


////////////////////////////////////////////////////////////////
const EventSegmentUserResponseArgs = Prisma.validator<Prisma.EventSegmentUserResponseArgs>()({
    include: {
        attendance: true,
        eventSegment: true,
        instrument: InstrumentArgs,
        user: UserArgs
    }
});

export type EventSegmentUserResponsePayload = Prisma.EventSegmentUserResponseGetPayload<{
    include: typeof EventSegmentUserResponseArgs.include
}>;



////////////////////////////////////////////////////////////////
export const EventSegmentArgs = Prisma.validator<Prisma.EventSegmentArgs>()({
    //orderBy: { startsAt: "desc" },
    include: {
        event: true,
        responses: EventSegmentUserResponseArgs,
    }
});

export type EventSegmentPayload = Prisma.EventSegmentGetPayload<typeof EventSegmentArgs>;

////////////////////////////////////////////////////////////////
export const EventCommentArgs = Prisma.validator<Prisma.EventCommentArgs>()({
    include: {
        event: true,
        user: true,
        visiblePermission: true,
    }
});

export type EventCommentPayload = Prisma.EventCommentGetPayload<typeof EventCommentArgs>;

export const IsEarlierDateWithLateNull = (a: Date | null, b: Date | null) => {
    if (a === null) {
        return false;// a is null; b must be earlier.
    }
    if (b === null) {
        return true; // b null; a must be earlier.
    }
    return a < b; // no nulls; return earliest date.
}

export const MinDateOrLateNull = (a: Date | null, b: Date | null) => {
    if (a === null) {
        if (b === null) {
            return null; // both null; forced null return.
        }
        return b;// a is null; b must be earlier.
    }
    if (b === null) {
        return a; // b null; a must be earlier.
    }
    return a < b ? a : b; // no nulls; return earliest date.
}

export const getEventSegmentMinDate = (event: EventPayload) => {
    return event.segments.reduce((acc, seg) => {
        // we want NULLs to count as maximum. The idea is that the date is not "yet" determined.
        const thisSegmentMinDate = MinDateOrLateNull(seg.startsAt, seg.endsAt);
        return MinDateOrLateNull(acc, thisSegmentMinDate);
    }, null);
};



////////////////////////////////////////////////////////////////

export const xEventType = new db3.xTable({
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
    getParameterizedWhereClause: (params, clientIntention): Prisma.EventTypeWhereInput[] => {
        if (clientIntention.intention === "user") {
            return [{
                isDeleted: { equals: false }
            }];
        }
        return [];
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
    Cancelled: "Cancelled",
} as const satisfies Record<string, string>;

export const xEventStatus = new db3.xTable({
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
        };
    },
    getRowInfo: (row: EventStatusPayload) => ({
        name: row.label,
        description: row.description,
        color: gGeneralPaletteList.findEntry(row.color),
    }),
    getParameterizedWhereClause: (params, clientIntention): Prisma.EventStatusWhereInput[] => {
        if (clientIntention.intention === "user") {
            return [{
                isDeleted: { equals: false }
            }];
        }
        return [];
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

export const xEventTag = new db3.xTable({
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
export const xEventTagAssignment = new db3.xTable({
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
export type EventPayloadMinimum = Prisma.EventGetPayload<{}>;
export type EventPayloadWithVisiblePermission = Prisma.EventGetPayload<{
    include: {
        visiblePermission: true,
    }
}>;

const EventArgs = Prisma.validator<Prisma.EventArgs>()({
    include: {
        visiblePermission: true,
        status: true,
        tags: {
            orderBy: EventTagAssignmentNaturalOrderBy,
            include: {
                eventTag: true,
            }
        },
        type: true,
        segments: {
            orderBy: { startsAt: "desc" },
            include: {
                responses: {
                    include: {
                        instrument: true,
                        user: true,
                    }
                }
            },
        },
    },
});


export type EventPayload = Prisma.EventGetPayload<typeof EventArgs>;

export interface DateRangeInfo {
    formattedDateRange: string;
    formattedYear: string;
};
export interface EventClientPayloadExtras {
    dateRangeInfo: DateRangeInfo;
};
export type EventPayloadClient = EventPayload & EventClientPayloadExtras;

export const EventNaturalOrderBy: Prisma.EventOrderByWithRelationInput[] = [
    // while you can order by relation (ex orderByRelation): https://github.com/prisma/prisma/issues/5008
    // you can't do aggregations; for us sorting by soonest segment date would require a min() aggregation. https://stackoverflow.com/questions/67930989/prisma-order-by-relation-has-only-count-property-can-not-order-by-relation-fie
    { id: 'desc' }, // TODO: we should find a way to order by segment! can be done in SQL but not prisma afaik. ordering can just be done in code.
];

export interface DateRange {
    startsAt: Date | null,
    endsAt: Date | null,
}

function formatDate(date: Date): string {
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
    return date.toLocaleDateString(undefined, options);
}


function getDateRangeInfo(dateRange: DateRange): DateRangeInfo {
    if (!dateRange.startsAt) {
        if (!dateRange.endsAt) {
            return { formattedDateRange: "Date TBD", formattedYear: "TBD" };
        }
        return { formattedDateRange: `Until ${formatDate(dateRange.endsAt!)}`, formattedYear: `${dateRange.endsAt!.getFullYear()}` };
    }
    if (!dateRange.endsAt) {
        return { formattedDateRange: `From ${formatDate(dateRange.startsAt!)}`, formattedYear: `${dateRange.startsAt!.getFullYear()}` };
    }
    if (dateRange.startsAt.toDateString() === dateRange.endsAt.toDateString()) {
        return { formattedDateRange: formatDate(dateRange.startsAt), formattedYear: `${dateRange.startsAt.getFullYear()}` };
    }

    // todo: when components are the same, unify.
    // so instead of 
    // 11 July 2023 - 12 July 2023
    // just do 11-12 July 2023.
    return { formattedDateRange: `${formatDate(dateRange.startsAt)} - ${formatDate(dateRange.endsAt)}`, formattedYear: `${dateRange.startsAt.getFullYear()}` };
}

export class CalculatedEventDateRangeField extends db3.FieldBase<DateRange> {
    constructor() {
        super({
            member: "dateRange",
            fieldTableAssociation: "calculated",
            defaultValue: { startsAt: null, endsAt: null },
            label: "Date range",
        });
    }

    connectToTable = (table: db3.xTable) => { };

    // prevent from sending to mutations by saying it's always the same.
    isEqual = (a: DateRange, b: DateRange) => {
        return true;
    };

    getQuickFilterWhereClause = (query: string): TAnyModel | boolean => false;
    getCustomFilterWhereClause = (query) => false;
    getOverallWhereClause = (clientIntention: db3.xTableClientUsageContext): TAnyModel | boolean => false;

    ApplyClientToDb = (clientModel: TAnyModel, mutationModel: TAnyModel, mode: db3.DB3RowMode) => { };

    ApplyToNewRow = (args: TAnyModel, clientIntention: db3.xTableClientUsageContext) => {
        args[this.member] = this.defaultValue;
    };

    ValidateAndParse = (val: db3.ValidateAndParseArgs<DateRange>): db3.ValidateAndParseResult<DateRange | null> => {
        return db3.SuccessfulValidateAndParseResult(val.value);
    };

    ApplyDbToClient = (dbModel: EventPayload, clientModel: TAnyModel, mode: db3.DB3RowMode) => {
        const ret: DateRange = { startsAt: null, endsAt: null };
        if (!dbModel.segments) return;
        dbModel.segments.forEach(seg => {
            console.assert(seg.startsAt !== undefined);
            console.assert(seg.endsAt !== undefined);
            if (seg.startsAt !== null) {
                if (ret.startsAt === null || (seg.startsAt < ret.startsAt)) {
                    ret.startsAt = seg.startsAt;
                }
            }
            if (seg.endsAt !== null) {
                if (ret.endsAt === null || (seg.endsAt > ret.endsAt)) {
                    ret.endsAt = seg.endsAt;
                }
            }
        });
        clientModel[this.member] = ret;
        clientModel.dateRangeInfo = getDateRangeInfo(ret);
    }
};



// when an event segment is fetched from an event, this is the payload type
export type EventSegmentPayloadFromEvent = Prisma.EventSegmentGetPayload<{
    include: {
        responses: {
            include: {
                attendance: true,
                user: true,
                instrument: typeof InstrumentArgs,
            }
        },
    }
}>;

const xEventArgs_Base: db3.TableDesc = {
    tableName: "event",
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    localInclude: EventArgs.include,
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

        if (clientIntention.intention === "user") {
            // apply soft delete
            ret.push({ isDeleted: { equals: false } });
        }

        db3.ApplyVisibilityWhereClause(ret, clientIntention, "createdByUserId");
        return ret;
    },
    clientLessThan: (a: EventPayload, b: EventPayload) => {
        // `!`, because we want desc (late dates first)
        return !IsEarlierDateWithLateNull(getEventSegmentMinDate(a), getEventSegmentMinDate(b));
    },
    columns: [
        new PKField({ columnName: "id" }),
        MakeTitleField("name"),
        MakeSlugField("slug", "name"),
        MakeMarkdownTextField("description"),
        new BoolField({ columnName: "isDeleted", defaultValue: false }),
        MakePlainTextField("locationDescription"),
        MakePlainTextField("locationURL"),
        new CalculatedEventDateRangeField(),
        MakeCreatedAtField("createdAt"),
        new ForeignSingleField<Prisma.EventTypeGetPayload<{}>>({
            columnName: "type",
            fkMember: "typeId",
            allowNull: true,
            foreignTableSpec: xEventType,
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
        }),
    ]
};

export const xEvent = new db3.xTable(xEventArgs_Base);

// all info that will appear on an event detail page
const EventArgs_Verbose = Prisma.validator<Prisma.EventArgs>()({
    include: {
        status: true,
        visiblePermission: true,
        songLists: EventSongListArgs,
        tags: {
            orderBy: EventTagAssignmentNaturalOrderBy,
            include: {
                eventTag: true,
            }
        },
        type: true,
        comments: EventCommentArgs,
        fileTags: {
            include: {
                file: true,
            }
        },
        segments: {
            orderBy: { startsAt: "desc" },
            include: EventSegmentArgs.include,
        },
    }
});

const xEventArgs_Verbose: db3.TableDesc = {
    ...xEventArgs_Base,
    localInclude: EventArgs_Verbose.include,
};

export type EventClientPayload_Verbose = EventClientPayloadExtras & Prisma.EventGetPayload<typeof EventArgs_Verbose>;

export const xEventVerbose = new db3.xTable(xEventArgs_Verbose);



export const EventSegmentNaturalOrderBy: Prisma.EventSegmentOrderByWithRelationInput[] = [
    { startsAt: "asc" },
    { id: "asc" },
];

export const xEventSegment = new db3.xTable({
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    localInclude: EventSegmentArgs.include,
    tableName: "eventSegment",
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




export const EventCommentNaturalOrderBy: Prisma.EventCommentOrderByWithRelationInput[] = [
    { createdAt: "asc" },
    { id: "asc" },
];

export const xEventComment = new db3.xTable({
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    localInclude: EventCommentArgs.include,
    tableName: "eventComment",
    naturalOrderBy: EventCommentNaturalOrderBy,
    getRowInfo: (row: EventCommentPayload) => ({
        name: "<not supported>",
    }),
    getParameterizedWhereClause: (params: TAnyModel, clientIntention: db3.xTableClientUsageContext): (Prisma.EventCommentWhereInput[] | false) => {
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
        new VisiblePermissionField({
            columnName: "visiblePermission",
            fkMember: "visiblePermissionId",
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

// when you don't need responses just use this
export type EventAttendanceBasePayload = Prisma.EventAttendanceGetPayload<{}>;

export const EventAttendanceNaturalOrderBy: Prisma.EventAttendanceOrderByWithRelationInput[] = [
    { sortOrder: 'desc' },
    { text: 'asc' },
    { id: 'asc' },
];

export const xEventAttendance = new db3.xTable({
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
    getParameterizedWhereClause: (params, clientIntention): Prisma.EventTypeWhereInput[] => {
        if (clientIntention.intention === "user") {
            return [{
                isDeleted: { equals: false }
            }];
        }
        return [];
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




export const EventSegmentUserResponseNaturalOrderBy: Prisma.EventSegmentUserResponseOrderByWithRelationInput[] = [
    // todo: sort by something else?
    { id: 'asc' },
];

export const xEventSegmentUserResponse = new db3.xTable({
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    localInclude: EventSegmentUserResponseArgs.include,
    tableName: "eventSegmentUserResponse",
    naturalOrderBy: EventSegmentUserResponseNaturalOrderBy,
    getRowInfo: (row: EventSegmentUserResponsePayload) => ({
        name: row.user.compactName,
    }),
    getParameterizedWhereClause: (params: TAnyModel, clientIntention: db3.xTableClientUsageContext): (Prisma.EventSegmentUserResponseWhereInput[] | false) => {
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
        new ForeignSingleField<Prisma.InstrumentGetPayload<{}>>({
            columnName: "instrument",
            fkMember: "instrumentId",
            allowNull: true,
            foreignTableSpec: xInstrument,
            getQuickFilterWhereClause: (query: string) => false,
        }),
    ]
});







export const xEventSongList = new db3.xTable({
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    localInclude: EventSongListArgs.include,
    tableName: "eventSongList",
    naturalOrderBy: EventSongListNaturalOrderBy,
    getRowInfo: (row: EventSongListPayload) => ({
        name: row.name,
        description: row.description,
    }),
    getParameterizedWhereClause: (params: TAnyModel, clientIntention: db3.xTableClientUsageContext): (Prisma.EventSongListWhereInput[] | false) => {
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
        new CreatedByUserField({
            columnName: "createdByUser",
            fkMember: "createdByUserId",
        }),
        new VisiblePermissionField({
            columnName: "visiblePermission",
            fkMember: "visiblePermissionId",
        }),
    ]
});



export const xEventSongListSong = new db3.xTable({
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    localInclude: EventSongListSongArgs.include,
    tableName: "eventSongListSong",
    naturalOrderBy: EventSongListSongNaturalOrderBy,
    getRowInfo: (row: EventSongListSongPayload) => ({
        name: row.song.name,
        description: row.subtitle || "",
    }),
    getParameterizedWhereClause: (params: TAnyModel, clientIntention: db3.xTableClientUsageContext): (Prisma.EventSongListSongWhereInput[] | false) => {
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


////////////////////////////////////////////////////////////////
// by the time the data reaches the UX, ideally it should be a rich object with methods, calculated fields etc.
// unfortunately we're not there yet. helper functions like this exist.
export interface CalculateEventInfoForUserArgs {
    user: UserPayload;
    event: EventPayloadClient;
}

export interface SegmentAndResponse {
    event: EventPayloadClient;
    segment: EventSegmentPayloadFromEvent;
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
    event: EventPayloadClient;
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
                    response: response as EventSegmentUserResponsePayload,
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
                user: this.user as any,
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

