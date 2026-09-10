import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("db", async () => {
  const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client")
  const { authorizationTestDb } = await import("./support/inMemoryPrisma")
  return {
    ...prisma,
    default: authorizationTestDb,
  }
})

import db3Mutation from "@db3/mutations/db3mutations"
import db3PaginatedQuery from "@db3/queries/db3paginatedQueries"
import db3Query from "@db3/queries/db3queries"
import * as db3 from "@db3/db3"
import {
  validateDB3MutationRequest,
  validateDB3PaginatedQueryRequest,
  validateDB3QueryRequest,
} from "@db3/server/db3RequestValidation"
import { DB3QueryCore2 } from "@db3/server/db3QueryCore"
import type { UserWithRolesPayload } from "@db3/shared/schema/userPayloads"
import { Permission } from "shared/permissions"
import {
  createAuthorizationPersona,
  createAuthorizationTarget,
  createAuthorizationTestUser,
  type AuthorizationPersona,
  type AuthorizationTargetKind,
} from "./support/authorizationFixtures"
import {
  forgeDb3Delete,
  forgeDb3Insert,
  forgeDb3Query,
  forgeDb3Update,
} from "./support/db3RequestBuilders"
import { authorizationTestDb } from "./support/inMemoryPrisma"
import { invokeResolver } from "./support/resolverHarness"

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
    expect(fixture.publicData.permissions).toContain(Permission.visibility_public)
  })

  it("keeps Band Admin distinct from Sysadmin", () => {
    const bandAdmin = createAuthorizationPersona("bandAdmin")

    expect(bandAdmin.publicData.isSysAdmin).toBe(false)
    expect(bandAdmin.publicData.permissions).not.toContain(Permission.sysadmin)
    expect(bandAdmin.publicData.permissions).not.toContain(Permission.impersonate_user)
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
    expect(target.role?.permissions.some((entry) => entry.permission.name === Permission.sysadmin)).toBe(
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
    authorizationTestDb.reset({
      user: [sysadmin, target],
      change: [],
    })
  })

  it("invokes a generic query with a caller-forged request", async () => {
    const { ctx } = createAuthorizationPersona("sysadmin", { id: sysadmin.id })

    const result = await invokeResolver(
      db3Query,
      forgeDb3Query("User"),
      ctx,
    )

    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: sysadmin.id }),
        expect.objectContaining({ id: target.id, name: "Before mutation" }),
      ]),
    )
    expect(authorizationTestDb.snapshot("user")).toHaveLength(2)
  })

  it("invokes a generic mutation and exposes persisted state for assertions", async () => {
    const { ctx } = createAuthorizationPersona("sysadmin", { id: sysadmin.id })

    const result = await invokeResolver(
      db3Mutation,
      forgeDb3Update("User", target.id, {
        id: target.id,
        name: "After mutation",
      }),
      ctx,
    )

    expect(result).toEqual(expect.objectContaining({ id: target.id, name: "After mutation" }))
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
    authorizationTestDb.reset({
      user: [sysadmin, moderator, target],
      change: [],
      eventType: [],
    })
  })

  it("rejects unknown and mismatched table identifiers", () => {
    expect(() => validateDB3QueryRequest(forgeDb3Query("UnknownTable"))).toThrow(
      "unknown table ID 'UnknownTable'",
    )
    expect(() =>
      validateDB3QueryRequest(forgeDb3Query("User", { tableName: "Role" })),
    ).toThrow("table name 'Role' does not match table ID 'User'")
  })

  it("rejects unknown request properties, including caller-provided intention", () => {
    expect(() =>
      validateDB3QueryRequest({
        ...forgeDb3Query("User"),
        clientIntention: { intention: "admin", mode: "primary" },
      }),
    ).toThrow(/Unrecognized key.*clientIntention/)

    expect(() =>
      validateDB3QueryRequest({ ...forgeDb3Query("User"), rawPrismaArgs: {} }),
    ).toThrow(/Unrecognized key.*rawPrismaArgs/)
  })

  it("rejects unsupported query operators and non-scalar filter values", () => {
    expect(() =>
      validateDB3QueryRequest(
        forgeDb3Query("User", {
          filter: { items: [{ field: "name", operator: "contains" as "equals", value: "x" }] },
        }),
      ),
    ).toThrow("Invalid literal value, expected \"equals\"")

    expect(() =>
      validateDB3QueryRequest(
        forgeDb3Query("User", {
          filter: {
            items: [{ field: "name", operator: "equals", value: { contains: "x" } }],
          },
        }),
      ),
    ).toThrow("Invalid input")

    expect(() =>
      validateDB3QueryRequest(
        forgeDb3Query("User", {
          filter: { items: [{ field: "name", operator: "equals" }] } as never,
        }),
      ),
    ).toThrow("filter.items.0.value: Invalid input")
  })

  it("rejects unknown filter and ordering fields", () => {
    expect(() =>
      validateDB3QueryRequest(
        forgeDb3Query("User", {
          filter: { items: [{ field: "notAColumn", operator: "equals", value: 1 }] },
        }),
      ),
    ).toThrow("unknown filter field 'notAColumn' on table 'User'")

    expect(() =>
      validateDB3QueryRequest(forgeDb3Query("User", { orderBy: { notAColumn: "asc" } })),
    ).toThrow("unknown order field 'notAColumn' on table 'User'")

    expect(() =>
      validateDB3QueryRequest(
        forgeDb3Query("User", { orderBy: { name: "sideways" } }),
      ),
    ).toThrow("Invalid enum value")
  })

  it("validates table parameters against the selected table contract", () => {
    const valid = validateDB3QueryRequest(
      forgeDb3Query("User", {
        filter: { items: [], tableParams: { userId: target.id, userIds: [target.id] } },
      }),
    )
    expect(valid.filter.tableParams).toEqual({ userId: target.id, userIds: [target.id] })

    expect(() =>
      validateDB3QueryRequest(
        forgeDb3Query("User", { filter: { items: [], tableParams: { userId: "3" } } }),
      ),
    ).toThrow("filter.tableParams.userId: Expected number")

    expect(() =>
      validateDB3QueryRequest(
        forgeDb3Query("User", { filter: { items: [], tableParams: { rawWhere: {} } } }),
      ),
    ).toThrow(/Unrecognized key.*rawWhere/)
  })

  it("validates pagination bounds", () => {
    expect(() =>
      validateDB3PaginatedQueryRequest({
        ...forgeDb3Query("User"),
        skip: 0,
        take: 50,
      }),
    ).not.toThrow()

    expect(() =>
      validateDB3PaginatedQueryRequest({
        ...forgeDb3Query("User"),
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
        forgeDb3Update("User", target.id, { notAColumn: "value" }),
      ),
    ).toThrow("unknown mutation field 'notAColumn' on table 'User'")

    expect(() =>
      validateDB3MutationRequest(
        forgeDb3Update("User", target.id, { id: target.id + 1, name: "mismatch" }),
      ),
    ).toThrow("update model field 'id' must match updateId")
  })

  it("derives query intention from the database actor", async () => {
    authorizationTestDb.reset({
      user: [sysadmin, moderator, { ...target, isDeleted: true }],
      change: [],
      eventType: [
        { id: 10, isDeleted: false, text: "Visible event type" },
        { id: 11, isDeleted: true, text: "Deleted event type" },
      ],
    })

    const { ctx: moderatorCtx } = createAuthorizationPersona("moderator", { id: moderator.id })
    const moderatorResult = await invokeResolver(db3Query, forgeDb3Query("User"), moderatorCtx)
    expect(moderatorResult.items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: target.id })]),
    )

    const { ctx: sysadminCtx } = createAuthorizationPersona("sysadmin", { id: sysadmin.id })
    const sysadminResult = await invokeResolver(db3Query, forgeDb3Query("User"), sysadminCtx)
    expect(sysadminResult.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: target.id })]),
    )

    const { ctx: publicCtx } = createAuthorizationPersona("public")
    const publicResult = await invokeResolver(db3Query, forgeDb3Query("EventType"), publicCtx)
    expect(publicResult.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 10 })]),
    )
    expect(publicResult.items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 11 })]),
    )
    expect(sysadminResult).not.toHaveProperty("clientIntention")
  })
})

describe("BA-A002 generic DB3 query authorization", () => {
  const sysadmin = createAuthorizationTestUser("sysadmin", { id: 1 })
  const normal = createAuthorizationTestUser("normal", { id: 2 })
  const activeTarget = createAuthorizationTestUser("normal", { id: 3 })
  const deletedTarget = createAuthorizationTestUser("normal", { id: 4, isDeleted: true })

  beforeEach(() => {
    authorizationTestDb.reset({
      user: [sysadmin, normal, activeTarget, deletedTarget],
      change: [{ id: 1, table: "User", recordId: activeTarget.id }],
      event: [],
      role: [],
    })
    vi.restoreAllMocks()
  })

  it("rejects an unauthorized table before its Prisma query executes", async () => {
    const findMany = vi.spyOn(authorizationTestDb.getDelegate("change"), "findMany")
    const { ctx } = createAuthorizationPersona("normal", { id: normal.id })

    await expect(invokeResolver(db3Query, forgeDb3Query("Change"), ctx)).rejects.toThrow(
      "Not authorized to perform this DB3 query",
    )
    expect(findMany).not.toHaveBeenCalled()
  })

  it("rejects an unauthorized paginated table before querying or counting", async () => {
    const changeDelegate = authorizationTestDb.getDelegate("change")
    const findMany = vi.spyOn(changeDelegate, "findMany")
    const count = vi.spyOn(changeDelegate, "count")
    const { ctx } = createAuthorizationPersona("normal", { id: normal.id })

    await expect(
      invokeResolver(
        db3PaginatedQuery,
        { ...forgeDb3Query("Change"), skip: 0, take: 50 },
        ctx,
      ),
    ).rejects.toThrow("Not authorized to perform this DB3 query")
    expect(findMany).not.toHaveBeenCalled()
    expect(count).not.toHaveBeenCalled()
  })

  it("rejects admin intention without a database-derived sysadmin capability", async () => {
    const findMany = vi.spyOn(authorizationTestDb.getDelegate("user"), "findMany")
    const databaseNormal = normal as unknown as UserWithRolesPayload

    await expect(DB3QueryCore2({
      ...forgeDb3Query("User"),
      clientIntention: { intention: "admin", mode: "primary", currentUser: databaseNormal },
    }, databaseNormal)).rejects.toThrow("Not authorized to perform this DB3 query")
    expect(findMany).not.toHaveBeenCalled()
  })

  it.each([
    { name: "filter", request: { filter: { items: [{ field: "isDeleted", operator: "equals" as const, value: true }] } } },
    { name: "order", request: { orderBy: { isDeleted: "asc" as const } } },
    { name: "parameter", request: { filter: { items: [], tableParams: { eventTypeIds: [12] } } } },
  ])("rejects a protected $name field before querying", async ({ request }) => {
    const findMany = vi.spyOn(authorizationTestDb.getDelegate("event"), "findMany")
    const { ctx } = createAuthorizationPersona("public")

    await expect(
      invokeResolver(db3Query, forgeDb3Query("Event", request), ctx),
    ).rejects.toThrow("Not authorized to perform this DB3 query")
    expect(findMany).not.toHaveBeenCalled()
  })

  it("does not consult protected columns while building quick or custom filters", () => {
    const { publicData } = createAuthorizationPersona("public")
    const clientIntention = { intention: "public", mode: "primary" } as const
    const protectedColumn = db3.xEvent.getColumn("isDeleted")!
    const quickFilter = vi.spyOn(protectedColumn, "getQuickFilterWhereClause")
    const customFilter = vi.spyOn(protectedColumn, "getCustomFilterWhereClause")

    db3.xEvent.GetQuickFilterWhereClauseExpression("probe", clientIntention, publicData)
    db3.xEvent.GetCustomWhereClauseExpression(
      { items: [], tagIds: [12] },
      clientIntention,
      publicData,
    )

    expect(quickFilter).not.toHaveBeenCalled()
    expect(customFilter).not.toHaveBeenCalled()
  })

  it("does not let a primary key qualify a row from a protected table", () => {
    const { publicData } = createAuthorizationPersona("public")
    const result = db3.xChange.authorizeAndSanitize({
      contextDesc: "BA-A002 protected-row regression",
      publicData,
      clientIntention: { intention: "public", mode: "primary" },
      rowMode: "view",
      model: { id: 41, table: "User", recordId: activeTarget.id },
      fallbackOwnerId: null,
    })

    expect(result.rowIsAuthorized).toBe(false)
    expect(result.authorizedModel).toEqual({})
    expect(result.unauthorizedModel).toEqual(
      expect.objectContaining({ id: 41 }),
    )
  })

  it("returns IDs only for rows inside the server-enforced visibility scope", async () => {
    const publicPermissionId = 700
    const loggedInPermissionId = 701
    authorizationTestDb.reset({
      user: [],
      role: [{
        id: 900,
        isPublicRole: true,
        permissions: [{ permissionId: publicPermissionId }],
      }],
      event: [
        {
          id: 20,
          name: "Public event",
          isDeleted: false,
          createdByUserId: null,
          visiblePermissionId: publicPermissionId,
          visiblePermission: { id: publicPermissionId, name: Permission.visibility_public },
          frontpageVisible: true,
        },
        {
          id: 21,
          name: "Members event",
          isDeleted: false,
          createdByUserId: null,
          visiblePermissionId: loggedInPermissionId,
          visiblePermission: { id: loggedInPermissionId, name: Permission.visibility_logged_in_users },
          frontpageVisible: true,
        },
        {
          id: 22,
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

    const result = await invokeResolver(db3Query, forgeDb3Query("Event"), ctx)

    expect(result.items).toEqual([
      expect.objectContaining({ id: 20, name: "Public event" }),
    ])
    expect(JSON.stringify(result)).not.toContain("Members event")
    expect(JSON.stringify(result)).not.toContain("Deleted public event")
  })

  it("uses the same soft-delete scope for paginated items and counts", async () => {
    const { ctx: normalCtx } = createAuthorizationPersona("normal", { id: normal.id })
    const normalResult = await invokeResolver(
      db3PaginatedQuery,
      { ...forgeDb3Query("User"), skip: 0, take: 50 },
      normalCtx,
    )

    expect(normalResult.count).toBe(3)
    expect(normalResult.items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: deletedTarget.id })]),
    )

    const normalDeletedOnlyResult = await invokeResolver(
      db3PaginatedQuery,
      {
        ...forgeDb3Query("User", {
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
      { ...forgeDb3Query("User"), skip: 0, take: 50 },
      sysadminCtx,
    )

    expect(sysadminResult.count).toBe(4)
    expect(sysadminResult.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: deletedTarget.id })]),
    )

    const sysadminDeletedOnlyResult = await invokeResolver(
      db3PaginatedQuery,
      {
        ...forgeDb3Query("User", {
          filter: {
            items: [{ field: "isDeleted", operator: "equals", value: true }],
          },
        }),
        skip: 0,
        take: 50,
      },
      sysadminCtx,
    )
    expect(sysadminDeletedOnlyResult.count).toBe(1)
    expect(sysadminDeletedOnlyResult.items).toEqual([
      expect.objectContaining({ id: deletedTarget.id }),
    ])
  })

  it("does not count rows outside an authenticated user's visibility scope", async () => {
    const visibilityPermissions = [
      Permission.login,
      Permission.basic_trust,
      Permission.visibility_public,
    ]
    const visibilityUser = createAuthorizationTestUser("normal", {
      id: normal.id,
      permissions: visibilityPermissions,
    })
    const publicPermissionId = visibilityUser.role!.permissions.find(
      entry => entry.permission.name === Permission.visibility_public,
    )!.permissionId
    authorizationTestDb.reset({
      user: [visibilityUser],
      event: [
        {
          id: 30,
          name: "Visible event",
          isDeleted: false,
          createdByUserId: null,
          visiblePermissionId: publicPermissionId,
          visiblePermission: { id: publicPermissionId, name: Permission.visibility_public },
        },
        {
          id: 31,
          name: "Hidden event",
          isDeleted: false,
          createdByUserId: null,
          visiblePermissionId: 999,
          visiblePermission: { id: 999, name: Permission.visibility_members },
        },
        {
          id: 32,
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
      { ...forgeDb3Query("Event"), skip: 0, take: 50 },
      ctx,
    )

    expect(result.count).toBe(1)
    expect(result.items).toEqual([
      expect.objectContaining({ id: 30, name: "Visible event" }),
    ])
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
    authorizationTestDb.reset({
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
        forgeDb3Update("User", target.id, {
          id: target.id,
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
      authorizationTestDb.reset({ user: [actor, target], change: [] })
      const update = vi.spyOn(authorizationTestDb.getDelegate("user"), "update")
      const { ctx } = createAuthorizationPersona(persona, { id: actor.id })

      await expect(
        invokeResolver(
          db3Mutation,
          forgeDb3Update("User", target.id, { id: target.id, isSysAdmin: true }),
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
        forgeDb3Insert("User", {
          name: "Crafted sysadmin",
          email: "crafted@test.invalid",
          isSysAdmin: true,
        }),
        ctx,
      ),
    ).rejects.toThrow("Not authorized to mutate User fields: isSysAdmin")

    expect(create).not.toHaveBeenCalled()
    expect(authorizationTestDb.snapshot("change")).toEqual([])
  })

  it("enforces table authorization before insert", async () => {
    const create = vi.spyOn(authorizationTestDb.getDelegate("user"), "create")
    const limited = createAuthorizationTestUser("limited", { id: 20 })
    authorizationTestDb.reset({ user: [limited, target], change: [] })
    const { ctx } = createAuthorizationPersona("limited", { id: limited.id })

    await expect(
      invokeResolver(
        db3Mutation,
        forgeDb3Insert("User", {
          name: "Unauthorized insert",
          email: "unauthorized@test.invalid",
        }),
        ctx,
      ),
    ).rejects.toThrow("Not authorized to mutate User fields")

    expect(create).not.toHaveBeenCalled()
    expect(authorizationTestDb.snapshot("change")).toEqual([])
  })

  it("persists an authorized insert from the sanitized model", async () => {
    const { ctx } = createAuthorizationPersona("moderator", { id: moderator.id })

    const result = await invokeResolver(
      db3Mutation,
      forgeDb3Insert("User", {
        name: "Authorized insert",
        email: "authorized@test.invalid",
      }),
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
    const { ctx } = createAuthorizationPersona("moderator", { id: moderator.id })

    const result = await invokeResolver(
      db3Mutation,
      forgeDb3Update("User", target.id, {
        id: target.id,
        name: "Authorized mutation",
      }),
      ctx,
    )

    expect(result).toEqual(expect.objectContaining({
      id: target.id,
      name: "Authorized mutation",
      isSysAdmin: false,
    }))
    expect(authorizationTestDb.snapshot("change")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: "User", recordId: target.id, action: "update" }),
      ]),
    )
  })

  it("allows only a sysadmin actor to supply isSysAdmin", async () => {
    const { ctx } = createAuthorizationPersona("sysadmin", { id: sysadmin.id })

    const result = await invokeResolver(
      db3Mutation,
      forgeDb3Update("User", target.id, { id: target.id, isSysAdmin: true }),
      ctx,
    )

    expect(result).toEqual(expect.objectContaining({ id: target.id, isSysAdmin: true }))
  })
})

describe("BA-A004 association authorization", () => {
  const sysadmin = createAuthorizationTestUser("sysadmin", { id: 1 })
  const bandAdmin = createAuthorizationTestUser("bandAdmin", { id: 2 })
  const normal = createAuthorizationTestUser("normal", { id: 3 })
  const otherUser = createAuthorizationTestUser("normal", { id: 4 })

  const ordinaryRole = {
    id: 100,
    name: "Ordinary role",
    description: "",
    isRoleForNewUsers: false,
    isPublicRole: false,
    sortOrder: 10,
    color: null,
    significance: null,
  }
  const protectedRole = {
    ...ordinaryRole,
    id: 101,
    name: "Protected role",
  }
  const ordinaryPermission = {
    id: 200,
    name: Permission.manage_events,
    description: "",
    isVisibility: false,
    sortOrder: 10,
    significance: null,
    color: null,
    iconName: null,
  }
  const protectedPermissions = [
    { ...ordinaryPermission, id: 201, name: Permission.sysadmin },
    { ...ordinaryPermission, id: 202, name: Permission.impersonate_user },
    { ...ordinaryPermission, id: 203, name: Permission.never_grant },
  ]
  const ordinaryRolePermission = {
    id: 300,
    roleId: ordinaryRole.id,
    permissionId: ordinaryPermission.id,
  }
  const protectedRolePermission = {
    id: 301,
    roleId: protectedRole.id,
    permissionId: protectedPermissions[0]!.id,
  }

  beforeEach(() => {
    authorizationTestDb.reset({
      user: [sysadmin, bandAdmin, normal, otherUser],
      role: [ordinaryRole, protectedRole],
      permission: [ordinaryPermission, ...protectedPermissions],
      rolePermission: [ordinaryRolePermission, protectedRolePermission],
      userInstrument: [],
      change: [],
    })
    vi.restoreAllMocks()
  })

  it.each(protectedPermissions)(
    "atomically rejects Band Admin granting $name",
    async (protectedPermission) => {
      const roleUpdate = vi.spyOn(authorizationTestDb.getDelegate("role"), "update")
      const associationCreate = vi.spyOn(
        authorizationTestDb.getDelegate("rolePermission"),
        "create",
      )
      const { ctx } = createAuthorizationPersona("bandAdmin", { id: bandAdmin.id })

      await expect(
        invokeResolver(
          db3Mutation,
          forgeDb3Update("Role", ordinaryRole.id, {
            id: ordinaryRole.id,
            name: "Must remain unchanged",
            permissions: [ordinaryPermission.id, protectedPermission.id],
          }),
          ctx,
        ),
      ).rejects.toThrow("Not authorized to mutate Role fields: permissions")

      expect(roleUpdate).not.toHaveBeenCalled()
      expect(associationCreate).not.toHaveBeenCalled()
      expect(authorizationTestDb.snapshot("role")).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: ordinaryRole.id, name: ordinaryRole.name }),
        ]),
      )
      expect(authorizationTestDb.snapshot("rolePermission")).toEqual(
        expect.arrayContaining([ordinaryRolePermission]),
      )
    },
  )

  it("rejects association changes on a protected role", async () => {
    const associationDelete = vi.spyOn(
      authorizationTestDb.getDelegate("rolePermission"),
      "deleteMany",
    )
    const { ctx } = createAuthorizationPersona("bandAdmin", { id: bandAdmin.id })

    await expect(
      invokeResolver(
        db3Mutation,
        forgeDb3Update("Role", protectedRole.id, {
          id: protectedRole.id,
          permissions: [],
        }),
        ctx,
      ),
    ).rejects.toThrow("Not authorized to mutate Role fields: permissions")

    expect(associationDelete).not.toHaveBeenCalled()
    expect(authorizationTestDb.snapshot("rolePermission")).toEqual(
      expect.arrayContaining([protectedRolePermission]),
    )
  })

  it("blocks direct non-sysadmin RolePermission insert and delete mutations", async () => {
    const rolePermissionDelegate = authorizationTestDb.getDelegate("rolePermission")
    const create = vi.spyOn(rolePermissionDelegate, "create")
    const deleteMany = vi.spyOn(rolePermissionDelegate, "deleteMany")
    const { ctx } = createAuthorizationPersona("bandAdmin", { id: bandAdmin.id })

    await expect(
      invokeResolver(
        db3Mutation,
        forgeDb3Insert("RolePermission", {
          roleId: ordinaryRole.id,
          permissionId: protectedPermissions[0]!.id,
        }),
        ctx,
      ),
    ).rejects.toThrow("Not authorized to mutate RolePermission fields")

    await expect(
      invokeResolver(
        db3Mutation,
        forgeDb3Delete("RolePermission", protectedRolePermission.id),
        ctx,
      ),
    ).rejects.toThrow("Not authorized to mutate RolePermission fields")

    expect(create).not.toHaveBeenCalled()
    expect(deleteMany).not.toHaveBeenCalled()
    expect(authorizationTestDb.snapshot("rolePermission")).toEqual(
      expect.arrayContaining([ordinaryRolePermission, protectedRolePermission]),
    )
  })

  it("rejects an association-only update outside the caller's row scope", async () => {
    const associationDelegate = authorizationTestDb.getDelegate("userInstrument")
    const findMany = vi.spyOn(associationDelegate, "findMany")
    const create = vi.spyOn(associationDelegate, "create")
    const { ctx } = createAuthorizationPersona("normal", { id: normal.id })

    await expect(
      invokeResolver(
        db3Mutation,
        forgeDb3Update("User", otherUser.id, {
          id: otherUser.id,
          instruments: [500],
        }),
        ctx,
      ),
    ).rejects.toThrow("Not authorized to mutate User fields: instruments")

    expect(findMany).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
    expect(authorizationTestDb.snapshot("userInstrument")).toEqual([])
  })

  it("awaits authorized association insertions and removals", async () => {
    const { ctx } = createAuthorizationPersona("normal", { id: normal.id })

    await invokeResolver(
      db3Mutation,
      forgeDb3Update("User", normal.id, {
        id: normal.id,
        instruments: [500],
      }),
      ctx,
    )
    expect(authorizationTestDb.snapshot("userInstrument")).toEqual([
      expect.objectContaining({ userId: normal.id, instrumentId: 500 }),
    ])

    await invokeResolver(
      db3Mutation,
      forgeDb3Update("User", normal.id, {
        id: normal.id,
        instruments: [],
      }),
      ctx,
    )
    expect(authorizationTestDb.snapshot("userInstrument")).toEqual([])
    expect(authorizationTestDb.snapshot("change")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: "UserInstrument", action: "insert" }),
        expect.objectContaining({ table: "UserInstrument", action: "delete" }),
      ]),
    )
  })

  it("authorizes and awaits associations supplied during insert", async () => {
    const { ctx } = createAuthorizationPersona("moderator", { id: 20 })
    const moderator = createAuthorizationTestUser("moderator", { id: 20 })
    authorizationTestDb.reset({ user: [moderator], userInstrument: [], change: [] })

    const result = await invokeResolver(
      db3Mutation,
      forgeDb3Insert("User", {
        name: "User with instrument",
        email: "instrument@test.invalid",
        instruments: [500],
      }),
      ctx,
    ) as { id: number }

    expect(result).toEqual(expect.objectContaining({ id: expect.any(Number) }))
    expect(authorizationTestDb.snapshot("userInstrument")).toEqual([
      expect.objectContaining({ userId: result.id, instrumentId: 500 }),
    ])
  })

  it("allows sysadmin to add and remove role permissions", async () => {
    const { ctx } = createAuthorizationPersona("sysadmin", { id: sysadmin.id })
    const sysadminPermission = protectedPermissions[0]!

    await invokeResolver(
      db3Mutation,
      forgeDb3Update("Role", ordinaryRole.id, {
        id: ordinaryRole.id,
        permissions: [ordinaryPermission.id, sysadminPermission.id],
      }),
      ctx,
    )
    expect(authorizationTestDb.snapshot("rolePermission")).toEqual(
      expect.arrayContaining([
        ordinaryRolePermission,
        expect.objectContaining({
          roleId: ordinaryRole.id,
          permissionId: sysadminPermission.id,
        }),
      ]),
    )

    await invokeResolver(
      db3Mutation,
      forgeDb3Update("Role", ordinaryRole.id, {
        id: ordinaryRole.id,
        permissions: [],
      }),
      ctx,
    )
    expect(authorizationTestDb.snapshot("rolePermission")).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ roleId: ordinaryRole.id }),
      ]),
    )
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
      Permission.basic_trust,
      Permission.manage_events,
      Permission.admin_events,
    ],
  })

  const eventTag = {
    id: 100,
    text: "Delete test tag",
    description: "",
    color: null,
    significance: null,
    sortOrder: 0,
    visibleOnFrontpage: false,
  }
  const eventType = {
    id: 101,
    text: "Delete test type",
    description: "",
    color: null,
    significance: null,
    sortOrder: 0,
    iconName: null,
    isDeleted: false,
  }

  beforeEach(() => {
    authorizationTestDb.reset({
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
    ["soft", "EventType", eventType.id, "softWhenPossible"],
    ["hard", "EventTag", eventTag.id, "hard"],
  ] as const)("does not let login alone perform a %s delete", async (_kind, tableName, id, deleteType) => {
    const { ctx } = createAuthorizationPersona("limited", { id: limited.id })
    const delegate = authorizationTestDb.getDelegate(tableName)
    const update = vi.spyOn(delegate, "update")
    const deleteMany = vi.spyOn(delegate, "deleteMany")

    await expect(
      invokeResolver(db3Mutation, forgeDb3Delete(tableName, id, deleteType), ctx),
    ).rejects.toThrow(`Not authorized to mutate ${tableName} fields`)

    expect(update).not.toHaveBeenCalled()
    expect(deleteMany).not.toHaveBeenCalled()
  })

  it("soft-deletes a soft-delete table for an authorized actor", async () => {
    const { ctx } = createAuthorizationPersona("bandAdmin", {
      id: eventAdmin.id,
      permissions: [
        Permission.login,
        Permission.basic_trust,
        Permission.manage_events,
        Permission.admin_events,
      ],
    })

    await invokeResolver(
      db3Mutation,
      forgeDb3Delete("EventType", eventType.id, "softWhenPossible"),
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
      invokeResolver(db3Mutation, forgeDb3Delete("EventType", eventType.id, "hard"), ctx),
    ).rejects.toThrow("Not authorized to mutate EventType fields")

    expect(update).not.toHaveBeenCalled()
    expect(deleteMany).not.toHaveBeenCalled()
    expect(authorizationTestDb.snapshot("eventType")).toEqual([eventType])
  })

  it("hard-deletes an allowlisted domain table for an authorized actor", async () => {
    const { ctx } = createAuthorizationPersona("bandAdmin", {
      id: eventAdmin.id,
      permissions: [
        Permission.login,
        Permission.basic_trust,
        Permission.manage_events,
        Permission.admin_events,
      ],
    })

    await invokeResolver(
      db3Mutation,
      forgeDb3Delete("EventTag", eventTag.id, "softWhenPossible"),
      ctx,
    )

    expect(authorizationTestDb.snapshot("eventTag")).toEqual([])
    expect(authorizationTestDb.snapshot("change")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: "EventTag", recordId: eventTag.id, action: "delete" }),
      ]),
    )
  })

  it("authorizes a hard delete against the persisted target row", async () => {
    const normal = createAuthorizationTestUser("normal", { id: 20 })
    const otherUser = createAuthorizationTestUser("normal", { id: 21 })
    const ownInstrument = { id: 300, userId: normal.id, instrumentId: 500 }
    const otherInstrument = { id: 301, userId: otherUser.id, instrumentId: 500 }
    authorizationTestDb.reset({
      user: [normal, otherUser],
      userInstrument: [ownInstrument, otherInstrument],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("normal", { id: normal.id })

    await expect(
      invokeResolver(
        db3Mutation,
        forgeDb3Delete("UserInstrument", otherInstrument.id, "hard"),
        ctx,
      ),
    ).rejects.toThrow("Not authorized to mutate UserInstrument fields")
    expect(authorizationTestDb.snapshot("userInstrument")).toEqual([
      ownInstrument,
      otherInstrument,
    ])

    await invokeResolver(
      db3Mutation,
      forgeDb3Delete("UserInstrument", ownInstrument.id, "hard"),
      ctx,
    )
    expect(authorizationTestDb.snapshot("userInstrument")).toEqual([otherInstrument])
  })

  it("lets Band Admin deactivate an ordinary user", async () => {
    const { ctx } = createAuthorizationPersona("bandAdmin", { id: bandAdmin.id })

    await invokeResolver(
      db3Mutation,
      forgeDb3Delete("User", ordinaryUser.id, "softWhenPossible"),
      ctx,
    )

    expect(authorizationTestDb.snapshot("user")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: ordinaryUser.id, isDeleted: true }),
      ]),
    )
  })

  it.each([
    ["a user in a protected role", protectedRoleUser],
    ["a user with the isSysAdmin flag", isSysAdminUser],
  ])("does not let Band Admin deactivate %s", async (_description, target) => {
    const { ctx } = createAuthorizationPersona("bandAdmin", { id: bandAdmin.id })
    const update = vi.spyOn(authorizationTestDb.getDelegate("user"), "update")

    await expect(
      invokeResolver(
        db3Mutation,
        forgeDb3Delete("User", target.id, "softWhenPossible"),
        ctx,
      ),
    ).rejects.toThrow("Not authorized to mutate User fields")

    expect(update).not.toHaveBeenCalled()
    expect(authorizationTestDb.snapshot("user")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: target.id, isDeleted: false }),
      ]),
    )
  })

  it("keeps user hard deletion out of the generic endpoint", async () => {
    const { ctx } = createAuthorizationPersona("sysadmin", { id: sysadmin.id })
    const deleteMany = vi.spyOn(authorizationTestDb.getDelegate("user"), "deleteMany")

    await expect(
      invokeResolver(db3Mutation, forgeDb3Delete("User", ordinaryUser.id, "hard"), ctx),
    ).rejects.toThrow("Not authorized to mutate User fields")

    expect(deleteMany).not.toHaveBeenCalled()
  })

  it("cannot trigger Role or Permission cascade and SetNull effects through generic delete", async () => {
    const role = {
      id: 200,
      name: "Protected role",
      description: "",
      isRoleForNewUsers: false,
      isPublicRole: false,
      sortOrder: 0,
      color: null,
      significance: null,
    }
    const permission = {
      id: 201,
      name: Permission.sysadmin,
      description: "",
      isVisibility: false,
      sortOrder: 0,
      significance: null,
      color: null,
      iconName: null,
    }
    const rolePermission = {
      id: 202,
      roleId: role.id,
      permissionId: permission.id,
    }
    const assignedUser = { ...ordinaryUser, id: 203, roleId: role.id }
    const visibilityConsumer = { id: 204, visiblePermissionId: permission.id }
    authorizationTestDb.reset({
      user: [sysadmin, assignedUser],
      role: [role],
      permission: [permission],
      rolePermission: [rolePermission],
      event: [visibilityConsumer],
      change: [],
    })
    const { ctx } = createAuthorizationPersona("sysadmin", { id: sysadmin.id })

    await expect(
      invokeResolver(db3Mutation, forgeDb3Delete("Role", role.id, "hard"), ctx),
    ).rejects.toThrow("Not authorized to mutate Role fields")
    await expect(
      invokeResolver(db3Mutation, forgeDb3Delete("Permission", permission.id, "hard"), ctx),
    ).rejects.toThrow("Not authorized to mutate Permission fields")

    expect(authorizationTestDb.snapshot("role")).toEqual([role])
    expect(authorizationTestDb.snapshot("permission")).toEqual([permission])
    expect(authorizationTestDb.snapshot("rolePermission")).toEqual([rolePermission])
    expect(authorizationTestDb.snapshot("user")).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: assignedUser.id, roleId: role.id })]),
    )
    expect(authorizationTestDb.snapshot("event")).toEqual([
      expect.objectContaining({ id: visibilityConsumer.id, visiblePermissionId: permission.id }),
    ])
  })
})
