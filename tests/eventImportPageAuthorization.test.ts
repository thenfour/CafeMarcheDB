import type { SessionContext } from "@blitzjs/auth";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";

const loadAuth = vi.hoisted(() => vi.fn());
vi.mock("src/auth/server/serverAuthorization", () => ({ loadAuthorization: loadAuth }));

import { authorizePageRequest } from "src/auth/server/pageRequestAuthorization";

// Only session forwarding is under test; the mocked loader owns authorization.
const session = {} as SessionContext;
const bandId = parsePublicId<"Band">("ImportBand000001");

function grant(...permissions: Permission[]) {
    const requirePermission = vi.fn((permission: Permission) => {
        if (!permissions.includes(permission)) {
            throw new Error("Denied");
        }
    });
    loadAuth.mockResolvedValue({ requirePermission });
    return requirePermission;
}

describe("deferred event import page authorization", () => {
    beforeEach(() => loadAuth.mockReset());

    it.each([undefined, bandId])("retains Sysadmin protection with band %s", async selectedBand => {
        const requirePermission = grant(Permission.login, Permission.sysadmin);
        await authorizePageRequest("/backstage/eventImport", session, selectedBand);
        expect(loadAuth).toHaveBeenCalledWith(session, selectedBand);
        expect(requirePermission).toHaveBeenCalledWith(Permission.sysadmin);
    });

    it.each([Permission.public, Permission.admin_events])("rejects %s without platform administration", async permission => {
        grant(Permission.login, permission);
        for (const selectedBand of [undefined, bandId]) {
            await expect(authorizePageRequest("/backstage/eventImport", session, selectedBand)).rejects.toThrow("Denied");
        }
    });
});
