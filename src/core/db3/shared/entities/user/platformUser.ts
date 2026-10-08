import { Prisma } from "db";
import { Permission } from "shared/permissions";
import type { UserPublicId } from "shared/publicId";
import { GenericStringField } from "../../columnTypes/genericString";
import { serverOwnedField } from "../../columnTypes/inherited";
import { BoolField, DateTimeField, ForeignCollectionField, MakeIsDeletedField, MakePKfield, MakePublicIdField } from "../../columnTypes/xTableColumnTypes";
import { defineCrudView } from "../../core/db3CrudView";
import { deriveViewContract } from "../../core/db3ViewContract";
import * as db3 from "../../db3core";
import { kReadOnlyAuthMap } from "../common/entityCommon";

const platformUserArgs = Prisma.validator<Prisma.UserDefaultArgs>()({
    select: {
        id: true, publicId: true, name: true, email: true, phone: true,
        cssClass: true, createdAt: true, isDeleted: true, isSysAdmin: true,
    },
});
type PlatformUser = Prisma.UserGetPayload<typeof platformUserArgs>;

// Platform maintenance never obtains authority from a band or from owning the account.
const personFieldsAuth = db3.defineAuthMap({
    PostQuery: db3.DB3FieldReadAuth.inheritRow, PostQueryAsOwner: db3.DB3FieldReadAuth.inheritRow,
    PreInsert: Permission.manage_global_users,
    PreMutate: Permission.manage_global_users, PreMutateAsOwner: Permission.manage_global_users,
});
const emailAuth = db3.defineAuthMap({
    PostQuery: db3.DB3FieldReadAuth.inheritRow, PostQueryAsOwner: db3.DB3FieldReadAuth.inheritRow,
    PreInsert: Permission.manage_global_users,
    PreMutate: Permission.sysadmin, PreMutateAsOwner: Permission.sysadmin,
});

// This independent descriptor leaves membership/profile reads under their existing policy.
// TODO: evaluate whether we can avoid this. xTables are not meant to do the job of views; they are meant to
// be the database schema-facing layer (for which ideally there is 1); multiple views are supported
// to adapt it to various app needs.
export const xPlatformUser = db3.defineTable({
    prismaModel: db3.prismaModel<Prisma.UserDelegate>(),
    getIdentity: (user: { publicId: UserPublicId }) => user.publicId,
    tableName: "User",
    tableUniqueName: "PlatformUser",
    deletePolicy: "disabled",
    readConsistency: "snapshot",
    viewDeletedPermission: Permission.manage_global_users,
    searchCapabilities: { includeDeleted: true },
    queryParameters: {},
    getSelectionArgs: () => platformUserArgs,
    naturalOrderBy: [{ createdAt: "desc" }, { id: "desc" }],
    tableAuthMap: {
        View: Permission.manage_global_users, ViewOwn: Permission.manage_global_users,
        Edit: Permission.manage_global_users, EditOwn: Permission.manage_global_users,
        Insert: Permission.manage_global_users,
    },
    getRowInfo: (user: PlatformUser) => ({ pk: user.publicId, name: user.name, ownerUserId: user.id }),
    fields: db3.makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "never", isRowOwner: true }),
        publicId: () => MakePublicIdField<UserPublicId>(),
        name: columnName => new GenericStringField({ columnName, allowNull: false, format: "title", maxLength: 768, specialFunction: db3.SqlSpecialColumnFunction.name, authMap: personFieldsAuth }),
        email: columnName => new GenericStringField({ columnName, allowNull: false, format: "email", maxLength: 768, authMap: emailAuth }),
        phone: columnName => new GenericStringField({ columnName, allowNull: true, format: "plain", maxLength: 768, authMap: personFieldsAuth }),
        cssClass: columnName => new GenericStringField({ columnName, allowNull: true, format: "raw", maxLength: 768, authMap: personFieldsAuth }),
        // Dedicated account operations own security state; Prisma owns its initial values.
        createdAt: columnName => serverOwnedField(new DateTimeField({ columnName, allowNull: false, specialFunction: db3.SqlSpecialColumnFunction.createdAt, authMap: kReadOnlyAuthMap })),
        isDeleted: () => serverOwnedField(MakeIsDeletedField({ authMap: kReadOnlyAuthMap })),
        isSysAdmin: columnName => serverOwnedField(new BoolField({ columnName, allowNull: false, defaultValue: false, authMap: kReadOnlyAuthMap })),
        signInMethods: memberName => new ForeignCollectionField({
            memberName, foreignTableID: "UserSignInMethod",
            authMap: db3.defineAuthMap({
                ...kReadOnlyAuthMap, PostQuery: Permission.sysadmin, PostQueryAsOwner: Permission.sysadmin,
            }),
        }),
    }),
});

// The row's internal owner ID is a read-policy dependency, not part of the public DTO.
const platformUserViewArgs = Prisma.validator<Prisma.UserDefaultArgs>()({
    select: { ...platformUserArgs.select, id: false },
});
const platformUserContract = deriveViewContract(xPlatformUser, platformUserViewArgs);
export const platformUserEditorView = defineCrudView({
    viewID: "PlatformUser_Editor",
    entity: xPlatformUser,
    operations: { create: true, update: true },
    selection: platformUserContract.prismaSelection,
    dtoSchema: platformUserContract.dtoSchema,
    hydrate: platformUserContract.hydrate,
});
