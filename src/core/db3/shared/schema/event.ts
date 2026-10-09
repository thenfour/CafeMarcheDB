import type { InstrumentDashboardClient } from "../entities/instrument/instrumentViews";
import { xEventResponseMembership } from "../entities/event/eventResponseMembership";
import { xBandUserTag } from "../entities/user/bandUserTagViews";
import { xBandInstrument } from "../entities/instrument/bandInstrumentContracts";
import { serverOwnedField } from "../columnTypes/inherited";
import type { EventParticipant } from "../entities/user/eventParticipant";
import { xBandEventTag } from "../entities/event/eventTagCatalogs";
import { localizedText } from "../columnTypes/localizedString";
// TODO: permissions for actions like these needs to be done in a different way.
// for example i should be able to edit my own posts but not others. etc.
// or think about the concept of user blocking, or not being able to see responses of certain kinds of events or people. todo...

import { TAnyModel } from "@/shared/rootroot";
import { gGeneralPaletteList } from "@/src/core/components/color/palette";
import { Prisma } from "db";
import { z } from "zod";
import { assertIsNumberArray, assertIsStringArray } from "shared/arrayUtils";
import { Permission } from "shared/permissions";
import { DateTimeRange } from "shared/time";
import { CoalesceBool, smartTruncate } from "shared/utils";
import type {
    EventPublicId,
    EventSegmentPublicId,
    EventUserResponsePublicId,
    EventSegmentUserResponsePublicId,
    EventAttendancePublicId,
    EventSongListPublicId,
    EventSongListSongPublicId,
    EventSongListDividerPublicId,
    EventStatusPublicId,
    EventTagAssignmentPublicId,
    EventTypePublicId,
    EventTagPublicId,
    SongPublicId,
    BandUserPublicId,
    InstrumentPublicId,
} from "shared/publicId";
import { type CMDBTableFilterModel } from "../apiTypes";
import { GenericStringField, MakeDescriptionField, MakeMarkdownTextField, MakeNullableRawTextField, MakePlainTextField, MakeRawTextField, MakeTitleField } from "../columnTypes/genericString";
import { BoolField, ConstEnumStringField, EventStartsAtField, ForeignCollectionField, foreignRef, GenericIntegerField, GhostField, MakeColorField, MakeCreatedAtField, MakeIsDeletedField, MakePKfield, MakePublicIdField, MakeSortOrderField, MakeUpdatedAtField, RevisionField, tagsRef } from "../columnTypes/xTableColumnTypes";
import * as db3 from "../db3core";
import {
    EventArgs,
    EventNaturalOrderBy, type EventPayload, type EventPayloadClient,
    EventSegmentArgs, EventSegmentNaturalOrderBy, type EventSegmentPayload,
    EventSegmentUserResponseArgs, EventSegmentUserResponseNaturalOrderBy,
    type EventSegmentUserResponsePayload, EventSongListArgs, EventSongListDividerArgs, type EventSongListDividerPayload, EventSongListDividerTextStyle, EventSongListNaturalOrderBy, type EventSongListPayload, EventSongListSongArgs, EventSongListSongNaturalOrderBy,
    type EventSongListSongPayload, EventTagAssignmentArgs,
    EventTagAssignmentNaturalOrderBy, type EventTagAssignmentPayload,
    EventTypeSignificance, EventUserResponseArgs, EventUserResponseNaturalOrderBy,
    type EventUserResponsePayload,
} from "./prismArgs";
import { MakeCreatedByField, MakeUpdatedByField, MakeVisiblePermissionField } from "./user";
import { xEventType, xEventStatus, xEventAttendance } from "../entities/event/eventCatalogs";
import { xSong } from "./song";
import { xWikiPage } from "./wiki";

export { xEventType, xEventStatus, xEventAttendance } from "../entities/event/eventCatalogs";


export const xEventAuthMap_UserResponse = db3.defineAuthMap({
    PostQueryAsOwner: Permission.view_events_nonpublic,
    PostQuery: Permission.view_events_nonpublic,
    PreMutateAsOwner: Permission.respond_to_events,
    PreMutate: Permission.change_others_event_responses,
    // Generic inserts accept an arbitrary userId, so only the explicit
    // cross-user capability may use that path. Self-service insertion goes
    // through updateUserEventAttendanceMutation, which binds the actor itself.
    PreInsert: Permission.change_others_event_responses,
});

export const xEventAuthMap_UserResponseRelation = db3.defineAuthMap({
    PostQueryAsOwner: Permission.view_events_nonpublic,
    PostQuery: Permission.view_events_nonpublic,
    // An owner must not be able to authorize changing the user or parent event
    // merely because the persisted response currently belongs to them.
    PreMutateAsOwner: Permission.change_others_event_responses,
    PreMutate: Permission.change_others_event_responses,
    PreInsert: Permission.change_others_event_responses,
});

export const xEventAuthMap_R_EOwn_EManagers = db3.defineAuthMap({
    PostQueryAsOwner: Permission.view_events_nonpublic,
    PostQuery: Permission.view_events_nonpublic,
    PreMutateAsOwner: Permission.view_events_nonpublic,
    PreMutate: Permission.manage_events,
    PreInsert: Permission.manage_events,
});

export const xEventAuthMap_R_EManagers = db3.defineAuthMap({
    PostQueryAsOwner: Permission.view_events_nonpublic,
    PostQuery: Permission.view_events_nonpublic,
    PreMutateAsOwner: Permission.manage_events,
    PreMutate: Permission.manage_events,
    PreInsert: Permission.manage_events,
});

export const xEventAuthMap_R_EAdmin = db3.defineAuthMap({
    PostQueryAsOwner: Permission.view_events_nonpublic,
    PostQuery: Permission.view_events_nonpublic,
    PreMutateAsOwner: Permission.admin_events,
    PreMutate: Permission.admin_events,
    PreInsert: Permission.admin_events,
});

export const xEventAuthMap_CreatedAt = xEventAuthMap_R_EAdmin;

export const xEventAuthMap_Homepage = db3.defineAuthMap({
    PostQueryAsOwner: db3.DB3FieldReadAuth.inheritRow,
    PostQuery: db3.DB3FieldReadAuth.inheritRow,
    PreMutateAsOwner: Permission.edit_public_homepage,
    PreMutate: Permission.edit_public_homepage,
    PreInsert: Permission.edit_public_homepage,
});

// Event-status display metadata is part of the row's public identity. Once the
// row is readable, these scalar values are readable as a unit; mutation policy
// remains unchanged.
const xEventChipsAuthMap = db3.defineAuthMap({
    PostQueryAsOwner: db3.DB3FieldReadAuth.inheritRow,
    PostQuery: db3.DB3FieldReadAuth.inheritRow,
    PreMutateAsOwner: xEventAuthMap_R_EOwn_EManagers.PreMutateAsOwner,
    PreMutate: xEventAuthMap_R_EOwn_EManagers.PreMutate,
    PreInsert: xEventAuthMap_R_EOwn_EManagers.PreInsert,
});

const makeEventChipSortOrderField = () => new GenericIntegerField({
    columnName: "sortOrder",
    allowSearchingThisField: false,
    allowNull: false,
    specialFunction: db3.SqlSpecialColumnFunction.sortOrder,
    authMap: xEventChipsAuthMap,
});


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
    ViewOwn: Permission.view_events_nonpublic,
    View: Permission.view_events_nonpublic,
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
    segments: {
        startsAt: Date | null;
        durationMillis: bigint;
        isAllDay: boolean;
        statusId: number | null,
    }[],
    cancelledStatusIds: number[],
) => {
    const ranges = segments
        .filter(segment => !segment.statusId || !cancelledStatusIds.includes(segment.statusId))
        .map(getEventSegmentDateTimeRange);
    return DateTimeRange.union(ranges);
};


// wraps getEventDateTimeRangeFromSegments,
// returning database columns to update.
export function getEventDateRangeUpdateColumnsFromSegments(
    segments: Parameters<typeof getEventDateTimeRangeFromSegments>[0], cancelledStatusIds: number[],
) {
    const range = getEventDateTimeRangeFromSegments(segments, cancelledStatusIds);
    const spec = range.getSpec();
    return {
        startsAt: spec.startsAtDateTime,
        durationMillis: spec.durationMillis,
        isAllDay: spec.isAllDay,
        endDateTime: range.getBounds()?.end ?? null
    };
}

export const getEventSegmentMinDate = (event: EventPayload): Date | null => {
    return DateTimeRange.union(event.segments.map(getEventSegmentDateTimeRange)).getStartDateTime();
};

////////////////////////////////////////////////////////////////

export const xEventTagAssignment = db3.defineTable({
    prismaModel: db3.prismaModel<Prisma.EventTagAssignmentDelegate>(),
    getIdentity: (assignment: { publicId: EventTagAssignmentPublicId }) => assignment.publicId,
    tableName: "EventTagAssignment",
    deletePolicy: "hard",
    naturalOrderBy: EventTagAssignmentNaturalOrderBy,
    tableAuthMap: xEventTableAuthMap_R_EManagers,
    getSelectionArgs: (): Prisma.EventTagAssignmentDefaultArgs => {
        return EventTagAssignmentArgs;
    },
    getRowInfo: (row: EventTagAssignmentPayload) => {
        return {
            pk: row.publicId,
            name: localizedText(row.eventTag?.name) ?? "",
            description: localizedText(row.eventTag?.description) ?? "",
            color: gGeneralPaletteList.findEntry(row.eventTag?.color || null),
            ownerUserId: null,
        };
    },
    fields: db3.makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "sysadmin" }),
        publicId: () => MakePublicIdField<EventTagAssignmentPublicId>(),
        eventTag: foreignRef(() => xBandEventTag, {
            fkidMember: "bandEventTagId",
            authMap: xEventChipsAuthMap,
        }),
    })
});




////////////////////////////////////////////////////////////////

export interface EventTableParams {
    eventId?: EventPublicId;
    eventIds?: EventPublicId[];
    eventUids?: string[];
    eventTypeIds?: EventTypePublicId[];
    eventStatusIds?: EventStatusPublicId[];
    eventTagIds?: EventTagPublicId[];
    songId?: SongPublicId;
    startsBefore?: Date;
    startsOnOrAfter?: Date;
    minDate?: Date;
    forFrontPageAgenda?: boolean; // returns future + recent events + any event that's showing on front page
    refreshSerial?: number; // ignored but useful to force a refresh
};

interface ResolvedEventTableParams extends Omit<
    EventTableParams,
    "eventId" | "eventIds" | "eventTypeIds" | "eventStatusIds" | "eventTagIds" | "songId"
> {
    eventId?: number;
    eventIds?: number[];
    eventTypeIds?: number[];
    eventStatusIds?: number[];
    eventTagIds?: number[];
    songId?: number;
}

const EventQueryParameters = {
    songId: { kind: "entityIdentity", targetTableID: "Song", authorizeAs: "songLists" },
    eventTagIds: { kind: "entityIdentityArray", targetTableID: "BandEventTag", authorizeAs: "tags" },
    startsBefore: { kind: "date", authorizeAs: "startsAt" },
    startsOnOrAfter: { kind: "date", authorizeAs: "startsAt" },
    eventId: { kind: "entityIdentity", targetTableID: "Event", authorizeAs: "publicId" },
    eventIds: { kind: "entityIdentityArray", targetTableID: "Event", authorizeAs: "publicId" },
    eventUids: { kind: "stringArray", authorizeAs: "uid" },
    eventTypeIds: {
        kind: "entityIdentityArray",
        targetTableID: "EventType",
        authorizeAs: "typeId",
    },
    eventStatusIds: {
        kind: "entityIdentityArray",
        targetTableID: "EventStatus",
        authorizeAs: "statusId",
    },
    minDate: { kind: "date", authorizeAs: "endDateTime" },
    forFrontPageAgenda: { kind: "boolean", authorizeAs: ["frontpageVisible", "typeId", "endDateTime"] },
    refreshSerial: { kind: "integer", authorizeAs: null },
} satisfies db3.DB3QueryParameterMap;

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


export const xEventArgs_Base = db3.defineTableDesc({
    prismaModel: db3.prismaModel<Prisma.EventDelegate>(),
    getIdentity: (event: { publicId: EventPublicId }) => event.publicId,
    // modifying an event means multiple related changes; see the mutation event hooks.
    tableName: "Event", // case matters :(
    bandScope: { member: "bandId", managePermission: Permission.manage_events },
    readConsistency: "snapshot",
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
        pk: row.publicId,
        name: EventAPI.getLabel(row),
        color: gGeneralPaletteList.findEntry(row.type?.color || null),
        ownerUserId: row.createdByUserId,
    }),

    getParameterizedWhereClause: (params: ResolvedEventTableParams): (Prisma.EventWhereInput[]) => {
        const ret: Prisma.EventWhereInput[] = [];

        if (params.songId !== undefined) {
            ret.push({ songLists: { some: { songs: { some: { songId: params.songId } } } } });
        }
        if (params.eventTagIds !== undefined) {
            ret.push(...params.eventTagIds.map(bandEventTagId => ({ tags: { some: { bandEventTagId } } })));
        }
        if (params.startsBefore !== undefined) {
            ret.push({ startsAt: { lt: params.startsBefore } });
        }
        if (params.startsOnOrAfter !== undefined) {
            ret.push({ startsAt: { gte: params.startsOnOrAfter } });
        }

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
    fields: db3.makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "sysadmin" }),
        publicId: () => MakePublicIdField<EventPublicId>(),
        bandId: columnName => serverOwnedField(new GenericIntegerField({
            columnName, allowNull: false, allowSearchingThisField: false,
            authMap: { ...xEventAuthMap_R_EManagers, PostQuery: Permission.never_grant, PostQueryAsOwner: Permission.never_grant },
        })),
        name: columnName => MakeTitleField(columnName, { authMap: xEventAuthMap_Homepage, }),
        isDeleted: () => MakeIsDeletedField({ authMap: xEventAuthMap_R_EOwn_EManagers, }),
        locationDescription: columnName => MakePlainTextField(columnName, { authMap: xEventAuthMap_Homepage, }),
        visiblePermission: () => MakeVisiblePermissionField({ authMap: xEventAuthMap_R_EOwn_EManagers }),
        createdAt: () => MakeCreatedAtField(),
        createdByUser: () => MakeCreatedByField(),
        updatedAt: () => MakeUpdatedAtField(),
        updatedByUser: () => MakeUpdatedByField(),

        locationURL: columnName => new GenericStringField({
            columnName,
            allowNull: false,
            format: "plain",
            allowQuickFilter: false,
            authMap: xEventAuthMap_Homepage,
        }),

        revision: columnName => new RevisionField({ columnName, authMap: xEventAuthMap_CreatedAt, applyToUpdates: false }),

        relevanceClassOverride: columnName => new GenericIntegerField({
            columnName,
            allowNull: true,
            authMap: xEventAuthMap_R_EOwn_EManagers,
        }),
        type: foreignRef(() => xEventType, {
            fkidMember: "typeId",
            allowNull: true,
            authMap: xEventAuthMap_R_EOwn_EManagers,
        }),
        status: foreignRef(() => xEventStatus, {
            fkidMember: "statusId",
            allowNull: true,
            authMap: xEventAuthMap_R_EOwn_EManagers,
        }),
        expectedAttendanceUserTag: foreignRef(() => xBandUserTag, {
            fkidMember: "expectedAttendanceUserTagId",
            allowNull: true,
            authMap: xEventAuthMap_R_EOwn_EManagers,
        }),

        frontpageVisible: columnName => new BoolField({ columnName, defaultValue: false, authMap: xEventAuthMap_Homepage, allowNull: false }),

        frontpageDate: columnName => MakeRawTextField(columnName, { authMap: xEventAuthMap_Homepage, }),
        frontpageTime: columnName => MakeRawTextField(columnName, { authMap: xEventAuthMap_Homepage, }),
        frontpageDetails: columnName => MakeMarkdownTextField(columnName, { authMap: xEventAuthMap_Homepage, }, true),
        frontpageTitle: columnName => MakeNullableRawTextField(columnName, { authMap: xEventAuthMap_Homepage, }),
        frontpageLocation: columnName => MakeNullableRawTextField(columnName, { authMap: xEventAuthMap_Homepage, }),
        frontpageLocationURI: columnName => MakeNullableRawTextField(columnName, { authMap: xEventAuthMap_Homepage, }),
        frontpageTags: columnName => MakeNullableRawTextField(columnName, { authMap: xEventAuthMap_Homepage, }),

        frontpageDate_nl: columnName => MakeRawTextField(columnName, { authMap: xEventAuthMap_Homepage, }, true),
        frontpageTime_nl: columnName => MakeRawTextField(columnName, { authMap: xEventAuthMap_Homepage, }, true),
        frontpageDetails_nl: columnName => MakeMarkdownTextField(columnName, { authMap: xEventAuthMap_Homepage, }, true),
        frontpageTitle_nl: columnName => MakeNullableRawTextField(columnName, { authMap: xEventAuthMap_Homepage, }),
        frontpageLocation_nl: columnName => MakeNullableRawTextField(columnName, { authMap: xEventAuthMap_Homepage, }),
        frontpageLocationURI_nl: columnName => MakeNullableRawTextField(columnName, { authMap: xEventAuthMap_Homepage, }),
        frontpageTags_nl: columnName => MakeNullableRawTextField(columnName, { authMap: xEventAuthMap_Homepage, }),

        frontpageDate_fr: columnName => MakeRawTextField(columnName, { authMap: xEventAuthMap_Homepage, }, true),
        frontpageTime_fr: columnName => MakeRawTextField(columnName, { authMap: xEventAuthMap_Homepage, }, true),
        frontpageDetails_fr: columnName => MakeMarkdownTextField(columnName, { authMap: xEventAuthMap_Homepage, }, true),
        frontpageTitle_fr: columnName => MakeNullableRawTextField(columnName, { authMap: xEventAuthMap_Homepage, }),
        frontpageLocation_fr: columnName => MakeNullableRawTextField(columnName, { authMap: xEventAuthMap_Homepage, }),
        frontpageLocationURI_fr: columnName => MakeNullableRawTextField(columnName, { authMap: xEventAuthMap_Homepage, }),
        frontpageTags_fr: columnName => MakeNullableRawTextField(columnName, { authMap: xEventAuthMap_Homepage, }),

        tags: tagsRef("EventTagAssignment", "BandEventTag", {
            associationForeignIDMember: "bandEventTagId",
            associationForeignObjectMember: "eventTag",
            associationLocalObjectMember: "event",
            authMap: xEventAuthMap_Homepage,
            // don't allow quick search on tag; it interferes with getEventFilterInfo.ts
            getQuickFilterWhereClause: () => false,
            getCustomFilterWhereClause: (query: CMDBTableFilterModel): Prisma.EventWhereInput | boolean => {
                if (!query.tagIds?.length) return false;
                const tagIds = query!.tagIds;

                return {
                    AND: tagIds.map(tagId => ({
                        tags: { some: { bandEventTagId: { equals: tagId } } }
                    }))
                };

                // the following does not work; it would require that, for an event, all of its tags are being queried.
                // return ({
                //     tags: { every: { bandEventTagId: { in: query!.tagIds } } }
                // });
            },
        }), // tags
        fileTags: tagsRef("FileEventTag", "File", {
            associationForeignObjectMember: "file",
            authMap: xEventAuthMap_R_EOwn_EManagers,
            associationLocalObjectMember: "event",
            getQuickFilterWhereClause: (query: string): Prisma.EventWhereInput | boolean => false,
            getCustomFilterWhereClause: (query: CMDBTableFilterModel): Prisma.EventWhereInput | boolean => false,
        }), // tags

        segments: memberName => new ForeignCollectionField({ memberName, foreignTableID: "EventSegment", authMap: xEventAuthMap_R_EOwn_EManagers }),
        responses: memberName => new ForeignCollectionField({ memberName, foreignTableID: "EventUserResponse", authMap: xEventAuthMap_R_EOwn_EManagers }),
        songLists: memberName => new ForeignCollectionField({ memberName, foreignTableID: "EventSongList", authMap: xEventAuthMap_R_EOwn_EManagers }),
        descriptionWikiPage: foreignRef(() => xWikiPage, {
            fkidMember: "descriptionWikiPageId",
            allowNull: true,
            authMap: xEventAuthMap_R_EOwn_EManagers,
        }),

        // because this is used for generating icals
        uid: memberName => new GhostField({
            memberName,
            readTransportSchema: z.string(),
            authMap: xEventAuthMap_Homepage,
        }),
        calendarInputHash: memberName => new GhostField({ memberName, authMap: xEventAuthMap_R_EAdmin }),

        startsAt: columnName => new EventStartsAtField({
            allowNull: true,
            columnName,
            authMap: xEventAuthMap_Homepage,
        }),
        durationMillis: columnName => new GenericIntegerField({
            allowNull: false,
            allowSearchingThisField: false,
            columnName,
            readTransportType: "bigint",
            authMap: xEventAuthMap_Homepage,
        }),
        isAllDay: columnName => new BoolField({
            columnName,
            defaultValue: true,
            authMap: xEventAuthMap_Homepage,
            allowNull: false
        }),

        endDateTime: memberName => new GhostField({
            memberName,
            readTransportSchema: z.date().nullable(),
            authMap: xEventAuthMap_Homepage,
        }),
    })
});

export const xEvent = db3.defineTable(xEventArgs_Base);

export const xEventSegment = db3.defineTable({
    prismaModel: db3.prismaModel<Prisma.EventSegmentDelegate>(),
    getIdentity: (row: { publicId: EventSegmentPublicId }) => row.publicId,
    tableName: "EventSegment",
    bandScope: { member: "bandId", via: { relation: "event", ownerUserMember: "createdByUserId" }, managePermission: Permission.manage_events },
    readConsistency: "snapshot",
    deletePolicy: "hard",
    queryParameters: {
        eventId: {
            kind: "entityIdentity",
            targetTableID: "Event",
            authorizeAs: "eventId",
            nullable: true
        },
    },
    getSelectionArgs: (): Prisma.EventSegmentDefaultArgs => {
        return EventSegmentArgs;
    },
    naturalOrderBy: EventSegmentNaturalOrderBy,
    tableAuthMap: xEventTableAuthMap_R_EManagers,
    getRowInfo: (row: EventSegmentPayload) => ({
        pk: row.publicId,
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
    fields: db3.makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "sysadmin" }),
        publicId: () => MakePublicIdField<EventSegmentPublicId>(),
        description: () => MakeDescriptionField({ authMap: xEventAuthMap_R_EOwn_EManagers, }),

        name: columnName => new GenericStringField({ // allow 0-length names in segments. sometimes it's not easy to know what to name them and it's not that important
            columnName,
            allowNull: false,
            format: "plain",
            authMap: xEventAuthMap_R_EOwn_EManagers,
        }),
        startsAt: columnName => new EventStartsAtField({
            allowNull: true,
            columnName,
            authMap: xEventAuthMap_R_EOwn_EManagers,
        }),
        durationMillis: columnName => new GenericIntegerField({
            allowNull: false,
            columnName,
            allowSearchingThisField: false,
            readTransportType: "bigint",
            authMap: xEventAuthMap_R_EOwn_EManagers,
        }),
        isAllDay: columnName => new BoolField({
            columnName,
            defaultValue: true,
            authMap: xEventAuthMap_R_EOwn_EManagers,
            allowNull: false
        }),
        status: foreignRef(() => xEventStatus, {
            fkidMember: "statusId",
            allowNull: true,
            authMap: xEventAuthMap_R_EOwn_EManagers,
        }),

        event: foreignRef(() => xEvent, {
            fkidMember: "eventId",
            requireVisibleTarget: true,
            authMap: xEventAuthMap_R_EOwn_EManagers,
        }),

        // Prisma generates this stable identifier; expose it without allowing edits.
        uid: memberName => new GhostField({
            memberName,
            readTransportSchema: z.string().nullable(),
            authMap: {
                ...xEventAuthMap_R_EOwn_EManagers,
                PreInsert: Permission.never_grant,
                PreMutate: Permission.never_grant,
                PreMutateAsOwner: Permission.never_grant,
            },
        }),
        dateTimeVersion: memberName => new GhostField({
            memberName,
            authMap: {
                ...xEventAuthMap_R_EOwn_EManagers,
                PreInsert: Permission.never_grant,
                PreMutate: Permission.never_grant,
                PreMutateAsOwner: Permission.never_grant,
            },
        }),
        responses: memberName => new ForeignCollectionField({ memberName, foreignTableID: "EventSegmentUserResponse", authMap: xEventAuthMap_R_EOwn_EManagers }),
    })
});



////////////////////////////////////////////////////////////////

export const xEventSegmentUserResponse = db3.defineTable({
    prismaModel: db3.prismaModel<Prisma.EventSegmentUserResponseDelegate>(),
    getSelectionArgs: (): Prisma.EventSegmentUserResponseDefaultArgs => {
        return EventSegmentUserResponseArgs;
    },
    getIdentity: (row: { publicId: EventSegmentUserResponsePublicId }) => row.publicId,
    tableName: "EventSegmentUserResponse",
    deletePolicy: "hard",
    bandScope: { member: "bandId", via: { relation: "bandUser", ownerUserMember: "userId" }, managePermission: Permission.change_others_event_responses },
    readConsistency: "snapshot",
    queryParameters: {
        eventSegmentId: { kind: "entityIdentity", targetTableID: "EventSegment", authorizeAs: "eventSegmentId" },
    },
    tableAuthMap: xEventTableAuthMap_UserResponse,
    naturalOrderBy: EventSegmentUserResponseNaturalOrderBy,
    getRowInfo: (row: EventSegmentUserResponsePayload) => ({
        pk: row.publicId,
        name: row.bandUser?.user?.name || "",
        ownerUserId: row.bandUser?.userId ?? null,
    }),
    getParameterizedWhereClause: (params: { eventSegmentId?: number }, auth): Prisma.EventSegmentUserResponseWhereInput[] => {
        const ret: Prisma.EventSegmentUserResponseWhereInput[] = [{
            eventSegment: {
                event: {
                    bandId: auth.requireBand().id, isDeleted: false,
                }
            }
        }];
        if (params.eventSegmentId != null) {
            ret.push({
                eventSegmentId: { equals: params.eventSegmentId }
            });
        }
        return ret;
    },
    fields: db3.makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "sysadmin" }),
        publicId: () => MakePublicIdField<EventSegmentUserResponsePublicId>(),
        createdAt: () => MakeCreatedAtField(),
        createdByUser: () => MakeCreatedByField(),
        updatedAt: () => MakeUpdatedAtField(),
        updatedByUser: () => MakeUpdatedByField(),
        eventSegment: foreignRef(() => xEventSegment, {
            fkidMember: "eventSegmentId",
            requireVisibleTarget: true,
            authMap: xEventAuthMap_UserResponseRelation,
        }),
        bandUser: foreignRef(() => xEventResponseMembership, {
            fkidMember: "bandUserId",
            authMap: xEventAuthMap_UserResponseRelation,
        }),
        attendance: foreignRef(() => xEventAttendance, {
            fkidMember: "attendanceId",
            allowNull: true,
            authMap: xEventAuthMap_UserResponse,
        }),
    })
});



export const xEventUserResponse = db3.defineTable({
    prismaModel: db3.prismaModel<Prisma.EventUserResponseDelegate>(),
    getSelectionArgs: (): Prisma.EventUserResponseDefaultArgs => {
        return EventUserResponseArgs;
    },
    getIdentity: (row: { publicId: EventUserResponsePublicId }) => row.publicId,
    tableName: "EventUserResponse",
    deletePolicy: "hard",
    bandScope: { member: "bandId", via: { relation: "bandUser", ownerUserMember: "userId" }, managePermission: Permission.change_others_event_responses },
    readConsistency: "snapshot",
    queryParameters: {
        eventId: {
            kind: "entityIdentity",
            targetTableID: "Event",
            authorizeAs: "eventId"
        },
    },
    naturalOrderBy: EventUserResponseNaturalOrderBy,
    tableAuthMap: xEventTableAuthMap_UserResponse,
    getRowInfo: (row: EventUserResponsePayload) => ({
        pk: row.publicId,
        name: row.bandUser?.user?.name || "",
        ownerUserId: row.bandUser?.userId ?? null,
    }),
    getParameterizedWhereClause: (params: { eventId?: number }, auth): Prisma.EventUserResponseWhereInput[] => {
        const ret: Prisma.EventUserResponseWhereInput[] = [{
            event: {
                bandId: auth.requireBand().id, isDeleted: false,
            }, OR: [{ bandInstrumentId: null }, { bandInstrument: { bandId: auth.requireBand().id } }]
        }];
        if (params.eventId != null) {
            ret.push({
                eventId: { equals: params.eventId }
            });
        }
        return ret;
    },
    fields: db3.makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "sysadmin" }),
        publicId: () => MakePublicIdField<EventUserResponsePublicId>(),
        userComment: columnName => new GenericStringField({
            columnName,
            allowNull: true,
            allowQuickFilter: false,
            format: "markdown",
            authMap: xEventAuthMap_UserResponse,
        }),
        isInvited: columnName => new BoolField({ columnName, defaultValue: false, authMap: xEventAuthMap_R_EOwn_EManagers, allowNull: true }),
        event: foreignRef(() => xEvent, {
            fkidMember: "eventId", requireVisibleTarget: true,
            authMap: xEventAuthMap_UserResponseRelation,
        }),
        bandUser: foreignRef(() => xEventResponseMembership, {
            fkidMember: "bandUserId",
            authMap: xEventAuthMap_UserResponseRelation,
        }),
        bandInstrument: foreignRef(() => xBandInstrument, {
            fkidMember: "bandInstrumentId",
            allowNull: true,
            authMap: xEventAuthMap_UserResponse,
        }),

        revision: columnName => new RevisionField({ columnName, authMap: xEventAuthMap_UserResponse, applyToUpdates: true }),
        uid: memberName => new GhostField({ memberName, authMap: xEventAuthMap_UserResponse }),
    })
});









export const xEventSongList = db3.defineTable({
    prismaModel: db3.prismaModel<Prisma.EventSongListDelegate>(),
    getIdentity: (songList: { publicId: EventSongListPublicId }) => songList.publicId,
    getSelectionArgs: (): Prisma.EventSongListDefaultArgs => {
        return EventSongListArgs;
    },
    tableName: "EventSongList",
    bandScope: {
        member: "bandId",
        via: {
            relation: "event",
            ownerUserMember: "createdByUserId"
        },
        managePermission: Permission.manage_events
    },
    readConsistency: "snapshot",
    deletePolicy: "hard",
    queryParameters: {
        eventId: {
            kind: "entityIdentity",
            targetTableID: "Event",
            authorizeAs: "eventId"
        },
    },
    naturalOrderBy: EventSongListNaturalOrderBy,
    tableAuthMap: xEventTableAuthMap_R_EManagers,
    getRowInfo: (row: EventSongListPayload) => ({
        pk: row.publicId,
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
    fields: db3.makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "sysadmin" }),
        publicId: () => MakePublicIdField<EventSongListPublicId>(),
        name: columnName => MakeTitleField(columnName, { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        description: () => MakeDescriptionField({ authMap: xEventAuthMap_R_EOwn_EManagers, }),
        sortOrder: () => MakeSortOrderField({ authMap: xEventAuthMap_R_EOwn_EManagers, }),

        isOrdered: columnName => new BoolField({ columnName, defaultValue: true, authMap: xEventAuthMap_R_EOwn_EManagers, allowNull: false }),
        isActuallyPlayed: columnName => new BoolField({ columnName, defaultValue: false, authMap: xEventAuthMap_R_EOwn_EManagers, allowNull: false }),

        event: foreignRef(() => xEvent, {
            fkidMember: "eventId",
            requireVisibleTarget: true,
            authMap: xEventAuthMap_R_EOwn_EManagers,
        }),
        songs: memberName => new ForeignCollectionField({ memberName, foreignTableID: "EventSongListSong", authMap: xEventAuthMap_R_EOwn_EManagers }),
        dividers: memberName => new ForeignCollectionField({ memberName, foreignTableID: "EventSongListDivider", authMap: xEventAuthMap_R_EOwn_EManagers }),
    })
});



export const xEventSongListSong = db3.defineTable({
    prismaModel: db3.prismaModel<Prisma.EventSongListSongDelegate>(),
    getIdentity: (song: { publicId: EventSongListSongPublicId }) => song.publicId,
    getSelectionArgs: (): Prisma.EventSongListSongDefaultArgs => {
        return EventSongListSongArgs;
    },
    tableName: "EventSongListSong",
    bandScope: {
        inheritsBandFrom: "eventSongList",
        managePermission: Permission.manage_events
    },
    readConsistency: "snapshot",
    deletePolicy: "hard",
    queryParameters: {
        eventSongListId: { kind: "entityIdentity", targetTableID: "EventSongList", authorizeAs: "eventSongListId" },
    },
    naturalOrderBy: EventSongListSongNaturalOrderBy,
    tableAuthMap: xEventTableAuthMap_R_EManagers,
    getRowInfo: (row: EventSongListSongPayload) => ({
        pk: row.publicId,
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
    fields: db3.makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "sysadmin" }),
        publicId: () => MakePublicIdField<EventSongListSongPublicId>(),
        subtitle: columnName => MakeNullableRawTextField(columnName, { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        sortOrder: () => MakeSortOrderField({ authMap: xEventAuthMap_R_EOwn_EManagers, }),
        song: foreignRef(() => xSong, {
            fkidMember: "songId",
            requireVisibleTarget: true,
            authMap: xEventAuthMap_R_EOwn_EManagers,
        }),
        eventSongList: foreignRef(() => xEventSongList, {
            fkidMember: "eventSongListId",
            requireVisibleTarget: true,
            authMap: xEventAuthMap_R_EOwn_EManagers,
        }),
    })
});



export const xEventSongListDivider = db3.defineTable({
    prismaModel: db3.prismaModel<Prisma.EventSongListDividerDelegate>(),
    getIdentity: (divider: { publicId: EventSongListDividerPublicId }) => divider.publicId,
    getSelectionArgs: (): Prisma.EventSongListDividerDefaultArgs => {
        return EventSongListDividerArgs;
    },
    tableName: "EventSongListDivider",
    bandScope: {
        inheritsBandFrom: "eventSongList",
        managePermission: Permission.manage_events
    },
    readConsistency: "snapshot",
    deletePolicy: "hard",
    queryParameters: {
        eventSongListId: { kind: "entityIdentity", targetTableID: "EventSongList", authorizeAs: "eventSongListId" },
    },
    naturalOrderBy: EventSongListSongNaturalOrderBy, // yea i can borrow this.
    tableAuthMap: xEventTableAuthMap_R_EManagers,
    getRowInfo: (row: EventSongListDividerPayload) => ({
        pk: row.publicId,
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
    fields: db3.makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "sysadmin" }),
        publicId: () => MakePublicIdField<EventSongListDividerPublicId>(),
        subtitle: columnName => MakeNullableRawTextField(columnName, { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        sortOrder: () => MakeSortOrderField({ authMap: xEventAuthMap_R_EOwn_EManagers, }),
        color: () => MakeColorField({ authMap: xEventAuthMap_R_EOwn_EManagers, }),
        isSong: columnName => new BoolField({ columnName, defaultValue: false, authMap: xEventAuthMap_R_EOwn_EManagers, allowNull: false }),
        subtitleIfSong: columnName => MakeNullableRawTextField(columnName, { authMap: xEventAuthMap_R_EOwn_EManagers, }),
        lengthSeconds: columnName => new GenericIntegerField({ columnName, allowNull: true, authMap: xEventAuthMap_R_EOwn_EManagers, }),

        isInterruption: columnName => new BoolField({ columnName, defaultValue: true, authMap: xEventAuthMap_R_EOwn_EManagers, allowNull: false }),
        textStyle: columnName => new ConstEnumStringField({ allowNull: true, authMap: xEventAuthMap_R_EOwn_EManagers, columnName, defaultValue: EventSongListDividerTextStyle.Default, options: EventSongListDividerTextStyle }),
        eventSongList: foreignRef(() => xEventSongList, {
            fkidMember: "eventSongListId",
            requireVisibleTarget: true,
            authMap: xEventAuthMap_R_EOwn_EManagers,
        }),
    })
});

// statically-typed registration
// allows retaining type information even when looking up a table by
// static string table id.
declare module "../db3core" {
    interface DB3TableTypeRegistry {
        Event: typeof xEvent;
        EventTagAssignment: typeof xEventTagAssignment;
        EventSegment: typeof xEventSegment;
        EventSegmentUserResponse: typeof xEventSegmentUserResponse;
        EventSongList: typeof xEventSongList;
        EventSongListSong: typeof xEventSongListSong;
        EventSongListDivider: typeof xEventSongListDivider;
        EventUserResponse: typeof xEventUserResponse;
    }
}






export const EventResponses_MinimalEventUserResponseArgs = Prisma.validator<Prisma.EventUserResponseFindManyArgs>()({
    select: {
        bandInstrumentId: true,
        isInvited: true,
        userComment: true,
        bandUserId: true,
    }
});
type EventResponses_MinimalEventUserResponseDb = Prisma.EventUserResponseGetPayload<
    typeof EventResponses_MinimalEventUserResponseArgs
>;
export type EventResponses_MinimalEventUserResponse = Omit<
    EventResponses_MinimalEventUserResponseDb,
    "bandInstrumentId" | "bandUserId"
> & {
    // Attendance lookups use public catalog references after server projection.
    bandInstrumentId: InstrumentPublicId | null;
    bandUserId: BandUserPublicId;
};

export const EventResponses_MinimalEventSegmentUserResponseArgs = Prisma.validator<Prisma.EventSegmentUserResponseFindManyArgs>()({
    select: {
        attendanceId: true,
        bandUserId: true,
    }
});
export type EventResponses_MinimalEventSegmentUserResponse = Omit<
    Prisma.EventSegmentUserResponseGetPayload<typeof EventResponses_MinimalEventSegmentUserResponseArgs>, "attendanceId" | "bandUserId"
> & { attendanceId: EventAttendancePublicId | null; bandUserId: BandUserPublicId };



export const EventResponses_MinimalEventSegmentArgs = Prisma.validator<Prisma.EventSegmentFindManyArgs>()({
    select: {
        publicId: true,
        responses: EventResponses_MinimalEventSegmentUserResponseArgs,
        name: true, // for attendance control
        startsAt: true, // for attendance control
        durationMillis: true, // for attendance control
        isAllDay: true, // for attendance control
        statusId: true,
    }
});
type EventResponses_MinimalEventSegmentDb = Prisma.EventSegmentGetPayload<typeof EventResponses_MinimalEventSegmentArgs>;
export type EventResponses_MinimalEventSegment = Omit<EventResponses_MinimalEventSegmentDb, "publicId" | "statusId" | "responses"> & {
    publicId: EventSegmentPublicId;
    responses: EventResponses_MinimalEventSegmentUserResponse[];
    // Shared attendance algorithms also run against trusted server/test rows.
    // Concrete client views narrow this union to EventStatusPublicId.
    statusId: number | EventStatusPublicId | null;
};


type EventResponses_MinimalEventDb = Prisma.EventGetPayload<{
    select: {
        publicId: true,
        responses: typeof EventResponses_MinimalEventUserResponseArgs,
        segments: {
            select: {
                publicId: true,
                responses: typeof EventResponses_MinimalEventSegmentUserResponseArgs,
            }
        }
    }
}>;
export type EventResponses_MinimalEvent = Omit<EventResponses_MinimalEventDb, "publicId" | "responses" | "segments"> & {
    publicId: EventPublicId;
    segments: { publicId: EventSegmentPublicId; responses: EventResponses_MinimalEventSegmentUserResponse[] }[];
    responses: EventResponses_MinimalEventUserResponse[];
};

export interface EventUserResponse<TEvent extends EventResponses_MinimalEvent, TResponse extends EventResponses_MinimalEventUserResponse> {
    event: TEvent;
    user: EventParticipant;
    response: TResponse;

    // calculated invitation status -- can derive from either tag membership or explicit individual invitation.
    // response.isInvited may differ
    isInvited: boolean;

    // if the user is invited, they are relevant for display; show them.
    // if the user is not invited but has responded, show them.
    isRelevantForDisplay: boolean;

    instrument: InstrumentDashboardClient | null;
};

export interface EventSegmentUserResponse<
    TEventSegment extends EventResponses_MinimalEventSegment,
    TSegmentResponse extends EventResponses_MinimalEventSegmentUserResponse,
> {
    segment: TEventSegment;
    user: EventParticipant;
    response: TSegmentResponse;
};
