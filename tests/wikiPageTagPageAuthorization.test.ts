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

describe("wiki tag page authorization", () => {
    beforeEach(() => loadAuth.mockReset());

    function grant(...permissions: Permission[]) {
        const requirePermission = vi.fn((permission: Permission) => {
            if (!permissions.includes(permission)) {
                throw new Error("Denied");
            }
        });
        loadAuth.mockResolvedValue({ requirePermission });
        return requirePermission;
    }

    it("admits signed-in accounts to the platform placeholder", async () => {
        const requirePermission = grant(Permission.login);
        await authorizePageRequest("/backstage/platform-editWikiPageTags", session);
        expect(requirePermission).toHaveBeenCalledWith(Permission.login);
    });

    it("does not admit anonymous accounts to the platform placeholder", async () => {
        grant(Permission.public);
        await expect(authorizePageRequest("/backstage/platform-editWikiPageTags", session)).rejects.toThrow("Denied");
    });

    it("retains the wiki-tag administration capability check after band selection", async () => {
        const requirePermission = grant(Permission.admin_wiki_pages);
        await authorizePageRequest("/backstage/editWikiPageTags", session, bandPublicId);
        expect(loadAuth).toHaveBeenCalledWith(session, bandPublicId);
        expect(requirePermission).toHaveBeenCalledWith(Permission.admin_wiki_pages);
    });

    it("rejects a selected band whose actor lacks the wiki-tag administration capability", async () => {
        grant(Permission.login);
        await expect(authorizePageRequest("/backstage/editWikiPageTags", session, bandPublicId)).rejects.toThrow("Denied");
    });
});
