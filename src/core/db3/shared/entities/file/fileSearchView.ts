import { Prisma } from "db";
import { defineView, type ClientOf, type DtoOf } from "../../core/db3View";
import { deriveViewContract } from "../../core/db3ViewContract";
import { xFile } from "../../schema/file";
import { dashboardReferenceContract } from "../../references/dashboardReferences";
import { graft } from "../common/viewCommon";

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
                publicId: true,
                fileTagId: true,
            },
        },
        taggedSongs: {
            select: {
                publicId: true,
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
                publicId: true,
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
                publicId: true,
                instrumentId: true,
            },
        },
        taggedWikiPages: {
            select: {
                publicId: true,
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

const fileSearchRequestedSelection = Prisma.validator<Prisma.FileDefaultArgs>()(
    graft(fileSearchTransportSelection, {
        select: {
            uploadedByUserId: true,
            isDeleted: true,
            tags: {
                select: {
                    fileId: true,
                },
            },
            taggedSongs: {
                select: {
                    songId: true,
                    song: {
                        select: {
                            createdByUserId: true,
                            visiblePermissionId: true,
                            isDeleted: true,
                        },
                    },
                },
            },
            taggedEvents: {
                select: {
                    eventId: true,
                    event: {
                        select: {
                            createdByUserId: true,
                            visiblePermissionId: true,
                            isDeleted: true,
                        },
                    },
                },
            },
            taggedWikiPages: {
                select: {
                    wikiPageId: true,
                    wikiPage: {
                        select: {
                            visiblePermissionId: true,
                        },
                    },
                },
            },
        },
    })
);

const fileSearchViewContract = deriveViewContract(
    xFile,
    fileSearchRequestedSelection,
    {
        transportSelection: fileSearchTransportSelection,
        references: dashboardReferenceContract,
    },
);

export const fileSearchSelection = fileSearchViewContract.prismaSelection;

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
