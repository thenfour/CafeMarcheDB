
// no admin page:
// - song comments
// - song credits

import { Prisma } from "db";
import { gGeneralPaletteList } from "shared/color";
import { Permission } from "shared/permissions";
import { TAnyModel } from "shared/utils";
import { BoolField, ColorField, ConstEnumStringField, ForeignSingleField, GenericIntegerField, GenericStringField, MakeTitleField, PKField, TagsField } from "../db3basicFields";
import * as db3 from "../db3core";
import { SongArgs, SongCreditArgs, SongCreditNaturalOrderBy, SongCreditPayload, SongCreditTypeArgs, SongCreditTypeNaturalOrderBy, SongCreditTypePayload, SongNaturalOrderBy, SongPayload, SongTagArgs, SongTagAssociationArgs, SongTagAssociationNaturalOrderBy, SongTagAssociationPayload, SongTagNaturalOrderBy, SongTagPayload, SongTagSignificance } from "./prismArgs";
import { CreatedByUserField, VisiblePermissionField } from "./user";



export const xSongTag = new db3.xTable({
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.SongTagInclude => {
        return SongTagArgs.include;
    },
    tableName: "songTag",
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
    }),
    columns: [
        new PKField({ columnName: "id" }),
        MakeTitleField("text"),
        new GenericStringField({
            columnName: "description",
            allowNull: false,
            format: "markdown",
        }),
        new GenericIntegerField({
            columnName: "sortOrder",
            allowNull: false,
        }),
        new ColorField({
            columnName: "color",
            allowNull: true,
            palette: gGeneralPaletteList,
        }),
        new ConstEnumStringField({
            columnName: "significance",
            allowNull: true,
            defaultValue: null,
            options: SongTagSignificance,
        }),
        new BoolField({
            columnName: "showOnSongLists",
            defaultValue: false,
        }),
    ]
});


////////////////////////////////////////////////////////////////

export const xSongTagAssociation = new db3.xTable({
    tableName: "SongTagAssociation",
    editPermission: Permission.associate_song_tags,
    viewPermission: Permission.view_general_info,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.SongTagAssociationInclude => {
        return SongTagAssociationArgs.include;
    },
    naturalOrderBy: SongTagAssociationNaturalOrderBy,
    getRowInfo: (row: SongTagAssociationPayload) => ({
        name: row.tag.text,
        description: row.tag.description,
        color: gGeneralPaletteList.findEntry(row.tag.color),
    }),
    columns: [
        new PKField({ columnName: "id" }),
        new ForeignSingleField<Prisma.SongTagGetPayload<{}>>({
            columnName: "tag",
            fkMember: "tagId",
            allowNull: false,
            foreignTableID: "SongTag",
            getQuickFilterWhereClause: (query: string): Prisma.SongWhereInput | false => false,
        }),
    ]
});



////////////////////////////////////////////////////////////////

export const xSong = new db3.xTable({
    tableName: "Song",
    editPermission: Permission.admin_songs,
    viewPermission: Permission.view_songs,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.SongInclude => {
        return SongArgs.include;
    },
    naturalOrderBy: SongNaturalOrderBy,
    getRowInfo: (row: SongPayload) => ({
        name: row.name,
        description: row.description,
    }),
    softDeleteSpec: {
        isDeletedColumnName: "isDeleted",
    },
    visibilitySpec: {
        ownerUserIDColumnName: "createdByUserId",
        visiblePermissionIDColumnName: "visiblePermissionId",
    },
    columns: [
        new PKField({ columnName: "id" }),
        MakeTitleField("name"),
        new GenericStringField({
            columnName: "slug",
            allowNull: false,
            format: "plain",
        }),
        new GenericStringField({
            columnName: "description",
            allowNull: false,
            format: "markdown",
        }),
        new GenericIntegerField({
            columnName: "startBPM",
            allowNull: true,
        }),
        new GenericIntegerField({
            columnName: "endBPM",
            allowNull: true,
        }),
        new GenericIntegerField({
            columnName: "introducedYear",
            allowNull: true,
        }),
        new BoolField({
            columnName: "isDeleted",
            defaultValue: false,
        }),
        new GenericIntegerField({ // todo: a column type specifically for song lengths
            columnName: "lengthSeconds",
            allowNull: true,
        }),

        new CreatedByUserField({
            columnName: "createdByUser",
            fkMember: "createdByUserId",
        }),
        new VisiblePermissionField({
            columnName: "visiblePermission",
            fkMember: "visiblePermissionId",
        }),

        new TagsField<SongTagAssociationPayload>({
            columnName: "tags",
            associationForeignIDMember: "tagId",
            associationForeignObjectMember: "tag",
            associationLocalIDMember: "songId",
            associationLocalObjectMember: "song",
            associationTableID: "SongTagAssociation",
            foreignTableID: "SongTag",
            getCustomFilterWhereClause: (query: db3.CMDBTableFilterModel): Prisma.InstrumentWhereInput | boolean => false,
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
    ]
});


// ////////////////////////////////////////////////////////////////
// export const xSongComment = new db3.xTable({
//     editPermission: Permission.admin_general,
//     viewPermission: Permission.view_general_info,
//     getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.SongCommentInclude => {
//         return SongCommentArgs.include;
//     },
//     tableName: "songComment",
//     naturalOrderBy: SongCommentNaturalOrderBy,
//     getRowInfo: (row: SongCommentPayload) => ({
//         name: "<not supported>",
//     }),
//     getParameterizedWhereClause: (params: TAnyModel, clientIntention: db3.xTableClientUsageContext): (Prisma.SongCommentWhereInput[] | false) => {
//         if (params.songId != null) {
//             return [{
//                 songId: { equals: params.songId }
//             }];
//         }
//         return false;
//     },
//     visibilitySpec: {
//         ownerUserIDColumnName: "userId",
//         visiblePermissionIDColumnName: "visiblePermissionId",
//     },
//     columns: [
//         new PKField({ columnName: "id" }),
//         new GenericStringField({
//             columnName: "text",
//             allowNull: false,
//             format: "plain",
//         }),
//         new ForeignSingleField<Prisma.UserGetPayload<{}>>({
//             columnName: "user",
//             fkMember: "userId",
//             allowNull: false,
//             foreignTableID: "User",
//             getQuickFilterWhereClause: (query: string) => false,
//         }),

//         new VisiblePermissionField({
//             columnName: "visiblePermission",
//             fkMember: "visiblePermissionId",
//         }),
//         new ForeignSingleField<Prisma.SongGetPayload<{}>>({
//             columnName: "song",
//             fkMember: "songId",
//             allowNull: false,
//             foreignTableID: "Song",
//             getQuickFilterWhereClause: (query: string) => false,
//         }),
//         MakeCreatedAtField("createdAt"),
//         new DateTimeField({
//             columnName: "updatedAt",
//             allowNull: true,
//             granularity: "minute",
//         }),
//     ]
// });





////////////////////////////////////////////////////////////////
export const xSongCreditType = new db3.xTable({
    editPermission: Permission.edit_song_credit_types,
    viewPermission: Permission.view_general_info,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.SongCreditTypeInclude => {
        return SongCreditTypeArgs.include;
    },
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
    }),
    columns: [
        new PKField({ columnName: "id" }),
        MakeTitleField("text"),
        new GenericStringField({
            columnName: "description",
            allowNull: false,
            format: "markdown",
        }),
        new GenericIntegerField({
            columnName: "sortOrder",
            allowNull: false,
        }),
        new ColorField({
            columnName: "color",
            allowNull: true,
            palette: gGeneralPaletteList,
        }),
    ]
});



////////////////////////////////////////////////////////////////
export const xSongCredit = new db3.xTable({
    editPermission: Permission.edit_song_credits,
    viewPermission: Permission.view_general_info,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.SongCreditInclude => {
        return SongCreditArgs.include;
    },
    tableName: "songCredit",
    naturalOrderBy: SongCreditNaturalOrderBy,
    getRowInfo: (row: SongCreditPayload) => ({
        name: "<a song credit>",
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
            allowNull: false,
            foreignTableID: "User",
            getQuickFilterWhereClause: (query: string) => false,
        }),
        new ForeignSingleField<Prisma.SongGetPayload<{}>>({
            columnName: "song",
            fkMember: "songId",
            allowNull: false,
            foreignTableID: "Song",
            getQuickFilterWhereClause: (query: string) => false,
        }),
        new ForeignSingleField<Prisma.SongCreditTypeGetPayload<{}>>({
            columnName: "type",
            fkMember: "typeId",
            allowNull: false,
            foreignTableID: "SongCreditType",
            getQuickFilterWhereClause: (query: string) => false,
        }),
    ]
});
