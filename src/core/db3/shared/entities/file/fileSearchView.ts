import { Prisma } from "db";
import { defineView, type ClientOf, type DtoOf } from "../../core/db3View";
import { deriveViewContract } from "../../core/db3ViewContract";
import { xFile } from "../../schema/file";
import { dashboardReferenceContract } from "../../references/dashboardReferences";

const fileSearchTransportSelection = Prisma.validator<Prisma.FileDefaultArgs>()({
    select: {
        id: true,
        fileLeafName: true,
        description: true,
        uploadedAt: true,
        uploadedByUser: {
            select: {
                id: true,
                name: true,
            },
        },
        visiblePermissionId: true,
        sizeBytes: true,
        storedLeafName: true,
        mimeType: true,
        externalURI: true,
        tags: {
            select: {
                id: true,
                fileTagId: true,
            },
        },
        taggedSongs: {
            select: {
                id: true,
                song: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        },
        taggedEvents: {
            select: {
                id: true,
                event: {
                    select: {
                        id: true,
                        name: true,
                        startsAt: true,
                        statusId: true,
                        typeId: true,
                    },
                },
            },
        },
        taggedInstruments: {
            select: {
                id: true,
                instrumentId: true,
            },
        },
        taggedWikiPages: {
            select: {
                id: true,
                wikiPage: {
                    select: {
                        id: true,
                        slug: true,
                    },
                },
            },
        },
    },
});

export const fileSearchSelection = Prisma.validator<Prisma.FileDefaultArgs>()({
    select: {
        ...fileSearchTransportSelection.select,
        uploadedByUserId: true,
        isDeleted: true,
        taggedSongs: {
            ...fileSearchTransportSelection.select.taggedSongs,
            select: {
                ...fileSearchTransportSelection.select.taggedSongs.select,
                songId: true,
                song: {
                    ...fileSearchTransportSelection.select.taggedSongs.select.song,
                    select: {
                        ...fileSearchTransportSelection.select.taggedSongs.select.song.select,
                        createdByUserId: true,
                        visiblePermissionId: true,
                        isDeleted: true,
                    },
                },
            },
        },
        taggedEvents: {
            ...fileSearchTransportSelection.select.taggedEvents,
            select: {
                ...fileSearchTransportSelection.select.taggedEvents.select,
                eventId: true,
                event: {
                    ...fileSearchTransportSelection.select.taggedEvents.select.event,
                    select: {
                        ...fileSearchTransportSelection.select.taggedEvents.select.event.select,
                        createdByUserId: true,
                        visiblePermissionId: true,
                        isDeleted: true,
                    },
                },
            },
        },
        taggedWikiPages: {
            ...fileSearchTransportSelection.select.taggedWikiPages,
            select: {
                ...fileSearchTransportSelection.select.taggedWikiPages.select,
                wikiPageId: true,
                wikiPage: {
                    ...fileSearchTransportSelection.select.taggedWikiPages.select.wikiPage,
                    select: {
                        ...fileSearchTransportSelection.select.taggedWikiPages.select.wikiPage.select,
                        visiblePermissionId: true,
                    },
                },
            },
        },
    },
});

const fileSearchViewContract = deriveViewContract(
    xFile,
    fileSearchSelection,
    {
        transportSelection: fileSearchTransportSelection,
        references: dashboardReferenceContract,
    },
);

export const fileSearchView = defineView({
    viewID: "File_Search",
    entity: xFile,
    selection: fileSearchSelection,
    dtoSchema: fileSearchViewContract.dtoSchema,
    references: fileSearchViewContract.referenceContract,
    hydrate: fileSearchViewContract.hydrate,
});

export type FileSearchDto = DtoOf<typeof fileSearchView>;
export type FileSearchClient = ClientOf<typeof fileSearchView>;
