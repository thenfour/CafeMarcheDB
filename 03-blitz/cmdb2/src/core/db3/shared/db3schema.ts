import db, { Prisma } from "db";
import { ColorPalette, ColorPaletteEntry, gGeneralPalette } from "shared/color";
import { Permission } from "shared/permissions";
import { CoerceToNumberOrNull, InstrumentTagSignificance, KeysOf, TAnyModel } from "shared/utils";
import { xTable } from "./db3core";
import { ColorField, ConstEnumStringField, ForeignSingleField, GenericIntegerField, GenericStringField, PKField, TagsField } from "./db3basicFields";


////////////////////////////////////////////////////////////////
const InstrumentFunctionalGroupInclude: Prisma.InstrumentFunctionalGroupInclude = {
    instruments: true,
};

export type InstrumentFunctionalGroupForeignModel = Prisma.InstrumentFunctionalGroupGetPayload<{}>;

export const xInstrumentFunctionalGroup = new xTable({
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    localInclude: InstrumentFunctionalGroupInclude,
    tableName: "instrumentFunctionalGroup",
    createInsertModelFromString: (input: string): Partial<InstrumentFunctionalGroupForeignModel> => ({
        description: "auto-created from selection dlg",
        name: input,
        sortOrder: 0,
    }),
    columns: [
        new PKField({ columnName: "id" }),
        new GenericStringField({
            columnName: "name",
            allowNull: false,
            caseSensitive: true,
            minLength: 1,
            doTrim: true,
        }),
        new GenericStringField({
            columnName: "description",
            allowNull: false,
            caseSensitive: true,
            minLength: 1,
            doTrim: true,
        }),
        new GenericIntegerField({
            columnName: "sortOrder",
            allowNull: false,
        }),
    ]
});

const InstrumentTagInclude: Prisma.InstrumentTagInclude = {
    instruments: true,
};

export const xInstrumentTag = new xTable({
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    localInclude: InstrumentTagInclude,
    tableName: "instrumentTag",
    columns: [
        new PKField({ columnName: "id" }),
        new GenericStringField({
            columnName: "text",
            allowNull: false,
            caseSensitive: true,
            minLength: 1,
            doTrim: true,
        }),
        new GenericIntegerField({
            columnName: "sortOrder",
            allowNull: false,
        }),
        new ColorField({
            columnName: "color",
            allowNull: true,
            palette: gGeneralPalette,
        }),
        new ConstEnumStringField({
            columnName: "significance",
            allowNull: true,
            defaultValue: null,
            options: InstrumentTagSignificance,
        }),
    ]
});

export type InstrumentTagForeignModel = Prisma.InstrumentTagGetPayload<{}>;

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

export const xInstrumentTagAssociation = new xTable({
    tableName: "InstrumentTagAssociation",
    editPermission: Permission.associate_instrument_tags,
    viewPermission: Permission.view_general_info,
    localInclude: InstrumentTagAssociationInclude,
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
            getChipCaption: (value) => value.text,
            getChipDescription: (value) => value.description,
            getQuickFilterWhereClause: (query: string): Prisma.InstrumentWhereInput => ({
                functionalGroup: {
                    name: { contains: query }
                }
            }),
        }),
    ]
});

const InstrumentInclude: Prisma.InstrumentInclude = {
    functionalGroup: true,
    instrumentTags: {
        include: {
            tag: true,
        }
    }
};

export const xInstrument = new xTable({
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    localInclude: InstrumentInclude,
    tableName: "instrument",
    columns: [
        new PKField({ columnName: "id" }),
        new GenericStringField({
            columnName: "name",
            allowNull: false,
            caseSensitive: true,
            minLength: 1,
            doTrim: true,
        }),
        new GenericIntegerField({
            columnName: "sortOrder",
            allowNull: false,
        }),
        new ForeignSingleField<InstrumentFunctionalGroupForeignModel>({
            columnName: "functionalGroup",
            fkMember: "functionalGroupId",
            foreignTableSpec: xInstrumentFunctionalGroup,
            allowNull: false,
            getChipCaption: (value) => value.name,
            getChipDescription: (value) => value.description,
            getQuickFilterWhereClause: (query: string): Prisma.InstrumentWhereInput => ({
                functionalGroup: {
                    name: { contains: query }
                }
            }),
        }),
        new TagsField<InstrumentTagAssociationModel>({
            columnName: "instrumentTags",
            associationTableSpec: xInstrumentTagAssociation,
            foreignTableSpec: xInstrumentTag,
            getChipCaption: (value) => value.tag.text,
            getChipDescription: (value) => value.tag.description,
            //getForeignID: (association) => association.tagId,
            associationForeignIDMember: "tagId",
            associationLocalIDMember: "instrumentId",
            createMockAssociation: (instrument, tag) => ({
                id: -1,
                instrument: instrument as any,
                instrumentId: instrument.id,
                tag: tag as any,
                tagId: tag.id,
            }),
            // sanitizeAssociationForMutation: (a: InstrumentTagAssociationModel) => ({
            //     instrumentId: a.instrumentId,
            //     tagId: a.tagId,
            // }),
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
