import { ZodToPrismaSelection } from "@/shared/prismaUtils";
import { Prisma } from "db";
import { z } from "zod";
import { defineCrudView } from "../../core/db3CrudView";
import type { DB3ReferenceProvider } from "../../core/db3Hydration";
import { defineView, type ClientOf, type DB3ViewSelectionContext, type DtoOf } from "../../core/db3View";
import { deriveViewContract } from "../../core/db3ViewContract";
import { EventTagAssignmentNaturalOrderBy } from "../../schema/prismArgs";
import { db3s } from "../common/viewCommon";
import { xPermission } from "../../schema/user";
import { hydrateEventDateRange } from "./eventDateRange";
import {
    xEventAttendance,
    xEvent,
    xEventSegment,
    xEventStatus,
    xEventTag,
    xEventType,
} from "../../schema/event";

// event type ------------------------------------------
const EventTypeDtoSchema = z.object({
    ...db3s.id(),
    ...db3s.isDeleted(),
    ...db3s.descriptionColorSortOrder(),
    ...db3s.iconName(),

    text: db3s.authNeeded(z.string()),
    significance: db3s.authNeeded(z.string().nullable()),
});

// the dto can contain many undefined fields due to auth stripping.
// but many components want a complete payload with all fields present.
// this is temporary; i want to improve our xTable schema to understand when
// fields are guaranteed to be present if the row is returned.
type EventTypeWithUndefineds = z.infer<typeof EventTypeDtoSchema>;
const EventTypeArgs = ZodToPrismaSelection(EventTypeDtoSchema);
type EventTypeConcrete = Prisma.EventTypeGetPayload<typeof EventTypeArgs>;
const coalesceEventType = (inp: EventTypeWithUndefineds | null | undefined): EventTypeConcrete | null => {
    if (!inp) return null;
    return {
        id: inp.id,
        isDeleted: inp.isDeleted ?? false,
        description: inp.description ?? "",
        color: inp.color ?? "",
        sortOrder: inp.sortOrder ?? 0,
        iconName: inp.iconName ?? "",
        text: inp.text ?? "",
        significance: inp.significance ?? null,
    };
};

export const eventTypeEditorView = defineCrudView({
    viewID: "EventType_Editor",
    entity: xEventType,
    operations: { create: true, update: true, delete: true },
    dtoSchema: EventTypeDtoSchema,
    hydrate: dto => xEventType.getClientModel(dto, "view"),
});

// event status ------------------------------------------
const EventStatusDtoSchema = z.object({
    ...db3s.id(),
    ...db3s.isDeleted(),
    ...db3s.descriptionColorSortOrder(),
    ...db3s.iconName(),

    label: z.string().optional(),
    significance: z.string().nullable().optional(),
});

// the dto can contain many undefined fields due to auth stripping.
// but many components want a complete payload with all fields present.
// this is temporary; i want to improve our xTable schema to understand when
// fields are guaranteed to be present if the row is returned.
type EventStatusWithUndefineds = z.infer<typeof EventStatusDtoSchema>;
const EventStatusArgs = ZodToPrismaSelection(EventStatusDtoSchema);
type EventStatusConcrete = Prisma.EventStatusGetPayload<typeof EventStatusArgs>;
const coalesceEventStatus = (inp: EventStatusWithUndefineds | null | undefined): EventStatusConcrete | null => {
    if (!inp) return null;
    return {
        id: inp.id,
        isDeleted: inp.isDeleted ?? false,
        description: inp.description ?? "",
        color: inp.color ?? "",
        sortOrder: inp.sortOrder ?? 0,
        iconName: inp.iconName ?? "",
        label: inp.label ?? "",
        significance: inp.significance ?? null,
    };
};


export const eventStatusEditorSelection = Prisma.validator<Prisma.EventStatusDefaultArgs>()({
    select: {
        id: true,
        isDeleted: true,
        description: true,
        color: true,
        sortOrder: true,
        iconName: true,
        label: true,
        significance: true,
    },
});

const eventStatusViewContract = deriveViewContract(
    xEventStatus,
    eventStatusEditorSelection,
);

export const eventStatusEditorView = defineCrudView({
    viewID: "EventStatus_Editor",
    entity: xEventStatus,
    operations: { create: true, update: true, delete: true },
    selection: eventStatusViewContract.prismaSelection,
    dtoSchema: eventStatusViewContract.dtoSchema,
    hydrate: eventStatusViewContract.hydrate,
});

// type aoeu = typeof eventStatusEditorView.dtoSchema;

// event tag ------------------------------------------
const EventTagEditorDtoSchema = z.object({
    ...db3s.id(),
    ...db3s.descriptionColorSortOrder(),

    text: z.string().optional(),
    significance: z.string().nullable().optional(),
    visibleOnFrontpage: z.boolean().optional(),
});


// the dto can contain many undefined fields due to auth stripping.
// but many components want a complete payload with all fields present.
// this is temporary; i want to improve our xTable schema to understand when
// fields are guaranteed to be present if the row is returned.
type EventTagWithUndefineds = z.infer<typeof EventTagEditorDtoSchema>;
const EventTagArgs = ZodToPrismaSelection(EventTagEditorDtoSchema);
type EventTagConcrete = Prisma.EventTagGetPayload<typeof EventTagArgs>;

const coalesceEventTag = (inp: EventTagWithUndefineds): EventTagConcrete => {
    //if (!inp) return null;
    return {
        id: inp.id,
        description: inp.description ?? "",
        color: inp.color ?? "",
        sortOrder: inp.sortOrder ?? 0,
        text: inp.text ?? "",
        significance: inp.significance ?? null,
        visibleOnFrontpage: inp.visibleOnFrontpage ?? false,
    };
};

type EventTagAssociationWithUndefineds = {
    id: number;
    eventTagId: number;
    eventTag: EventTagWithUndefineds;
};

type EventTagAssociationConcrete = {
    id: number;
    eventTagId: number;
    eventTag: EventTagConcrete;
};

const coalesceEventTags = (inp: EventTagAssociationWithUndefineds[] | null | undefined): EventTagAssociationConcrete[] => {
    if (!inp) return [];
    return (inp ?? []).map(x => ({
        id: x.id,
        eventTagId: x.eventTagId,
        eventTag: coalesceEventTag(x.eventTag),
    }));
};

export const eventTagEditorView = defineCrudView({
    viewID: "EventTag_Editor",
    entity: xEventTag,
    operations: { create: true, update: true, delete: true },
    dtoSchema: EventTagEditorDtoSchema,
    hydrate: dto => xEventTag.getClientModel(dto, "view"),
});

// event attendance ------------------------------------------
const EventAttendanceEditorDtoSchema = z.object({
    ...db3s.id(),
    ...db3s.isDeleted(),

    ...db3s.descriptionColorSortOrder(),
    ...db3s.iconName(),

    text: z.string().optional(),
    personalText: z.string().optional(),
    pastText: z.string().optional(),
    pastPersonalText: z.string().optional(),
    isActive: z.boolean().optional(),
    strength: z.number().int().optional(),
});

export const eventAttendanceEditorView = defineCrudView({
    viewID: "EventAttendance_Editor",
    entity: xEventAttendance,
    operations: { create: true, update: true, delete: true },
    dtoSchema: EventAttendanceEditorDtoSchema,
    hydrate: dto => xEventAttendance.getClientModel(dto, "view"),
});

// event editor ------------------------------------------

// over model EventSegment
const EventSegmentEditorDtoSchema = z.object({
    id: z.number().int(),
    name: z.string().optional(),
    description: z.string().optional(),

    ...db3s.dateRange(),

    statusId: z.number().int().nullable().optional(),
    status: EventStatusDtoSchema.nullable().optional(),

    eventId: z.number().int().optional(),
    event: z.object({
        id: z.number().int(),
        name: z.string().optional(),
        startsAt: z.date().nullable().optional(),
        createdByUserId: z.number().int().nullable().optional(),
        type: EventTypeDtoSchema.nullable().optional(),
    }).optional(),
});

export const eventSegmentEditorView = defineCrudView({
    viewID: "EventSegment_Editor",
    entity: xEventSegment,
    operations: { create: true, update: true, delete: true },
    dtoSchema: EventSegmentEditorDtoSchema,
    hydrate: dto => xEventSegment.getClientModel(dto, "view"),
});


const EventEditorTagDtoSchema = z.object({
    ...db3s.id(),
    text: z.string().optional(),
    ...db3s.descriptionColorSortOrder(),
    significance: z.string().nullable().optional(),
    visibleOnFrontpage: z.boolean().optional(),
});

const EventEditorDtoSchema = z.object({
    ...db3s.id(),
    ...db3s.isDeleted(),
    revision: z.number().int().optional(),

    name: z.string().optional(),
    locationDescription: z.string().optional(),
    locationURL: z.string().optional(),
    segmentBehavior: z.string().nullable().optional(),

    ...db3s.dateRange(),

    typeId: z.number().int().nullable().optional(),
    type: EventTypeDtoSchema.nullable().optional(),

    statusId: z.number().int().nullable().optional(),
    status: EventStatusDtoSchema.nullable().optional(),

    tags: z.array(z.object({
        id: z.number().int(),
        eventId: z.number().int().optional(),
        eventTagId: z.number().int().optional(),
        eventTag: EventEditorTagDtoSchema.optional(),
    })).optional(),

    expectedAttendanceUserTagId: z.number().int().nullable().optional(),
    expectedAttendanceUserTag: z.object({
        ...db3s.id(),
        text: z.string().optional(),
        ...db3s.descriptionColorSortOrder(),
        cssClass: z.string().nullable().optional(),
        significance: z.string().nullable().optional(),
    }).nullable().optional(),

    createdAt: z.date().optional(),

    ...db3s.createdByUserId(),
    ...db3s.createdByUser(),

    ...db3s.visiblePermissionId(),
    ...db3s.visiblePermission(),

    frontpageVisible: z.boolean().optional(),
    frontpageDate: z.string().optional(),
    frontpageTime: z.string().optional(),
    frontpageDetails: z.string().optional(),
    frontpageTitle: z.string().nullable().optional(),
    frontpageLocation: z.string().nullable().optional(),
    frontpageLocationURI: z.string().nullable().optional(),
    frontpageTags: z.string().nullable().optional(),
});

const eventEditorBaseSelection = ZodToPrismaSelection(EventEditorDtoSchema);
const eventEditorSelection = Prisma.validator<Prisma.EventDefaultArgs>()({
    select: {
        ...eventEditorBaseSelection.select,
        tags: {
            ...eventEditorBaseSelection.select.tags,
            orderBy: EventTagAssignmentNaturalOrderBy,
        },
    },
});

export const eventEditorView = defineCrudView({
    viewID: "Event_Editor",
    entity: xEvent,
    operations: { create: true, update: true, delete: true },
    selection: eventEditorSelection,
    dtoSchema: EventEditorDtoSchema,
    hydrate: dto => xEvent.getClientModel(dto, "view"),
});

// const EventTagAssignmentDtoSchema = z.object({
//     id: z.number().int(),
//     eventTagId: z.number().int().optional(),
// });

const EventUserResponseDtoSchema = z.object({
    id: z.number().int(),
    userId: z.number().int().optional(),
    instrumentId: z.number().int().nullable().optional(),
    isInvited: z.boolean().nullable().optional(),
    userComment: z.string().nullable().optional(),
});

const EventSegmentUserResponseDtoSchema = z.object({
    id: z.number().int(),
    userId: z.number().int().optional(),
    attendanceId: z.number().int().nullable().optional(),
});

const EventSegmentDtoSchema = z.object({
    id: z.number().int(),
    name: z.string().optional(),

    ...db3s.dateRange(),

    statusId: z.number().int().nullable().optional(),
    responses: z.array(EventSegmentUserResponseDtoSchema).optional(),
});

const EventExpectedAttendanceUserTagDtoSchema = z.object({
    id: z.number().int(),
    userAssignments: z.array(z.object({
        id: z.number().int(),
        userId: z.number().int().optional(),
    })).optional(),
});

const EventDescriptionWikiPageDtoSchema = z.object({
    id: z.number().int(),
    currentRevision: z.object({
        id: z.number().int(),
        content: z.string().optional(),
    }).nullable().optional(),
});

// a sort of minimum event shape
const EventBasicSchema = {
    ...db3s.id(),
    name: z.string().optional(),
    typeId: z.number().int().nullable().optional(),
    locationDescription: z.string().optional(),
    locationURL: z.string().optional(),
    statusId: z.number().int().nullable().optional(),
    relevanceClassOverride: z.number().int().nullable().optional(),

    ...db3s.dateRange(),
    visiblePermissionId: z.number().int().nullable().optional(),
};

const EventSearchDtoSchema = z.object({
    ...EventBasicSchema,
    tags: z.array(z.object({
        id: z.number().int(),
        eventTagId: z.number().int(), // not optional;  if you have access to view the tag, assume you can see its identity
    })).optional(),

    //id: z.number().int(),
    revision: z.number().int().optional(),
    // name: z.string().optional(),
    // typeId: z.number().int().nullable().optional(),
    // locationDescription: z.string().optional(),
    //statusId: z.number().int().nullable().optional(),
    //relevanceClassOverride: z.number().int().nullable().optional(),
    descriptionWikiPageId: z.number().int().nullable().optional(),
    segmentBehavior: z.string().nullable().optional(),

    //...db3s.dateRange(),
    //tags: z.array(EventTagAssignmentDtoSchema).optional(),

    //visiblePermissionId: z.number().int().nullable().optional(),
    expectedAttendanceUserTagId: z.number().int().nullable().optional(),
    responses: z.array(EventUserResponseDtoSchema).optional(),
    segments: z.array(EventSegmentDtoSchema).optional(),
    songLists: z.array(z.object({ id: z.number().int() })).optional(),
    expectedAttendanceUserTag: EventExpectedAttendanceUserTagDtoSchema.nullable().optional(),
    descriptionWikiPage: EventDescriptionWikiPageDtoSchema.nullable().optional(),
});

const EventSearchSelection = Prisma.validator<Prisma.EventDefaultArgs>()(ZodToPrismaSelection(EventSearchDtoSchema));

export const eventSearchSelection = ({ authorization }: DB3ViewSelectionContext) => {
    // A named Event_Search view always carries responses for the actor making
    // the request. Client input never chooses whose responses are returned.
    const actorUserId = authorization.userId ?? -1;

    return Prisma.validator<Prisma.EventDefaultArgs>()({
        select: {
            ...EventSearchSelection.select,
            //id: true,
            //name: true,
            // typeId: true,
            // locationDescription: true,
            // locationURL: true,
            // statusId: true,
            //relevanceClassOverride: true,
            // startsAt: true,
            // durationMillis: true,
            // isAllDay: true,
            //visiblePermissionId: true,
            // tags: {
            //     select: {
            //         id: true,
            //         eventTagId: true,
            //     },
            // },
            revision: true,
            descriptionWikiPageId: true,
            segmentBehavior: true,
            createdByUserId: true,
            isDeleted: true,
            expectedAttendanceUserTagId: true,
            responses: {
                where: { userId: actorUserId },
                select: {
                    id: true,
                    userId: true,
                    instrumentId: true,
                    isInvited: true,
                    userComment: true,
                },
            },
            segments: {
                orderBy: { startsAt: "desc" },
                select: {
                    id: true,
                    name: true,
                    startsAt: true,
                    durationMillis: true,
                    isAllDay: true,
                    statusId: true,
                    responses: {
                        where: { userId: actorUserId },
                        select: {
                            id: true,
                            userId: true,
                            attendanceId: true,
                        },
                    },
                },
            },
            songLists: {
                select: { id: true },
            },
            expectedAttendanceUserTag: {
                select: {
                    id: true,
                    userAssignments: {
                        where: { userId: actorUserId },
                        select: {
                            id: true,
                            userId: true,
                        },
                    },
                },
            },
            descriptionWikiPage: {
                select: {
                    id: true,
                    createdByUserId: true,
                    visiblePermissionId: true,
                    currentRevision: {
                        select: {
                            id: true,
                            content: true,
                        },
                    },
                },
            },
        },
    });
};

const EventFrontpageSchema = {
    frontpageVisible: z.boolean().optional(),
    frontpageDate: z.string().optional(),
    frontpageTime: z.string().optional(),
    frontpageDetails: z.string().optional(),
    frontpageTitle: z.string().nullable().optional(),
    frontpageLocation: z.string().nullable().optional(),
    frontpageLocationURI: z.string().nullable().optional(),
    frontpageTags: z.string().nullable().optional(),
    frontpageDate_nl: z.string().nullable().optional(),
    frontpageTime_nl: z.string().nullable().optional(),
    frontpageDetails_nl: z.string().nullable().optional(),
    frontpageTitle_nl: z.string().nullable().optional(),
    frontpageLocation_nl: z.string().nullable().optional(),
    frontpageLocationURI_nl: z.string().nullable().optional(),
    frontpageTags_nl: z.string().nullable().optional(),
    frontpageDate_fr: z.string().nullable().optional(),
    frontpageTime_fr: z.string().nullable().optional(),
    frontpageDetails_fr: z.string().nullable().optional(),
    frontpageTitle_fr: z.string().nullable().optional(),
    frontpageLocation_fr: z.string().nullable().optional(),
    frontpageLocationURI_fr: z.string().nullable().optional(),
    frontpageTags_fr: z.string().nullable().optional(),
};

const EventFrontpageDtoSchema = z.object({
    ...EventBasicSchema,
    ...EventFrontpageSchema,
    // frontpage editing shares this schema, and wants minimal type & status.
    type: EventTypeDtoSchema.nullable().optional(),
    status: EventStatusDtoSchema.nullable().optional(),
    tags: z.array(z.object({
        id: z.number().int(),
        eventTagId: z.number().int(), // not optional; assume same auth as the tag itself
        eventTag: z.object({
            id: z.number().int(),
            visibleOnFrontpage: z.boolean().optional(),
            text: z.string().optional(),
        }),
    })).optional(),
});


interface HydratableEventSummaryDto {
    id: number;
    startsAt?: Date | null;
    durationMillis?: bigint;
    isAllDay?: boolean;
    typeId?: number | null;
    statusId?: number | null;
    visiblePermissionId?: number | null;
    //tags?: z.infer<typeof EventTagAssignmentDtoSchema>[];
    tags?: {
        id: number;
        eventTagId: number;
    }[];
}

function hydrateEventSummaryDto<TDto extends HydratableEventSummaryDto>(
    dto: TDto,
    references: DB3ReferenceProvider,
) {
    const { tags, ...eventDto } = dto;
    return {
        ...hydrateEventDateRange(eventDto),
        type: references.get(xEventType, dto.typeId),
        status: references.get(xEventStatus, dto.statusId),
        visiblePermission: references.get(xPermission, dto.visiblePermissionId),
        tags: references.mapOptionalCollection(tags, (association, index) => ({
            ...association,
            eventTag: references.require(
                xEventTag,
                association.eventTagId,
                `Event(${dto.id}).tags[${index}].eventTagId`,
            ),
        }))?.sort((a, b) => a.eventTag.sortOrder - b.eventTag.sortOrder),
    };
}

export const eventSearchView = defineView({
    viewID: "Event_Search",
    entity: xEvent,
    selection: eventSearchSelection,
    dtoSchema: EventSearchDtoSchema,
    hydrate: (dto, references) => {
        const { segments, ...eventDto } = dto;
        return {
            ...hydrateEventSummaryDto(eventDto, references),
            segments: references.mapOptionalCollection(segments, segment =>
                hydrateEventDateRange(segment)),
        };
    },
});

export const eventFrontpageView = defineView({
    viewID: "Event_Frontpage",
    entity: xEvent,
    dtoSchema: EventFrontpageDtoSchema,
    // do not use references; the server has no reference provider.
    // coalesce type/status fields
    hydrate: (dto, _) => ({
        ...hydrateEventDateRange(dto),
        type: coalesceEventType(dto.type),
        status: coalesceEventStatus(dto.status),
        tags: coalesceEventTags(dto.tags),
    }),
});

export type EventSearchDto = DtoOf<typeof eventSearchView>;
export type EventSearchClient = ClientOf<typeof eventSearchView>;

//type aoeu = EventSearchClient["status"];

export type EventFrontpageDto = DtoOf<typeof eventFrontpageView>;
export type EventFrontpageClient = ClientOf<typeof eventFrontpageView>;
//type aoeus = EventFrontpageClient;
