
// no admin page:
// - song credits

import { Prisma } from "db";
import { Permission } from "shared/permissions";
import type {
    SongCreditPublicId,
    SongTagAssociationPublicId,
    SongTagPublicId,
    SongPublicId,
} from "shared/publicId";
import { CMDBTableFilterModel } from "../apiTypes";
import { ForeignCollectionField, foreignRef, foreignRefByTableId, GenericIntegerField, MakeIsDeletedField, MakePKfield, MakePublicIdField, tagsRef } from "../columnTypes/xTableColumnTypes";
import * as db3 from "../db3core";
import { serverOwnedField } from "../columnTypes/inherited";
import { GenericStringField, MakeDescriptionField, MakeTitleField } from "../columnTypes/genericString";
import { SongArgs, SongCreditArgs, SongCreditNaturalOrderBy, SongCreditPayload, SongNaturalOrderBy, SongPayload, SongTagAssociationArgs, SongTagAssociationNaturalOrderBy, SongTagAssociationPayload } from "./prismArgs";
import { MakeCreatedByField, MakeVisiblePermissionField, xUser } from "./user";
import { xBandSongTag as xSongTag } from "../entities/song/bandSongTagViews";
import { gGeneralPaletteList } from "@/src/core/components/color/palette";
import { localizedText } from "../columnTypes/localizedString";
import { catalogColor } from "../columnTypes/bandCatalog";
import { xSongCreditType } from "../entities/song/songCreditTypes";

export { xSongTag, xSongCreditType };


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


////////////////////////////////////////////////////////////////

export const xSongTagAssociation = db3.defineTable({
    prismaModel: db3.prismaModel<Prisma.BandSongTagAssociationDelegate>(),
    getIdentity: (association: { publicId: SongTagAssociationPublicId }) => association.publicId,
    tableName: "BandSongTagAssociation",
    bandScope: {
        member: "bandId",
        via: {
            relation: "song",
            ownerUserMember: "createdByUserId"
        },
        managePermission: Permission.manage_songs,
    },
    readConsistency: "snapshot",
    deletePolicy: "hard",
    getSelectionArgs: (): Prisma.BandSongTagAssociationDefaultArgs => {
        return SongTagAssociationArgs;
    },
    tableAuthMap: xSongTableAuthMap_R_EManagers,
    naturalOrderBy: SongTagAssociationNaturalOrderBy,
    getRowInfo: (row: SongTagAssociationPayload) => ({
        // Narrow views may omit the tag; display metadata consumes its resolved values.
        name: localizedText(row.tag?.name) ?? "",
        pk: row.publicId,
        description: localizedText(row.tag?.description) ?? "",
        color: catalogColor(row.tag?.color, gGeneralPaletteList),
        ownerUserId: null,
    }),
    fields: db3.makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "sysadmin" }),
        publicId: () => MakePublicIdField<SongTagAssociationPublicId>(),
        song: foreignRef(() => xSong, {
            fkidMember: "songId",
            authMap: xSongAuthMap_R_EOwn_EManagers,
        }),
        tag: foreignRef(() => xSongTag, {
            fkidMember: "bandSongTagId",
            authMap: xSongAuthMap_R_EOwn_EManagers,
            getQuickFilterWhereClause: (query: string): Prisma.SongWhereInput | false => false,
        }),
    })
});



////////////////////////////////////////////////////////////////
export interface SongTableParams {
    songId?: SongPublicId;
    songIds?: SongPublicId[];
    songTagIds?: SongTagPublicId[];
};

interface ResolvedSongTableParams {
    songId?: number;
    songIds?: number[];
    songTagIds?: number[];
}

////////////////////////////////////////////////////////////////
const xSongArgs_Base = db3.defineTableDesc({
    prismaModel: db3.prismaModel<Prisma.SongDelegate>(),
    getIdentity: (song: { publicId: SongPublicId }) => song.publicId,
    tableName: "Song",
    bandScope: {
        member: "bandId",
        managePermission: Permission.manage_songs
    },
    readConsistency: "snapshot",
    deletePolicy: "softOnly",
    viewDeletedPermission: Permission.recover_songs,
    restorePermission: Permission.recover_songs,
    queryParameters: {
        songId: { kind: "entityIdentity", targetTableID: "Song", authorizeAs: "publicId", nullable: true },
        songIds: { kind: "entityIdentityArray", targetTableID: "Song", authorizeAs: "publicId", nullable: true },
        songTagIds: {
            kind: "entityIdentityArray",
            targetTableID: "BandSongTag",
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
        pk: row.publicId,
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
                AND: params.songTagIds.map(bandSongTagId => ({
                    tags: { some: { bandSongTagId } },
                })),
            });
        }

        return ret;
    },
    fields: db3.makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "sysadmin" }),
        publicId: () => MakePublicIdField<SongPublicId>(),
        bandId: columnName => serverOwnedField(new GenericIntegerField({
            columnName, allowNull: false,
            allowSearchingThisField: false,
            authMap: {
                ...xSongAuthMap_R_EManagers,
                PostQuery: Permission.never_grant,
                PostQueryAsOwner: Permission.never_grant
            },
        })),
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

        tags: tagsRef("BandSongTagAssociation", "BandSongTag", {
            associationForeignObjectMember: "tag",
            associationForeignIDMember: "bandSongTagId",
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
        pinnedRecording: foreignRefByTableId("File", {
            fkidMember: "pinnedRecordingId",
            // An unavailable recording must not hide the independently visible song.
            allowNull: true,
            authMap: xSongAuthMap_R_EOwn_EManagers,
            getQuickFilterWhereClause: (query: string) => false,
        }),
    })
});

export const xSong = db3.defineTable(xSongArgs_Base);

////////////////////////////////////////////////////////////////
export interface SongCreditTableParams {
    songId?: SongPublicId | null;
    userId?: number | null;
}

export const xSongCredit = db3.defineTable({
    prismaModel: db3.prismaModel<Prisma.SongCreditDelegate>(),
    getIdentity: (credit: { publicId: SongCreditPublicId }) => credit.publicId,
    getSelectionArgs: (): Prisma.SongCreditDefaultArgs => {
        return SongCreditArgs;
    },
    tableName: "SongCredit",
    bandScope: {
        member: "bandId",
        via: {
            relation: "song",
            ownerUserMember: "createdByUserId"
        },
        managePermission: Permission.manage_songs
    },
    readConsistency: "snapshot",
    deletePolicy: "hard",
    queryParameters: {
        songId: { kind: "entityIdentity", targetTableID: "Song", authorizeAs: "songId", nullable: true },
        userId: { kind: "entityIdentity", targetTableID: "User", authorizeAs: "publicId", nullable: true },
    } satisfies db3.DB3QueryParameterMap,
    tableAuthMap: xSongTableAuthMap_R_EManagers,
    naturalOrderBy: SongCreditNaturalOrderBy,
    getRowInfo: (row: SongCreditPayload) => ({
        pk: row.publicId,
        name: "<a song credit>",
        ownerUserId: row.userId, // questionable.
    }),
    getParameterizedWhereClause: (params: { songId?: number | null; userId?: number | null }): (Prisma.SongCreditWhereInput[] | false) => {
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
            requireVisibleTarget: true,
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
        BandSongTagAssociation: typeof xSongTagAssociation;
        SongCredit: typeof xSongCredit;
    }
}
