import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("db", async () => {
  const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client")
  const { authorizationTestDb } = await import("./support/inMemoryPrisma")
  return { ...prisma, default: authorizationTestDb }
})

import * as db3 from "@db3/db3"
import db3Mutation from "@db3/mutations/db3mutations"
import { UpdateAssociations } from "@db3/server/db3mutationCore"
import { PermissionSet } from "src/auth/shared/PermissionSet"
import { Permission } from "shared/permissions"
import { CreateChangeContext } from "shared/activityLog"
import { createAuthorizationTestContext, createAuthorizationTestUser } from "./support/authorizationFixtures"
import { authorizationTestDb } from "./support/inMemoryPrisma"
import { forgeDb3Delete, forgeDb3Insert, forgeDb3Update } from "./support/db3RequestBuilders"
import { invokeResolver } from "./support/resolverHarness"

const authorization = (...names: Permission[]): db3.DB3Authorization => ({
  userId: 501,
  effectivePermissions: new PermissionSet(names.map((name, index) => ({ id: index + 1, name }))),
})

describe("metadata and association mutation entry points", () => {
  const actor = createAuthorizationTestUser("normal", {
    id: 501, isSysAdmin: false,
    permissions: [Permission.login, Permission.basic_trust, Permission.sysadmin],
  })
  const role = {
    id: 200, name: "Ordinary role", description: "", color: null, sortOrder: 0,
    isPublicRole: false, isSysAdminRole: false, isRoleForNewUsers: false,
    permissions: [],
  }
  const permission = {
    id: 300, name: Permission.visibility_members, description: "Before",
    color: null, sortOrder: 0, isVisibility: true, roles: [],
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    authorizationTestDb.reset({ user: [actor], role: [role], permission: [permission] })
  })

  it("edits permission metadata and role colors without manage_users", async () => {
    const ctx = createAuthorizationTestContext(actor)
    await invokeResolver(db3Mutation, forgeDb3Update("Permission", 300, { description: "After" }), ctx)
    await invokeResolver(db3Mutation, forgeDb3Update("Role", 200, { color: "x1" }), ctx)
    expect(authorizationTestDb.snapshot("permission")[0]!.description).toBe("After")
    expect(authorizationTestDb.snapshot("role")[0]!.color).toBe("x1")
  })

  it.each([
    ["Role", 200, "permissions", 300],
    ["Permission", 300, "roles", 200],
  ] as const)("adds and removes grants through %s's authorized association field", async (table, id, field, targetId) => {
    const ctx = createAuthorizationTestContext(actor)
    await invokeResolver(db3Mutation, forgeDb3Update(table, id, { [field]: [targetId] }), ctx)
    expect(authorizationTestDb.snapshot("rolePermission")).toEqual([
      expect.objectContaining({ roleId: 200, permissionId: 300 }),
    ])
    await invokeResolver(db3Mutation, forgeDb3Update(table, id, { [field]: [] }), ctx)
    expect(authorizationTestDb.snapshot("rolePermission")).toEqual([])
  })

  it("checks the parent map when association updates are invoked directly", async () => {
    const manager = createAuthorizationTestUser("normal", {
      id: 502, permissions: [Permission.login, Permission.basic_trust, Permission.manage_users],
    })
    authorizationTestDb.reset({ user: [manager], role: [role], permission: [permission] })
    const joinLookup = vi.spyOn(authorizationTestDb.getDelegate("rolePermission"), "findMany")
    await expect(UpdateAssociations({
      ctx: createAuthorizationTestContext(manager) as any,
      changeContext: CreateChangeContext("association-authorization-test"),
      localTable: db3.xPermission,
      column: db3.xPermission.getColumn("roles") as db3.TagsField<any>,
      localId: 300,
      localModel: permission,
      desiredTagIds: [200],
    })).rejects.toThrow("Not authorized to mutate Permission fields: roles")
    expect(joinLookup).not.toHaveBeenCalled()
  })

  it("uses the join table's map for direct inserts while retaining its deletion policy", async () => {
    const ctx = createAuthorizationTestContext(actor)
    await invokeResolver(db3Mutation, forgeDb3Insert("RolePermission", { roleId: 200, permissionId: 300 }), ctx)
    const association = authorizationTestDb.snapshot("rolePermission")[0]!
    expect(association).toMatchObject({ roleId: 200, permissionId: 300 })
    await expect(invokeResolver(db3Mutation, forgeDb3Delete("RolePermission", association.id), ctx)).rejects.toThrow("Not authorized")
    expect(authorizationTestDb.snapshot("rolePermission")).toEqual([association])
  })
})

const sysadminGrant = authorization(Permission.sysadmin)
const userManager = authorization(Permission.basic_trust, Permission.manage_users)

describe("schema-owned table authorization", () => {
  it.each([db3.xRole, db3.xPermission, db3.xRolePermissionAssociation, db3.xSetting])(
    "uses the operation map for $tableName access",
    table => {
      expect(table.authorizeTableForView(sysadminGrant)).toBe(true)
      expect(table.authorizeTableForEdit(sysadminGrant)).toBe(true)
      expect(table.authorizeRowBeforeInsert({ publicData: sysadminGrant })).toBe(true)
      expect(table.authorizeTableForView(userManager)).toBe(false)
      expect(table.authorizeTableForEdit(userManager)).toBe(false)
      expect(table.authorizeRowBeforeInsert({ publicData: userManager })).toBe(false)
    },
  )

  it("keeps visibility choices readable while applying the metadata mutation policy", () => {
    expect(db3.xPermissionForVisibility.authorizeTableForView(userManager)).toBe(true)
    expect(db3.xPermissionForVisibility.authorizeTableForEdit(userManager)).toBe(false)
    expect(db3.xPermissionForVisibility.authorizeTableForEdit(sysadminGrant)).toBe(true)
  })

  it.each([
    [db3.xPermission, { description: "Updated", color: "red", roles: [200] }],
    [db3.xPermissionForVisibility, { description: "Updated", color: "red" }],
    [db3.xRole, { description: "Updated", color: "red", permissions: [300] }],
    [db3.xRolePermissionAssociation, { roleId: 200, permissionId: 300 }],
  ] as const)("authorizes %s metadata without a user-management grant", (table, model) => {
    const result = table.authorizeAndSanitize({
      contextDesc: "metadata-policy-test",
      model,
      existingModel: { id: 100, name: "Metadata" },
      rowMode: "update",
      fallbackOwnerId: null,
      publicData: sysadminGrant,
    })
    expect(result.rowIsAuthorized).toBe(true)
    expect(result.unauthorizedColumnCount).toBe(0)
    expect(result.unknownColumnCount).toBe(0)
    expect(result.authorizedModel).toEqual(model)
  })

  it("preflights own-row editing without granting edits to another user's row", () => {
    const table = db3.xUser
    const publicData = authorization(Permission.basic_trust)
    expect(table.authorizeTableForEdit(publicData)).toBe(true)
    expect(table.authorizeRowForEdit({ publicData, model: { id: publicData.userId } })).toBe(true)
    expect(table.authorizeRowForEdit({ publicData, model: { id: 999 } })).toBe(false)
  })
})
