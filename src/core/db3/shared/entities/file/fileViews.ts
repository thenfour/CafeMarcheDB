import { Prisma } from "db";
import { z } from "zod";
import { defineCrudView } from "../../core/db3CrudView";
import type { DB3ReferenceProvider } from "../../core/db3Hydration";
import { defineView, type ClientOf } from "../../core/db3View";
import { instrumentEntity } from "../instrument/instrumentViews";
import { permissionEntity } from "../user/userEntities";
import { fileEntity, fileTagEntity, frontpageGalleryItemEntity } from "./fileEntities";

const FileTagEditorDtoSchema = z.object({
    id: z.number().int(),
    text: z.string().optional(),
    description: z.string().optional(),
    color: z.string().nullable().optional(),
    sortOrder: z.number().int().optional(),
    significance: z.string().nullable().optional(),
});

export const fileTagEditorView = defineCrudView({
    viewID: "FileTag_Editor",
    entity: fileTagEntity,
    operations: { create: true, update: true, delete: true },
    dtoSchema: FileTagEditorDtoSchema,
    hydrate: dto => fileTagEntity.schema.getClientModel(dto, "view"),
});

const FrontpageGalleryItemEditorDtoSchema = z.object({
    id: z.number().int(),
    isDeleted: z.boolean().optional(),
    caption: z.string().optional(),
    caption_nl: z.string().nullable().optional(),
    caption_fr: z.string().nullable().optional(),
    sortOrder: z.number().int().optional(),
    fileId: z.number().int().optional(),
    file: z.object({
        id: z.number().int(),
        fileLeafName: z.string().optional(),
        description: z.string().optional(),
        uploadedByUserId: z.number().int().nullable().optional(),
    }).nullable().optional(),
    displayParams: z.string().optional(),
    createdByUserId: z.number().int().nullable().optional(),
    createdByUser: z.object({
        id: z.number().int(),
        name: z.string().optional(),
    }).nullable().optional(),
    visiblePermissionId: z.number().int().nullable().optional(),
    visiblePermission: z.object({
        id: z.number().int(),
        name: z.string().optional(),
        description: z.string().nullable().optional(),
        color: z.string().nullable().optional(),
    }).nullable().optional(),
});

export const frontpageGalleryItemEditorView = defineCrudView({
    viewID: "FrontpageGalleryItem_Editor",
    entity: frontpageGalleryItemEntity,
    operations: { create: true, update: true, delete: true },
    dtoSchema: FrontpageGalleryItemEditorDtoSchema,
    hydrate: dto => frontpageGalleryItemEntity.schema.getClientModel(dto, "view"),
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
});

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
        visiblePermission: references.get(permissionEntity, dto.visiblePermissionId),
        tags: references.mapOptionalCollection(dto.tags, (association, index) => ({
            ...association,
            fileTag: references.require(
                fileTagEntity,
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
                instrumentEntity,
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
}).extend({
    isDeleted: z.boolean().optional(),
    customData: z.string().nullable().optional(),
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
    entity: fileEntity,
    operations: { update: true, delete: true },
    selection: fileEditorSelection,
    dtoSchema: FileEditorDtoSchema,
    hydrate: (dto, references) => {
        const client = fileEntity.schema.getClientModel(dto, "view");
        return {
            ...hydrateFileDetailDto(client, references),
            isDeleted: client.isDeleted,
            customData: client.customData,
        };
    },
});

export const fileDetailView = defineView({
    viewID: "File_Detail",
    entity: fileEntity,
    selection: fileDetailSelection,
    dtoSchema: FileDetailDtoSchema,
    hydrate: (dto, references) => hydrateFileDetailDto(dto, references),
});

export type FileDetailClient = ClientOf<typeof fileDetailView>;
