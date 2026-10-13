import type { Ctx } from "blitz";
import { AuthorizationError, NotFoundError } from "blitz";
import type { NextApiRequest, NextApiResponse } from "next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({ feed: vi.fn(), sessionAuth: vi.fn(), publicAuth: vi.fn(), getSession: vi.fn() }));
vi.mock("db", () => ({ default: {} }));
vi.mock("src/blitz-server", () => ({ getSessionForRequest: mocked.getSession }));
vi.mock("src/auth/server/serverAuthorization", () => ({ loadAuthorization: mocked.sessionAuth, loadAuthorizationForUser: mocked.publicAuth }));
vi.mock("src/core/db3/server/publicFeed", () => ({ readPublicFeed: mocked.feed }));

import { config, publicFeedHandler } from "src/pages/api/public";
const bandPublicId = "PublicationBand1";
// Blitz provides many context methods; this route only consumes its session.
const context = { session: { userId: 17 } } as Ctx;

async function request(method: string, query: NextApiRequest["query"] = { bandPublicId }, headers: NextApiRequest["headers"] = {}) {
    // Test the route's HTTP boundary without constructing Node sockets or a Blitz response wrapper.
    const req = { method, query, headers } as NextApiRequest;
    const response = { setHeader: vi.fn(), status: vi.fn(), end: vi.fn(), json: vi.fn() };
    response.status.mockReturnValue(response);
    // The handler consumes these four response methods, which are captured above.
    await publicFeedHandler(req, response as unknown as NextApiResponse, context);
    return response;
}

beforeEach(() => {
    vi.stubEnv("CMDB_BASE_URL", "https://publication.invalid");
    vi.stubEnv("CMDB_HOSTING_MODE", "Platform");
    mocked.feed.mockReset().mockResolvedValue({ agenda: [], gallery: [] });
    mocked.sessionAuth.mockReset().mockResolvedValue("member authorization");
    mocked.publicAuth.mockReset().mockResolvedValue("anonymous authorization");
});
afterEach(() => { vi.unstubAllEnvs(); });

describe("public publication HTTP boundary", () => {
    it.each(["OPTIONS", "POST", "PUT"])("handles %s without inspecting input or loading accounts/content", async method => {
        const response = await request(method, { bandPublicId: "bad", private: "true" });
        expect(response.status).toHaveBeenCalledWith(method === "OPTIONS" ? 204 : 405);
        expect(mocked.feed).not.toHaveBeenCalled();
        expect(mocked.sessionAuth).not.toHaveBeenCalled();
        expect(mocked.publicAuth).not.toHaveBeenCalled();
        expect(response.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
        expect(response.setHeader).toHaveBeenCalledWith("Access-Control-Allow-Origin", "*");
        expect(config.api.bodyParser).toBe(false);
    });
    it.each([{}, { bandPublicId: "bad" }, { bandPublicId: [bandPublicId, bandPublicId] },
        { bandPublicId, lang: "not_a_locale" }, { bandPublicId, lang: "fr", routeLocale: "nl" },
        { bandPublicId, includeDeleted: "true" }])("rejects invalid/ambiguous/forged selection %j before reading", async query => {
        const response = await request("GET", query);
        expect(response.status).toHaveBeenCalledWith(400);
        expect(mocked.feed).not.toHaveBeenCalled();
        expect(mocked.sessionAuth).not.toHaveBeenCalled();
    });
    it("preserves weighted language hints and same-origin member authorization", async () => {
        const response = await request("GET", { bandPublicId, lang: "de-DE" }, { origin: "https://publication.invalid", "accept-language": "fr-CA, nl-NL;q=0.8" });
        expect(mocked.sessionAuth).toHaveBeenCalledWith(context.session, bandPublicId);
        expect(mocked.publicAuth).not.toHaveBeenCalled();
        expect(mocked.feed).toHaveBeenCalledWith({}, "member authorization", {
            bandPublicId, routeLocale: "de-DE", browserLanguages: ["fr-CA", "nl-NL"],
        }, { baseURL: "https://publication.invalid/", hosting: { kind: "platform" } });
        expect(response.status).toHaveBeenCalledWith(200);
        expect(response.json).toHaveBeenCalledWith({ agenda: [], gallery: [] });
    });
    it("forces cross-origin publication to public visibility even when a session is present", async () => {
        const response = await request("GET", { bandPublicId, routeLocale: "fr-BE" }, { origin: "https://standalone.invalid" });
        expect(mocked.publicAuth).toHaveBeenCalledWith(null, undefined, bandPublicId);
        expect(mocked.sessionAuth).not.toHaveBeenCalled();
        expect(mocked.feed.mock.calls[0]?.[1]).toBe("anonymous authorization");
        expect(response.setHeader).not.toHaveBeenCalledWith("Access-Control-Allow-Credentials", expect.anything());
    });
    it("returns HEAD without a response body", async () => {
        const response = await request("HEAD");
        expect(response.status).toHaveBeenCalledWith(200);
        expect(response.end).toHaveBeenCalledOnce();
        expect(response.json).not.toHaveBeenCalled();
    });
    it.each([[new NotFoundError(), 404], [new AuthorizationError(), 403]])("maps visibility failures to HTTP status", async (error, code) => {
        mocked.feed.mockRejectedValue(error);
        const response = await request("GET");
        expect(response.status).toHaveBeenCalledWith(code);
    });
});
