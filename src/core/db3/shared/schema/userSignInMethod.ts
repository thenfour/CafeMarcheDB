import { Prisma, SignInMethodType } from "db";
import { Permission } from "shared/permissions";
import type { UserSignInMethodPublicId } from "shared/publicId";
import { ConstEnumStringField, foreignRefByTableId, MakeCreatedAtField, MakePKfield, MakePublicIdField } from "../columnTypes/xTableColumnTypes";
import { GenericStringField } from "../columnTypes/genericString";
import { DB3FieldReadAuth, defineAuthMap, defineTable, makeColumnSet, prismaModel } from "../db3core";

// Maintenance writes must preserve credential ownership, revoke sessions, and
// protect the last usable method. Only the dedicated auth operations may write.
const readOnlyFields = defineAuthMap({
    PostQuery: DB3FieldReadAuth.inheritRow,
    PostQueryAsOwner: DB3FieldReadAuth.inheritRow,
    PreMutate: Permission.never_grant,
    PreMutateAsOwner: Permission.never_grant,
    PreInsert: Permission.never_grant,
});

export const xUserSignInMethod = defineTable({
    prismaModel: prismaModel<Prisma.UserSignInMethodDelegate>(),
    tableName: "UserSignInMethod",
    getIdentity: (method: { publicId: UserSignInMethodPublicId }) => method.publicId,
    getSelectionArgs: () => ({}),
    deletePolicy: "disabled",
    tableAuthMap: {
        View: Permission.sysadmin,
        ViewOwn: Permission.sysadmin,
        Edit: Permission.never_grant,
        EditOwn: Permission.never_grant,
        Insert: Permission.never_grant,
    },
    naturalOrderBy: [{ createdAt: "asc" }, { publicId: "asc" }],
    queryParameters: {
        userId: { kind: "integer", authorizeAs: "userId" },
    },
    getParameterizedWhereClause: (params: { userId?: number }): Prisma.UserSignInMethodWhereInput[] => (
        params.userId === undefined ? [] : [{ userId: params.userId }]
    ),
    getRowInfo: (row: Prisma.UserSignInMethodGetPayload<{}>) => ({
        pk: row.publicId,
        name: row.type,
        ownerUserId: null,
    }),
    fields: makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "sysadmin" }),
        publicId: () => MakePublicIdField<UserSignInMethodPublicId>(),
        user: foreignRefByTableId("User", { fkidMember: "userId", authMap: readOnlyFields }),
        type: columnName => new ConstEnumStringField({
            columnName, options: SignInMethodType, defaultValue: "email", allowNull: false, authMap: readOnlyFields,
        }),
        identifier: columnName => new GenericStringField({
            columnName, allowNull: false, format: "raw", authMap: readOnlyFields,
        }),
        createdAt: () => MakeCreatedAtField({ authMap: readOnlyFields }),
    }),
});

declare module "../db3core" {
    interface DB3TableTypeRegistry {
        UserSignInMethod: typeof xUserSignInMethod;
    }
}
