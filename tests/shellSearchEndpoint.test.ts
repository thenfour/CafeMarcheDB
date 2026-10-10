import type { Ctx } from "@blitzjs/next";
import type { NextApiRequest, NextApiResponse } from "next";
import { AuthorizationError } from "blitz";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parsePublicId } from "shared/publicId";
import { shellSearchItemTypes } from "src/core/db3/shared/quickSearchTypes";

const endpoint = vi.hoisted(() => ({ load: vi.fn(), read: vi.fn() }));
vi.mock("src/blitz-server", () => ({ api: (handler: unknown) => handler }));
vi.mock("src/auth/server/serverAuthorization", () => ({ loadAuthorization: endpoint.load }));
vi.mock("src/core/db3/server/quickSearchServerCore", () => ({ getQuickSearchResults: endpoint.read }));
import { quickSearchRoute } from "src/pages/api/wiki/quickSearch";

const bandPublicId = parsePublicId<"Band">("ShellBand0000001");
const session = { userId: 1 };
const authority = { bandPublicId };
const results = [{ itemType: "song", id: "ShellResult00001", name: "Compass", matchStrength: 1, matchingField: "name",
    absoluteUri: "https://shell.invalid/backstage/song/ShellResult00001?bandPublicId=" + bandPublicId }];
async function invoke(method: string, patch: NextApiRequest["query"] = {}) {
    const spies = { status: vi.fn(), json: vi.fn(), end: vi.fn(), setHeader: vi.fn() };
    const response = { status: (code: number) => { spies.status(code); return response; },
        json: (body: unknown) => { spies.json(body); return response; },
        end: spies.end, setHeader: spies.setHeader };
    // The route uses only these request/response/session members; the HTTP server owns the remaining fields.
    await quickSearchRoute({ method, query: { bandPublicId, keyword: "Compass", allowedItemTypes: JSON.stringify(shellSearchItemTypes), permissionPolicy: "omitUnavailable", ...patch },
        headers: { "accept-language": "nl-BE,fr-BE;q=0.8" } } as unknown as NextApiRequest, response as unknown as NextApiResponse,
    { session } as Ctx);
    return spies;
}
beforeEach(() => {
    endpoint.load.mockReset().mockResolvedValue(authority);
    endpoint.read.mockReset().mockResolvedValue(results);
});

describe("selected-band global search HTTP boundary", () => {
    it("authorizes the explicit band and passes ordered HTTP presentation preferences", async () => {
        const spies = await invoke("GET", { routeLocale: "fr-BE" });
        expect(endpoint.load).toHaveBeenCalledWith(session, bandPublicId);
        expect(endpoint.read).toHaveBeenCalledWith({ bandPublicId, keyword: "Compass", allowedItemTypes: shellSearchItemTypes,
            routeLocale: "fr-BE", browserLanguages: ["nl-BE", "fr-BE"], permissionPolicy: "omitUnavailable" }, authority);
        expect(spies.status).toHaveBeenCalledWith(200);
        expect(spies.json).toHaveBeenCalledWith(results);
        expect(spies.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    });

    it("retains browser preferences separately from the route and authorizes HEAD without a body", async () => {
        const spies = await invoke("HEAD", { routeLocale: "fr-BE", browserLanguages: '["en-US","nl-BE"]' });
        expect(endpoint.read).toHaveBeenCalledWith(expect.objectContaining({ browserLanguages: ["en-US", "nl-BE"] }), authority);
        expect(spies.status).toHaveBeenCalledWith(200);
        expect(spies.end).toHaveBeenCalledOnce();
        expect(spies.json).not.toHaveBeenCalled();
    });

    it("passes the restored person plugin through the same explicit-band authorization boundary", async () => {
        const spies = await invoke("GET", { allowedItemTypes: '["user"]', keyword: "u:Alex", permissionPolicy: "requireAll" });
        expect(spies.status).toHaveBeenCalledWith(200);
        expect(endpoint.read).toHaveBeenCalledWith(expect.objectContaining({ allowedItemTypes: ["user"], keyword: "u:Alex", permissionPolicy: "requireAll" }), authority);
    });

    it.each([{ bandPublicId: undefined }, { bandPublicId: "123" }, { routeLocale: "bad locale" }, { permissionPolicy: undefined }, { permissionPolicy: "unknown" },
        { browserLanguages: "bad json" }, { browserLanguages: '[123]' }])("rejects malformed %j before authorization", async patch => {
        const spies = await invoke("GET", patch);
        expect(spies.status).toHaveBeenCalledWith(400);
        expect(endpoint.load).not.toHaveBeenCalled();
        expect(endpoint.read).not.toHaveBeenCalled();
    });

    it("returns an uncached authorization rejection without reading search content", async () => {
        endpoint.load.mockRejectedValue(new AuthorizationError());
        const spies = await invoke("GET");
        expect(spies.status).toHaveBeenCalledWith(403);
        expect(endpoint.read).not.toHaveBeenCalled();
        expect(spies.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    });
});
