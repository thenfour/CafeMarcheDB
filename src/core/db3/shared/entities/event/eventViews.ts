import { ZodToPrismaSelection } from "@/shared/prismaUtils";
import { Prisma } from "db";
import { z } from "zod";
import { isPublicId, type EventStatusPublicId, type EventTagAssignmentPublicId, type EventTagPublicId, type EventTypePublicId, type UserTagPublicId } from "shared/publicId";
import { defineCrudView } from "../../core/db3CrudView";
import { defineView, type ClientOf, type DB3ViewSelectionContext, type DtoOf } from "../../core/db3View";
import { deriveViewContract } from "../../core/db3ViewContract";
import { EventTagAssignmentNaturalOrderBy } from "../../schema/prismArgs";
import { db3s, graft } from "../common/viewCommon";
import { hydrateEventDateRange } from "./eventDateRange";
import { dashboardReferenceContract } from "../../references/dashboardReferences";
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
    publicId: z.custom<EventTypePublicId>(isPublicId),
    ...db3s.isDeleted(),
    ...db3s.descriptionColorSortOrder(),
    ...db3s.iconName(),

    text: db3s.authNeeded(z.string()),
    significance: db3s.authNeeded(z.string().nullable()),
});

export const eventTypeEditorSelection = Prisma.validator<Prisma.EventTypeDefaultArgs>()({
    select: {
        publicId: true,
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
    publicId: z.custom<EventStatusPublicId>(isPublicId),
    ...db3s.isDeleted(),
    ...db3s.descriptionColorSortOrder(),
    ...db3s.iconName(),

    label: z.string().optional(),
    significance: z.string().nullable().optional(),
});

export const eventStatusEditorSelection = Prisma.validator<Prisma.EventStatusDefaultArgs>()({
    select: {
        publicId: true,
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
        publicId: true,
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

    statusId: z.custom<EventStatusPublicId>(isPublicId).nullable().optional(),
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
    publicId: z.custom<EventTagPublicId>(isPublicId),
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

    typeId: z.custom<EventTypePublicId>(isPublicId).nullable().optional(),
    type: EventTypeDtoSchema.nullable().optional(),

    statusId: z.custom<EventStatusPublicId>(isPublicId).nullable().optional(),
    status: EventStatusDtoSchema.nullable().optional(),

    tags: z.array(z.object({
        publicId: z.custom<EventTagAssignmentPublicId>(isPublicId),
        eventId: z.number().int().optional(),
        eventTagId: z.custom<EventTagPublicId>(isPublicId).optional(),
        eventTag: EventEditorTagDtoSchema.optional(),
    })).optional(),

    expectedAttendanceUserTagId: z.custom<UserTagPublicId>(isPublicId).nullable().optional(),
    expectedAttendanceUserTag: z.object({
        publicId: z.custom<UserTagPublicId>(isPublicId),
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

const eventSearchTransportSelection = Prisma.validator<Prisma.EventDefaultArgs>()({
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
        tags: {
            select: {
                publicId: true,
                eventTagId: true,
            },
        },
        revision: true,
        descriptionWikiPageId: true,
        segmentBehavior: true,
        expectedAttendanceUserTagId: true,
        responses: {
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
                publicId: true,
                userAssignments: {
                    select: {
                        userId: true,
                    },
                },
            },
        },
        descriptionWikiPage: {
            select: {
                id: true,
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

const makeEventSearchSelection = (actorUserId: number) => (
    Prisma.validator<Prisma.EventDefaultArgs>()(
        graft(eventSearchTransportSelection, {
            select: {
                createdByUserId: true,
                isDeleted: true,
                type: { select: { publicId: true } },
                status: { select: { publicId: true } },
                tags: {
                    select: {
                        eventTag: { select: { publicId: true } },
                    },
                },
                responses: {
                    where: { userId: actorUserId },
                    select: {
                        instrument: { select: { publicId: true } },
                    },
                },
                segments: {
                    select: {
                        responses: {
                            where: { userId: actorUserId },
                        },
                    },
                },
                expectedAttendanceUserTag: {
                    select: {
                        userAssignments: {
                            where: { userId: actorUserId },
                        },
                    },
                },
                descriptionWikiPage: {
                    select: {
                        createdByUserId: true,
                        visiblePermissionId: true,
                    },
                },
            },
        })
    )
);

export const eventSearchSelection = ({ authorization }: DB3ViewSelectionContext) => (
    // A named Event_Search view always carries responses for the actor making
    // the request. Client input never chooses whose responses are returned.
    makeEventSearchSelection(authorization.userId ?? -1)
);

const eventSearchViewContract = deriveViewContract(
    xEvent,
    makeEventSearchSelection(-1),
    {
        transportSelection: eventSearchTransportSelection,
        references: dashboardReferenceContract,
    },
);

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
                publicId: true,
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
                publicId: true,
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
                publicId: true,
                eventTagId: true,
                eventTag: {
                    select: {
                        publicId: true,
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

export const eventSearchView = defineView({
    viewID: "Event_Search",
    entity: xEvent,
    selection: eventSearchSelection,
    dtoSchema: eventSearchViewContract.dtoSchema,
    references: eventSearchViewContract.referenceContract,
    hydrate: (dto, references) => {
        const { segments, tags, ...eventDto } = eventSearchViewContract.hydrate(dto, references);
        return {
            ...hydrateEventDateRange(eventDto),
            tags: [...tags].sort((a, b) => a.eventTag.sortOrder - b.eventTag.sortOrder),
            segments: segments?.map(segment => hydrateEventDateRange(segment)),
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

const eventWikiPageContextTransportSelection = Prisma.validator<Prisma.EventDefaultArgs>()({
    select: {
        id: true,
        name: true,
        typeId: true,
        statusId: true,
        uid: true,
        startsAt: true,
        endDateTime: true,
        isAllDay: true,
        durationMillis: true,
        segmentBehavior: true,
        segments: {
            select: {
                id: true,
                name: true,
                statusId: true,
                uid: true,
                startsAt: true,
                isAllDay: true,
                durationMillis: true,
            },
        },
    },
});

const eventWikiPageContextSelection = Prisma.validator<Prisma.EventDefaultArgs>()(
    graft(eventWikiPageContextTransportSelection, {
        select: {
            createdByUserId: true,
            visiblePermissionId: true,
            isDeleted: true,
            type: { select: { publicId: true } },
            status: { select: { publicId: true } },
            segments: {
                select: {
                    status: { select: { publicId: true } },
                },
            },
        },
    }),
);

const eventWikiPageContextViewContract = deriveViewContract(
    xEvent,
    eventWikiPageContextSelection,
    { transportSelection: eventWikiPageContextTransportSelection },
);

export const eventWikiPageContextView = defineView({
    viewID: "Event_WikiPageContext",
    entity: xEvent,
    selection: eventWikiPageContextViewContract.prismaSelection,
    dtoSchema: eventWikiPageContextViewContract.dtoSchema,
    hydrate: eventWikiPageContextViewContract.hydrate,
});

export type EventSearchDto = DtoOf<typeof eventSearchView>;
export type EventSearchClient = ClientOf<typeof eventSearchView>;

//type aoeu = EventSearchClient["status"];

export type EventFrontpageDto = DtoOf<typeof eventFrontpageView>;
export type EventFrontpageClient = ClientOf<typeof eventFrontpageView>;
export type EventWikiPageContextClient = ClientOf<typeof eventWikiPageContextView>;
//type aoeus = EventFrontpageClient;
