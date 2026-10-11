import { authorizationBandId } from "./support/authorizationSeed";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { describe, expect, it, vi } from "vitest";

vi.mock("db", async () => {
    const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
    return {
        ...prisma,
        // Any database access is a failure, including a read that precedes rejection.
        default: new Proxy({}, {
            get: (_target, member) => {
                throw new Error(`Deferred operation accessed database member ${String(member)}.`);
            },
        }),
    };
});

import * as db3 from "@db3/db3";
import { getDB3CommandHandler } from "@db3/server/db3CommandRegistry";
import { validateDB3MutationRequest, validateDB3PaginatedQueryRequest, validateDB3QueryRequest } from "@db3/server/db3RequestValidation";
import getAdminLogItemInfo from "@db3/queries/getAdminLogItemInfo";
import getDistinctChangeFilterValues from "@db3/queries/getDistinctChangeFilterValues";
import { insertImpl } from "@db3/server/db3mutationCore";
import { ApplicationFeatureUnavailableError } from "src/core/shared/applicationRecovery";
import { parsePublicId } from "shared/publicId";

// These requests deliberately target the removed single-band Role contract.
const roleId = parsePublicId<"Role">("DeferredRole0001");
import { createAuthorizationTestContext, createAuthorizationTestUser } from "./support/authorizationFixtures";
import { invokeResolver } from "./support/resolverHarness";
import { forgeDb3Insert, forgeDb3PublicUpdate, forgeDb3PublicDelete, forgeDb3Query } from "./support/db3RequestBuilders";

const member = createAuthorizationTestUser("normal", { id: 10 });
const sysadmin = createAuthorizationTestUser("sysadmin", { id: 1 });
const userId = member.publicId;

const deferredAuditEndpoints = [
    { name: "historical audit references", resolve: getAdminLogItemInfo },
    { name: "audit filter references", resolve: getDistinctChangeFilterValues },
];

describe("service-owned File creation", () => {
    it("blocks generic File creation before its transaction or metadata hooks", async () => {
        // The empty target is intentional: every authorization read must fail before any typed field is used.
        const forbiddenAuthorization = new Proxy({} as CMServerAuthorization, {
            get: () => {
                throw new Error("Generic File creation inspected authorization.");
            },
        });
        await expect(insertImpl(db3.xFile, {}, forbiddenAuthorization)).rejects.toThrow("creation");
    });
});

describe("deferred audit log readers", () => {
    it.each(deferredAuditEndpoints)("rejects $name without reading audit, account or reference data", async ({ resolve }) => {
        const requests: unknown[] = [
            { tableName: "File", pk: 1 },
            { bandPublicId: parsePublicId<"Band">("AuditBand0000001"), routeLocale: "fr-BE" },
            null,
        ];
        for (const actor of [member, sysadmin]) {
            for (const input of requests) {
                await expect(invokeResolver(resolve, input, createAuthorizationTestContext(actor)))
                    .rejects.toThrow(ApplicationFeatureUnavailableError);
            }
        }
    });

    it.each(deferredAuditEndpoints)("requires login before reporting availability for $name", async ({ resolve }) => {
        await expect(invokeResolver(resolve, {}, createAuthorizationTestContext(null)))
            .rejects.toThrow("login");
    });

    it("rejects crafted generic audit reads and writes before database access", () => {
        expect(() => db3.GetTableById("Change")).toThrow("was not found");
        expect(() => validateDB3QueryRequest(forgeDb3Query("Change", authorizationBandId)))
            .toThrow("unknown table ID 'Change'");
        expect(() => validateDB3PaginatedQueryRequest({ ...forgeDb3Query("Change", authorizationBandId), skip: 0, take: 50 }))
            .toThrow("unknown table ID 'Change'");
        const requests = [
            forgeDb3Insert("Change", null, { table: "User" }),
            forgeDb3PublicUpdate("Change", null, userId, { table: "User" }),
            forgeDb3PublicDelete("Change", null, userId),
        ];
        for (const request of requests) {
            expect(() => validateDB3MutationRequest(request)).toThrow("unknown table ID 'Change'");
        }
    });
});

describe("deferred shared-account operations", () => {
    it.each(["Role", "RolePermission", "UserInstrument", "Setting", "GlobalSetting", "BandSetting", "UserSetting", "BandUserSetting"])("does not register obsolete or command-owned %s storage", tableID => {
        expect(() => db3.GetTableById(tableID)).toThrow("was not found");
    });

    it.each(["Role", "RolePermission", "UserInstrument", "Setting", "GlobalSetting", "BandSetting", "UserSetting", "BandUserSetting"])("rejects crafted generic writes to %s before database access", tableID => {
        const requests = [
            forgeDb3Insert(tableID, null, { name: "Retired" }),
            forgeDb3PublicUpdate(tableID, null, roleId, { name: "Retired" }),
            forgeDb3PublicDelete(tableID, null, roleId),
        ];
        for (const request of requests) {
            expect(() => validateDB3MutationRequest(request)).toThrow(`unknown table ID '${tableID}'`);
        }
    });

    it.each(["Role_Editor", "Role_Dashboard", "Permission_RoleMatrix", "UserInstrument_Editor", "Setting_Editor"])("does not expose the retired %s view", viewID => {
        expect(() => db3.getDB3View(viewID)).toThrow("was not found");
    });

    it.each(["Role_Create", "Role_Update", "RolePermission_Set", "UserInstrument_Create", "UserInstrument_Update", "UserInstrument_Delete"])("does not dispatch the retired %s command", commandID => {
        expect(() => getDB3CommandHandler(commandID)).toThrow("Unknown DB3 command");
    });

    it("removes old role fields from generic user and permission writes", () => {
        expect(db3.xUser.fields).not.toHaveProperty("role");
        expect(db3.xPermission.fields).not.toHaveProperty("roles");
        expect(() => db3.userEditorView.crud.operations.update.command.parseDto({
            identity: userId,
            patch: { roleId },
        })).toThrow();
    });

    it("keeps the migrated membership-role command registered", () => {
        expect(getDB3CommandHandler(db3.bandUserRoleCommand.commandID).command)
            .toBe(db3.bandUserRoleCommand);
    });
});
