import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("db", async () => {
  const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client")
  const { authorizationTestDb } = await import("./support/inMemoryPrisma")
  return { ...prisma, default: authorizationTestDb }
})

import * as db3 from "@db3/db3"
import db3Mutation from "tests/authorization/db3MutationTestResolver"
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

const inheritedReadMap: db3.DB3AuthContextPermissionMap = {
  PostQuery: db3.DB3FieldReadAuth.inheritRow,
  PostQueryAsOwner: db3.DB3FieldReadAuth.inheritRow,
  PreInsert: Permission.never_grant,
  PreMutate: Permission.never_grant,
  PreMutateAsOwner: Permission.never_grant,
}

const invalidInheritedWriteMap: db3.DB3AuthContextPermissionMap = {
  ...inheritedReadMap,
  // @ts-expect-error inheritRow is a read invariant, not a mutation permission.
  PreInsert: db3.DB3FieldReadAuth.inheritRow,
}
void invalidInheritedWriteMap

describe("metadata and association mutation entry points", () => {
  const actor = createAuthorizationTestUser("normal", {
    id: 501, isSysAdmin: false,
    permissions: [Permission.login, Permission.sysadmin],
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
      id: 502, permissions: [Permission.login, Permission.manage_users],
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
const userManager = authorization(Permission.login, Permission.view_users_basic_info, Permission.manage_users)

describe("inherited field read authorization", () => {
  it("makes the primary-key policy an explicit row-read invariant", () => {
    expect(db3.createAuthContextMap_PK()).toMatchObject({
      PostQuery: db3.DB3FieldReadAuth.inheritRow,
      PostQueryAsOwner: db3.DB3FieldReadAuth.inheritRow,
    })
    expect(db3.xEventStatus.fields.id.isReadRequiredAfterRowAuth()).toBe(true)
  })

  it("requires every row-read branch before declaring a field required", () => {
    const mixedField = new db3.GhostField({
      memberName: "mixed",
      authMap: {
        ...inheritedReadMap,
        PostQueryAsOwner: Permission.login,
      },
    })
    const customField = new db3.GhostField({
      memberName: "custom",
      _customAuth: () => true,
    })

    expect(mixedField.readAuthorizationInheritsRow("PostQuery")).toBe(true)
    expect(mixedField.readAuthorizationInheritsRow("PostQueryAsOwner")).toBe(false)
    expect(mixedField.isReadRequiredAfterRowAuth()).toBe(false)
    expect(customField.isReadRequiredAfterRowAuth()).toBe(false)
  })

  it("gates inherited model-free field checks with table readability", () => {
    const publicData = authorization(Permission.always_grant, Permission.public)

    expect(db3.xEventStatus.authorizeColumnForView({
      model: null,
      publicData,
      columnName: "id",
    })).toBe(true)
    expect(db3.xChange.authorizeColumnForView({
      model: null,
      publicData,
      columnName: "id",
    })).toBe(false)
  })

  it("keeps inherited fields unavailable when the concrete row is denied", () => {
    const publicData = authorization(Permission.always_grant, Permission.public)

    expect(db3.xChange.authorizeColumnForView({
      model: { id: 41, table: "User", recordId: 99 },
      publicData,
      columnName: "id",
    })).toBe(false)
  })

  it("treats event-status scalar metadata as part of an authorized row", () => {
    const publicData = authorization(Permission.always_grant, Permission.public)
    const model = {
      id: 10,
      isDeleted: false,
      label: "Confirmed",
      description: "Public display metadata",
      sortOrder: 1,
      color: "green",
      significance: "FinalConfirmation",
      iconName: "check",
    }
    const result = db3.xEventStatus.authorizeAndSanitize({
      contextDesc: "event-status-inherit-row-test",
      model,
      rowMode: "view",
      publicData,
      fallbackOwnerId: null,
    })

    expect(result.rowIsAuthorized).toBe(true)
    expect(result.authorizedModel).toEqual(model)
    expect(result.unauthorizedColumnCount).toBe(0)
    expect(db3.xEventStatus.fields.label.isReadRequiredAfterRowAuth()).toBe(true)
    expect(db3.xEventStatus.fields.events.isReadRequiredAfterRowAuth()).toBe(false)
  })

  it("does not change event-status mutation authorization", () => {
    const publicData = authorization(Permission.always_grant, Permission.public)
    const result = db3.xEventStatus.authorizeAndSanitize({
      contextDesc: "event-status-inherit-row-write-test",
      model: { label: "Replacement" },
      existingModel: { id: 10, label: "Confirmed" },
      rowMode: "update",
      publicData,
      fallbackOwnerId: null,
    })

    expect(result.rowIsAuthorized).toBe(false)
    expect(result.authorizedModel).toEqual({})
    expect(result.unauthorizedModel).toEqual({ label: "Replacement" })
  })
})

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
    const publicData = authorization(Permission.login)
    expect(table.authorizeTableForEdit(publicData)).toBe(true)
    expect(table.authorizeRowForEdit({ publicData, model: { id: publicData.userId } })).toBe(true)
    expect(table.authorizeRowForEdit({ publicData, model: { id: 999 } })).toBe(false)
  })
})
