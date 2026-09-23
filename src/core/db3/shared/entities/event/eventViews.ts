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

export const eventTypeEditorSelection = Prisma.validator<Prisma.EventTypeDefaultArgs>()({
    select: {
        id: true,
        isDeleted: true,
        description: true,
        color: true,
        sortOrder: true,
        iconName: true,
        text: true,
        significance: true,
    },
});

const eventTypeViewContract = deriveViewContract(
    xEventType,
    eventTypeEditorSelection,
);

export const eventTypeEditorView = defineCrudView({
    viewID: "EventType_Editor",
    entity: xEventType,
    operations: { create: true, update: true, delete: true },
    selection: eventTypeViewContract.prismaSelection,
    dtoSchema: eventTypeViewContract.dtoSchema,
    hydrate: eventTypeViewContract.hydrate,
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

// event tag ------------------------------------------
export const eventTagEditorSelection = Prisma.validator<Prisma.EventTagDefaultArgs>()({
    select: {
        id: true,
        description: true,
        color: true,
        sortOrder: true,
        text: true,
        significance: true,
        visibleOnFrontpage: true,
    },
});

const eventTagViewContract = deriveViewContract(
    xEventTag,
    eventTagEditorSelection,
);

export const eventTagEditorView = defineCrudView({
    viewID: "EventTag_Editor",
    entity: xEventTag,
    operations: { create: true, update: true, delete: true },
    selection: eventTagViewContract.prismaSelection,
    dtoSchema: eventTagViewContract.dtoSchema,
    hydrate: eventTagViewContract.hydrate,
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

export const eventFrontpageSelection = Prisma.validator<Prisma.EventDefaultArgs>()({
    select: {
        id: true,
        name: true,
        typeId: true,
        locationDescription: true,
        locationURL: true,
        statusId: true,
        relevanceClassOverride: true,
        startsAt: true,
        durationMillis: true,
        isAllDay: true,
        visiblePermissionId: true,
        frontpageVisible: true,
        frontpageDate: true,
        frontpageTime: true,
        frontpageDetails: true,
        frontpageTitle: true,
        frontpageLocation: true,
        frontpageLocationURI: true,
        frontpageTags: true,
        frontpageDate_nl: true,
        frontpageTime_nl: true,
        frontpageDetails_nl: true,
        frontpageTitle_nl: true,
        frontpageLocation_nl: true,
        frontpageLocationURI_nl: true,
        frontpageTags_nl: true,
        frontpageDate_fr: true,
        frontpageTime_fr: true,
        frontpageDetails_fr: true,
        frontpageTitle_fr: true,
        frontpageLocation_fr: true,
        frontpageLocationURI_fr: true,
        frontpageTags_fr: true,
        type: {
            select: {
                id: true,
                isDeleted: true,
                description: true,
                color: true,
                sortOrder: true,
                iconName: true,
                text: true,
                significance: true,
            },
        },
        status: {
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
        },
        tags: {
            orderBy: EventTagAssignmentNaturalOrderBy,
            select: {
                id: true,
                eventTagId: true,
                eventTag: {
                    select: {
                        id: true,
                        description: true,
                        color: true,
                        sortOrder: true,
                        visibleOnFrontpage: true,
                        text: true,
                        significance: true,
                    },
                },
            },
        },
    },
});

const eventFrontpageViewContract = deriveViewContract(
    xEvent,
    eventFrontpageSelection,
);

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
    selection: eventFrontpageViewContract.prismaSelection,
    dtoSchema: eventFrontpageViewContract.dtoSchema,
    // The public API deliberately supplies an empty reference provider. All
    // consumer relations are embedded; the optional visiblePermissionId stays
    // normalized when that table is not registered.
    hydrate: (dto, references) => hydrateEventDateRange(
        eventFrontpageViewContract.hydrate(dto, references),
    ),
});

export type EventSearchDto = DtoOf<typeof eventSearchView>;
export type EventSearchClient = ClientOf<typeof eventSearchView>;

//type aoeu = EventSearchClient["status"];

export type EventFrontpageDto = DtoOf<typeof eventFrontpageView>;
export type EventFrontpageClient = ClientOf<typeof eventFrontpageView>;
//type aoeus = EventFrontpageClient;
