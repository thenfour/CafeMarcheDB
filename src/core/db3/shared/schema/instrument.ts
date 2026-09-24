// note: many-to-many associations we treat mostly as "tags".
// both sides of the relationship are NOT equal; for example the association model will specify the tags field but not the local field,
// because we don't show the data from the tags perspective. we show it from the local perspective therefore we don't need that data, and specifying it would encounter circular references etc.

// another example of the imbalanced relationship:
// the "name" of an association model will be the tag. not the local object.

import { Prisma } from "db";
import { Permission } from "shared/permissions";
import type { InstrumentFunctionalGroupPublicId, InstrumentTagPublicId } from "shared/publicId";
import { z } from "zod";
import { CMDBTableFilterModel } from "../apiTypes";
import { ColorField, ConstEnumStringField, foreignRef, GenericIntegerField, GhostField, MakePKfield, MakePublicIdField, MakeSortOrderField, tagsRef } from "../columnTypes/xTableColumnTypes";
import * as db3 from "../db3core";
import { InstrumentArgs, type InstrumentClientPayload, InstrumentFunctionalGroupArgs, type InstrumentFunctionalGroupClientPayload, InstrumentFunctionalGroupNaturalSortOrder, InstrumentFunctionalGroupPayload, InstrumentNaturalOrderBy, InstrumentPayload, InstrumentTagArgs, InstrumentTagAssociationArgs, type InstrumentTagClientPayload, InstrumentTagAssociationNaturalOrderBy, InstrumentTagAssociationPayload, InstrumentTagNaturalOrderBy, InstrumentTagPayload, InstrumentTagSignificance } from "./prismArgs";
import { GenericStringField, MakeTitleField } from "../columnTypes/genericString";
import { gGeneralPaletteList } from "@/src/core/components/color/palette";

// Instrument management has one administrative surface and one capability.
export const xInstrumentAuthMap_R_EAdmins = db3.defineAuthMap({
    PostQueryAsOwner: db3.DB3FieldReadAuth.inheritRow,
    PostQuery: db3.DB3FieldReadAuth.inheritRow,
    PreMutateAsOwner: Permission.admin_instruments,
    PreMutate: Permission.admin_instruments,
    PreInsert: Permission.admin_instruments,
});


export const xInstrumentTableAuthMap: db3.DB3AuthTablePermissionMap = {
    ViewOwn: Permission.login,
    View: Permission.login,
    EditOwn: Permission.admin_instruments,
    Edit: Permission.admin_instruments,
    Insert: Permission.admin_instruments,
} as const;




export const xInstrumentFunctionalGroup = db3.defineTable({
    prismaModel: db3.prismaModel<Prisma.InstrumentFunctionalGroupDelegate>(),
    getIdentity: (entity: InstrumentFunctionalGroupClientPayload) => entity.publicId,
    getSelectionArgs: (): Prisma.InstrumentFunctionalGroupDefaultArgs => {
        return InstrumentFunctionalGroupArgs;
    },
    tableName: "InstrumentFunctionalGroup",
    deletePolicy: "hard",
    tableAuthMap: xInstrumentTableAuthMap,
    naturalOrderBy: InstrumentFunctionalGroupNaturalSortOrder,
    getRowInfo: (row: InstrumentFunctionalGroupPayload) => ({
        pk: row.publicId || row.id,
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
    fields: db3.makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "sysadmin" }),
        publicId: () => MakePublicIdField<InstrumentFunctionalGroupPublicId>(),
        name: columnName => MakeTitleField(columnName, { authMap: xInstrumentAuthMap_R_EAdmins }),
        description: columnName => new GenericStringField({
            columnName,
            allowNull: false,
            format: "markdown",
            authMap: xInstrumentAuthMap_R_EAdmins,
        }),
        color: columnName => new ColorField({
            columnName,
            allowNull: true,
            palette: gGeneralPaletteList,
            authMap: xInstrumentAuthMap_R_EAdmins,
        }),
        sortOrder: columnName => new GenericIntegerField({
            columnName,
            allowNull: false,
            allowSearchingThisField: false,
            authMap: xInstrumentAuthMap_R_EAdmins,
        }),
        instruments: memberName => new GhostField({ memberName, authMap: xInstrumentAuthMap_R_EAdmins }),
    }),
});


export const xInstrumentTag = db3.defineTable({
    prismaModel: db3.prismaModel<Prisma.InstrumentTagDelegate>(),
    getIdentity: (entity: InstrumentTagClientPayload) => entity.publicId,
    getSelectionArgs: (): Prisma.InstrumentTagDefaultArgs => {
        return InstrumentTagArgs;
    },
    tableName: "InstrumentTag",
    deletePolicy: "hard",
    tableAuthMap: xInstrumentTableAuthMap,
    naturalOrderBy: InstrumentTagNaturalOrderBy,
    createInsertModelFromString: (input: string): Partial<InstrumentTagPayload> => {
        return {
            text: input,
            description: "auto-created",
            sortOrder: 0,
            color: null,
            significance: null,
        };
    },
    getRowInfo: (row: InstrumentTagPayload) => ({
        pk: row.publicId,
        name: row.text,
        description: row.description,
        color: gGeneralPaletteList.findEntry(row.color),
        ownerUserId: null,
    }),
    fields: db3.makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "sysadmin" }),
        publicId: () => MakePublicIdField<InstrumentTagPublicId>(),
        text: columnName => MakeTitleField(columnName, { authMap: xInstrumentAuthMap_R_EAdmins }),
        description: columnName => new GenericStringField({
            columnName,
            allowNull: false,
            format: "markdown",
            authMap: xInstrumentAuthMap_R_EAdmins,
        }),
        sortOrder: columnName => new GenericIntegerField({
            columnName,
            allowNull: false,
            allowSearchingThisField: false,
            authMap: xInstrumentAuthMap_R_EAdmins,
        }),
        color: columnName => new ColorField({
            columnName,
            allowNull: true,
            palette: gGeneralPaletteList,
            authMap: xInstrumentAuthMap_R_EAdmins,
        }),
        significance: columnName => new ConstEnumStringField({
            columnName,
            allowNull: true,
            defaultValue: null,
            options: InstrumentTagSignificance,
            authMap: xInstrumentAuthMap_R_EAdmins,
        }),
        instruments: memberName => new GhostField({
            memberName,
            authMap: xInstrumentAuthMap_R_EAdmins,
        }),
    })
});

////////////////////////////////////////////////////////////////

// this is mostly only in order to define the tags field in xInstruments.
export const xInstrumentTagAssociation = db3.defineTable({
    prismaModel: db3.prismaModel<Prisma.InstrumentTagAssociationDelegate>(),
    tableName: "InstrumentTagAssociation",
    deletePolicy: "hard",
    getSelectionArgs: (): Prisma.InstrumentTagAssociationDefaultArgs => {
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
    fields: db3.makeColumnSet({
        id: () => MakePKfield(),
        instrumentId: memberName => new GhostField({
            memberName,
            readTransportSchema: z.number().int(),
            authMap: xInstrumentAuthMap_R_EAdmins,
        }),
        // do not add the `instrument` column here; this is used only as an association FROM the instrument table; excluding it
        // 1. enforces this purpose (minor)
        // 2. avoids a circular reference to xInstrument (major)
        tag: foreignRef(() => xInstrumentTag, {
            fkidMember: "tagId",
            authMap: xInstrumentAuthMap_R_EAdmins,
        }),
    })
});

////////////////////////////////////////////////////////////////

export const xInstrument = db3.defineTable({
    prismaModel: db3.prismaModel<Prisma.InstrumentDelegate>(),
    getIdentity: (entity: InstrumentClientPayload) => entity.id,
    getSelectionArgs: (): Prisma.InstrumentDefaultArgs => {
        return InstrumentArgs;
    },
    tableName: "Instrument",
    deletePolicy: "hard",
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
    fields: db3.makeColumnSet({
        id: () => MakePKfield(),
        name: columnName => MakeTitleField(columnName, { authMap: xInstrumentAuthMap_R_EAdmins, }),
        // new GenericStringField({
        //     columnName: "slug",
        //     allowNull: false,
        //     format: "plain",
        //     authMap: xInstrumentAuthMap_R_EAdmins,
        // }),
        description: columnName => new GenericStringField({
            columnName,
            allowNull: false,
            format: "markdown",
            authMap: xInstrumentAuthMap_R_EAdmins,
        }),
        autoAssignFileLeafRegex: columnName => new GenericStringField({
            columnName,
            allowNull: true,
            format: "raw",
            authMap: xInstrumentAuthMap_R_EAdmins,
        }),

        sortOrder: () => MakeSortOrderField({ authMap: xInstrumentAuthMap_R_EAdmins }),
        functionalGroup: foreignRef(() => xInstrumentFunctionalGroup, {
            fkidMember: "functionalGroupId",
            authMap: xInstrumentAuthMap_R_EAdmins,
            getQuickFilterWhereClause: (query: string): Prisma.InstrumentWhereInput => ({
                functionalGroup: {
                    name: { contains: query }
                }
            }),
        }),
        instrumentTags: tagsRef("InstrumentTagAssociation", "InstrumentTag", {
            associationForeignObjectMember: "tag",
            associationLocalObjectMember: "instrument",
            authMap: xInstrumentAuthMap_R_EAdmins,
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
    })
});

declare module "../db3core" {
    interface DB3TableTypeRegistry {
        Instrument: typeof xInstrument;
        InstrumentTag: typeof xInstrumentTag;
        InstrumentTagAssociation: typeof xInstrumentTagAssociation;
    }
}


