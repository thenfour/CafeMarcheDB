import { describe, expect, it, vi } from "vitest"
import { loadEffectivePermissions } from "src/auth/server/effectivePermissions"
import { authorizationTestDb } from "./support/inMemoryPrisma"
import type { AuthorizationDatabase } from "src/auth/server/authorizationContext"
import {
  asPermission,
  getPermissionDefinition,
  getPermissionDatabaseMetadata,
  gContinuitySensitivePermissions,
  gPermissionOrdered,
  gPermissionRegistry,
  gProtectedPermissions,
  isPermission,
  Permission,
} from "shared/permissions"

describe("canonical permission registry", () => {
  it("generates the complete compatibility API and ordered view", () => {
    const registryKeys = gPermissionRegistry.map((definition) => definition.key)

    expect(Object.values(Permission)).toEqual(registryKeys)
    expect(gPermissionOrdered).toEqual(registryKeys)
    expect(new Set(registryKeys).size).toBe(registryKeys.length)
  })

  it("contains complete, stable, unambiguous metadata", () => {
    const sortOrders = gPermissionRegistry.map((definition) => definition.sortOrder)

    expect(new Set(sortOrders).size).toBe(sortOrders.length)
    expect(sortOrders).toEqual([...sortOrders].sort((a, b) => a - b))

    for (const definition of gPermissionRegistry) {
      expect(definition.key).toMatch(/^[a-z][a-z0-9_]*$/)
      expect(definition.description.trim().length).toBeGreaterThan(0)
      expect(getPermissionDefinition(asPermission(definition.key))).toBe(definition)
      expect(isPermission(definition.key)).toBe(true)

      if (definition.isProtected) {
        expect(definition.isDelegable).toBe(false)
      }
      if (definition.isVisibility) {
        expect(definition.presentation).toBeDefined()
      }
      if (definition.scope === "platform") {
        expect(definition.isProtected).toBe(true)
        expect(definition.isDelegable).toBe(false)
      }
    }

    expect(isPermission("not_a_real_permission")).toBe(false)
  })

  it("derives protected and continuity policy from metadata", () => {
    expect([...gProtectedPermissions]).toEqual([
      Permission.merge_users,
      Permission.manage_bands,
      Permission.manage_global_catalogs,
      Permission.manage_global_settings,
      Permission.manage_global_localization,
      Permission.manage_global_users,
      Permission.impersonate_user,
      Permission.sysadmin,
      Permission.never_grant,
    ])
    expect([...gContinuitySensitivePermissions]).toEqual([
      Permission.deactivate_users,
      Permission.assign_user_roles,
    ])
  })

  it("generates canonical database metadata", () => {
    expect(getPermissionDatabaseMetadata(getPermissionDefinition(Permission.visibility_public)))
      .toEqual({
        description: "Public visibility: everyone can see the object.",
        sortOrder: 200,
        isVisibility: true,
        color: "green",
        iconName: "Public",
        significance: "Visibility_Public",
      })
  })

  it("defines delegated role assignment as a band continuity capability", () => {
    expect(getPermissionDefinition(Permission.assign_user_roles)).toEqual(
      expect.objectContaining({
        scope: "band",
        isDelegable: true,
        isProtected: false,
        isContinuitySensitive: true,
      }),
    )
  })

  it("ignores unknown persisted permissions without granting or crashing", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    authorizationTestDb.reset({
      bandRole: [{ id: 10, isPublicRole: true, isDeleted: false, bandRolePermissions: [
        { id: 1, permission: { id: 1, name: Permission.public, isDeleted: false } },
        { id: 2, permission: { id: 2, name: "retired_permission", isDeleted: false } },
      ] }],
    })
    // The in-memory delegates implement the Prisma queries used by this loader.
    const database = authorizationTestDb as unknown as AuthorizationDatabase
    const permissions = await loadEffectivePermissions(database, null)
    expect(permissions.ids).toEqual([1])
    expect(permissions.names).toEqual([Permission.public])
    expect(warning).toHaveBeenCalledWith("Ignoring unknown persisted permissions: retired_permission")
    warning.mockRestore()
  })
})
