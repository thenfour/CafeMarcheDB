import { Prisma } from "db";
import { z } from "zod";
import { defineCrudView } from "../../core/db3CrudView";
import type { DB3ReferenceProvider } from "../../core/db3Hydration";
import { defineView, type ClientOf } from "../../core/db3View";
import { db3s } from "../common/viewCommon";
import { xInstrument } from "../../schema/instrument";
import { xPermission } from "../../schema/user";
import { xFile, xFileTag, xFrontpageGalleryItem } from "../../schema/file";

const FileTagEditorDtoSchema = z.object({
    ...db3s.id(),
    text: z.string().optional(),
    ...db3s.descriptionColorSortOrder(),
    significance: z.string().nullable().optional(),
});

export const fileTagEditorView = defineCrudView({
    viewID: "FileTag_Editor",
    entity: xFileTag,
    operations: { create: true, update: true, delete: true },
    dtoSchema: FileTagEditorDtoSchema,
    hydrate: dto => xFileTag.getClientModel(dto, "view"),
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

const FileTagAssignmentDtoSchema = z.object({
    id: z.number().int(),
    fileTagId: z.number().int().optional(),
});

const FileUserTagDtoSchema = z.object({
    id: z.number().int(),
    user: z.object({
        id: z.number().int(),
        name: z.string().optional(),
    }).nullable().optional(),
});

const FileSongTagDtoSchema = z.object({
    id: z.number().int(),
    song: z.object({
        id: z.number().int(),
        name: z.string().optional(),
    }).nullable().optional(),
});

const FileEventTagDtoSchema = z.object({
    id: z.number().int(),
    event: z.object({
        id: z.number().int(),
        name: z.string().optional(),
        startsAt: z.date().nullable().optional(),
        statusId: z.number().int().nullable().optional(),
        typeId: z.number().int().nullable().optional(),
    }).nullable().optional(),
});

const FileInstrumentTagDtoSchema = z.object({
    id: z.number().int(),
    instrumentId: z.number().int().optional(),
});

const FileWikiPageTagDtoSchema = z.object({
    id: z.number().int(),
    wikiPage: z.object({
        id: z.number().int(),
        slug: z.string().optional(),
    }).nullable().optional(),
});

const FileDetailRelatedFileDtoSchema = z.object({
    id: z.number().int(),
    fileLeafName: z.string().optional(),
});

const FileDetailPinnedSongDtoSchema = z.object({
    id: z.number().int(),
    name: z.string().optional(),
});

// This is the requested maximum shape. Apart from the transport identity, fields
// remain optional because recursive DB3 authorization may remove any of them.
export const FileDetailDtoSchema = z.object({
    id: z.number().int(),
    fileLeafName: z.string().optional(),
    description: z.string().optional(),
    uploadedAt: z.date().optional(),
    uploadedByUserId: z.number().int().nullable().optional(),
    uploadedByUser: z.object({
        id: z.number().int(),
        name: z.string().optional(),
    }).nullable().optional(),
    visiblePermissionId: z.number().int().nullable().optional(),
    sizeBytes: z.number().int().nullable().optional(),
    storedLeafName: z.string().optional(),
    mimeType: z.string().nullable().optional(),
    customData: z.string().nullable().optional(),
    externalURI: z.string().nullable().optional(),
    fileCreatedAt: z.date().nullable().optional(),
    parentFileId: z.number().int().nullable().optional(),
    previewFileId: z.number().int().nullable().optional(),
    tags: z.array(FileTagAssignmentDtoSchema).optional(),
    taggedUsers: z.array(FileUserTagDtoSchema).optional(),
    taggedSongs: z.array(FileSongTagDtoSchema).optional(),
    taggedEvents: z.array(FileEventTagDtoSchema).optional(),
    taggedInstruments: z.array(FileInstrumentTagDtoSchema).optional(),
    taggedWikiPages: z.array(FileWikiPageTagDtoSchema).optional(),
    frontpageGalleryItems: z.array(z.object({
        id: z.number().int(),
    })).optional(),
    parentFile: FileDetailRelatedFileDtoSchema.nullable().optional(),
    childFiles: z.array(FileDetailRelatedFileDtoSchema).optional(),
    previewFile: FileDetailRelatedFileDtoSchema.nullable().optional(),
    previewForFile: z.array(FileDetailRelatedFileDtoSchema).optional(),
    pinnedForSongs: z.array(FileDetailPinnedSongDtoSchema).optional(),
});


const fileDetailRelatedFileSelection = {
    select: {
        id: true,
        fileLeafName: true,
        uploadedByUserId: true,
        visiblePermissionId: true,
        isDeleted: true,
    },
} as const;



export const fileDetailSelection = Prisma.validator<Prisma.FileDefaultArgs>()({
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
        isDeleted: true,
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
                userId: true,
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
                songId: true,
                song: {
                    select: {
                        id: true,
                        name: true,
                        createdByUserId: true,
                        visiblePermissionId: true,
                        isDeleted: true,
                    },
                },
            },
        },
        taggedEvents: {
            select: {
                id: true,
                eventId: true,
                event: {
                    select: {
                        id: true,
                        name: true,
                        startsAt: true,
                        statusId: true,
                        typeId: true,
                        createdByUserId: true,
                        visiblePermissionId: true,
                        isDeleted: true,
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
                wikiPageId: true,
                wikiPage: {
                    select: {
                        id: true,
                        slug: true,
                        visiblePermissionId: true,
                    },
                },
            },
        },
        frontpageGalleryItems: {
            select: { id: true },
        },
        parentFile: fileDetailRelatedFileSelection,
        childFiles: fileDetailRelatedFileSelection,
        previewFile: fileDetailRelatedFileSelection,
        previewForFile: fileDetailRelatedFileSelection,
        pinnedForSongs: {
            select: {
                id: true,
                name: true,
                createdByUserId: true,
                visiblePermissionId: true,
                isDeleted: true,
            },
        },
    },
});

export type FileDetailDto = z.infer<typeof FileDetailDtoSchema>;

export function hydrateFileDetailDto(
    dto: FileDetailDto,
    references: DB3ReferenceProvider,
    path = `File(${dto.id})`,
) {
    return {
        ...dto,
        visiblePermission: references.get(xPermission, dto.visiblePermissionId),
        tags: references.mapOptionalCollection(dto.tags, (association, index) => ({
            ...association,
            fileTag: references.require(
                xFileTag,
                association.fileTagId,
                `${path}.tags[${index}].fileTagId`,
            ),
        })),
        taggedUsers: references.mapOptionalCollection(dto.taggedUsers, association => association)
            ?.flatMap(association => association.user == null ? [] : [{
                ...association,
                user: association.user,
            }]),
        taggedSongs: references.mapOptionalCollection(dto.taggedSongs, association => association)
            ?.flatMap(association => association.song == null ? [] : [{
                ...association,
                song: association.song,
            }]),
        taggedEvents: references.mapOptionalCollection(dto.taggedEvents, association => association)
            ?.flatMap(association => association.event == null ? [] : [{
                ...association,
                event: association.event,
            }]),
        taggedInstruments: references.mapOptionalCollection(dto.taggedInstruments, (association, index) => ({
            ...association,
            instrument: references.require(
                xInstrument,
                association.instrumentId,
                `${path}.taggedInstruments[${index}].instrumentId`,
            ),
        })),
        taggedWikiPages: references.mapOptionalCollection(dto.taggedWikiPages, association => association)
            ?.flatMap(association => association.wikiPage == null ? [] : [{
                ...association,
                wikiPage: association.wikiPage,
            }]),
    };
}

const FileEditorDtoSchema = FileDetailDtoSchema.pick({
    id: true,
    fileLeafName: true,
    description: true,
    fileCreatedAt: true,
    uploadedAt: true,
    uploadedByUserId: true,
    uploadedByUser: true,
    visiblePermissionId: true,
    sizeBytes: true,
    storedLeafName: true,
    tags: true,
    taggedUsers: true,
    taggedSongs: true,
    taggedEvents: true,
    taggedInstruments: true,
    taggedWikiPages: true,
    customData: true,
}).extend({
    isDeleted: z.boolean().optional(),
});

const fileEditorSelection = Prisma.validator<Prisma.FileDefaultArgs>()({
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
        uploadedByUser: fileDetailSelection.select.uploadedByUser,
        visiblePermissionId: true,
        tags: fileDetailSelection.select.tags,
        taggedUsers: fileDetailSelection.select.taggedUsers,
        taggedSongs: fileDetailSelection.select.taggedSongs,
        taggedEvents: fileDetailSelection.select.taggedEvents,
        taggedInstruments: fileDetailSelection.select.taggedInstruments,
        taggedWikiPages: fileDetailSelection.select.taggedWikiPages,
    },
});

export const fileEditorView = defineCrudView({
    viewID: "File_Editor",
    entity: xFile,
    operations: { update: true, delete: true },
    selection: fileEditorSelection,
    dtoSchema: FileEditorDtoSchema,
    hydrate: (dto, references) => {
        const client = xFile.getClientModel(dto, "view");
        return {
            ...hydrateFileDetailDto(client, references),
            isDeleted: client.isDeleted,
            customData: client.customData,
        };
    },
});

export const fileDetailView = defineView({
    viewID: "File_Detail",
    entity: xFile,
    selection: fileDetailSelection,
    dtoSchema: FileDetailDtoSchema,
    hydrate: (dto, references) => hydrateFileDetailDto(dto, references),
});

export type FileDetailClient = ClientOf<typeof fileDetailView>;
