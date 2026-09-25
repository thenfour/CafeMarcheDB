
// no admin page:
// - song credits

import { Prisma } from "db";
import { Permission } from "shared/permissions";
import type {
    SongCreditPublicId,
    SongCreditTypePublicId,
    SongTagAssociationPublicId,
    SongTagPublicId,
} from "shared/publicId";
import { CMDBTableFilterModel } from "../apiTypes";
import { ColorField, ConstEnumStringField, ForeignCollectionField, foreignRef, GenericIntegerField, GhostField, MakeColorField, MakeIsDeletedField, MakePKfield, MakePublicIdField, MakeSignificanceField, MakeSortOrderField, tagsRef } from "../columnTypes/xTableColumnTypes";
import * as db3 from "../db3core";
import { GenericStringField, MakeDescriptionField, MakeTitleField } from "../columnTypes/genericString";
import { SongArgs, SongCreditArgs, SongCreditNaturalOrderBy, SongCreditPayload, SongCreditTypeArgs, SongCreditTypeNaturalOrderBy, SongCreditTypePayload, SongCreditTypeSignificance, SongNaturalOrderBy, SongPayload, SongTagArgs, SongTagAssociationArgs, SongTagAssociationNaturalOrderBy, SongTagAssociationPayload, SongTagNaturalOrderBy, SongTagPayload, SongTagSignificance } from "./prismArgs";
import { MakeCreatedByField, MakeVisiblePermissionField, xUser } from "./user";
import { gGeneralPaletteList } from "@/src/core/components/color/palette";
import { z } from "zod";


export const xSongAuthMap_R_EOwn_EManagers = db3.defineAuthMap({
    PostQueryAsOwner: db3.DB3FieldReadAuth.inheritRow,
    PostQuery: db3.DB3FieldReadAuth.inheritRow,
    PreMutateAsOwner: Permission.view_songs,
    PreMutate: Permission.manage_songs,
    PreInsert: Permission.manage_songs,
});

export const xSongAuthMap_R_EManagers = db3.defineAuthMap({
    PostQueryAsOwner: db3.DB3FieldReadAuth.inheritRow,
    PostQuery: db3.DB3FieldReadAuth.inheritRow,
    PreMutateAsOwner: Permission.manage_songs,
    PreMutate: Permission.manage_songs,
    PreInsert: Permission.manage_songs,
});

export const xSongAuthMap_R_EAdmin = db3.defineAuthMap({
    PostQueryAsOwner: db3.DB3FieldReadAuth.inheritRow,
    PostQuery: db3.DB3FieldReadAuth.inheritRow,
    PreMutateAsOwner: Permission.admin_songs,
    PreMutate: Permission.admin_songs,
    PreInsert: Permission.admin_songs,
});




export const xSongTableAuthMap_R_EManagers: db3.DB3AuthTablePermissionMap = {
    ViewOwn: Permission.view_songs,
    View: Permission.view_songs,
    EditOwn: Permission.manage_songs,
    Edit: Permission.manage_songs,
    Insert: Permission.manage_songs,
};

export const xSongTableAuthMap_R_EAdmins: db3.DB3AuthTablePermissionMap = {
    ViewOwn: Permission.view_songs,
    View: Permission.view_songs,
    EditOwn: Permission.admin_songs,
    Edit: Permission.admin_songs,
    Insert: Permission.admin_songs,
};


export const xSongTag = db3.defineTable({
    prismaModel: db3.prismaModel<Prisma.SongTagDelegate>(),
    getIdentity: (tag: { publicId: SongTagPublicId }) => tag.publicId,
    getSelectionArgs: (): Prisma.SongTagDefaultArgs => {
        return SongTagArgs;
    },
    tableName: "SongTag",
    deletePolicy: "hard",
    tableAuthMap: xSongTableAuthMap_R_EAdmins,
    naturalOrderBy: SongTagNaturalOrderBy,
    createInsertModelFromString: (input: string): Partial<SongTagPayload> => {
        return {
            text: input,
            description: "auto-created",
            sortOrder: 0,
            color: null,
            significance: null,
            indicator: null,
            indicatorCssClass: null,
        };
    },
    getRowInfo: (row: SongTagPayload) => ({
        pk: row.publicId,
        name: row.text,
        description: row.description,
        color: gGeneralPaletteList.findEntry(row.color),
        ownerUserId: null,
    }),
    fields: db3.makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "sysadmin" }),
        publicId: () => MakePublicIdField<SongTagPublicId>(),
        text: columnName => MakeTitleField(columnName, { authMap: xSongAuthMap_R_EOwn_EManagers }),
        description: () => MakeDescriptionField({ authMap: xSongAuthMap_R_EOwn_EManagers }),
        sortOrder: () => MakeSortOrderField({ authMap: xSongAuthMap_R_EOwn_EManagers, }),
        color: () => MakeColorField({ authMap: xSongAuthMap_R_EOwn_EManagers }),

        indicator: columnName => new GenericStringField({
            columnName,
            allowNull: true,
            format: "plain",
            authMap: xSongAuthMap_R_EOwn_EManagers,
        }),
        group: columnName => new GenericStringField({
            columnName,
            allowNull: true,
            format: "plain",
            authMap: xSongAuthMap_R_EOwn_EManagers,
        }),
        indicatorCssClass: columnName => new GenericStringField({
            columnName,
            allowNull: true,
            format: "plain",
            authMap: xSongAuthMap_R_EOwn_EManagers,
        }),
        significance: columnName => new ConstEnumStringField({
            columnName,
            allowNull: true,
            defaultValue: null,
            options: SongTagSignificance,
            authMap: xSongAuthMap_R_EOwn_EManagers,
        }),
        songs: memberName => new GhostField({ memberName, authMap: xSongAuthMap_R_EOwn_EManagers, }),
    })
});


////////////////////////////////////////////////////////////////

export const xSongTagAssociation = db3.defineTable({
    prismaModel: db3.prismaModel<Prisma.SongTagAssociationDelegate>(),
    getIdentity: (association: { publicId: SongTagAssociationPublicId }) => association.publicId,
    tableName: "SongTagAssociation",
    deletePolicy: "hard",
    getSelectionArgs: (): Prisma.SongTagAssociationDefaultArgs => {
        return SongTagAssociationArgs;
    },
    tableAuthMap: xSongTableAuthMap_R_EManagers,
    naturalOrderBy: SongTagAssociationNaturalOrderBy,
    getRowInfo: (row: SongTagAssociationPayload) => ({
        name: row.tag?.text || "",
        pk: row.publicId,
        description: row.tag?.description || "",
        color: gGeneralPaletteList.findEntry(row.tag?.color || null),
        ownerUserId: null,
    }),
    fields: db3.makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "sysadmin" }),
        publicId: () => MakePublicIdField<SongTagAssociationPublicId>(),
        songId: memberName => new GhostField({
            memberName,
            readTransportSchema: z.number().int(),
            authMap: xSongAuthMap_R_EOwn_EManagers,
        }),
        tag: foreignRef(() => xSongTag, {
            fkidMember: "tagId",
            authMap: xSongAuthMap_R_EOwn_EManagers,
            getQuickFilterWhereClause: (query: string): Prisma.SongWhereInput | false => false,
        }),
    })
});



////////////////////////////////////////////////////////////////
export interface SongTableParams {
    songId?: number;
    songIds?: number[];
    songTagIds?: SongTagPublicId[];
};

interface ResolvedSongTableParams extends Omit<SongTableParams, "songTagIds"> {
    songTagIds?: number[];
}

////////////////////////////////////////////////////////////////
const xSongArgs_Base = db3.defineTableDesc({
    prismaModel: db3.prismaModel<Prisma.SongDelegate>(),
    getIdentity: (song: { id: number }) => song.id,
    tableName: "Song",
    deletePolicy: "softOnly",
    viewDeletedPermission: Permission.recover_songs,
    restorePermission: Permission.recover_songs,
    queryParameters: {
        songId: { kind: "integer", authorizeAs: "id", nullable: true },
        songIds: { kind: "integerArray", authorizeAs: "id", nullable: true },
        songTagIds: {
            kind: "entityIdentityArray",
            targetTableID: "SongTag",
            authorizeAs: "tags",
            nullable: true,
        },
    },
    getSelectionArgs: (): Prisma.SongDefaultArgs => {
        return SongArgs;
    },
    tableAuthMap: xSongTableAuthMap_R_EManagers,
    naturalOrderBy: SongNaturalOrderBy,
    getRowInfo: (row: SongPayload) => ({
        pk: row.id,
        name: row.name,
        description: row.description,
        ownerUserId: null,
    }),
    getParameterizedWhereClause: (params: ResolvedSongTableParams): (Prisma.SongWhereInput[]) => {
        const ret: Prisma.SongWhereInput[] = [];

        if (params.songId !== undefined) {
            ret.push({ id: params.songId, });
        }
        if (params.songIds !== undefined) {
            ret.push({ id: { in: params.songIds } });
        }
        if (params.songTagIds?.length) {
            ret.push({
                AND: params.songTagIds.map(tagId => ({
                    tags: { some: { tagId } },
                })),
            });
        }

        return ret;
    },
    fields: db3.makeColumnSet({
        id: () => MakePKfield(),
        name: columnName => MakeTitleField(columnName, { authMap: xSongAuthMap_R_EOwn_EManagers, }),
        description: () => MakeDescriptionField({ authMap: xSongAuthMap_R_EOwn_EManagers, }),
        isDeleted: () => MakeIsDeletedField({ authMap: xSongAuthMap_R_EOwn_EManagers, }),
        createdByUser: () => MakeCreatedByField(),
        visiblePermission: () => MakeVisiblePermissionField({ authMap: xSongAuthMap_R_EOwn_EManagers, }),

        aliases: columnName => new GenericStringField({
            columnName,
            allowNull: false,
            allowQuickFilter: true,
            format: "plain",
            authMap: xSongAuthMap_R_EOwn_EManagers,
        }),
        startBPM: columnName => new GenericIntegerField({
            columnName,
            allowSearchingThisField: false,
            allowNull: true,
            authMap: xSongAuthMap_R_EOwn_EManagers,
        }),
        endBPM: columnName => new GenericIntegerField({
            columnName,
            allowSearchingThisField: false,
            allowNull: true,
            authMap: xSongAuthMap_R_EOwn_EManagers,
        }),
        introducedYear: columnName => new GenericIntegerField({
            columnName,
            allowSearchingThisField: false,
            allowNull: true,
            authMap: xSongAuthMap_R_EOwn_EManagers,
        }),
        lengthSeconds: columnName => new GenericIntegerField({ // todo: a column type specifically for song lengths
            columnName,
            allowSearchingThisField: false,
            allowNull: true,
            authMap: xSongAuthMap_R_EOwn_EManagers,
        }),

        tags: tagsRef("SongTagAssociation", "SongTag", {
            associationForeignObjectMember: "tag",
            associationLocalObjectMember: "song",
            authMap: xSongAuthMap_R_EOwn_EManagers,
            getCustomFilterWhereClause: (query: CMDBTableFilterModel): Prisma.SongWhereInput | boolean => {
                // Identity-bearing filters use SongTableParams.songTagIds so
                // they cross the trusted public-to-natural translation boundary.
                return false;
            },
            // don't allow quick search on tag; it interferes with getSongFilterInfo.ts
            getQuickFilterWhereClause: () => false,
            // getQuickFilterWhereClause: (query: string): Prisma.SongWhereInput => ({
            //     tags: {
            //         some: {
            //             tag: {
            //                 text: {
            //                     contains: query
            //                 }
            //             }
            //         }
            //     }
            // }),
        }),
        taggedFiles: tagsRef("FileSongTag", "File", {
            associationForeignObjectMember: "file",
            authMap: xSongAuthMap_R_EOwn_EManagers,
            associationLocalObjectMember: "song",
            getQuickFilterWhereClause: (query: string): Prisma.SongWhereInput | boolean => false,
            getCustomFilterWhereClause: (query: CMDBTableFilterModel): Prisma.SongWhereInput | boolean => false,
        }), // tags

        credits: memberName => new ForeignCollectionField({
            memberName,
            foreignTableID: "SongCredit",
            authMap: xSongAuthMap_R_EOwn_EManagers,
        }),
        pinnedRecordingId: memberName => new GhostField({
            memberName,
            readTransportSchema: z.number().int().nullable(),
            authMap: xSongAuthMap_R_EOwn_EManagers,
        }),
    })
});

export const xSong = db3.defineTable(xSongArgs_Base);

////////////////////////////////////////////////////////////////
export const xSongCreditType = db3.defineTable({
    prismaModel: db3.prismaModel<Prisma.SongCreditTypeDelegate>(),
    getIdentity: (creditType: { publicId: SongCreditTypePublicId }) => creditType.publicId,
    getSelectionArgs: (): Prisma.SongCreditTypeDefaultArgs => {
        return SongCreditTypeArgs;
    },
    tableAuthMap: xSongTableAuthMap_R_EAdmins,
    tableName: "SongCreditType",
    deletePolicy: "hard",
    naturalOrderBy: SongCreditTypeNaturalOrderBy,
    createInsertModelFromString: (input: string): Partial<SongCreditTypePayload> => {
        return {
            text: input,
            description: "auto-created",
            sortOrder: 0,
            color: null,
        };
    },
    getRowInfo: (row: SongCreditTypePayload) => ({
        pk: row.publicId,
        name: row.text,
        description: row.description,
        color: gGeneralPaletteList.findEntry(row.color),
        ownerUserId: null,
    }),
    fields: db3.makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "sysadmin" }),
        publicId: () => MakePublicIdField<SongCreditTypePublicId>(),
        text: columnName => MakeTitleField(columnName, { authMap: xSongAuthMap_R_EManagers }),
        significance: columnName => MakeSignificanceField(columnName, SongCreditTypeSignificance, { authMap: xSongAuthMap_R_EManagers, }),
        description: columnName => new GenericStringField({
            columnName,
            allowNull: false,
            format: "markdown",
            authMap: xSongAuthMap_R_EManagers,
        }),
        sortOrder: columnName => new GenericIntegerField({
            columnName,
            allowSearchingThisField: false,
            allowNull: false,
            authMap: xSongAuthMap_R_EManagers,
        }),
        color: columnName => new ColorField({
            columnName,
            allowNull: true,
            palette: gGeneralPaletteList,
            authMap: xSongAuthMap_R_EManagers,
        }),
        songCredits: memberName => new GhostField({
            memberName,
            authMap: xSongAuthMap_R_EManagers,
        }),
    })
});



////////////////////////////////////////////////////////////////
export interface SongCreditTableParams {
    songId?: number | null;
    userId?: number | null;
}

export const xSongCredit = db3.defineTable({
    prismaModel: db3.prismaModel<Prisma.SongCreditDelegate>(),
    getIdentity: (credit: { publicId: SongCreditPublicId }) => credit.publicId,
    getSelectionArgs: (): Prisma.SongCreditDefaultArgs => {
        return SongCreditArgs;
    },
    tableName: "SongCredit",
    deletePolicy: "hard",
    queryParameters: {
        songId: { kind: "integer", authorizeAs: "songId", nullable: true },
        userId: { kind: "integer", authorizeAs: "userId", nullable: true },
    } satisfies db3.DB3QueryParameterMap,
    tableAuthMap: xSongTableAuthMap_R_EManagers,
    naturalOrderBy: SongCreditNaturalOrderBy,
    getRowInfo: (row: SongCreditPayload) => ({
        pk: row.publicId,
        name: "<a song credit>",
        ownerUserId: row.userId, // questionable.
    }),
    getParameterizedWhereClause: (params: SongCreditTableParams): (Prisma.SongCreditWhereInput[] | false) => {
        const ret: Prisma.SongCreditWhereInput[] = [];
        if (params.songId != null) {
            ret.push({
                songId: { equals: params.songId }
            });
        }
        if (params.userId != null) {
            ret.push({
                userId: { equals: params.userId },
            });
        }
        return ret.length > 0 ? ret : false;
    },
    fields: db3.makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "sysadmin" }),
        publicId: () => MakePublicIdField<SongCreditPublicId>(),
        user: foreignRef(() => xUser, {
            fkidMember: "userId",
            allowNull: true,
            authMap: xSongAuthMap_R_EManagers,
        }),
        comment: columnName => new GenericStringField({
            columnName,
            allowNull: false,
            format: "markdown",
            authMap: xSongAuthMap_R_EManagers,
        }),
        year: columnName => new GenericStringField({
            columnName,
            allowNull: false,
            format: "plain",
            authMap: xSongAuthMap_R_EManagers,
        }),

        song: foreignRef(() => xSong, {
            fkidMember: "songId",
            authMap: xSongAuthMap_R_EManagers,
        }),
        type: foreignRef(() => xSongCreditType, {
            fkidMember: "typeId",
            authMap: xSongAuthMap_R_EManagers,
        }),
    })
});

// statically-typed registration
// allows retaining type information even when looking up a table by
// static string table id.
declare module "../db3core" {
    interface DB3TableTypeRegistry {
        Song: typeof xSong;
        SongTag: typeof xSongTag;
        SongTagAssociation: typeof xSongTagAssociation;
        SongCreditType: typeof xSongCreditType;
        SongCredit: typeof xSongCredit;
    }
}
