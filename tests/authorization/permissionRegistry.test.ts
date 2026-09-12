import { describe, expect, it, vi } from "vitest"
import { loadEffectivePermissions } from "src/auth/server/effectivePermissions"
import {
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
      expect(getPermissionDefinition(definition.key as Permission)).toBe(definition)
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

  it("defines delegated role assignment as a site continuity capability", () => {
    expect(getPermissionDefinition(Permission.assign_user_roles)).toEqual(
      expect.objectContaining({
        category: "users",
        scope: "site",
        isDelegable: true,
        isProtected: false,
        isContinuitySensitive: true,
      }),
    )
  })

  it("ignores unknown persisted permissions without granting or crashing", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const database = {
      role: {
        findMany: async () => [{
          isPublicRole: true,
          isSysAdminRole: false,
          permissions: [
            { permissionId: 1, permission: { name: Permission.public } },
            { permissionId: 2, permission: { name: "retired_permission" } },
          ],
        }],
      },
    }

    await expect(loadEffectivePermissions(database as any, null)).resolves.toEqual({
      ids: [1],
      names: [Permission.public],
    })
    expect(warning).toHaveBeenCalledWith("Ignoring unknown persisted permissions: retired_permission")
    warning.mockRestore()
  })
})
