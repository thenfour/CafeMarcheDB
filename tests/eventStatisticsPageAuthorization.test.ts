import type { SessionContext } from "@blitzjs/auth";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";

const loadAuth = vi.hoisted(() => vi.fn());
vi.mock("src/auth/server/serverAuthorization", () => ({ loadAuthorization: loadAuth }));

import { authorizePageRequest } from "src/auth/server/pageRequestAuthorization";

// Only session forwarding is under test; the mocked loader owns authorization.
const session = {} as SessionContext;
const bandId = parsePublicId<"Band">("DomainBand000001");

function grant(...permissions: Permission[]) {
    const requirePermission = vi.fn((permission: Permission) => {
        if (!permissions.includes(permission)) {
            throw new Error("Denied");
        }
    });
    loadAuth.mockResolvedValue({ requirePermission });
    return requirePermission;
}

describe("event statistics page authorization", () => {
    beforeEach(() => loadAuth.mockReset());

    it.each([undefined, bandId])("retains event report protection with band %s", async selectedBand => {
        const requirePermission = grant(Permission.login, Permission.view_events_reports);
        await authorizePageRequest("/backstage/stats", session, selectedBand);
        expect(loadAuth).toHaveBeenCalledWith(session, selectedBand);
        expect(requirePermission).toHaveBeenCalledWith(Permission.view_events_reports);
    });

    it.each([Permission.public, Permission.login])("rejects %s accounts without event report authority", async permission => {
        grant(permission);
        for (const selectedBand of [undefined, bandId]) {
            await expect(authorizePageRequest("/backstage/stats", session, selectedBand)).rejects.toThrow("Denied");
        }
    });
});
