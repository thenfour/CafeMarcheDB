import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("db", async () => {
    const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
    const { authorizationTestDb } = await import("./support/inMemoryPrisma");
    return { ...prisma, default: authorizationTestDb };
});

import { Permission } from "shared/permissions";
import { authorizePageRequest as authorizeRequest } from "@/src/auth/server/pageRequestAuthorization";
import { loadAuthorizedPageEntity } from "src/auth/server/serverPageAuthorization";
import { xEvent } from "src/core/db3/db3";
import getUserMassAnalysis from "src/core/db3/queries/getUserMassAnalysis";
import getImportEventData from "src/core/db3/queries/getImportEventData";
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

// Model a distinct Next request for each guard invocation.
const authorizePageRequest = (pathname: string, userId: number | null | undefined) => {
    const user = userId ? createAuthorizationTestUser("normal", { id: userId }) : null;
    return authorizeRequest(pathname, createAuthorizationTestContext(user).session);
};

describe("backstage server page guard", () => {
    beforeEach(() => {
        authorizationTestDb.reset({
            user: [eventAdmin, roleCarriedSysadmin, actualSysadmin],
        });
    });

    it("allows a delegated route only with its declared capability", async () => {
        await expect(authorizePageRequest(
            "/backstage/editEventTags",
            eventAdmin.id,
        )).resolves.toBeUndefined();

        await expect(authorizePageRequest(
            "/backstage/editSongTags",
            eventAdmin.id,
        )).rejects.toThrow();
    });

    it("accepts the declared sysadmin permission regardless of how it is held", async () => {
        await expect(authorizePageRequest(
            "/backstage/roles",
            roleCarriedSysadmin.id,
        )).resolves.toBeUndefined();
    });

    it("revalidates permission state from the database", async () => {
        authorizationTestDb.reset({
            user: [createAuthorizationTestUser("normal", {
                id: eventAdmin.id,
                permissions: [Permission.login],
            })],
        });

        await expect(authorizePageRequest(
            "/backstage/editEventTags",
            eventAdmin.id,
        )).rejects.toThrow(`Not authorized for ${Permission.admin_events}`);
    });

    it("allows anonymous access through the public permission baseline", async () => {
        await expect(authorizePageRequest(
            "/backstage/practice-tools",
            undefined,
        )).resolves.toBeUndefined();
    });

    it.each([
        ["/backstage", null],
        ["/backstage/", undefined],
    ] as const)("allows the anonymous dashboard login frame at %s", async (pathname, userId) => {
        await expect(authorizePageRequest(pathname, userId)).resolves.toBeUndefined();
    });

    it.each([
        "/backstage/calendar",
        "/backstage/event/[...id_slug_tab]",
        "/backstage/roles",
    ])("rejects anonymous requests to protected page %s", async pathname => {
        await expect(authorizePageRequest(pathname, null)).rejects.toMatchObject({ statusCode: 403 });
    });

    it("does not load protected entity data for an anonymous visitor", async () => {
        const load = vi.fn();
        await expect(loadAuthorizedPageEntity({
            ctx: createAuthorizationTestContext(null),
            permission: Permission.view_events_nonpublic,
            table: xEvent,
            id: 1,
            load,
        })).resolves.toBeNull();
        expect(load).not.toHaveBeenCalled();
    });

    it("keeps contained routes and unregistered pages closed to anonymous visitors", async () => {
        await expect(authorizePageRequest("/backstage/workflows", null)).rejects.toThrow();
        await expect(authorizePageRequest("/backstage/notRegistered", null))
            .rejects.toThrow("missing route authorization metadata");
    });

    it("keeps contained workflow routes unreachable even to Sysadmin", async () => {
        await expect(authorizePageRequest(
            "/backstage/workflows",
            actualSysadmin.id,
        )).rejects.toThrow();
    });

    it("keeps experimental event import behind sysadmin at the route and query", async () => {
        await expect(authorizePageRequest(
            "/backstage/eventImport",
            eventAdmin.id,
        )).rejects.toThrow(`Not authorized for ${Permission.sysadmin}`);

        await expect(invokeResolver(
            getImportEventData,
            {} as never,
            createAuthorizationTestContext(eventAdmin),
        )).rejects.toThrow(`required: ${Permission.sysadmin}`);
    });

    it("keeps user Mass Analysis behind the sysadmin permission", async () => {
        await expect(invokeResolver(
            getUserMassAnalysis,
            { userId: eventAdmin.id },
            createAuthorizationTestContext(eventAdmin),
        )).rejects.toThrow(`Not authorized for ${Permission.sysadmin}`);
    });

    it("fails closed for an unregistered backstage page", async () => {
        await expect(authorizePageRequest(
            "/backstage/notRegistered",
            actualSysadmin.id,
        )).rejects.toThrow("missing route authorization metadata");
    });
});
