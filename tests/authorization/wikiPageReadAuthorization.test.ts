import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("db", async () => {
    const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
    const { authorizationTestDb } = await import("./support/inMemoryPrisma");
    return { ...prisma, default: authorizationTestDb };
});

import { AuthorizationError } from "blitz";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import acquireLockOnWikiPage from "src/core/wiki/mutations/acquireLockOnWikiPage";
import getWikiPage from "src/core/wiki/queries/getWikiPage";
import { createAuthorizationPersona, createAuthorizationTestUser } from "./support/authorizationFixtures";
import { authorizationTestDb } from "./support/inMemoryPrisma";
import { invokeResolver } from "./support/resolverHarness";

const permissions = [
    Permission.login,
    Permission.view_wiki_pages,
    Permission.edit_wiki_pages,
    Permission.view_wiki_page_revisions,
    Permission.admin_wiki_pages,
    Permission.view_users_basic_info,
    Permission.visibility_members,
];
const actor = createAuthorizationTestUser("normal", { id: 812, permissions });
const membersPermission = actor.role!.permissions.find(
    entry => entry.permission.name === Permission.visibility_members,
)!.permission;
const revisionPublicId = parsePublicId<"WikiPageRevision">("AnnouncementRev1");
const args = {
    canonicalWikiPath: "special/announcements",
    baseRevisionId: null,
    baseContentVersion: 0,
    lockId: null,
};
const makePage = (visiblePermissionId: number | null = membersPermission.id, createdByUserId: number | null = null) => ({
    id: 84,
    publicId: parsePublicId<"WikiPage">("Announcements001"),
    slug: args.canonicalWikiPath,
    namespace: "special",
    visiblePermissionId,
    visiblePermission: visiblePermissionId === membersPermission.id ? membersPermission : null,
    createdByUserId,
    contentVersion: 0,
    lockId: null,
    lockAcquiredAt: null,
    lockExpiresAt: null,
    lastEditPingAt: null,
    lockedByUserId: null,
    currentRevisionId: 413,
    currentRevision: {
        id: 413,
        publicId: revisionPublicId,
        wikiPageId: 84,
        name: "Announcements",
        content: "Existing announcements",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        createdByUserId: actor.id,
        createdByUser: actor,
    },
});
const context = () => createAuthorizationPersona("normal", { id: actor.id, permissions }).ctx;

describe("wiki page reads and creation authorization", () => {
    beforeEach(() => {
        authorizationTestDb.reset({
            user: [actor],
            permission: [{ ...membersPermission, significance: "Visibility_Members" }],
            wikiPage: [makePage()],
        });
    });

    it("returns ownerless announcements with explicit Members visibility and their current content", async () => {
        const result = await invokeResolver(getWikiPage, args, context());

        expect(result.isExisting).toBe(true);
        expect(result.wikiPage?.currentRevision?.content).toBe("Existing announcements");
        expect(result.wikiPage?.visiblePermissionId).toBe(membersPermission.publicId);
    });

    it("acquires the existing announcements page without attempting creation", async () => {
        const create = vi.spyOn(authorizationTestDb.getDelegate("wikiPage"), "create");
        const result = await invokeResolver(acquireLockOnWikiPage, {
            ...args, lockId: "announcements-editor", baseRevisionId: revisionPublicId,
        }, context());

        expect(result.isLockedInThisContext).toBe(true);
        expect(result.currentPage?.currentRevision?.content).toBe("Existing announcements");
        expect(create).not.toHaveBeenCalled();
        expect(authorizationTestDb.snapshot("wikiPage")).toHaveLength(1);
    });

    it.each([
        { description: "ownerless null visibility", visibility: null, owner: null },
        { description: "another user's private page", visibility: null, owner: 999 },
        { description: "ungranted visibility", visibility: 999_999, owner: null },
    ])("does not recreate a page hidden by $description", async ({ visibility, owner }) => {
        const page = makePage(visibility, owner);
        authorizationTestDb.getDelegate("wikiPage").reset([page]);
        const create = vi.spyOn(authorizationTestDb.getDelegate("wikiPage"), "create");
        const update = vi.spyOn(authorizationTestDb.getDelegate("wikiPage"), "update");

        const result = await invokeResolver(getWikiPage, args, context());
        expect(result.isExisting).toBe(false);
        expect(result.wikiPage).toBeNull();
        await expect(invokeResolver(acquireLockOnWikiPage, {
            ...args, lockId: "announcements-editor",
        }, context())).rejects.toBeInstanceOf(AuthorizationError);
        expect(create).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
        expect(authorizationTestDb.snapshot("wikiPage")).toEqual([page]);
    });

    it("keeps a private page readable by its owner", async () => {
        authorizationTestDb.getDelegate("wikiPage").reset([makePage(null, actor.id)]);
        const result = await invokeResolver(getWikiPage, args, context());

        expect(result.isExisting).toBe(true);
        expect(result.wikiPage?.currentRevision?.content).toBe("Existing announcements");
    });

    it("creates and locks a genuinely missing page with default Members visibility", async () => {
        authorizationTestDb.getDelegate("wikiPage").reset([]);
        const missing = await invokeResolver(getWikiPage, args, context());
        expect(missing.isExisting).toBe(false);

        const result = await invokeResolver(acquireLockOnWikiPage, {
            ...args, lockId: "announcements-editor",
        }, context());

        expect(result.isLockedInThisContext).toBe(true);
        expect(result.currentPage?.visiblePermissionId).toBe(membersPermission.publicId);
        expect(result.currentPage?.currentRevision).toBeNull();
        expect(authorizationTestDb.snapshot("wikiPage")).toHaveLength(1);
    });
});
