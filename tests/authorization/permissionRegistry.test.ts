import { describe, expect, it } from "vitest"
import {
  getPermissionDefinition,
  getPermissionDatabaseMetadata,
  gContinuitySensitivePermissions,
  gPermissionOrdered,
  gPermissionRegistry,
  gProtectedPermissions,
  gPublicPermissions,
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
      if (definition.isGrantedToPublic) {
        expect(definition.scope).toBe("public")
        expect(definition.isProtected).toBe(false)
      }
      if (definition.isVisibility) {
        expect(definition.presentation).toBeDefined()
      }
    }

    expect(isPermission("not_a_real_permission")).toBe(false)
  })

  it("derives public, protected, and continuity policy from metadata", () => {
    expect(gPublicPermissions).toEqual([
      Permission.always_grant,
      Permission.public,
      Permission.visibility_public,
      Permission.view_events,
      Permission.view_files,
    ])
    expect([...gProtectedPermissions]).toEqual([
      Permission.impersonate_user,
      Permission.sysadmin,
      Permission.never_grant,
    ])
    expect([...gContinuitySensitivePermissions]).toEqual([
      Permission.admin_users,
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
})
