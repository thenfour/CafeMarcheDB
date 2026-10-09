import { ZodToPrismaSelection } from "@/shared/prismaUtils";
import { Prisma } from "db";
import { z } from "zod";
import { isPublicId, type EventPublicId, type EventStatusPublicId, type EventTagAssignmentPublicId, type EventTagPublicId, type EventTypePublicId, type UserTagPublicId } from "shared/publicId";
import { defineCrudView } from "../../core/db3CrudView";
import { defineView, type ClientOf, type DB3ViewSelectionContext, type DtoOf } from "../../core/db3View";
import { deriveViewContract } from "../../core/db3ViewContract";
import { EventTagAssignmentNaturalOrderBy } from "../../schema/prismArgs";
import { db3s, graft } from "../common/viewCommon";
import { hydrateEventDateRange } from "./eventDateRange";
import { bandUserTagContract } from "../user/bandUserTagViews";
import { bandEventTagContract } from "./eventTagCatalogs";
import { dashboardReferenceContract } from "../../references/dashboardReferences";
import { fileCardSelection, fileCardTransportSelection } from "../file/fileViews";
import { eventSongListTransportSelection } from "../eventSongList/eventSongListViews";
import {
    xEvent,
    xEventSegment,
    xEventSegmentUserResponse,
    xEventUserResponse,
} from "../../schema/event";

// TODO: stop using Zod in this file; use the better deriveViewContract pattern.

// event type ------------------------------------------
const EventTypeDtoSchema = z.object({
    publicId: z.custom<EventTypePublicId>(isPublicId),
    ...db3s.isDeleted(),
    ...db3s.descriptionColorSortOrder(),
    ...db3s.iconName(),

    name: db3s.authNeeded(z.string()),
    significance: db3s.authNeeded(z.string().nullable()),
});

// event status ------------------------------------------
const EventStatusDtoSchema = z.object({
    publicId: z.custom<EventStatusPublicId>(isPublicId),
    ...db3s.isDeleted(),
    ...db3s.descriptionColorSortOrder(),
    ...db3s.iconName(),

    name: z.string().optional(),
    significance: z.string().nullable().optional(),
});

// event editor ------------------------------------------

export const eventSegmentEditorSelection = Prisma.validator<Prisma.EventSegmentDefaultArgs>()({
    select: {
        publicId: true, name: true, description: true,
        startsAt: true, durationMillis: true, isAllDay: true,
        statusId: true,
        eventId: true,
        event: {
            select: {
                publicId: true,
                name: true,
                startsAt: true,
                typeId: true,
            }
        },
    },
});
const eventSegmentEditorContract = deriveViewContract(xEventSegment, eventSegmentEditorSelection, { references: dashboardReferenceContract });
export const eventSegmentEditorView = defineCrudView({
    viewID: "EventSegment_Editor", entity: xEventSegment,
    operations: { create: true, update: true, delete: true },
    selection: eventSegmentEditorContract.prismaSelection,
    dtoSchema: eventSegmentEditorContract.dtoSchema,
    references: eventSegmentEditorContract.referenceContract,
    hydrate: eventSegmentEditorContract.hydrate,
});

const eventSegmentUserResponseContract = deriveViewContract(xEventSegmentUserResponse,
    Prisma.validator<Prisma.EventSegmentUserResponseDefaultArgs>()({
        select: {
            publicId: true,
            eventSegmentId: true,
            bandUserId: true,
            attendanceId: true,
            createdAt: true,
            updatedAt: true,
            createdByUserId: true,
            updatedByUserId: true,
        }
    }));
export const eventSegmentUserResponseView = defineView({
    viewID: "EventSegmentUserResponse_Detail", entity: xEventSegmentUserResponse,
    selection: eventSegmentUserResponseContract.prismaSelection,
    dtoSchema: eventSegmentUserResponseContract.dtoSchema,
    hydrate: eventSegmentUserResponseContract.hydrate,
});
const eventUserResponseContract = deriveViewContract(xEventUserResponse,
    Prisma.validator<Prisma.EventUserResponseDefaultArgs>()({
        select: {
            publicId: true,
            eventId: true,
            bandUserId: true,
            bandInstrumentId: true,
            userComment: true,
            isInvited: true,
            revision: true,
        }
    }));
export const eventUserResponseView = defineView({
    viewID: "EventUserResponse_Detail", entity: xEventUserResponse,
    selection: eventUserResponseContract.prismaSelection,
    dtoSchema: eventUserResponseContract.dtoSchema,
    hydrate: eventUserResponseContract.hydrate,
});

const EventEditorTagDtoSchema = bandEventTagContract.dtoSchema;

const EventEditorDtoSchema = z.object({
    publicId: z.custom<EventPublicId>(isPublicId),
    ...db3s.isDeleted(),
    revision: z.number().int().optional(),

    name: z.string().optional(),
    relevanceClassOverride: z.number().int().nullable().optional(),
    locationDescription: z.string().optional(),
    locationURL: z.string().optional(),

    ...db3s.dateRange(),

    typeId: z.custom<EventTypePublicId>(isPublicId).nullable().optional(),
    type: EventTypeDtoSchema.nullable().optional(),

    statusId: z.custom<EventStatusPublicId>(isPublicId).nullable().optional(),
    status: EventStatusDtoSchema.nullable().optional(),

    tags: z.array(z.object({
        publicId: z.custom<EventTagAssignmentPublicId>(isPublicId),
        eventId: z.custom<EventPublicId>(isPublicId).optional(),
        bandEventTagId: z.custom<EventTagPublicId>(isPublicId).optional(),
        eventTag: EventEditorTagDtoSchema.optional(),
    })).optional(),

    expectedAttendanceUserTagId: z.custom<UserTagPublicId>(isPublicId).nullable().optional(),
    expectedAttendanceUserTag: bandUserTagContract.dtoSchema.nullable().optional(),

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
});

const eventEditorBaseSelection = ZodToPrismaSelection(EventEditorDtoSchema);
const eventEditorSelection = Prisma.validator<Prisma.EventDefaultArgs>()({
    select: {
        ...eventEditorBaseSelection.select,
        expectedAttendanceUserTag: bandUserTagContract.prismaSelection,
        tags: {
            ...eventEditorBaseSelection.select.tags,
            select: {
                publicId: true, eventId: true, bandEventTagId: true,
                eventTag: bandEventTagContract.prismaSelection,
            },
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

// event detail ------------------------------------------

const eventDetailTransportSelection = Prisma.validator<Prisma.EventDefaultArgs>()({
    select: {
        publicId: true,
        name: true,
        revision: true,
        locationDescription: true,
        locationURL: true,
        typeId: true,
        statusId: true,
        relevanceClassOverride: true,
        startsAt: true,
        durationMillis: true,
        isAllDay: true,
        visiblePermissionId: true,
        createdAt: true,
        createdByUser: { select: { publicId: true } },
        expectedAttendanceUserTagId: true,
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
        tags: {
            orderBy: EventTagAssignmentNaturalOrderBy,
            select: {
                publicId: true,
                bandEventTagId: true,
            },
        },
        fileTags: {
            orderBy: { file: { uploadedAt: "desc" } },
            select: {
                publicId: true,
                eventId: true,
                fileId: true,
                file: fileCardTransportSelection,
            },
        },
        segments: {
            orderBy: [
                { startsAt: "asc" },
                { id: "asc" },
            ],
            select: {
                publicId: true,
                eventId: true,
                name: true,
                description: true,
                startsAt: true,
                durationMillis: true,
                isAllDay: true,
                statusId: true,
                uid: true,
                responses: {
                    select: {
                        publicId: true,
                        eventSegmentId: true,
                        bandUserId: true,
                        attendanceId: true,
                        createdAt: true,
                        updatedAt: true,
                        updatedByUser: { select: { publicId: true, name: true } },
                    },
                },
            },
        },
        responses: {
            select: {
                publicId: true,
                eventId: true,
                bandUserId: true,
                bandInstrumentId: true,
                userComment: true,
                isInvited: true,
                revision: true,
            },
        },
        songLists: {
            orderBy: { sortOrder: "asc" },
            select: { publicId: true },
        },
        expectedAttendanceUserTag: {
            select: {
                publicId: true,
                bandUserTagAssignments: {
                    select: {
                        publicId: true,
                        bandUserId: true,
                    },
                },
            },
        },
        descriptionWikiPage: {
            select: {
                publicId: true,
                currentRevision: {
                    select: {
                        publicId: true,
                        content: true,
                    },
                },
            },
        },
    },
});

const eventDetailRequestedSelection = Prisma.validator<Prisma.EventDefaultArgs>()(
    graft(eventDetailTransportSelection, {
        select: {
            createdByUserId: true,
            isDeleted: true,
            fileTags: {
                select: {
                    file: fileCardSelection,
                },
            },
            descriptionWikiPage: {
                select: {
                    createdByUserId: true,
                    visiblePermissionId: true,
                },
            },
        },
    }),
);

const eventDetailViewContract = deriveViewContract(
    xEvent,
    eventDetailRequestedSelection,
    {
        transportSelection: eventDetailTransportSelection,
        references: dashboardReferenceContract,
    },
);

type DeepDefined<T> =
    T extends string | number | bigint | boolean | symbol | null ? T
    : T extends Date ? T
    : T extends (...args: never[]) => unknown ? T
    : T extends readonly (infer TItem)[] ? DeepDefined<TItem>[]
    : T extends object ? { [TKey in keyof T]-?: DeepDefined<Exclude<T[TKey], undefined>> }
    : Exclude<T, undefined>;

const assertSelectedShape = (
    value: unknown,
    selection: Record<string, unknown>,
    path: string,
): void => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`${path} is not an object.`);
    }
    const row = value as Record<string, unknown>; // Runtime object shape was checked above.
    for (const [key, fieldSelection] of Object.entries(selection)) {
        if (!(key in row) || row[key] === undefined) {
            throw new Error(`${path}.${key} was omitted by authorization.`);
        }
        if (!fieldSelection || typeof fieldSelection !== "object" || Array.isArray(fieldSelection)) continue;
        const fieldSelectionRecord = fieldSelection as Record<string, unknown>; // Prisma relation selections are plain objects.
        const nestedSelection = fieldSelectionRecord.select;
        if (!nestedSelection || typeof nestedSelection !== "object" || Array.isArray(nestedSelection)) continue;
        const nestedValue = row[key];
        if (nestedValue === null) continue;
        const nestedSelectionRecord = nestedSelection as Record<string, unknown>; // Checked as a plain selection object above.
        if (Array.isArray(nestedValue)) {
            nestedValue.forEach((item, index) => assertSelectedShape(item, nestedSelectionRecord, `${path}.${key}[${index}]`));
        } else {
            assertSelectedShape(nestedValue, nestedSelectionRecord, `${path}.${key}`);
        }
    }
};

const hydrateEventDetailDto = (
    dto: Parameters<typeof eventDetailViewContract.hydrate>[0],
    references: Parameters<typeof eventDetailViewContract.hydrate>[1],
) => {
    const event = eventDetailViewContract.hydrate(dto, references);
    assertSelectedShape(event, eventDetailTransportSelection.select, "Event_Detail");
    assertSelectedShape(event, {
        type: true,
        status: true,
        visiblePermission: true,
    }, "Event_Detail");
    event.tags.forEach((tag, index) => assertSelectedShape(
        tag,
        { eventTag: true },
        `Event_Detail.tags[${index}]`,
    ));
    // The checks cover the complete finite detail transport and hydrated references.
    return event as DeepDefined<typeof event>;
};

export const eventDetailSelection = eventDetailViewContract.prismaSelection;

export const eventDetailView = defineView({
    viewID: "Event_Detail",
    entity: xEvent,
    selection: eventDetailSelection,
    dtoSchema: eventDetailViewContract.dtoSchema,
    references: eventDetailViewContract.referenceContract,
    hydrate: hydrateEventDetailDto,
});

// event calendar ------------------------------------------

const eventCalendarTransportSelection = Prisma.validator<Prisma.EventDefaultArgs>()({
    select: {
        publicId: true,
        name: true,
        revision: true,
        locationDescription: true,
        locationURL: true,
        statusId: true,
        status: {
            select: {
                publicId: true,
                significance: true,
            },
        },
        segments: {
            select: {
                publicId: true,
                name: true,
                description: true,
                startsAt: true,
                isAllDay: true,
                durationMillis: true,
                uid: true,
                statusId: true,
                responses: {
                    select: {
                        publicId: true,
                        bandUserId: true,
                        attendanceId: true,
                    },
                },
            },
        },
        responses: {
            select: {
                publicId: true,
                bandUserId: true,
                revision: true,
                isInvited: true,
            },
        },
        songLists: {
            ...eventSongListTransportSelection,
            orderBy: { sortOrder: "asc" },
        },
        expectedAttendanceUserTag: {
            select: {
                publicId: true,
                bandUserTagAssignments: {
                    select: {
                        publicId: true,
                        bandUserId: true,
                    },
                },
            },
        },
        descriptionWikiPage: {
            select: {
                publicId: true,
                currentRevision: {
                    select: {
                        publicId: true,
                        content: true,
                    },
                },
            },
        },
    },
});

const eventCalendarRequestedSelection = Prisma.validator<Prisma.EventDefaultArgs>()(
    graft(eventCalendarTransportSelection, {
        select: {
            createdByUserId: true,
            visiblePermissionId: true,
            isDeleted: true,
            songLists: {
                select: {
                    songs: {
                        select: {
                            song: {
                                select: {
                                    createdByUserId: true,
                                    visiblePermissionId: true,
                                    isDeleted: true,
                                },
                            },
                        },
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
    }),
);

const eventCalendarViewContract = deriveViewContract(
    xEvent,
    eventCalendarRequestedSelection,
    { transportSelection: eventCalendarTransportSelection },
);

const hydrateEventCalendarDto = (
    dto: Parameters<typeof eventCalendarViewContract.hydrate>[0],
    references: Parameters<typeof eventCalendarViewContract.hydrate>[1],
) => {
    const event = eventCalendarViewContract.hydrate(dto, references);
    assertSelectedShape(event, eventCalendarTransportSelection.select, "Event_Calendar");
    // Every optional field in this server-only view is part of its finite
    // transport selection and was checked immediately above.
    return event as DeepDefined<typeof event>;
};

export const eventCalendarView = defineView({
    viewID: "Event_Calendar",
    entity: xEvent,
    selection: eventCalendarViewContract.prismaSelection,
    dtoSchema: eventCalendarViewContract.dtoSchema,
    hydrate: hydrateEventCalendarDto,
});

// const EventTagAssignmentDtoSchema = z.object({
//     id: z.number().int(),
//     bandEventTagId: z.number().int().optional(),
// });

const eventSearchTransportSelection = Prisma.validator<Prisma.EventDefaultArgs>()({
    select: {
        publicId: true,
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
                bandEventTagId: true,
            },
        },
        revision: true,
        descriptionWikiPageId: true,
        expectedAttendanceUserTagId: true,
        responses: {
            select: {
                publicId: true,
                bandUserId: true,
                bandInstrumentId: true,
                isInvited: true,
                userComment: true,
            },
        },
        segments: {
            orderBy: { startsAt: "desc" },
            select: {
                publicId: true,
                name: true,
                startsAt: true,
                durationMillis: true,
                isAllDay: true,
                statusId: true,
                responses: {
                    select: {
                        publicId: true,
                        bandUserId: true,
                        attendanceId: true,
                    },
                },
            },
        },
        songLists: {
            select: { publicId: true },
        },
        expectedAttendanceUserTag: {
            select: {
                publicId: true,
                bandUserTagAssignments: {
                    select: {
                        bandUserId: true,
                    },
                },
            },
        },
        descriptionWikiPage: {
            select: {
                publicId: true,
                currentRevision: {
                    select: {
                        publicId: true,
                        content: true,
                    },
                },
            },
        },
    },
});

const makeEventSearchSelection = (actorMembershipId: number) => (
    Prisma.validator<Prisma.EventDefaultArgs>()(
        graft(eventSearchTransportSelection, {
            select: {
                createdByUserId: true,
                isDeleted: true,
                responses: {
                    where: { bandUserId: actorMembershipId },
                },
                segments: {
                    select: {
                        responses: {
                            where: { bandUserId: actorMembershipId },
                        },
                    },
                },
                expectedAttendanceUserTag: {
                    select: {
                        bandUserTagAssignments: {
                            where: { bandUserId: actorMembershipId },
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

const eventSearchViewContract = deriveViewContract(
    xEvent,
    makeEventSearchSelection(-1),
    {
        transportSelection: eventSearchTransportSelection,
        references: dashboardReferenceContract,
    },
);

export const eventSearchSelection = ({ auth }: DB3ViewSelectionContext) => {
    const actorMembershipId = auth.membership?.id ?? -1;
    // Start from the compiled selection so projection-only relations added by
    // the contract remain present while the request supplies actor-scoped
    // predicates.
    return graft(eventSearchViewContract.prismaSelection, {
        select: {
            responses: { where: { bandUserId: actorMembershipId } },
            segments: {
                select: {
                    responses: { where: { bandUserId: actorMembershipId } },
                },
            },
            expectedAttendanceUserTag: {
                select: {
                    bandUserTagAssignments: { where: { bandUserId: actorMembershipId } },
                },
            },
        },
    });
};

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

const eventWikiPageContextTransportSelection = Prisma.validator<Prisma.EventDefaultArgs>()({
    select: {
        publicId: true,
        name: true,
        typeId: true,
        statusId: true,
        uid: true,
        startsAt: true,
        endDateTime: true,
        isAllDay: true,
        durationMillis: true,
        segments: {
            select: {
                publicId: true,
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
export type EventDetailDto = DtoOf<typeof eventDetailView>;
export type EventDetailClient = ClientOf<typeof eventDetailView>;
export type EventDetailSegmentClient = NonNullable<EventDetailClient["segments"]>[number];
export type EventDetailEventResponseClient = NonNullable<EventDetailClient["responses"]>[number];
export type EventDetailSegmentResponseClient = NonNullable<EventDetailSegmentClient["responses"]>[number];

// Attendance presentation creates unsaved response rows for users who have not
// answered yet, so those local rows deliberately have no persisted identity.
export type EventDetailEventResponse = Omit<EventDetailEventResponseClient, "publicId"> & {
    publicId: EventDetailEventResponseClient["publicId"] | null;
};
export type EventDetailSegmentResponse = Omit<EventDetailSegmentResponseClient, "publicId"> & {
    publicId: EventDetailSegmentResponseClient["publicId"] | null;
};
export type EventCalendarClient = ClientOf<typeof eventCalendarView>;

//type aoeu = EventSearchClient["status"];

export type EventWikiPageContextClient = ClientOf<typeof eventWikiPageContextView>;
export type EventWikiPageContextDto = DtoOf<typeof eventWikiPageContextView>;
//type aoeus = EventFrontpageClient;

export { eventTypeEditorSelection, eventTypeEditorView, eventStatusEditorSelection, eventStatusEditorView, eventAttendanceEditorSelection, eventAttendanceEditorView } from "./eventCatalogs";
