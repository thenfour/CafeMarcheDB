// note: many-to-many associations we treat mostly as "tags".
// both sides of the relationship are NOT equal; for example the association model will specify the tags field but not the local field,
// because we don't show the data from the tags perspective. we show it from the local perspective therefore we don't need that data, and specifying it would encounter circular references etc.

// another example of the imbalanced relationship:
// the "name" of an association model will be the tag. not the local object.

import { Prisma } from "db";
import { Permission } from "shared/permissions";
import { CMDBTableFilterModel } from "../apiTypes";
import { ColorField, ConstEnumStringField, ForeignSingleField, GenericIntegerField, GhostField, MakePKfield, MakeSortOrderField, TagsField } from "../db3basicFields";
import * as db3 from "../db3core";
import { InstrumentArgs, InstrumentFunctionalGroupArgs, InstrumentFunctionalGroupNaturalSortOrder, InstrumentFunctionalGroupPayload, InstrumentNaturalOrderBy, InstrumentPayload, InstrumentTagArgs, InstrumentTagAssociationArgs, InstrumentTagAssociationNaturalOrderBy, InstrumentTagAssociationPayload, InstrumentTagNaturalOrderBy, InstrumentTagPayload, InstrumentTagSignificance } from "./prismArgs";
import { GenericStringField, MakeTitleField } from "../genericStringField";
import { gGeneralPaletteList } from "@/src/core/components/color/palette";

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
    getSelectionArgs: (clientIntention: db3.xTableClientUsageContext): Prisma.InstrumentFunctionalGroupDefaultArgs => {
        return InstrumentFunctionalGroupArgs;
    },
    tableName: "InstrumentFunctionalGroup",
    tableAuthMap: xInstrumentTableAuthMap,
    naturalOrderBy: InstrumentFunctionalGroupNaturalSortOrder,
    getRowInfo: (row: InstrumentFunctionalGroupPayload) => ({
        pk: row.id,
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
        MakePKfield(),
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
    getSelectionArgs: (clientIntention: db3.xTableClientUsageContext): Prisma.InstrumentTagDefaultArgs => {
        return InstrumentTagArgs;
    },
    tableName: "InstrumentTag",
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
        pk: row.id,
        name: row.text,
        description: row.description,
        color: gGeneralPaletteList.findEntry(row.color),
        ownerUserId: null,
    }),
    columns: [
        MakePKfield(),
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
    getSelectionArgs: (clientIntention: db3.xTableClientUsageContext): Prisma.InstrumentTagAssociationDefaultArgs => {
        return InstrumentTagAssociationArgs;
    },
    tableAuthMap: xInstrumentTableAuthMap,
    naturalOrderBy: InstrumentTagAssociationNaturalOrderBy,
    getRowInfo: (row: InstrumentTagAssociationPayload) => ({
        pk: row.id,
        name: row.tag?.text || "",
        description: row.tag?.description || "",
        color: gGeneralPaletteList.findEntry(row.tag?.color || ""),
        ownerUserId: null,
    }),
    columns: [
        MakePKfield(),
        // do not add the `instrument` column here; this is used only as an association FROM the instrument table; excluding it
        // 1. enforces this purpose (minor)
        // 2. avoids a circular reference to xInstrument (major)
        new ForeignSingleField<Prisma.InstrumentTagGetPayload<{}>>({
            columnName: "tag",
            fkidMember: "tagId",
            allowNull: false,
            foreignTableID: "InstrumentTag",
            authMap: xInstrumentAuthMap_R_EManagers,
            getQuickFilterWhereClause: (query: string) => false,
        }),
    ]
});

////////////////////////////////////////////////////////////////

export const xInstrument = new db3.xTable({
    getSelectionArgs: (clientIntention: db3.xTableClientUsageContext): Prisma.InstrumentDefaultArgs => {
        return InstrumentArgs;
    },
    tableName: "Instrument",
    naturalOrderBy: InstrumentNaturalOrderBy,
    getRowInfo: (row: InstrumentPayload) => ({
        pk: row.id,
        name: row.name,
        description: row.description,
        color: gGeneralPaletteList.findEntry(row.functionalGroup?.color || ""),
        ownerUserId: null,
    }),
    createInsertModelFromString: undefined, // because you must set things like functional group. don't allow simple create.
    tableAuthMap: xInstrumentTableAuthMap,
    columns: [
        MakePKfield(),
        MakeTitleField("name", { authMap: xInstrumentAuthMap_R_EManagers, }),
        // new GenericStringField({
        //     columnName: "slug",
        //     allowNull: false,
        //     format: "plain",
        //     authMap: xInstrumentAuthMap_R_EManagers,
        // }),
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

        MakeSortOrderField({ authMap: xInstrumentAuthMap_R_EManagers }),
        new ForeignSingleField<InstrumentFunctionalGroupPayload>({
            columnName: "functionalGroup",
            fkidMember: "functionalGroupId",
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


