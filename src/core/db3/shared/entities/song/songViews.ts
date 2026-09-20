import { Prisma } from "db";
import { z } from "zod";
import { defineView, type ClientOf, type DtoOf } from "../../core/db3View";
import { fileTagEntity } from "../file/fileEntities";
import { permissionEntity } from "../user/userEntities";
import { songEntity, songTagEntity } from "./songEntities";

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

        tags: references.getTags(dto.tags, (assoc, index) => ({
            ...assoc,
            tag: references.require(
                songTagEntity,
                assoc.tagId,
                `Song(${dto.id}).tags[${index}].tagId`,
            ),
        }))
            .sort((a, b) => a.tag.sortOrder - b.tag.sortOrder),

        taggedFiles: references.getTags(dto.taggedFiles, (association, associationIndex) => ({
            ...association,
            file: association.file && {
                ...association.file,
                tags: references.getTags(association.file.tags, (tagAssociation, tagIndex) => ({
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
