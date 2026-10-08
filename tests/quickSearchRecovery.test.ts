import { describe, expect, it, vi } from "vitest";
import { ApplicationFeatureUnavailableError } from "src/core/shared/applicationRecovery";

type TestRequest = { method: string };
interface TestResponse {
    status: (code: number) => TestResponse;
    json: (payload: { error: string }) => TestResponse;
    end: () => void;
    setHeader: (name: string, value: string) => void;
}
type TestHandler = (request: TestRequest, response: TestResponse) => Promise<void>;
const endpoint = vi.hoisted(() => {
    const state: { handler?: TestHandler } = {};
    return state;
});
vi.mock("src/blitz-server", () => ({ api: (handler: TestHandler) => {
    endpoint.handler = handler;
    return handler;
} }));
vi.mock("db", () => ({ default: new Proxy({}, {
    get: () => {
        throw new Error("Deferred quick search accessed the database.");
    },
}) }));
vi.mock("src/auth/server/serverAuthorization", () => ({ loadAuthorization: () => {
    throw new Error("Deferred public quick search loaded account data.");
} }));

import { config } from "src/pages/api/wiki/quickSearch";
import { getQuickSearchResults } from "src/core/db3/server/quickSearchServerCore";

function responseSpies() {
    const status = vi.fn();
    const json = vi.fn();
    const end = vi.fn();
    const setHeader = vi.fn();
    const response: TestResponse = {
        status: code => {
            status(code);
            return response;
        },
        json: payload => {
            json(payload);
            return response;
        },
        end, setHeader,
    };
    return { response, status, json, end, setHeader };
}

async function invoke(method: string, response: TestResponse) {
    const request = new Proxy({ method }, {
        get: (target, member) => {
            if (member === "method") {
                return target.method;
            }
            throw new Error(`Deferred quick search inspected request ${String(member)}.`);
        },
    });
    if (!endpoint.handler) {
        throw new Error("Quick search endpoint did not initialize.");
    }
    await endpoint.handler(request, response);
}

describe("deferred public quick search HTTP boundary", () => {
    it.each(["GET", "HEAD"])("returns 503 for %s without parsing input, loading authorization or reading data", async method => {
        const spies = responseSpies();
        await invoke(method, spies.response);
        expect(config.api.bodyParser).toBe(false);
        expect(spies.status).toHaveBeenCalledWith(503);
        expect(spies.json).toHaveBeenCalledWith({ error: new ApplicationFeatureUnavailableError("quickSearch").message });
    });

    it.each(["POST", "PUT", "DELETE"])("rejects %s before consuming the body", async method => {
        const spies = responseSpies();
        await invoke(method, spies.response);
        expect(spies.status).toHaveBeenCalledWith(405);
        expect(spies.setHeader).toHaveBeenCalledWith("Allow", "GET, HEAD");
        expect(spies.end).toHaveBeenCalledOnce();
        expect(spies.json).not.toHaveBeenCalled();
    });
});

describe("deferred quick search reader", () => {
    it("rejects before inspecting query, authorization or type filters", async () => {
        const unreadable = new Proxy({}, { get: () => {
            throw new Error("Deferred reader inspected an argument.");
        } });
        await expect(getQuickSearchResults(unreadable, unreadable, unreadable)).rejects.toThrow(ApplicationFeatureUnavailableError);
    });

    it.each([null, "legacy query", { bandPublicId: "Band000000000001", keyword: "private" }])("rejects malformed and contextual input %j", async query => {
        await expect(getQuickSearchResults(query, null, [])).rejects.toThrow("Quick search is temporarily unavailable");
    });
});
