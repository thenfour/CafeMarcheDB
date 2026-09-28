import { beforeEach, describe, expect, it, vi } from "vitest"

const fileServe = vi.hoisted(() => vi.fn(async (_req, res) => { res.end() }))
const findLink = vi.hoisted(() => vi.fn())
const createVisit = vi.hoisted(() => vi.fn())
const testAuth = vi.hoisted(() => ({ userId: null, userPublicId: null }))

vi.mock("src/blitz-server", () => ({ gSSP: (handler: unknown) => handler }))
vi.mock("src/core/db3/server/fileDownload", () => ({ ServeAuthorizedFileDownload: fileServe }))
vi.mock("src/auth/server/serverAuthorization", () => ({ loadAuthorization: async () => testAuth }))
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

import { getServerSideProps } from "src/pages/[...customLinkSlug]"

const directLink = {
  id: 10,
  slug: "MyPage",
  redirectType: "ServeFile",
  file: { storedLeafName: "stored-page.html" },
  destinationURL: null,
  forwardQuery: false,
}

describe("custom link direct file response", () => {
  beforeEach(() => {
    fileServe.mockClear()
    findLink.mockReset()
    createVisit.mockReset()
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
      query: { customLinkSlug: ["MyPage"], theme: "dark" },
      req,
      res,
      ctx,
    } as unknown as Parameters<typeof getServerSideProps>[0])

    expect(result).toEqual({ props: {} })
    expect(findLink).toHaveBeenCalledWith({ where: { slug: "MyPage" }, include: { file: true } })
    expect(fileServe).toHaveBeenCalledWith(req, res, testAuth, "stored-page.html")
    expect(req.headers.range).toBe("bytes=10-19")
    expect(createVisit).toHaveBeenCalledOnce()
  })

  it("returns 404 when the selected file is gone", async () => {
    findLink.mockResolvedValue({ ...directLink, file: null })
    const res = { statusCode: 200, end: vi.fn() }
    // The mocked gSSP handler only uses these request context members.
    const result = await getServerSideProps({
      params: { customLinkSlug: ["MyPage"] },
      query: {},
      req: { url: "/MyPage", headers: {}, socket: {} },
      res,
      ctx: { session: {} },
    } as unknown as Parameters<typeof getServerSideProps>[0])

    expect(result).toEqual({ props: {} })
    expect(res.statusCode).toBe(404)
    expect(res.end).toHaveBeenCalledOnce()
    expect(fileServe).not.toHaveBeenCalled()
  })
})
