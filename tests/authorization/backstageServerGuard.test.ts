import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("db", async () => {
    const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
    const { authorizationTestDb } = await import("./support/inMemoryPrisma");
    return { ...prisma, default: authorizationTestDb };
});

import { Permission } from "shared/permissions";
import { authorizeBackstagePageRequest } from "src/auth/server/backstagePageRequestAuthorization";
import getUserMassAnalysis from "src/core/db3/queries/getUserMassAnalysis";
import { authorizationTestDb } from "./support/inMemoryPrisma";
import {
    createAuthorizationTestContext,
    createAuthorizationTestUser,
} from "./support/authorizationFixtures";
import { invokeResolver } from "./support/resolverHarness";

const eventAdmin = createAuthorizationTestUser("normal", {
    id: 810,
    permissions: [Permission.login, Permission.admin_events],
});
const roleCarriedSysadmin = createAuthorizationTestUser("normal", {
    id: 811,
    permissions: [Permission.login, Permission.sysadmin],
});
const actualSysadmin = createAuthorizationTestUser("sysadmin", { id: 812 });

describe("backstage server page guard", () => {
    beforeEach(() => {
        authorizationTestDb.reset({
            user: [eventAdmin, roleCarriedSysadmin, actualSysadmin],
        });
    });

    it("allows a delegated route only with its declared capability", async () => {
        await expect(authorizeBackstagePageRequest(
            "/backstage/editEventTags",
            createAuthorizationTestContext(eventAdmin),
        )).resolves.toBeUndefined();

        await expect(authorizeBackstagePageRequest(
            "/backstage/editSongTags",
            createAuthorizationTestContext(eventAdmin),
        )).rejects.toThrow();
    });

    it("accepts the declared sysadmin permission regardless of how it is held", async () => {
        await expect(authorizeBackstagePageRequest(
            "/backstage/roles",
            createAuthorizationTestContext(roleCarriedSysadmin),
        )).resolves.toBeUndefined();
    });

    it("revalidates permission state from the database", async () => {
        const staleContext = createAuthorizationTestContext(eventAdmin);
        authorizationTestDb.reset({
            user: [createAuthorizationTestUser("normal", {
                id: eventAdmin.id,
                permissions: [Permission.login],
            })],
        });

        await expect(authorizeBackstagePageRequest(
            "/backstage/editEventTags",
            staleContext,
        )).rejects.toThrow(`Not authorized for ${Permission.admin_events}`);
    });

    it("allows anonymous access through the public permission baseline", async () => {
        await expect(authorizeBackstagePageRequest(
            "/backstage/practice-tools",
            createAuthorizationTestContext(null),
        )).resolves.toBeUndefined();
    });

    it("keeps contained workflow routes unreachable even to actual Sysadmin", async () => {
        await expect(authorizeBackstagePageRequest(
            "/backstage/workflows",
            createAuthorizationTestContext(actualSysadmin),
        )).rejects.toThrow();
    });

    it("keeps user Mass Analysis behind the sysadmin permission", async () => {
        await expect(invokeResolver(
            getUserMassAnalysis,
            { userId: eventAdmin.id },
            createAuthorizationTestContext(eventAdmin),
        )).rejects.toThrow(`Not authorized for ${Permission.sysadmin}`);
    });

    it("fails closed for an unregistered backstage page", async () => {
        await expect(authorizeBackstagePageRequest(
            "/backstage/notRegistered",
            createAuthorizationTestContext(actualSysadmin),
        )).rejects.toThrow("missing route authorization metadata");
    });
});
