import { authorizationBandId, resetAuthorizationDatabase } from "./support/authorizationSeed";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("db", async () => {
    const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
    const { authorizationTestDb } = await import("./support/inMemoryPrisma");
    return { ...prisma, default: authorizationTestDb };
});

import { authorizePageRequest as authorizeRequest } from "@/src/auth/server/pageRequestAuthorization";
import { Permission } from "shared/permissions";
import { loadAuthorizedPageEntity } from "src/auth/server/serverPageAuthorization";
import { xEvent, xInstrument } from "src/core/db3/db3";
import getUserMassAnalysis from "src/core/db3/queries/getUserMassAnalysis";
import {
    createAuthorizationTestContext,
    createAuthorizationTestUser,
} from "./support/authorizationFixtures";
import { authorizationTestDb } from "./support/inMemoryPrisma";
import { invokeResolver } from "./support/resolverHarness";

const eventAdmin = createAuthorizationTestUser("normal", {
    id: 810,
    permissions: [Permission.login, Permission.manage_global_catalogs],
});
const roleCarriedSysadmin = createAuthorizationTestUser("normal", {
    id: 811,
    permissions: [Permission.login, Permission.sysadmin],
});
const actualSysadmin = createAuthorizationTestUser("sysadmin", { id: 812 });

// Model a distinct Next request for each guard invocation.
const authorizePageRequest = (pathname: string, userId: number | null | undefined) => {
    const user = userId ? createAuthorizationTestUser("normal", { id: userId }) : null;
    return authorizeRequest(pathname, createAuthorizationTestContext(user).session, pathname.startsWith("/backstage") ? authorizationBandId : undefined);
};

describe("backstage server page guard", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    beforeEach(() => {
        resetAuthorizationDatabase({
            user: [eventAdmin, roleCarriedSysadmin, actualSysadmin],
        });
    });

    it("allows a delegated route only with its declared capability", async () => {
        await expect(authorizePageRequest(
            "/platform/editEventTags",
            eventAdmin.id,
        )).resolves.toBeUndefined();

        await expect(authorizePageRequest(
            "/backstage/roles",
            eventAdmin.id,
        )).rejects.toThrow();
    });

    it("revalidates permission state from the database", async () => {
        resetAuthorizationDatabase({
            user: [createAuthorizationTestUser("normal", {
                id: eventAdmin.id,
                permissions: [Permission.login],
            })],
        });

        await expect(authorizePageRequest(
            "/platform/editEventTags",
            eventAdmin.id,
        )).rejects.toThrow(new RegExp(`${Permission.manage_global_catalogs}`));
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
        "/backstage/profile",
        "/backstage/calendar",
        "/backstage/event/[...id_slug_tab]",
        "/backstage/roles",
    ])("requires login for anonymous requests to protected page %s", async pathname => {
        await expect(authorizePageRequest(pathname, null)).rejects.toMatchObject({ statusCode: 401 });
    });

    it("allows any signed-in user to access their profile", async () => {
        resetAuthorizationDatabase({
            user: [createAuthorizationTestUser("normal", {
                id: eventAdmin.id,
                permissions: [Permission.login],
            })],
        });
        await expect(authorizePageRequest("/backstage/profile", eventAdmin.id)).resolves.toBeUndefined();
    });

    it("requires login when the session user no longer exists", async () => {
        await expect(authorizePageRequest("/backstage/profile", 999999))
            .rejects.toMatchObject({ statusCode: 401 });
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

    it("loads an Instrument page by public ID and rejects numeric route identity", async () => {
        const instrument = {
            id: 42,
            bandId: 1,
            isHidden: false,
            globalInstrumentId: null,
            publicId: "AbCdEfGhIjKlMn42",
            name: "trumpet",
            description: "",
            sortOrder: 1,
            functionalGroupId: 7,
            autoAssignFileLeafRegex: null,
        };
        const instrumentDelegate = authorizationTestDb.getDelegate("bandInstrument");
        instrumentDelegate.reset([instrument]);
        authorizationTestDb.getDelegate("bandInstrumentFunctionalGroup").reset([
            { id: 7, bandId: 1, publicId: "GuardGroup000001", isHidden: false, globalFunctionalGroupId: null },
        ]);
        const load = vi.fn(where => instrumentDelegate.findFirst({ where }));
        const ctx = createAuthorizationTestContext(eventAdmin);

        await expect(loadAuthorizedPageEntity({
            ctx,
            permission: Permission.login,
            table: xInstrument,
            bandPublicId: authorizationBandId,
            identity: instrument.publicId,
            load,
        })).resolves.toMatchObject(instrument);

        await expect(loadAuthorizedPageEntity({
            ctx,
            permission: Permission.login,
            table: xInstrument,
            bandPublicId: authorizationBandId,
            identity: instrument.id,
            load,
        })).rejects.toThrow();//.resolves.toBeNull();
        expect(load).toHaveBeenCalledTimes(1);
    });

    it("keeps contained routes and unregistered pages closed to anonymous visitors", async () => {
        await expect(authorizePageRequest("/backstage/notRegistered", null))
            .rejects.toThrow("Invalid route pattern");
    });

    it("keeps import routing protected", async () => {
        await expect(authorizePageRequest(
            "/backstage/eventImport",
            eventAdmin.id,
        )).rejects.toThrow(new RegExp(`${Permission.sysadmin}`));

    });

    it("requires platform Sysadmin authority before returning account dependency data", async () => {
        await expect(invokeResolver(
            getUserMassAnalysis,
            { userId: eventAdmin.publicId },
            createAuthorizationTestContext(eventAdmin),
        )).rejects.toThrow("sysadmin");
    });

    it("fails closed for an unregistered backstage page", async () => {
        await expect(authorizePageRequest(
            "/backstage/notRegistered",
            actualSysadmin.id,
        )).rejects.toThrow("Invalid route pattern");
    });
});
