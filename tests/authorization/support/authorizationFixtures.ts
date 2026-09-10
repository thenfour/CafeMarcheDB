import type { AuthenticatedCtx, Ctx } from "blitz"
import { Permission, gPublicPermissions } from "shared/permissions"
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
  name: string
  permissions: Array<{
    id: number
    roleId: number
    permissionId: number
    permission: {
      id: number
      name: Permission
    }
  }>
}

export type AuthorizationTestUser = {
  id: number
  name: string
  email: string
  phone: string | null
  isSysAdmin: boolean
  isDeleted: boolean
  createdAt: Date
  roleId: number | null
  cssClass: string | null
  accessToken: string | null
  role: TestRole | null
}

const personaPermissions: Record<Exclude<AuthorizationPersona, "public">, Permission[]> = {
  limited: [Permission.login],
  normal: [Permission.login, Permission.basic_trust],
  editor: [Permission.login, Permission.basic_trust, Permission.visibility_editors],
  moderator: [
    Permission.login,
    Permission.basic_trust,
    Permission.visibility_editors,
    Permission.manage_users,
    Permission.content_admin,
  ],
  bandAdmin: [
    Permission.login,
    Permission.basic_trust,
    Permission.visibility_editors,
    Permission.manage_users,
    Permission.content_admin,
    Permission.admin_users,
    Permission.assign_user_roles,
    Permission.view_users_basic_info,
  ],
  sysadmin: [Permission.login, Permission.sysadmin],
}

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
    name: overrides.name ?? `${persona} user`,
    email: overrides.email ?? `${persona}.${id}@test.invalid`,
    phone: overrides.phone ?? null,
    isSysAdmin: overrides.isSysAdmin ?? persona === "sysadmin",
    isDeleted: overrides.isDeleted ?? false,
    createdAt: overrides.createdAt ?? new Date("2026-01-01T00:00:00.000Z"),
    roleId,
    cssClass: overrides.cssClass ?? null,
    accessToken: overrides.accessToken ?? null,
    role: {
      id: roleId,
      name: persona,
      permissions: permissions.map((permission, index) => ({
        id: roleId * 100 + index,
        roleId,
        permissionId: index + 1,
        permission: {
          id: index + 1,
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
    permissions: [
      ...gPublicPermissions,
      ...(user?.role?.permissions.map((entry) => entry.permission.name) ?? []),
    ],
    impersonatingFromUserId: null,
    showAdminControls: false,
    permissionsLastRefreshedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    GOOGLE_ANALYTICS_ID_BACKSTAGE: undefined,
    GOOGLE_ANALYTICS_ID_PUBLIC: undefined,
  }
}

export function createAuthorizationTestContext(
  user: AuthorizationTestUser | null,
): Ctx | AuthenticatedCtx {
  const publicData = createAuthorizationPublicData(user)

  const session = {
    userId: publicData.userId,
    $handle: `test-session-${publicData.userId}`,
    $publicData: publicData,
    $authorize: (...requiredPermissions: Array<Permission | Permission[]>) => {
      const required = requiredPermissions.flat()
      const isAuthorized =
        !!user &&
        (publicData.isSysAdmin ||
          required.every((permission) => publicData.permissions.includes(permission)))

      if (!isAuthorized) {
        throw new Error(`Unauthorized test persona; required: ${required.join(", ")}`)
      }
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
