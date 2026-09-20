// TODO: permissions for actions like these needs to be done in a different way.
// for example i should be able to edit my own posts but not others. etc.
// or think about the concept of user blocking, or not being able to see responses of certain kinds of events or people. todo...

import { TAnyModel } from "@/shared/rootroot";
import { gGeneralPaletteList } from "@/src/core/components/color/palette";
import { assert } from "blitz";
import { Prisma } from "db";
import { assertIsNumberArray, assertIsStringArray } from "shared/arrayUtils";
import { Permission } from "shared/permissions";
import { DateTimeRange } from "shared/time";
import { CoalesceBool, gIconOptions, smartTruncate } from "shared/utils";
import { type CMDBTableFilterModel } from "../apiTypes";
import { BoolField, ConstEnumStringField, EventStartsAtField, ForeignCollectionField, ForeignSingleField, GenericIntegerField, GhostField, MakeColorField, MakeCreatedAtField, MakeIconField, MakeIntegerField, MakeIsDeletedField, MakePKfield, MakeSignificanceField, MakeSortOrderField, MakeUpdatedAtField, RevisionField, TagsField } from "../db3basicFields";
import * as db3 from "../db3core";
import { GenericStringField, MakeDescriptionField, MakeMarkdownTextField, MakeNullableRawTextField, MakePlainTextField, MakeRawTextField, MakeTitleField } from "../genericStringField";
import {
    EventArgs, EventArgs_Verbose, EventAttendanceArgs, EventAttendanceNaturalOrderBy, type EventAttendancePayload,
    EventNaturalOrderBy, type EventPayload, type EventPayloadClient,
    EventSegmentArgs, EventSegmentBehavior, EventSegmentNaturalOrderBy, type EventSegmentPayload,
    EventSegmentUserResponseArgs, EventSegmentUserResponseNaturalOrderBy,
    type EventSegmentUserResponsePayload, EventSongListArgs, EventSongListDividerArgs, type EventSongListDividerPayload, EventSongListDividerTextStyle, EventSongListNaturalOrderBy, type EventSongListPayload, EventSongListSongArgs, EventSongListSongNaturalOrderBy,
    type EventSongListSongPayload, EventStatusArgs, EventStatusNaturalOrderBy, type EventStatusPayload, EventStatusSignificance, EventTagArgs, EventTagAssignmentArgs,
    EventTagAssignmentNaturalOrderBy, type EventTagAssignmentPayload, EventTagNaturalOrderBy, type EventTagPayload, EventTagSignificance, type EventTaggedFilesPayload,
    EventTypeArgs, EventTypeNaturalOrderBy, type EventTypePayload, EventTypeSignificance, EventUserResponseArgs, EventUserResponseNaturalOrderBy,
    type EventUserResponsePayload,
    type InstrumentClientOrDbPayload,
    type UserWithInstrumentsPayload
} from "./prismArgs";
import { MakeCreatedByField, MakeUpdatedByField, MakeVisiblePermissionField } from "./user";


export const xEventAuthMap_UserResponse: db3.DB3AuthContextPermissionMap = {
    PostQueryAsOwner: Permission.view_events_nonpublic,
    PostQuery: Permission.view_events_nonpublic,
    PreMutateAsOwner: Permission.respond_to_events,
    PreMutate: Permission.change_others_event_responses,
    // Generic inserts accept an arbitrary userId, so only the explicit
    // cross-user capability may use that path. Self-service insertion goes
    // through updateUserEventAttendanceMutation, which binds the actor itself.
    PreInsert: Permission.change_others_event_responses,
};

export const xEventAuthMap_UserResponseRelation: db3.DB3AuthContextPermissionMap = {
    PostQueryAsOwner: Permission.view_events_nonpublic,
    PostQuery: Permission.view_events_nonpublic,
    // An owner must not be able to authorize changing the user or parent event
    // merely because the persisted response currently belongs to them.
    PreMutateAsOwner: Permission.change_others_event_responses,
    PreMutate: Permission.change_others_event_responses,
    PreInsert: Permission.change_others_event_responses,
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
    Edit: Permission.change_others_event_responses,
    Insert: Permission.change_others_event_responses,
};



export const getEventSegmentDateTimeRange = (segment: Prisma.EventSegmentGetPayload<{ select: { startsAt: true, durationMillis: true, isAllDay } }>
    //& { dateTimeVersion?: number }
) => {
    // if (segment.dateTimeVersion !== undefined && segment.dateTimeVersion !== 2) {
    //     throw new Error("Event dates require migration. Run scripts/migrate-event-utc-spans.cjs before serving this database.");
    // }
    return new DateTimeRange({
        startsAtDateTime: segment.startsAt,
        durationMillis: Number(segment.durationMillis),
        isAllDay: segment.isAllDay,
    });
}

export const getEventDateTimeRangeFromSegments = (
    segments: { startsAt: Date | null; durationMillis: bigint; isAllDay: boolean; statusId: number | null }[],
    cancelledStatusIds: number[],
) => {
    const ranges = segments
        .filter(segment => !segment.statusId || !cancelledStatusIds.includes(segment.statusId))
        .map(getEventSegmentDateTimeRange);
    return DateTimeRange.union(ranges);
};


// Aggregates enclose the exact UTC bounds of every uncancelled segment.
export function getEventDateBoundsFromSegments(
    segments: Parameters<typeof getEventDateTimeRangeFromSegments>[0], cancelledStatusIds: number[],
) {
    const range = getEventDateTimeRangeFromSegments(segments, cancelledStatusIds);
    const spec = range.getSpec();
    return {
        startsAt: spec.startsAtDateTime, durationMillis: spec.durationMillis, isAllDay: spec.isAllDay,
        endDateTime: range.getBounds()?.end ?? null
    };
}

// export const getEventSegmentTiming = (segment: Prisma.EventSegmentGetPayload<{ select: { startsAt: true, durationMillis: true, isAllDay } }>, now: Date) => {
//     const r = getEventSegmentDateTimeRange(segment);
//     return r.hitTestDateTime(now);
// }


export const getEventSegmentMinDate = (event: EventPayload): Date | null => {
    return DateTimeRange.union(event.segments.map(getEventSegmentDateTimeRange)).getStartDateTime();
};

export const xEventType = new db3.xTable({
    getSelectionArgs: (): Prisma.EventTypeDefaultArgs => {
        return EventTypeArgs;
    },
    tableName: "EventType",
    deletePolicy: "softOnly",
    viewDeletedPermission: Permission.recover_events,
    restorePermission: Permission.recover_events,
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
        pk: row.id,
        name: row.text,
        description: row.description,
        color: gGeneralPaletteList.findEntry(row.color),
        ownerUserId: null,
    }),
    columns: [
        MakePKfield(),
        MakeIsDeletedField({ authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeTitleField("text", { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeDescriptionField({ authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeSortOrderField({ authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeColorField({ authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeSignificanceField("significance", EventTypeSignificance, { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeIconField("iconName", gIconOptions, { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        new GhostField({ memberName: "events", authMap: xEventAuthMap_R_EOwn_EManagers }),
    ]
});


////////////////////////////////////////////////////////////////


export const xEventStatus = new db3.xTable({
    getSelectionArgs: (): Prisma.EventStatusDefaultArgs => {
        return EventStatusArgs;
    },
    tableName: "EventStatus",
    // persisted status is valid even if it's isDeleted=true.
    // soft delete really means "don't show in option lists"
    deletePolicy: "softOnly",
    viewDeletedPermission: Permission.recover_events,
    restorePermission: Permission.recover_events,
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
        pk: row.id,
        name: row.label,
        description: row.description,
        color: gGeneralPaletteList.findEntry(row.color),
        ownerUserId: null,
    }),
    columns: [
        MakePKfield(),
        MakeIsDeletedField({ authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeTitleField("label", { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeDescriptionField({ authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeSortOrderField({ authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeColorField({ authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeSignificanceField("significance", EventStatusSignificance, { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeIconField("iconName", gIconOptions, { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        new GhostField({ memberName: "events", authMap: xEventAuthMap_R_EOwn_EManagers }),
        new GhostField({ memberName: "eventSegments", authMap: xEventAuthMap_R_EOwn_EManagers }),
    ]
});


////////////////////////////////////////////////////////////////

export const xEventTag = new db3.xTable({
    tableName: "EventTag",
    deletePolicy: "hard",
    getSelectionArgs: (): Prisma.EventTagDefaultArgs => {
        return EventTagArgs;
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
        pk: row.id,
        name: row.text,
        description: row.description,
        color: gGeneralPaletteList.findEntry(row.color),
        ownerUserId: null,
    }),
    columns: [
        MakePKfield(),
        MakeTitleField("text", { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        new BoolField({ columnName: "visibleOnFrontpage", defaultValue: false, authMap: xEventAuthMap_Homepage, allowNull: false }),
        MakeDescriptionField({ authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeSortOrderField({ authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeColorField({ authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeSignificanceField("significance", EventTagSignificance, { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        new GhostField({ memberName: "events", authMap: xEventAuthMap_R_EOwn_EManagers }),
    ]
});



////////////////////////////////////////////////////////////////

export const xEventTagAssignment = new db3.xTable({
    tableName: "EventTagAssignment",
    deletePolicy: "hard",
    naturalOrderBy: EventTagAssignmentNaturalOrderBy,
    tableAuthMap: xEventTableAuthMap_R_EManagers,
    getSelectionArgs: (): Prisma.EventTagAssignmentDefaultArgs => {
        return EventTagAssignmentArgs;
    },
    getRowInfo: (row: EventTagAssignmentPayload) => {
        return {
            pk: row.id,
            name: row.eventTag?.text || "",
            description: row.eventTag?.description || "",
            color: gGeneralPaletteList.findEntry(row.eventTag?.color || null),
            ownerUserId: null,
        };
    },
    columns: [
        MakePKfield(),
        new ForeignSingleField<Prisma.EventTagGetPayload<{}>>({
            columnName: "eventTag",
            fkidMember: "eventTagId",
            allowNull: false,
            foreignTableID: "EventTag",
            authMap: xEventAuthMap_R_EOwn_EManagers,
            getQuickFilterWhereClause: (query: string) => false,
        }),
    ]
});




////////////////////////////////////////////////////////////////

export interface EventTableParams {
    eventId?: number;
    eventIds?: number[];
    eventUids?: string[];
    eventTypeIds?: number[];
    eventStatusIds?: number[];
    minDate?: Date;
    forFrontPageAgenda?: boolean; // returns future + recent events + any event that's showing on front page
    refreshSerial?: number; // ignored but useful to force a refresh
    limitResponsesToActor?: boolean;
};

const EventQueryParameters = {
    eventId: { kind: "integer", authorizeAs: "id" },
    eventIds: { kind: "integerArray", authorizeAs: "id" },
    eventUids: { kind: "stringArray", authorizeAs: "uid" },
    eventTypeIds: { kind: "integerArray", authorizeAs: "typeId" },
    eventStatusIds: { kind: "integerArray", authorizeAs: "statusId" },
    minDate: { kind: "date", authorizeAs: "endDateTime" },
    forFrontPageAgenda: { kind: "boolean", authorizeAs: ["frontpageVisible", "typeId", "endDateTime"] },
    refreshSerial: { kind: "integer", authorizeAs: null },
    limitResponsesToActor: { kind: "boolean", authorizeAs: "responses" },
} satisfies db3.DB3QueryParameterMap;

export type UserTagWithAssignmentPayload = Prisma.UserTagGetPayload<{
    select: {
        id: true,
        userAssignments: {
            select: {
                userId: true,
            }
        }
    }
}>;

export const EventAPI = {
    getLabel: ({ name = "", startsAt }: Prisma.EventGetPayload<{ select: { startsAt: true, name: true } }>, options?: {
        truncate?: boolean, // default true
        truncateLength?: number, // default 20
        showDate?: boolean, // default true
    }) => {
        const truncatedName = options?.truncate !== false ? smartTruncate(name, options?.truncateLength || 20) : name;
        const showDate = CoalesceBool(options?.showDate, true);
        if (!showDate) {
            return truncatedName;
        }
        return `${truncatedName} (${startsAt ? startsAt.toLocaleDateString() : "TBD"})`;
    }
};


export const xEventArgs_Base: db3.TableDesc = {
    // modifying an event means multiple related changes; see the mutation event hooks.
    tableName: "Event", // case matters :(
    deletePolicy: "softOnly",
    viewDeletedPermission: Permission.recover_events,
    restorePermission: Permission.recover_events,
    queryParameters: EventQueryParameters,
    getSelectionArgs: (filterModel): Prisma.EventDefaultArgs => {
        return EventArgs;
    },
    tableAuthMap: xEventTableAuthMap_R_EManagers,
    naturalOrderBy: EventNaturalOrderBy,
    getRowInfo: (row: EventPayloadClient) => ({
        pk: row.id,
        name: EventAPI.getLabel(row),
        color: gGeneralPaletteList.findEntry(row.type?.color || null),
        ownerUserId: row.createdByUserId,
    }),

    getParameterizedWhereClause: (params: EventTableParams): (Prisma.EventWhereInput[]) => {
        const ret: Prisma.EventWhereInput[] = [];

        if (params.eventId !== undefined) {
            //console.assert(params.eventSlug === undefined);
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
        // if (params.eventSlug !== undefined) {
        //     console.assert(params.eventId === undefined);
        //     ret.push({ slug: params.eventSlug });
        // }
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
    columns: [
        MakePKfield(),
        MakeTitleField("name", { authMap: xEventAuthMap_Homepage, }),
        MakeIsDeletedField({ authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakePlainTextField("locationDescription", { authMap: xEventAuthMap_Homepage, }),
        MakeVisiblePermissionField({ authMap: xEventAuthMap_R_EOwn_EManagers }),
        MakeCreatedAtField(),
        MakeCreatedByField(),
        MakeUpdatedAtField(),
        MakeUpdatedByField(),

        new GenericStringField({
            columnName: "locationURL",
            allowNull: false,
            format: "plain",
            allowQuickFilter: false,
            authMap: xEventAuthMap_Homepage,
        }),

        new RevisionField({ columnName: "revision", authMap: xEventAuthMap_CreatedAt, applyToUpdates: false }),

        new GenericIntegerField({
            columnName: "relevanceClassOverride",
            allowNull: true,
            authMap: xEventAuthMap_R_EOwn_EManagers,
        }),
        new ConstEnumStringField({
            columnName: "segmentBehavior",
            allowNull: true,
            defaultValue: EventSegmentBehavior.Sets,
            options: EventSegmentBehavior,
            authMap: xEventAuthMap_R_EOwn_EManagers,
        }),
        new ForeignSingleField<Prisma.EventTypeGetPayload<{}>>({
            columnName: "type",
            fkidMember: "typeId",
            allowNull: true,
            foreignTableID: "EventType",
            authMap: xEventAuthMap_R_EOwn_EManagers,
            getQuickFilterWhereClause: (query: string) => false,
        }),
        new ForeignSingleField<Prisma.EventStatusGetPayload<{}>>({
            columnName: "status",
            fkidMember: "statusId",
            allowNull: true,
            foreignTableID: "EventStatus",
            authMap: xEventAuthMap_R_EOwn_EManagers,
            getQuickFilterWhereClause: (query: string) => false,
        }),
        new ForeignSingleField<Prisma.UserTagGetPayload<{}>>({
            columnName: "expectedAttendanceUserTag",
            fkidMember: "expectedAttendanceUserTagId",
            allowNull: true,
            foreignTableID: "UserTag",
            authMap: xEventAuthMap_R_EOwn_EManagers,
            getQuickFilterWhereClause: (query: string) => false,
        }),

        new BoolField({ columnName: "frontpageVisible", defaultValue: false, authMap: xEventAuthMap_Homepage, allowNull: false }),

        MakeRawTextField("frontpageDate", { authMap: xEventAuthMap_Homepage, }),
        MakeRawTextField("frontpageTime", { authMap: xEventAuthMap_Homepage, }),
        MakeMarkdownTextField("frontpageDetails", { authMap: xEventAuthMap_Homepage, }, true),
        MakeNullableRawTextField("frontpageTitle", { authMap: xEventAuthMap_Homepage, }),
        MakeNullableRawTextField("frontpageLocation", { authMap: xEventAuthMap_Homepage, }),
        MakeNullableRawTextField("frontpageLocationURI", { authMap: xEventAuthMap_Homepage, }),
        MakeNullableRawTextField("frontpageTags", { authMap: xEventAuthMap_Homepage, }),

        MakeRawTextField("frontpageDate_nl", { authMap: xEventAuthMap_Homepage, }, true),
        MakeRawTextField("frontpageTime_nl", { authMap: xEventAuthMap_Homepage, }, true),
        MakeMarkdownTextField("frontpageDetails_nl", { authMap: xEventAuthMap_Homepage, }, true),
        MakeNullableRawTextField("frontpageTitle_nl", { authMap: xEventAuthMap_Homepage, }),
        MakeNullableRawTextField("frontpageLocation_nl", { authMap: xEventAuthMap_Homepage, }),
        MakeNullableRawTextField("frontpageLocationURI_nl", { authMap: xEventAuthMap_Homepage, }),
        MakeNullableRawTextField("frontpageTags_nl", { authMap: xEventAuthMap_Homepage, }),

        MakeRawTextField("frontpageDate_fr", { authMap: xEventAuthMap_Homepage, }, true),
        MakeRawTextField("frontpageTime_fr", { authMap: xEventAuthMap_Homepage, }, true),
        MakeMarkdownTextField("frontpageDetails_fr", { authMap: xEventAuthMap_Homepage, }, true),
        MakeNullableRawTextField("frontpageTitle_fr", { authMap: xEventAuthMap_Homepage, }),
        MakeNullableRawTextField("frontpageLocation_fr", { authMap: xEventAuthMap_Homepage, }),
        MakeNullableRawTextField("frontpageLocationURI_fr", { authMap: xEventAuthMap_Homepage, }),
        MakeNullableRawTextField("frontpageTags_fr", { authMap: xEventAuthMap_Homepage, }),

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

        new ForeignCollectionField({ memberName: "segments", foreignTableID: "EventSegment", authMap: xEventAuthMap_R_EOwn_EManagers }),
        new ForeignCollectionField({ memberName: "responses", foreignTableID: "EventUserResponse", authMap: xEventAuthMap_R_EOwn_EManagers }),
        new ForeignCollectionField({ memberName: "songLists", foreignTableID: "EventSongList", authMap: xEventAuthMap_R_EOwn_EManagers }),
        new ForeignSingleField<Prisma.WikiPageGetPayload<{}>>({
            columnName: "descriptionWikiPage",
            fkidMember: "descriptionWikiPageId",
            allowNull: true,
            foreignTableID: "WikiPage",
            authMap: xEventAuthMap_R_EOwn_EManagers,
            getQuickFilterWhereClause: () => false,
        }),

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
    getSelectionArgs: (): Prisma.EventDefaultArgs => {
        return EventArgs_Verbose;
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
        songLists: true,
        responses: true, // instrument and isinvited are the only things we care about.
        segments: {
            include: {
                responses: true,
            }
        },
        descriptionWikiPage: {
            include: {
                currentRevision: true,
            }
        }
    },
});

export type EventSearch_Event = Prisma.EventGetPayload<typeof EventSearchArgsNP>;
export type EventSearch_EventUserResponse = Prisma.EventUserResponseGetPayload<typeof EventSearchArgsNP.include.responses>;
export type EventSearch_EventSegment = Prisma.EventSegmentGetPayload<typeof EventSearchArgsNP.include.segments>;
export type EventSearch_EventSegmentUserResponse = Prisma.EventSegmentUserResponseGetPayload<typeof EventSearchArgsNP.include.segments.include.responses>;






const xEventArgs_Search: db3.TableDesc = {
    ...xEventArgs_Base,
    tableUniqueName: "xEventArgs_Search",
    queryParameters: {
        ...EventQueryParameters,
        limitResponsesToActor: { kind: "boolean", authorizeAs: "responses", required: true },
    },
    getSelectionArgs: (filterModel, authorization): Prisma.EventDefaultArgs => {
        const tableParams = filterModel.tableParams as EventTableParams;
        assert(tableParams.limitResponsesToActor === true, "event search responses must be limited to the actor");
        assert(authorization.userId, "event search responses require an authenticated actor");
        return EventSearchArgs(authorization.userId);
    },
};

export const xEventSearch = new db3.xTable(xEventArgs_Search);










export const xEventSegment = new db3.xTable({
    tableName: "EventSegment",
    deletePolicy: "hard",
    queryParameters: {
        eventId: { kind: "integer", authorizeAs: "eventId", nullable: true },
    },
    getSelectionArgs: (): Prisma.EventSegmentDefaultArgs => {
        return EventSegmentArgs;
    },
    naturalOrderBy: EventSegmentNaturalOrderBy,
    tableAuthMap: xEventTableAuthMap_R_EManagers,
    getRowInfo: (row: EventSegmentPayload) => ({
        pk: row.id,
        name: row.name,
        description: row.description,
        ownerUserId: null,
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
        MakePKfield(),
        MakeDescriptionField({ authMap: xEventAuthMap_R_EOwn_EManagers, }),

        new GenericStringField({ // allow 0-length names in segments. sometimes it's not easy to know what to name them and it's not that important
            columnName: "name",
            allowNull: false,
            format: "plain",
            authMap: xEventAuthMap_R_EOwn_EManagers,
        }),
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
        new ForeignSingleField<Prisma.EventStatusGetPayload<{}>>({
            columnName: "status",
            fkidMember: "statusId",
            allowNull: true,
            foreignTableID: "EventStatus",
            authMap: xEventAuthMap_R_EOwn_EManagers,
            getQuickFilterWhereClause: (query: string) => false,
        }),

        new ForeignSingleField<Prisma.EventGetPayload<{}>>({
            columnName: "event",
            fkidMember: "eventId",
            allowNull: false,
            foreignTableID: "Event",
            getQuickFilterWhereClause: (query: string) => false,
            authMap: xEventAuthMap_R_EOwn_EManagers,
        }),

        // Prisma generates this stable identifier; expose it without allowing edits.
        new GhostField({
            memberName: "uid",
            authMap: {
                ...xEventAuthMap_R_EOwn_EManagers,
                PreInsert: Permission.never_grant,
                PreMutate: Permission.never_grant,
                PreMutateAsOwner: Permission.never_grant,
            },
        }),
        new GhostField({
            memberName: "dateTimeVersion",
            authMap: {
                ...xEventAuthMap_R_EOwn_EManagers,
                PreInsert: Permission.never_grant,
                PreMutate: Permission.never_grant,
                PreMutateAsOwner: Permission.never_grant,
            },
        }),
        new ForeignCollectionField({ memberName: "responses", foreignTableID: "EventSegmentUserResponse", authMap: xEventAuthMap_R_EOwn_EManagers }),
    ]
});



////////////////////////////////////////////////////////////////

export const xEventAttendance = new db3.xTable({
    getSelectionArgs: (): Prisma.EventAttendanceDefaultArgs => {
        return EventAttendanceArgs;
    },
    tableName: "EventAttendance",
    // NB: historical records are preserved and presented, even if soft deleted.
    // soft delete really means "don't show in option lists for new things"
    deletePolicy: "softOnly",
    viewDeletedPermission: Permission.recover_events,
    restorePermission: Permission.recover_events,
    tableAuthMap: xEventTableAuthMap_R_EAdmins,
    naturalOrderBy: EventAttendanceNaturalOrderBy,
    getRowInfo: (row: EventAttendancePayload) => ({
        pk: row.id,
        name: row.text,
        description: `${row.isActive ? "" : "(inactive) "}${row.description}`,
        color: gGeneralPaletteList.findEntry(row.color),
        ownerUserId: null,
        iconName: row.iconName,
    }),
    activeAsSelectable: (row: EventAttendancePayload) => {
        return row.isActive;
    },
    columns: [
        MakePKfield(),
        MakeTitleField("text", { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeDescriptionField({ authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeIconField("iconName", gIconOptions, { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeColorField({ authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeSortOrderField({ authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeIsDeletedField({ authMap: xEventAuthMap_R_EOwn_EManagers, }),

        MakeIntegerField("strength", { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        new GenericStringField({ allowNull: false, columnName: "personalText", format: "title", caseSensitive: false, authMap: xEventAuthMap_R_EOwn_EManagers, }),
        new GenericStringField({ allowNull: false, columnName: "pastText", format: "title", caseSensitive: false, authMap: xEventAuthMap_R_EOwn_EManagers, }),
        new GenericStringField({ allowNull: false, columnName: "pastPersonalText", format: "title", caseSensitive: false, authMap: xEventAuthMap_R_EOwn_EManagers, }),
        new BoolField({ columnName: "isActive", defaultValue: true, authMap: xEventAuthMap_R_EOwn_EManagers, allowNull: false }),
        new GhostField({ memberName: "responses", authMap: xEventAuthMap_R_EOwn_EManagers }),
    ]
});




export const xEventSegmentUserResponse = new db3.xTable({
    getSelectionArgs: (): Prisma.EventSegmentUserResponseDefaultArgs => {
        return EventSegmentUserResponseArgs;
    },
    tableName: "EventSegmentUserResponse",
    deletePolicy: "hard",
    queryParameters: {
        eventSegmentId: { kind: "integer", authorizeAs: "eventSegmentId" },
    },
    tableAuthMap: xEventTableAuthMap_UserResponse,
    naturalOrderBy: EventSegmentUserResponseNaturalOrderBy,
    getRowInfo: (row: EventSegmentUserResponsePayload) => ({
        pk: row.id,
        name: row.user?.name || "",
        ownerUserId: row.userId,
    }),
    getParameterizedWhereClause: (params: TAnyModel) => {
        const ret: Prisma.EventSegmentUserResponseWhereInput[] = [];
        if (params.eventSegmentId != null) {
            ret.push({
                eventSegmentId: { equals: params.eventSegmentId }
            });
        }
        return ret;
    },
    columns: [
        MakePKfield(),
        MakeCreatedAtField(),
        MakeCreatedByField(),
        MakeUpdatedAtField(),
        MakeUpdatedByField(),
        new ForeignSingleField<Prisma.EventSegmentGetPayload<{}>>({
            columnName: "eventSegment",
            fkidMember: "eventSegmentId",
            allowNull: false,
            foreignTableID: "EventSegment",
            getQuickFilterWhereClause: (query: string) => false,
            authMap: xEventAuthMap_UserResponseRelation,
        }),
        new ForeignSingleField<Prisma.UserGetPayload<{}>>({
            columnName: "user",
            fkidMember: "userId",
            allowNull: false,
            foreignTableID: "User",
            specialFunction: db3.SqlSpecialColumnFunction.ownerUser,
            getQuickFilterWhereClause: (query: string) => false,
            authMap: xEventAuthMap_UserResponseRelation,
        }),
        new ForeignSingleField<Prisma.EventAttendanceGetPayload<{}>>({
            columnName: "attendance",
            fkidMember: "attendanceId",
            allowNull: true,
            foreignTableID: "EventAttendance",
            getQuickFilterWhereClause: (query: string) => false,
            authMap: xEventAuthMap_UserResponse,
        }),
    ]
});



export const xEventUserResponse = new db3.xTable({
    getSelectionArgs: (): Prisma.EventUserResponseDefaultArgs => {
        return EventUserResponseArgs;
    },
    tableName: "EventUserResponse",
    deletePolicy: "hard",
    queryParameters: {
        eventId: { kind: "integer", authorizeAs: "eventId" },
    },
    naturalOrderBy: EventUserResponseNaturalOrderBy,
    tableAuthMap: xEventTableAuthMap_UserResponse,
    getRowInfo: (row: EventUserResponsePayload) => ({
        pk: row.id,
        name: row.user?.name || "",
        ownerUserId: row.userId || row.user?.id,
    }),
    getParameterizedWhereClause: (params: TAnyModel) => {
        const ret: Prisma.EventUserResponseWhereInput[] = [];
        if (params.eventId != null) {
            ret.push({
                eventId: { equals: params.eventId }
            });
        }
        return ret;
    },
    columns: [
        MakePKfield(),
        new GenericStringField({
            columnName: "userComment",
            allowNull: true,
            allowQuickFilter: false,
            format: "markdown",
            authMap: xEventAuthMap_UserResponse,
        }),
        new BoolField({ columnName: "isInvited", defaultValue: false, authMap: xEventAuthMap_R_EOwn_EManagers, allowNull: true }),
        MakeIntegerField("eventId", { authMap: xEventAuthMap_UserResponseRelation, }),
        new ForeignSingleField<Prisma.UserGetPayload<{}>>({
            columnName: "user",
            fkidMember: "userId",
            allowNull: false,
            foreignTableID: "User",
            specialFunction: db3.SqlSpecialColumnFunction.ownerUser,
            getQuickFilterWhereClause: (query: string) => false,
            authMap: xEventAuthMap_UserResponseRelation,
        }),
        new ForeignSingleField<Prisma.InstrumentGetPayload<{}>>({
            columnName: "instrument",
            fkidMember: "instrumentId",
            allowNull: true,
            foreignTableID: "Instrument",
            getQuickFilterWhereClause: (query: string) => false,
            authMap: xEventAuthMap_UserResponse,
        }),

        new RevisionField({ columnName: "revision", authMap: xEventAuthMap_UserResponse, applyToUpdates: true }),
        new GhostField({ memberName: "uid", authMap: xEventAuthMap_UserResponse }),
    ]
});









export const xEventSongList = new db3.xTable({
    getSelectionArgs: (): Prisma.EventSongListDefaultArgs => {
        return EventSongListArgs;
    },
    tableName: "EventSongList",
    deletePolicy: "hard",
    sortOrderPolicy: { groupingColumn: "eventId", scope: "explicitRowIds" },
    queryParameters: {
        eventId: { kind: "integer", authorizeAs: "eventId" },
    },
    naturalOrderBy: EventSongListNaturalOrderBy,
    tableAuthMap: xEventTableAuthMap_R_EManagers,
    getRowInfo: (row: EventSongListPayload) => ({
        pk: row.id,
        name: row.name,
        description: row.description,
        ownerUserId: null,
    }),
    getParameterizedWhereClause: (params: TAnyModel) => {
        const ret: Prisma.EventSongListWhereInput[] = [];
        if (params.eventId != null) {
            ret.push({
                eventId: { equals: params.eventId }
            });
        }
        return ret;
    },
    columns: [
        MakePKfield(),
        MakeTitleField("name", { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeDescriptionField({ authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeSortOrderField({ authMap: xEventAuthMap_R_EOwn_EManagers, }),

        new BoolField({ columnName: "isOrdered", defaultValue: true, authMap: xEventAuthMap_R_EOwn_EManagers, allowNull: false }),
        new BoolField({ columnName: "isActuallyPlayed", defaultValue: false, authMap: xEventAuthMap_R_EOwn_EManagers, allowNull: false }),

        new ForeignSingleField<Prisma.EventGetPayload<{}>>({
            columnName: "event",
            fkidMember: "eventId",
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
        new GhostField({ memberName: "dividers", authMap: xEventAuthMap_R_EOwn_EManagers }),
        new GhostField({ memberName: "userId", authMap: xEventAuthMap_R_EOwn_EManagers }), // what is this??
    ]
});



export const xEventSongListSong = new db3.xTable({
    getSelectionArgs: (): Prisma.EventSongListSongDefaultArgs => {
        return EventSongListSongArgs;
    },
    tableName: "EventSongListSong",
    deletePolicy: "hard",
    queryParameters: {
        eventSongListId: { kind: "integer", authorizeAs: "eventSongListId" },
    },
    naturalOrderBy: EventSongListSongNaturalOrderBy,
    tableAuthMap: xEventTableAuthMap_R_EManagers,
    getRowInfo: (row: EventSongListSongPayload) => ({
        pk: row.id,
        name: row.song?.name || "?",
        description: row.subtitle || "",
        ownerUserId: null,
    }),
    getParameterizedWhereClause: (params: TAnyModel): (Prisma.EventSongListSongWhereInput[] | false) => {
        const ret: Prisma.EventSongListSongWhereInput[] = [];
        if (params.eventSongListId != null) {
            ret.push({
                eventSongListId: { equals: params.eventSongListId }
            });
        }
        return ret;
    },
    columns: [
        MakePKfield(),
        MakePlainTextField("subtitle", { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeSortOrderField({ authMap: xEventAuthMap_R_EOwn_EManagers, }),
        new ForeignSingleField<Prisma.SongGetPayload<{}>>({
            columnName: "song",
            fkidMember: "songId",
            allowNull: false,
            requireVisibleTarget: true,
            foreignTableID: "Song",
            authMap: xEventAuthMap_R_EOwn_EManagers,
            getQuickFilterWhereClause: (query: string) => false,
        }),
        new ForeignSingleField<Prisma.EventSongListGetPayload<{}>>({
            columnName: "eventSongList",
            fkidMember: "eventSongListId",
            allowNull: false,
            foreignTableID: "EventSongList",
            authMap: xEventAuthMap_R_EOwn_EManagers,
            getQuickFilterWhereClause: (query: string) => false,
        }),
    ]
});



export const xEventSongListDivider = new db3.xTable({
    getSelectionArgs: (): Prisma.EventSongListDividerDefaultArgs => {
        return EventSongListDividerArgs;
    },
    tableName: "EventSongListDivider",
    deletePolicy: "hard",
    queryParameters: {
        eventSongListId: { kind: "integer", authorizeAs: "eventSongListId" },
    },
    naturalOrderBy: EventSongListSongNaturalOrderBy, // yea i can borrow this.
    tableAuthMap: xEventTableAuthMap_R_EManagers,
    getRowInfo: (row: EventSongListDividerPayload) => ({
        pk: row.id,
        name: "divider",
        color: gGeneralPaletteList.findEntry(row.color),
        description: row.subtitle || "",
        ownerUserId: null,
    }),
    getParameterizedWhereClause: (params: TAnyModel): (Prisma.EventSongListDividerWhereInput[] | false) => {
        const ret: Prisma.EventSongListDividerWhereInput[] = [];
        if (params.eventSongListId != null) {
            ret.push({
                eventSongListId: { equals: params.eventSongListId }
            });
        }
        return ret;
    },
    columns: [
        MakePKfield(),
        MakePlainTextField("subtitle", { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeSortOrderField({ authMap: xEventAuthMap_R_EOwn_EManagers, }),
        MakeColorField({ authMap: xEventAuthMap_R_EOwn_EManagers, }),
        new BoolField({ columnName: "isInterruption", defaultValue: true, authMap: xEventAuthMap_R_EOwn_EManagers, allowNull: false }),
        new ConstEnumStringField({ allowNull: false, authMap: xEventAuthMap_R_EOwn_EManagers, columnName: "textStyle", defaultValue: EventSongListDividerTextStyle.Default, options: EventSongListDividerTextStyle }),
        new ForeignSingleField<Prisma.EventSongListGetPayload<{}>>({
            columnName: "eventSongList",
            fkidMember: "eventSongListId",
            allowNull: false,
            foreignTableID: "EventSongList",
            authMap: xEventAuthMap_R_EOwn_EManagers,
            getQuickFilterWhereClause: (query: string) => false,
        }),
    ]
});






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
        statusId: true,
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

    // calculated invitation status -- can derive from either tag membership or explicit individual invitation.
    // response.isInvited may differ
    isInvited: boolean;

    // if the user is invited, they are relevant for display; show them.
    // if the user is not invited but has responded, show them.
    isRelevantForDisplay: boolean;

    instrument: InstrumentClientOrDbPayload | null;
};

export interface EventSegmentUserResponse<
    TEventSegment extends EventResponses_MinimalEventSegment,
    TSegmentResponse extends EventResponses_MinimalEventSegmentUserResponse,
> {
    segment: TEventSegment;
    user: UserWithInstrumentsPayload;
    response: TSegmentResponse;
};
