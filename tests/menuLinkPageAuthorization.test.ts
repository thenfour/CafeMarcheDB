import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import { permissionNamesSatisfyRequirement, type PermissionRequirement } from "src/auth/shared/permissionRequirement";
import type { SessionContext } from "@blitzjs/auth";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";

const loadAuth = vi.hoisted(() => vi.fn());
vi.mock("src/auth/server/serverAuthorization", () => ({ loadAuthorization: loadAuth }));

import { authorizePageRequest } from "src/auth/server/pageRequestAuthorization";

// The guard passes the session through to the mocked authorization loader without inspecting it.
const session = {} as SessionContext;
const bandPublicId = parsePublicId<"Band">("Band000000000007");

describe("menu link page authorization", () => {
    beforeEach(() => loadAuth.mockReset());

    function grant(...permissions: Permission[]) {
        const requirePermission = vi.fn((permission: PermissionRequirement) => {
            if (!permissionNamesSatisfyRequirement(permissions, permission, true)) {
                throw new Error("Denied");
            }
        });
        loadAuth.mockResolvedValue({ requirePermission });
        return requirePermission;
    }

    it("admits signed-in accounts to the platform placeholder", async () => {
        const requirePermission = grant(Permission.login);
        await authorizePageRequest("/platform/menuLinks", session);
        expect(requirePermission).toHaveBeenCalledWith(Permission.login);
    });

    it("does not admit anonymous accounts to the platform placeholder", async () => {
        grant(Permission.public);
        await expect(authorizePageRequest("/platform/menuLinks", session)).rejects.toThrow("Denied");
    });

    it("retains the menu-link capability check after band selection", async () => {
        const requirePermission = grant(Permission.customize_menu);
        await authorizePageRequest("/backstage/menuLinks", session, bandPublicId);
        expect(loadAuth).toHaveBeenCalledWith(session, bandPublicId);
        expect(requirePermission).toHaveBeenCalledWith(BandPermission.customize_menu);
    });

    it("rejects a selected band whose actor lacks the menu-link capability", async () => {
        grant(Permission.login);
        await expect(authorizePageRequest("/backstage/menuLinks", session, bandPublicId)).rejects.toThrow("Denied");
    });
});
