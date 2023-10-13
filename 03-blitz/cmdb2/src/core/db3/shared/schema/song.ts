
// no admin page:
// - song comments
// - song credits

import db, { Prisma } from "db";
import { ColorPalette, ColorPaletteEntry, gGeneralPaletteList } from "shared/color";
import { Permission } from "shared/permissions";
import { CoerceToNumberOrNull, KeysOf, TAnyModel } from "shared/utils";
import * as db3 from "../db3core";
import { ColorField, ConstEnumStringField, ForeignSingleField, GenericIntegerField, GenericStringField, BoolField, PKField, TagsField, DateTimeField, MakeTitleField, MakeCreatedAtField } from "../db3basicFields";
import { CreatedByUserField, VisiblePermissionField, xPermission, xUser } from "./user";
import { SongArgs, SongPayload } from "./instrument";

////////////////////////////////////////////////////////////////
const SongTagArgs = Prisma.validator<Prisma.SongTagArgs>()({
    include: {
        songs: true
    }
});

export type SongTagPayload = Prisma.SongTagGetPayload<typeof SongTagArgs>;

export const SongTagNaturalOrderBy: Prisma.SongTagOrderByWithRelationInput[] = [
    { sortOrder: 'desc' },
    { text: 'asc' },
    { id: 'asc' },
];

export const SongTagSignificance = {
    Improvisation: "Improvisation",
    VocalSolo: "VocalSolo",
} as const satisfies Record<string, string>;

export const xSongTag = new db3.xTable({
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.SongTagInclude => {
        return SongTagArgs.include;
    },
    applyIncludeFilteringForExtraColumns: (include: TAnyModel, clientIntention: db3.xTableClientUsageContext) => { },
    applyExtraColumnsToNewObject: (obj: TAnyModel, clientIntention: db3.xTableClientUsageContext) => { },
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

const SongTagAssociationArgs = Prisma.validator<Prisma.SongTagAssociationArgs>()({
    include: {
        song: true,
        tag: true,
    }
});

export type SongTagAssociationPayload = Prisma.SongTagAssociationGetPayload<typeof SongTagAssociationArgs>;

const SongTagAssociationNaturalOrderBy: Prisma.SongTagAssociationOrderByWithRelationInput[] = [
    { tag: { sortOrder: 'desc' } },
    { tag: { text: 'asc' } },
    { tag: { id: 'asc' } },
];

export const xSongTagAssociation = new db3.xTable({
    tableName: "SongTagAssociation",
    editPermission: Permission.associate_song_tags,
    viewPermission: Permission.view_general_info,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.SongTagAssociationInclude => {
        return SongTagAssociationArgs.include;
    },
    applyExtraColumnsToNewObject: (obj: TAnyModel, clientIntention: db3.xTableClientUsageContext) => { },
    applyIncludeFilteringForExtraColumns: (include: TAnyModel, clientIntention: db3.xTableClientUsageContext) => { },
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
            foreignTableSpec: xSongTag,
            getQuickFilterWhereClause: (query: string): Prisma.SongWhereInput | false => false,
        }),
    ]
});



////////////////////////////////////////////////////////////////

const SongNaturalOrderBy: Prisma.SongOrderByWithRelationInput[] = [
    { id: 'asc' },
];

export const xSong = new db3.xTable({
    tableName: "Song",
    editPermission: Permission.admin_songs,
    viewPermission: Permission.view_songs,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.SongInclude => {
        return SongArgs.include;
    },
    applyIncludeFilteringForExtraColumns: (include: TAnyModel, clientIntention: db3.xTableClientUsageContext) => { },
    applyExtraColumnsToNewObject: (obj: TAnyModel, clientIntention: db3.xTableClientUsageContext) => { },
    naturalOrderBy: SongNaturalOrderBy,
    getRowInfo: (row: SongPayload) => ({
        name: row.name,
        description: row.description,
    }),
    getParameterizedWhereClause: (params: { userId?: number }, clientIntention: db3.xTableClientUsageContext): Prisma.SongWhereInput[] => {
        const ret: Prisma.SongWhereInput[] = [];
        console.assert(clientIntention.currentUser?.id !== undefined);
        console.assert(clientIntention.currentUser?.role?.permissions !== undefined);
        if (clientIntention.intention === "user") {
            // apply soft delete
            ret.push({ isDeleted: { equals: false } });
        }
        // apply visibility
        db3.ApplyVisibilityWhereClause(ret, clientIntention, "createdByUserId");
        console.log(`getParameterizedWhereClause for song with params: ${params}`);
        console.log(ret)
        return ret;
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
            associationTableSpec: xSongTagAssociation,
            foreignTableSpec: xSongTag,
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


////////////////////////////////////////////////////////////////
const SongCommentArgs = Prisma.validator<Prisma.SongCommentArgs>()({
    include: {
        song: true,
        user: true,
        visiblePermission: {
            include: {
                roles: true
            }
        },
    }
});

export type SongCommentPayload = Prisma.SongCommentGetPayload<typeof SongCommentArgs>;

export const SongCommentNaturalOrderBy: Prisma.SongCommentOrderByWithRelationInput[] = [
    { updatedAt: 'desc' },
    { id: 'asc' },
];

export const xSongComment = new db3.xTable({
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.SongCommentInclude => {
        return SongCommentArgs.include;
    },
    applyIncludeFilteringForExtraColumns: (include: TAnyModel, clientIntention: db3.xTableClientUsageContext) => { },
    applyExtraColumnsToNewObject: (obj: TAnyModel, clientIntention: db3.xTableClientUsageContext) => { },
    tableName: "songComment",
    naturalOrderBy: SongCommentNaturalOrderBy,
    getRowInfo: (row: SongCommentPayload) => ({
        name: "<not supported>",
    }),
    getParameterizedWhereClause: (params: TAnyModel, clientIntention: db3.xTableClientUsageContext): (Prisma.SongCommentWhereInput[] | false) => {
        if (params.songId != null) {
            return [{
                songId: { equals: params.songId }
            }];
        }
        return false;
    },
    columns: [
        new PKField({ columnName: "id" }),
        new GenericStringField({
            columnName: "text",
            allowNull: false,
            format: "plain",
        }),
        new ForeignSingleField<Prisma.UserGetPayload<{}>>({
            columnName: "user",
            fkMember: "userId",
            allowNull: false,
            foreignTableSpec: xUser,
            getQuickFilterWhereClause: (query: string) => false,
        }),

        new VisiblePermissionField({
            columnName: "visiblePermission",
            fkMember: "visiblePermissionId",
        }),
        new ForeignSingleField<Prisma.SongGetPayload<{}>>({
            columnName: "song",
            fkMember: "songId",
            allowNull: false,
            foreignTableSpec: xSong,
            getQuickFilterWhereClause: (query: string) => false,
        }),
        MakeCreatedAtField("createdAt"),
        new DateTimeField({
            columnName: "updatedAt",
            allowNull: true,
            granularity: "minute",
        }),
    ]
});





////////////////////////////////////////////////////////////////
const SongCreditTypeArgs = Prisma.validator<Prisma.SongCreditTypeArgs>()({
    include: {
        songCredits: true,
    }
});

export type SongCreditTypePayload = Prisma.SongCreditTypeGetPayload<typeof SongCreditTypeArgs>;

export const SongCreditTypeNaturalOrderBy: Prisma.SongCreditTypeOrderByWithRelationInput[] = [
    { sortOrder: 'desc' },
    { text: 'asc' },
    { id: 'asc' },
];

export const xSongCreditType = new db3.xTable({
    editPermission: Permission.edit_song_credit_types,
    viewPermission: Permission.view_general_info,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.SongCreditTypeInclude => {
        return SongCreditTypeArgs.include;
    },
    applyIncludeFilteringForExtraColumns: (include: TAnyModel, clientIntention: db3.xTableClientUsageContext) => { },
    applyExtraColumnsToNewObject: (obj: TAnyModel, clientIntention: db3.xTableClientUsageContext) => { },
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
const SongCreditArgs = Prisma.validator<Prisma.SongCreditArgs>()({
    include: {
        song: true,
        user: true,
        type: true,
    }
});

export type SongCreditPayload = Prisma.SongCreditGetPayload<typeof SongCreditArgs>;

export const SongCreditNaturalOrderBy: Prisma.SongCreditOrderByWithRelationInput[] = [
    { id: 'asc' },
];

export const xSongCredit = new db3.xTable({
    editPermission: Permission.edit_song_credits,
    viewPermission: Permission.view_general_info,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.SongCreditInclude => {
        return SongCreditArgs.include;
    },
    applyIncludeFilteringForExtraColumns: (include: TAnyModel, clientIntention: db3.xTableClientUsageContext) => { },
    applyExtraColumnsToNewObject: (obj: TAnyModel, clientIntention: db3.xTableClientUsageContext) => { },
    tableName: "songCredit",
    naturalOrderBy: SongCreditNaturalOrderBy,
    getRowInfo: (row: SongCreditPayload) => ({
        name: "<a song credit>",
    }),
    getParameterizedWhereClause: (params: TAnyModel, clientIntention: db3.xTableClientUsageContext): (Prisma.SongCreditWhereInput[] | false) => {
        console.log(`song credit getParameterizedWhereClause`);
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
