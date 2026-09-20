import { Prisma } from "db";
import { z } from "zod";
import { defineCrudView } from "../../core/db3CrudView";
import { defineView, type ClientOf, type DtoOf } from "../../core/db3View";
import { fileTagEntity } from "../file/fileEntities";
import { FileDetailDtoSchema, fileDetailSelection, hydrateFileDetailDto } from "../file/fileViews";
import { permissionEntity } from "../user/userEntities";
import { songCreditTypeEntity, songEntity, songTagEntity } from "./songEntities";

const SongTagEditorDtoSchema = z.object({
    id: z.number().int(),
    text: z.string().optional(),
    description: z.string().optional(),
    color: z.string().nullable().optional(),
    sortOrder: z.number().int().optional(),
    significance: z.string().nullable().optional(),
    group: z.string().nullable().optional(),
    indicator: z.string().nullable().optional(),
    indicatorCssClass: z.string().nullable().optional(),
});

const SongCreditTypeEditorDtoSchema = z.object({
    id: z.number().int(),
    text: z.string().optional(),
    description: z.string().optional(),
    color: z.string().nullable().optional(),
    sortOrder: z.number().int().optional(),
    significance: z.string().nullable().optional(),
});

const songTagEditorSelection = Prisma.validator<Prisma.SongTagDefaultArgs>()({
    select: {
        id: true,
        text: true,
        description: true,
        color: true,
        sortOrder: true,
        significance: true,
        group: true,
        indicator: true,
        indicatorCssClass: true,
    },
});

const songCreditTypeEditorSelection = Prisma.validator<Prisma.SongCreditTypeDefaultArgs>()({
    select: {
        id: true,
        text: true,
        description: true,
        color: true,
        sortOrder: true,
        significance: true,
    },
});

export const songTagEditorView = defineCrudView({
    viewID: "SongTag_Editor",
    entity: songTagEntity,
    selection: songTagEditorSelection,
    dtoSchema: SongTagEditorDtoSchema,
    hydrate: dto => dto,
    getIdentity: client => client.id,
});

export const songCreditTypeEditorView = defineCrudView({
    viewID: "SongCreditType_Editor",
    entity: songCreditTypeEntity,
    selection: songCreditTypeEditorSelection,
    dtoSchema: SongCreditTypeEditorDtoSchema,
    hydrate: dto => dto,
    getIdentity: client => client.id,
});

const SongTagAssociationDtoSchema = z.object({
    id: z.number().int(),
    tagId: z.number().int().optional(),
});

const SongSearchFileTagDtoSchema = z.object({
    id: z.number().int(),
    fileTagId: z.number().int().optional(),
});

const SongSearchTaggedFileDtoSchema = z.object({
    id: z.number().int(),
    file: z.object({
        id: z.number().int(),
        tags: z.array(SongSearchFileTagDtoSchema).optional(),
    }).optional(),
});

const SongSearchCreditDtoSchema = z.object({
    id: z.number().int(),
    typeId: z.number().int().optional(),
    year: z.string().optional(),
    comment: z.string().optional(),
    user: z.object({
        id: z.number().int(),
        name: z.string().optional(),
    }).nullable().optional(),
});

// This is the requested maximum shape. Every non-identity field is optional in
// the DTO because field authorization can remove it after Prisma returns.
const SongSearchDtoSchema = z.object({
    id: z.number().int(),
    name: z.string().optional(),
    aliases: z.string().optional(),
    startBPM: z.number().int().nullable().optional(),
    endBPM: z.number().int().nullable().optional(),
    introducedYear: z.number().int().nullable().optional(),
    lengthSeconds: z.number().int().nullable().optional(),
    visiblePermissionId: z.number().int().nullable().optional(),
    tags: z.array(SongTagAssociationDtoSchema).optional(),
    taggedFiles: z.array(SongSearchTaggedFileDtoSchema).optional(),
    credits: z.array(SongSearchCreditDtoSchema).optional(),
});

export const songSearchSelection = Prisma.validator<Prisma.SongDefaultArgs>()({
    select: {
        id: true,
        name: true,
        aliases: true,
        startBPM: true,
        endBPM: true,
        introducedYear: true,
        lengthSeconds: true,
        createdByUserId: true,
        visiblePermissionId: true,
        isDeleted: true,
        tags: {
            select: {
                id: true,
                songId: true,
                tagId: true,
            },
        },
        taggedFiles: {
            select: {
                id: true,
                fileId: true,
                songId: true,
                file: {
                    select: {
                        id: true,
                        uploadedByUserId: true,
                        visiblePermissionId: true,
                        isDeleted: true,
                        tags: {
                            select: {
                                id: true,
                                fileTagId: true,
                            },
                        },
                    },
                },
            },
            orderBy: { file: { uploadedAt: "desc" } },
        },
        credits: {
            select: {
                id: true,
                userId: true,
                songId: true,
                typeId: true,
                year: true,
                comment: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        },
    },
});

export const songSearchView = defineView({
    viewID: "Song_Search",
    entity: songEntity,
    selection: songSearchSelection,
    dtoSchema: SongSearchDtoSchema,
    hydrate: (dto, references) => ({
        ...dto,
        visiblePermission: references.get(permissionEntity, dto.visiblePermissionId),

        tags: references.mapOptionalCollection(dto.tags, (assoc, index) => ({
            ...assoc,
            tag: references.require(
                songTagEntity,
                assoc.tagId,
                `Song(${dto.id}).tags[${index}].tagId`,
            ),
        }))
            ?.sort((a, b) => a.tag.sortOrder - b.tag.sortOrder),

        taggedFiles: references.mapOptionalCollection(dto.taggedFiles, (association, associationIndex) => ({
            ...association,
            file: association.file && {
                ...association.file,
                tags: references.mapOptionalCollection(association.file.tags, (tagAssociation, tagIndex) => ({
                    ...tagAssociation,
                    fileTag: references.require(
                        fileTagEntity,
                        tagAssociation.fileTagId,
                        `Song(${dto.id}).taggedFiles[${associationIndex}].file.tags[${tagIndex}].fileTagId`,
                    ),
                })),
            }
        })),
    }),
    getIdentity: client => client.id,
});

export type SongSearchDto = DtoOf<typeof songSearchView>;
export type SongSearchClient = ClientOf<typeof songSearchView>;

const SongDetailTaggedFileDtoSchema = z.object({
    id: z.number().int(),
    file: FileDetailDtoSchema.optional(),
});

const SongDetailCreditDtoSchema = z.object({
    id: z.number().int(),
    userId: z.number().int().nullable().optional(),
    songId: z.number().int().optional(),
    typeId: z.number().int().optional(),
    year: z.string().optional(),
    comment: z.string().optional(),
    user: z.object({
        id: z.number().int(),
        name: z.string().optional(),
    }).nullable().optional(),
});

const SongDetailDtoSchema = z.object({
    id: z.number().int(),
    name: z.string().optional(),
    aliases: z.string().optional(),
    description: z.string().optional(),
    startBPM: z.number().int().nullable().optional(),
    endBPM: z.number().int().nullable().optional(),
    introducedYear: z.number().int().nullable().optional(),
    lengthSeconds: z.number().int().nullable().optional(),
    createdByUserId: z.number().int().nullable().optional(),
    visiblePermissionId: z.number().int().nullable().optional(),
    pinnedRecordingId: z.number().int().nullable().optional(),
    tags: z.array(SongTagAssociationDtoSchema).optional(),
    taggedFiles: z.array(SongDetailTaggedFileDtoSchema).optional(),
    credits: z.array(SongDetailCreditDtoSchema).optional(),
});

export const songDetailSelection = Prisma.validator<Prisma.SongDefaultArgs>()({
    select: {
        id: true,
        name: true,
        aliases: true,
        description: true,
        startBPM: true,
        endBPM: true,
        introducedYear: true,
        lengthSeconds: true,
        createdByUserId: true,
        visiblePermissionId: true,
        pinnedRecordingId: true,
        isDeleted: true,
        tags: {
            select: {
                id: true,
                songId: true,
                tagId: true,
            },
        },
        taggedFiles: {
            select: {
                id: true,
                fileId: true,
                songId: true,
                file: fileDetailSelection,
            },
            orderBy: { file: { uploadedAt: "desc" } },
        },
        credits: {
            select: {
                id: true,
                userId: true,
                songId: true,
                typeId: true,
                year: true,
                comment: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        },
    },
});

export const songDetailView = defineView({
    viewID: "Song_Detail",
    entity: songEntity,
    selection: songDetailSelection,
    dtoSchema: SongDetailDtoSchema,
    hydrate: (dto, references) => ({
        ...dto,
        visiblePermission: references.get(permissionEntity, dto.visiblePermissionId),
        tags: references.mapOptionalCollection(dto.tags, (association, index) => ({
            ...association,
            tag: references.require(
                songTagEntity,
                association.tagId,
                `Song(${dto.id}).tags[${index}].tagId`,
            ),
        }))?.sort((a, b) => a.tag.sortOrder - b.tag.sortOrder),
        taggedFiles: references.mapOptionalCollection(dto.taggedFiles, association => association)
            ?.flatMap((association, index) => association.file == null ? [] : [{
                ...association,
                file: hydrateFileDetailDto(
                    association.file,
                    references,
                    `Song(${dto.id}).taggedFiles[${index}].file`,
                ),
            }]),
        credits: references.mapOptionalCollection(dto.credits, credit => credit),
    }),
    getIdentity: client => client.id,
});

export type SongDetailDto = DtoOf<typeof songDetailView>;
export type SongDetailClient = ClientOf<typeof songDetailView>;
