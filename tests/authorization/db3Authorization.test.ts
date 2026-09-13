import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("db", async () => {
  const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client")
  const { authorizationTestDb } = await import("./support/inMemoryPrisma")
  return { ...prisma, default: authorizationTestDb }
})

import * as db3 from "@db3/db3"
import db3Mutation from "@db3/mutations/db3mutations"
import updateSongBasicFields from "@db3/mutations/updateSongBasicFields"
import db3Query from "@db3/queries/db3queries"
import db3PaginatedQuery from "@db3/queries/db3paginatedQueries"
import { queryTable } from "@db3/server/db3QueryCore"
import { loadUserAuthorization } from "src/auth/server/requestAuthorization"
import { PermissionSet } from "src/auth/shared/PermissionSet"
import { Permission } from "shared/permissions"
import { createAuthorizationPersona, createAuthorizationTestUser } from "./support/authorizationFixtures"
import { forgeDb3Insert, forgeDb3Query, forgeDb3Update } from "./support/db3RequestBuilders"
import { authorizationTestDb, matchesWhere } from "./support/inMemoryPrisma"
import { invokeResolver } from "./support/resolverHarness"

const makeSong = (id: number, overrides: Record<string, unknown> = {}) => ({
  id, name: `Song ${id}`, description: "before", isDeleted: false,
  createdByUserId: 501, visiblePermissionId: null, ...overrides,
})

beforeEach(() => authorizationTestDb.reset())

describe("explicit DB3 authorization", () => {
  it("requires an explicit permission set instead of silently supplying empty grants", () => {
    // @ts-expect-error Missing grants are a caller error, including at runtime.
    expect(() => db3.createDB3Authorization(null, undefined)).toThrow("effective permissions are required")
    // @ts-expect-error Plain transport data must be resolved into a PermissionSet.
    expect(() => db3.createDB3Authorization(null, { names: [], ids: [] })).toThrow("effective permissions are required")
    const noGrants = db3.createDB3Authorization(null, new PermissionSet([]))
    expect(db3.xSong.authorizeTableForView(noGrants)).toBe(false)
    // @ts-expect-error Partial public/session data is not schema authorization.
    expect(() => db3.xSong.authorizeTableForView({ userId: 0 })).toThrow()
  })

  it("enforces database public-role grants through the ordinary query path", async () => {
    const publicRole = {
      id: 90, isPublicRole: true,
      permissions: [Permission.always_grant, Permission.public, Permission.view_songs, Permission.visibility_public]
        .map((name, index) => ({ permissionId: 700 + index, permission: { id: 700 + index, name } })),
    }
    authorizationTestDb.reset({
      role: [publicRole],
      song: [makeSong(1, { visiblePermissionId: 703 }), makeSong(2), makeSong(3, { visiblePermissionId: 703, isDeleted: true })],
    })
    const result = await queryTable(forgeDb3Query("Song"), await loadUserAuthorization(null))
    expect(result.items.map(row => row.id)).toEqual([1])

    authorizationTestDb.reset({ role: [{ ...publicRole, permissions: [] }] })
    await expect(queryTable(forgeDb3Query("Song"), await loadUserAuthorization(null))).rejects.toThrow("Not authorized")
  })

  it("uses inherited public permission IDs for both predicates and row sanitization", async () => {
    const { user, ctx } = createAuthorizationPersona("normal", {
      id: 501, permissions: [Permission.login, Permission.view_songs],
    })
    authorizationTestDb.reset({
      user: [user!],
      song: [makeSong(1, { visiblePermissionId: 920_002, createdByUserId: 999 })],
    })
    const result = await invokeResolver(db3Query, forgeDb3Query("Song"), ctx)
    expect(result.items.map(row => row.id)).toEqual([1])
  })

  it("offers visibility choices from all effective roles", async () => {
    const actor = createAuthorizationTestUser("sysadmin", { permissions: [Permission.login] })
    const resolved = await loadUserAuthorization(actor as any)
    const authorization = db3.createDB3Authorization(resolved.user, resolved.effectivePermissions)
    const where = await db3.xPermissionForVisibility.CalculateWhereClause({
      publicData: authorization, filterModel: { items: [] },
    })
    expect(matchesWhere({ id: 920_002, isVisibility: true }, where)).toBe(true)
    expect(matchesWhere({ id: 999_999, isVisibility: true }, where)).toBe(false)
  })

  it.each([undefined, false, true])("honors includeDeleted=%s for Sysadmin queries and counts", async includeDeleted => {
    const { user, ctx } = createAuthorizationPersona("sysadmin", { id: 501 })
    authorizationTestDb.reset({
      user: [user!],
      song: [makeSong(1), makeSong(2, { isDeleted: true }), makeSong(3, { isDeleted: true, createdByUserId: 999 })],
    })
    const request = forgeDb3Query("Song", { includeDeleted })
    const result = await invokeResolver(db3Query, request, ctx)
    const paginated = await invokeResolver(db3PaginatedQuery, { ...request, skip: 0, take: 20 }, ctx)
    const expectedIds = includeDeleted ? [1, 2] : [1]
    expect(result.items.map(row => row.id)).toEqual(expectedIds)
    expect(paginated.items.map(row => row.id)).toEqual(expectedIds)
    expect(paginated.count).toBe(expectedIds.length)
  })

  it("requires the schema recovery grant even when the actor holds sysadmin", async () => {
    const { user, ctx } = createAuthorizationPersona("normal", {
      id: 501, permissions: [Permission.login, Permission.view_songs, Permission.sysadmin],
    })
    authorizationTestDb.reset({ user: [user!], song: [makeSong(1, { isDeleted: true })] })
    await expect(invokeResolver(db3Query, forgeDb3Query("Song", { includeDeleted: true }), ctx)).rejects.toThrow("Not authorized")
  })

  it("applies the same recovery and private-owner rules to included relations", async () => {
    const actor = createAuthorizationTestUser("sysadmin", { id: 501 })
    const resolved = await loadUserAuthorization(actor as any)
    const authorization = db3.createDB3Authorization(resolved.user, resolved.effectivePermissions)
    const selection = await db3.xSong_Verbose.CalculateSelectionArgs(authorization, { items: [] }, true)
    const fileWhere = selection!.include.taggedFiles.where.file
    const deletedFile = { id: 1, isDeleted: true, visiblePermissionId: null, uploadedByUserId: actor.id }
    expect(matchesWhere(deletedFile, fileWhere)).toBe(true)
    expect(matchesWhere({ ...deletedFile, uploadedByUserId: actor.id + 1 }, fileWhere)).toBe(false)
  })

  it("authorizes the same song edit through generic and dedicated mutations", async () => {
    const { user, ctx } = createAuthorizationPersona("normal", {
      id: 501, permissions: [Permission.login, Permission.manage_songs, Permission.view_songs],
    })
    authorizationTestDb.reset({ user: [user!], song: [makeSong(1)], change: [] })
    await invokeResolver(db3Mutation, forgeDb3Update("Song", 1, { description: "generic" }), ctx)
    await invokeResolver(updateSongBasicFields, { songId: 1, description: "dedicated" }, ctx)
    expect(authorizationTestDb.snapshot("song")[0]!.description).toBe("dedicated")
  })

  it("denies both mutation entry points when the operation grant is absent", async () => {
    const { user, ctx } = createAuthorizationPersona("normal", { id: 501 })
    authorizationTestDb.reset({ user: [user!], song: [makeSong(1)], change: [] })
    await expect(invokeResolver(db3Mutation, forgeDb3Update("Song", 1, { description: "generic" }), ctx)).rejects.toThrow("Not authorized")
    await expect(invokeResolver(updateSongBasicFields, { songId: 1, description: "dedicated" }, ctx)).rejects.toThrow("Not authorized")
    expect(authorizationTestDb.snapshot("song")[0]!.description).toBe("before")
  })

  it("keeps creation defaults tied to the authenticated actor", async () => {
    const { user, ctx } = createAuthorizationPersona("sysadmin", { id: 501 })
    authorizationTestDb.reset({ user: [user!], song: [], change: [] })
    const result = await invokeResolver(db3Mutation, forgeDb3Insert("Song", { name: "Created song" }), ctx)
    expect(result).toMatchObject({ name: "Created song", createdByUserId: user!.id })
  })
})
