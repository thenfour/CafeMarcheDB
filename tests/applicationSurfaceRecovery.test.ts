import { describe, expect, it, vi } from "vitest";
import { ApplicationFeatureUnavailableError } from "src/core/shared/applicationRecovery";
import { createAuthorizationPersona } from "./authorization/support/authorizationFixtures";

interface RecoveryResponse {
    status: (code: number) => RecoveryResponse;
    end: () => void;
    setHeader: (name: string, value: string) => void;
}
type RecoveryHandler = (request: object, response: RecoveryResponse) => Promise<void>;
const endpoints = vi.hoisted(() => {
    const handlers: RecoveryHandler[] = [];
    return { handlers };
});
vi.mock("src/blitz-server", () => ({ api: (handler: RecoveryHandler) => {
    endpoints.handlers.push(handler);
    return handler;
} }));
vi.mock("db", async () => {
    const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
    return { ...prisma, default: new Proxy({}, { get: () => {
        throw new Error("Deferred HTTP/search operation accessed the database.");
    } }) };
});

import { config as publicConfig } from "src/pages/api/public";
import { config as searchConfig } from "src/pages/api/search/getSearchResultsApi";
import { GetSearchResultsCore } from "src/core/db3/server/searchServerCore";

describe("deferred public feed and domain search", () => {
    it("disables body parsing and returns uncached 503 without inspecting input or loading accounts/content", async () => {
        expect(publicConfig.api.bodyParser).toBe(false);
        expect(searchConfig.api.bodyParser).toBe(false);
        expect(endpoints.handlers).toHaveLength(2);
        const request = new Proxy({}, { get: () => {
            throw new Error("Deferred HTTP endpoint inspected input.");
        } });
        for (const handler of endpoints.handlers) {
            const status = vi.fn();
            const setHeader = vi.fn();
            const end = vi.fn();
            const response: RecoveryResponse = {
                status: code => {
                    status(code);
                    return response;
                },
                setHeader, end,
            };
            await handler(request, response);
            expect(status).toHaveBeenCalledWith(503);
            expect(setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
            expect(end).toHaveBeenCalledOnce();
        }
    });

    it("guards direct SQL search before reading authorization or starting a database snapshot", async () => {
        const auth = createAuthorizationPersona("sysadmin").schemaAuthorization;
        await expect(GetSearchResultsCore({ tableID: "Event", offset: 0, take: 20, quickFilter: "private", sort: [], discreteCriteria: [] }, auth))
            .rejects.toThrow(ApplicationFeatureUnavailableError);
    });
});
