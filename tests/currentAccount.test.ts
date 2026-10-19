import { beforeEach, describe, expect, it, vi } from "vitest";

// Only the projection is under test here; native bootstrap tests exercise fresh authorization.
const { loadAuthorization } = vi.hoisted(() => ({ loadAuthorization: vi.fn() }));
vi.mock("src/auth/server/serverAuthorization", () => ({ loadAuthorization }));

import getCurrentUser from "src/auth/queries/getCurrentUser";
import { createAuthorizationTestContext } from "./authorization/support/authorizationFixtures";
import { Permission } from "shared/permissions";

const account = {
    id: 42, publicId: "Account000000001", name: "Alice", email: "alice@test.invalid", phone: null,
    createdAt: new Date("2026-10-01T00:00:00Z"), cssClass: null, isSysAdmin: false,
    globalRoleId: 7, globalRole: { permissions: [{ permission: { name: "sysadmin" } }] },
    hashedPassword: "must not escape", calendarFeedToken: "private", uid: "private",
};
beforeEach(() => { vi.clearAllMocks(); });

describe("current account bootstrap", () => {
    it("returns only shared account fields, without credentials, grants or band assignments", async () => {
        loadAuthorization.mockResolvedValue({ user: account, hasPermission: () => false });
        expect(await getCurrentUser(null, createAuthorizationTestContext(null))).toEqual({
            id: account.id, publicId: account.publicId, name: account.name, email: account.email,
            phone: null, createdAt: account.createdAt, cssClass: null, isSysAdmin: false,
        });
        expect(loadAuthorization).toHaveBeenCalledWith(expect.anything());
    });

    it.each([
        { stored: false, effective: true },
        { stored: true, effective: false },
    ])("displays effective administrator authority instead of stored flag $stored", async ({ stored, effective }) => {
        const hasPermission = vi.fn((permission: Permission) => permission === Permission.sysadmin && effective);
        loadAuthorization.mockResolvedValue({ user: { ...account, isSysAdmin: stored }, hasPermission });
        expect(await getCurrentUser(null, createAuthorizationTestContext(null))).toMatchObject({ isSysAdmin: effective });
        expect(hasPermission).toHaveBeenCalledWith(Permission.sysadmin);
    });

    it("returns no account when fresh authorization rejects its identity", async () => {
        loadAuthorization.mockResolvedValue({ user: null });
        expect(await getCurrentUser(null, createAuthorizationTestContext(null))).toBeNull();
    });
});
