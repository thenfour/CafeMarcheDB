import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { parsePublicId } from "shared/publicId";
import { ServerPermissionSet } from "src/auth/server/ServerPermissionSet";
import { testBandAuthorization } from "./support/serverAuthorization";

type TestRequest = { method: string; query: { allowedItemTypes?: string; keyword?: string; bandPublicId?: string; routeLocale?: string }; headers: {} };
interface TestResponse {
    status: (code: number) => TestResponse;
    json: (payload: unknown) => TestResponse;
    end: () => void;
    setHeader: (name: string, value: string) => void;
}
type TestHandler = (request: TestRequest, response: TestResponse) => Promise<void>;
const endpoint = vi.hoisted(() => {
    const state: { handler?: TestHandler; load: ReturnType<typeof vi.fn> } = { load: vi.fn() };
    return state;
});
vi.mock("src/blitz-server", () => ({ api: (handler: TestHandler) => {
    endpoint.handler = handler;
    return handler;
} }));
vi.mock("db", async () => ({
    ...await vi.importActual<typeof import("@prisma/client")>("@prisma/client"),
    default: new Proxy({}, { get: () => { throw new Error("Deferred search accessed the database."); } }),
}));
vi.mock("src/auth/server/serverAuthorization", async () => ({
    ...await vi.importActual<typeof import("src/auth/server/serverAuthorization")>("src/auth/server/serverAuthorization"),
    loadAuthorization: endpoint.load,
}));
import { config } from "src/pages/api/wiki/quickSearch";
import { getQuickSearchResults } from "src/core/db3/server/quickSearchServerCore";

function responseSpies() {
    const status = vi.fn();
    const json = vi.fn();
    const end = vi.fn();
    const setHeader = vi.fn();
    const response: TestResponse = {
        status: code => { status(code); return response; },
        json: payload => { json(payload); return response; },
        end, setHeader,
    };
    return { response, status, json, end, setHeader };
}
async function invoke(method: string, query: TestRequest["query"]) {
    const spies = responseSpies();
    if (!endpoint.handler) {
        throw new Error("Quick search endpoint did not initialize.");
    }
    await endpoint.handler({ method, query, headers: {} }, spies.response);
    return spies;
}
beforeEach(() => endpoint.load.mockClear());

describe("quick search HTTP argument boundary", () => {
    it.each(["GET", "HEAD"])("rejects invalid domains for %s before authorization", async method => {
        for (const allowedItemTypes of [["unknown"], ["song", 123], []]) {
            const spies = await invoke(method, { allowedItemTypes: JSON.stringify(allowedItemTypes) });
            expect(config.api.bodyParser).toBe(false);
            expect(spies.status).toHaveBeenCalledWith(400);
            expect(spies.json).toHaveBeenCalledWith({ error: "Invalid search arguments" });
            expect(spies.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
        }
        expect(endpoint.load).not.toHaveBeenCalled();
    });
    it.each(["POST", "PUT", "DELETE"])("rejects %s before parsing arguments", async method => {
        const spies = await invoke(method, {});
        expect(spies.status).toHaveBeenCalledWith(405);
        expect(spies.setHeader).toHaveBeenCalledWith("Allow", "GET, HEAD");
        expect(spies.end).toHaveBeenCalledOnce();
        expect(endpoint.load).not.toHaveBeenCalled();
    });
    it.each([{}, { allowedItemTypes: "invalid" }, { allowedItemTypes: '["song"]', keyword: "Song" },
        { allowedItemTypes: '["song"]', keyword: "Song", bandPublicId: "123" },
        { allowedItemTypes: '["song"]', keyword: "Song", bandPublicId: "FixtureBand00001", routeLocale: "bad locale" }])(
        "rejects malformed song input %j before authorization", async query => {
            const spies = await invoke("GET", query);
            expect(spies.status).toHaveBeenCalledWith(400);
            expect(endpoint.load).not.toHaveBeenCalled();
        },
    );
});

describe("direct quick search arguments", () => {
    it("rejects an empty domain list before snapshots or data", async () => {
        const auth = testBandAuthorization(null, new ServerPermissionSet([]));
        await expect(getQuickSearchResults({ bandPublicId: parsePublicId<"Band">("FixtureBand00001"), keyword: "private", allowedItemTypes: [], permissionPolicy: "requireAll" }, auth))
            .rejects.toThrow(ZodError);
    });
});
