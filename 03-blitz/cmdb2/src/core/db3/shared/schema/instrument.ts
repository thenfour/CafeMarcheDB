// note: many-to-many associations we treat mostly as "tags".
// both sides of the relationship are NOT equal; for example the association model will specify the tags field but not the local field,
// because we don't show the data from the tags perspective. we show it from the local perspective therefore we don't need that data, and specifying it would encounter circular references etc.

// another example of the imbalanced relationship:
// the "name" of an association model will be the tag. not the local object.

import db, { Prisma } from "db";
import { ColorPalette, ColorPaletteEntry, gGeneralPaletteList } from "shared/color";
import { Permission } from "shared/permissions";
import { CoerceToNumberOrNull, KeysOf, TAnyModel } from "shared/utils";
import { xTable } from "../db3core";
import { ColorField, ConstEnumStringField, ForeignSingleField, GenericIntegerField, GenericStringField, BoolField, PKField, TagsField, DateTimeField, MakeTitleField } from "../db3basicFields";


////////////////////////////////////////////////////////////////
const InstrumentFunctionalGroupInclude: Prisma.InstrumentFunctionalGroupInclude = {
    instruments: true,
};

export type InstrumentFunctionalGroupModel = Prisma.InstrumentFunctionalGroupGetPayload<{}>;
export type InstrumentFunctionalGroupPayload = InstrumentFunctionalGroupModel;
export type InstrumentFunctionalGroupMinimalPayload = InstrumentFunctionalGroupModel;
export const InstrumentFunctionalGroupNaturalSortOrder: Prisma.InstrumentFunctionalGroupOrderByWithRelationInput[] = [
    { sortOrder: 'desc' },
    { name: 'asc' },
    { id: 'asc' },
];

export const xInstrumentFunctionalGroup = new xTable({
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    localInclude: InstrumentFunctionalGroupInclude,
    tableName: "instrumentFunctionalGroup",
    naturalOrderBy: InstrumentFunctionalGroupNaturalSortOrder,
    getRowInfo: (row: InstrumentFunctionalGroupModel) => ({
        name: row.name,
        description: row.description,
        color: gGeneralPaletteList.findEntry(row.color),
    }),
    createInsertModelFromString: (input: string): Partial<InstrumentFunctionalGroupModel> => ({
        description: "auto-created from selection dlg",
        name: input,
        sortOrder: 0,
    }),
    columns: [
        new PKField({ columnName: "id" }),
        MakeTitleField("name"),
        new GenericStringField({
            columnName: "description",
            allowNull: false,
            format: "markdown",
        }),
        new ColorField({
            columnName: "color",
            allowNull: true,
            palette: gGeneralPaletteList,
        }),
        new GenericIntegerField({
            columnName: "sortOrder",
            allowNull: false,
        }),
    ]
});

////////////////////////////////////////////////////////////////
const InstrumentTagInclude: Prisma.InstrumentTagInclude = {
    instruments: true,
};

export type InstrumentTagPayload = Prisma.InstrumentTagGetPayload<{}>;

export const InstrumentTagNaturalOrderBy: Prisma.InstrumentTagOrderByWithRelationInput[] = [
    { sortOrder: 'desc' },
    { text: 'asc' },
    { id: 'asc' },
];

// https://stackoverflow.com/questions/76518631/typescript-return-the-enum-values-in-parameter-using-a-generic-enum-type-method
// interesting that const objects are preferred over enums. but yea for populating datagrid single select options i agree.
export const InstrumentTagSignificance = {
    PowerRequired: "PowerRequired",
    Big: "Big",
} as const satisfies Record<string, string>;

export const xInstrumentTag = new xTable({
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    localInclude: InstrumentTagInclude,
    tableName: "instrumentTag",
    naturalOrderBy: InstrumentTagNaturalOrderBy,
    createInsertModelFromString: (input: string): Prisma.InstrumentTagCreateInput => {
        return {
            text: input,
            description: "auto-created",
            sortOrder: 0,
            color: null,
            significance: null,
        };
    },
    getRowInfo: (row: InstrumentTagPayload) => ({
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
            options: InstrumentTagSignificance,
        }),
    ]
});

////////////////////////////////////////////////////////////////
export type InstrumentTagAssociationModel = Prisma.InstrumentTagAssociationGetPayload<{
    include: {
        instrument: true,
        tag: true,
    }
}>;

// not sure this is needed or used at all.
const InstrumentTagAssociationInclude: Prisma.InstrumentTagAssociationInclude = {
    instrument: true,
    tag: true,
};

const InstrumentTagAssociationNaturalOrderBy: Prisma.InstrumentTagAssociationOrderByWithRelationInput[] = [
    { tag: { sortOrder: 'desc' } },
    { tag: { text: 'asc' } },
    { tag: { id: 'asc' } },
];

// this is mostly only in order to define the tags field in xInstruments.
export const xInstrumentTagAssociation = new xTable({
    tableName: "InstrumentTagAssociation",
    editPermission: Permission.associate_instrument_tags,
    viewPermission: Permission.view_general_info,
    localInclude: InstrumentTagAssociationInclude,
    naturalOrderBy: InstrumentTagAssociationNaturalOrderBy,
    getRowInfo: (row: InstrumentTagAssociationModel) => ({
        name: row.tag.text,
        description: row.tag.description,
        color: gGeneralPaletteList.findEntry(row.tag.color),
    }),
    columns: [
        new PKField({ columnName: "id" }),
        // do not add the `instrument` column here; this is used only as an association FROM the instrument table; excluding it
        // 1. enforces this purpose (minor)
        // 2. avoids a circular reference to xInstrument (major)
        new ForeignSingleField<Prisma.InstrumentTagGetPayload<{}>>({
            columnName: "tag",
            fkMember: "tagId",
            allowNull: false,
            foreignTableSpec: xInstrumentTag,
            getQuickFilterWhereClause: (query: string) => false,
        }),
    ]
});

////////////////////////////////////////////////////////////////
const InstrumentInclude: Prisma.InstrumentInclude = {
    functionalGroup: true,
    instrumentTags: {
        include: {
            tag: true,
        },
        orderBy: InstrumentTagAssociationNaturalOrderBy
    }
};

export type InstrumentPayload = Prisma.InstrumentGetPayload<{
    include: {
        functionalGroup: true,
        instrumentTags: {
            include: {
                tag: true, // todo: sort
            }
        }
    }
}>;

// order by functional group, then by instrument.
export const InstrumentNaturalOrderBy: Prisma.InstrumentOrderByWithRelationInput[] = [
    {
        functionalGroup: {
            sortOrder: 'desc',
        }
    },
    { sortOrder: 'desc' },
    { name: 'asc' },
    { id: 'asc' },
];

export const xInstrument = new xTable({
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    localInclude: InstrumentInclude,
    tableName: "instrument",
    naturalOrderBy: InstrumentNaturalOrderBy,
    getRowInfo: (row: InstrumentPayload) => ({
        name: row.name,
        description: row.description,
        color: gGeneralPaletteList.findEntry(row.functionalGroup.color),
    }),
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
            columnName: "sortOrder",
            allowNull: false,
        }),
        new ForeignSingleField<InstrumentFunctionalGroupModel>({
            columnName: "functionalGroup",
            fkMember: "functionalGroupId",
            foreignTableSpec: xInstrumentFunctionalGroup,
            allowNull: false,
            getQuickFilterWhereClause: (query: string): Prisma.InstrumentWhereInput => ({
                functionalGroup: {
                    name: { contains: query }
                }
            }),
        }),
        new TagsField<InstrumentTagAssociationModel>({
            columnName: "instrumentTags",
            associationForeignIDMember: "tagId",
            associationForeignObjectMember: "tag",
            associationLocalIDMember: "instrumentId",
            associationLocalObjectMember: "instrument",
            associationTableSpec: xInstrumentTagAssociation,
            foreignTableSpec: xInstrumentTag,
            getQuickFilterWhereClause: (query: string): Prisma.InstrumentWhereInput => ({
                instrumentTags: {
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

