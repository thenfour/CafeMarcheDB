import { parsePortalPath, PORTAL_PATH_QUERY_PARAM } from "src/route/portalRouting"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NotFoundError } from "blitz"

const fileServe = vi.hoisted(() => vi.fn(async (_req, res) => { res.end() }))
const findLink = vi.hoisted(() => vi.fn())
const createVisit = vi.hoisted(() => vi.fn())
const testAuth = vi.hoisted(() => ({ userId: null, userPublicId: null, requireBand: () => ({ id: 7 }) }))
const loadAuth = vi.hoisted(() => vi.fn())
const bandPublicId = "Band000000000007"

vi.mock("src/blitz-server", () => ({ gSSP: (handler: unknown) => handler }))
vi.mock("src/core/db3/server/fileDownload", () => ({ ServeAuthorizedCustomLinkFileDownload: fileServe }))
vi.mock("src/auth/server/serverAuthorization", () => ({ loadAuthorization: loadAuth }))
vi.mock("db", async () => {
  const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client")
  return {
    ...prisma,
    default: {
      customLink: { findUnique: findLink },
      customLinkVisit: { create: createVisit },
    },
  }
})

import { getServerSideProps } from "src/pages/backstage/[...customLinkSlug]"

const portalPath = parsePortalPath(`/b/${bandPublicId}/folder/MyPage`, { kind: "multiBand" })
const serializedPath = JSON.stringify(portalPath)

const directLink = {
  id: 10,
  slug: "MyPage",
  redirectType: "ServeFile",
  file: { publicId: "File000000000001" },
  destinationURL: null,
  forwardQuery: false,
}

describe("custom link direct file response", () => {
  beforeEach(() => {
    fileServe.mockClear()
    findLink.mockReset()
    createVisit.mockReset()
    loadAuth.mockReset().mockResolvedValue(testAuth)
  })

  it("serves at the requested slug with the original request and response", async () => {
    findLink.mockResolvedValue(directLink)
    const req = {
      url: "/MyPage?theme=dark",
      headers: { range: "bytes=10-19" },
      socket: { remoteAddress: "127.0.0.1" },
    }
    const res = { statusCode: 200, end: vi.fn() }
    const ctx = { session: {} }

    // The mocked gSSP handler only uses these request context members.
    const result = await getServerSideProps({
      params: { customLinkSlug: ["MyPage"] },
      query: { customLinkSlug: ["MyPage"], [PORTAL_PATH_QUERY_PARAM]: serializedPath, theme: "dark" },
      req,
      res,
      ctx,
    } as unknown as Parameters<typeof getServerSideProps>[0])

    expect(result).toEqual({ props: {} })
    expect(findLink).toHaveBeenCalledWith({ where: { bandId_slug: { bandId: 7, slug: "MyPage" } }, include: { file: { select: { publicId: true } } } })
    expect(loadAuth).toHaveBeenCalledWith(ctx.session, bandPublicId)
    expect(fileServe).toHaveBeenCalledWith(req, res, testAuth, directLink.file.publicId)
    expect(req.headers.range).toBe("bytes=10-19")
    expect(createVisit).toHaveBeenCalledOnce()
  })

  it("returns 404 when the selected file is gone", async () => {
    findLink.mockResolvedValue({ ...directLink, file: null })
    const res = { statusCode: 200, end: vi.fn() }
    // The mocked gSSP handler only uses these request context members.
    const result = await getServerSideProps({
      params: { customLinkSlug: ["MyPage"] },
      query: { [PORTAL_PATH_QUERY_PARAM]: serializedPath },
      req: { url: "/MyPage", headers: {}, socket: {} },
      res,
      ctx: { session: {} },
    } as unknown as Parameters<typeof getServerSideProps>[0])

    expect(result).toEqual({ props: {} })
    expect(res.statusCode).toBe(404)
    expect(res.end).toHaveBeenCalledOnce()
    expect(fileServe).not.toHaveBeenCalled()
  })

  async function visit(query: { bandPublicId?: string | string[]; theme?: string[]; routeLocale?: string } = { bandPublicId }) {
    const { bandPublicId: selected, routeLocale, ...application } = query
    const metadata = JSON.stringify({ ...portalPath, bandPublicId: selected ?? null, hasBandPrefix: selected !== undefined, routeLocale: routeLocale ?? null })
    // The mocked gSSP handler only uses these request context members.
    return getServerSideProps({
      params: { customLinkSlug: ["folder", "MyPage"] }, query: { customLinkSlug: ["folder", "MyPage"], ...application, [PORTAL_PATH_QUERY_PARAM]: metadata },
      req: { url: "/folder/MyPage", headers: { "user-agent": "browser", referer: "https://source.test" }, socket: { remoteAddress: "127.0.0.1" } },
      res: { statusCode: 200, end: vi.fn() }, ctx: { session: {} },
    } as unknown as Parameters<typeof getServerSideProps>[0])
  }

  it.each(["", "invalid", [bandPublicId], [bandPublicId, "Band000000000008"]])("rejects invalid serialized band parameters: %s", async value => {
    await expect(visit({ bandPublicId: value })).rejects.toThrow()
    expect(loadAuth).not.toHaveBeenCalled()
    expect(findLink).not.toHaveBeenCalled()
    expect(createVisit).not.toHaveBeenCalled()
  })

  it("returns 404 for an unscoped custom link", async () => {
    await expect(visit({})).rejects.toBeInstanceOf(NotFoundError)
    expect(loadAuth).not.toHaveBeenCalled()
  })

  it("returns 404 for an unknown or deleted band", async () => {
    loadAuth.mockRejectedValue(new NotFoundError())
    expect(await visit()).toEqual({ notFound: true })
    expect(findLink).not.toHaveBeenCalled()
  })

  it.each([null, { ...directLink, redirectType: "Disabled" }])("does not record missing or disabled links", async link => {
    findLink.mockResolvedValue(link)
    expect(await visit()).toEqual({ notFound: true })
    expect(createVisit).not.toHaveBeenCalled()
  })

  it.each(["Permanent", "Temporary"])("retains %s redirects, nested slugs, query arrays and visit details", async redirectType => {
    findLink.mockResolvedValue({ ...directLink, redirectType, destinationURL: "https://destination.test/path?existing=1#anchor", forwardQuery: true })
    expect(await visit({ bandPublicId, routeLocale: "fr-BE", theme: ["dark", "light"] })).toEqual({
      redirect: { destination: "https://destination.test/path?existing=1&theme=dark&theme=light#anchor", permanent: redirectType === "Permanent" },
    })
    expect(findLink.mock.calls[0]?.[0].where.bandId_slug).toEqual({ bandId: 7, slug: "folder/MyPage" })
    expect(createVisit).toHaveBeenCalledWith({ data: { customLinkId: 10, visitorIP: "127.0.0.1", userAgent: "browser", referrerURL: "https://source.test", URI: "/folder/MyPage" } })
  })

  it("retains client redirects without forwarding queries", async () => {
    findLink.mockResolvedValue({ ...directLink, redirectType: "Client", destinationURL: "https://destination.test/path" })
    expect(await visit({ bandPublicId, theme: ["dark"] })).toEqual({ props: { destinationURL: "https://destination.test/path", forwardQuery: false, intermediate: false } })
  })

  it("retains the intermediate message and explicit continuation", async () => {
    findLink.mockResolvedValue({ ...directLink, redirectType: "IntermediatePage", destinationURL: "https://destination.test/path", intermediateMessage: "**Read first**" })
    expect(await visit()).toEqual({ props: { destinationURL: "https://destination.test/path", forwardQuery: false, intermediate: true, intermediateMessage: "**Read first**" } })
  })

  it("returns 404 for a redirect with no destination", async () => {
    findLink.mockResolvedValue({ ...directLink, redirectType: "Temporary" })
    expect(await visit()).toEqual({ notFound: true })
  })
})
