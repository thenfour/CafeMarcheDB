
// no admin page:
// - song credits

import { Prisma } from "db";
import { Permission } from "shared/permissions";
import { CMDBTableFilterModel } from "../apiTypes";
import { ColorField, ConstEnumStringField, ForeignSingleField, GenericIntegerField, GhostField, MakeColorField, MakeIsDeletedField, MakePKfield, MakeSignificanceField, MakeSortOrderField, TagsField } from "../db3basicFields";
import * as db3 from "../db3core";
import { GenericStringField, MakeDescriptionField, MakeTitleField } from "../genericStringField";
import { SongArgs, SongArgs_Verbose, SongCreditArgs, SongCreditNaturalOrderBy, SongCreditPayload, SongCreditTypeArgs, SongCreditTypeNaturalOrderBy, SongCreditTypePayload, SongCreditTypeSignificance, SongNaturalOrderBy, SongPayload, SongTagArgs, SongTagAssociationArgs, SongTagAssociationNaturalOrderBy, SongTagAssociationPayload, SongTagNaturalOrderBy, SongTagPayload, SongTagSignificance, SongTaggedFilesPayload } from "./prismArgs";
import { MakeCreatedByField, MakeVisiblePermissionField } from "./user";
import { gGeneralPaletteList } from "@/src/core/components/color/palette";
import { TAnyModel } from "@/shared/rootroot";


export const xSongAuthMap_R_EOwn_EManagers: db3.DB3AuthContextPermissionMap = {
    PostQueryAsOwner: Permission.view_songs,
    PostQuery: Permission.view_songs,
    PreMutateAsOwner: Permission.view_songs,
    PreMutate: Permission.manage_songs,
    PreInsert: Permission.manage_songs,
};

export const xSongAuthMap_R_EManagers: db3.DB3AuthContextPermissionMap = {
    PostQueryAsOwner: Permission.view_songs,
    PostQuery: Permission.view_songs,
    PreMutateAsOwner: Permission.manage_songs,
    PreMutate: Permission.manage_songs,
    PreInsert: Permission.manage_songs,
};

export const xSongAuthMap_R_EAdmin: db3.DB3AuthContextPermissionMap = {
    PostQueryAsOwner: Permission.view_songs,
    PostQuery: Permission.view_songs,
    PreMutateAsOwner: Permission.admin_songs,
    PreMutate: Permission.admin_songs,
    PreInsert: Permission.admin_songs,
};




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


export const xSongTag = new db3.xTable({
    getSelectionArgs: (clientIntention: db3.xTableClientUsageContext): Prisma.SongTagDefaultArgs => {
        return SongTagArgs;
    },
    tableName: "SongTag",
    tableAuthMap: xSongTableAuthMap_R_EAdmins,
    naturalOrderBy: SongTagNaturalOrderBy,
    createInsertModelFromString: (input: string): Prisma.SongTagCreateInput => {
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
        pk: row.id,
        name: row.text,
        description: row.description,
        color: gGeneralPaletteList.findEntry(row.color),
        ownerUserId: null,
    }),
    columns: [
        MakePKfield(),
        MakeTitleField("text", { authMap: xSongAuthMap_R_EOwn_EManagers }),
        MakeDescriptionField({ authMap: xSongAuthMap_R_EOwn_EManagers }),
        MakeSortOrderField({ authMap: xSongAuthMap_R_EOwn_EManagers, }),
        MakeColorField({ authMap: xSongAuthMap_R_EOwn_EManagers }),

        new GenericStringField({
            columnName: "indicator",
            allowNull: true,
            format: "plain",
            authMap: xSongAuthMap_R_EOwn_EManagers,
        }),
        new GenericStringField({
            columnName: "group",
            allowNull: true,
            format: "plain",
            authMap: xSongAuthMap_R_EOwn_EManagers,
        }),
        new GenericStringField({
            columnName: "indicatorCssClass",
            allowNull: true,
            format: "plain",
            authMap: xSongAuthMap_R_EOwn_EManagers,
        }),
        new ConstEnumStringField({
            columnName: "significance",
            allowNull: true,
            defaultValue: null,
            options: SongTagSignificance,
            authMap: xSongAuthMap_R_EOwn_EManagers,
        }),
        new GhostField({ memberName: "songs", authMap: xSongAuthMap_R_EOwn_EManagers, }),
    ]
});


////////////////////////////////////////////////////////////////

export const xSongTagAssociation = new db3.xTable({
    tableName: "SongTagAssociation",
    getSelectionArgs: (clientIntention: db3.xTableClientUsageContext): Prisma.SongTagAssociationDefaultArgs => {
        return SongTagAssociationArgs;
    },
    tableAuthMap: xSongTableAuthMap_R_EManagers,
    naturalOrderBy: SongTagAssociationNaturalOrderBy,
    getRowInfo: (row: SongTagAssociationPayload) => ({
        name: row.tag?.text || "",
        pk: row.id,
        description: row.tag?.description || "",
        color: gGeneralPaletteList.findEntry(row.tag?.color || null),
        ownerUserId: null,
    }),
    columns: [
        MakePKfield(),
        new ForeignSingleField<Prisma.SongTagGetPayload<{}>>({
            columnName: "tag",
            fkidMember: "tagId",
            allowNull: false,
            foreignTableID: "SongTag",
            authMap: xSongAuthMap_R_EOwn_EManagers,
            getQuickFilterWhereClause: (query: string): Prisma.SongWhereInput | false => false,
        }),
    ]
});



////////////////////////////////////////////////////////////////
export interface SongTableParams {
    songId?: number;
    songIds?: number[];
};

////////////////////////////////////////////////////////////////
const xSongArgs_Base: db3.TableDesc = {
    tableName: "Song",
    getSelectionArgs: (clientIntention: db3.xTableClientUsageContext): Prisma.SongDefaultArgs => {
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
    getParameterizedWhereClause: (params: SongTableParams, clientIntention: db3.xTableClientUsageContext): (Prisma.SongWhereInput[]) => {
        const ret: Prisma.SongWhereInput[] = [];

        if (params.songId !== undefined) {
            ret.push({ id: params.songId, });
        }
        if (params.songIds !== undefined) {
            ret.push({ id: { in: params.songIds } });
        }

        return ret;
    },
    columns: [
        MakePKfield(),
        MakeTitleField("name", { authMap: xSongAuthMap_R_EOwn_EManagers, }),
        MakeDescriptionField({ authMap: xSongAuthMap_R_EOwn_EManagers, }),
        MakeIsDeletedField({ authMap: xSongAuthMap_R_EOwn_EManagers, }),
        MakeCreatedByField(),
        MakeVisiblePermissionField({ authMap: xSongAuthMap_R_EOwn_EManagers, }),

        new GenericStringField({
            columnName: "aliases",
            allowNull: false,
            allowQuickFilter: true,
            format: "plain",
            authMap: xSongAuthMap_R_EOwn_EManagers,
        }),
        new GenericIntegerField({
            columnName: "startBPM",
            allowSearchingThisField: false,
            allowNull: true,
            authMap: xSongAuthMap_R_EOwn_EManagers,
        }),
        new GenericIntegerField({
            columnName: "endBPM",
            allowSearchingThisField: false,
            allowNull: true,
            authMap: xSongAuthMap_R_EOwn_EManagers,
        }),
        new GenericIntegerField({
            columnName: "introducedYear",
            allowSearchingThisField: false,
            allowNull: true,
            authMap: xSongAuthMap_R_EOwn_EManagers,
        }),
        new GenericIntegerField({ // todo: a column type specifically for song lengths
            columnName: "lengthSeconds",
            allowSearchingThisField: false,
            allowNull: true,
            authMap: xSongAuthMap_R_EOwn_EManagers,
        }),

        new TagsField<SongTagAssociationPayload>({
            columnName: "tags",
            associationForeignIDMember: "tagId",
            associationForeignObjectMember: "tag",
            associationLocalIDMember: "songId",
            associationLocalObjectMember: "song",
            associationTableID: "SongTagAssociation",
            foreignTableID: "SongTag",
            authMap: xSongAuthMap_R_EOwn_EManagers,
            getCustomFilterWhereClause: (query: CMDBTableFilterModel): Prisma.SongWhereInput | boolean => {
                if (!query.tagIds?.length) return false;
                const tagIds = query!.tagIds;

                return {
                    AND: tagIds.map(tagId => ({
                        tags: { some: { tagId: { equals: tagId } } }
                    }))
                };
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
        new TagsField<SongTaggedFilesPayload>({
            columnName: "taggedFiles",
            foreignTableID: "File",
            associationTableID: "FileSongTag",
            associationForeignIDMember: "fileId",
            associationForeignObjectMember: "file",
            authMap: xSongAuthMap_R_EOwn_EManagers,
            associationLocalIDMember: "songId",
            associationLocalObjectMember: "song",
            getQuickFilterWhereClause: (query: string): Prisma.SongWhereInput | boolean => false,
            getCustomFilterWhereClause: (query: CMDBTableFilterModel): Prisma.SongWhereInput | boolean => false,
        }), // tags

        new GhostField({ memberName: "credits", authMap: xSongAuthMap_R_EOwn_EManagers }),
        new GhostField({ memberName: "pinnedRecordingId", authMap: xSongAuthMap_R_EOwn_EManagers }),
    ]
};

export const xSong = new db3.xTable(xSongArgs_Base);

export const xSong_Verbose = new db3.xTable({
    ...xSongArgs_Base,
    tableUniqueName: "xSong_Verbose",
    getSelectionArgs: (clientIntention: db3.xTableClientUsageContext): Prisma.SongDefaultArgs => {
        return SongArgs_Verbose;
    },
});

////////////////////////////////////////////////////////////////
export const xSongCreditType = new db3.xTable({
    getSelectionArgs: (clientIntention: db3.xTableClientUsageContext): Prisma.SongCreditTypeDefaultArgs => {
        return SongCreditTypeArgs;
    },
    tableAuthMap: xSongTableAuthMap_R_EAdmins,
    tableName: "SongCreditType",
    naturalOrderBy: SongCreditTypeNaturalOrderBy,
    createInsertModelFromString: (input: string): Prisma.SongCreditTypeCreateInput => {
        return {
            text: input,
            description: "auto-created",
            sortOrder: 0,
            color: null,
        };
    },
    getRowInfo: (row: SongCreditTypePayload) => ({
        pk: row.id,
        name: row.text,
        description: row.description,
        color: gGeneralPaletteList.findEntry(row.color),
        ownerUserId: null,
    }),
    columns: [
        MakePKfield(),
        MakeTitleField("text", { authMap: xSongAuthMap_R_EManagers }),
        MakeSignificanceField("significance", SongCreditTypeSignificance, { authMap: xSongAuthMap_R_EManagers, }),
        new GenericStringField({
            columnName: "description",
            allowNull: false,
            format: "markdown",
            authMap: xSongAuthMap_R_EManagers,
        }),
        new GenericIntegerField({
            columnName: "sortOrder",
            allowSearchingThisField: false,
            allowNull: false,
            authMap: xSongAuthMap_R_EManagers,
        }),
        new ColorField({
            columnName: "color",
            allowNull: true,
            palette: gGeneralPaletteList,
            authMap: xSongAuthMap_R_EManagers,
        }),
        new GhostField({
            memberName: "songCredits",
            authMap: xSongAuthMap_R_EManagers,
        }),
    ]
});



////////////////////////////////////////////////////////////////
export const xSongCredit = new db3.xTable({
    getSelectionArgs: (clientIntention: db3.xTableClientUsageContext): Prisma.SongCreditDefaultArgs => {
        return SongCreditArgs;
    },
    tableName: "SongCredit",
    tableAuthMap: xSongTableAuthMap_R_EManagers,
    naturalOrderBy: SongCreditNaturalOrderBy,
    getRowInfo: (row: SongCreditPayload) => ({
        pk: row.id,
        name: "<a song credit>",
        ownerUserId: row.userId, // questionable.
    }),
    getParameterizedWhereClause: (params: TAnyModel, clientIntention: db3.xTableClientUsageContext): (Prisma.SongCreditWhereInput[] | false) => {
        if (params.songId != null) {
            return [{
                songId: { equals: params.songId }
            }];
        }
        return false;
    },
    columns: [
        MakePKfield(),
        new ForeignSingleField<Prisma.UserGetPayload<{}>>({
            columnName: "user",
            fkidMember: "userId",
            allowNull: true,
            foreignTableID: "User",
            authMap: xSongAuthMap_R_EManagers,
            getQuickFilterWhereClause: (query: string) => false,
        }),
        new GenericStringField({
            columnName: "comment",
            allowNull: false,
            format: "markdown",
            authMap: xSongAuthMap_R_EManagers,
        }),
        new GenericStringField({
            columnName: "year",
            allowNull: false,
            format: "plain",
            authMap: xSongAuthMap_R_EManagers,
        }),

        new ForeignSingleField<Prisma.SongGetPayload<{}>>({
            columnName: "song",
            fkidMember: "songId",
            allowNull: false,
            foreignTableID: "Song",
            authMap: xSongAuthMap_R_EManagers,
            getQuickFilterWhereClause: (query: string) => false,
        }),
        new ForeignSingleField<Prisma.SongCreditTypeGetPayload<{}>>({
            columnName: "type",
            fkidMember: "typeId",
            allowNull: false,
            authMap: xSongAuthMap_R_EManagers,
            foreignTableID: "SongCreditType",
            getQuickFilterWhereClause: (query: string) => false,
        }),
    ]
});
