import { ServerPermissionSet } from "src/auth/server/ServerPermissionSet";
import {
  makeUserManagementActor,
  makeUserManagementTarget,
} from "src/auth/server/userManagementState";
import { createDB3Authorization } from "src/core/db3/shared/db3Authorization";
import type { AuthenticatedCtx, Ctx } from "blitz"
import { Permission } from "shared/permissions"
import {
  parsePublicId,
  type PermissionPublicId,
  type RolePermissionPublicId,
  type RolePublicId,
  type UserPublicId,
} from "shared/publicId"
import { userPublicId } from "tests/support/userFixtures"
import type { PublicDataType } from "types"

export type AuthorizationPersona =
  | "public"
  | "limited"
  | "normal"
  | "editor"
  | "moderator"
  | "bandAdmin"
  | "sysadmin"

export type AuthorizationTargetKind =
  | "ordinary"
  | "peerBandAdmin"
  | "protectedRole"
  | "isSysAdmin"

type TestRole = {
  id: number
  publicId: RolePublicId
  name: string
  permissions: Array<{
    id: number
    publicId: RolePermissionPublicId
    roleId: number
    permissionId: number
    permission: {
      id: number
      publicId: PermissionPublicId
      name: Permission
    }
  }>
}

export type AuthorizationTestUser = {
  id: number
  publicId: UserPublicId
  name: string
  email: string
  phone: string | null
  isSysAdmin: boolean
  isDeleted: boolean
  createdAt: Date
  roleId: number | null
  cssClass: string | null
  calendarFeedToken: string | null
  role: TestRole | null
}

const personaPermissions: Record<Exclude<AuthorizationPersona, "public">, Permission[]> = {
  limited: [Permission.login],
  normal: [Permission.login, Permission.search_users, Permission.view_users_basic_info],
  editor: [
    Permission.login,
    Permission.visibility_editors,
    Permission.search_users,
    Permission.view_users_basic_info,
  ],
  moderator: [
    Permission.login,
    Permission.visibility_editors,
    Permission.manage_users,
    Permission.search_users,
    Permission.view_users_basic_info,
    Permission.view_user_contact_info,
  ],
  bandAdmin: [
    Permission.login,
    Permission.visibility_editors,
    Permission.manage_users,
    Permission.manage_user_taxonomy,
    Permission.deactivate_users,
    Permission.assign_user_roles,
    Permission.search_users,
    Permission.view_users_basic_info,
    Permission.view_user_contact_info,
  ],
  sysadmin: Object.values(Permission).filter(permission => permission !== Permission.never_grant),
}

export const testPublicRolePermissions: Permission[] = [
  Permission.always_grant,
  Permission.public,
  Permission.visibility_public,
  Permission.view_events,
  Permission.view_files,
  Permission.practice_tools_use,
]

export type AuthorizationUserOverrides = Partial<
  Omit<AuthorizationTestUser, "role" | "roleId" | "isSysAdmin">
> & {
  permissions?: Permission[]
  isSysAdmin?: boolean
}

export function createAuthorizationTestUser(
  persona: Exclude<AuthorizationPersona, "public">,
  overrides: AuthorizationUserOverrides = {},
): AuthorizationTestUser {
  const id = overrides.id ?? 100
  const roleId = id + 10_000
  const permissions = overrides.permissions ?? personaPermissions[persona]

  return {
    id,
    publicId: overrides.publicId ?? userPublicId(id),
    name: overrides.name ?? `${persona} user`,
    email: overrides.email ?? `${persona}.${id}@test.invalid`,
    phone: overrides.phone ?? null,
    isSysAdmin: overrides.isSysAdmin ?? persona === "sysadmin",
    isDeleted: overrides.isDeleted ?? false,
    createdAt: overrides.createdAt ?? new Date("2026-01-01T00:00:00.000Z"),
    roleId,
    cssClass: overrides.cssClass ?? null,
    calendarFeedToken: overrides.calendarFeedToken ?? null,
    role: {
      id: roleId,
      publicId: parsePublicId<"Role">(`TestRole${roleId.toString().padStart(8, "0").slice(-8)}`),
      name: persona,
      permissions: permissions.map((permission, index) => ({
        id: roleId * 100 + index,
        publicId: parsePublicId<"RolePermission">(`RolePerm${(roleId * 100 + index).toString().padStart(8, "0").slice(-8)}`),
        roleId,
        permissionId: index + 1,
        permission: {
          id: index + 1,
          publicId: parsePublicId<"Permission">(`TestPerm${(index + 1).toString().padStart(8, "0")}`),
          name: permission,
        },
      })),
    },
  }
}

export function createAuthorizationPublicData(
  user: AuthorizationTestUser | null,
): PublicDataType {
  return {
    userId: user?.id ?? 0,
    isSysAdmin: user?.isSysAdmin ?? false,
    permissionNames: [
      ...testPublicRolePermissions,
      ...(user?.role?.permissions.map((entry) => entry.permission.name) ?? []),
    ],
    impersonatingFromUserId: null,
    showAdminControls: false,
    GOOGLE_ANALYTICS_ID_BACKSTAGE: undefined,
    GOOGLE_ANALYTICS_ID_PUBLIC: undefined,
  }
}

export function createAuthorizationTestContext(
  user: AuthorizationTestUser | null,
): Ctx | AuthenticatedCtx {
  const publicData = createAuthorizationPublicData(user)

  const session = {
    get userId() { return publicData.userId },
    $handle: `test-session-${publicData.userId}`,
    $publicData: publicData,
    $authorize: (...requiredPermissions: Array<Permission | Permission[]>) => {
      const required = requiredPermissions.flat()
      const isAuthorized = required.every((permission) =>
        publicData.permissionNames.includes(permission),
      )

      if (!isAuthorized) {
        throw new Error(`Unauthorized test persona; required: ${required.join(", ")}`)
      }
    },
    $create: async (updates: PublicDataType) => {
      Object.keys(publicData).forEach(key => delete publicData[key])
      Object.assign(publicData, updates)
    },
    $revoke: async () => {
      Object.keys(publicData).forEach(key => delete publicData[key])
      Object.assign(publicData, createAuthorizationPublicData(null))
    },
    $setPublicData: async (updates: Partial<PublicDataType>) => {
      Object.assign(publicData, updates)
    },
  }

  return { session } as unknown as Ctx | AuthenticatedCtx
}

export function createAuthorizationPersona(
  persona: AuthorizationPersona,
  overrides: AuthorizationUserOverrides = {},
) {
  const user = persona === "public" ? null : createAuthorizationTestUser(persona, overrides)
  return {
    persona,
    user,
    publicData: createAuthorizationPublicData(user),
    schemaAuthorization: createAuthorizationSchemaData(user),
    ctx: createAuthorizationTestContext(user),
  }
}

export function createAuthorizationTarget(
  targetKind: AuthorizationTargetKind,
  overrides: AuthorizationUserOverrides = {},
): AuthorizationTestUser {
  switch (targetKind) {
    case "ordinary":
      return createAuthorizationTestUser("normal", { id: 201, ...overrides })
    case "peerBandAdmin":
      return createAuthorizationTestUser("bandAdmin", { id: 202, ...overrides })
    case "protectedRole":
      return createAuthorizationTestUser("sysadmin", {
        id: 203,
        isSysAdmin: false,
        ...overrides,
      })
    case "isSysAdmin":
      return createAuthorizationTestUser("normal", {
        id: 204,
        isSysAdmin: true,
        ...overrides,
      })
  }
}

// Direct schema tests use synthetic row IDs from the fixture's assigned role.
// Server-path tests resolve inherited role IDs through the real loader.
export function createAuthorizationSchemaData(user: AuthorizationTestUser | null) {
  return createDB3Authorization(user, new ServerPermissionSet([
    ...testPublicRolePermissions.map((name, index) => ({ id: 920_000 + index, name })),
    ...(user?.role?.permissions.map(entry => entry.permission) ?? []),
  ]))
}

export function asUserManagementActor(
  user: AuthorizationTestUser | null,
) {
  return makeUserManagementActor(user, createAuthorizationSchemaData(user).effectivePermissions)
}

export function asUserManagementTarget(
  user: Parameters<typeof makeUserManagementTarget>[0],
) {
  return makeUserManagementTarget(user)
}
