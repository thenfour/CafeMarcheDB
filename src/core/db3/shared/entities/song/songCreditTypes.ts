import { Prisma } from "db";
import { Permission } from "shared/permissions";
import type { SongCreditTypePublicId } from "shared/publicId";
import { gGeneralPaletteList, type ColorPaletteEntry } from "src/core/components/color/palette";
import { LocalizedStringField, localizedText } from "../../columnTypes/localizedString";
import { GhostField, MakeColorField, MakePKfield, MakePublicIdField, MakeSortOrderField } from "../../columnTypes/xTableColumnTypes";
import { defineCrudView } from "../../core/db3CrudView";
import { defineView } from "../../core/db3View";
import { deriveViewContract } from "../../core/db3ViewContract";
import { type DB3CreateFromStringContext, DB3FieldReadAuth, defineAuthMap, defineTable, makeColumnSet, prismaModel } from "../../db3core";

const authMap = defineAuthMap({
    PostQuery: DB3FieldReadAuth.inheritRow,
    PostQueryAsOwner: DB3FieldReadAuth.inheritRow,
    PreInsert: Permission.manage_global_catalogs,
    PreMutate: Permission.manage_global_catalogs,
    PreMutateAsOwner: Permission.manage_global_catalogs,
});

function createCreditTypeFromName(input: string, context?: DB3CreateFromStringContext) {
    if (!context?.localeTag) {
        throw new Error("A writing locale is required to create a song credit type.");
    }
    return {
        name: {
            kind: "set",
            stringPublicId: null,
            localeTag: context.localeTag,
            value: input,
        },
        description: {
            kind: "set",
            stringPublicId: null,
            localeTag: context.localeTag,
            value: "",
        },
    };
}

export const songCreditTypeEditorSelection = Prisma.validator<Prisma.SongCreditTypeDefaultArgs>()({
    select: {
        publicId: true,
        name: true,
        description: true,
        color: true,
        sortOrder: true
    },
});

export const xSongCreditType = defineTable({
    tableName: "SongCreditType",
    prismaModel: prismaModel<Prisma.SongCreditTypeDelegate>(),
    getIdentity: (row: { publicId: SongCreditTypePublicId }) => row.publicId,
    getSelectionArgs: () => songCreditTypeEditorSelection,
    queryStrategy: "resolved",
    deletePolicy: "hard",
    tableAuthMap: {
        View: Permission.public,
        ViewOwn: Permission.public,
        Edit: Permission.manage_global_catalogs,
        EditOwn: Permission.manage_global_catalogs,
        Insert: Permission.manage_global_catalogs,
    },
    naturalOrderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    createInsertModelFromString: createCreditTypeFromName,
    // Resolution and editor hydration provide different representations of the same text.
    getRowInfo: (row: { publicId: string; name?: unknown; description?: unknown; color: string | ColorPaletteEntry | null }) => ({
        pk: row.publicId,
        name: localizedText(row.name) ?? "",
        description: localizedText(row.description) ?? "",
        color: gGeneralPaletteList.findEntry(row.color),
        ownerUserId: null,
    }),
    fields: makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "sysadmin" }),
        publicId: () => MakePublicIdField<SongCreditTypePublicId>(),
        name: columnName => new LocalizedStringField({ columnName, stringIdentityMember: "nameId", stringFormat: "PlainText", writeScope: "global", authMap }),
        description: columnName => new LocalizedStringField({ columnName, stringIdentityMember: "descriptionId", stringFormat: "Markdown", writeScope: "global", authMap }),
        color: () => MakeColorField({ authMap }),
        sortOrder: () => MakeSortOrderField({ authMap }),
        // Credits retain their own authorization and await the song workflow migration.
        songCredits: memberName => new GhostField({
            memberName, authMap: defineAuthMap({
                PostQuery: Permission.never_grant,
                PostQueryAsOwner: Permission.never_grant,
                PreInsert: Permission.never_grant,
                PreMutate: Permission.never_grant,
                PreMutateAsOwner: Permission.never_grant,
            })
        }),
    }),
});

export const songCreditTypeContract = deriveViewContract(xSongCreditType, songCreditTypeEditorSelection);
const songCreditTypeReferenceContract = deriveViewContract(xSongCreditType, Prisma.validator<Prisma.SongCreditTypeDefaultArgs>()({
    select: { publicId: true, name: true, color: true },
}));
export const songCreditTypeReferenceView = defineView({
    viewID: "SongCreditType_Reference", entity: xSongCreditType,
    selection: songCreditTypeReferenceContract.prismaSelection,
    dtoSchema: songCreditTypeReferenceContract.dtoSchema,
    hydrate: songCreditTypeReferenceContract.hydrate,
});
export const songCreditTypeDisplayContract = {
    ...songCreditTypeContract,
    hydrate: (...args: Parameters<typeof songCreditTypeContract.hydrate>) => {
        const row = songCreditTypeContract.hydrate(...args);
        return {
            ...row,
            name: row.name.value ?? "",
            description: row.description.value ?? ""
        };
    },
};

export const songCreditTypeEditorView = defineCrudView({
    viewID: "SongCreditType_Editor",
    entity: xSongCreditType,
    operations: { create: true, update: true, delete: true },
    selection: songCreditTypeContract.prismaSelection,
    dtoSchema: songCreditTypeContract.dtoSchema,
    hydrate: songCreditTypeContract.hydrate,
});

declare module "../../db3core" {
    interface DB3TableTypeRegistry {
        SongCreditType: typeof xSongCreditType;
    }
}
