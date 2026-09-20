import { Prisma } from "db";
import { z } from "zod";
import type { DB3ReferenceProvider } from "../../core/db3Hydration";
import { defineView, type ClientOf } from "../../core/db3View";
import { instrumentEntity } from "../instrument/instrumentViews";
import { permissionEntity } from "../user/userEntities";
import { fileEntity, fileTagEntity } from "./fileEntities";

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

export const fileDetailView = defineView({
    viewID: "File_Detail",
    entity: fileEntity,
    selection: fileDetailSelection,
    dtoSchema: FileDetailDtoSchema,
    hydrate: (dto, references) => hydrateFileDetailDto(dto, references),
    getIdentity: client => client.id,
});

export type FileDetailClient = ClientOf<typeof fileDetailView>;
