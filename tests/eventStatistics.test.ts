import { describe, expect, it, vi } from "vitest";
import { parsePublicId } from "shared/publicId";
import { EventStatisticsInputSchema } from "src/core/db3/shared/entities/event/eventStatistics";
import getGlobalStats from "src/core/db3/queries/getGlobalStats";
import * as serverAuthorization from "src/auth/server/serverAuthorization";
import { createAuthorizationTestContext, createAuthorizationTestUser } from "./authorization/support/authorizationFixtures";
import { invokeResolver } from "./authorization/support/resolverHarness";

vi.mock("src/auth/server/serverAuthorization", async () => {
    // Retain the real authorization class used by DB3 schema declarations.
    const authorizationModule = await vi.importActual<typeof serverAuthorization>("src/auth/server/serverAuthorization");
    return { ...authorizationModule, loadAuthorization: vi.fn(() => { throw new Error("Invalid statistics input reached authorization."); }) };
});

const input = { bandPublicId: parsePublicId<"Band">("StatisticsBand01"),
    filterSpec: { timing: "All", eventTypeIds: [], eventStatusIds: [], eventTagIds: [], songTagIds: [] } };
describe("Event statistics public input", () => {
    it.each([
        null, {}, { ...input, bandPublicId: null }, { ...input, bandPublicId: 1 }, { ...input, bandId: 1 },
        { ...input, filterSpec: { ...input.filterSpec, timing: "Invalid" } },
        { ...input, filterSpec: { ...input.filterSpec, songTagIds: [1] } },
        { ...input, filterSpec: { ...input.filterSpec, eventTypeIds: [1] } },
        { ...input, filterSpec: { ...input.filterSpec, songTagIds: Array(101).fill("StatisticsTag001") } },
        { ...input, filterSpec: { ...input.filterSpec, eventIds: ["StatisticsEvent1"] } },
    ])("rejects malformed or unscoped input before authorization: %j", async value => {
        vi.mocked(serverAuthorization.loadAuthorization).mockClear();
        const ctx = createAuthorizationTestContext(createAuthorizationTestUser("normal"));
        await expect(invokeResolver(getGlobalStats, value, ctx)).rejects.toThrow();
        expect(serverAuthorization.loadAuthorization).not.toHaveBeenCalled();
    });

    it("retains ordered language preferences and requires every filter dimension", () => {
        const value = { ...input, routeLocale: "fr-BE", browserLanguages: ["nl-BE", "en-US"] };
        expect(EventStatisticsInputSchema.parse(value)).toEqual(value);
        expect(() => EventStatisticsInputSchema.parse({ ...input, filterSpec: { timing: "All" } })).toThrow();
    });
});
