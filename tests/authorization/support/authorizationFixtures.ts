import { ServerPermissionSet } from "src/auth/server/ServerPermissionSet";
import {
  makeUserManagementActor,
  makeUserManagementTarget,
} from "src/auth/server/userManagementState";
import { testBandAuthorization } from "tests/support/serverAuthorization";
import type { AuthenticatedCtx, Ctx } from "blitz"
import { gPermissionRegistry, getPermissionDefinition, Permission } from "shared/permissions"
import {
  parsePublicId,
  type PermissionPublicId,
  type PublicId,
  type GlobalRolePublicId,
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

type TestGlobalRole = {
  id: number
  publicId: GlobalRolePublicId
  name: string
  isDeleted: boolean
  permissions: Array<{
    id: number
    publicId: PublicId<"GlobalRolePermission">
    globalRoleId: number
    permissionId: number
    permission: {
      id: number
      publicId: PermissionPublicId
      name: Permission
      isDeleted: boolean
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
  mergedIntoUserId: number | null
  createdAt: Date
  globalRoleId: number | null
  cssClass: string | null
  calendarFeedToken: string | null
  globalRole: TestGlobalRole | null
  // Persona grants seed separate platform and membership roles, not User columns.
  permissions: Permission[]
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
  Omit<AuthorizationTestUser, "globalRole" | "globalRoleId" | "isSysAdmin" | "permissions">
> & {
  permissions?: Permission[]
  isSysAdmin?: boolean
}

export function createAuthorizationTestUser(
  persona: Exclude<AuthorizationPersona, "public">,
  overrides: AuthorizationUserOverrides = {},
): AuthorizationTestUser {
  const id = overrides.id ?? 100
  const globalRoleId = id + 10_000
  // These fixture roles explicitly carry baseline grants; the resolver adds none.
  const permissions = [...new Set([...testPublicRolePermissions, ...(overrides.permissions ?? personaPermissions[persona])])]

  return {
    id,
    publicId: overrides.publicId ?? userPublicId(id),
    name: overrides.name ?? `${persona} user`,
    email: overrides.email ?? `${persona}.${id}@test.invalid`,
    phone: overrides.phone ?? null,
    isSysAdmin: overrides.isSysAdmin ?? persona === "sysadmin",
    isDeleted: overrides.isDeleted ?? false,
    mergedIntoUserId: overrides.mergedIntoUserId ?? null,
    createdAt: overrides.createdAt ?? new Date("2026-01-01T00:00:00.000Z"),
    globalRoleId,
    cssClass: overrides.cssClass ?? null,
    calendarFeedToken: overrides.calendarFeedToken ?? null,
    permissions,
    globalRole: {
      id: globalRoleId,
      publicId: parsePublicId<"GlobalRole">(`TestRole${globalRoleId.toString().padStart(8, "0").slice(-8)}`),
      name: persona,
      isDeleted: false,
      permissions: permissions.filter(permission => getPermissionDefinition(permission).scope !== "band").map((permission, index) => ({
        id: globalRoleId * 100 + index,
        publicId: parsePublicId<"GlobalRolePermission">(`RolePerm${(globalRoleId * 100 + index).toString().padStart(8, "0").slice(-8)}`),
        globalRoleId,
        permissionId: authorizationPermissionId(permission),
        permission: {
          id: authorizationPermissionId(permission),
          publicId: parsePublicId<"Permission">(`TestPerm${authorizationPermissionId(permission).toString().padStart(8, "0")}`),
          name: permission,
          isDeleted: false,
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
      ...(user ? user.globalRole?.permissions.map((entry) => entry.permission.name) ?? []
        : testPublicRolePermissions.filter(permission => getPermissionDefinition(permission).scope === "global")),
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

  // Blitz's remaining context services are not used by resolver fixtures.
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

export function authorizationPermissionId(permission: Permission): number {
  return gPermissionRegistry.findIndex(definition => definition.key === permission) + 1;
}

// Direct field-policy tests supply grants explicitly; server tests load persisted roles.
export function createAuthorizationSchemaData(user: AuthorizationTestUser | null) {
  return testBandAuthorization(user, new ServerPermissionSet([
    ...(user?.permissions ?? testPublicRolePermissions).map(name => ({ id: authorizationPermissionId(name), name })),
  ]))
}

export function asUserManagementActor(
  user: AuthorizationTestUser | null,
) {
  return makeUserManagementActor(user, createAuthorizationSchemaData(user))
}

export function asUserManagementTarget(
  user: Parameters<typeof makeUserManagementTarget>[0],
) {
  return makeUserManagementTarget(user)
}
