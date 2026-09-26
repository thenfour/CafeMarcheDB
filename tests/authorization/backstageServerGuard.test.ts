import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("db", async () => {
    const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
    const { authorizationTestDb } = await import("./support/inMemoryPrisma");
    return { ...prisma, default: authorizationTestDb };
});

import { Permission } from "shared/permissions";
import { authorizePageRequest as authorizeRequest } from "@/src/auth/server/pageRequestAuthorization";
import { loadAuthorizedPageEntity } from "src/auth/server/serverPageAuthorization";
import { xEvent, xInstrument } from "src/core/db3/db3";
import { getQuickSearchResults } from "src/core/db3/server/quickSearchServerCore";
import { QuickSearchItemType } from "shared/quickFilter";
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
    afterEach(() => {
        vi.unstubAllEnvs();
    });

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
        )).rejects.toThrow(new RegExp(`${Permission.admin_events}`));
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
        authorizationTestDb.reset({
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
            publicId: "AbCdEfGhIjKlMn42",
            name: "trumpet",
            description: "",
            sortOrder: 1,
            functionalGroupId: 7,
            autoAssignFileLeafRegex: null,
        };
        const instrumentDelegate = authorizationTestDb.getDelegate("instrument");
        instrumentDelegate.reset([instrument]);
        const load = vi.fn(where => instrumentDelegate.findFirst({ where }));
        const ctx = createAuthorizationTestContext(eventAdmin);

        await expect(loadAuthorizedPageEntity({
            ctx,
            permission: Permission.login,
            table: xInstrument,
            identity: instrument.publicId,
            load,
        })).resolves.toEqual(instrument);

        await expect(loadAuthorizedPageEntity({
            ctx,
            permission: Permission.login,
            table: xInstrument,
            identity: instrument.id,
            load,
        })).rejects.toThrow();//.resolves.toBeNull();
        expect(load).toHaveBeenCalledTimes(1);
    });

    it("returns Instrument quick-search identity and links exclusively as public IDs", async () => {
        vi.stubEnv("CMDB_BASE_URL", "https://example.test");
        authorizationTestDb.getDelegate("instrument").reset([{
            id: 42,
            publicId: "AbCdEfGhIjKlMn42",
            name: "trumpet",
            description: "Bright brass",
        }]);

        const results = await getQuickSearchResults(
            "instrument:trumpet",
            // The authorization fixture intentionally omits unused Permission display fields.
            eventAdmin as Parameters<typeof getQuickSearchResults>[1],
            [QuickSearchItemType.instrument],
        );

        expect(results).toEqual([expect.objectContaining({
            id: "AbCdEfGhIjKlMn42",
            itemType: QuickSearchItemType.instrument,
            name: "trumpet",
        })]);
        expect(results[0]!.absoluteUri).toContain("/backstage/instrument/AbCdEfGhIjKlMn42");
        expect(results[0]!.absoluteUri).not.toContain("/backstage/instrument/42");
    });

    it("returns Event quick-search identity and links exclusively as public IDs", async () => {
        vi.stubEnv("CMDB_BASE_URL", "https://example.test");
        authorizationTestDb.getDelegate("event").reset([{
            id: 42,
            publicId: "EventPublic00042",
            name: "Autumn gala",
            startsAt: new Date("2026-10-10T18:00:00Z"),
            locationDescription: "Town hall",
            createdByUserId: actualSysadmin.id,
            visiblePermissionId: null,
            isDeleted: false,
            descriptionWikiPage: null,
            tags: [],
        }]);

        const results = await getQuickSearchResults(
            "event:gala",
            // The authorization fixture intentionally omits unused generated user fields.
            actualSysadmin as Parameters<typeof getQuickSearchResults>[1],
            [QuickSearchItemType.event],
        );

        expect(results).toEqual([expect.objectContaining({
            id: "EventPublic00042",
            itemType: QuickSearchItemType.event,
            name: expect.stringContaining("Autumn gala"),
        })]);
        expect(results[0]!.absoluteUri).toContain("/backstage/event/EventPublic00042/autumn-gala");
        expect(results[0]!.absoluteUri).not.toContain("/backstage/event/42");
    });

    it("keeps contained routes and unregistered pages closed to anonymous visitors", async () => {
        await expect(authorizePageRequest("/backstage/notRegistered", null))
            .rejects.toThrow("missing route authorization metadata");
    });

    it("keeps experimental event import behind sysadmin at the route and query", async () => {
        await expect(authorizePageRequest(
            "/backstage/eventImport",
            eventAdmin.id,
        )).rejects.toThrow(new RegExp(`${Permission.sysadmin}`));

        await expect(invokeResolver(
            getImportEventData,
            {} as never,
            createAuthorizationTestContext(eventAdmin),
        )).rejects.toThrow(new RegExp(`${Permission.sysadmin}`));
    });

    it("keeps user Mass Analysis behind the sysadmin permission", async () => {
        await expect(invokeResolver(
            getUserMassAnalysis,
            { userId: eventAdmin.id },
            createAuthorizationTestContext(eventAdmin),
        )).rejects.toThrow(new RegExp(`Not authorized for ${Permission.sysadmin}`));
    });

    it("fails closed for an unregistered backstage page", async () => {
        await expect(authorizePageRequest(
            "/backstage/notRegistered",
            actualSysadmin.id,
        )).rejects.toThrow("missing route authorization metadata");
    });
});
