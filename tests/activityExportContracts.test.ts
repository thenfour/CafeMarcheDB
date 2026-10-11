import { describe, expect, it, vi } from "vitest";
import type { Ctx } from "blitz";
import { ZodError } from "zod";
import type * as PrismaClientModule from "@prisma/client";

vi.mock("db", async () => {
    const prisma = await vi.importActual<typeof PrismaClientModule>("@prisma/client");
    return { ...prisma, default: new Proxy({}, { get: (_target, member) => {
        throw new Error(`Invalid activity request accessed database member ${String(member)}.`);
    } }) };
});

import getDetailCsv from "src/core/components/featureReports/queries/getDetailCsv";
import getGeneralFeatureDetail from "src/core/components/featureReports/queries/getGeneralFeatureDetail";
import { createAuthorizationTestContext } from "./authorization/support/authorizationFixtures";
import { invokeResolver } from "./authorization/support/resolverHarness";
import { activityExportInput } from "./support/activityExportFixture";

// The readers return different DTOs; these boundary checks only observe their rejection.
const readers: readonly { readonly name: string; readonly call: (input: unknown, ctx: Ctx) => Promise<unknown> }[] = [
    { name: "CSV", call: (input, ctx) => invokeResolver(getDetailCsv, input, ctx) },
    { name: "general detail", call: (input, ctx) => invokeResolver(getGeneralFeatureDetail, input, ctx) },
];

describe.each(readers)("$name request boundary", ({ call }) => {
    it.each([
        { bandPublicId: undefined }, { bandId: 1 }, { limit: 1_000_000 }, { selectedBucket: null }, { detail: { facet: "total" } },
        { timeZone: "UTC" }, { startDate: activityExportInput.endDateExclusive },
        { filterSpec: { ...activityExportInput.filterSpec, contextBeginsWith: "App/profile/867/Alice" } },
        { facetFilters: { ...activityExportInput.facetFilters, includeEventIds: [1] } },
        { facetFilters: { ...activityExportInput.facetFilters, includeMenuLinkIds: [1] } },
        { facetFilters: { ...activityExportInput.facetFilters, includeCustomLinkIds: [1] } },
    ])("rejects forged or unsupported inputs before any authorization or database read: %j", async override => {
        await expect(call({ ...activityExportInput, ...override }, createAuthorizationTestContext(null))).rejects.toBeInstanceOf(ZodError);
    });
    it("rejects the preserved legacy input before reading data", async () => {
        await expect(call({ refreshTrigger: 0, filterSpec: { selectedBucket: "2026-01-01" } }, createAuthorizationTestContext(null)))
            .rejects.toBeInstanceOf(ZodError);
    });
});
