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
import db3Query from "@db3/queries/db3queries"
import {
  validateDB3MutationRequest,
  validateDB3PaginatedQueryRequest,
  validateDB3QueryRequest,
} from "@db3/server/db3RequestValidation"
import { Permission } from "shared/permissions"
import {
  createAuthorizationPersona,
  createAuthorizationTarget,
  createAuthorizationTestUser,
  type AuthorizationPersona,
  type AuthorizationTargetKind,
} from "./support/authorizationFixtures"
import { forgeDb3Query, forgeDb3Update } from "./support/db3RequestBuilders"
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
    const publicResult = await invokeResolver(db3Query, forgeDb3Query("User"), publicCtx)
    expect(publicResult.items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: target.id })]),
    )
    expect(sysadminResult).not.toHaveProperty("clientIntention")
  })
})
