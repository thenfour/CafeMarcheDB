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
import getUserCredits from "@db3/queries/getUserCredits"
import getUserTagWithAssignments from "@db3/queries/getUserTagWithAssignments"
import getUserWikiContributions from "@db3/queries/getUserWikiContributions"
import { getCurrentUserCore } from "@db3/server/db3mutationCore"
import getWikiPageRevision from "src/core/wiki/queries/getWikiPageRevision"
import getWikiPageRevisions from "src/core/wiki/queries/getWikiPageRevisions"
import { Permission } from "shared/permissions"
import {
  createAuthorizationPersona,
  createAuthorizationTestUser,
} from "./support/authorizationFixtures"
import { authorizationTestDb } from "./support/inMemoryPrisma"
import { invokeResolver } from "./support/resolverHarness"

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
const publicVisibilityId = actor.role!.permissions.find(
  entry => entry.permission.name === Permission.visibility_public,
)!.permissionId
const membersVisibilityId = actor.role!.permissions.find(
  entry => entry.permission.name === Permission.visibility_members,
)!.permissionId
const hiddenVisibilityId = 999_999

describe("direct DB3-managed reads use the canonical row scope", () => {
  beforeEach(() => {
    authorizationTestDb.reset({ user: [actor] })
  })

  it("does not resolve a soft-deleted session actor as the current user", async () => {
    authorizationTestDb.reset({ user: [{ ...actor, isDeleted: true }] })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    await expect(getCurrentUserCore(ctx)).resolves.toBeNull()
  })

  it("requires revision-history permission for direct revision and contribution reads", async () => {
    const pageOnlyPermissions = permissions.filter(
      permission => permission !== Permission.view_wiki_page_revisions,
    )
    const pageOnlyActor = createAuthorizationTestUser("normal", {
      id: 803,
      permissions: pageOnlyPermissions,
    })
    authorizationTestDb.reset({ user: [pageOnlyActor] })
    const { ctx } = createAuthorizationPersona("normal", {
      id: pageOnlyActor.id,
      permissions: pageOnlyPermissions,
    })

    await expect(invokeResolver(getWikiPageRevision, { revisionId: 1 }, ctx)).rejects.toThrow(
      "Unauthorized test persona; required: view_wiki_page_revisions",
    )
    await expect(invokeResolver(
      getUserWikiContributions,
      { userId: pageOnlyActor.id },
      ctx,
    )).rejects.toThrow("Unauthorized test persona; required: view_wiki_page_revisions")
  })

  it("filters hidden and deleted songs in direct ID lookups", async () => {
    authorizationTestDb.getDelegate("song").reset([
      {
        id: 1,
        name: "Visible",
        isDeleted: false,
        createdByUserId: actor.id + 1,
        visiblePermissionId: membersVisibilityId,
        tags: [{
          id: 70,
          publicId: "SongAssocPublic1",
          songId: 1,
          tagId: 20,
          tag: { id: 20, publicId: "SongTagPublic001" },
        }],
      },
      {
        id: 2,
        name: "Hidden",
        isDeleted: false,
        createdByUserId: actor.id + 1,
        visiblePermissionId: hiddenVisibilityId,
        tags: [],
      },
      {
        id: 3,
        name: "Deleted",
        isDeleted: true,
        createdByUserId: actor.id + 1,
        visiblePermissionId: membersVisibilityId,
        tags: [],
      },
    ])
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    await expect(invokeResolver(getFilteredSongs, { id: 1 }, ctx)).resolves.toEqual({
      matchingItem: expect.objectContaining({
        id: 1,
        name: "Visible",
        tags: [{
          publicId: "SongAssocPublic1",
          songId: 1,
          tagId: "SongTagPublic001",
        }],
      }),
    })
    await expect(invokeResolver(getFilteredSongs, { id: 2 }, ctx)).resolves.toEqual({ matchingItem: null })
    await expect(invokeResolver(getFilteredSongs, { id: 3 }, ctx)).resolves.toEqual({ matchingItem: null })
  })

  it("returns private songs to their owner without widening the requested ID", async () => {
    authorizationTestDb.getDelegate("song").reset([
      {
        id: 10,
        name: "Mine",
        isDeleted: false,
        createdByUserId: actor.id,
        visiblePermissionId: null,
        tags: [],
      },
      {
        id: 11,
        name: "Also mine",
        isDeleted: false,
        createdByUserId: actor.id,
        visiblePermissionId: null,
        tags: [],
      },
    ])
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    const result = await invokeResolver(getFilteredSongs, { id: 10 }, ctx)

    expect(result.matchingItem).toEqual(expect.objectContaining({ id: 10 }))
  })

  it("filters the song and its pinned File independently", async () => {
    const visibleSong = {
      id: 20,
      name: "Visible song",
      isDeleted: false,
      createdByUserId: actor.id + 1,
      visiblePermissionId: publicVisibilityId,
      pinnedRecordingId: 200,
      pinnedRecording: {
        id: 200,
        isDeleted: false,
        uploadedByUserId: actor.id + 1,
        visiblePermissionId: hiddenVisibilityId,
      },
    }
    authorizationTestDb.getDelegate("song").reset([visibleSong])
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    await expect(invokeResolver(getSongPinnedRecording, { songIds: [20] }, ctx)).resolves.toEqual({})

    authorizationTestDb.getDelegate("song").reset([{
      ...visibleSong,
      pinnedRecording: {
        ...visibleSong.pinnedRecording,
        visiblePermissionId: publicVisibilityId,
      },
    }])
    await expect(invokeResolver(getSongPinnedRecording, { songIds: [20] }, ctx)).resolves.toEqual({
      20: expect.objectContaining({ id: 200 }),
    })
  })

  it("filters user credit associations through the related Song policy", async () => {
    const analyticsPermissions = [...permissions, Permission.manage_users]
    const analyticsActor = createAuthorizationTestUser("normal", {
      id: 804,
      permissions: analyticsPermissions,
    })
    authorizationTestDb.reset({
      user: [analyticsActor],
      songCredit: [
        {
          id: 501,
          publicId: "SongCredit000501",
          userId: 900,
          songId: 51,
          typeId: 71,
          year: "2025",
          comment: "Visible credit",
          type: { id: 71, publicId: "CreditType000071", text: "Composer" },
          song: {
            id: 51,
            isDeleted: false,
            createdByUserId: analyticsActor.id + 1,
            visiblePermissionId: publicVisibilityId,
          },
        },
        {
          id: 502,
          publicId: "SongCredit000502",
          userId: 900,
          songId: 52,
          typeId: 71,
          year: "2025",
          comment: "Hidden credit",
          type: { id: 71, publicId: "CreditType000071", text: "Composer" },
          song: {
            id: 52,
            isDeleted: false,
            createdByUserId: analyticsActor.id + 1,
            visiblePermissionId: hiddenVisibilityId,
          },
        },
        {
          id: 503,
          publicId: "SongCredit000503",
          userId: 900,
          songId: 53,
          typeId: 71,
          year: "2025",
          comment: "Deleted-song credit",
          type: { id: 71, publicId: "CreditType000071", text: "Composer" },
          song: {
            id: 53,
            isDeleted: true,
            createdByUserId: analyticsActor.id + 1,
            visiblePermissionId: publicVisibilityId,
          },
        },
      ],
    })
    const { ctx } = createAuthorizationPersona("normal", {
      id: analyticsActor.id,
      permissions: analyticsPermissions,
    })

    const result = await invokeResolver(getUserCredits, { userId: 900, take: 10 }, ctx)

    expect(result.songCredits.map(credit => credit.publicId)).toEqual(["SongCredit000501"])
  })

  it("scopes public user-tag assignments to active users", async () => {
    const userTagPublicId = "UserTagPublic061"
    authorizationTestDb.getDelegate("userTag").reset([{
      id: 61,
      publicId: userTagPublicId,
      text: "Members",
      description: "",
      userAssignments: [],
    }])
    const findMany = vi.spyOn(authorizationTestDb.getDelegate("userTag"), "findMany")
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    await invokeResolver(getUserTagWithAssignments, { userTagIds: [userTagPublicId] }, ctx)

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        userAssignments: expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([{ user: { isDeleted: false } }]),
          }),
        }),
      }),
    }))
  })

  it("filters hidden SetlistPlan rows before deserialization", async () => {
    authorizationTestDb.getDelegate("setlistPlan").reset([{
      id: 30,
      name: "Hidden plan",
      isDeleted: false,
      createdByUserId: actor.id,
      visiblePermissionId: hiddenVisibilityId,
      payloadJson: "not relevant because the row must be filtered",
    }])
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    // Ownership makes a null visibility row readable, but it must not override
    // an explicit visibility permission the actor does not possess.
    await expect(invokeResolver(getSetlistPlans, { userId: actor.id }, ctx)).resolves.toEqual([])
  })

  it("applies WikiPage visibility to page, contribution, and revision reads", async () => {
    const hiddenPage = {
      id: 40,
      slug: "hidden",
      createdByUserId: actor.id + 1,
      visiblePermissionId: hiddenVisibilityId,
      revisions: [{ id: 401, createdByUserId: actor.id }],
    }
    const privateOwnerPage = {
      id: 41,
      slug: "private-owner",
      createdByUserId: actor.id,
      visiblePermissionId: null,
      revisions: [{ id: 411, createdByUserId: actor.id }],
    }
    authorizationTestDb.getDelegate("wikiPage").reset([hiddenPage, privateOwnerPage])
    authorizationTestDb.getDelegate("wikiPageRevision").reset([
      { id: 401, wikiPage: hiddenPage },
      { id: 411, wikiPage: privateOwnerPage },
    ])
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    await expect(invokeResolver(
      getWikiPageRevisions,
      { canonicalWikiPath: "hidden" },
      ctx,
    )).resolves.toBeNull()
    await expect(invokeResolver(
      getWikiPageRevisions,
      { canonicalWikiPath: "private-owner" },
      ctx,
    )).resolves.toEqual(expect.objectContaining({ id: 41 }))
    await expect(invokeResolver(
      getUserWikiContributions,
      { userId: actor.id },
      ctx,
    )).resolves.toEqual({ wikiContributions: [privateOwnerPage] })
    await expect(invokeResolver(getWikiPageRevision, { revisionId: 401 }, ctx)).resolves.toBeNull()
    await expect(invokeResolver(getWikiPageRevision, { revisionId: 411 }, ctx)).resolves.toEqual(
      expect.objectContaining({ id: 411 }),
    )
  })
})
