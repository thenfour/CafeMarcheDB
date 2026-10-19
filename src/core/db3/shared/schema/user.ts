import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import { selectableBandVisibilityPermissionWhere } from "../entities/user/visibilityPermissionPolicy";
import type { UserWithRolesPayload } from "./userPayloads";

import { gGeneralPaletteList } from "@/src/core/components/color/palette";
import { Prisma } from "db";
import { assertIsNumberArray } from "shared/arrayUtils";
import { Permission } from "shared/permissions";
import type {
    BandUserPublicId,
    PermissionPublicId,
    UserPublicId,
    UserTagPublicId,
} from "shared/publicId";
import { TAnyModel } from "shared/rootroot";
import { gIconOptions } from "shared/utils";
import { PermissionSignificance } from "../apiTypes";
import { GenericStringField } from "../columnTypes/genericString";
import { serverOwnedField } from "../columnTypes/inherited";
import { LocalizedStringField, localizedText } from "../columnTypes/localizedString";
import { BoolField, ForeignCollectionField, ForeignSingleField, GhostField, MakeColorField, MakeCreatedAtField, MakeIconField, MakeIsDeletedField, MakePKfield, MakePublicIdField, MakeSignificanceField, MakeSortOrderField, MakeUpdatedAtField, tagsRef } from "../columnTypes/xTableColumnTypes";
import * as db3 from "../db3core";
import { PermissionArgs, PermissionNaturalOrderBy, PermissionPayload, UserMinimumArgs, UserNaturalOrderBy, UserPayload, UserSafeArgs } from "./prismArgs";
import { getEmailSignInSearchExpression } from "./userSignInMethod";

// Basic profile data is self-service for the account owner and readable for
// other users only through the explicit member-profile capability.
export const xUserBasicProfileAuthMap = db3.defineAuthMap({
    PostQueryAsOwner: Permission.login,
    PostQuery: BandPermission.view_users_basic_info,
    PreMutateAsOwner: Permission.login,
    PreMutate: Permission.manage_global_users,
    PreInsert: Permission.manage_global_users,
});

// Band membership fields remain readable as basic profile
// data, but owning the account does not grant write access.
export const xUserBasicProfileManagerWriteAuthMap = db3.defineAuthMap({
    PostQueryAsOwner: Permission.login,
    PostQuery: BandPermission.view_users_basic_info,
    PreMutateAsOwner: BandPermission.manage_users,
    PreMutate: BandPermission.manage_users,
    PreInsert: BandPermission.manage_users,
});

// The old User presentation field belongs to the shared person. Band taxonomy
// writers will use BandUser fields when the descriptors are adapted.
export const xUserPresentationMetadataAuthMap = db3.defineAuthMap({
    PostQueryAsOwner: Permission.login,
    PostQuery: BandPermission.view_users_basic_info,
    PreMutateAsOwner: Permission.manage_global_users,
    PreMutate: Permission.manage_global_users,
    PreInsert: Permission.manage_global_users,
});

// Taxonomy definitions must be available when an authenticated user views or
// edits their own profile; assignments still use the profile maps above.
const xUserTaxonomyDefinitionAuthMap = db3.defineAuthMap({
    PostQueryAsOwner: db3.DB3FieldReadAuth.inheritRow,
    PostQuery: db3.DB3FieldReadAuth.inheritRow,
    PreMutateAsOwner: BandPermission.manage_user_taxonomy,
    PreMutate: BandPermission.manage_user_taxonomy,
    PreInsert: BandPermission.manage_user_taxonomy,
});

// Contact information has a separate non-owner read capability. Phone remains
// self-editable; email writes are owned by dedicated account-maintenance flows.
export const xUserContactInfoAuthMap = db3.defineAuthMap({
    PostQueryAsOwner: Permission.login,
    PostQuery: BandPermission.view_user_contact_info,
    PreMutateAsOwner: Permission.login,
    PreMutate: Permission.manage_global_users,
    PreInsert: Permission.manage_global_users,
});

export const xUserEmailAuthMap = db3.defineAuthMap({
    PostQueryAsOwner: Permission.login,
    PostQuery: BandPermission.view_user_contact_info,
    PreMutateAsOwner: Permission.sysadmin,
    PreMutate: Permission.sysadmin,
    PreInsert: Permission.sysadmin,
});

// Operational account metadata is visible to user maintainers. Its mutation
// authority stays separate and is enforced by existing dedicated flows.
const xUserOperationalMetadataAuthMap = db3.defineAuthMap({
    PostQueryAsOwner: BandPermission.manage_users,
    PostQuery: BandPermission.manage_users,
    PreMutateAsOwner: Permission.sysadmin,
    PreMutate: Permission.sysadmin,
    PreInsert: Permission.sysadmin,
});

// Sign-in methods and sign-in-email search are readable only by Sysadmins.
// Dedicated auth operations own all writes.
const xUserSignInMetadataAuthMap = db3.defineAuthMap({
    PostQueryAsOwner: Permission.sysadmin,
    PostQuery: Permission.sysadmin,
    PreMutateAsOwner: Permission.never_grant,
    PreMutate: Permission.never_grant,
    PreInsert: Permission.never_grant,
});

// Permission display metadata is intrinsic to an authorized Permission row.
// Role grants use the role-owned association field; membership assignments use dedicated commands.
const xPermissionMetadataAuthMap = db3.defineAuthMap({
    PostQueryAsOwner: db3.DB3FieldReadAuth.inheritRow,
    PostQuery: db3.DB3FieldReadAuth.inheritRow,
    PreMutateAsOwner: Permission.sysadmin,
    PreMutate: Permission.sysadmin,
    PreInsert: Permission.sysadmin,
});

// These fields are owned by dedicated authentication/calendar flows. Keep
// them known to request validation so crafted writes fail as unauthorized
// rather than falling through as unknown fields.
const denyGenericUserAuthenticationField = (): boolean => false;

export const xUserTableAuthMap: db3.DB3AuthTablePermissionMap = {
    ViewOwn: Permission.login,
    View: BandPermission.view_users_basic_info,
    EditOwn: Permission.login,
    Edit: BandPermission.manage_users,
    Insert: BandPermission.manage_users,
} as const;

const xUserTableAuthMap_SysadminInsert: db3.DB3AuthTablePermissionMap = {
    ...xUserTableAuthMap,
    // User creation is self-signup or Sysadmin maintenance.
    Insert: Permission.sysadmin,
} as const;

export const xUserTaxonomyTableAuthMap: db3.DB3AuthTablePermissionMap = {
    ViewOwn: Permission.login,
    View: Permission.login,
    EditOwn: BandPermission.manage_user_taxonomy,
    Edit: BandPermission.manage_user_taxonomy,
    Insert: BandPermission.manage_user_taxonomy,
} as const;

export const xPermissionTableAuthMap: db3.DB3AuthTablePermissionMap = {
    ViewOwn: Permission.public,
    View: Permission.public,
    EditOwn: Permission.sysadmin,
    Edit: Permission.sysadmin,
    Insert: Permission.sysadmin,
} as const;

export const xUserMinimum = db3.defineTable({
    prismaModel: db3.prismaModel<Prisma.UserDelegate>(),
    getIdentity: (user: { publicId: UserPublicId }) => user.publicId,
    getSelectionArgs: (): Prisma.UserDefaultArgs => {
        return UserMinimumArgs;
    },
    tableName: "User",
    deletePolicy: "disabled", // deletion is performed through a dedicated mutation.
    queryParameters: {
        userId: { kind: "entityIdentity", targetTableID: "User", authorizeAs: "publicId" },
    },
    naturalOrderBy: UserNaturalOrderBy,
    getRowInfo: (row: Pick<UserPayload, "id" | "publicId" | "name">) => ({
        pk: row.publicId,
        name: row.name,
        ownerUserId: row.id,
    }),
    tableAuthMap: xUserTableAuthMap_SysadminInsert,

    // note: self-sign-up is not part of this; that flow doesn't use db3 auth.

    getParameterizedWhereClause: (params: { userId?: number }): (Prisma.UserWhereInput[] | false) => {
        if (params.userId != null) {
            return [{
                id: { equals: params.userId }
            }];
        }
        return false;
    },
    fields: db3.makeColumnSet({
        id: () => MakePKfield({ isRowOwner: true, naturalIdVisibility: "never" }),
        publicId: () => MakePublicIdField<UserPublicId>(),
        createdAt: () => MakeCreatedAtField({ authMap: xUserOperationalMetadataAuthMap }),
        isDeleted: () => MakeIsDeletedField({ authMap: xUserOperationalMetadataAuthMap }),

        name: columnName => new GenericStringField({
            columnName,
            allowNull: false,
            format: "title",
            maxLength: 768,
            specialFunction: db3.SqlSpecialColumnFunction.name,
            authMap: xUserBasicProfileAuthMap,
        }),
        cssClass: columnName => new GenericStringField({
            columnName, allowNull: true, format: "raw", authMap: xUserPresentationMetadataAuthMap,
        }),
        email: columnName => new GenericStringField({
            columnName,
            allowNull: false,
            format: "email",
            //_customAuth: authorizeUserLoginEmail,
            authMap: xUserEmailAuthMap,
        }),
        phone: columnName => new GenericStringField({
            columnName,
            allowNull: true,
            format: "plain",
            maxLength: 768,
            authMap: xUserContactInfoAuthMap,
        }),
        isSysAdmin: columnName => new BoolField({
            columnName,
            defaultValue: false,
            authMap: xUserOperationalMetadataAuthMap,
            allowNull: false,
        }),
        hashedPassword: memberName => new GhostField({ memberName, _customAuth: denyGenericUserAuthenticationField }),
        signInMethods: memberName => new GhostField({ memberName, _customAuth: denyGenericUserAuthenticationField }),
        mergedIntoUserId: memberName => new GhostField({
            memberName,
            specialFunction: db3.SqlSpecialColumnFunction.unavailableWhenSet,
            _customAuth: denyGenericUserAuthenticationField
        }),
        mergedAt: memberName => new GhostField({ memberName, _customAuth: denyGenericUserAuthenticationField }),
        calendarFeedToken: memberName => new GhostField({ memberName, _customAuth: denyGenericUserAuthenticationField }),
        accessToken: memberName => new GhostField({ memberName, _customAuth: denyGenericUserAuthenticationField }), // rejected legacy field name
        uid: memberName => new GhostField({ memberName, _customAuth: denyGenericUserAuthenticationField }),
    })
});




export const xPermissionBaseArgs = db3.defineTableDesc({
    prismaModel: db3.prismaModel<Prisma.PermissionDelegate>(),
    getIdentity: (permission: { publicId: PermissionPublicId }) => permission.publicId,
    getSelectionArgs: (): Prisma.PermissionDefaultArgs => {
        return PermissionArgs;
    },
    tableName: "Permission",
    queryStrategy: "resolved",
    deletePolicy: "disabled",
    naturalOrderBy: PermissionNaturalOrderBy,
    tableAuthMap: xPermissionTableAuthMap,
    getRowInfo: (row: PermissionPayload) => ({
        pk: row.publicId,
        name: row.name,
        description: localizedText(row.description) ?? "",
        color: gGeneralPaletteList.findEntry(row.color),
        ownerUserId: null,
    }),
    fields: db3.makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "sysadmin" }),
        publicId: () => MakePublicIdField<PermissionPublicId>(),
        isDeleted: () => serverOwnedField(MakeIsDeletedField({ authMap: xPermissionMetadataAuthMap })),
        name: columnName => new GenericStringField({
            columnName,
            allowNull: false,
            format: "plain",
            specialFunction: db3.SqlSpecialColumnFunction.name,
            authMap: xPermissionMetadataAuthMap,
        }),
        description: columnName => new LocalizedStringField({
            columnName,
            stringIdentityMember: "descriptionId",
            stringFormat: "Markdown",
            writeScope: "global",
            authMap: xPermissionMetadataAuthMap,
        }),
        sortOrder: () => MakeSortOrderField({ authMap: xPermissionMetadataAuthMap }),
        isVisibility: columnName => new BoolField({
            columnName,
            defaultValue: false,
            authMap: xPermissionMetadataAuthMap,
            allowNull: false,
        }),
        significance: columnName => MakeSignificanceField(columnName, PermissionSignificance, { authMap: xPermissionMetadataAuthMap }),
        color: () => MakeColorField({ authMap: xPermissionMetadataAuthMap }),
        iconName: columnName => MakeIconField(columnName, gIconOptions, { authMap: xPermissionMetadataAuthMap }),
        globalRoles: tagsRef("GlobalRolePermission", "GlobalRole", {
            associationLocalObjectMember: "permission",
            associationForeignObjectMember: "globalRole",
            getQuickFilterWhereClause: () => false,
            getCustomFilterWhereClause: () => false,
            authMap: db3.defineAuthMap({
                PostQuery: Permission.sysadmin,
                PostQueryAsOwner: Permission.sysadmin,
                PreInsert: Permission.never_grant,
                PreMutate: Permission.never_grant,
                PreMutateAsOwner: Permission.never_grant
            }),
        }),
        createdAt: () => MakeCreatedAtField(),
        updatedAt: () => MakeUpdatedAtField(),

        bandRolePermissions: tagsRef("BandRolePermission", "BandRole", {
            associationLocalObjectMember: "permission",
            associationForeignObjectMember: "bandRole",
            getQuickFilterWhereClause: () => false,
            getCustomFilterWhereClause: () => false,
            authMap: db3.defineAuthMap({
                PostQuery: Permission.sysadmin,
                PostQueryAsOwner: Permission.sysadmin,
                PreInsert: Permission.never_grant,
                PreMutate: Permission.never_grant,
                PreMutateAsOwner: Permission.never_grant
            }),
        }),
    })
});

export const xPermission = db3.defineTable(xPermissionBaseArgs);


export interface EventResponses_ExpectedUserTag {
    publicId: UserTagPublicId;
    bandUserTagAssignments: { bandUserId: BandUserPublicId }[];
}

declare module "../db3core" {
    interface DB3TableTypeRegistry {
        Permission: typeof xPermission;
        User: typeof xUser;
    }
}




////////////////////////////////////////////////////////////////
const MakeUserSignInEmailSearchField = (memberName: string) => {
    const field = new GhostField({
        memberName,
        authMap: xUserSignInMetadataAuthMap,
    });

    field.SqlGetQuickFilterElementsForToken =
        token => getEmailSignInSearchExpression(token, `P.${field.table.pkMember}`);
    return field;
};

////////////////////////////////////////////////////////////////
export interface UserTablParams {
    userId?: number;
    userIds?: number[];
};

const userBaseArgs = db3.defineTableDesc({
    prismaModel: db3.prismaModel<Prisma.UserDelegate>(),
    getIdentity: (user: { publicId: UserPublicId }) => user.publicId,
    getSelectionArgs: (): Prisma.UserDefaultArgs => {
        return UserSafeArgs;
    },
    tableName: "User",
    readConsistency: "snapshot",
    deletePolicy: "disabled",
    viewDeletedPermission: BandPermission.recover_users,
    searchCapabilities: { includeDeleted: true },
    queryParameters: {
        userId: { kind: "entityIdentity", targetTableID: "User", authorizeAs: "publicId" },
        userIds: { kind: "entityIdentityArray", targetTableID: "User", authorizeAs: "publicId" },
    },
    tableAuthMap: xUserTableAuthMap_SysadminInsert,
    naturalOrderBy: UserNaturalOrderBy,
    getRowInfo: (row: UserPayload) => ({
        pk: row.publicId,
        name: row.name,
        ownerUserId: row.id,
    }),
    getParameterizedWhereClause: (params: UserTablParams): Prisma.UserWhereInput[] => {
        const ret: Prisma.UserWhereInput[] = [];
        if (params.userId != null) {
            ret.push({ id: { equals: params.userId } });
        }
        if (params.userIds !== undefined) {
            assertIsNumberArray(params.userIds);
            if (params.userIds.length > 0) {
                const t: Prisma.UserWhereInput = {
                    id: { in: params.userIds }
                };
                ret.push(t);
            }
        }
        return ret;
    },
    fields: db3.makeColumnSet({
        id: () => MakePKfield({ isRowOwner: true, naturalIdVisibility: "never" }),
        publicId: () => MakePublicIdField<UserPublicId>(),
        isDeleted: () => MakeIsDeletedField({ authMap: xUserOperationalMetadataAuthMap }),
        createdAt: () => MakeCreatedAtField({ authMap: xUserOperationalMetadataAuthMap }),
        name: columnName => new GenericStringField({
            columnName,
            allowNull: false,
            format: "title",
            maxLength: 768,
            specialFunction: db3.SqlSpecialColumnFunction.name,
            authMap: xUserBasicProfileAuthMap,
        }),
        email: columnName => new GenericStringField({
            columnName,
            allowNull: false,
            format: "email",
            authMap: xUserEmailAuthMap,
        }),
        phone: columnName => new GenericStringField({
            columnName,
            allowNull: true,
            format: "plain",
            maxLength: 768,
            authMap: xUserContactInfoAuthMap,
        }),
        cssClass: columnName => new GenericStringField({
            columnName,
            allowNull: true,
            format: "raw",
            authMap: xUserPresentationMetadataAuthMap,
        }),
        isSysAdmin: columnName => new BoolField({
            columnName,
            defaultValue: false,
            authMap: xUserOperationalMetadataAuthMap,
            allowNull: false,
        }),
        // Membership assignments are exposed only by the band-scoped BandUser views.
        signInMethods: memberName => new ForeignCollectionField({
            memberName,
            foreignTableID: "UserSignInMethod",
            authMap: xUserSignInMetadataAuthMap,
        }),

        // This search-only field's runtime member is signInEmailSearch; the old
        // array placement beside email did not make it a second email field.
        signInEmailSearch: MakeUserSignInEmailSearchField,
        mergedIntoUserId: memberName => new GhostField({
            memberName,
            specialFunction: db3.SqlSpecialColumnFunction.unavailableWhenSet,
            _customAuth: denyGenericUserAuthenticationField
        }),
        mergedAt: memberName => new GhostField({ memberName, _customAuth: denyGenericUserAuthenticationField }),
        hashedPassword: memberName => new GhostField({ memberName, _customAuth: denyGenericUserAuthenticationField }),
        calendarFeedToken: memberName => new GhostField({ memberName, _customAuth: denyGenericUserAuthenticationField }),
        accessToken: memberName => new GhostField({ memberName, _customAuth: denyGenericUserAuthenticationField }), // rejected legacy field name
        uid: memberName => new GhostField({ memberName, _customAuth: denyGenericUserAuthenticationField }),
    })
});

export const xUser = db3.defineTable(userBaseArgs);


// let's create a "created by" field which is a specialization of ForeignSingle, specialized to User payload
// automatically populated with current user on creation (see ApplyToNewRow)
export type CreatedByUserFieldArgs<
    TForeignKeyMember extends string = "createdByUserId",
> = {
    columnName?: string; // "instrumentType"
    fkidMember?: TForeignKeyMember; // "instrumentTypeId"
    specialFunction?: db3.SqlSpecialColumnFunction;
    authMap?: db3.DB3AuthContextPermissionMap<"required"> | db3.DB3AuthContextPermissionMap<"optional">;
    _customAuth?: (args: db3.DB3AuthorizeAndSanitizeFieldInput<TAnyModel>) => boolean;
};

export class CreatedByUserField<
    TForeignKeyMember extends string = "createdByUserId",
> extends ForeignSingleField<
    db3.DB3PrismaPayloadOf<typeof xUser>,
    typeof xUser,
    TForeignKeyMember,
    db3.DB3AuthSpec,
    true
> {
    constructor(args: CreatedByUserFieldArgs<TForeignKeyMember>) {
        super({
            columnName: args.columnName || "createdByUser",
            fkidMember: (args.fkidMember || "createdByUserId") as TForeignKeyMember,
            getForeignTable: () => xUser,
            allowNull: true,
            specialFunction: args.specialFunction || db3.SqlSpecialColumnFunction.createdByUser,
            getQuickFilterWhereClause: () => false,
            authMap: (args as any).authMap || null,
            _customAuth: (args as any)._customAuth || null,
        });
    }
    ApplyToNewRow = (args: TAnyModel, currentUser: Pick<UserWithRolesPayload, "id"> | null) => {
        args[this.member] = currentUser;
    };
    ApplyDbToClient = (dbModel: TAnyModel, clientModel: TAnyModel, mode: db3.DB3RowMode, currentUser?: UserWithRolesPayload | null) => {
        if (mode === "new") {
            dbModel[this.member] = currentUser;
            return;
        }
        if (dbModel[this.member] === undefined) return;
        clientModel[this.member] = dbModel[this.member];
    }
};

export const MakeCreatedByField = <
    const TForeignKeyMember extends string = "createdByUserId",
>(args?: CreatedByUserFieldArgs<TForeignKeyMember>) => (
    new CreatedByUserField<TForeignKeyMember>(args || {})
);

export const MakeUpdatedByField = <
    const TForeignKeyMember extends string = "updatedByUserId",
>(args?: CreatedByUserFieldArgs<TForeignKeyMember>) => (
    new CreatedByUserField<TForeignKeyMember>({
        specialFunction: db3.SqlSpecialColumnFunction.updatedByUser,
        columnName: "updatedByUser",
        ...args || {},
        fkidMember: (args?.fkidMember || "updatedByUserId") as TForeignKeyMember,
    })
);


// let's create a "visiblePermission" column which is ForeignSingle for a permission, but only for "visibility" permissions.
// in theory this will apply a filter over permissions for isVisibility = TRUE; however that is already done in a different way.
export type VisiblePermissionFieldArgs<
    TForeignKeyMember extends string = "visiblePermissionId",
    TAuthSpec extends db3.DB3AuthSpec = db3.DB3AuthSpec,
> = {
    columnName?: string; // "visiblePermission"
    fkMember?: TForeignKeyMember; // "visiblePermissionId"
} & TAuthSpec;

export class VisiblePermissionField<
    TForeignKeyMember extends string = "visiblePermissionId",
    const TAuthSpec extends db3.DB3AuthSpec = db3.DB3AuthSpec,
> extends ForeignSingleField<
    db3.DB3PrismaPayloadOf<typeof xPermission>,
    typeof xPermission,
    TForeignKeyMember,
    TAuthSpec,
    true
> {
    constructor(args: VisiblePermissionFieldArgs<TForeignKeyMember, TAuthSpec>) {
        const valueArgs = {
            columnName: args.columnName || "visiblePermission",
            fkidMember: (args.fkMember || "visiblePermissionId") as TForeignKeyMember,
            getForeignTable: () => xPermission,
            getWriteTargetWhereClause: selectableBandVisibilityPermissionWhere,
            specialFunction: db3.SqlSpecialColumnFunction.visiblePermission,
            allowNull: true,
            getQuickFilterWhereClause: () => false,
        } as const;
        super("authMap" in args
            ? { ...valueArgs, authMap: args.authMap }
            : { ...valueArgs, _customAuth: args._customAuth });
    }
};

export const MakeVisiblePermissionField = <const TAuthSpec extends db3.DB3AuthSpec>(args: TAuthSpec) => (
    new VisiblePermissionField<"visiblePermissionId", TAuthSpec>(args)
);
