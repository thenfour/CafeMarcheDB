import { ZodToPrismaSelection } from "@/shared/prismaUtils";
import { Prisma } from "db";
import { z } from "zod";
import { defineCrudView } from "../../core/db3CrudView";
import type { DB3ReferenceProvider } from "../../core/db3Hydration";
import { defineView, type ClientOf, type DB3ViewSelectionContext, type DtoOf } from "../../core/db3View";
import { EventTagAssignmentNaturalOrderBy } from "../../schema/prismArgs";
import { db3s } from "../common/viewCommon";
import { permissionEntity } from "../user/userEntities";
import { hydrateEventDateRange } from "./eventDateRange";
import {
    eventAttendanceEntity,
    eventEntity,
    eventSegmentEntity,
    eventStatusEntity,
    eventTagEntity,
    eventTypeEntity,
} from "./eventEntities";

// event type ------------------------------------------
const EventTypeDtoSchema = z.object({
    ...db3s.id(),
    ...db3s.isDeleted(),
    ...db3s.descriptionColorSortOrder(),
    ...db3s.iconName(),

    text: db3s.authNeeded(z.string()),
    significance: db3s.authNeeded(z.string().nullable()),
});

export const eventTypeEditorView = defineCrudView({
    viewID: "EventType_Editor",
    entity: eventTypeEntity,
    operations: { create: true, update: true, delete: true },
    dtoSchema: EventTypeDtoSchema,
    hydrate: dto => eventTypeEntity.schema.getClientModel(dto, "view"),
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

export const eventStatusEditorView = defineCrudView({
    viewID: "EventStatus_Editor",
    entity: eventStatusEntity,
    operations: { create: true, update: true, delete: true },
    dtoSchema: EventStatusDtoSchema,
    hydrate: dto => eventStatusEntity.schema.getClientModel(dto, "view"),
});

// event tag ------------------------------------------
const EventTagEditorDtoSchema = z.object({
    ...db3s.id(),
    ...db3s.descriptionColorSortOrder(),

    text: z.string().optional(),
    significance: z.string().nullable().optional(),
    visibleOnFrontpage: z.boolean().optional(),
});

export const eventTagEditorView = defineCrudView({
    viewID: "EventTag_Editor",
    entity: eventTagEntity,
    operations: { create: true, update: true, delete: true },
    dtoSchema: EventTagEditorDtoSchema,
    hydrate: dto => eventTagEntity.schema.getClientModel(dto, "view"),
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
    entity: eventAttendanceEntity,
    operations: { create: true, update: true, delete: true },
    dtoSchema: EventAttendanceEditorDtoSchema,
    hydrate: dto => eventAttendanceEntity.schema.getClientModel(dto, "view"),
});

// event editor ------------------------------------------
// const EventEditorTypeDtoSchema = z.object({
//     id: z.number().int(),

//     description: z.string().optional(),
//     color: z.string().nullable().optional(),
//     sortOrder: z.number().int().optional(),
//     iconName: z.string().nullable().optional(),

//     text: z.string().optional(),
//     significance: z.string().nullable().optional(),
// });

// const EventEditorStatusDtoSchema = z.object({
//     id: z.number().int(),
//     label: z.string().optional(),
//     description: z.string().optional(),
//     color: z.string().nullable().optional(),
//     sortOrder: z.number().int().optional(),
//     significance: z.string().nullable().optional(),
//     iconName: z.string().nullable().optional(),
// });

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
    entity: eventSegmentEntity,
    operations: { create: true, update: true, delete: true },
    dtoSchema: EventSegmentEditorDtoSchema,
    hydrate: dto => eventSegmentEntity.schema.getClientModel(dto, "view"),
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
    entity: eventEntity,
    operations: { create: true, update: true, delete: true },
    selection: eventEditorSelection,
    dtoSchema: EventEditorDtoSchema,
    hydrate: dto => eventEntity.schema.getClientModel(dto, "view"),
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
    tags: z.array(z.object({
        id: z.number().int(),
        eventTagId: z.number().int(), // not optional;  if you have access to view the tag, assume you can see its identity
    })).optional(),
};

const EventSearchDtoSchema = z.object({
    ...EventBasicSchema,

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
});

// const EventFrontpageDtoSchema = EventSearchDtoSchema.pick({
//     id: true,
//     name: true,
//     typeId: true,
//     locationDescription: true,
//     statusId: true,
//     relevanceClassOverride: true,
//     startsAt: true,
//     durationMillis: true,
//     isAllDay: true,
//     visiblePermissionId: true,
//     tags: true,
// }).extend({
// });

// export const eventFrontpageSelection =
//     Prisma.validator<Prisma.EventDefaultArgs>()(ZodToPrismaSelection(EventFrontpageDtoSchema));

// export const eventFrontpageSelection = Prisma.validator<Prisma.EventDefaultArgs>()({
//     select: {
//         id: true,
//         name: true,
//         typeId: true,
//         locationDescription: true,
//         statusId: true,
//         relevanceClassOverride: true,
//         startsAt: true,
//         durationMillis: true,
//         isAllDay: true,
//         createdByUserId: true,
//         visiblePermissionId: true,
//         tags: {
//             select: {
//                 id: true,
//                 eventTagId: true,
//             },
//         },

//         isDeleted: true,
//         frontpageVisible: true,
//         frontpageDate: true,
//         frontpageTime: true,
//         frontpageDetails: true,
//         frontpageTitle: true,
//         frontpageLocation: true,
//         frontpageLocationURI: true,
//         frontpageTags: true,
//         frontpageDate_nl: true,
//         frontpageTime_nl: true,
//         frontpageDetails_nl: true,
//         frontpageTitle_nl: true,
//         frontpageLocation_nl: true,
//         frontpageLocationURI_nl: true,
//         frontpageTags_nl: true,
//         frontpageDate_fr: true,
//         frontpageTime_fr: true,
//         frontpageDetails_fr: true,
//         frontpageTitle_fr: true,
//         frontpageLocation_fr: true,
//         frontpageLocationURI_fr: true,
//         frontpageTags_fr: true,
//     },
// });

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
        type: references.get(eventTypeEntity, dto.typeId),
        status: references.get(eventStatusEntity, dto.statusId),
        visiblePermission: references.get(permissionEntity, dto.visiblePermissionId),
        tags: references.mapOptionalCollection(tags, (association, index) => ({
            ...association,
            eventTag: references.require(
                eventTagEntity,
                association.eventTagId,
                `Event(${dto.id}).tags[${index}].eventTagId`,
            ),
        }))?.sort((a, b) => a.eventTag.sortOrder - b.eventTag.sortOrder),
    };
}

export const eventSearchView = defineView({
    viewID: "Event_Search",
    entity: eventEntity,
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
    entity: eventEntity,
    dtoSchema: EventFrontpageDtoSchema,
    // do not use references; the server has no reference provider
    hydrate: (dto, _) => ({
        ...hydrateEventDateRange(dto),
    }),
});

export type EventSearchDto = DtoOf<typeof eventSearchView>;
export type EventSearchClient = ClientOf<typeof eventSearchView>;
export type EventFrontpageDto = DtoOf<typeof eventFrontpageView>;
export type EventFrontpageClient = ClientOf<typeof eventFrontpageView>;
