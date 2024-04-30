// note: many-to-many associations we treat mostly as "tags".
// both sides of the relationship are NOT equal; for example the association model will specify the tags field but not the local field,
// because we don't show the data from the tags perspective. we show it from the local perspective therefore we don't need that data, and specifying it would encounter circular references etc.

// another example of the imbalanced relationship:
// the "name" of an association model will be the tag. not the local object.

import { Prisma } from "db";
import { gGeneralPaletteList } from "shared/color";
import { Permission } from "shared/permissions";
import { ColorField, ConstEnumStringField, ForeignSingleField, GenericIntegerField, GenericStringField, GhostField, MakeTitleField, PKField, TagsField } from "../db3basicFields";
import * as db3 from "../db3core";
import { InstrumentArgs, InstrumentFunctionalGroupArgs, InstrumentFunctionalGroupNaturalSortOrder, InstrumentFunctionalGroupPayload, InstrumentNaturalOrderBy, InstrumentPayload, InstrumentTagArgs, InstrumentTagAssociationArgs, InstrumentTagAssociationNaturalOrderBy, InstrumentTagAssociationPayload, InstrumentTagNaturalOrderBy, InstrumentTagPayload, InstrumentTagSignificance, UserPayload, UserWithInstrumentsPayload } from "./prismArgs";
import { CMDBTableFilterModel } from "../apiTypes";

// editable by anyone
export const xInstrumentAuthMap_R_EManagers: db3.DB3AuthContextPermissionMap = {
    PostQueryAsOwner: Permission.basic_trust,
    PostQuery: Permission.basic_trust,
    PreMutateAsOwner: Permission.manage_instruments,
    PreMutate: Permission.manage_instruments,
    PreInsert: Permission.manage_instruments,
};


export const xInstrumentTableAuthMap: db3.DB3AuthTablePermissionMap = {
    ViewOwn: Permission.basic_trust,
    View: Permission.basic_trust,
    EditOwn: Permission.manage_instruments,
    Edit: Permission.manage_instruments,
    Insert: Permission.manage_instruments,
} as const;




export const xInstrumentFunctionalGroup = new db3.xTable({
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.InstrumentFunctionalGroupInclude => {
        return InstrumentFunctionalGroupArgs.include;
    },
    tableName: "instrumentFunctionalGroup",
    tableAuthMap: xInstrumentTableAuthMap,
    naturalOrderBy: InstrumentFunctionalGroupNaturalSortOrder,
    getRowInfo: (row: InstrumentFunctionalGroupPayload) => ({
        name: row.name,
        description: row.description,
        color: gGeneralPaletteList.findEntry(row.color),
        ownerUserId: null,
    }),
    createInsertModelFromString: (input: string): Partial<InstrumentFunctionalGroupPayload> => ({
        description: "auto-created from selection dlg",
        name: input,
        sortOrder: 0,
    }),
    columns: [
        new PKField({ columnName: "id" }),
        MakeTitleField("name", { authMap: xInstrumentAuthMap_R_EManagers }),
        new GenericStringField({
            columnName: "description",
            allowNull: false,
            format: "markdown",
            authMap: xInstrumentAuthMap_R_EManagers,
        }),
        new ColorField({
            columnName: "color",
            allowNull: true,
            palette: gGeneralPaletteList,
            authMap: xInstrumentAuthMap_R_EManagers,
        }),
        new GenericIntegerField({
            columnName: "sortOrder",
            allowNull: false,
            allowSearchingThisField: false,
            authMap: xInstrumentAuthMap_R_EManagers,
        }),
        new GhostField({ memberName: "instruments", authMap: xInstrumentAuthMap_R_EManagers }),
    ]
});


export const xInstrumentTag = new db3.xTable({
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.InstrumentTagInclude => {
        return InstrumentTagArgs.include;
    },
    tableName: "instrumentTag",
    tableAuthMap: xInstrumentTableAuthMap,
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
        ownerUserId: null,
    }),
    columns: [
        new PKField({ columnName: "id" }),
        MakeTitleField("text", { authMap: xInstrumentAuthMap_R_EManagers }),
        new GenericStringField({
            columnName: "description",
            allowNull: false,
            format: "markdown",
            authMap: xInstrumentAuthMap_R_EManagers,
        }),
        new GenericIntegerField({
            columnName: "sortOrder",
            allowNull: false,
            allowSearchingThisField: false,
            authMap: xInstrumentAuthMap_R_EManagers,
        }),
        new ColorField({
            columnName: "color",
            allowNull: true,
            palette: gGeneralPaletteList,
            authMap: xInstrumentAuthMap_R_EManagers,
        }),
        new ConstEnumStringField({
            columnName: "significance",
            allowNull: true,
            defaultValue: null,
            options: InstrumentTagSignificance,
            authMap: xInstrumentAuthMap_R_EManagers,
        }),
        new GhostField({
            memberName: "instruments",
            authMap: xInstrumentAuthMap_R_EManagers,
        }),
    ]
});

////////////////////////////////////////////////////////////////

// this is mostly only in order to define the tags field in xInstruments.
export const xInstrumentTagAssociation = new db3.xTable({
    tableName: "InstrumentTagAssociation",
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.InstrumentTagAssociationInclude => {
        return InstrumentTagAssociationArgs.include;
    },
    tableAuthMap: xInstrumentTableAuthMap,
    naturalOrderBy: InstrumentTagAssociationNaturalOrderBy,
    getRowInfo: (row: InstrumentTagAssociationPayload) => ({
        name: row.tag?.text || "",
        description: row.tag?.description || "",
        color: gGeneralPaletteList.findEntry(row.tag?.color || ""),
        ownerUserId: null,
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
            foreignTableID: "InstrumentTag",
            authMap: xInstrumentAuthMap_R_EManagers,
            getQuickFilterWhereClause: (query: string) => false,
        }),
    ]
});

////////////////////////////////////////////////////////////////

export const xInstrument = new db3.xTable({
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.InstrumentInclude => {
        return InstrumentArgs.include;
    },
    tableName: "instrument",
    naturalOrderBy: InstrumentNaturalOrderBy,
    getRowInfo: (row: InstrumentPayload) => ({
        name: row.name,
        description: row.description,
        color: gGeneralPaletteList.findEntry(row.functionalGroup?.color || ""),
        ownerUserId: null,
    }),
    tableAuthMap: xInstrumentTableAuthMap,
    columns: [
        new PKField({ columnName: "id" }),
        MakeTitleField("name", { authMap: xInstrumentAuthMap_R_EManagers, }),
        new GenericStringField({
            columnName: "slug",
            allowNull: false,
            format: "plain",
            authMap: xInstrumentAuthMap_R_EManagers,
        }),
        new GenericStringField({
            columnName: "description",
            allowNull: false,
            format: "markdown",
            authMap: xInstrumentAuthMap_R_EManagers,
        }),
        new GenericStringField({
            columnName: "autoAssignFileLeafRegex",
            allowNull: false,
            format: "raw",
            authMap: xInstrumentAuthMap_R_EManagers,
        }),

        new GenericIntegerField({
            columnName: "sortOrder",
            allowSearchingThisField: false,
            allowNull: false,
            authMap: xInstrumentAuthMap_R_EManagers,
        }),
        new ForeignSingleField<InstrumentFunctionalGroupPayload>({
            columnName: "functionalGroup",
            fkMember: "functionalGroupId",
            foreignTableID: "InstrumentFunctionalGroup",
            allowNull: false,
            authMap: xInstrumentAuthMap_R_EManagers,
            getQuickFilterWhereClause: (query: string): Prisma.InstrumentWhereInput => ({
                functionalGroup: {
                    name: { contains: query }
                }
            }),
        }),
        new TagsField<InstrumentTagAssociationPayload>({
            columnName: "instrumentTags",
            associationForeignIDMember: "tagId",
            associationForeignObjectMember: "tag",
            associationLocalIDMember: "instrumentId",
            associationLocalObjectMember: "instrument",
            associationTableID: "InstrumentTagAssociation",
            foreignTableID: "InstrumentTag",
            authMap: xInstrumentAuthMap_R_EManagers,
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
            getCustomFilterWhereClause: (query: CMDBTableFilterModel): Prisma.InstrumentWhereInput | boolean => false,
        }),
    ]
});




////////////////////////////////////////////////////////////////
// server API...


////////////////////////////////////////////////////////////////

export const getUserPrimaryInstrument = (user: UserWithInstrumentsPayload): (InstrumentPayload | null) => {
    if (user.instruments.length < 1) return null;
    const p = user.instruments.find(i => i.isPrimary);
    if (p) {
        return p.instrument;
    }
    return user.instruments[0]!.instrument;
}
