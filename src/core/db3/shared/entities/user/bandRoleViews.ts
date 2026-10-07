import { Prisma } from "@prisma/client";
import { Permission } from "shared/permissions";
import type { BandRolePublicId } from "shared/publicId";
import { assignableBandRoleWhere } from "src/auth/shared/bandRolePolicy";
import { defineTable, makeColumnSet, prismaModel } from "../../db3core";
import { LocalizedStringField, localizedText } from "../../columnTypes/localizedString";
import { MakeColorField, MakePKfield, MakePublicIdField, MakeSortOrderField } from "../../columnTypes/xTableColumnTypes";
import { defineView, type DtoOf } from "../../core/db3View";
import { deriveViewContract } from "../../core/db3ViewContract";
import { kReadOnlyAuthMap } from "../common/entityCommon";

const selection = Prisma.validator<Prisma.BandRoleDefaultArgs>()({
    select: {
        publicId: true,
        name: true,
        description: true,
        color: true,
        sortOrder: true,
    },
});

/** Only display metadata crosses this read-only surface; role grants stay on the server. */
export const xBandRole = defineTable({
    tableName: "bandRole",
    tableUniqueName: "BandRole",
    prismaModel: prismaModel<Prisma.BandRoleDelegate>(),
    getIdentity: (role: { publicId: BandRolePublicId }) => role.publicId,
    queryStrategy: "resolved",
    deletePolicy: "disabled",
    tableAuthMap: {
        View: Permission.login,
        ViewOwn: Permission.login,
        Edit: Permission.never_grant,
        EditOwn: Permission.never_grant,
        Insert: Permission.never_grant,
    },
    queryParameters: {},
    getParameterizedWhereClause: (): Prisma.BandRoleWhereInput[] => [{ isDeleted: false }],
    naturalOrderBy: { sortOrder: "asc", name: "asc" },
    getSelectionArgs: () => selection,
    getRowInfo: row => ({
        pk: row.publicId,
        name: localizedText(row.name) ?? "",
        ownerUserId: null,
    }),
    fields: makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "never" }),
        publicId: () => MakePublicIdField<BandRolePublicId>(),
        name: columnName => new LocalizedStringField({ columnName, stringIdentityMember: "nameId", stringFormat: "PlainText", writeScope: "band", authMap: kReadOnlyAuthMap }),
        description: columnName => new LocalizedStringField({ columnName, stringIdentityMember: "descriptionId", stringFormat: "Markdown", writeScope: "band", authMap: kReadOnlyAuthMap }),
        color: () => MakeColorField({ authMap: kReadOnlyAuthMap }),
        sortOrder: () => MakeSortOrderField({ authMap: kReadOnlyAuthMap }),
    }),
});

const contract = deriveViewContract(xBandRole, selection);

export const bandRoleListView = defineView({
    viewID: "BandRole_List",
    entity: xBandRole,
    selection: contract.prismaSelection,
    dtoSchema: contract.dtoSchema,
    hydrate: contract.hydrate,
});

export const bandRoleChoicesView = defineView({
    viewID: "BandRole_Choices",
    entity: xBandRole,
    selection: contract.prismaSelection,
    dtoSchema: contract.dtoSchema,
    hydrate: contract.hydrate,
    where: ({ auth }) => {
        auth.requireBand();
        auth.requirePermission(Permission.assign_user_roles);
        return assignableBandRoleWhere(auth);
    },
});

export type BandRoleDto = DtoOf<typeof bandRoleListView>;

declare module "../../db3core" {
    interface DB3TableTypeRegistry {
        BandRole: typeof xBandRole;
    }
}
