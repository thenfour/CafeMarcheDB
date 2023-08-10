import db, { Prisma } from "db";
import { ColorPalette, ColorPaletteEntry, gGeneralPalette } from "shared/color";
import { Permission } from "shared/permissions";
import { CoerceToNumberOrNull, InstrumentTagSignificance, KeysOf, TAnyModel } from "shared/utils";
import { xTable } from "./db3core";
import { ColorField, ConstEnumStringField, ForeignSingleField, GenericIntegerField, GenericStringField, PKField } from "./db3basicFields";


////////////////////////////////////////////////////////////////
const InstrumentFunctionalGroupInclude: Prisma.InstrumentFunctionalGroupInclude = {
    instruments: true,
};

export const xInstrumentFunctionalGroup = new xTable({
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    localInclude: InstrumentFunctionalGroupInclude,
    tableName: "instrumentFunctionalGroup",
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




const InstrumentInclude: Prisma.InstrumentInclude = {
    functionalGroup: true,
    instrumentTags: {
        include: {
            tag: true,
        }
    }
};

export type InstrumentFunctionalGroupForeignModel = Prisma.InstrumentFunctionalGroupGetPayload<{}>;

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
            defaultValue: null,
            allowInsertFromString: true,
            doesItemExactlyMatchText: (item: InstrumentFunctionalGroupForeignModel, filterText: string) => {
                return item.name.trim().toLowerCase() === filterText.trim().toLowerCase();
            },
            getQuickFilterWhereClause: (query: string): Prisma.InstrumentWhereInput => ({
                functionalGroup: {
                    name: { contains: query }
                }
            }),
            getForeignQuickFilterWhereClause: (query: string): Prisma.Enumerable<Prisma.InstrumentFunctionalGroupWhereInput> => ([
                { name: { contains: query } },
                { description: { contains: query } },
            ]),
            createInsertModelFromString: (input: string): Partial<InstrumentFunctionalGroupForeignModel> => ({
                description: "auto-created from selection dlg",
                name: input,
                sortOrder: 0,
            }),
        }),
        // instrument tags associations
    ]
});
