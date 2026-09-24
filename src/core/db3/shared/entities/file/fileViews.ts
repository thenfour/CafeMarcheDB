import { Prisma } from "db";
import { z } from "zod";
import { defineCrudView } from "../../core/db3CrudView";
import { defineView, type ClientOf, type DtoOf } from "../../core/db3View";
import { deriveViewContract } from "../../core/db3ViewContract";
import { db3s, graft } from "../common/viewCommon";
import { dashboardReferenceContract } from "../../references/dashboardReferences";
import {
    xFile,
    xFileTag,
    xFrontpageGalleryItem,
} from "../../schema/file";

export const fileTagEditorSelection = Prisma.validator<Prisma.FileTagDefaultArgs>()({
    select: {
        id: true,
        text: true,
        description: true,
        color: true,
        sortOrder: true,
        significance: true,
    },
});

const fileTagEditorContract = deriveViewContract(xFileTag, fileTagEditorSelection);

export const fileTagEditorView = defineCrudView({
    viewID: "FileTag_Editor",
    entity: xFileTag,
    operations: { create: true, update: true, delete: true },
    selection: fileTagEditorContract.prismaSelection,
    dtoSchema: fileTagEditorContract.dtoSchema,
    hydrate: fileTagEditorContract.hydrate,
});

const FrontpageGalleryItemEditorDtoSchema = z.object({
    id: z.number().int(),
    isDeleted: z.boolean(),
    caption: z.string(),
    caption_nl: z.string().nullable(),
    caption_fr: z.string().nullable(),
    sortOrder: z.number().int(),
    fileId: z.number().int(),
    file: z.object({
        id: z.number().int(),
        fileLeafName: z.string(),
        storedLeafName: z.string(),
        externalURI: z.string().nullable(),
        description: z.string(),
        sizeBytes: z.number().int().nullable(),
        mimeType: z.string().nullable(),
        customData: z.string().nullable(),
        uploadedByUserId: z.number().int().nullable(),
    }),
    displayParams: z.string(),

    ...db3s.createdByUserId(),
    ...db3s.createdByUser(),

    ...db3s.visiblePermissionId(),
    ...db3s.visiblePermission(),
});

export const frontpageGalleryItemEditorView = defineCrudView({
    viewID: "FrontpageGalleryItem_Editor",
    entity: xFrontpageGalleryItem,
    operations: { create: true, update: true, delete: true },
    dtoSchema: FrontpageGalleryItemEditorDtoSchema,
    hydrate: dto => xFrontpageGalleryItem.getClientModel(dto, "view"),
});

const fileDetailRelatedFileTransportSelection = {
    select: {
        id: true,
        fileLeafName: true,
    },
} as const;

const fileDetailRelatedFileSelection = {
    select: {
        id: true,
        fileLeafName: true,
        uploadedByUserId: true,
        visiblePermissionId: true,
        isDeleted: true,
    },
} as const;

const fileDetailPinnedSongTransportSelection = {
    select: {
        id: true,
        name: true,
    },
} as const;

const fileDetailPinnedSongSelection = {
    select: {
        ...fileDetailPinnedSongTransportSelection.select,
        createdByUserId: true,
        visiblePermissionId: true,
        isDeleted: true,
    },
} as const;

// Reusable File projection for embedded file cards. It deliberately excludes
// File_Detail-only reverse relations such as childFiles and pinnedForSongs.
export const fileCardTransportSelection = Prisma.validator<Prisma.FileDefaultArgs>()({
    select: {
        id: true,
        fileLeafName: true,
        description: true,
        uploadedAt: true,
        uploadedByUserId: true,
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
        customData: true,
        externalURI: true,
        fileCreatedAt: true,
        parentFileId: true,
        previewFileId: true,
        tags: {
            select: {
                id: true,
                fileTagId: true,
            },
        },
        taggedUsers: {
            select: {
                id: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
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

// Authorization needs a few additional members which must not cross the DTO
// boundary. Keep the full Prisma selection distinct from its transport shape.
export const fileCardSelection = Prisma.validator<Prisma.FileDefaultArgs>()(
    graft(fileCardTransportSelection, {
        select: {
            isDeleted: true,
            taggedUsers: {
                select: {
                    userId: true,
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
            taggedInstruments: {
                select: {
                    instrument: { select: { publicId: true } },
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



const fileDetailTransportSelection = Prisma.validator<Prisma.FileDefaultArgs>()({
    select: {
        ...fileCardTransportSelection.select,
        frontpageGalleryItems: {
            select: { id: true },
        },
        parentFile: fileDetailRelatedFileTransportSelection,
        childFiles: fileDetailRelatedFileTransportSelection,
        previewFile: fileDetailRelatedFileTransportSelection,
        previewForFile: fileDetailRelatedFileTransportSelection,
        pinnedForSongs: fileDetailPinnedSongTransportSelection,
    },
});

export const fileDetailSelection = Prisma.validator<Prisma.FileDefaultArgs>()({
    select: {
        ...fileCardSelection.select,
        frontpageGalleryItems: {
            select: { id: true },
        },
        parentFile: fileDetailRelatedFileSelection,
        childFiles: fileDetailRelatedFileSelection,
        previewFile: fileDetailRelatedFileSelection,
        previewForFile: fileDetailRelatedFileSelection,
        pinnedForSongs: fileDetailPinnedSongSelection,
    },
});

const fileDetailContract = deriveViewContract(
    xFile,
    fileDetailSelection,
    {
        transportSelection: fileDetailTransportSelection,
        references: dashboardReferenceContract,
    },
);

const fileEditorTransportSelection = Prisma.validator<Prisma.FileDefaultArgs>()({
    select: {
        id: true,
        fileLeafName: true,
        storedLeafName: true,
        description: true,
        fileCreatedAt: true,
        uploadedAt: true,
        isDeleted: true,
        sizeBytes: true,
        customData: true,
        uploadedByUserId: true,
        uploadedByUser: fileCardTransportSelection.select.uploadedByUser,
        visiblePermissionId: true,
        tags: fileCardTransportSelection.select.tags,
        taggedUsers: fileCardTransportSelection.select.taggedUsers,
        taggedSongs: fileCardTransportSelection.select.taggedSongs,
        taggedEvents: fileCardTransportSelection.select.taggedEvents,
        taggedInstruments: fileCardTransportSelection.select.taggedInstruments,
        taggedWikiPages: fileCardTransportSelection.select.taggedWikiPages,
    },
});

export const fileEditorSelection = Prisma.validator<Prisma.FileDefaultArgs>()({
    select: {
        ...fileEditorTransportSelection.select,
        taggedUsers: fileCardSelection.select.taggedUsers,
        taggedSongs: fileCardSelection.select.taggedSongs,
        taggedEvents: fileCardSelection.select.taggedEvents,
        taggedInstruments: fileCardSelection.select.taggedInstruments,
        taggedWikiPages: fileCardSelection.select.taggedWikiPages,
    },
});

const fileEditorContract = deriveViewContract(
    xFile,
    fileEditorSelection,
    {
        transportSelection: fileEditorTransportSelection,
        references: dashboardReferenceContract,
    },
);

export const fileEditorView = defineCrudView({
    viewID: "File_Editor",
    entity: xFile,
    operations: { update: true, delete: true },
    selection: fileEditorContract.prismaSelection,
    dtoSchema: fileEditorContract.dtoSchema,
    references: fileEditorContract.referenceContract,
    hydrate: fileEditorContract.hydrate,
});

export const fileDetailView = defineView({
    viewID: "File_Detail",
    entity: xFile,
    selection: fileDetailContract.prismaSelection,
    dtoSchema: fileDetailContract.dtoSchema,
    references: fileDetailContract.referenceContract,
    hydrate: fileDetailContract.hydrate,
});

export type FileDetailDto = DtoOf<typeof fileDetailView>;
export type FileDetailClient = ClientOf<typeof fileDetailView>;
