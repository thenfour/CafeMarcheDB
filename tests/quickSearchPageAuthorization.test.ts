import type { SessionContext } from "@blitzjs/auth";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";

const loadAuth = vi.hoisted(() => vi.fn());
vi.mock("src/auth/server/serverAuthorization", () => ({ loadAuthorization: loadAuth }));

import { authorizePageRequest } from "src/auth/server/pageRequestAuthorization";

// Only session forwarding is under test; the mocked loader owns authorization.
const session = {} as SessionContext;
const bandId = parsePublicId<"Band">("SearchBand000001");

describe("quick search explorer authorization", () => {
    beforeEach(() => loadAuth.mockReset());

    it.each([undefined, bandId])("retains Sysadmin protection with band %s", async selectedBand => {
        const requirePermission = vi.fn();
        loadAuth.mockResolvedValue({ requirePermission });
        await authorizePageRequest("/backstage/test/quickSearchTest", session, selectedBand);
        expect(loadAuth).toHaveBeenCalledWith(session, selectedBand);
        expect(requirePermission).toHaveBeenCalledWith(Permission.sysadmin);
    });

    it.each([Permission.public, Permission.view_songs])("rejects %s without platform administration", async permission => {
        loadAuth.mockResolvedValue({ requirePermission: (required: Permission) => {
            if (required !== Permission.login && required !== permission) {
                throw new Error("Denied");
            }
        } });
        for (const selectedBand of [undefined, bandId]) {
            await expect(authorizePageRequest("/backstage/test/quickSearchTest", session, selectedBand)).rejects.toThrow("Denied");
        }
    });
});
