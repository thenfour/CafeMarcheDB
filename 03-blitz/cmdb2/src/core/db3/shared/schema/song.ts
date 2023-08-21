
import db, { Prisma } from "db";
import { ColorPalette, ColorPaletteEntry, gGeneralPaletteList } from "shared/color";
import { Permission } from "shared/permissions";
import { CoerceToNumberOrNull, KeysOf, TAnyModel } from "shared/utils";
import { xTable } from "../db3core";
import { ColorField, ConstEnumStringField, ForeignSingleField, GenericIntegerField, GenericStringField, BoolField, PKField, TagsField, DateTimeField } from "../db3basicFields";
import { xUser } from "./user";

////////////////////////////////////////////////////////////////
const SongTagInclude: Prisma.SongTagInclude = {
    songs: true, // not sure the point of including this; too much?
};

export type SongTagPayload = Prisma.SongTagGetPayload<{}>;

export const SongTagNaturalOrderBy: Prisma.SongTagOrderByWithRelationInput[] = [
    { sortOrder: 'desc' },
    { text: 'asc' },
    { id: 'asc' },
];

export const SongTagSignificance = {
    Improvisation: "Improvisation",
    VocalSolo: "VocalSolo",
} as const satisfies Record<string, string>;

export const xSongTag = new xTable({
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    localInclude: SongTagInclude,
    tableName: "songTag",
    naturalOrderBy: SongTagNaturalOrderBy,
    getRowInfo: (row: SongTagPayload) => ({
        name: row.text,
        description: row.description,
        color: gGeneralPaletteList.findEntry(row.color),
    }),
    columns: [
        new PKField({ columnName: "id" }),
        new GenericStringField({
            columnName: "text",
            allowNull: false,
            format: "plain",
        }),
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
        new GenericStringField({
            columnName: "classification",
            allowNull: true,
            format: "plain",
        }),
    ]
});


////////////////////////////////////////////////////////////////
export type SongTagAssociationModel = Prisma.SongTagAssociationGetPayload<{
    include: {
        song: true,
        tag: true,
    }
}>;

// not sure this is needed or used at all.
const SongTagAssociationInclude: Prisma.SongTagAssociationInclude = {
    song: true,
    tag: true,
};

const SongTagAssociationNaturalOrderBy: Prisma.SongTagAssociationOrderByWithRelationInput[] = [
    { tag: { sortOrder: 'desc' } },
    { tag: { text: 'asc' } },
    { tag: { id: 'asc' } },
];

export const xSongTagAssociation = new xTable({
    tableName: "SongTagAssociation",
    editPermission: Permission.associate_song_tags,
    viewPermission: Permission.view_general_info,
    localInclude: SongTagAssociationInclude,
    naturalOrderBy: SongTagAssociationNaturalOrderBy,
    getRowInfo: (row: SongTagAssociationModel) => ({
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
            foreignTableSpec: xSongTag,
            getQuickFilterWhereClause: (query: string): Prisma.SongWhereInput | false => false,
        }),
    ]
});



////////////////////////////////////////////////////////////////
export type SongModel = Prisma.SongGetPayload<{
    include: {
        tags: true,
    }
}>;

// not sure this is needed or used at all.
const SongInclude: Prisma.SongInclude = {
    tags: {
        include: {
            tag: true, // include foreign object
        }
    },
};

const SongNaturalOrderBy: Prisma.SongOrderByWithRelationInput[] = [
    { id: 'asc' },
];

export const xSong = new xTable({
    tableName: "Song",
    editPermission: Permission.admin_songs,
    viewPermission: Permission.view_songs,
    localInclude: SongInclude,
    naturalOrderBy: SongNaturalOrderBy,
    getRowInfo: (row: SongModel) => ({
        name: row.name,
        description: row.description,
    }),
    columns: [
        new PKField({ columnName: "id" }),
        new GenericStringField({
            columnName: "name",
            allowNull: false,
            format: "plain",
        }),
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
        new TagsField<SongTagAssociationModel>({
            columnName: "tags",
            associationForeignIDMember: "tagId",
            associationForeignObjectMember: "tag",
            associationLocalIDMember: "songId",
            associationLocalObjectMember: "song",
            associationTableSpec: xSongTagAssociation,
            foreignTableSpec: xSongTag,
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





////////////////////////////////////////////////////////////////
const SongCommentInclude: Prisma.SongCommentInclude = {
    song: true,
    user: true,
};

export type SongCommentPayload = Prisma.SongCommentGetPayload<{}>;

export const SongCommentNaturalOrderBy: Prisma.SongCommentOrderByWithRelationInput[] = [
    { updatedAt: 'desc' },
    { id: 'asc' },
];

export const xSongComment = new xTable({
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    localInclude: SongCommentInclude,
    tableName: "songComment",
    naturalOrderBy: SongTagNaturalOrderBy,
    getRowInfo: (row: SongTagPayload) => ({
        name: "<not supported>",
    }),
    columns: [
        new PKField({ columnName: "id" }),
        new GenericStringField({
            columnName: "text",
            allowNull: false,
            format: "plain",
        }),
        new BoolField({
            columnName: "isPublished", // a soft delete for users
            defaultValue: true,
        }),
        new ForeignSingleField<Prisma.UserGetPayload<{}>>({
            columnName: "user",
            fkMember: "userId",
            allowNull: false,
            foreignTableSpec: xUser,
            getQuickFilterWhereClause: (query: string) => false,
        }),
        new ForeignSingleField<Prisma.SongGetPayload<{}>>({
            columnName: "song",
            fkMember: "songId",
            allowNull: false,
            foreignTableSpec: xSong,
            getQuickFilterWhereClause: (query: string) => false,
        }),
        new DateTimeField({
            columnName: "createdAt",
            allowNull: true,
            granularity: "minute",
        }),
        new DateTimeField({
            columnName: "updatedAt",
            allowNull: true,
            granularity: "minute",
        }),
    ]
});





////////////////////////////////////////////////////////////////
const SongCreditTypeInclude: Prisma.SongCreditTypeInclude = {
    songCredits: true,
};

export type SongCreditTypePayload = Prisma.SongCreditTypeGetPayload<{}>;

export const SongCreditTypeNaturalOrderBy: Prisma.SongCreditTypeOrderByWithRelationInput[] = [
    { sortOrder: 'desc' },
    { text: 'asc' },
    { id: 'asc' },
];

export const xSongCreditType = new xTable({
    editPermission: Permission.edit_song_credit_types,
    viewPermission: Permission.view_general_info,
    localInclude: SongCreditTypeInclude,
    tableName: "songCreditType",
    naturalOrderBy: SongCreditTypeNaturalOrderBy,
    getRowInfo: (row: SongCreditTypePayload) => ({
        name: "<not supported>",
    }),
    columns: [
        new PKField({ columnName: "id" }),
        new GenericStringField({
            columnName: "text",
            allowNull: false,
            format: "plain",
        }),
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
const SongCreditInclude: Prisma.SongCreditInclude = {
    song: true,
    user: true,
    type: true,
};

export type SongCreditPayload = Prisma.SongCreditGetPayload<{}>;

export const SongCreditNaturalOrderBy: Prisma.SongCreditOrderByWithRelationInput[] = [
    { id: 'asc' },
];

export const xSongCredit = new xTable({
    editPermission: Permission.edit_song_credits,
    viewPermission: Permission.view_general_info,
    localInclude: SongCreditInclude,
    tableName: "songCredit",
    naturalOrderBy: SongCreditNaturalOrderBy,
    getRowInfo: (row: SongCreditPayload) => ({
        name: "<not supported>",
    }),
    columns: [
        new PKField({ columnName: "id" }),
        new ForeignSingleField<Prisma.UserGetPayload<{}>>({
            columnName: "user",
            fkMember: "userId",
            allowNull: false,
            foreignTableSpec: xUser,
            getQuickFilterWhereClause: (query: string) => false,
        }),
        new ForeignSingleField<Prisma.SongGetPayload<{}>>({
            columnName: "song",
            fkMember: "songId",
            allowNull: false,
            foreignTableSpec: xSong,
            getQuickFilterWhereClause: (query: string) => false,
        }),
        new ForeignSingleField<Prisma.SongCreditTypeGetPayload<{}>>({
            columnName: "type",
            fkMember: "typeId",
            allowNull: false,
            foreignTableSpec: xSongCreditType,
            getQuickFilterWhereClause: (query: string) => false,
        }),
    ]
});
