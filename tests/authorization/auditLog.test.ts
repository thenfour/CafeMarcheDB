import { beforeEach, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { authorizationPermissionId, createAuthorizationPersona, createAuthorizationTestUser } from "./support/authorizationFixtures";
import { authorizationBandId, resetAuthorizationDatabase } from "./support/authorizationSeed";
import { authorizationTestDb } from "./support/inMemoryPrisma";
import { invokeResolver } from "./support/resolverHarness";
import { forgeDb3Query } from "./support/db3RequestBuilders";

vi.mock("db", async () => {
    const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
    const { authorizationTestDb } = await import("./support/inMemoryPrisma");
    return { ...prisma, default: authorizationTestDb };
});

import * as db3 from "@db3/db3";
import db3Query from "@db3/queries/db3queries";
import db3PaginatedQuery from "@db3/queries/db3paginatedQueries";
import getAdminLogItemInfo from "@db3/queries/getAdminLogItemInfo";
import getDistinctChangeFilterValues from "@db3/queries/getDistinctChangeFilterValues";
import { insertImpl, updateImpl, deleteImpl } from "@db3/server/db3mutationCore";
import { testServerAuthorization } from "tests/support/serverAuthorization";
import { ServerPermissionSet } from "src/auth/server/ServerPermissionSet";

beforeEach(() => {
    const member = createAuthorizationTestUser("normal", { id: 10 });
    resetAuthorizationDatabase({ user: [{ ...member, mergedIntoUserId: null, globalRoleId: 10_000 }],
        globalRole: [{ id: 10_000, isDeleted: false }, { id: 10_001, isPublicRole: true, isDeleted: false }],
        globalRolePermission: [{ id: 1, globalRoleId: 10_000, permissionId: authorizationPermissionId(Permission.login) }],
        change: [{ id: 1, table: "User", recordId: 10 }],
    });
    vi.restoreAllMocks();
});

describe("protected immutable audit history", () => {
    it("does not let a protected primary key grant row access", () => {
        const { schemaAuthorization } = createAuthorizationPersona("public");
        const result = db3.xChange.authorizeAndSanitize({ contextDesc: "audit protection regression", auth: schemaAuthorization,
            rowMode: "view", model: { id: 41, table: "User", recordId: 10 }, fallbackOwnerId: null,
        });
        expect(result.rowIsAuthorized).toBe(false);
        expect(result.authorizedModel).toEqual({});
        expect(result.unauthorizedModel).toHaveProperty("id", 41);
        expect(db3.xChange.authorizeColumnForView({ model: null, auth: schemaAuthorization, columnName: "id" })).toBe(false);
    });
    it("rejects unauthorized generic reads before fetching audit rows", async () => {
        const findMany = vi.spyOn(authorizationTestDb.getDelegate("change"), "findMany");
        const { ctx } = createAuthorizationPersona("normal", { id: 10 });
        await expect(invokeResolver(db3Query, forgeDb3Query("Change", authorizationBandId), ctx)).rejects.toThrow("Not authorized to perform this query.");
        expect(findMany).not.toHaveBeenCalled();
    });
    it("rejects unauthorized pagination before fetching or counting audit rows", async () => {
        const delegate = authorizationTestDb.getDelegate("change");
        const findMany = vi.spyOn(delegate, "findMany");
        const count = vi.spyOn(delegate, "count");
        const { ctx } = createAuthorizationPersona("normal", { id: 10 });
        await expect(invokeResolver(db3PaginatedQuery, { ...forgeDb3Query("Change", authorizationBandId), skip: 0, take: 25 }, ctx)).rejects.toThrow("Not authorized to perform this query.");
        expect(findMany).not.toHaveBeenCalled();
        expect(count).not.toHaveBeenCalled();
    });
    it.each(["public", "normal"] as const)("blocks %s filter and detail calls before reading history", async persona => {
        const findMany = vi.spyOn(authorizationTestDb.getDelegate("change"), "findMany");
        const findUnique = vi.spyOn(authorizationTestDb.getDelegate("change"), "findUnique");
        const { ctx } = createAuthorizationPersona(persona, persona === "normal" ? { id: 10 } : undefined);
        await expect(invokeResolver(getDistinctChangeFilterValues, {}, ctx)).rejects.toThrow("sysadmin");
        await expect(invokeResolver(getAdminLogItemInfo, { changeId: 1 }, ctx)).rejects.toThrow("sysadmin");
        expect(findMany).not.toHaveBeenCalled();
        expect(findUnique).not.toHaveBeenCalled();
    });
    it("rejects arbitrary table/key lookups at the detail boundary", async () => {
        const { ctx } = createAuthorizationPersona("sysadmin");
        // A deliberately forged runtime request exercises validation beyond the resolver's static input type.
        const input = { tableName: "User", pk: 10 } as unknown as Parameters<typeof getAdminLogItemInfo>[0];
        await expect(invokeResolver(getAdminLogItemInfo, input, ctx)).rejects.toThrow();
    });
    it("denies every generic mutation even to platform administrators", async () => {
        const auth = testServerAuthorization({ id: 1 }, new ServerPermissionSet([{ id: 1, name: Permission.sysadmin }]));
        expect(db3.xChange.authorizeRowBeforeInsert({ auth })).toBe(false);
        expect(db3.xChange.authorizeRowForEdit({ auth, model: { id: 1 } })).toBe(false);
        expect(db3.xChange.deletePolicy).toBe("disabled");
        await expect(insertImpl(db3.xChange, { table: "User" }, auth)).rejects.toThrow();
        await expect(updateImpl(db3.xChange, 1, { action: "changed" }, auth)).rejects.toThrow();
        await expect(deleteImpl(db3.xChange, 1, auth, "hard")).rejects.toThrow();
    });
});
