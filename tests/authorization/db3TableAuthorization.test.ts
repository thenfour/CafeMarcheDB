import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { testServerAuthorization } from "tests/support/serverAuthorization";
import { describe, expect, it, vi } from "vitest"

vi.mock("db", async () => {
  const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client")
  const { authorizationTestDb } = await import("./support/inMemoryPrisma")
  return { ...prisma, default: authorizationTestDb }
})

import * as db3 from "@db3/db3"
import { ServerPermissionSet } from "src/auth/server/ServerPermissionSet"
import { Permission } from "shared/permissions"



const authorization = (...names: Permission[]): CMServerAuthorization => testServerAuthorization(
  { id: 501 },
  new ServerPermissionSet(names.map((name, index) => ({ id: index + 1, name }))),
)

const inheritedReadMap = db3.defineAuthMap({
  PostQuery: db3.DB3FieldReadAuth.inheritRow,
  PostQueryAsOwner: db3.DB3FieldReadAuth.inheritRow,
  PreInsert: Permission.never_grant,
  PreMutate: Permission.never_grant,
  PreMutateAsOwner: Permission.never_grant,
})

const invalidInheritedWriteMap = {
  PostQuery: db3.DB3FieldReadAuth.inheritRow,
  PostQueryAsOwner: db3.DB3FieldReadAuth.inheritRow,
  // @ts-expect-error inheritRow is a read invariant, not a mutation permission.
  PreInsert: db3.DB3FieldReadAuth.inheritRow,
  PreMutate: Permission.never_grant,
  PreMutateAsOwner: Permission.never_grant,
} satisfies db3.DB3AuthContextPermissionMapShape
void invalidInheritedWriteMap

const sysadminGrant = authorization(Permission.sysadmin)
const userManager = authorization(Permission.login, Permission.view_users_basic_info, Permission.manage_users)

describe("inherited field read authorization", () => {
  it("makes the primary-key policy an explicit row-read invariant", () => {
    expect(db3.createAuthContextMap_PK()).toMatchObject({
      PostQuery: db3.DB3FieldReadAuth.inheritRow,
      PostQueryAsOwner: db3.DB3FieldReadAuth.inheritRow,
    })
    expect(db3.xEventStatus.fields.id.isReadRequiredAfterRowAuth()).toBe(false)
    expect(db3.xEventStatus.fields.publicId.isReadRequiredAfterRowAuth()).toBe(true)
  })

  it("requires every row-read branch before declaring a field required", () => {
    const mixedField = new db3.GhostField({
      memberName: "mixed",
      authMap: db3.defineAuthMap({
        ...inheritedReadMap,
        PostQueryAsOwner: Permission.login,
      }),
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
      auth: publicData,
      columnName: "publicId",
    })).toBe(true)
    expect(db3.xEventStatus.authorizeColumnForView({
      model: null,
      auth: publicData,
      columnName: "id",
    })).toBe(false)
    expect(db3.xChange.authorizeColumnForView({
      model: null,
      auth: publicData,
      columnName: "id",
    })).toBe(false)
  })

  it("keeps inherited fields unavailable when the concrete row is denied", () => {
    const publicData = authorization(Permission.always_grant, Permission.public)

    expect(db3.xChange.authorizeColumnForView({
      model: { id: 41, table: "User", recordId: 99 },
      auth: publicData,
      columnName: "id",
    })).toBe(false)
  })

  it("treats event-status scalar metadata as part of an authorized row", () => {
    const publicData = authorization(Permission.always_grant, Permission.public)
    const model = {
      id: 10,
      publicId: "AuthEventStat001",
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
      auth: publicData,
      fallbackOwnerId: null,
    })

    expect(result.rowIsAuthorized).toBe(true)
    expect(result.authorizedModel).toEqual(expect.objectContaining({
      publicId: model.publicId,
      label: model.label,
    }))
    expect(result.authorizedModel).not.toHaveProperty("id")
    expect(result.unauthorizedColumnCount).toBe(1)
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
      auth: publicData,
      fallbackOwnerId: null,
    })

    expect(result.rowIsAuthorized).toBe(false)
    expect(result.authorizedModel).toEqual({})
    expect(result.unauthorizedModel).toEqual({ label: "Replacement" })
  })
})

describe("schema-owned table authorization", () => {
  it.each([db3.xSetting])(
    "uses the operation map for $tableName access",
    table => {
      expect(table.authorizeTableForView(sysadminGrant)).toBe(true)
      expect(table.authorizeTableForEdit(sysadminGrant)).toBe(true)
      expect(table.authorizeRowBeforeInsert({ auth: sysadminGrant })).toBe(true)
      expect(table.authorizeTableForView(userManager)).toBe(false)
      expect(table.authorizeTableForEdit(userManager)).toBe(false)
      expect(table.authorizeRowBeforeInsert({ auth: userManager })).toBe(false)
    },
  )

  it("keeps canonical permission metadata public and mutations Sysadmin-only", () => {
    const publicGrant = authorization(Permission.public)
    expect(db3.xPermission.authorizeTableForView(publicGrant)).toBe(true)
    expect(db3.xPermission.authorizeTableForEdit(publicGrant)).toBe(false)
    expect(db3.xPermission.authorizeTableForEdit(userManager)).toBe(false)
    expect(db3.xPermission.authorizeTableForEdit(sysadminGrant)).toBe(true)

    expect(db3.xPermission.fields.name.isReadRequiredAfterRowAuth()).toBe(true)
    expect(db3.xPermission.fields.color.isReadRequiredAfterRowAuth()).toBe(true)
    expect(db3.xPermission.fields).not.toHaveProperty("roles")
  })

  it.each([
    [db3.xPermission, { color: "red" }],
  ] as const)("authorizes %s metadata without a user-management grant", (table, model) => {
    const result = table.authorizeAndSanitize({
      contextDesc: "metadata-policy-test",
      model,
      existingModel: { id: 100, name: "Metadata" },
      rowMode: "update",
      fallbackOwnerId: null,
      auth: sysadminGrant,
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
    expect(table.authorizeRowForEdit({ auth: publicData, model: { id: publicData.userId } })).toBe(true)
    expect(table.authorizeRowForEdit({ auth: publicData, model: { id: 999 } })).toBe(false)
  })
})
