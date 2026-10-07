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
import getImportEventData from "src/core/db3/queries/getImportEventData";
import getUserMassAnalysis from "src/core/db3/queries/getUserMassAnalysis";
import {
    createAuthorizationTestContext,
    createAuthorizationTestUser,
} from "./support/authorizationFixtures";
import { authorizationTestDb } from "./support/inMemoryPrisma";
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

    it("keeps contained routes and unregistered pages closed to anonymous visitors", async () => {
        await expect(authorizePageRequest("/backstage/notRegistered", null))
            .rejects.toThrow("missing route authorization metadata");
    });

    it("keeps import routing protected and reports deferred preview without data", async () => {
        await expect(authorizePageRequest(
            "/backstage/eventImport",
            eventAdmin.id,
        )).rejects.toThrow(new RegExp(`${Permission.sysadmin}`));

        await expect(invokeResolver(
            getImportEventData,
            {},
            createAuthorizationTestContext(eventAdmin),
        )).rejects.toThrow("Event import is temporarily unavailable");
    });

    it("reports deferred account analysis without returning dependency data", async () => {
        await expect(invokeResolver(
            getUserMassAnalysis,
            { userId: eventAdmin.publicId },
            createAuthorizationTestContext(eventAdmin),
        )).rejects.toThrow("Shared-account dependency analysis is temporarily unavailable");
    });

    it("fails closed for an unregistered backstage page", async () => {
        await expect(authorizePageRequest(
            "/backstage/notRegistered",
            actualSysadmin.id,
        )).rejects.toThrow("missing route authorization metadata");
    });
});


// MIGRATION_RESTORE: role-administration
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:tests/authorization/backstageServerGuard.test.ts:1-197
// Reason: Single-band Role administration cannot execute against GlobalRole and BandRole.
// Restore: Restore role and permission editors, designations, account role assignment and continuity safeguards using GlobalRole/BandRole; never restore User.role.
// Verification: Adapt the preserved authorization and command tests; verify atomic designations, protected grants, fresh authorization, auditing and browser editors.
// SHA256: 3e79e9fcb1765f2cc8bb4116de8e3a8692763a652d1c20df0a8c952aec23c628
// MIGRATION_REFERENCE_BEGIN
// import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
//
// vi.mock("db", async () => {
//     const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
//     const { authorizationTestDb } = await import("./support/inMemoryPrisma");
//     return { ...prisma, default: authorizationTestDb };
// });
//
// import { authorizePageRequest as authorizeRequest } from "@/src/auth/server/pageRequestAuthorization";
// import { Permission } from "shared/permissions";
// import { loadAuthorizedPageEntity } from "src/auth/server/serverPageAuthorization";
// import { xEvent, xInstrument } from "src/core/db3/db3";
// import getImportEventData from "src/core/db3/queries/getImportEventData";
// import getUserMassAnalysis from "src/core/db3/queries/getUserMassAnalysis";
// import {
//     createAuthorizationTestContext,
//     createAuthorizationTestUser,
// } from "./support/authorizationFixtures";
// import { authorizationTestDb } from "./support/inMemoryPrisma";
// import { invokeResolver } from "./support/resolverHarness";
//
// const eventAdmin = createAuthorizationTestUser("normal", {
//     id: 810,
//     permissions: [Permission.login, Permission.admin_events],
// });
// const roleCarriedSysadmin = createAuthorizationTestUser("normal", {
//     id: 811,
//     permissions: [Permission.login, Permission.sysadmin],
// });
// const actualSysadmin = createAuthorizationTestUser("sysadmin", { id: 812 });
//
// // Model a distinct Next request for each guard invocation.
// const authorizePageRequest = (pathname: string, userId: number | null | undefined) => {
//     const user = userId ? createAuthorizationTestUser("normal", { id: userId }) : null;
//     return authorizeRequest(pathname, createAuthorizationTestContext(user).session);
// };
//
// describe("backstage server page guard", () => {
//     afterEach(() => {
//         vi.unstubAllEnvs();
//     });
//
//     beforeEach(() => {
//         authorizationTestDb.reset({
//             user: [eventAdmin, roleCarriedSysadmin, actualSysadmin],
//         });
//     });
//
//     it("allows a delegated route only with its declared capability", async () => {
//         await expect(authorizePageRequest(
//             "/backstage/editEventTags",
//             eventAdmin.id,
//         )).resolves.toBeUndefined();
//
//         await expect(authorizePageRequest(
//             "/backstage/editSongTags",
//             eventAdmin.id,
//         )).rejects.toThrow();
//     });
//
//     it("accepts the declared sysadmin permission regardless of how it is held", async () => {
//         await expect(authorizePageRequest(
//             "/backstage/roles",
//             roleCarriedSysadmin.id,
//         )).resolves.toBeUndefined();
//     });
//
//     it("revalidates permission state from the database", async () => {
//         authorizationTestDb.reset({
//             user: [createAuthorizationTestUser("normal", {
//                 id: eventAdmin.id,
//                 permissions: [Permission.login],
//             })],
//         });
//
//         await expect(authorizePageRequest(
//             "/backstage/editEventTags",
//             eventAdmin.id,
//         )).rejects.toThrow(new RegExp(`${Permission.admin_events}`));
//     });
//
//     it("allows anonymous access through the public permission baseline", async () => {
//         await expect(authorizePageRequest(
//             "/backstage/practice-tools",
//             undefined,
//         )).resolves.toBeUndefined();
//     });
//
//     it.each([
//         ["/backstage", null],
//         ["/backstage/", undefined],
//     ] as const)("allows the anonymous dashboard login frame at %s", async (pathname, userId) => {
//         await expect(authorizePageRequest(pathname, userId)).resolves.toBeUndefined();
//     });
//
//     it.each([
//         "/backstage/profile",
//         "/backstage/calendar",
//         "/backstage/event/[...id_slug_tab]",
//         "/backstage/roles",
//     ])("requires login for anonymous requests to protected page %s", async pathname => {
//         await expect(authorizePageRequest(pathname, null)).rejects.toMatchObject({ statusCode: 401 });
//     });
//
//     it("allows any signed-in user to access their profile", async () => {
//         authorizationTestDb.reset({
//             user: [createAuthorizationTestUser("normal", {
//                 id: eventAdmin.id,
//                 permissions: [Permission.login],
//             })],
//         });
//         await expect(authorizePageRequest("/backstage/profile", eventAdmin.id)).resolves.toBeUndefined();
//     });
//
//     it("requires login when the session user no longer exists", async () => {
//         await expect(authorizePageRequest("/backstage/profile", 999999))
//             .rejects.toMatchObject({ statusCode: 401 });
//     });
//
//     it("does not load protected entity data for an anonymous visitor", async () => {
//         const load = vi.fn();
//         await expect(loadAuthorizedPageEntity({
//             ctx: createAuthorizationTestContext(null),
//             permission: Permission.view_events_nonpublic,
//             table: xEvent,
//             id: 1,
//             load,
//         })).resolves.toBeNull();
//         expect(load).not.toHaveBeenCalled();
//     });
//
//     it("loads an Instrument page by public ID and rejects numeric route identity", async () => {
//         const instrument = {
//             id: 42,
//             publicId: "AbCdEfGhIjKlMn42",
//             name: "trumpet",
//             description: "",
//             sortOrder: 1,
//             functionalGroupId: 7,
//             autoAssignFileLeafRegex: null,
//         };
//         const instrumentDelegate = authorizationTestDb.getDelegate("instrument");
//         instrumentDelegate.reset([instrument]);
//         const load = vi.fn(where => instrumentDelegate.findFirst({ where }));
//         const ctx = createAuthorizationTestContext(eventAdmin);
//
//         await expect(loadAuthorizedPageEntity({
//             ctx,
//             permission: Permission.login,
//             table: xInstrument,
//             identity: instrument.publicId,
//             load,
//         })).resolves.toEqual(instrument);
//
//         await expect(loadAuthorizedPageEntity({
//             ctx,
//             permission: Permission.login,
//             table: xInstrument,
//             identity: instrument.id,
//             load,
//         })).rejects.toThrow();//.resolves.toBeNull();
//         expect(load).toHaveBeenCalledTimes(1);
//     });
//
//     it("keeps contained routes and unregistered pages closed to anonymous visitors", async () => {
//         await expect(authorizePageRequest("/backstage/notRegistered", null))
//             .rejects.toThrow("missing route authorization metadata");
//     });
//
//     it("keeps experimental event import behind sysadmin at the route and query", async () => {
//         await expect(authorizePageRequest(
//             "/backstage/eventImport",
//             eventAdmin.id,
//         )).rejects.toThrow(new RegExp(`${Permission.sysadmin}`));
//
//         await expect(invokeResolver(
//             getImportEventData,
//             {} as never,
//             createAuthorizationTestContext(eventAdmin),
//         )).rejects.toThrow(new RegExp(`${Permission.sysadmin}`));
//     });
//
//     it("keeps user Mass Analysis behind the sysadmin permission", async () => {
//         await expect(invokeResolver(
//             getUserMassAnalysis,
//             { userId: eventAdmin.publicId },
//             createAuthorizationTestContext(eventAdmin),
//         )).rejects.toThrow(new RegExp(`Not authorized for ${Permission.sysadmin}`));
//     });
//
//     it("fails closed for an unregistered backstage page", async () => {
//         await expect(authorizePageRequest(
//             "/backstage/notRegistered",
//             actualSysadmin.id,
//         )).rejects.toThrow("missing route authorization metadata");
//     });
// });
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: event-import
// Source: ced31f2c6595be33520214fe5e23a75cc8148b3a:tests/authorization/backstageServerGuard.test.ts:170-181
// Reason: Experimental import preview uses global person/song lookups, obsolete invitation tags and an unscoped authorization/time-zone boundary; its editor depends on unfinished event/song contracts.
// Restore: Restore text/config parsing, band-owned defaults, visible song and membership matching, editable preview, explicit save and saved-event history with strict public inputs, fresh snapshot authorization, localized references and band scheduling through the migrated creation transaction.
// Verification: Reactivate preserved preview/identity/authorization specifications; test supported dates and year overrides, comments/repeated songs, ambiguous or missing matches, two bands, inactive members/catalogs, hidden songs, grant revocation, preview edits and saves in the built browser.
// SHA256: dea4485ea47d786517c2bbd1860bda1eabc867ec90d7824bc88f46a28d4434d0
// MIGRATION_REFERENCE_BEGIN
//     it("keeps experimental event import behind sysadmin at the route and query", async () => {
//         await expect(authorizePageRequest(
//             "/backstage/eventImport",
//             eventAdmin.id,
//         )).rejects.toThrow(new RegExp(`${Permission.sysadmin}`));
//
//         await expect(invokeResolver(
//             getImportEventData,
//             {} as never,
//             createAuthorizationTestContext(eventAdmin),
//         )).rejects.toThrow(new RegExp(`${Permission.sysadmin}`));
//     });
// MIGRATION_REFERENCE_END
