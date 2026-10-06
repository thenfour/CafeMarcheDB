import { Prisma, SignInMethodType } from "db";
import { Permission } from "shared/permissions";
import type { UserSignInMethodPublicId } from "shared/publicId";
import { GenericStringField } from "../columnTypes/genericString";
import { ConstEnumStringField, foreignRefByTableId, MakeCreatedAtField, MakePKfield, MakePublicIdField } from "../columnTypes/xTableColumnTypes";
import { defineTable, makeColumnSet, prismaModel } from "../db3core";
import { kReadOnlyAuthMap } from "../entities/common/entityCommon";

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
        userId: { kind: "string", authorizeAs: "user" },
    },
    getParameterizedWhereClause: (params: { userId?: string }): Prisma.UserSignInMethodWhereInput[] => (
        params.userId === undefined ? [] : [{ user: { publicId: params.userId } }]
    ),
    getRowInfo: (row: Prisma.UserSignInMethodGetPayload<{}>) => ({
        pk: row.publicId,
        name: row.type,
        ownerUserId: null,
    }),
    fields: makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "sysadmin" }),
        publicId: () => MakePublicIdField<UserSignInMethodPublicId>(),
        user: foreignRefByTableId("User", { fkidMember: "userId", authMap: kReadOnlyAuthMap }),
        type: columnName => new ConstEnumStringField({
            columnName, options: SignInMethodType, defaultValue: "email", allowNull: false, authMap: kReadOnlyAuthMap,
        }),
        identifier: columnName => new GenericStringField({
            columnName, allowNull: false, format: "raw", authMap: kReadOnlyAuthMap,
        }),
        displayId: columnName => new GenericStringField({ // typically an email but in theory can be anything.
            columnName, allowNull: true, format: "raw", authMap: kReadOnlyAuthMap,
        }),
        createdAt: () => MakeCreatedAtField({ authMap: kReadOnlyAuthMap }),
    }),
});

declare module "../db3core" {
    interface DB3TableTypeRegistry {
        UserSignInMethod: typeof xUserSignInMethod;
    }
}
