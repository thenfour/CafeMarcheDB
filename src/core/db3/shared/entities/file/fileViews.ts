import { Prisma } from "db";
import { defineCrudView } from "../../core/db3CrudView";
import { defineView, type ClientOf, type DtoOf } from "../../core/db3View";
import { deriveViewContract } from "../../core/db3ViewContract";
import { graft } from "../common/viewCommon";
import { dashboardReferenceContract } from "../../references/dashboardReferences";
import {
    xFile,
    xFileTag,
    xFrontpageGalleryItem,
} from "../../schema/file";

export const fileTagEditorSelection = Prisma.validator<Prisma.FileTagDefaultArgs>()({
    select: {
        publicId: true,
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

const frontpageGalleryItemEditorSelection = Prisma.validator<Prisma.FrontpageGalleryItemDefaultArgs>()({
    select: {
        id: true,
        isDeleted: true,
        caption: true,
        caption_nl: true,
        caption_fr: true,
        sortOrder: true,
        fileId: true,
        file: {
            select: {
                id: true,
                fileLeafName: true,
                storedLeafName: true,
                externalURI: true,
                description: true,
                sizeBytes: true,
                mimeType: true,
                customData: true,
                uploadedByUserId: true,
            },
        },
        displayParams: true,
        createdByUserId: true,
        createdByUser: {
            select: {
                id: true,
                name: true,
            },
        },
        visiblePermissionId: true,
    },
});

const frontpageGalleryItemEditorContract = deriveViewContract(
    xFrontpageGalleryItem,
    frontpageGalleryItemEditorSelection,
    { references: dashboardReferenceContract },
);

const requireFrontpageGalleryItemEditorFields = <TItem extends {
    isDeleted?: boolean;
    caption?: string;
    caption_nl?: string | null;
    caption_fr?: string | null;
    sortOrder?: number;
    fileId?: number;
    file?: {
        fileLeafName?: string;
        storedLeafName?: string;
        externalURI?: string | null;
        description?: string;
        sizeBytes?: number | null;
        mimeType?: string | null;
        customData?: string | null;
        uploadedByUserId?: number | null;
    };
    displayParams?: string;
    visiblePermissionId?: unknown;
    visiblePermission?: unknown;
}>(item: TItem) => {
    const file = item.file;
    if (item.isDeleted === undefined
        || item.caption === undefined
        || item.caption_nl === undefined
        || item.caption_fr === undefined
        || item.sortOrder === undefined
        || item.fileId === undefined
        || item.displayParams === undefined
        || item.visiblePermissionId === undefined
        || item.visiblePermission === undefined
        || !file
        || file.fileLeafName === undefined
        || file.storedLeafName === undefined
        || file.externalURI === undefined
        || file.description === undefined
        || file.sizeBytes === undefined
        || file.mimeType === undefined
        || file.customData === undefined
        || file.uploadedByUserId === undefined) {
        throw new Error("FrontpageGalleryItem_Editor returned an incomplete authorized row.");
    }
    return {
        ...item,
        isDeleted: item.isDeleted,
        caption: item.caption,
        caption_nl: item.caption_nl,
        caption_fr: item.caption_fr,
        sortOrder: item.sortOrder,
        fileId: item.fileId,
        displayParams: item.displayParams,
        visiblePermissionId: item.visiblePermissionId,
        visiblePermission: item.visiblePermission,
        file: {
            ...file,
            fileLeafName: file.fileLeafName,
            storedLeafName: file.storedLeafName,
            externalURI: file.externalURI,
            description: file.description,
            sizeBytes: file.sizeBytes,
            mimeType: file.mimeType,
            customData: file.customData,
            uploadedByUserId: file.uploadedByUserId,
        },
    };
};

export const frontpageGalleryItemEditorView = defineCrudView({
    viewID: "FrontpageGalleryItem_Editor",
    entity: xFrontpageGalleryItem,
    operations: { create: true, update: true, delete: true },
    selection: frontpageGalleryItemEditorContract.prismaSelection,
    dtoSchema: frontpageGalleryItemEditorContract.dtoSchema,
    references: frontpageGalleryItemEditorContract.referenceContract,
    hydrate: (dto, references) => requireFrontpageGalleryItemEditorFields(
        frontpageGalleryItemEditorContract.hydrate(dto, references),
    ),
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
                publicId: true,
                fileTagId: true,
            },
        },
        taggedUsers: {
            select: {
                publicId: true,
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

// Authorization needs a few additional members which must not cross the DTO
// boundary. Keep the full Prisma selection distinct from its transport shape.
export const fileCardSelection = Prisma.validator<Prisma.FileDefaultArgs>()(
    graft(fileCardTransportSelection, {
        select: {
            isDeleted: true,
            tags: {
                select: {
                    fileId: true,
                    fileTag: { select: { publicId: true } },
                },
            },
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
                            type: { select: { publicId: true } },
                            status: { select: { publicId: true } },
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

const fileDetailRequestedSelection = Prisma.validator<Prisma.FileDefaultArgs>()({
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
    fileDetailRequestedSelection,
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

const fileEditorRequestedSelection = Prisma.validator<Prisma.FileDefaultArgs>()({
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
    fileEditorRequestedSelection,
    {
        transportSelection: fileEditorTransportSelection,
        references: dashboardReferenceContract,
    },
);

export const fileDetailSelection = fileDetailContract.prismaSelection;
export const fileEditorSelection = fileEditorContract.prismaSelection;

export const fileEditorView = defineCrudView({
    viewID: "File_Editor",
    entity: xFile,
    operations: { update: true, delete: true },
    selection: fileEditorSelection,
    dtoSchema: fileEditorContract.dtoSchema,
    references: fileEditorContract.referenceContract,
    hydrate: fileEditorContract.hydrate,
});

export const fileDetailView = defineView({
    viewID: "File_Detail",
    entity: xFile,
    selection: fileDetailSelection,
    dtoSchema: fileDetailContract.dtoSchema,
    references: fileDetailContract.referenceContract,
    hydrate: fileDetailContract.hydrate,
});

export type FileDetailDto = DtoOf<typeof fileDetailView>;
export type FileDetailClient = ClientOf<typeof fileDetailView>;
