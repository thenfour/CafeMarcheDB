import { Prisma } from "db";
import { z } from "zod";
import { defineView, type ClientOf, type DtoOf } from "../../core/db3View";
import { instrumentEntity } from "../instrument/instrumentViews";
import { permissionEntity } from "../user/userEntities";
import { fileEntity, fileTagEntity } from "./fileEntities";

const FileSearchTagDtoSchema = z.object({
    id: z.number().int(),
    fileTagId: z.number().int().optional(),
});

const FileSearchSongTagDtoSchema = z.object({
    id: z.number().int(),
    song: z.object({
        id: z.number().int(),
        name: z.string().optional(),
    }).nullable().optional(),
});

const FileSearchEventTagDtoSchema = z.object({
    id: z.number().int(),
    event: z.object({
        id: z.number().int(),
        name: z.string().optional(),
        startsAt: z.date().nullable().optional(),
        statusId: z.number().int().nullable().optional(),
        typeId: z.number().int().nullable().optional(),
    }).nullable().optional(),
});

const FileSearchInstrumentTagDtoSchema = z.object({
    id: z.number().int(),
    instrumentId: z.number().int().optional(),
});

const FileSearchWikiPageTagDtoSchema = z.object({
    id: z.number().int(),
    wikiPage: z.object({
        id: z.number().int(),
        slug: z.string().optional(),
    }).nullable().optional(),
});

// This is the maximum shape requested by the File search UI. Every field
// except transport identities remains optional after recursive authorization.
const FileSearchDtoSchema = z.object({
    id: z.number().int(),
    fileLeafName: z.string().optional(),
    description: z.string().optional(),
    uploadedAt: z.date().optional(),
    uploadedByUser: z.object({
        id: z.number().int(),
        name: z.string().optional(),
    }).nullable().optional(),
    visiblePermissionId: z.number().int().nullable().optional(),
    sizeBytes: z.number().int().nullable().optional(),
    storedLeafName: z.string().optional(),
    mimeType: z.string().nullable().optional(),
    externalURI: z.string().nullable().optional(),
    tags: z.array(FileSearchTagDtoSchema).optional(),
    taggedSongs: z.array(FileSearchSongTagDtoSchema).optional(),
    taggedEvents: z.array(FileSearchEventTagDtoSchema).optional(),
    taggedInstruments: z.array(FileSearchInstrumentTagDtoSchema).optional(),
    taggedWikiPages: z.array(FileSearchWikiPageTagDtoSchema).optional(),
});

export const fileSearchSelection = Prisma.validator<Prisma.FileDefaultArgs>()({
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
        tags: {
            select: {
                id: true,
                fileTagId: true,
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

export const fileSearchView = defineView({
    viewID: "File_Search",
    entity: fileEntity,
    selection: fileSearchSelection,
    dtoSchema: FileSearchDtoSchema,
    hydrate: (dto, references) => ({
        ...dto,
        visiblePermission: references.get(permissionEntity, dto.visiblePermissionId),
        tags: references.mapOptionalCollection(dto.tags, (association, index) => ({
            ...association,
            fileTag: references.require(
                fileTagEntity,
                association.fileTagId,
                `File(${dto.id}).tags[${index}].fileTagId`,
            ),
        })),
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
                `File(${dto.id}).taggedInstruments[${index}].instrumentId`,
            ),
        })),
        taggedWikiPages: references.mapOptionalCollection(dto.taggedWikiPages, association => association)
            ?.flatMap(association => association.wikiPage == null ? [] : [{
                ...association,
                wikiPage: association.wikiPage,
            }]),
    }),
    getIdentity: client => client.id,
});

export type FileSearchDto = DtoOf<typeof fileSearchView>;
export type FileSearchClient = ClientOf<typeof fileSearchView>;
