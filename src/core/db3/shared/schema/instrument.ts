// note: many-to-many associations we treat mostly as "tags".
// both sides of the relationship are NOT equal; for example the association model will specify the tags field but not the local field,
// because we don't show the data from the tags perspective. we show it from the local perspective therefore we don't need that data, and specifying it would encounter circular references etc.

// another example of the imbalanced relationship:
// the "name" of an association model will be the tag. not the local object.

import { gGeneralPaletteList } from "@/src/core/components/color/palette";
import { Prisma } from "db";
import { Permission } from "shared/permissions";
import type {
    InstrumentFunctionalGroupPublicId,
    InstrumentPublicId,
} from "shared/publicId";
import { GenericStringField, MakeTitleField } from "../columnTypes/genericString";
import { ColorField, foreignRef, GenericIntegerField, GhostField, MakePKfield, MakePublicIdField, MakeSortOrderField } from "../columnTypes/xTableColumnTypes";
import * as db3 from "../db3core";
import { InstrumentArgs, InstrumentFunctionalGroupArgs, InstrumentFunctionalGroupNaturalSortOrder, InstrumentFunctionalGroupPayload, InstrumentNaturalOrderBy, InstrumentPayload } from "./prismArgs";

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
    getIdentity: (entity: { publicId: InstrumentFunctionalGroupPublicId }) => entity.publicId,
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


////////////////////////////////////////////////////////////////

export const xInstrument = db3.defineTable({
    prismaModel: db3.prismaModel<Prisma.InstrumentDelegate>(),
    getIdentity: (entity: { publicId: InstrumentPublicId }) => entity.publicId,
    getSelectionArgs: (): Prisma.InstrumentDefaultArgs => {
        return InstrumentArgs;
    },
    tableName: "Instrument",
    deletePolicy: "hard",
    naturalOrderBy: InstrumentNaturalOrderBy,
    getRowInfo: (row: InstrumentPayload) => ({
        pk: row.publicId,
        name: row.name,
        description: row.description,
        color: gGeneralPaletteList.findEntry(row.functionalGroup?.color || ""),
        ownerUserId: null,
    }),
    createInsertModelFromString: undefined, // because you must set things like functional group. don't allow simple create.
    tableAuthMap: xInstrumentTableAuthMap,
    fields: db3.makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "sysadmin" }),
        publicId: () => MakePublicIdField<InstrumentPublicId>(),
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
    })
});

declare module "../db3core" {
    interface DB3TableTypeRegistry {
        Instrument: typeof xInstrument;
    }
}


