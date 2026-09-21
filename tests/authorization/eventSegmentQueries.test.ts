import { Prisma } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("db", async () => {
  const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client")
  const { authorizationTestDb } = await import("./support/inMemoryPrisma")
  return { ...prisma, default: authorizationTestDb }
})

import * as db3 from "@db3/db3"
import db3Query from "@db3/queries/db3queries"
import db3PaginatedQuery from "@db3/queries/db3paginatedQueries"
import db3Mutation from "tests/authorization/db3MutationTestResolver"
import { createAuthorizationPersona } from "./support/authorizationFixtures"
import { forgeDb3Query, forgeDb3Update } from "./support/db3RequestBuilders"
import { authorizationTestDb } from "./support/inMemoryPrisma"
import { invokeResolver } from "./support/resolverHarness"

// Include every Prisma scalar so a newly added database field cannot silently
// disappear from the grid's authorized result.
const makeSegment = (id: number, eventId: number) => ({
  id, eventId, name: `Segment ${id}`, description: "",
  uid: id === 1 ? "segment-uid" : null, statusId: null, startsAt: null,
  durationMillis: BigInt(60_000), isAllDay: false, dateTimeVersion: 2,
} satisfies Prisma.EventSegmentGetPayload<{}>)

const segments = [makeSegment(1, 10), makeSegment(2, 20)]

beforeEach(() => authorizationTestDb.reset())

describe.each([
  ["ordinary", db3Query],
  ["paginated", db3PaginatedQuery],
] as const)("EventSegment %s queries", (_name, resolver) => {
  it.each([
    { params: undefined, ids: [1, 2] },
    { params: {}, ids: [1, 2] },
    { params: { eventId: undefined }, ids: [1, 2] },
    { params: { eventId: null }, ids: [1, 2] },
    { params: { eventId: 10 }, ids: [1] },
    { params: { eventId: 999 }, ids: [] },
  ])("loads sysadmin grid rows with tableParams=$params", async ({ params, ids }) => {
    const { user, ctx } = createAuthorizationPersona("sysadmin")
    authorizationTestDb.reset({ user: [user!], eventSegment: segments })
    const request = forgeDb3Query("EventSegment", { filter: { items: [], tableParams: params } })
    const result = await invokeResolver(resolver, resolver === db3PaginatedQuery
      ? { ...request, skip: 0, take: 20 }
      : request, ctx)

    expect(result.items).toEqual(segments.filter(segment => ids.includes(segment.id)))
    if ("count" in result) expect(result.count).toBe(ids.length)
  })

  it.each(["10", 1.5, NaN, Number.MAX_SAFE_INTEGER + 1, false, {}, []])(
    "rejects invalid eventId=%s before querying segments", async eventId => {
      const { user, ctx } = createAuthorizationPersona("sysadmin")
      authorizationTestDb.reset({ user: [user!] })
      const lookup = vi.spyOn(authorizationTestDb.getDelegate("eventSegment"), "findMany")
      const request = forgeDb3Query("EventSegment", { filter: { items: [], tableParams: { eventId } } })
      await expect(invokeResolver(resolver, resolver === db3PaginatedQuery
        ? { ...request, skip: 0, take: 20 }
        : request, ctx)).rejects.toThrow("filter.tableParams.eventId")
      expect(lookup).not.toHaveBeenCalled()
    },
  )
})

describe("EventSegment generated UID", () => {
  it("recognizes all returned columns without unknown-column diagnostics", () => {
    const { schemaAuthorization } = createAuthorizationPersona("sysadmin")
    const result = db3.xEventSegment.authorizeAndSanitize({
      contextDesc: "event-segment-grid-test", publicData: schemaAuthorization,
      rowMode: "view", model: segments[0]!, fallbackOwnerId: null,
    })
    expect(result.rowIsAuthorized).toBe(true)
    expect(result.unknownColumnCount).toBe(0)
    expect(result.authorizedModel).toEqual(segments[0])
  })

  it("keeps the generated UID protected from generic updates", async () => {
    const { user, ctx } = createAuthorizationPersona("sysadmin")
    authorizationTestDb.reset({ user: [user!], eventSegment: segments })
    await expect(invokeResolver(db3Mutation,
      forgeDb3Update("EventSegment", 1, { uid: "replacement" }), ctx,
    )).rejects.toThrow("Not authorized to mutate EventSegment fields: uid")
    expect(authorizationTestDb.snapshot("eventSegment")[0]!.uid).toBe("segment-uid")
  })
})
