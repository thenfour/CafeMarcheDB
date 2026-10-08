import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("db", async () => {
  const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client")
  const { authorizationTestDb } = await import("./support/inMemoryPrisma")
  return { ...prisma, default: authorizationTestDb }
})

import { seedWikiAuthorization } from "./support/wikiFixtures"
import deleteWikiRevision from "src/core/wiki/mutations/deleteWikiRevision"
import { Permission } from "shared/permissions"
import { parsePublicId } from "shared/publicId"
import { createAuthorizationPersona, createAuthorizationTestUser } from "./support/authorizationFixtures"
import { authorizationTestDb } from "./support/inMemoryPrisma"
import { invokeResolver } from "./support/resolverHarness"

const permissions = [
  Permission.login,
  Permission.admin_wiki_pages,
  Permission.view_wiki_pages,
  Permission.view_wiki_page_revisions,
  Permission.view_users_basic_info,
  Permission.visibility_public,
]
const actor = createAuthorizationTestUser("normal", { id: 811, permissions })
const pagePublicId = parsePublicId<"WikiPage">("WikiPageDelete01")
const oldRevisionPublicId = parsePublicId<"WikiPageRevision">("WikiRevDelete001")
const currentRevisionPublicId = parsePublicId<"WikiPageRevision">("WikiRevDelete002")

const makePage = (visiblePermissionId: number | null = null) => ({
  id: 41,
  bandId: 1,
  publicId: pagePublicId,
  slug: "delete-test",
  createdByUserId: actor.id,
  visiblePermissionId,
  currentRevisionId: 402,
})

const makeRevisions = (page: ReturnType<typeof makePage>) => [
  {
    id: 401,
    publicId: oldRevisionPublicId,
    wikiPageId: page.id,
    wikiPage: page,
    name: "Historical revision",
    content: "Old content",
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
    createdByUserId: actor.id,
    createdByUser: actor,
  },
  {
    id: 402,
    publicId: currentRevisionPublicId,
    wikiPageId: page.id,
    wikiPage: page,
    name: "Current revision",
    content: "Current content",
    createdAt: new Date("2025-01-02T00:00:00.000Z"),
    createdByUserId: actor.id,
    createdByUser: actor,
  },
]

describe("wiki revision deletion authorization", () => {
  beforeEach(() => {
    const page = makePage()
    authorizationTestDb.reset({ user: [actor], wikiPage: [page], wikiPageRevision: makeRevisions(page) })
    seedWikiAuthorization(actor)
  })

  it("requires wiki administration permission", async () => {
    const withoutAdmin = permissions.filter(permission => permission !== Permission.admin_wiki_pages)
    seedWikiAuthorization(createAuthorizationTestUser("normal", { id: actor.id, permissions: withoutAdmin }))
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions: withoutAdmin })

    await expect(invokeResolver(deleteWikiRevision, { bandPublicId: parsePublicId<"Band">("FixtureBand00001"), revisionId: oldRevisionPublicId }, ctx))
      .rejects.toThrow("Not authorized for admin_wiki_pages")
    expect(authorizationTestDb.snapshot("wikiPageRevision")).toHaveLength(2)
  })

  it("requires revision view authorization before resolving the delete target", async () => {
    const withoutRevisionView = permissions.filter(permission => permission !== Permission.view_wiki_page_revisions)
    const restrictedActor = createAuthorizationTestUser("normal", {
      id: actor.id,
      permissions: withoutRevisionView,
    })
    seedWikiAuthorization(restrictedActor)
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions: withoutRevisionView })

    await expect(invokeResolver(deleteWikiRevision, { bandPublicId: parsePublicId<"Band">("FixtureBand00001"), revisionId: oldRevisionPublicId }, ctx))
      .rejects.toThrow("Not authorized to perform this query.")
    expect(authorizationTestDb.snapshot("wikiPageRevision")).toHaveLength(2)
  })

  it("does not delete a revision on a hidden parent page", async () => {
    const page = makePage(999_999)
    authorizationTestDb.getDelegate("wikiPage").reset([page])
    authorizationTestDb.getDelegate("wikiPageRevision").reset(makeRevisions(page))
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    await expect(invokeResolver(deleteWikiRevision, { bandPublicId: parsePublicId<"Band">("FixtureBand00001"), revisionId: oldRevisionPublicId }, ctx))
      .rejects.toThrow("Wiki page revision was not found.")
    expect(authorizationTestDb.snapshot("wikiPageRevision")).toHaveLength(2)
  })

  it("requires visibility of the parent WikiPage table", async () => {
    const withoutPageView = permissions.filter(permission => permission !== Permission.view_wiki_pages)
    const restrictedActor = createAuthorizationTestUser("normal", {
      id: actor.id,
      permissions: withoutPageView,
    })
    seedWikiAuthorization(restrictedActor)
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions: withoutPageView })

    await expect(invokeResolver(deleteWikiRevision, { bandPublicId: parsePublicId<"Band">("FixtureBand00001"), revisionId: oldRevisionPublicId }, ctx))
      .rejects.toThrow("Wiki page revision was not found.")
    expect(authorizationTestDb.snapshot("wikiPageRevision")).toHaveLength(2)
  })

  it("preserves the current revision", async () => {
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    await expect(invokeResolver(deleteWikiRevision, { bandPublicId: parsePublicId<"Band">("FixtureBand00001"), revisionId: currentRevisionPublicId }, ctx))
      .rejects.toThrow("The current wiki page revision cannot be deleted.")
    expect(authorizationTestDb.snapshot("wikiPageRevision")).toHaveLength(2)
    expect(authorizationTestDb.snapshot("change")).toHaveLength(0)
  })

  it("deletes a historical revision through DB3 and records the change", async () => {
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    await invokeResolver(deleteWikiRevision, { bandPublicId: parsePublicId<"Band">("FixtureBand00001"), revisionId: oldRevisionPublicId }, ctx)

    expect(authorizationTestDb.snapshot("wikiPageRevision").map(row => row.publicId))
      .toEqual([currentRevisionPublicId])
    expect(authorizationTestDb.snapshot("change")).toEqual([
      expect.objectContaining({ table: "WikiPageRevision", recordId: 401, action: "delete" }),
    ])
  })
})
