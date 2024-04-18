
// no admin page:
// - song comments
// - song credits

import { Prisma } from "db";
import { gGeneralPaletteList } from "shared/color";
import { Permission } from "shared/permissions";
import { TAnyModel } from "shared/utils";
import { BoolField, ColorField, ConstEnumStringField, ForeignSingleField, GenericIntegerField, GenericStringField, GhostField, MakeSlugField, MakeTitleField, PKField, TagsField } from "../db3basicFields";
import * as db3 from "../db3core";
import { SongArgs, SongArgs_Verbose, SongCreditArgs, SongCreditNaturalOrderBy, SongCreditPayload, SongCreditTypeArgs, SongCreditTypeNaturalOrderBy, SongCreditTypePayload, SongNaturalOrderBy, SongPayload, SongTagArgs, SongTagAssociationArgs, SongTagAssociationNaturalOrderBy, SongTagAssociationPayload, SongTagNaturalOrderBy, SongTagPayload, SongTagSignificance, SongTaggedFilesPayload } from "./prismArgs";
import { CreatedByUserField, VisiblePermissionField } from "./user";


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
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.SongTagInclude => {
        return SongTagArgs.include;
    },
    tableName: "songTag",
    tableAuthMap: xSongTableAuthMap_R_EAdmins,
    naturalOrderBy: SongTagNaturalOrderBy,
    createInsertModelFromString: (input: string): Prisma.SongTagCreateInput => {
        return {
            text: input,
            description: "auto-created",
            sortOrder: 0,
            color: null,
            significance: null,
        };
    },
    getRowInfo: (row: SongTagPayload) => ({
        name: row.text,
        description: row.description,
        color: gGeneralPaletteList.findEntry(row.color),
        ownerUserId: null,
    }),
    columns: [
        new PKField({ columnName: "id" }),
        MakeTitleField("text", { authMap: xSongAuthMap_R_EOwn_EManagers }),
        new GenericStringField({
            columnName: "description",
            allowNull: false,
            format: "markdown",
            authMap: xSongAuthMap_R_EOwn_EManagers,
        }),
        new GenericIntegerField({
            columnName: "sortOrder",
            allowNull: false,
            authMap: xSongAuthMap_R_EOwn_EManagers,
        }),
        new ColorField({
            columnName: "color",
            allowNull: true,
            palette: gGeneralPaletteList,
            authMap: xSongAuthMap_R_EOwn_EManagers,
        }),
        new ConstEnumStringField({
            columnName: "significance",
            allowNull: true,
            defaultValue: null,
            options: SongTagSignificance,
            authMap: xSongAuthMap_R_EOwn_EManagers,
        }),
        new BoolField({
            columnName: "showOnSongLists",
            defaultValue: false,
            authMap: xSongAuthMap_R_EOwn_EManagers,
            allowNull: false,
        }),
        new GhostField({ memberName: "songs", authMap: xSongAuthMap_R_EOwn_EManagers, }),
    ]
});


////////////////////////////////////////////////////////////////

export const xSongTagAssociation = new db3.xTable({
    tableName: "SongTagAssociation",
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.SongTagAssociationInclude => {
        return SongTagAssociationArgs.include;
    },
    tableAuthMap: xSongTableAuthMap_R_EManagers,
    naturalOrderBy: SongTagAssociationNaturalOrderBy,
    getRowInfo: (row: SongTagAssociationPayload) => ({
        name: row.tag?.text || "",
        description: row.tag?.description || "",
        color: gGeneralPaletteList.findEntry(row.tag?.color || null),
        ownerUserId: null,
    }),
    columns: [
        new PKField({ columnName: "id" }),
        new ForeignSingleField<Prisma.SongTagGetPayload<{}>>({
            columnName: "tag",
            fkMember: "tagId",
            allowNull: false,
            foreignTableID: "SongTag",
            authMap: xSongAuthMap_R_EOwn_EManagers,
            getQuickFilterWhereClause: (query: string): Prisma.SongWhereInput | false => false,
        }),
    ]
});



////////////////////////////////////////////////////////////////
const xSongArgs_Base: db3.TableDesc = {
    tableName: "Song",
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.SongInclude => {
        return SongArgs.include;
    },
    tableAuthMap: xSongTableAuthMap_R_EManagers,
    naturalOrderBy: SongNaturalOrderBy,
    getRowInfo: (row: SongPayload) => ({
        name: row.name,
        description: row.description,
        ownerUserId: null,
    }),
    getParameterizedWhereClause: (params: { songId?: number, songIds?: number[] }, clientIntention: db3.xTableClientUsageContext): (Prisma.SongWhereInput[]) => {
        const ret: Prisma.SongWhereInput[] = [];

        if (params.songId !== undefined) {
            ret.push({ id: params.songId, });
        }
        if (params.songIds !== undefined) {
            ret.push({ id: { in: params.songIds } });
        }

        return ret;
    },
    softDeleteSpec: {
        isDeletedColumnName: "isDeleted",
    },
    visibilitySpec: {
        ownerUserIDColumnName: "createdByUserId",
        visiblePermissionIDColumnName: "visiblePermissionId",
    },
    columns: [
        new PKField({ columnName: "id" }),
        MakeTitleField("name", { authMap: xSongAuthMap_R_EOwn_EManagers, }),
        MakeSlugField("slug", "name", { authMap: xSongAuthMap_R_EAdmin, }),
        new GenericStringField({
            columnName: "description",
            allowNull: false,
            format: "markdown",
            authMap: xSongAuthMap_R_EOwn_EManagers,
        }),
        new GenericStringField({
            columnName: "aliases",
            allowNull: false,
            allowQuickFilter: true,
            format: "plain",
            authMap: xSongAuthMap_R_EOwn_EManagers,
        }),
        new GenericIntegerField({
            columnName: "startBPM",
            allowNull: true,
            authMap: xSongAuthMap_R_EOwn_EManagers,
        }),
        new GenericIntegerField({
            columnName: "endBPM",
            allowNull: true,
            authMap: xSongAuthMap_R_EOwn_EManagers,
        }),
        new GenericIntegerField({
            columnName: "introducedYear",
            allowNull: true,
            authMap: xSongAuthMap_R_EOwn_EManagers,
        }),
        new BoolField({
            columnName: "isDeleted",
            defaultValue: false,
            authMap: xSongAuthMap_R_EOwn_EManagers,
            allowNull: false,
        }),
        new GenericIntegerField({ // todo: a column type specifically for song lengths
            columnName: "lengthSeconds",
            allowNull: true,
            authMap: xSongAuthMap_R_EOwn_EManagers,
        }),

        new CreatedByUserField({
            columnName: "createdByUser",
            fkMember: "createdByUserId",
            authMap: xSongAuthMap_R_EAdmin,
        }),
        new VisiblePermissionField({
            columnName: "visiblePermission",
            fkMember: "visiblePermissionId",
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
            getCustomFilterWhereClause: (query: db3.CMDBTableFilterModel): Prisma.SongWhereInput | boolean => {
                if (!query.tagIds?.length) return false;
                const tagIds = query!.tagIds;

                return {
                    AND: tagIds.map(tagId => ({
                        tags: { some: { tagId: { equals: tagId } } }
                    }))
                };
            },
            getQuickFilterWhereClause: (query: string): Prisma.SongWhereInput => ({
                tags: {
                    some: {
                        tag: {
                            text: {
                                contains: query
                            }
                        }
                    }
                }
            }),
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
            getCustomFilterWhereClause: (query: db3.CMDBTableFilterModel): Prisma.SongWhereInput | boolean => false,
        }), // tags

        new GhostField({ memberName: "credits", authMap: xSongAuthMap_R_EOwn_EManagers }),
    ]
};

export const xSong = new db3.xTable(xSongArgs_Base);

export const xSong_Verbose = new db3.xTable({
    ...xSongArgs_Base,
    tableUniqueName: "xSong_Verbose",
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.SongInclude => {
        return SongArgs_Verbose.include;
    },
});

////////////////////////////////////////////////////////////////
export const xSongCreditType = new db3.xTable({
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.SongCreditTypeInclude => {
        return SongCreditTypeArgs.include;
    },
    tableAuthMap: xSongTableAuthMap_R_EAdmins,
    tableName: "songCreditType",
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
        name: row.text,
        description: row.description,
        color: gGeneralPaletteList.findEntry(row.color),
        ownerUserId: null,
    }),
    columns: [
        new PKField({ columnName: "id" }),
        MakeTitleField("text", { authMap: xSongAuthMap_R_EManagers }),
        new GenericStringField({
            columnName: "description",
            allowNull: false,
            format: "markdown",
            authMap: xSongAuthMap_R_EManagers,
        }),
        new GenericIntegerField({
            columnName: "sortOrder",
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
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.SongCreditInclude => {
        return SongCreditArgs.include;
    },
    tableName: "songCredit",
    tableAuthMap: xSongTableAuthMap_R_EManagers,
    naturalOrderBy: SongCreditNaturalOrderBy,
    getRowInfo: (row: SongCreditPayload) => ({
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
        new PKField({ columnName: "id" }),
        new ForeignSingleField<Prisma.UserGetPayload<{}>>({
            columnName: "user",
            fkMember: "userId",
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
            fkMember: "songId",
            allowNull: false,
            foreignTableID: "Song",
            authMap: xSongAuthMap_R_EManagers,
            getQuickFilterWhereClause: (query: string) => false,
        }),
        new ForeignSingleField<Prisma.SongCreditTypeGetPayload<{}>>({
            columnName: "type",
            fkMember: "typeId",
            allowNull: false,
            authMap: xSongAuthMap_R_EManagers,
            foreignTableID: "SongCreditType",
            getQuickFilterWhereClause: (query: string) => false,
        }),
    ]
});
