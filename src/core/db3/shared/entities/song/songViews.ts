import { Prisma } from "db";
import { ZodToPrismaSelection } from "@/shared/prismaUtils";
import { z } from "zod";
import { defineLegacyCrudView } from "../../core/db3CrudView";
import { defineView, type ClientOf, type DtoOf } from "../../core/db3View";
import { SongTagAssociationNaturalOrderBy } from "../../schema/prismArgs";
import { fileTagEntity } from "../file/fileEntities";
import { FileDetailDtoSchema, fileDetailSelection, hydrateFileDetailDto } from "../file/fileViews";
import { permissionEntity } from "../user/userEntities";
import { songCreditEntity, songCreditTypeEntity, songEntity, songTagEntity } from "./songEntities";

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

const SongCreditEditorDtoSchema = z.object({
    id: z.number().int(),
    comment: z.string().optional(),
    year: z.string().optional(),
    userId: z.number().int().nullable().optional(),
    user: z.object({
        id: z.number().int(),
        name: z.string().optional(),
    }).nullable().optional(),
    songId: z.number().int().optional(),
    song: z.object({
        id: z.number().int(),
        name: z.string().optional(),
        description: z.string().optional(),
    }).optional(),
    typeId: z.number().int().optional(),
    type: SongCreditTypeEditorDtoSchema.optional(),
});

const SongEditorUserDtoSchema = z.object({
    id: z.number().int(),
    name: z.string().optional(),
    cssClass: z.string().nullable().optional(),
});

const SongEditorVisibilityDtoSchema = z.object({
    id: z.number().int(),
    name: z.string().optional(),
    description: z.string().optional(),
    isVisibility: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    significance: z.string().nullable().optional(),
    color: z.string().nullable().optional(),
    iconName: z.string().nullable().optional(),
});

const SongTagAssociationEditorDtoSchema = z.object({
    id: z.number().int(),
    songId: z.number().int().optional(),
    tagId: z.number().int().optional(),
    tag: SongTagEditorDtoSchema.optional(),
});

const SongEditorDtoSchema = z.object({
    id: z.number().int(),
    name: z.string().optional(),
    aliases: z.string().optional(),
    description: z.string().optional(),
    startBPM: z.number().int().nullable().optional(),
    endBPM: z.number().int().nullable().optional(),
    introducedYear: z.number().int().nullable().optional(),
    lengthSeconds: z.number().int().nullable().optional(),
    isDeleted: z.boolean().optional(),
    createdByUserId: z.number().int().nullable().optional(),
    createdByUser: SongEditorUserDtoSchema.nullable().optional(),
    visiblePermissionId: z.number().int().nullable().optional(),
    visiblePermission: SongEditorVisibilityDtoSchema.nullable().optional(),
    tags: z.array(SongTagAssociationEditorDtoSchema).optional(),
});

const songEditorBaseSelection = ZodToPrismaSelection(SongEditorDtoSchema);
const songEditorSelection = Prisma.validator<Prisma.SongDefaultArgs>()({
    select: {
        ...songEditorBaseSelection.select,
        tags: {
            ...songEditorBaseSelection.select.tags,
            orderBy: SongTagAssociationNaturalOrderBy,
        },
    },
});

export const songTagEditorView = defineLegacyCrudView({
    viewID: "SongTag_Editor",
    entity: songTagEntity,
    operations: { create: true, update: true, delete: true },
    dtoSchema: SongTagEditorDtoSchema,
    hydrate: dto => dto,
});

export const songCreditTypeEditorView = defineLegacyCrudView({
    viewID: "SongCreditType_Editor",
    entity: songCreditTypeEntity,
    operations: { create: true, update: true, delete: true },
    dtoSchema: SongCreditTypeEditorDtoSchema,
    hydrate: dto => dto,
});

export const songCreditEditorView = defineLegacyCrudView({
    viewID: "SongCredit_Editor",
    entity: songCreditEntity,
    operations: { create: true, update: true, delete: true },
    dtoSchema: SongCreditEditorDtoSchema,
    hydrate: dto => dto,
});

export const songEditorView = defineLegacyCrudView({
    viewID: "Song_Editor",
    entity: songEntity,
    operations: { create: true, update: true, delete: true },
    selection: songEditorSelection,
    dtoSchema: SongEditorDtoSchema,
    hydrate: dto => dto,
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
});

export type SongDetailDto = DtoOf<typeof songDetailView>;
export type SongDetailClient = ClientOf<typeof songDetailView>;
