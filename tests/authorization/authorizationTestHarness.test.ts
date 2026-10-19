import executeCommand from "@db3/mutations/executeDB3Command";
import { authorizationPermissionId } from "./support/authorizationFixtures";
import { authorizationBandId, resetAuthorizationDatabase } from "./support/authorizationSeed";
import { loadAuthorizationForUser } from "@/src/auth/server/serverAuthorization";
import type { Prisma } from "@prisma/client";
import { bindDB3ReadSnapshot } from "@db3/server/db3ReadExecution";
import { hash256 } from "@blitzjs/auth";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { songPublicId } from "../support/songFixtures";
import { userPublicId } from "../support/userFixtures";

vi.mock("db", async () => {
  const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client")
  const { authorizationTestDb } = await import("./support/inMemoryPrisma")
  return {
    ...prisma,
    default: authorizationTestDb,
  }
})

import * as db3 from "@db3/db3";
import db3PaginatedQuery from "@db3/queries/db3paginatedQueries";
import db3Query from "@db3/queries/db3queries";
import { queryTable } from "@db3/server/db3QueryCore";
import {
  validateDB3MutationRequest,
  validateDB3PaginatedQueryRequest,
  validateDB3QueryRequest,
} from "@db3/server/db3RequestValidation";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import deactivateUser from "src/auth/mutations/deactivateUser";
import forgotPassword from "src/auth/mutations/forgotPassword";
import impersonateUser from "src/auth/mutations/impersonateUser";
import resetPassword from "src/auth/mutations/resetPassword";
import setUserSysAdmin from "src/auth/mutations/setUserSysAdmin";
import stopImpersonating from "src/auth/mutations/stopImpersonating";
import { ServerPermissionSet } from "src/auth/server/ServerPermissionSet";
import {
  canManageUser,
  getContinuityWarningsForUserResult,
  isRoleWithinDelegationEnvelope,
} from "src/auth/server/userManagementPolicy";
import { makePermissionSetFromRole } from "src/auth/server/userManagementState";
import db3Mutation from "tests/authorization/db3MutationTestResolver";
import { testBandAuthorization, testServerAuthorization } from "tests/support/serverAuthorization";
import { eventPublicId } from "../support/eventResponseFixtures";
import {
  asUserManagementActor,
  asUserManagementTarget,
  createAuthorizationPersona,
  createAuthorizationTarget,
  createAuthorizationTestUser,
  type AuthorizationPersona,
  type AuthorizationTargetKind,
} from "./support/authorizationFixtures";
import {
  forgeDb3Insert,
  forgeDb3PublicDelete,
  forgeDb3PublicUpdate,
  forgeDb3Query,
  forgeDb3Update,
} from "./support/db3RequestBuilders";
import { authorizationTestDb } from "./support/inMemoryPrisma";
import { invokeResolver } from "./support/resolverHarness";

describe("authorization test personas", () => {
  const personas: AuthorizationPersona[] = [
    "public",
    "limited",
    "normal",
    "editor",
    "moderator",
    "bandAdmin",
    "sysadmin",
  ]

  it.each(personas)("builds an isolated %s persona", (persona) => {
    const fixture = createAuthorizationPersona(persona)

    expect(fixture.persona).toBe(persona)
    expect(fixture.publicData.userId).toBe(fixture.user?.id ?? 0)
    expect(fixture.publicData.isSysAdmin).toBe(persona === "sysadmin")
    expect(fixture.publicData.permissionNames).not.toContain(Permission.visibility_public)
    expect(fixture.schemaAuthorization.hasPermission(Permission.visibility_public)).toBe(true)
  })

  it("keeps Band Admin distinct from Sysadmin", () => {
    const bandAdmin = createAuthorizationPersona("bandAdmin")

    expect(bandAdmin.publicData.isSysAdmin).toBe(false)
    expect(bandAdmin.publicData.permissionNames).not.toContain(Permission.sysadmin)
    expect(bandAdmin.publicData.permissionNames).not.toContain(Permission.impersonate_user)
  })

  const targetKinds: AuthorizationTargetKind[] = [
    "ordinary",
    "peerBandAdmin",
    "protectedRole",
    "isSysAdmin",
  ]

  it.each(targetKinds)("builds a distinct %s target", (targetKind) => {
    const target = createAuthorizationTarget(targetKind)

    expect(target.id).toBeGreaterThan(0)
    expect(target.isSysAdmin).toBe(targetKind === "isSysAdmin")
    expect(target.globalRole?.permissions.some((entry) => entry.permission.name === Permission.sysadmin)).toBe(
      targetKind === "protectedRole",
    )
  })
})

describe("generic DB3 resolver harness", () => {
  const sysadmin = createAuthorizationTestUser("sysadmin", { id: 1 })
  const target = createAuthorizationTestUser("normal", {
    id: 2,
    name: "Before mutation",
  })

  beforeEach(() => {
    resetAuthorizationDatabase({
      user: [sysadmin, target],
      change: [],
    })
  })

  it("invokes a generic query with a caller-forged request", async () => {
    const { ctx } = createAuthorizationPersona("sysadmin", { id: sysadmin.id })

    const result = await invokeResolver(
      db3Query,
      forgeDb3Query("User", authorizationBandId),
      ctx,
    )

    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ publicId: sysadmin.publicId }),
        expect.objectContaining({ publicId: target.publicId, name: "Before mutation" }),
      ]),
    )
    expect(authorizationTestDb.snapshot("user")).toHaveLength(2)
  })

  it("invokes a generic mutation and exposes persisted state for assertions", async () => {
    const { ctx } = createAuthorizationPersona("sysadmin", { id: sysadmin.id })

    const result = await invokeResolver(
      db3Mutation,
      forgeDb3PublicUpdate("PlatformUser", null, target.publicId, {
        name: "After mutation",
      }, { tableName: "User" }),
      ctx,
    )

    expect(result).toEqual(expect.objectContaining({ publicId: target.publicId, name: "After mutation" }))
    expect(authorizationTestDb.snapshot("user")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: target.id, name: "After mutation" }),
      ]),
    )
    expect(authorizationTestDb.snapshot("change")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: "User", recordId: target.id, action: "update" }),
      ]),
    )
  })
})

describe("BA-A001 generic DB3 request validation", () => {
  const sysadmin = createAuthorizationTestUser("sysadmin", { id: 1 })
  const moderator = createAuthorizationTestUser("moderator", { id: 2 })
  const target = createAuthorizationTestUser("normal", { id: 3 })

  beforeEach(() => {
    resetAuthorizationDatabase({
      user: [sysadmin, moderator, target],
      change: [],
      eventType: [],
    })
  })

  it("rejects unknown and mismatched table identifiers", () => {
    expect(() => validateDB3QueryRequest(forgeDb3Query("UnknownTable", authorizationBandId))).toThrow(
      "unknown table ID 'UnknownTable'",
    )
    expect(() =>
      validateDB3QueryRequest(forgeDb3Query("User", authorizationBandId, { table: { tableID: "User", tableName: "Role" } })),
    ).toThrow("table name 'Role' does not match table ID 'User'")
  })

  it("rejects unknown request properties, including caller-provided authorization", () => {
    expect(() =>
      validateDB3QueryRequest({
        ...forgeDb3Query("User", authorizationBandId),
        authorization: { permissions: [Permission.sysadmin] },
      }),
    ).toThrow(/Unrecognized key.*authorization/)

    expect(() =>
      validateDB3QueryRequest({ ...forgeDb3Query("User", authorizationBandId), rawPrismaArgs: {} }),
    ).toThrow(/Unrecognized key.*rawPrismaArgs/)
  })

  it("rejects unsupported query operators and non-scalar filter values", () => {
    expect(() =>
      validateDB3QueryRequest(
        forgeDb3Query("User", authorizationBandId, {
          filter: { items: [{ field: "name", operator: "contains" as "equals", value: "x" }] },
        }),
      ),
    ).toThrow("Invalid literal value, expected \"equals\"")

    expect(() =>
      validateDB3QueryRequest(
        forgeDb3Query("User", authorizationBandId, {
          filter: {
            items: [{ field: "name", operator: "equals", value: { contains: "x" } }],
          },
        }),
      ),
    ).toThrow("Invalid input")

    expect(() =>
      validateDB3QueryRequest(
        forgeDb3Query("User", authorizationBandId, {
          filter: { items: [{ field: "name", operator: "equals" }] } as never,
        }),
      ),
    ).toThrow("filter.items.0.value: Invalid input")
  })

  it("rejects unknown filter and ordering fields", () => {
    expect(() =>
      validateDB3QueryRequest(
        forgeDb3Query("User", authorizationBandId, {
          filter: { items: [{ field: "notAColumn", operator: "equals", value: 1 }] },
        }),
      ),
    ).toThrow("unknown filter field 'notAColumn' on table 'User'")

    expect(() =>
      validateDB3QueryRequest(forgeDb3Query("User", authorizationBandId, { orderBy: { notAColumn: "asc" } })),
    ).toThrow("unknown order field 'notAColumn' on table 'User'")

    expect(() =>
      validateDB3QueryRequest(
        forgeDb3Query("User", authorizationBandId, { orderBy: { name: "sideways" } }),
      ),
    ).toThrow("Invalid enum value")
  })

  it("validates table parameters against the selected table contract", () => {
    const valid = validateDB3QueryRequest(
      forgeDb3Query("User", authorizationBandId, {
        filter: { items: [], tableParams: { userId: target.publicId, userIds: [target.publicId] } },
      }),
    )
    expect(valid.filter.tableParams).toEqual({ userId: target.publicId, userIds: [target.publicId] })

    expect(() =>
      validateDB3QueryRequest(
        forgeDb3Query("User", authorizationBandId, { filter: { items: [], tableParams: { userId: 3 } } }),
      ),
    ).toThrow("filter.tableParams.userId: Expected string")

    expect(() =>
      validateDB3QueryRequest(
        forgeDb3Query("User", authorizationBandId, { filter: { items: [], tableParams: { rawWhere: {} } } }),
      ),
    ).toThrow(/Unrecognized key.*rawWhere/)
  })

  it("validates pagination bounds", () => {
    expect(() =>
      validateDB3PaginatedQueryRequest({
        ...forgeDb3Query("User", authorizationBandId),
        skip: 0,
        take: 50,
      }),
    ).not.toThrow()

    expect(() =>
      validateDB3PaginatedQueryRequest({
        ...forgeDb3Query("User", authorizationBandId),
        skip: -1,
        take: 50,
      }),
    ).toThrow("Expected a value between 0 and 10000000")
  })

  it("rejects unknown mutation kinds, fields, and mismatched update IDs", () => {
    expect(() =>
      validateDB3MutationRequest({
        tableID: "User",
        tableName: "User",
        mutationType: "upsert",
        updateId: target.id,
        updateModel: {},
      }),
    ).toThrow("Invalid discriminator value")

    expect(() =>
      validateDB3MutationRequest(
        forgeDb3Update("User", null, target.id, { notAColumn: "value" }),
      ),
    ).toThrow("unknown mutation field 'notAColumn' on table 'User'")

    expect(() =>
      validateDB3MutationRequest(
        forgeDb3Update("User", null, target.id, { publicId: userPublicId(target.id + 1), name: "mismatch" }),
      ),
    ).toThrow("field 'publicId' is immutable")
  })

  it("uses database authorization and excludes deleted rows for every actor by default", async () => {
    const visibleEventTypePublicId = parsePublicId<"EventType">("AuthEventType001")
    const deletedEventTypePublicId = parsePublicId<"EventType">("AuthEventType002")
    resetAuthorizationDatabase({
      user: [sysadmin, moderator, { ...target, isDeleted: true }],
      change: [],
      eventType: [
        { id: 10, publicId: visibleEventTypePublicId, isDeleted: false, color: null, sortOrder: 0, iconName: null, significance: null },
        { id: 11, publicId: deletedEventTypePublicId, isDeleted: true, color: null, sortOrder: 1, iconName: null, significance: null },
      ],
    })

    const { ctx: moderatorCtx } = createAuthorizationPersona("moderator", { id: moderator.id })
    const moderatorResult = await invokeResolver(db3Query, forgeDb3Query("User", authorizationBandId), moderatorCtx)
    expect(moderatorResult.items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: target.id })]),
    )

    const { ctx: sysadminCtx } = createAuthorizationPersona("sysadmin", { id: sysadmin.id })
    const sysadminResult = await invokeResolver(db3Query, forgeDb3Query("User", authorizationBandId), sysadminCtx)
    expect(sysadminResult.items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: target.id })]),
    )

    const { ctx: publicCtx } = createAuthorizationPersona("public")
    const publicResult = await invokeResolver(db3Query, forgeDb3Query("EventType", authorizationBandId, {
      table: { tableID: "EventType", tableName: "EventType", viewID: db3.eventTypeDashboardView.viewID },
    }), publicCtx)
    expect(publicResult.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ publicId: visibleEventTypePublicId })]),
    )
    expect(publicResult.items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ publicId: deletedEventTypePublicId })]),
    )
    expect(sysadminResult).not.toHaveProperty("authorization")
  })
})

describe("BA-A002 generic DB3 query authorization", () => {
  const sysadmin = createAuthorizationTestUser("sysadmin", { id: 1 })
  const normal = createAuthorizationTestUser("normal", {
    id: 2,
    permissions: [
      Permission.login,
      Permission.view_users_basic_info,
      Permission.manage_users,
    ],
  })
  const activeTarget = createAuthorizationTestUser("normal", { id: 3 })
  const deletedTarget = createAuthorizationTestUser("normal", { id: 4, isDeleted: true })

  beforeEach(() => {
    resetAuthorizationDatabase({
      user: [sysadmin, normal, activeTarget, deletedTarget],
      change: [{ id: 1, table: "User", recordId: activeTarget.id }],
      event: [],
    })
    vi.restoreAllMocks()
  })

  function grantAccountLogin() {
    resetAuthorizationDatabase({
      user: [{ ...normal, mergedIntoUserId: null, globalRoleId: 10_000 }],
      globalRole: [{ id: 10_000, isDeleted: false }],
      globalRolePermission: [{ id: 1, globalRoleId: 10_000, permissionId: authorizationPermissionId(Permission.login) }],
    })
  }

  it("rejects an unauthorized table before its Prisma query executes", async () => {
    grantAccountLogin()
    const findMany = vi.spyOn(authorizationTestDb.getDelegate("userSignInMethod"), "findMany")
    const { ctx } = createAuthorizationPersona("normal", { id: normal.id })

    await expect(invokeResolver(db3Query, forgeDb3Query("UserSignInMethod", authorizationBandId), ctx)).rejects.toThrow(
      "Not authorized to perform this query.",
    )
    expect(findMany).not.toHaveBeenCalled()
  })

  it("rejects an unauthorized paginated table before querying or counting", async () => {
    grantAccountLogin()
    const methodDelegate = authorizationTestDb.getDelegate("userSignInMethod")
    const findMany = vi.spyOn(methodDelegate, "findMany")
    const count = vi.spyOn(methodDelegate, "count")
    const { ctx } = createAuthorizationPersona("normal", { id: normal.id })

    await expect(
      invokeResolver(
        db3PaginatedQuery,
        { bandPublicId: authorizationBandId, ...forgeDb3Query("UserSignInMethod", authorizationBandId), skip: 0, take: 50 },
        ctx,
      ),
    ).rejects.toThrow("Not authorized to perform this query.")
    expect(findMany).not.toHaveBeenCalled()
    expect(count).not.toHaveBeenCalled()
  })

  it("rejects an internal query without the table's required effective permission", async () => {
    const authorization = await loadAuthorizationForUser(normal)
    const findMany = vi.spyOn(authorizationTestDb.getDelegate("userSignInMethod"), "findMany")

    await expect(queryTable({
      ...forgeDb3Query("UserSignInMethod", null),
    }, authorization)).rejects.toThrow("Not authorized to perform this query.")
    expect(findMany).not.toHaveBeenCalled()
  })

  it.each([
    { name: "filter", request: { filter: { items: [{ field: "isDeleted", operator: "equals" as const, value: true }] } } },
    { name: "order", request: { orderBy: { isDeleted: "asc" as const } } },
    {
      name: "parameter",
      request: {
        filter: {
          items: [],
          tableParams: { eventTypeIds: [parsePublicId<"EventType">("AuthEventType003")] },
        },
      },
    },
  ])("rejects a protected $name field before querying", async ({ request }) => {
    const findMany = vi.spyOn(authorizationTestDb.getDelegate("event"), "findMany")
    const { schemaAuthorization } = createAuthorizationPersona("public")
    const auth = testBandAuthorization(null, schemaAuthorization.effectivePermissions)
    vi.spyOn(auth, "refresh").mockResolvedValue(auth)
    // This test rejects fields before querying; native readers verify actual authorization refresh.
    const snapshot = await bindDB3ReadSnapshot(authorizationTestDb as unknown as Prisma.TransactionClient, auth, { isolationLevel: "Serializable" })

    await expect(
      queryTable(forgeDb3Query("Event", authorizationBandId, request), auth, snapshot),
    ).rejects.toThrow("Not authorized to perform this query.")
    expect(findMany).not.toHaveBeenCalled()
  })

  it("does not consult protected columns while building quick or custom filters", () => {
    const { schemaAuthorization: publicData } = createAuthorizationPersona("public")

    const protectedColumn = db3.xEvent.getColumn("isDeleted")!
    const quickFilter = vi.spyOn(protectedColumn, "getQuickFilterWhereClause")
    const customFilter = vi.spyOn(protectedColumn, "getCustomFilterWhereClause")

    db3.xEvent.GetQuickFilterWhereClauseExpression("probe", publicData)
    db3.xEvent.GetCustomWhereClauseExpression(
      { items: [], tagIds: [12] },
      publicData,
    )

    expect(quickFilter).not.toHaveBeenCalled()
    expect(customFilter).not.toHaveBeenCalled()
  })

  it("does not let a primary key qualify a row from a protected table", () => {
    const { schemaAuthorization: publicData } = createAuthorizationPersona("public")
    const result = db3.xUserSignInMethod.authorizeAndSanitize({
      contextDesc: "BA-A002 protected-row regression",
      auth: publicData,
      rowMode: "view",
      model: { id: 41, publicId: "ProtectedRow0001", type: "email", userId: activeTarget.id },
      fallbackOwnerId: null,
    })

    expect(result.rowIsAuthorized).toBe(false)
    expect(result.authorizedModel).toEqual({})
    expect(result.unauthorizedModel).toEqual(
      expect.objectContaining({ id: 41 }),
    )
  })

  it("returns IDs only for rows inside the server-enforced visibility scope", async () => {
    const publicPermissionId = authorizationPermissionId(Permission.visibility_public)
    const loggedInPermissionId = authorizationPermissionId(Permission.visibility_logged_in_users)
    resetAuthorizationDatabase({
      user: [],
      event: [
        {
          bandId: 1,
          id: 20,
          publicId: eventPublicId(20),
          name: "Public event",
          isDeleted: false,
          createdByUserId: null,
          visiblePermissionId: publicPermissionId,
          visiblePermission: { id: publicPermissionId, name: Permission.visibility_public },
          frontpageVisible: true,
        },
        {
          bandId: 1,
          id: 21,
          publicId: eventPublicId(21),
          name: "Members event",
          isDeleted: false,
          createdByUserId: null,
          visiblePermissionId: loggedInPermissionId,
          visiblePermission: { id: loggedInPermissionId, name: Permission.visibility_logged_in_users },
          frontpageVisible: true,
        },
        {
          bandId: 1,
          id: 22,
          publicId: eventPublicId(22),
          name: "Deleted public event",
          isDeleted: true,
          createdByUserId: null,
          visiblePermissionId: publicPermissionId,
          visiblePermission: { id: publicPermissionId, name: Permission.visibility_public },
          frontpageVisible: true,
        },
      ],
    })
    const { ctx } = createAuthorizationPersona("public")

    const result = await invokeResolver(db3Query, forgeDb3Query("Event", authorizationBandId), ctx)

    expect(result.items).toEqual([
      expect.objectContaining({ publicId: eventPublicId(20), name: "Public event" }),
    ])
    expect(JSON.stringify(result)).not.toContain("Members event")
    expect(JSON.stringify(result)).not.toContain("Deleted public event")
  })

  it("uses the same soft-delete scope for paginated items and counts", async () => {
    const { ctx: normalCtx } = createAuthorizationPersona("normal", { id: normal.id })
    const normalResult = await invokeResolver(
      db3PaginatedQuery,
      { bandPublicId: authorizationBandId, ...forgeDb3Query("User", authorizationBandId), skip: 0, take: 50 },
      normalCtx,
    )

    expect(normalResult.count).toBe(3)
    expect(normalResult.items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: deletedTarget.id })]),
    )

    const normalDeletedOnlyResult = await invokeResolver(
      db3PaginatedQuery,
      {
        bandPublicId: authorizationBandId,
        ...forgeDb3Query("User", authorizationBandId, {
          filter: {
            items: [{ field: "isDeleted", operator: "equals", value: true }],
          },
        }),
        skip: 0,
        take: 50,
      },
      normalCtx,
    )
    expect(normalDeletedOnlyResult.count).toBe(0)
    expect(normalDeletedOnlyResult.items).toEqual([])

    const { ctx: sysadminCtx } = createAuthorizationPersona("sysadmin", { id: sysadmin.id })
    const sysadminResult = await invokeResolver(
      db3PaginatedQuery,
      { bandPublicId: authorizationBandId, ...forgeDb3Query("User", authorizationBandId), skip: 0, take: 50 },
      sysadminCtx,
    )

    expect(sysadminResult.count).toBe(3)
    expect(sysadminResult.items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: deletedTarget.id })]),
    )

    const sysadminDeletedOnlyResult = await invokeResolver(
      db3PaginatedQuery,
      {
        bandPublicId: authorizationBandId,
        ...forgeDb3Query("User", authorizationBandId, {
          filter: {
            items: [{ field: "isDeleted", operator: "equals", value: true }],
          },
        }),
        skip: 0,
        take: 50,
      },
      sysadminCtx,
    )
    expect(sysadminDeletedOnlyResult.count).toBe(0)
    expect(sysadminDeletedOnlyResult.items).toEqual([])
  })

  it("does not count rows outside an authenticated user's visibility scope", async () => {
    const visibilityPermissions = [
      Permission.login,
      Permission.visibility_public,
    ]
    const visibilityUser = createAuthorizationTestUser("normal", {
      id: normal.id,
      permissions: visibilityPermissions,
    })
    const publicPermissionId = authorizationPermissionId(Permission.visibility_public)
    resetAuthorizationDatabase({
      user: [visibilityUser],
      event: [
        {
          bandId: 1,
          id: 30,
          publicId: eventPublicId(30),
          name: "Visible event",
          isDeleted: false,
          createdByUserId: null,
          visiblePermissionId: publicPermissionId,
          visiblePermission: { id: publicPermissionId, name: Permission.visibility_public },
        },
        {
          bandId: 1,
          id: 31,
          publicId: eventPublicId(31),
          name: "Hidden event",
          isDeleted: false,
          createdByUserId: null,
          visiblePermissionId: 999,
          visiblePermission: { id: 999, name: Permission.visibility_members },
        },
        {
          bandId: 1,
          id: 32,
          publicId: eventPublicId(32),
          name: "Deleted event",
          isDeleted: true,
          createdByUserId: null,
          visiblePermissionId: publicPermissionId,
          visiblePermission: { id: publicPermissionId, name: Permission.visibility_public },
        },
      ],
    })
    const { ctx } = createAuthorizationPersona("normal", {
      id: visibilityUser.id,
      permissions: visibilityPermissions,
    })

    const result = await invokeResolver(
      db3PaginatedQuery,
      { bandPublicId: authorizationBandId, ...forgeDb3Query("Event", authorizationBandId), skip: 0, take: 50 },
      ctx,
    )

    expect(result.count).toBe(1)
    expect(result.items).toEqual([
      expect.objectContaining({ publicId: eventPublicId(30), name: "Visible event" }),
    ])
  })

  it("lets recovery-capable Band Admins include deleted rows without bypassing privacy", async () => {
    const permissions = [
      Permission.login,
      Permission.view_events,
      Permission.manage_events,
      Permission.recover_events,
      Permission.visibility_public,
    ]
    const recoveryAdmin = createAuthorizationTestUser("bandAdmin", { id: 40, permissions })
    const publicVisibilityId = authorizationPermissionId(Permission.visibility_public)
    resetAuthorizationDatabase({
      user: [recoveryAdmin],
      event: [
        {
          bandId: 1,
          id: 41,
          publicId: eventPublicId(41),
          name: "Deleted band event",
          isDeleted: true,
          createdByUserId: 999,
          visiblePermissionId: publicVisibilityId,
          visiblePermission: { id: publicVisibilityId, name: Permission.visibility_public },
        },
        {
          bandId: 1,
          id: 42,
          publicId: eventPublicId(42),
          name: "Someone else's private event",
          isDeleted: true,
          createdByUserId: 999,
          visiblePermissionId: null,
          visiblePermission: null,
        },
        {
          bandId: 1,
          id: 43,
          publicId: eventPublicId(43),
          name: "Own private event",
          isDeleted: true,
          createdByUserId: recoveryAdmin.id,
          visiblePermissionId: null,
          visiblePermission: null,
        },
      ],
    })
    const { ctx } = createAuthorizationPersona("bandAdmin", {
      id: recoveryAdmin.id,
      permissions,
    })

    const result = await invokeResolver(db3PaginatedQuery, {
      bandPublicId: authorizationBandId,
      ...forgeDb3Query("Event", authorizationBandId),
      includeDeleted: true,
      skip: 0,
      take: 50,
    }, ctx)

    expect(result.count).toBe(2)
    expect(result.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ publicId: eventPublicId(41) }),
      expect.objectContaining({ publicId: eventPublicId(43) }),
    ]))
    expect(JSON.stringify(result)).not.toContain("Someone else's private event")
  })

  it("rejects includeDeleted before querying when recovery permission is absent", async () => {
    const permissions = [Permission.login, Permission.view_events, Permission.manage_events]
    const ordinaryManager = createAuthorizationTestUser("moderator", { id: 44, permissions })
    resetAuthorizationDatabase({ user: [ordinaryManager], event: [] })
    const { ctx } = createAuthorizationPersona("moderator", {
      id: ordinaryManager.id,
      permissions,
    })
    const eventDelegate = authorizationTestDb.getDelegate("event")
    const findMany = vi.spyOn(eventDelegate, "findMany")
    const count = vi.spyOn(eventDelegate, "count")

    await expect(invokeResolver(db3PaginatedQuery, {
      bandPublicId: authorizationBandId,
      ...forgeDb3Query("Event", authorizationBandId),
      includeDeleted: true,
      skip: 0,
      take: 50,
    }, ctx)).rejects.toThrow("Not authorized to perform this query.")

    expect(findMany).not.toHaveBeenCalled()
    expect(count).not.toHaveBeenCalled()
  })
})

describe("Band Admin soft-delete recovery", () => {
  const recoveryPermissions = [
    Permission.login,
    Permission.view_songs,
    Permission.manage_songs,
    Permission.recover_songs,
    Permission.visibility_public,
  ]
  const recoveryAdmin = createAuthorizationTestUser("bandAdmin", {
    id: 50,
    permissions: recoveryPermissions,
  })
  const publicVisibilityId = authorizationPermissionId(Permission.visibility_public)
  const deletedPublicSong = {
    bandId: 1,
    id: 51,
    publicId: songPublicId(51),
    name: "Deleted public song",
    aliases: "",
    description: "",
    isDeleted: true,
    createdByUserId: 999,
    visiblePermissionId: publicVisibilityId,
    visiblePermission: { id: publicVisibilityId, name: Permission.visibility_public },
  }
  const deletedPrivateSong = {
    ...deletedPublicSong,
    id: 52,
    publicId: songPublicId(52),
    name: "Deleted private song",
    visiblePermissionId: null,
    visiblePermission: null,
  }

  beforeEach(() => {
    resetAuthorizationDatabase({
      user: [recoveryAdmin],
      song: [deletedPublicSong, deletedPrivateSong],
      change: [],
    })
    vi.restoreAllMocks()
  })

  it("restores an otherwise-visible row with the domain recovery permission", async () => {
    const { ctx } = createAuthorizationPersona("bandAdmin", {
      id: recoveryAdmin.id,
      permissions: recoveryPermissions,
    })

    await invokeResolver(
      db3Mutation,
      forgeDb3PublicUpdate("Song", authorizationBandId, deletedPublicSong.publicId, { isDeleted: false }),
      ctx,
    )

    expect(authorizationTestDb.snapshot("song")).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: deletedPublicSong.id, isDeleted: false }),
    ]))
  })

  it("does not let recovery authority cross another owner's private boundary", async () => {
    const { ctx } = createAuthorizationPersona("bandAdmin", {
      id: recoveryAdmin.id,
      permissions: recoveryPermissions,
    })
    const update = vi.spyOn(authorizationTestDb.getDelegate("song"), "update")

    await expect(invokeResolver(
      db3Mutation,
      forgeDb3PublicUpdate("Song", authorizationBandId, deletedPrivateSong.publicId, { isDeleted: false }),
      ctx,
    )).rejects.toThrow("Song was not found.")

    expect(update).not.toHaveBeenCalled()
  })

  it("does not treat ordinary song management as recovery authority", async () => {
    const permissions = recoveryPermissions.filter(permission => permission !== Permission.recover_songs)
    const manager = createAuthorizationTestUser("moderator", { id: 53, permissions })
    resetAuthorizationDatabase({ user: [manager], song: [deletedPublicSong], change: [] })
    const { ctx } = createAuthorizationPersona("moderator", { id: manager.id, permissions })
    const update = vi.spyOn(authorizationTestDb.getDelegate("song"), "update")

    await expect(invokeResolver(
      db3Mutation,
      forgeDb3PublicUpdate("Song", authorizationBandId, deletedPublicSong.publicId, { isDeleted: false }),
      ctx,
    )).rejects.toThrow("Song was not found.")

    expect(update).not.toHaveBeenCalled()
  })
})

describe("BA-A003 generic DB3 mutation authorization", () => {
  const sysadmin = createAuthorizationTestUser("sysadmin", { id: 1 })
  const moderator = createAuthorizationTestUser("moderator", { id: 2 })
  const bandAdmin = createAuthorizationTestUser("bandAdmin", { id: 3 })
  const target = createAuthorizationTestUser("normal", {
    id: 10,
    name: "Before mutation",
    isSysAdmin: false,
  })

  beforeEach(() => {
    resetAuthorizationDatabase({
      user: [sysadmin, moderator, bandAdmin, target],
      change: [],
    })
    vi.restoreAllMocks()
  })

  it("atomically rejects a mixed allowed and forbidden update", async () => {
    const userDelegate = authorizationTestDb.getDelegate("user")
    const update = vi.spyOn(userDelegate, "update")
    const { ctx } = createAuthorizationPersona("bandAdmin", { id: bandAdmin.id })

    await expect(
      invokeResolver(
        db3Mutation,
        forgeDb3Update("User", null, bandAdmin.id, {
          name: "Must not be persisted",
          isSysAdmin: true,
        }),
        ctx,
      ),
    ).rejects.toThrow("Not authorized to mutate User fields: isSysAdmin")

    expect(update).not.toHaveBeenCalled()
    expect(authorizationTestDb.snapshot("user")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: target.id,
          name: "Before mutation",
          isSysAdmin: false,
        }),
      ]),
    )
    expect(authorizationTestDb.snapshot("change")).toEqual([])
  })

  it.each(["limited", "normal", "editor", "moderator", "bandAdmin"] as const)(
    "rejects an isSysAdmin update from a %s actor",
    async (persona) => {
      const actor = createAuthorizationTestUser(persona, { id: 20 })
      resetAuthorizationDatabase({ user: [actor, target], change: [] })
      const update = vi.spyOn(authorizationTestDb.getDelegate("user"), "update")
      const { ctx } = createAuthorizationPersona(persona, { id: actor.id })

      await expect(
        invokeResolver(
          db3Mutation,
          forgeDb3Update("User", null, actor.id, { isSysAdmin: true }),
          ctx,
        ),
      ).rejects.toThrow("Not authorized to mutate User fields")

      expect(update).not.toHaveBeenCalled()
      expect(authorizationTestDb.snapshot("user")).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: target.id, isSysAdmin: false }),
        ]),
      )
    },
  )

  it("rejects a protected field on insert before Prisma create", async () => {
    const userDelegate = authorizationTestDb.getDelegate("user")
    const create = vi.spyOn(userDelegate, "create")
    const { ctx } = createAuthorizationPersona("bandAdmin", { id: bandAdmin.id })

    await expect(
      invokeResolver(
        db3Mutation,
        forgeDb3Insert("User", null, {
          name: "Crafted sysadmin",
          email: "crafted@test.invalid",
          isSysAdmin: true,
        }),
        ctx,
      ),
    ).rejects.toThrow("Not authorized to mutate User fields")

    expect(create).not.toHaveBeenCalled()
    expect(authorizationTestDb.snapshot("change")).toEqual([])
  })

  it("enforces table authorization before insert", async () => {
    const create = vi.spyOn(authorizationTestDb.getDelegate("user"), "create")
    const limited = createAuthorizationTestUser("limited", { id: 20 })
    resetAuthorizationDatabase({ user: [limited, target], change: [] })
    const { ctx } = createAuthorizationPersona("limited", { id: limited.id })

    await expect(
      invokeResolver(
        db3Mutation,
        forgeDb3Insert("User", null, {
          name: "Unauthorized insert",
          email: "unauthorized@test.invalid",
        }),
        ctx,
      ),
    ).rejects.toThrow("Not authorized to mutate User fields")

    expect(create).not.toHaveBeenCalled()
    expect(authorizationTestDb.snapshot("change")).toEqual([])
  })

  it("allows a Sysadmin maintenance insert from the sanitized model", async () => {
    const { ctx } = createAuthorizationPersona("sysadmin", { id: sysadmin.id })

    const result = await invokeResolver(
      db3Mutation,
      forgeDb3Insert("PlatformUser", null, {
        name: "Authorized insert",
        email: "authorized@test.invalid",
      }, { tableName: "User" }),
      ctx,
    )

    expect(result).toEqual(expect.objectContaining({
      name: "Authorized insert",
      email: "authorized@test.invalid",
    }))
    expect(authorizationTestDb.snapshot("change")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: "User", action: "insert" }),
      ]),
    )
  })

  it("persists an authorized update from the sanitized model", async () => {
    const { ctx } = createAuthorizationPersona("normal", { id: target.id })

    const result = await invokeResolver(
      db3Mutation,
      forgeDb3Update("User", null, target.id, {
        name: "Authorized mutation",
      }),
      ctx,
    )

    expect(result).toEqual(expect.objectContaining({
      publicId: target.publicId,
      name: "Authorized mutation",
    }))
    expect(authorizationTestDb.snapshot("user")).toContainEqual(expect.objectContaining({ id: target.id, isSysAdmin: false }))
    expect(authorizationTestDb.snapshot("change")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: "User", recordId: target.id, action: "update" }),
      ]),
    )
  })
})

describe("BA-U001 user management boundaries", () => {
  const sysadmin = createAuthorizationTestUser("sysadmin", { id: 1 })
  const bandAdmin = createAuthorizationTestUser("bandAdmin", { id: 2 })
  const moderator = createAuthorizationTestUser("moderator", { id: 3 })
  const ordinaryUser = createAuthorizationTarget("ordinary", { id: 10 })
  const protectedRoleUser = createAuthorizationTarget("protectedRole", { id: 11 })
  const isSysAdminUser = createAuthorizationTarget("isSysAdmin", { id: 12 })

  const ordinaryRole = {
    id: 100,
    publicId: parsePublicId<"Role">("AuthRoleOrd00100"),
    name: "Ordinary role",
    isDeleted: false,
    description: "",
    isRoleForNewUsers: false,
    isPublicRole: false,
    sortOrder: 10,
    color: null,
    significance: null,
    permissions: [],
  }
  const protectedRole = {
    ...ordinaryRole,
    id: 101,
    publicId: parsePublicId<"Role">("AuthRolePro00101"),
    name: "Protected role",
    permissions: [{
      id: 1000,
      roleId: 101,
      permissionId: 1001,
      permission: { id: 1001, name: Permission.sysadmin },
    }],
  }

  beforeEach(() => {
    resetAuthorizationDatabase({
      user: [
        sysadmin,
        bandAdmin,
        moderator,
        ordinaryUser,
        protectedRoleUser,
        isSysAdminUser,
      ],
      role: [ordinaryRole, protectedRole],
      token: [],
      change: [],
    })
    vi.restoreAllMocks()
  })

  it("denies shared-account deactivation from a public band grant", () => {
    expect(canManageUser({
      actor: {
        principal: null,
        auth: testServerAuthorization(null, new ServerPermissionSet([{ id: 1, name: Permission.deactivate_users }])),
      },
      target: asUserManagementTarget(ordinaryUser),
      action: "deactivate",
    })).toBe(false)
  })

  it("does not let generic user creation assign any role", async () => {
    const { ctx } = createAuthorizationPersona("bandAdmin", { id: bandAdmin.id })
    const create = vi.spyOn(authorizationTestDb.getDelegate("user"), "create")

    await expect(
      invokeResolver(
        db3Mutation,
        forgeDb3Insert("User", null, {
          name: "Forbidden protected user",
          email: "protected@test.invalid",
          roleId: protectedRole.publicId,
        }),
        ctx,
      ),
    ).rejects.toThrow("unknown mutation field 'roleId' on table 'User'")

    expect(create).not.toHaveBeenCalled()
  })

  it.each([
    ["an ordinary user", ordinaryUser],
    ["a protected-role user", protectedRoleUser],
    ["an isSysAdmin user", isSysAdminUser],
  ])("does not let Band Admin generate a reset URL for %s", async (_description, target) => {
    const { ctx } = createAuthorizationPersona("bandAdmin", { id: bandAdmin.id })
    const tokenDelete = vi.spyOn(authorizationTestDb.getDelegate("token"), "deleteMany")
    const tokenCreate = vi.spyOn(authorizationTestDb.getDelegate("token"), "create")

    await expect(
      invokeResolver(forgotPassword, { userId: target.publicId }, ctx),
    ).rejects.toThrow("Unauthorized test persona; required: sysadmin")

    expect(tokenDelete).not.toHaveBeenCalled()
    expect(tokenCreate).not.toHaveBeenCalled()
  })

  it("does not let Band Admin invoke impersonation", async () => {
    const { ctx } = createAuthorizationPersona("bandAdmin", { id: bandAdmin.id })

    expect(canManageUser({
      actor: asUserManagementActor(bandAdmin),
      target: asUserManagementTarget(isSysAdminUser),
      action: "impersonate",
    })).toBe(false)
    await expect(
      invokeResolver(impersonateUser, { userId: isSysAdminUser.publicId }, ctx),
    ).rejects.toThrow("Not authorized for impersonate_user.")
  })

  it.each([
    ["a protected-role user", protectedRoleUser],
    ["an isSysAdmin user", isSysAdminUser],
  ])("lets Sysadmin impersonate %s when the dedicated grant is present", async (_description, target) => {
    const { ctx } = createAuthorizationPersona("sysadmin", { id: sysadmin.id })

    await expect(
      invokeResolver(impersonateUser, { userId: target.publicId }, ctx),
    ).resolves.toEqual({ userId: target.publicId })
  })

  it("does not give Moderator role-assignment authority", async () => {
    const { ctx } = createAuthorizationPersona("moderator", { id: moderator.id })
    const update = vi.spyOn(authorizationTestDb.getDelegate("user"), "update")

    expect(canManageUser({
      actor: asUserManagementActor(moderator),
      target: asUserManagementTarget(ordinaryUser),
      action: "assignRole",
      desiredRole: makePermissionSetFromRole(ordinaryRole),
    })).toBe(false)
    await expect(
      invokeResolver(
        db3Mutation,
        forgeDb3Update("User", null, ordinaryUser.id, {
          roleId: ordinaryRole.publicId,
        }),
        ctx,
      ),
    ).rejects.toThrow("unknown mutation field")
    await expect(
      invokeResolver(
        db3Mutation,
        forgeDb3Update("User", null, protectedRoleUser.id, {
          name: "Forbidden protected edit",
        }),
        ctx,
      ),
    ).rejects.toThrow("User was not found")

    expect(update).not.toHaveBeenCalled()
  })
})

describe("BA-U002 delegated user administration", () => {
  const sysadmin = createAuthorizationTestUser("sysadmin", { id: 1 })
  const bandAdmin = createAuthorizationTestUser("bandAdmin", { id: 2 })
  const ordinaryUser = createAuthorizationTarget("ordinary", { id: 10 })

  const makeRole = (id: number, name: string, permissions: string[]) => ({
    id,
    publicId: parsePublicId<"Role">(`AuthRole${id.toString().padStart(8, "0")}`),
    name,
    isDeleted: false,
    description: `${name} description`,
    isRoleForNewUsers: false,
    isPublicRole: false,
    sortOrder: id,
    color: null,
    significance: null,
    permissions: permissions.map((permission, index) => ({
      id: id * 100 + index,
      roleId: id,
      permissionId: id * 1000 + index,
      permission: {
        id: id * 1000 + index,
        name: permission,
        isDeleted: false,
      },
    })),
  })

  const peerRole = makeRole(100, "Peer role", [
    Permission.login,
    Permission.view_users_basic_info,
    Permission.visibility_editors,
    Permission.manage_users,
    Permission.manage_user_taxonomy,
    Permission.deactivate_users,
    Permission.assign_user_roles,
  ])
  const ordinaryRole = makeRole(101, "Ordinary role", [
    Permission.login,
  ])
  const unheldRole = makeRole(102, "Unheld role", [Permission.manage_events])
  const protectedRole = makeRole(103, "Protected role", [Permission.sysadmin])
  const unknownRole = makeRole(104, "Unknown role", ["unknown_permission"])

  beforeEach(() => {
    resetAuthorizationDatabase({
      user: [sysadmin, bandAdmin, ordinaryUser],
      role: [peerRole, ordinaryRole, unheldRole, protectedRole, unknownRole],
      session: [],
      change: [],
    })
    vi.restoreAllMocks()
  })

  it("uses permission composition rather than role identity or rank", () => {
    const actor = asUserManagementActor(bandAdmin)
    expect(isRoleWithinDelegationEnvelope(actor, makePermissionSetFromRole(peerRole))).toBe(true)
    expect(isRoleWithinDelegationEnvelope(actor, makePermissionSetFromRole(ordinaryRole))).toBe(true)
    expect(isRoleWithinDelegationEnvelope(actor, makePermissionSetFromRole(unheldRole))).toBe(false)
    expect(isRoleWithinDelegationEnvelope(actor, makePermissionSetFromRole(protectedRole))).toBe(false)
    expect(isRoleWithinDelegationEnvelope(actor, makePermissionSetFromRole(unknownRole))).toBe(false)

    const targetOutsideEnvelope = {
      ...ordinaryUser,
      role: unheldRole,
      roleId: unheldRole.id,
    }
    expect(canManageUser({
      actor,
      target: asUserManagementTarget(targetOutsideEnvelope),
      action: "assignRole",
      desiredRole: makePermissionSetFromRole(ordinaryRole),
    })).toBe(false)
  })

  it("does not warn when another active non-Sysadmin retains continuity permissions", async () => {
    const peer = { ...bandAdmin, id: 12, email: "peer@test.invalid" }
    const warnings = getContinuityWarningsForUserResult(
      asUserManagementTarget(bandAdmin),
      makePermissionSetFromRole(ordinaryRole),
      [bandAdmin, peer].map(asUserManagementTarget),
    )
    expect(warnings).toEqual([])
  })

  it("revokes shared-account sessions with platform deactivation authority", async () => {
    resetAuthorizationDatabase({
      user: [sysadmin, ordinaryUser],
      session: [{ id: 1, userId: ordinaryUser.id }], change: []
    })
    await invokeResolver(deactivateUser, { userId: ordinaryUser.publicId, acknowledgeContinuityRisk: false },
      createAuthorizationPersona("sysadmin", { id: sysadmin.id }).ctx)
    expect(authorizationTestDb.snapshot("user")).toContainEqual(expect.objectContaining({ id: ordinaryUser.id, isDeleted: true }))
    expect(authorizationTestDb.snapshot("session")).toEqual([])
  })

  it("reserves the dedicated isSysAdmin mutation for a Sysadmin", async () => {
    const sessions = [{ id: 1, userId: ordinaryUser.id }, { id: 2, userId: sysadmin.id }]
    authorizationTestDb.getDelegate("session").reset(sessions)
    const update = vi.spyOn(authorizationTestDb.getDelegate("user"), "update")
    const { ctx: bandAdminCtx } = createAuthorizationPersona("bandAdmin", { id: bandAdmin.id })
    const { ctx: sysadminCtx } = createAuthorizationPersona("sysadmin", { id: sysadmin.id })

    await expect(invokeResolver(setUserSysAdmin, {
      userId: ordinaryUser.publicId,
      isSysAdmin: true,
    }, bandAdminCtx)).rejects.toThrow("Not authorized to setSysAdmin this user")
    expect(update).not.toHaveBeenCalled()

    await invokeResolver(setUserSysAdmin, {
      userId: ordinaryUser.publicId,
      isSysAdmin: true,
    }, sysadminCtx)
    expect(authorizationTestDb.snapshot("user")).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: ordinaryUser.id, isSysAdmin: true }),
    ]))
    expect(authorizationTestDb.snapshot("session")).toEqual(sessions)
  })

  it("allows the Sysadmin maintenance grid to create an unprivileged user", async () => {
    const { ctx } = createAuthorizationPersona("sysadmin", { id: sysadmin.id })
    const create = vi.spyOn(authorizationTestDb.getDelegate("user"), "create")

    const result = await invokeResolver(
      db3Mutation,
      forgeDb3Insert("PlatformUser", null, {
        name: "New unprivileged user",
        email: "new-user@test.invalid",
      }, { tableName: "User" }),
      ctx,
    )

    expect(result).toEqual(expect.objectContaining({
      name: "New unprivileged user",
      email: "new-user@test.invalid",
    }))
    expect(create).toHaveBeenCalledWith({
      data: {
        name: "New unprivileged user",
        email: "new-user@test.invalid",
        publicId: expect.any(String),
      },
    })
  })

  it("keeps visibility metadata writes behind the table's sysadmin grant", async () => {
    const ordinaryUser = createAuthorizationTestUser("normal", {
      id: 20,
      isSysAdmin: false,
      permissions: [Permission.login, Permission.manage_users],
    })
    const visibilityPermission = {
      id: 300,
      publicId: parsePublicId<"Permission">("AuthPerm00000300"),
      name: Permission.visibility_members,
      description: "Members",
      isVisibility: true,
      sortOrder: 1,
      significance: null,
      color: null,
      iconName: null,
    }
    resetAuthorizationDatabase({
      user: [ordinaryUser],
      permission: [visibilityPermission],
    })
    const update = vi.spyOn(authorizationTestDb.getDelegate("permission"), "update")
    const { ctx } = createAuthorizationPersona("normal", {
      id: ordinaryUser.id,
      permissions: [Permission.login, Permission.manage_users],
    })

    await expect(invokeResolver(
      db3Mutation,
      forgeDb3PublicUpdate("Permission", null, visibilityPermission.publicId, {
        description: "Forged",
      }, { tableName: "Permission" }),
      ctx,
    )).rejects.toThrow("Not authorized to mutate Permission fields")
    expect(update).not.toHaveBeenCalled()
  })
})

describe("BA-U003 password-reset hardening", () => {
  const sysadmin = createAuthorizationTestUser("sysadmin", { id: 1 })
  const bandAdmin = createAuthorizationTestUser("bandAdmin", { id: 2 })
  const target = {
    ...createAuthorizationTarget("ordinary", { id: 10 }),
    hashedPassword: "previous-password-hash",
    calendarFeedToken: "existing-calendar-feed-token",
  }

  beforeEach(() => {
    resetAuthorizationDatabase({
      user: [sysadmin, bandAdmin, target],
      token: [],
      session: [],
      change: [],
    })
    vi.restoreAllMocks()
  })

  it("rejects Band Admin before target lookup or token generation", async () => {
    const userFind = vi.spyOn(authorizationTestDb.getDelegate("user"), "findFirst")
    const tokenCreate = vi.spyOn(authorizationTestDb.getDelegate("token"), "create")
    const { ctx } = createAuthorizationPersona("bandAdmin", { id: bandAdmin.id })

    await expect(invokeResolver(
      forgotPassword,
      { email: "unknown-user@test.invalid" },
      ctx,
    )).rejects.toThrow("Unauthorized test persona; required: sysadmin")

    expect(userFind).not.toHaveBeenCalled()
    expect(tokenCreate).not.toHaveBeenCalled()
  })

  it("records password completion without credentials in the activity log", async () => {
    const rawToken = "single-use-reset-token"
    const newPassword = "new-password-value"
    resetAuthorizationDatabase({
      user: [target],
      token: [{
        id: 1,
        hashedToken: hash256(rawToken),
        type: "RESET_PASSWORD",
        expiresAt: new Date("2099-01-01T00:00:00.000Z"),
        sentTo: target.email,
        userId: target.id,
      }],
      session: [{ id: 1, userId: target.id }],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("public")

    await invokeResolver(resetPassword, {
      token: rawToken,
      password: newPassword,
      passwordConfirmation: newPassword,
    }, ctx)

    const changes = authorizationTestDb.snapshot("change")
    expect(changes).toHaveLength(1)
    expect(changes[0]).toEqual(expect.objectContaining({
      table: "User",
      context: "resetPasswordMutation",
      oldValues: "{}",
      newValues: JSON.stringify({ passwordReset: true }),
    }))

    const serializedAudit = JSON.stringify(changes)
    expect(serializedAudit).not.toContain(rawToken)
    expect(serializedAudit).not.toContain(newPassword)
    expect(serializedAudit).not.toContain(target.hashedPassword)
    expect(serializedAudit).not.toContain(target.calendarFeedToken)
    expect(authorizationTestDb.snapshot("token")).toEqual([])
    expect(authorizationTestDb.snapshot("session")).toEqual([])
  })
})

describe("BA-U004 impersonation hardening", () => {
  const sysadmin = createAuthorizationTestUser("sysadmin", { id: 1 })
  const target = createAuthorizationTarget("ordinary", {
    id: 10,
    calendarFeedToken: "target-calendar-feed-token-must-not-be-returned",
  })

  beforeEach(() => {
    resetAuthorizationDatabase({
      user: [sysadmin, target],
      change: [],
    })
    vi.restoreAllMocks()
  })

  it("starts an ordinary-user session and audits the original Sysadmin actor", async () => {
    const { ctx } = createAuthorizationPersona("sysadmin", { id: sysadmin.id })
    const createSession = vi.spyOn(ctx.session, "$create")

    const result = await invokeResolver(impersonateUser, { userId: target.publicId }, ctx)

    expect(result).toEqual({ userId: target.publicId })
    expect(createSession).toHaveBeenCalledTimes(1)
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({
      userId: target.id,
      impersonatingFromUserId: sysadmin.id,
      isSysAdmin: false,
    }))

    const changes = authorizationTestDb.snapshot("change")
    expect(changes).toHaveLength(1)
    expect(changes[0]).toEqual(expect.objectContaining({
      table: "User",
      recordId: target.id,
      action: "update",
      context: "impersonateUserMutation",
      userId: sysadmin.id,
      oldValues: JSON.stringify({ impersonatedByUserId: null }),
      newValues: JSON.stringify({ impersonatedByUserId: sysadmin.id }),
    }))
    expect(JSON.stringify({ result, changes })).not.toContain(target.calendarFeedToken)
  })

  it("accepts a freshly verified role-carried impersonation grant", async () => {
    const roleGrantedImpersonator = createAuthorizationTestUser("normal", {
      id: 20,
      isSysAdmin: false,
      permissions: [Permission.login, Permission.impersonate_user],
    })
    resetAuthorizationDatabase({ user: [roleGrantedImpersonator, target], change: [] })
    const userFind = vi.spyOn(authorizationTestDb.getDelegate("user"), "findFirst")
    const { ctx } = createAuthorizationPersona("normal", {
      id: roleGrantedImpersonator.id,
      isSysAdmin: false,
      permissions: [Permission.login, Permission.impersonate_user],
    })
    const createSession = vi.spyOn(ctx.session, "$create")

    await expect(
      invokeResolver(impersonateUser, { userId: target.publicId }, ctx),
    ).resolves.toEqual({ userId: target.publicId })

    expect(userFind).toHaveBeenCalled()
    expect(createSession).toHaveBeenCalled()
    expect(authorizationTestDb.snapshot("change")).not.toEqual([])
  })

  it.each([
    Permission.sysadmin,
    Permission.impersonate_user,
    Permission.never_grant,
  ])("allows a target whose role carries protected permission %s", async (permission) => {
    const protectedTarget = createAuthorizationTestUser("normal", {
      id: 30,
      permissions: [Permission.login, permission],
    })
    resetAuthorizationDatabase({ user: protectedTarget.id === sysadmin.id ? [sysadmin] : [sysadmin, protectedTarget], change: [] })
    const { ctx } = createAuthorizationPersona("sysadmin", { id: sysadmin.id })
    const createSession = vi.spyOn(ctx.session, "$create")

    await expect(
      invokeResolver(impersonateUser, { userId: protectedTarget.publicId }, ctx),
    ).resolves.toEqual({ userId: protectedTarget.publicId })

    expect(createSession).toHaveBeenCalledTimes(1)
    expect(authorizationTestDb.snapshot("change")).not.toEqual([])
  })

  it.each([
    ["the current actor", sysadmin],
    ["a deleted user", createAuthorizationTarget("ordinary", { id: 41, isDeleted: true })],
  ])("rejects %s as an impersonation target", async (_description, protectedTarget) => {
    resetAuthorizationDatabase({ user: protectedTarget.id === sysadmin.id ? [sysadmin] : [sysadmin, protectedTarget], change: [] })
    const { ctx } = createAuthorizationPersona("sysadmin", { id: sysadmin.id })
    const createSession = vi.spyOn(ctx.session, "$create")

    await expect(
      invokeResolver(impersonateUser, { userId: protectedTarget.publicId }, ctx),
    ).rejects.toThrow("Not authorized to impersonate this user")

    expect(createSession).not.toHaveBeenCalled()
    expect(authorizationTestDb.snapshot("change")).toEqual([])
  })

  it("restores the original actor and attributes the stop event to that actor", async () => {
    const originalActor = {
      ...sysadmin,
      calendarFeedToken: "original-actor-calendar-feed-token-must-not-be-returned",
    }
    resetAuthorizationDatabase({ user: [originalActor, target], change: [] })
    const { ctx } = createAuthorizationPersona("normal", { id: target.id })
    ctx.session.$publicData.impersonatingFromUserId = originalActor.id
    const createSession = vi.spyOn(ctx.session, "$create")

    const result = await invokeResolver(stopImpersonating, undefined, ctx)

    expect(result).toEqual({ userId: originalActor.id })
    expect(createSession).toHaveBeenCalledTimes(1)
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({
      userId: originalActor.id,
      impersonatingFromUserId: undefined,
      isSysAdmin: true,
    }))

    const changes = authorizationTestDb.snapshot("change")
    expect(changes).toHaveLength(1)
    expect(changes[0]).toEqual(expect.objectContaining({
      table: "User",
      recordId: target.id,
      action: "update",
      context: "stopImpersonatingMutation",
      userId: originalActor.id,
      oldValues: JSON.stringify({ impersonatedByUserId: originalActor.id }),
      newValues: JSON.stringify({ impersonatedByUserId: null }),
    }))
    expect(JSON.stringify({ result, changes })).not.toContain(originalActor.calendarFeedToken)
  })

  it("does not create a session or audit event when no impersonation is active", async () => {
    const { ctx } = createAuthorizationPersona("normal", { id: target.id })
    const createSession = vi.spyOn(ctx.session, "$create")

    await expect(
      invokeResolver(stopImpersonating, undefined, ctx),
    ).rejects.toThrow("Not impersonating anyone")

    expect(createSession).not.toHaveBeenCalled()
    expect(authorizationTestDb.snapshot("change")).toEqual([])
  })
})

describe("BA-A004 membership association authorization", () => {
  const normal = createAuthorizationTestUser("normal", { id: 3 })
  const otherUser = createAuthorizationTestUser("normal", { id: 4 })
  const instrument = {
    id: 500, bandId: 1, publicId: "AbCdEfGhIjKlMn50", isHidden: false,
    globalInstrumentId: null, functionalGroupId: 1
  }
  const membershipId = (id: number) => "Member" + String(id).padStart(10, "0")
  const replace = (id: number, instrumentIds: string[]) => invokeResolver(executeCommand, {
    bandPublicId: authorizationBandId, commandID: db3.bandUserInstrumentsCommand.commandID,
    payload: { kind: "replace", membershipId: membershipId(id), instrumentIds },
  }, createAuthorizationPersona("normal", { id: normal.id }).ctx)

  beforeEach(() => {
    vi.restoreAllMocks()
    resetAuthorizationDatabase({
      user: [normal, otherUser], bandInstrument: [instrument],
      bandInstrumentFunctionalGroup: [{ id: 1, bandId: 1, publicId: "AssocGroup000001", isHidden: false, globalFunctionalGroupId: null }],
      bandUserInstrument: [], change: []
    })
  })

  it("rejects an association-only update outside the caller's membership", async () => {
    const create = vi.spyOn(authorizationTestDb.getDelegate("bandUserInstrument"), "create")
    await expect(replace(otherUser.id, [instrument.publicId])).rejects.toThrow()
    expect(create).not.toHaveBeenCalled()
    expect(authorizationTestDb.snapshot("bandUserInstrument")).toEqual([])
    expect(authorizationTestDb.snapshot("change")).toEqual([])
  })

  it("awaits authorized association insertions and removals", async () => {
    await replace(normal.id, [instrument.publicId])
    expect(authorizationTestDb.snapshot("bandUserInstrument")).toEqual([
      expect.objectContaining({ bandUserId: normal.id, bandInstrumentId: instrument.id }),
    ])
    await replace(normal.id, [])
    expect(authorizationTestDb.snapshot("bandUserInstrument")).toEqual([])
    expect(authorizationTestDb.snapshot("change")).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: db3.xBandUserInstrument.tableName, action: "insert" }),
      expect.objectContaining({ table: db3.xBandUserInstrument.tableName, action: "delete" }),
    ]))
  })

  it("rejects person-level assignments on account creation without creating a membership", async () => {
    const sysadmin = createAuthorizationTestUser("sysadmin", { id: 20 })
    resetAuthorizationDatabase({ user: [sysadmin], change: [] })
    const create = vi.spyOn(authorizationTestDb.getDelegate("user"), "create")
    const before = authorizationTestDb.snapshot("bandUser")
    await expect(invokeResolver(db3Mutation, forgeDb3Insert("PlatformUser", null, {
      name: "Forged account", email: "instrument@test.invalid", instruments: [instrument.publicId],
    }, { tableName: "User" }), createAuthorizationPersona("sysadmin", { id: sysadmin.id }).ctx)).rejects.toThrow("instruments")
    expect(create).not.toHaveBeenCalled()
    expect(authorizationTestDb.snapshot("bandUser")).toEqual(before)
    expect(authorizationTestDb.snapshot("change")).toEqual([])
  })
})

describe("BA-A005 delete authorization", () => {
  const sysadmin = createAuthorizationTestUser("sysadmin", { id: 1 })
  const bandAdmin = createAuthorizationTestUser("bandAdmin", { id: 2 })
  const limited = createAuthorizationTestUser("limited", { id: 3 })
  const ordinaryUser = createAuthorizationTarget("ordinary", { id: 10 })
  const protectedRoleUser = createAuthorizationTarget("protectedRole", { id: 11 })
  const isSysAdminUser = createAuthorizationTarget("isSysAdmin", { id: 12 })
  const eventAdmin = createAuthorizationTestUser("bandAdmin", {
    id: 4,
    permissions: [
      Permission.login,
      Permission.manage_events,
      Permission.admin_events,
    ],
  })

  const eventTag = {
    id: 100,
    publicId: parsePublicId<"EventTag">("AuthEventTag0001"),
    text: "Delete test tag",
    description: "",
    color: null,
    significance: null,
    sortOrder: 0,
    visibleOnFrontpage: false,
  }
  const eventType = {
    id: 101,
    publicId: parsePublicId<"EventType">("AuthEventType004"),
    text: "Delete test type",
    description: "",
    color: null,
    significance: null,
    sortOrder: 0,
    iconName: null,
    isDeleted: false,
  }

  beforeEach(() => {
    resetAuthorizationDatabase({
      user: [
        sysadmin,
        bandAdmin,
        limited,
        eventAdmin,
        ordinaryUser,
        protectedRoleUser,
        isSysAdminUser,
      ],
      eventTag: [eventTag],
      eventType: [eventType],
      change: [],
    })
    vi.restoreAllMocks()
  })

  it("has an explicit delete policy for every registered DB3 table", () => {
    const registeredTables = [...new Set(Object.values(db3.gAllTables))]

    expect(registeredTables.filter((table) => !table.deletePolicy).map((table) => table.tableID)).toEqual([])
    expect(
      registeredTables
        .filter((table) => table.deletePolicy === "softOnly")
        .filter((table) => !table.SqlSpecialColumns.isDeleted)
        .map((table) => table.tableID),
    ).toEqual([])
    expect(
      registeredTables
        .filter((table) => table.deletePolicy === "hard")
        .filter((table) => !!table.SqlSpecialColumns.isDeleted)
        .map((table) => table.tableID),
    ).toEqual([])
  })

  it.each([
    ["soft", "EventType", eventType.publicId, "softWhenPossible"],
    ["hard", "BandEventTag", eventTag.publicId, "hard"],
  ] as const)("does not let login alone perform a %s delete", async (_kind, tableName, publicId, deleteType) => {
    const { ctx } = createAuthorizationPersona("limited", { id: limited.id })
    const table = db3.GetTableById(tableName)
    const delegate = authorizationTestDb.getDelegate(table.tableName)
    const update = vi.spyOn(delegate, "update")
    const deleteMany = vi.spyOn(delegate, "deleteMany")

    await expect(
      invokeResolver(db3Mutation, forgeDb3PublicDelete(tableName, authorizationBandId, publicId, deleteType, { tableName: table.tableName }), ctx),
    ).rejects.toThrow(`Not authorized to mutate ${table.tableName} fields`)

    expect(update).not.toHaveBeenCalled()
    expect(deleteMany).not.toHaveBeenCalled()
  })

  it("soft-deletes a soft-delete table for an authorized actor", async () => {
    const { ctx } = createAuthorizationPersona("sysadmin", { id: sysadmin.id })

    await invokeResolver(
      db3Mutation,
      forgeDb3PublicDelete("EventType", null, eventType.publicId, "softWhenPossible"),
      ctx,
    )

    expect(authorizationTestDb.snapshot("eventType")).toEqual([
      expect.objectContaining({ id: eventType.id, isDeleted: true }),
    ])
  })

  it("rejects hard deletion when a table supports soft deletion", async () => {
    const { ctx } = createAuthorizationPersona("sysadmin", { id: sysadmin.id })
    const delegate = authorizationTestDb.getDelegate("eventType")
    const update = vi.spyOn(delegate, "update")
    const deleteMany = vi.spyOn(delegate, "deleteMany")

    await expect(
      invokeResolver(db3Mutation, forgeDb3PublicDelete("EventType", authorizationBandId, eventType.publicId, "hard"), ctx),
    ).rejects.toThrow("Not authorized to mutate EventType fields")

    expect(update).not.toHaveBeenCalled()
    expect(deleteMany).not.toHaveBeenCalled()
    expect(authorizationTestDb.snapshot("eventType")).toEqual([eventType])
  })

  it("hard-deletes an allowlisted band domain table for an authorized actor", async () => {
    const manager = createAuthorizationTestUser("normal", { id: 40, permissions: [Permission.login, Permission.view_custom_links, Permission.manage_custom_links] })
    const link = {
      id: 100, publicId: "AuthDeleteLink01", bandId: 1, fileId: null, name: "Delete link",
      description: "", slug: "delete", destinationURL: "https://example.test", redirectType: "Temporary",
      intermediateMessage: null, forwardQuery: false, createdByUserId: manager.id
    }
    resetAuthorizationDatabase({ user: [manager], customLink: [link], change: [] })
    await invokeResolver(db3Mutation, forgeDb3PublicDelete("CustomLink", authorizationBandId, link.publicId, "hard"),
      createAuthorizationPersona("normal", { id: manager.id, permissions: manager.permissions }).ctx)
    expect(authorizationTestDb.snapshot("customLink")).toEqual([])
    expect(authorizationTestDb.snapshot("change")).toContainEqual(expect.objectContaining({ table: "CustomLink", recordId: link.id, action: "delete" }))
  })

  it("authorizes association removal against the persisted membership", async () => {
    const normal = createAuthorizationTestUser("normal", { id: 20 })
    const otherUser = createAuthorizationTestUser("normal", { id: 21 })
    const own = { id: 300, publicId: "AuthUsrInstr0001", bandUserId: normal.id, bandInstrumentId: 500, isPrimary: true }
    const other = { id: 301, publicId: "AuthUsrInstr0002", bandUserId: otherUser.id, bandInstrumentId: 500, isPrimary: true }
    resetAuthorizationDatabase({
      user: [normal, otherUser], bandUserInstrument: [own, other],
      bandInstrument: [{ id: 500, publicId: "DeleteInstr00001", bandId: 1, isHidden: false, globalInstrumentId: null }], change: []
    })
    const remove = (id: number) => invokeResolver(executeCommand, {
      bandPublicId: authorizationBandId, commandID: db3.bandUserInstrumentsCommand.commandID,
      payload: { kind: "replace", membershipId: "Member" + String(id).padStart(10, "0"), instrumentIds: [] },
    }, createAuthorizationPersona("normal", { id: normal.id }).ctx)
    await expect(remove(otherUser.id)).rejects.toThrow()
    expect(authorizationTestDb.snapshot("bandUserInstrument")).toEqual([own, other])
    await remove(normal.id)
    expect(authorizationTestDb.snapshot("bandUserInstrument")).toEqual([other])
  })

  it("denies Band Admin shared-account deactivation", async () => {
    const before = authorizationTestDb.snapshot("user")
    await expect(invokeResolver(deactivateUser, { userId: ordinaryUser.publicId, acknowledgeContinuityRisk: false },
      createAuthorizationPersona("bandAdmin", { id: bandAdmin.id }).ctx)).rejects.toThrow("manage_global_users")
    expect(authorizationTestDb.snapshot("user")).toEqual(before)
    expect(authorizationTestDb.snapshot("change")).toEqual([])
  })

  it.each([
    ["a user in a protected role", protectedRoleUser],
    ["a user with the isSysAdmin flag", isSysAdminUser],
  ])("denies Band Admin shared-account deactivation of %s", async (_description, target) => {
    const { ctx } = createAuthorizationPersona("bandAdmin", { id: bandAdmin.id })
    const update = vi.spyOn(authorizationTestDb.getDelegate("user"), "update")

    await expect(
      invokeResolver(
        deactivateUser,
        { userId: target.publicId, acknowledgeContinuityRisk: false },
        ctx,
      ),
    ).rejects.toThrow("manage_global_users")

    expect(update).not.toHaveBeenCalled()
    expect(authorizationTestDb.snapshot("user")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: target.id, isDeleted: false }),
      ]),
    )
  })

  it("keeps shared-account hard deletion out of the generic endpoint", async () => {
    const before = authorizationTestDb.snapshot("user")
    const remove = vi.spyOn(authorizationTestDb.getDelegate("user"), "deleteMany")
    await expect(invokeResolver(db3Mutation,
      forgeDb3PublicDelete("PlatformUser", null, ordinaryUser.publicId, "hard", { tableName: "User" }),
      createAuthorizationPersona("sysadmin", { id: sysadmin.id }).ctx,
    )).rejects.toThrow("Not authorized to mutate User fields")
    expect(remove).not.toHaveBeenCalled()
    expect(authorizationTestDb.snapshot("user")).toEqual(before)
  })

  it("cannot trigger GlobalRole or Permission cascades through generic deletion", async () => {
    const assigned = createAuthorizationTestUser("normal", { id: 203 })
    resetAuthorizationDatabase({
      user: [sysadmin, assigned], event: [{
        id: 204, bandId: 1,
        visiblePermissionId: authorizationPermissionId(Permission.visibility_public)
      }], change: []
    })
    const role = { id: 200, publicId: "AuthDeleteRole20", isDeleted: false, isSysAdminRole: false }
    await authorizationTestDb.getDelegate("globalRole").create({ data: role })
    await authorizationTestDb.getDelegate("user").update({ where: { id: assigned.id }, data: { globalRoleId: role.id } })
    await authorizationTestDb.getDelegate("globalRolePermission").create({
      data: {
        id: 202, globalRoleId: role.id, permissionId: authorizationPermissionId(Permission.visibility_public)
      }
    })
    const tables = ["globalRole", "globalRolePermission", "permission", "user", "event"]
    const before = tables.map(table => authorizationTestDb.snapshot(table))
    const permission = authorizationTestDb.snapshot("permission").find(row => row.name === Permission.visibility_public)
    if (typeof permission?.publicId !== "string") {
      throw new Error("Missing public visibility fixture")
    }
    const ctx = createAuthorizationPersona("sysadmin", { id: sysadmin.id }).ctx
    await expect(invokeResolver(db3Mutation, forgeDb3PublicDelete("GlobalRole", null, role.publicId, "hard"), ctx))
      .rejects.toThrow("Not authorized to mutate GlobalRole fields")
    await expect(invokeResolver(db3Mutation, forgeDb3PublicDelete("Permission", null, permission.publicId, "hard"), ctx))
      .rejects.toThrow("Not authorized to mutate Permission fields")
    expect(tables.map(table => authorizationTestDb.snapshot(table))).toEqual(before)
    expect(authorizationTestDb.snapshot("change")).toEqual([])
  })
})
