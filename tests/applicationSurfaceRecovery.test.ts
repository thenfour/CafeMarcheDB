import { describe, expect, it, vi } from "vitest";
import { ApplicationFeatureUnavailableError } from "src/core/shared/applicationRecovery";
import { createAuthorizationPersona } from "./authorization/support/authorizationFixtures";

vi.mock("db", async () => {
    const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
    return { ...prisma, default: new Proxy({}, { get: () => {
        throw new Error("Deferred HTTP/search operation accessed the database.");
    } }) };
});

import { GetSearchResultsCore } from "src/core/db3/server/searchServerCore";

describe("remaining deferred domain search", () => {
    it("guards direct SQL search before reading authorization or starting a database snapshot", async () => {
        const auth = createAuthorizationPersona("sysadmin").schemaAuthorization;
        await expect(GetSearchResultsCore({ tableID: "User", offset: 0, take: 20, quickFilter: "private", sort: [], discreteCriteria: [] }, auth))
            .rejects.toThrow(ApplicationFeatureUnavailableError);
    });
});
