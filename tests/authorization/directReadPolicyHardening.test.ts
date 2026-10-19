import { authorizationPermissionId } from "./support/authorizationFixtures";
import { authorizationBandId, resetAuthorizationDatabase } from "./support/authorizationSeed";
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("db", async () => {
  const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client")
  const { authorizationTestDb } = await import("./support/inMemoryPrisma")
  return {
    ...prisma,
    default: authorizationTestDb,
  }
})

import getFilteredSongs from "@db3/queries/getFilteredSongs"
import getSetlistPlans from "@db3/queries/getSetlistPlans"
import getSongPinnedRecording from "@db3/queries/getSongPinnedRecording"
import getUserTagWithAssignments from "@db3/queries/getUserTagWithAssignments"
import getUserWikiContributions from "@db3/queries/getUserWikiContributions"
import { loadAuthorization } from "src/auth/server/serverAuthorization"
import getWikiPageRevision from "src/core/wiki/queries/getWikiPageRevision"
import getWikiPageRevisions from "src/core/wiki/queries/getWikiPageRevisions"
import { gPermissionRegistry, Permission } from "shared/permissions"
import {
  createAuthorizationPersona,
  createAuthorizationTestUser,
} from "./support/authorizationFixtures"
import { authorizationTestDb, matchesWhere } from "./support/inMemoryPrisma"
import { useWikiPrismaSelections } from "./support/wikiFixtures"
import { invokeResolver } from "./support/resolverHarness"
import { songPublicId } from "../support/songFixtures"
import { parsePublicId } from "shared/publicId"

const permissions = [
  Permission.login,
  Permission.view_songs,
  Permission.view_files,
  Permission.view_users_basic_info,
  Permission.view_wiki_pages,
  Permission.view_wiki_page_revisions,
  Permission.setlist_planner_access,
  Permission.visibility_public,
  Permission.visibility_members,
]
const actor = createAuthorizationTestUser("normal", { id: 801, permissions })
const publicVisibilityId = authorizationPermissionId(Permission.visibility_public)
const membersVisibilityId = authorizationPermissionId(Permission.visibility_members)
const hiddenVisibilityId = 999_999

describe("direct DB3-managed reads use the canonical row scope", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    resetAuthorizationDatabase({ user: [actor] })
    useWikiPrismaSelections()
  })

  it("does not resolve a soft-deleted session actor as the current user", async () => {
    resetAuthorizationDatabase({ user: [{ ...actor, isDeleted: true }] })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    await expect(loadAuthorization(ctx.session)).resolves.toMatchObject({ user: null })
  })

  it("requires revision-history permission for direct revision and contribution reads", async () => {
    const pageOnlyPermissions = permissions.filter(
      permission => permission !== Permission.view_wiki_page_revisions,
    )
    const pageOnlyActor = createAuthorizationTestUser("normal", {
      id: 803,
      permissions: pageOnlyPermissions,
    })
    resetAuthorizationDatabase({ user: [pageOnlyActor] })
    const { ctx } = createAuthorizationPersona("normal", {
      id: pageOnlyActor.id,
      permissions: pageOnlyPermissions,
    })

    await expect(invokeResolver(getWikiPageRevision, { bandPublicId: parsePublicId<"Band">("FixtureBand00001"), revisionId: parsePublicId<"WikiPageRevision">("WikiTestRev00001") }, ctx)).rejects.toThrow(
      "view_wiki_page_revisions",
    )
    await expect(invokeResolver(
      getUserWikiContributions,
      { bandPublicId: parsePublicId<"Band">("FixtureBand00001"), userId: pageOnlyActor.publicId },
      ctx,
    )).rejects.toThrow("view_wiki_page_revisions")
  })

  it("filters hidden and deleted songs in direct ID lookups", async () => {
    authorizationTestDb.getDelegate("song").reset([
      { bandId: 1,
        id: 1,
        publicId: songPublicId(1),
        name: "Visible",
        isDeleted: false,
        createdByUserId: actor.id + 1,
        visiblePermissionId: membersVisibilityId,
        tags: [{
          id: 70,
          publicId: "SongAssocPublic1",
          songId: 1,
          bandSongTagId: 20,
          tag: { id: 20, bandId: 1, publicId: "SongTagPublic001", isHidden: false, globalSongTagId: null },
        }],
      },
      { bandId: 1,
        id: 2,
        publicId: songPublicId(2),
        name: "Hidden",
        isDeleted: false,
        createdByUserId: actor.id + 1,
        visiblePermissionId: hiddenVisibilityId,
        tags: [],
      },
      { bandId: 1,
        id: 3,
        publicId: songPublicId(3),
        name: "Deleted",
        isDeleted: true,
        createdByUserId: actor.id + 1,
        visiblePermissionId: membersVisibilityId,
        tags: [],
      },
    ])
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    await expect(invokeResolver(getFilteredSongs, { bandPublicId: authorizationBandId, id: songPublicId(1) }, ctx)).resolves.toEqual({
      matchingItem: expect.objectContaining({
        publicId: songPublicId(1),
        name: "Visible",
        tags: [{
          publicId: "SongAssocPublic1",
          songId: songPublicId(1),
          bandSongTagId: "SongTagPublic001",
        }],
      }),
    })
    await expect(invokeResolver(getFilteredSongs, { bandPublicId: authorizationBandId, id: songPublicId(2) }, ctx)).resolves.toEqual({ matchingItem: null })
    await expect(invokeResolver(getFilteredSongs, { bandPublicId: authorizationBandId, id: songPublicId(3) }, ctx)).resolves.toEqual({ matchingItem: null })
  })

  it("returns private songs to their owner without widening the requested ID", async () => {
    authorizationTestDb.getDelegate("song").reset([
      { bandId: 1,
        id: 10,
        publicId: songPublicId(10),
        name: "Mine",
        isDeleted: false,
        createdByUserId: actor.id,
        visiblePermissionId: null,
        tags: [],
      },
      { bandId: 1,
        id: 11,
        publicId: songPublicId(11),
        name: "Also mine",
        isDeleted: false,
        createdByUserId: actor.id,
        visiblePermissionId: null,
        tags: [],
      },
    ])
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    const result = await invokeResolver(getFilteredSongs, { bandPublicId: authorizationBandId, id: songPublicId(10) }, ctx)

    expect(result.matchingItem).toEqual(expect.objectContaining({ publicId: songPublicId(10) }))
  })

  it("requires explicit band context for pinned-recording reads", async () => {
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })
    // Deliberately malformed HTTP input; the native recording tests cover scoped visibility.
    await expect(invokeResolver(getSongPinnedRecording, { songIds: [songPublicId(20)] } as never, ctx)).rejects.toThrow()
  })


  it("scopes public user-tag assignments to active users", async () => {
    const userTagPublicId = parsePublicId<"UserTag">("UserTagPublic061")
    authorizationTestDb.getDelegate("bandUserTag").reset([{
      id: 61,
      publicId: userTagPublicId,
      bandId: 1, isHidden: false, globalUserTagId: null, nameId: null,
      description: "",
      bandUserTagAssignments: [],
    }])
    const findMany = vi.spyOn(authorizationTestDb.getDelegate("bandUserTag"), "findMany")
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    await invokeResolver(getUserTagWithAssignments, { bandPublicId: authorizationBandId, userTagIds: [userTagPublicId] }, ctx)

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        bandUserTagAssignments: expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.any(Array),
          }),
        }),
      }),
    }))
    // The heterogeneous delegate captured this view's Prisma collection selection.
    const assignments = findMany.mock.calls.map(([args]) => args?.select?.bandUserTagAssignments).find(Boolean) as { where: Record<string, unknown> }
    const member = { bandId: 1, userId: actor.id, isDeleted: false, user: { id: actor.id, isDeleted: false, mergedIntoUserId: null } }
    const assignment = { id: 1, bandUser: member, bandUserTag: { bandId: 1, isHidden: false, globalUserTagId: null } }
    expect(matchesWhere(assignment, assignments.where)).toBe(true)
    for (const changedMember of [
      { ...member, isDeleted: true }, { ...member, bandId: 2 },
      { ...member, user: { ...member.user, isDeleted: true } },
      { ...member, user: { ...member.user, mergedIntoUserId: 999 } },
    ]) {
      expect(matchesWhere({ ...assignment, bandUser: changedMember }, assignments.where)).toBe(false)
    }
    expect(matchesWhere({ ...assignment, bandUserTag: { ...assignment.bandUserTag, bandId: 2 } }, assignments.where)).toBe(false)
  })

  it("filters hidden SetlistPlan rows before deserialization", async () => {
    const bandPublicId = parsePublicId<"Band">("SetlistBand00001")
    resetAuthorizationDatabase({
      user: [{ ...actor, isDeleted: false, mergedIntoUserId: null, globalRoleId: null }],
      band: [{ id: 1, publicId: bandPublicId, isDeleted: false }],
      bandUser: [{ id: 1, publicId: "BandUser00000001", userId: actor.id, bandId: 1, bandRoleId: 20, isDeleted: false }],
      bandRole: [{ id: 20, isDeleted: false }],
      permission: gPermissionRegistry.map((definition, index) => ({ id: index + 1, name: definition.key, isDeleted: false })),
      bandRolePermission: [{ id: 1, bandRoleId: 20,
        permissionId: gPermissionRegistry.findIndex(definition => definition.key === Permission.setlist_planner_access) + 1 }],
    })
    authorizationTestDb.getDelegate("setlistPlan").reset([{
      id: 30,
      bandId: 1,
      name: "Hidden plan",
      isDeleted: false,
      createdByUserId: actor.id,
      visiblePermissionId: hiddenVisibilityId,
      payloadJson: "not relevant because the row must be filtered",
    }])
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    // Ownership makes a null visibility row readable, but it must not override
    // an explicit visibility permission the actor does not possess.
    await expect(invokeResolver(getSetlistPlans, { bandPublicId, userId: actor.publicId }, ctx)).resolves.toEqual([])
  })

  it("applies WikiPage visibility to page, contribution, and revision reads", async () => {
    const hiddenPagePublicId = parsePublicId<"WikiPage">("WikiPageHidden01")
    const privatePagePublicId = parsePublicId<"WikiPage">("WikiPagePrivat01")
    const memberPagePublicId = parsePublicId<"WikiPage">("WikiPageMember01")
    const hiddenRevisionPublicId = parsePublicId<"WikiPageRevision">("WikiRevHidden001")
    const privateRevisionPublicId = parsePublicId<"WikiPageRevision">("WikiRevPrivat001")
    const hiddenRevision = {
      id: 401,
      wikiPageId: 40,
      publicId: hiddenRevisionPublicId,
      name: "Hidden revision",
      content: "Hidden content",
      consolidationKey: null,
      createdByUserId: actor.id,
      createdByUser: actor,
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      linesAdded: null,
      linesRemoved: null,
      prevLineCount: null,
      lineCount: null,
      charsAdded: null,
      charsRemoved: null,
      sizeChars: null,
      prevSizeChars: null,
    }
    const privateOwnerRevision = {
      ...hiddenRevision,
      id: 411,
      wikiPageId: 41,
      publicId: privateRevisionPublicId,
      name: "Private owner revision",
      content: "Private owner content",
    }
    const hiddenPage = { bandId: 1,
      id: 40,
      publicId: hiddenPagePublicId,
      slug: "hidden",
      createdByUserId: actor.id + 1,
      visiblePermissionId: hiddenVisibilityId,
      revisions: [hiddenRevision],
      currentRevision: hiddenRevision,
    }
    const privateOwnerPage = { bandId: 1,
      id: 41,
      publicId: privatePagePublicId,
      slug: "private-owner",
      createdByUserId: actor.id,
      visiblePermissionId: null,
      revisions: [privateOwnerRevision],
      currentRevision: privateOwnerRevision,
    }
    authorizationTestDb.getDelegate("wikiPage").reset([hiddenPage, privateOwnerPage])
    authorizationTestDb.getDelegate("wikiPageRevision").reset([
      { ...hiddenRevision, wikiPage: hiddenPage },
      { ...privateOwnerRevision, wikiPage: privateOwnerPage },
      {
        ...privateOwnerRevision,
        id: 412,
        publicId: parsePublicId<"WikiPageRevision">("WikiRevOther0001"),
        createdByUserId: actor.id + 1,
        createdByUser: null,
        wikiPage: privateOwnerPage,
      },
    ])
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    await expect(invokeResolver(
      getWikiPageRevisions,
      { bandPublicId: parsePublicId<"Band">("FixtureBand00001"), canonicalWikiPath: "hidden" },
      ctx,
    )).resolves.toBeNull()
    const visibleHistory = await invokeResolver(
      getWikiPageRevisions,
      { bandPublicId: parsePublicId<"Band">("FixtureBand00001"), canonicalWikiPath: "private-owner" },
      ctx,
    )
    expect(visibleHistory).toEqual(expect.objectContaining({ publicId: privatePagePublicId }))
    expect(visibleHistory).not.toHaveProperty("id")
    expect(visibleHistory).not.toHaveProperty("createdByUserId")
    expect(visibleHistory?.revisions?.[0]).not.toHaveProperty("createdByUserId")
    const contributions = await invokeResolver(
      getUserWikiContributions,
      { bandPublicId: parsePublicId<"Band">("FixtureBand00001"), userId: actor.publicId },
      ctx,
    )
    expect(contributions).toMatchObject({
      wikiContributions: [{
        publicId: privatePagePublicId,
        slug: privateOwnerPage.slug,
        revisions: [{ createdAt: privateOwnerRevision.createdAt }],
      }],
    })
    expect(contributions.wikiContributions).toHaveLength(1)
    expect(contributions.wikiContributions[0]?.revisions).toHaveLength(1)
    expect(contributions.wikiContributions[0]).not.toHaveProperty("id")
    expect(contributions.wikiContributions[0]?.revisions[0]).not.toHaveProperty("createdByUserId")
    expect(contributions.wikiContributions[0]?.revisions[0]).not.toHaveProperty("wikiPageId")
    await expect(invokeResolver(getWikiPageRevision, { bandPublicId: parsePublicId<"Band">("FixtureBand00001"), revisionId: hiddenRevisionPublicId }, ctx)).resolves.toBeNull()
    const visibleRevision = await invokeResolver(getWikiPageRevision, { bandPublicId: parsePublicId<"Band">("FixtureBand00001"), revisionId: privateRevisionPublicId }, ctx)
    expect(visibleRevision).toEqual(expect.objectContaining({ publicId: privateRevisionPublicId }))
    expect(visibleRevision).not.toHaveProperty("id")
    expect(visibleRevision).not.toHaveProperty("wikiPage")

    const revisionOnlyPermissions = permissions.filter(
      permission => permission !== Permission.view_users_basic_info,
    )
    const revisionOnlyActor = createAuthorizationTestUser("normal", {
      id: 804,
      permissions: revisionOnlyPermissions,
    })
    const memberPage = {
      ...privateOwnerPage,
      id: 42,
      publicId: memberPagePublicId,
      slug: "member-page",
      createdByUserId: revisionOnlyActor.id,
      visiblePermissionId: null,
      revisions: [{ ...privateOwnerRevision, wikiPageId: 42 }],
      currentRevision: { ...privateOwnerRevision, wikiPageId: 42 },
    }
    resetAuthorizationDatabase({ user: [revisionOnlyActor], wikiPage: [memberPage],
      wikiPageRevision: [{ ...privateOwnerRevision, wikiPageId: memberPage.id }],
    })
    const { ctx: revisionOnlyCtx } = createAuthorizationPersona("normal", {
      id: revisionOnlyActor.id,
      permissions: revisionOnlyPermissions,
    })

    const historyWithoutUserAccess = await invokeResolver(
      getWikiPageRevisions,
      { bandPublicId: parsePublicId<"Band">("FixtureBand00001"), canonicalWikiPath: memberPage.slug },
      revisionOnlyCtx,
    )
    expect(historyWithoutUserAccess?.revisions?.[0]).toEqual(
      expect.objectContaining({ publicId: privateRevisionPublicId }),
    )
    expect(historyWithoutUserAccess?.revisions?.[0]?.createdByUser).toBeNull()
  })
})
