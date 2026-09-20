import { Prisma } from "db";
import { z } from "zod";
import { defineView, type ClientOf, type DB3ViewSelectionContext, type DtoOf } from "../../core/db3View";
import { permissionEntity } from "../user/userEntities";
import { eventEntity, eventStatusEntity, eventTagEntity, eventTypeEntity } from "./eventEntities";

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
    hydrate: (dto, references) => ({
        ...dto,
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
    }),
    getIdentity: client => client.id,
});

export type EventSearchDto = DtoOf<typeof eventSearchView>;
export type EventSearchClient = ClientOf<typeof eventSearchView>;
