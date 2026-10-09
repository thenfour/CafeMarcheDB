import { Prisma } from "@prisma/client";
import { ClientOf, DbPayloadOf, defineView, DtoOf } from "../../core/db3View";
import { deriveViewContract } from "../../core/db3ViewContract";
import { dashboardReferenceContract } from "../../references/dashboardReferences";
import { xEvent } from "../../schema/event";
import { EventTagAssignmentNaturalOrderBy } from "../../schema/prismArgs";
import { xFrontpageGalleryItem } from "../../schema/file";

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const frontpageGalleryFeedSelection = Prisma.validator<Prisma.FrontpageGalleryItemDefaultArgs>()({
    select: {
        publicId: true,
        sortOrder: true,
        caption: true,
        caption_fr: true,
        caption_nl: true,
        displayParams: true,
        file: {
            select: {
                publicId: true,
                storedLeafName: true,
                customData: true,
                mimeType: true,
            },
        },
    },
});

const frontpageGalleryFeedContract = deriveViewContract(
    xFrontpageGalleryItem,
    frontpageGalleryFeedSelection,
);

export const frontpageGalleryFeedView = defineView({
    viewID: "FrontpageGalleryItem_Feed",
    entity: xFrontpageGalleryItem,
    selection: frontpageGalleryFeedContract.prismaSelection,
    dtoSchema: frontpageGalleryFeedContract.dtoSchema,
    hydrate: frontpageGalleryFeedContract.hydrate,
});

export type FrontpageGalleryFeedDto = DtoOf<typeof frontpageGalleryFeedView>;
export type FrontpageGalleryFeedDBPayload = DbPayloadOf<typeof frontpageGalleryFeedView>;



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const eventFrontpageRequestedSelection = Prisma.validator<Prisma.EventDefaultArgs>()({
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
    },
});

const eventFrontpageViewContract = deriveViewContract(
    xEvent,
    eventFrontpageRequestedSelection,
    { references: dashboardReferenceContract },
);

export const eventFrontpageSelection = eventFrontpageViewContract.prismaSelection;

export const eventFrontpageView = defineView({
    viewID: "Event_Frontpage",
    entity: xEvent,
    dtoSchema: eventFrontpageViewContract.dtoSchema,
    selection: eventFrontpageSelection,
    references: eventFrontpageViewContract.referenceContract,
    hydrate: eventFrontpageViewContract.hydrate,
});

export type EventFrontpageDBPayload = DbPayloadOf<typeof eventFrontpageView>;
export type EventFrontpageDto = DtoOf<typeof eventFrontpageView>;
export type EventFrontpageClient = ClientOf<typeof eventFrontpageView>;


// Publication needs authored fields only; editor metadata belongs to eventFrontpageView.
const eventPublicFeedSelection = Prisma.validator<Prisma.EventDefaultArgs>()({
    select: {
        publicId: true,
        startsAt: true,
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
    },
});
const eventPublicFeedContract = deriveViewContract(xEvent, eventPublicFeedSelection);
export const eventPublicFeedView = defineView({
    viewID: "Event_PublicFeed",
    entity: xEvent,
    where: { frontpageVisible: true },
    selection: eventPublicFeedContract.prismaSelection,
    dtoSchema: eventPublicFeedContract.dtoSchema,
    hydrate: eventPublicFeedContract.hydrate,
});
export type EventPublicFeedDto = DtoOf<typeof eventPublicFeedView>;
