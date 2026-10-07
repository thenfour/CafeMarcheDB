import type { SessionContext } from "@blitzjs/auth";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";

const loadAuth = vi.hoisted(() => vi.fn());
vi.mock("src/auth/server/serverAuthorization", () => ({ loadAuthorization: loadAuth }));

import { authorizePageRequest } from "src/auth/server/pageRequestAuthorization";

// Only session forwarding is under test; the mocked loader owns authorization.
const session = {} as SessionContext;
const bandId = parsePublicId<"Band">("AuditBand0000001");

function grant(...permissions: Permission[]) {
    const requirePermission = vi.fn((permission: Permission) => {
        if (!permissions.includes(permission)) {
            throw new Error("Denied");
        }
    });
    loadAuth.mockResolvedValue({ requirePermission });
    return requirePermission;
}

describe("deferred audit page authorization", () => {
    beforeEach(() => loadAuth.mockReset());

    it.each([undefined, bandId])("retains platform administration protection with band %s", async selectedBand => {
        const requirePermission = grant(Permission.login, Permission.sysadmin);
        await authorizePageRequest("/backstage/adminLogs", session, selectedBand);
        expect(loadAuth).toHaveBeenCalledWith(session, selectedBand);
        expect(requirePermission).toHaveBeenCalledWith(Permission.sysadmin);
    });

    it.each([Permission.public, Permission.login])("rejects %s accounts without platform administration", async permission => {
        grant(permission);
        for (const selectedBand of [undefined, bandId]) {
            await expect(authorizePageRequest("/backstage/adminLogs", session, selectedBand)).rejects.toThrow("Denied");
        }
    });
});
