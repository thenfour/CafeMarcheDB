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
    expect(db3.xUserSignInMethod.authorizeColumnForView({
      model: null,
      auth: publicData,
      columnName: "id",
    })).toBe(false)
  })

  it("keeps inherited fields unavailable when the concrete row is denied", () => {
    const publicData = authorization(Permission.always_grant, Permission.public)

    expect(db3.xUserSignInMethod.authorizeColumnForView({
      model: { id: 41, publicId: "ProtectedRow0001", type: "email", userId: 99 },
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
      name: "Confirmed",
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
      name: model.name,
    }))
    expect(result.authorizedModel).not.toHaveProperty("id")
    expect(result.unauthorizedColumnCount).toBe(1)
    expect(db3.xEventStatus.fields.name.isReadRequiredAfterRowAuth()).toBe(true)
    expect(db3.xEventStatus.fields.events.isReadRequiredAfterRowAuth()).toBe(false)
  })

  it("rejects public event-status mutations", () => {
    const publicData = authorization(Permission.always_grant, Permission.public)
    const result = db3.xEventStatus.authorizeAndSanitize({
      contextDesc: "event-status-inherit-row-write-test",
      model: { name: "Replacement" },
      existingModel: { id: 10, name: "Confirmed" },
      rowMode: "update",
      auth: publicData,
      fallbackOwnerId: null,
    })

    expect(result.rowIsAuthorized).toBe(false)
    expect(result.authorizedModel).toEqual({})
    expect(result.unauthorizedModel).toEqual({ name: "Replacement" })
  })
})

describe("schema-owned table authorization", () => {
  it("does not register generic settings storage", () => {
    expect(() => db3.GetTableById("Setting")).toThrow("was not found")
    expect(() => db3.getDB3View("Setting_Editor")).toThrow("was not found")
  })

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





// MIGRATION_RESTORE: audit-log
// Source: 6ee055895a049d6f105d775b4e2e563542f34d32:tests/authorization/db3TableAuthorization.test.ts:72-90
// Reason: Legacy audit readers and JSON rendering lack scoped ownership and target-schema references.
// Restore: Restore protected audit browsing, filters, historical JSON/detail links and clipboard/Markdown inspection with explicit platform/band authorization, fresh snapshots, localized references and redaction; retain immutable audit recording.
// Verification: Reactivate preserved audit specifications; test sysadmin/member/anonymous access, two bands, deleted references, revoked grants, redaction, filters, JSON inspection and built-browser navigation.
// SHA256: c75b659266117840a210e3d225b21aa73700d3cd75f4263de7f001b214cdbf1a
// MIGRATION_REFERENCE_BEGIN
//   it("gates inherited model-free field checks with table readability", () => {
//     const publicData = authorization(Permission.always_grant, Permission.public)
//
//     expect(db3.xEventStatus.authorizeColumnForView({
//       model: null,
//       auth: publicData,
//       columnName: "publicId",
//     })).toBe(true)
//     expect(db3.xEventStatus.authorizeColumnForView({
//       model: null,
//       auth: publicData,
//       columnName: "id",
//     })).toBe(false)
//     expect(db3.xChange.authorizeColumnForView({
//       model: null,
//       auth: publicData,
//       columnName: "id",
//     })).toBe(false)
//   })
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: audit-log
// Source: 6ee055895a049d6f105d775b4e2e563542f34d32:tests/authorization/db3TableAuthorization.test.ts:92-100
// Reason: Legacy audit readers and JSON rendering lack scoped ownership and target-schema references.
// Restore: Restore protected audit browsing, filters, historical JSON/detail links and clipboard/Markdown inspection with explicit platform/band authorization, fresh snapshots, localized references and redaction; retain immutable audit recording.
// Verification: Reactivate preserved audit specifications; test sysadmin/member/anonymous access, two bands, deleted references, revoked grants, redaction, filters, JSON inspection and built-browser navigation.
// SHA256: f845a3e4cec3110961251fbb435c2b7b7fe8382e012f674d03fe78d87290e473
// MIGRATION_REFERENCE_BEGIN
//   it("keeps inherited fields unavailable when the concrete row is denied", () => {
//     const publicData = authorization(Permission.always_grant, Permission.public)
//
//     expect(db3.xChange.authorizeColumnForView({
//       model: { id: 41, table: "User", recordId: 99 },
//       auth: publicData,
//       columnName: "id",
//     })).toBe(false)
//   })
// MIGRATION_REFERENCE_END
