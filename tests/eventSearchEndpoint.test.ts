import type { NextApiRequest, NextApiResponse } from "next";
import { AuthenticationError, AuthorizationError, NotFoundError } from "blitz";
import superjson from "superjson";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { ServerPermissionSet } from "src/auth/server/ServerPermissionSet";
import type * as ServerAuthorization from "src/auth/server/serverAuthorization";
import { testBandAuthorization } from "./support/serverAuthorization";
import { createAuthorizationPersona } from "./authorization/support/authorizationFixtures";

vi.mock("src/blitz-server", () => ({ api: (handler: unknown) => handler }));
vi.mock("src/auth/server/serverAuthorization", async () => ({
    ...await vi.importActual<typeof ServerAuthorization>("src/auth/server/serverAuthorization"), loadAuthorization: vi.fn(),
}));
vi.mock("src/core/db3/server/searchServerCore", () => ({ GetSearchResultsCore: vi.fn(), SearchInputError: class extends Error {} }));

import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { GetSearchResultsCore } from "src/core/db3/server/searchServerCore";
import { MakeEmptySearchResultsRet } from "src/core/db3/shared/apiTypes";
import { searchResultsRoute } from "src/pages/api/search/getSearchResultsApi";

const ctx = createAuthorizationPersona("normal").ctx;
const auth = testBandAuthorization({ id: 1 }, new ServerPermissionSet([{ id: 1, name: Permission.login }]));
const args = { tableID: "Event", viewID: "Event_Search", bandPublicId: parsePublicId<"Band">("FixtureBand00001"),
    offset: 0, take: 20, quickFilter: "", sort: [{ db3Column: "name", direction: "asc" }], discreteCriteria: [] };

function request(input: unknown, method = "GET"): NextApiRequest {
    // The handler only reads these HTTP fields; Next owns the rest of IncomingMessage.
    return { method, query: { args: superjson.stringify(input) }, headers: { "accept-language": "nl-BE,fr-BE;q=0.8" } } as unknown as NextApiRequest;
}
function response() {
    const send = vi.fn();
    const json = vi.fn();
    const end = vi.fn();
    const setHeader = vi.fn();
    const status = vi.fn(() => ({ send, json, end }));
    // The isolated handler uses only this response subset.
    const res = { send, json, end, setHeader, status } as unknown as NextApiResponse;
    return { res, send, json, end, setHeader, status };
}

describe("existing event search HTTP owner", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(loadAuthorization).mockResolvedValue(auth);
        vi.mocked(GetSearchResultsCore).mockResolvedValue(MakeEmptySearchResultsRet());
    });

    it("passes explicit band and ordered locale preferences and keeps responses uncached", async () => {
        const res = response();
        await searchResultsRoute(request({ ...args, routeLocale: "fr-BE" }), res.res, ctx);
        expect(loadAuthorization).toHaveBeenCalledWith(ctx.session, args.bandPublicId);
        expect(GetSearchResultsCore).toHaveBeenCalledWith(expect.objectContaining({ ...args, routeLocale: "fr-BE", browserLanguages: ["nl-BE", "fr-BE"] }), auth);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
        expect(superjson.deserialize(res.send.mock.calls[0]![0])).toEqual(MakeEmptySearchResultsRet());
    });

    it("redacts diagnostic SQL for ordinary callers", async () => {
        const result = { ...MakeEmptySearchResultsRet(), filterQueryResult: { errors: [], sqlSelect: "SELECT secret" }, queryMetrics: [{ title: "count", query: "SELECT secret", millis: 1, rowCount: 1 }] };
        vi.mocked(GetSearchResultsCore).mockResolvedValue(result);
        const res = response();
        await searchResultsRoute(request(args), res.res, ctx);
        expect(superjson.deserialize(res.send.mock.calls[0]![0])).toMatchObject({ filterQueryResult: { sqlSelect: "" }, queryMetrics: [{ query: "" }] });
    });

    it.each([{ offset: -1 }, { offset: 0.5 }, { take: 0 }, { take: 1001 }, { sort: [] }, { bandPublicId: 123 }, { includeDeleted: "true" }, { routeLocale: "invalid_locale!" }])("rejects malformed arguments before reading grants: %j", async patch => {
        const res = response();
        await searchResultsRoute(request({ ...args, ...patch }), res.res, ctx);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(loadAuthorization).not.toHaveBeenCalled();
        expect(GetSearchResultsCore).not.toHaveBeenCalled();
    });

    it.each(["Song", "File", "User", "WikiPage"])("keeps %s search deferred before reading accounts/content", async tableID => {
        const res = response();
        await searchResultsRoute(request({ ...args, tableID }), res.res, ctx);
        expect(res.status).toHaveBeenCalledWith(503);
        expect(loadAuthorization).not.toHaveBeenCalled();
    });

    it.each([[new AuthenticationError(), 401], [new AuthorizationError(), 403], [new NotFoundError(), 404]] as const)("maps fresh authorization rejection to HTTP status", async (error, status) => {
        vi.mocked(GetSearchResultsCore).mockRejectedValue(error);
        const res = response();
        await searchResultsRoute(request(args), res.res, ctx);
        expect(res.status).toHaveBeenCalledWith(status);
        expect(res.send).not.toHaveBeenCalled();
    });

    it("rejects unsupported HTTP methods", async () => {
        const res = response();
        await searchResultsRoute(request(args, "POST"), res.res, ctx);
        expect(res.status).toHaveBeenCalledWith(405);
        expect(loadAuthorization).not.toHaveBeenCalled();
    });
});
