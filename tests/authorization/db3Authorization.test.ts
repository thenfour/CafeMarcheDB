import { authorizationPermissionId, createAuthorizationSchemaData } from "./support/authorizationFixtures";
import { authorizationBandId, resetAuthorizationDatabase } from "./support/authorizationSeed";
import { testBandAuthorization, testServerAuthorization } from "tests/support/serverAuthorization";
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("db", async () => {
  const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client")
  const { authorizationTestDb } = await import("./support/inMemoryPrisma")
  return { ...prisma, default: authorizationTestDb }
})

import * as db3 from "@db3/db3"
import db3Mutation from "tests/authorization/db3MutationTestResolver"
import updateSongBasicFields from "@db3/mutations/updateSongBasicFields"
import db3Query from "@db3/queries/db3queries"
import db3PaginatedQuery from "@db3/queries/db3paginatedQueries"
import { queryTable } from "@db3/server/db3QueryCore"
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization"
import { ServerPermissionSet } from "src/auth/server/ServerPermissionSet"
import { gPermissionOrdered, Permission } from "shared/permissions"
import { parsePublicId } from "shared/publicId"
import { createAuthorizationPersona, createAuthorizationTestContext, createAuthorizationTestUser } from "./support/authorizationFixtures"
import { forgeDb3Insert, forgeDb3Query, forgeDb3PublicUpdate } from "./support/db3RequestBuilders"
import { songPublicId } from "../support/songFixtures"
import { userPublicId } from "../support/userFixtures"
import { authorizationTestDb, matchesWhere } from "./support/inMemoryPrisma"
import { invokeResolver } from "./support/resolverHarness"

const makeSong = (id: number, overrides: Record<string, unknown> = {}) => ({
  id, bandId: 1, publicId: songPublicId(id), name: `Song ${id}`, description: "before", isDeleted: false,
  createdByUserId: 501, visiblePermissionId: null, ...overrides,
})

// Song visibility fixtures also have a readable setlist/event parent.
const visibleListParent = { id: 100, event: { id: 100, bandId: 1, isDeleted: false, visiblePermissionId: authorizationPermissionId(Permission.visibility_public), createdByUserId: null } }

beforeEach(() => resetAuthorizationDatabase())

describe("explicit DB3 authorization", () => {
  it("uses public identity for client owner edit hints", () => {
    const authorization = testBandAuthorization(
      { id: 501, publicId: userPublicId(501) },
      new ServerPermissionSet([{ id: 1, name: Permission.view_songs }]),
    )
    const editArgs = {
      model: null,
      auth: authorization,
      columnName: "description",
      fallbackOwnerId: null,
    }
    expect(db3.xSong.authorizeColumnForEdit({ ...editArgs, fallbackOwnerPublicId: userPublicId(501) })).toBe(true)
    expect(db3.xSong.authorizeColumnForEdit({ ...editArgs, fallbackOwnerPublicId: userPublicId(502) })).toBe(false)
  })

  it("requires an explicit permission set instead of silently supplying empty grants", () => {
    // @ts-expect-error Missing grants are a caller error, including at runtime.
    expect(() => testServerAuthorization(null, undefined)).toThrow("effective permissions are required")
    // @ts-expect-error Plain transport data must be resolved into a PermissionSet.
    expect(() => testServerAuthorization(null, { names: [], ids: [] })).toThrow("effective permissions are required")
    const noGrants = testServerAuthorization(null, new ServerPermissionSet([]))
    expect(db3.xSong.authorizeTableForView(noGrants)).toBe(false)
    // @ts-expect-error Partial public/session data is not schema authorization.
    expect(() => db3.xSong.authorizeTableForView({ userId: 0 })).toThrow()
  })

  it("enforces scope-matching database Public grants through the ordinary query path", async () => {
    const publicRole = {
      id: 90, isPublicRole: true,
      permissions: [Permission.view_songs, Permission.visibility_public]
        .map((name, index) => ({ id: 700 + index, permissionId: 700 + index, permission: { id: 700 + index, name } })),
    }
    resetAuthorizationDatabase({
      bandRole: [{ ...publicRole, isDeleted: false, bandRolePermissions: publicRole.permissions }],
      song: [makeSong(1, { visiblePermissionId: 701 }), makeSong(2), makeSong(3, { visiblePermissionId: 701, isDeleted: true })],
    })
    const result = await queryTable(forgeDb3Query("Song", authorizationBandId), await loadAuthorizationForUser(null, undefined, authorizationBandId))
    expect(result.items.map(row => row.publicId)).toEqual([songPublicId(1)])

    resetAuthorizationDatabase({ bandRole: [{ ...publicRole, isDeleted: false, bandRolePermissions: [] }] })
    await expect(queryTable(forgeDb3Query("Song", authorizationBandId), await loadAuthorizationForUser(null, undefined, authorizationBandId))).rejects.toThrow("Not authorized")
  })

  it("uses explicit role visibility grants for both predicates and row sanitization", async () => {
    const { user, ctx } = createAuthorizationPersona("normal", {
      id: 501, permissions: [Permission.login, Permission.view_songs],
    })
    resetAuthorizationDatabase({
      user: [user!],
      song: [makeSong(1, { visiblePermissionId: authorizationPermissionId(Permission.visibility_public), createdByUserId: 999 })],
    })
    const result = await invokeResolver(db3Query, forgeDb3Query("Song", authorizationBandId), ctx)
    expect(result.items.map(row => row.publicId)).toEqual([songPublicId(1)])
  })

  it("offers visibility choices from all effective roles", async () => {
    const { user: actor, ctx } = createAuthorizationPersona("normal", {
      permissions: [Permission.login, Permission.visibility_members],
    })
    const resolved = createAuthorizationSchemaData(actor)
    const authorization = testBandAuthorization(resolved.user, resolved.effectivePermissions)
    const where = db3.permissionVisibilityView.getWhereClause({
      auth: authorization,
      filter: { items: [] },
    })
    expect(matchesWhere({ id: authorizationPermissionId(Permission.visibility_public), name: Permission.visibility_public,
      isVisibility: true, isDeleted: false }, where)).toBe(true)
    expect(matchesWhere({ id: 999_999, name: Permission.visibility_members,
      isVisibility: true, isDeleted: false }, where)).toBe(false)

    const permission = (id: number, name: Permission, isVisibility: boolean) => ({
      id,
      publicId: parsePublicId<"Permission">(`TestPerm${id.toString().padStart(8, "0").slice(-8)}`),
      name,
      isVisibility,
      description: name,
      sortOrder: id,
      significance: null,
      color: null,
      iconName: null,
    })
    resetAuthorizationDatabase({
      user: [actor!],
      permission: [
        permission(authorizationPermissionId(Permission.visibility_public), Permission.visibility_public, true),
        permission(999_999, Permission.visibility_members, true),
        permission(authorizationPermissionId(Permission.login), Permission.login, false),
      ],
    })
    const request = forgeDb3Query("Permission", authorizationBandId, {
      table: {
        tableID: "Permission",
        tableName: "Permission",
        viewID: db3.permissionVisibilityView.viewID,
      },
    })
    const result = await invokeResolver(db3Query, request, ctx)
    const paginated = await invokeResolver(db3PaginatedQuery, { bandPublicId: authorizationBandId,
      ...request,
      skip: 0,
      take: 20,
    }, ctx)
    const expected = [Permission.visibility_public, Permission.visibility_members]
      .map(name => permission(name === Permission.visibility_members ? 999_999 : authorizationPermissionId(name), name, true).publicId)
    expect(result.items.map(item => item.publicId).sort()).toEqual(expected.sort())
    expect(paginated.items.map(item => item.publicId).sort()).toEqual(expected.sort())
    expect(paginated.count).toBe(2)
  })

  it.each([undefined, false, true])("honors includeDeleted=%s for Sysadmin queries and counts", async includeDeleted => {
    const { user, ctx } = createAuthorizationPersona("sysadmin", { id: 501 })
    resetAuthorizationDatabase({
      user: [user!],
      song: [makeSong(1), makeSong(2, { isDeleted: true }), makeSong(3, { isDeleted: true, createdByUserId: 999 })],
    })
    const request = forgeDb3Query("Song", authorizationBandId, { includeDeleted })
    const result = await invokeResolver(db3Query, request, ctx)
    const paginated = await invokeResolver(db3PaginatedQuery, { bandPublicId: authorizationBandId, ...request, skip: 0, take: 20 }, ctx)
    const expectedIds = includeDeleted ? [songPublicId(1), songPublicId(2)] : [songPublicId(1)]
    expect(result.items.map(row => row.publicId)).toEqual(expectedIds)
    expect(paginated.items.map(row => row.publicId)).toEqual(expectedIds)
    expect(paginated.count).toBe(expectedIds.length)
  })

  it("rejects unscoped Song access even when the session claims sysadmin", async () => {
    const { user, ctx } = createAuthorizationPersona("normal", {
      id: 501, permissions: [Permission.login, Permission.view_songs, Permission.sysadmin],
    })
    resetAuthorizationDatabase({ user: [user!], song: [makeSong(1, { isDeleted: true })] })
    await expect(invokeResolver(db3Query, forgeDb3Query("Song", null, { includeDeleted: true }), ctx)).rejects.toThrow("Not authorized to perform this query.")
  })

  it("applies the same recovery and private-owner rules to included relations", async () => {
    const actor = createAuthorizationTestUser("sysadmin", { id: 501, permissions: gPermissionOrdered.filter(permission => permission !== Permission.global_band_admin) })
    const resolved = createAuthorizationSchemaData(actor)
    const authorization = testBandAuthorization(resolved.user, resolved.effectivePermissions)
    const selection = await db3.xSong.CalculateSelectionArgs(
      authorization,
      { items: [] },
      true,
      db3.songSearchView.getSelectionArgs,
    )
    const fileWhere = selection!.select.taggedFiles.where.file
    const deletedFile = { id: 1, bandId: 1, isDeleted: true, visiblePermissionId: null, uploadedByUserId: actor.id }
    expect(matchesWhere(deletedFile, fileWhere)).toBe(true)
    expect(matchesWhere({ ...deletedFile, uploadedByUserId: actor.id + 1 }, fileWhere)).toBe(false)
  })

  it("authorizes the same song edit through generic and dedicated mutations", async () => {
    const { user, ctx } = createAuthorizationPersona("normal", {
      id: 501, permissions: [Permission.login, Permission.manage_songs, Permission.view_songs],
    })
    resetAuthorizationDatabase({ user: [user!], song: [makeSong(1)], change: [] })
    await invokeResolver(db3Mutation, forgeDb3PublicUpdate("Song", authorizationBandId, songPublicId(1), { description: "generic" }), ctx)
    await invokeResolver(updateSongBasicFields, { bandPublicId: authorizationBandId, songId: songPublicId(1), description: "dedicated" }, ctx)
    expect(authorizationTestDb.snapshot("song")[0]!.description).toBe("dedicated")
  })

  it.each([db3.xEventSongList, db3.xEventSongListSong, db3.xSongCredit])(
    "enforces song visibility through $tableID at the query boundary", async table => {
      const actor = createAuthorizationTestUser("sysadmin", { id: 501, permissions: gPermissionOrdered.filter(permission => permission !== Permission.global_band_admin) })
      resetAuthorizationDatabase({ user: [actor] })
      const authorization = await loadAuthorizationForUser(actor, undefined, authorizationBandId)
      // Each descriptor produces a different Prisma selection; capture its actual predicate.
      const findMany = vi.fn(async (_args: any) => [])
      const lookup = vi.spyOn(authorizationTestDb.getDelegate(table.tableName), "findMany").mockImplementation(findMany)
      await queryTable(forgeDb3Query(table.tableID, authorizationBandId), authorization)
      const args = findMany.mock.calls[0]![0]
      lookup.mockRestore()
      const entryWhere = table === db3.xEventSongList ? args.include.songs.where : args.where
      const songs = [
        makeSong(1),
        makeSong(2, { createdByUserId: 502 }),
        makeSong(3, { visiblePermissionId: authorizationPermissionId(Permission.visibility_public), createdByUserId: 502 }),
        makeSong(4, { visiblePermissionId: 999_999 }),
        makeSong(5, { isDeleted: true }),
        makeSong(6, { createdByUserId: null }),
      ]
      const user = { id: actor.id, isDeleted: false, mergedIntoUserId: null, bandUsersByUser: [{ id: actor.id, bandId: 1, isDeleted: false }] }
      expect(songs.filter(song => matchesWhere({ id: song.id, song, userId: actor.id, user, eventSongList: visibleListParent }, entryWhere)).map(song => song.id)).toEqual([1, 3])
    },
  )

  it("enforces song visibility through the Event calendar view", async () => {
    const actor = createAuthorizationTestUser("sysadmin", { id: 501, permissions: gPermissionOrdered.filter(permission => permission !== Permission.global_band_admin) })
    resetAuthorizationDatabase({ user: [actor] })
    const authorization = await loadAuthorizationForUser(actor, undefined, authorizationBandId)
    // Capture the calendar's nested selection while retaining the real transaction owner.
    const findMany = vi.fn(async (_args: any) => [])
    const lookup = vi.spyOn(authorizationTestDb.getDelegate(db3.xEvent.tableName), "findMany").mockImplementation(findMany)
    await queryTable(forgeDb3Query(db3.xEvent.tableID, authorizationBandId, {
      table: {
        tableID: db3.xEvent.tableID,
        tableName: db3.xEvent.tableName,
        viewID: db3.eventCalendarView.viewID,
      },
    }), authorization)
    const entryWhere = findMany.mock.calls[0]![0].select.songLists.select.songs.where
    lookup.mockRestore()
    const songs = [
      makeSong(1),
      makeSong(2, { createdByUserId: 502 }),
      makeSong(3, { visiblePermissionId: authorizationPermissionId(Permission.visibility_public), createdByUserId: 502 }),
      makeSong(4, { visiblePermissionId: 999_999 }),
      makeSong(5, { isDeleted: true }),
      makeSong(6, { createdByUserId: null }),
    ]
    expect(songs.filter(song => matchesWhere({ id: song.id, song, eventSongList: visibleListParent }, entryWhere)).map(song => song.id)).toEqual([1, 3])
  })

  it("keeps nested event song filters specific to each viewer and recovery request", async () => {
    const actor = createAuthorizationTestUser("sysadmin", { id: 501, permissions: gPermissionOrdered.filter(permission => permission !== Permission.global_band_admin) })
    const resolved = createAuthorizationSchemaData(actor)
    const owner = testBandAuthorization(resolved.user, resolved.effectivePermissions)
    const otherResolved = createAuthorizationSchemaData(createAuthorizationTestUser("sysadmin", { id: 502 }))
    const other = testBandAuthorization(otherResolved.user, otherResolved.effectivePermissions)
    const publicViewer = testBandAuthorization(null, resolved.effectivePermissions)
    const entry = { id: 1, eventSongList: visibleListParent, song: makeSong(1) }
    for (const [viewer, expected] of [[owner, true], [other, false], [publicViewer, false]] as const) {
      const selection = await db3.xEvent.CalculateSelectionArgs(
        viewer, { items: [] }, false, db3.eventCalendarView.getSelectionArgs,
      )
      expect(matchesWhere(entry, selection!.select.songLists.select.songs.where)).toBe(expected)
    }
    const recovery = await db3.xEvent.CalculateSelectionArgs(
      owner, { items: [] }, true, db3.eventCalendarView.getSelectionArgs,
    )
    const where = recovery!.select.songLists.select.songs.where
    expect(matchesWhere({ id: 1, eventSongList: visibleListParent, song: makeSong(1, { isDeleted: true }) }, where)).toBe(true)
    expect(matchesWhere({ id: 2, eventSongList: visibleListParent, song: makeSong(2, { isDeleted: true, createdByUserId: 502 }) }, where)).toBe(false)
    expect(db3.eventSongListTransportSelection.select.songs).not.toHaveProperty("where")
  })

  it("requires song read permission even when the parent event is readable", async () => {
    const resolved = await loadAuthorizationForUser(null, undefined, authorizationBandId)
    const selection = await db3.xEvent.CalculateSelectionArgs(
      testBandAuthorization(null, resolved.effectivePermissions), { items: [] }, false,
      db3.eventCalendarView.getSelectionArgs,
    )
    const entry = { id: 1, eventSongList: visibleListParent, song: makeSong(1, { visiblePermissionId: authorizationPermissionId(Permission.visibility_public) }) }
    expect(matchesWhere(entry, selection!.select.songLists.select.songs.where)).toBe(false)
  })

  it.each(["include", "select"])("traverses association targets with %s and preserves authored filters", async selectionKind => {
    const resolved = createAuthorizationSchemaData(createAuthorizationTestUser("sysadmin", { id: 501, permissions: gPermissionOrdered.filter(permission => permission !== Permission.global_band_admin) }))
    const authorization = testBandAuthorization(resolved.user, resolved.effectivePermissions)
    const selection: any = {
      songs: {
        where: { sortOrder: { gte: 10 } },
        [selectionKind]: {
          song: { [selectionKind]: { taggedFiles: { [selectionKind]: { file: true } } } },
        },
      },
    }
    await db3.xEventSongList.ApplyIncludeFiltering(selection, authorization)
    expect(matchesWhere({ id: 1, eventSongList: visibleListParent, sortOrder: 5, song: makeSong(1) }, selection.songs.where)).toBe(false)
    expect(matchesWhere({ id: 1, eventSongList: visibleListParent, sortOrder: 10, song: makeSong(1) }, selection.songs.where)).toBe(true)
    const fileWhere = selection.songs[selectionKind].song[selectionKind].taggedFiles.where
    expect(matchesWhere({ id: 1, file: { id: 1, bandId: 1, uploadedByUserId: 501, visiblePermissionId: null, isDeleted: false } }, fileWhere)).toBe(true)
    expect(matchesWhere({ id: 2, file: { id: 2, bandId: 1, uploadedByUserId: 502, visiblePermissionId: null, isDeleted: false } }, fileWhere)).toBe(false)
  })

  it("denies generic and dedicated editing without the band's edit grant", async () => {
    const { user, ctx } = createAuthorizationPersona("normal", { id: 501, permissions: [Permission.login] })
    resetAuthorizationDatabase({ user: [user!], song: [makeSong(1)], change: [] })
    await expect(invokeResolver(db3Mutation, forgeDb3PublicUpdate("Song", authorizationBandId, songPublicId(1), { description: "generic" }), ctx)).rejects.toThrow("Not authorized")
    // An explicit target cannot create a membership or grant permissions.
    await expect(invokeResolver(updateSongBasicFields, { bandPublicId: authorizationBandId, songId: songPublicId(1), description: "dedicated" }, createAuthorizationTestContext(user!))).rejects.toThrow()
    expect(authorizationTestDb.snapshot("song")[0]!.description).toBe("before")
  })

  it("keeps creation defaults tied to the authenticated actor", async () => {
    const { user, ctx } = createAuthorizationPersona("sysadmin", { id: 501 })
    resetAuthorizationDatabase({ user: [user!], song: [], change: [] })
    const result = await invokeResolver(db3Mutation, forgeDb3Insert("Song", authorizationBandId, { name: "Created song" }), ctx)
    expect(result).toMatchObject({ name: "Created song" })
    expect(authorizationTestDb.snapshot("song")[0]).toMatchObject({ createdByUserId: user!.id })
  })
})
