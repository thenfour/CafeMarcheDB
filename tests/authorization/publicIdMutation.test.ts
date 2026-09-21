import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("db", async () => {
    const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
    const { authorizationTestDb } = await import("./support/inMemoryPrisma");
    return { ...prisma, default: authorizationTestDb };
});

import db3Mutation from "tests/authorization/db3MutationTestResolver";
import { isPublicId } from "shared/publicId";
import { Permission } from "shared/permissions";
import { authorizationTestDb } from "./support/inMemoryPrisma";
import { createAuthorizationTestContext, createAuthorizationTestUser } from "./support/authorizationFixtures";
import { invokeResolver } from "./support/resolverHarness";

const originalPublicId = "originalGroup001";
const actor = createAuthorizationTestUser("normal", {
    id: 701,
    permissions: [Permission.login, Permission.admin_instruments],
});
const group = {
    id: 54,
    publicId: originalPublicId,
    name: "Brass",
    description: "",
    color: null,
    sortOrder: 1,
};

describe("InstrumentFunctionalGroup public-ID mutations", () => {
    beforeEach(() => {
        authorizationTestDb.reset({
            user: [actor],
            instrumentFunctionalGroup: [group],
            instrument: [{
                id: 7,
                name: "Trumpet",
                description: "",
                autoAssignFileLeafRegex: null,
                sortOrder: 1,
                functionalGroupId: group.id,
                functionalGroup: group,
                instrumentTags: [],
            }],
            change: [],
        });
    });

    it("resolves a public mutation target and does not return its natural id", async () => {
        const result = await invokeResolver(db3Mutation, {
            tableID: "InstrumentFunctionalGroup",
            tableName: "InstrumentFunctionalGroup",
            mutationType: "update",
            updatePublicId: originalPublicId,
            updateModel: { name: "Brass and winds" },
        }, createAuthorizationTestContext(actor));
        if (!result || typeof result !== "object") throw new Error("Expected updated group payload");

        expect(result).toMatchObject({ publicId: originalPublicId, name: "Brass and winds" });
        expect(result).not.toHaveProperty("id");
        expect(authorizationTestDb.snapshot("instrumentFunctionalGroup")[0]).toMatchObject({
            id: group.id,
            publicId: originalPublicId,
            name: "Brass and winds",
        });
    });

    it("generates public identity on insert and returns it as the client identity", async () => {
        const result = await invokeResolver(db3Mutation, {
            tableID: "InstrumentFunctionalGroup",
            tableName: "InstrumentFunctionalGroup",
            mutationType: "insert",
            insertModel: { name: "Strings", description: "", color: null, sortOrder: 2 },
        }, createAuthorizationTestContext(actor));
        if (!result || typeof result !== "object") throw new Error("Expected inserted group payload");

        expect(isPublicId(result.publicId)).toBe(true);
        expect(result).not.toHaveProperty("id");
        expect(authorizationTestDb.snapshot("instrumentFunctionalGroup")).toEqual(expect.arrayContaining([
            expect.objectContaining({ name: "Strings", publicId: result.publicId }),
        ]));
    });

    it("resolves a public foreign key before Prisma receives an instrument update", async () => {
        const result = await invokeResolver(db3Mutation, {
            tableID: "Instrument",
            tableName: "Instrument",
            mutationType: "update",
            updateId: 7,
            updateModel: { functionalGroupId: originalPublicId },
        }, createAuthorizationTestContext(actor));
        if (!result || typeof result !== "object") throw new Error("Expected updated instrument payload");

        expect(authorizationTestDb.snapshot("instrument")[0]!.functionalGroupId).toBe(group.id);
        expect(result.functionalGroupId).toBe(originalPublicId);
        expect(result.functionalGroup).not.toHaveProperty("id");
    });
});
