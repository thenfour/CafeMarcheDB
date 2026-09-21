import { Prisma } from "db";
import { ZodToPrismaSelection } from "@/shared/prismaUtils";
import { z } from "zod";
import { defineCrudView } from "../../core/db3CrudView";
import { defineView, type ClientOf, type DB3ViewSelectionContext, type DtoOf } from "../../core/db3View";
import { EventTagAssignmentNaturalOrderBy } from "../../schema/prismArgs";
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

const EventTypeEditorDtoSchema = z.object({
    id: z.number().int(),
    text: z.string().optional(),
    description: z.string().optional(),
    color: z.string().nullable().optional(),
    sortOrder: z.number().int().optional(),
    significance: z.string().nullable().optional(),
    iconName: z.string().nullable().optional(),
    isDeleted: z.boolean().optional(),
});

const EventStatusEditorDtoSchema = z.object({
    id: z.number().int(),
    label: z.string().optional(),
    description: z.string().optional(),
    color: z.string().nullable().optional(),
    sortOrder: z.number().int().optional(),
    significance: z.string().nullable().optional(),
    iconName: z.string().nullable().optional(),
    isDeleted: z.boolean().optional(),
});

const EventTagEditorDtoSchema = z.object({
    id: z.number().int(),
    text: z.string().optional(),
    description: z.string().optional(),
    color: z.string().nullable().optional(),
    sortOrder: z.number().int().optional(),
    significance: z.string().nullable().optional(),
    visibleOnFrontpage: z.boolean().optional(),
});

const EventAttendanceEditorDtoSchema = z.object({
    id: z.number().int(),
    isDeleted: z.boolean().optional(),
    text: z.string().optional(),
    personalText: z.string().optional(),
    pastText: z.string().optional(),
    pastPersonalText: z.string().optional(),
    description: z.string().optional(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
    iconName: z.string().nullable().optional(),
    color: z.string().nullable().optional(),
    strength: z.number().int().optional(),
});

export const eventTypeEditorView = defineCrudView({
    viewID: "EventType_Editor",
    entity: eventTypeEntity,
    operations: { create: true, update: true, delete: true },
    dtoSchema: EventTypeEditorDtoSchema,
    hydrate: dto => dto,
});

export const eventStatusEditorView = defineCrudView({
    viewID: "EventStatus_Editor",
    entity: eventStatusEntity,
    operations: { create: true, update: true, delete: true },
    dtoSchema: EventStatusEditorDtoSchema,
    hydrate: dto => dto,
});

export const eventTagEditorView = defineCrudView({
    viewID: "EventTag_Editor",
    entity: eventTagEntity,
    operations: { create: true, update: true, delete: true },
    dtoSchema: EventTagEditorDtoSchema,
    hydrate: dto => dto,
});

export const eventAttendanceEditorView = defineCrudView({
    viewID: "EventAttendance_Editor",
    entity: eventAttendanceEntity,
    operations: { create: true, update: true, delete: true },
    dtoSchema: EventAttendanceEditorDtoSchema,
    hydrate: dto => dto,
});

const EventEditorTypeDtoSchema = z.object({
    id: z.number().int(),
    text: z.string().optional(),
    description: z.string().optional(),
    color: z.string().nullable().optional(),
    sortOrder: z.number().int().optional(),
    significance: z.string().nullable().optional(),
    iconName: z.string().nullable().optional(),
});

const EventEditorStatusDtoSchema = z.object({
    id: z.number().int(),
    label: z.string().optional(),
    description: z.string().optional(),
    color: z.string().nullable().optional(),
    sortOrder: z.number().int().optional(),
    significance: z.string().nullable().optional(),
    iconName: z.string().nullable().optional(),
});

const EventSegmentEditorDtoSchema = z.object({
    id: z.number().int(),
    name: z.string().optional(),
    description: z.string().optional(),
    startsAt: z.date().nullable().optional(),
    durationMillis: z.bigint().optional(),
    isAllDay: z.boolean().optional(),
    statusId: z.number().int().nullable().optional(),
    status: EventEditorStatusDtoSchema.nullable().optional(),
    eventId: z.number().int().optional(),
    event: z.object({
        id: z.number().int(),
        name: z.string().optional(),
        startsAt: z.date().nullable().optional(),
        createdByUserId: z.number().int().nullable().optional(),
        type: EventEditorTypeDtoSchema.nullable().optional(),
    }).optional(),
});

export const eventSegmentEditorView = defineCrudView({
    viewID: "EventSegment_Editor",
    entity: eventSegmentEntity,
    operations: { create: true, update: true, delete: true },
    dtoSchema: EventSegmentEditorDtoSchema,
    hydrate: dto => dto,
});

const EventEditorTagDtoSchema = z.object({
    id: z.number().int(),
    text: z.string().optional(),
    description: z.string().optional(),
    color: z.string().nullable().optional(),
    sortOrder: z.number().int().optional(),
    significance: z.string().nullable().optional(),
    visibleOnFrontpage: z.boolean().optional(),
});

const EventEditorDtoSchema = z.object({
    id: z.number().int(),
    revision: z.number().int().optional(),
    name: z.string().optional(),
    startsAt: z.date().nullable().optional(),
    durationMillis: z.bigint().optional(),
    isAllDay: z.boolean().optional(),
    isDeleted: z.boolean().optional(),
    locationDescription: z.string().optional(),
    locationURL: z.string().optional(),
    createdAt: z.date().optional(),
    typeId: z.number().int().nullable().optional(),
    type: EventEditorTypeDtoSchema.nullable().optional(),
    statusId: z.number().int().nullable().optional(),
    status: EventEditorStatusDtoSchema.nullable().optional(),
    tags: z.array(z.object({
        id: z.number().int(),
        eventId: z.number().int().optional(),
        eventTagId: z.number().int().optional(),
        eventTag: EventEditorTagDtoSchema.optional(),
    })).optional(),
    segmentBehavior: z.string().nullable().optional(),
    expectedAttendanceUserTagId: z.number().int().nullable().optional(),
    expectedAttendanceUserTag: z.object({
        id: z.number().int(),
        text: z.string().optional(),
        description: z.string().optional(),
        color: z.string().nullable().optional(),
        sortOrder: z.number().int().optional(),
        cssClass: z.string().nullable().optional(),
        significance: z.string().nullable().optional(),
    }).nullable().optional(),
    createdByUserId: z.number().int().nullable().optional(),
    createdByUser: z.object({
        id: z.number().int(),
        name: z.string().optional(),
        cssClass: z.string().nullable().optional(),
    }).nullable().optional(),
    visiblePermissionId: z.number().int().nullable().optional(),
    visiblePermission: z.object({
        id: z.number().int(),
        name: z.string().optional(),
        description: z.string().optional(),
        isVisibility: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
        significance: z.string().nullable().optional(),
        color: z.string().nullable().optional(),
        iconName: z.string().nullable().optional(),
    }).nullable().optional(),
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
    hydrate: dto => dto,
});

const EventTagAssignmentDtoSchema = z.object({
    id: z.number().int(),
    eventTagId: z.number().int().optional(),
});

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
    startsAt: z.date().nullable().optional(),
    durationMillis: z.bigint().optional(),
    isAllDay: z.boolean().optional(),
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

// This is the requested maximum shape. Apart from transport identities, every
// field remains optional because recursive field authorization may remove it.
const EventSearchDtoSchema = z.object({
    id: z.number().int(),
    revision: z.number().int().optional(),
    name: z.string().optional(),
    typeId: z.number().int().nullable().optional(),
    locationDescription: z.string().optional(),
    locationURL: z.string().optional(),
    statusId: z.number().int().nullable().optional(),
    relevanceClassOverride: z.number().int().nullable().optional(),
    descriptionWikiPageId: z.number().int().nullable().optional(),
    segmentBehavior: z.string().nullable().optional(),
    startsAt: z.date().nullable().optional(),
    durationMillis: z.bigint().optional(),
    isAllDay: z.boolean().optional(),
    visiblePermissionId: z.number().int().nullable().optional(),
    expectedAttendanceUserTagId: z.number().int().nullable().optional(),
    tags: z.array(EventTagAssignmentDtoSchema).optional(),
    responses: z.array(EventUserResponseDtoSchema).optional(),
    segments: z.array(EventSegmentDtoSchema).optional(),
    songLists: z.array(z.object({ id: z.number().int() })).optional(),
    expectedAttendanceUserTag: EventExpectedAttendanceUserTagDtoSchema.nullable().optional(),
    descriptionWikiPage: EventDescriptionWikiPageDtoSchema.nullable().optional(),
});

export const eventSearchSelection = ({ authorization }: DB3ViewSelectionContext) => {
    // A named Event_Search view always carries responses for the actor making
    // the request. Client input never chooses whose responses are returned.
    const actorUserId = authorization.userId ?? -1;

    return Prisma.validator<Prisma.EventDefaultArgs>()({
        select: {
            id: true,
            revision: true,
            name: true,
            typeId: true,
            locationDescription: true,
            locationURL: true,
            statusId: true,
            relevanceClassOverride: true,
            descriptionWikiPageId: true,
            segmentBehavior: true,
            startsAt: true,
            durationMillis: true,
            isAllDay: true,
            createdByUserId: true,
            visiblePermissionId: true,
            isDeleted: true,
            expectedAttendanceUserTagId: true,
            tags: {
                select: {
                    id: true,
                    eventTagId: true,
                },
            },
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

export const eventSearchView = defineView({
    viewID: "Event_Search",
    entity: eventEntity,
    selection: eventSearchSelection,
    dtoSchema: EventSearchDtoSchema,
    hydrate: (dto, references) => {
        const { segments, ...eventDto } = dto;
        return {
            ...hydrateEventDateRange(eventDto),
            type: references.get(eventTypeEntity, dto.typeId),
            status: references.get(eventStatusEntity, dto.statusId),
            visiblePermission: references.get(permissionEntity, dto.visiblePermissionId),
            tags: references.mapOptionalCollection(dto.tags, (association, index) => ({
                ...association,
                eventTag: references.require(
                    eventTagEntity,
                    association.eventTagId,
                    `Event(${dto.id}).tags[${index}].eventTagId`,
                ),
            }))?.sort((a, b) => a.eventTag.sortOrder - b.eventTag.sortOrder),
            segments: references.mapOptionalCollection(segments, segment =>
                hydrateEventDateRange(segment)),
        };
    },
});

export type EventSearchDto = DtoOf<typeof eventSearchView>;
export type EventSearchClient = ClientOf<typeof eventSearchView>;
