import type { SessionContext } from "@blitzjs/auth";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";

const loadAuth = vi.hoisted(() => vi.fn());
vi.mock("src/auth/server/serverAuthorization", () => ({ loadAuthorization: loadAuth }));

import { authorizePageRequest } from "src/auth/server/pageRequestAuthorization";

// Only session forwarding is under test; the mocked loader owns authorization.
const session = {} as SessionContext;
const bandPublicId = parsePublicId<"Band">("ReportBand000001");

function grant(...permissions: Permission[]) {
    const requirePermission = vi.fn((permission: Permission) => {
        if (!permissions.includes(permission)) {
            throw new Error("Denied");
        }
    });
    loadAuth.mockResolvedValue({ requirePermission });
    return requirePermission;
}

describe("activity report page authorization", () => {
    beforeEach(() => loadAuth.mockReset());

    it("admits a signed-in account to the explicit band-selection notice", async () => {
        grant(Permission.login);
        await authorizePageRequest("/backstage/platform-featureReports", session);
    });

    it("requires login in account context", async () => {
        grant(Permission.public);
        await expect(authorizePageRequest("/backstage/platform-featureReports", session)).rejects.toThrow("Denied");
    });

    it("retains the selected band's report capability check", async () => {
        const requirePermission = grant(Permission.view_feature_reports);
        await authorizePageRequest("/backstage/featureReports", session, bandPublicId);
        expect(loadAuth).toHaveBeenCalledWith(session, bandPublicId);
        expect(requirePermission).toHaveBeenCalledWith(Permission.view_feature_reports);
    });

    it("rejects a selected-band request without the report capability", async () => {
        grant(Permission.login);
        await expect(authorizePageRequest("/backstage/featureReports", session, bandPublicId)).rejects.toThrow("Denied");
    });
});
