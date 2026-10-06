import { Permission } from "shared/permissions";
import { defineAuthMap, DB3FieldReadAuth, makeColumnSet } from "../db3core";
import type { DB3AuthTablePermissionMap, DB3AuthSpec } from "../db3core";
import { BoolField } from "./boolean";
import { GenericIntegerField, MakeSortOrderField } from "./genericInteger";
import { inheritedField, serverOwnedField } from "./inherited";
import { LocalizedStringField } from "./localizedString";
import { MakePKfield } from "./xTableColumnTypes";
import type { DB3CreateFromStringContext } from "../db3core";
import type { ColorPaletteList } from "src/core/components/color/palette";
import { isInheritedFieldValue } from "./inherited";

// for catalog fields' getRowInfo (like songTag), this pulls out the effective palette color from the field,
// supports inherited values (bandSongTag -> globalSongTag)
export function catalogColor(value: unknown, palette: ColorPaletteList) {
    const effective = isInheritedFieldValue(value) ? value.value : value;
    const id = typeof effective === "string" ? effective
        : effective && typeof effective === "object" && "id" in effective ? effective.id : null;
    return typeof id === "string" ? palette.findEntry(id) : null;
}

/** The native picker supplies its visible writing locale; a factory never infers one from display text. */
export function bandCatalogCreateFromString(input: string, context?: DB3CreateFromStringContext) {
    if (!context?.localeTag) {
        throw new Error("A writing locale is required to create a localized catalog entry.");
    }
    return { name: { kind: "set", stringPublicId: null, localeTag: context.localeTag, value: input } };
}

export function bandCatalogAuth(managePermission: Permission) {
    const authMap = defineAuthMap({
        PostQuery: DB3FieldReadAuth.inheritRow, PostQueryAsOwner: DB3FieldReadAuth.inheritRow,
        PreInsert: managePermission, PreMutate: managePermission, PreMutateAsOwner: managePermission
    });
    const sourceAuthMap = defineAuthMap({
        ...authMap, PreInsert: Permission.never_grant,
        PreMutate: Permission.never_grant, PreMutateAsOwner: Permission.never_grant
    });
    const tableAuthMap: DB3AuthTablePermissionMap = {
        View: Permission.login, ViewOwn: Permission.login,
        Insert: managePermission, Edit: managePermission, EditOwn: managePermission
    };
    return { authMap, sourceAuthMap, tableAuthMap };
}

/** Catalog declarations share these fields; the database context supplies their trusted ownership. */
export function bandCatalogFields<const TAuth extends DB3AuthSpec>(auth: TAuth) {
    return makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "sysadmin" }),
        bandId: columnName => serverOwnedField(new GenericIntegerField({
            columnName,
            allowNull: false,
            allowSearchingThisField: false,
            authMap: defineAuthMap({
                PostQuery: Permission.never_grant,
                PostQueryAsOwner: Permission.never_grant,
                PreInsert: Permission.never_grant,
                PreMutate: Permission.never_grant,
                PreMutateAsOwner: Permission.never_grant,
            })
        })),
        name: columnName => new LocalizedStringField({ ...auth, columnName, stringIdentityMember: "nameId", stringFormat: "PlainText" }),
        description: columnName => new LocalizedStringField({ ...auth, columnName, stringIdentityMember: "descriptionId", stringFormat: "Markdown" }),
        sortOrder: () => inheritedField(MakeSortOrderField(auth)),
        isHidden: columnName => new BoolField({ ...auth, columnName, allowNull: false, defaultValue: false }),
    });
}
