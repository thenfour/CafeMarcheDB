import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("db", async () => {
    const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
    const { authorizationTestDb } = await import("./support/inMemoryPrisma");
    return {
        ...prisma,
        default: authorizationTestDb,
    };
});

import { Permission } from "shared/permissions";
import { ActivityFeature } from "src/core/components/featureReports/activityTracking";
import * as db3 from "src/core/db3/db3";
import { recordAuthenticatedClientAction } from "src/core/db3/server/recordActionServer";
import {
    isAuthorizedForServerPage,
    loadAuthorizedPageEntity,
} from "src/auth/server/serverPageAuthorization";
import {
    createAuthorizationPersona,
    createAuthorizationSchemaData,
    createAuthorizationTestUser,
} from "./support/authorizationFixtures";
import { authorizationTestDb } from "./support/inMemoryPrisma";
import { CallMutateEventHooks } from "src/core/db3/server/db3mutationCore";

const makeAuthorizationArgs = (user: ReturnType<typeof createAuthorizationTestUser>) => ({
    publicData: createAuthorizationSchemaData(user),
});

describe("BA-S004 wiki DB3 capabilities", () => {
    const loggedIn = createAuthorizationTestUser("normal", {
        id: 10,
        permissions: [Permission.login, Permission.visibility_logged_in_users],
    });
    const editor = createAuthorizationTestUser("normal", {
        id: 20,
        permissions: [
            Permission.login,
            Permission.view_wiki_pages,
            Permission.edit_wiki_pages,
            Permission.view_wiki_page_revisions,
        ],
    });
    const wikiAdmin = createAuthorizationTestUser("normal", {
        id: 30,
        permissions: [
            Permission.login,
            Permission.view_wiki_pages,
            Permission.edit_wiki_pages,
            Permission.view_wiki_page_revisions,
            Permission.admin_wiki_pages,
        ],
    });

    const wikiPage = { id: 1, slug: "policy", visiblePermission: null, createdByUserId: null };
    const wikiTag = { id: 2, text: "Policy", description: "", color: null };
    const assignment = { id: 3, tagId: wikiTag.id, tag: wikiTag, wikiPageId: wikiPage.id };
    const revision = { id: 4, name: "Policy", wikiPageId: wikiPage.id };

    it("does not treat login visibility as wiki editing authority", () => {
        const auth = makeAuthorizationArgs(loggedIn);

        expect(db3.xWikiPage.authorizeRowForEdit({ model: wikiPage, ...auth })).toBe(false);
        expect(db3.xWikiPage.authorizeColumnForEdit({
            model: wikiPage,
            columnName: "slug",
            fallbackOwnerId: null,
            ...auth,
        })).toBe(false);
        expect(db3.xWikiPageTag.authorizeRowForEdit({ model: wikiTag, ...auth })).toBe(false);
        expect(db3.xWikiPageTagAssignment.authorizeRowForEdit({ model: assignment, ...auth })).toBe(false);
        expect(db3.xWikiPageRevision.authorizeRowForEdit({ model: revision, ...auth })).toBe(false);
    });

    it("lets wiki editors edit pages and page-tag assignments, but not administer tags or revisions", () => {
        const auth = makeAuthorizationArgs(editor);

        expect(db3.xWikiPage.authorizeRowForEdit({ model: wikiPage, ...auth })).toBe(true);
        expect(db3.xWikiPage.authorizeColumnForEdit({
            model: wikiPage,
            columnName: "tags",
            fallbackOwnerId: null,
            ...auth,
        })).toBe(true);
        expect(db3.xWikiPage.authorizeColumnForEdit({
            model: wikiPage,
            columnName: "lockId",
            fallbackOwnerId: null,
            ...auth,
        })).toBe(false);
        expect(db3.xWikiPageTagAssignment.authorizeRowForEdit({ model: assignment, ...auth })).toBe(true);
        expect(db3.xWikiPageTag.authorizeRowForEdit({ model: wikiTag, ...auth })).toBe(false);
        expect(db3.xWikiPageRevision.authorizeRowForEdit({ model: revision, ...auth })).toBe(false);
    });

    it("reserves tag-vocabulary and revision administration for wiki admins", () => {
        const auth = makeAuthorizationArgs(wikiAdmin);

        expect(db3.xWikiPageTag.authorizeRowForEdit({ model: wikiTag, ...auth })).toBe(true);
        expect(db3.xWikiPageTag.authorizeColumnForEdit({
            model: wikiTag,
            columnName: "text",
            fallbackOwnerId: null,
            ...auth,
        })).toBe(true);
        expect(db3.xWikiPageRevision.authorizeRowForEdit({ model: revision, ...auth })).toBe(true);
        expect(db3.xWikiPageRevision.authorizeColumnForEdit({
            model: revision,
            columnName: "content",
            fallbackOwnerId: null,
            ...auth,
        })).toBe(true);
        expect(db3.xWikiPage.authorizeColumnForEdit({
            model: wikiPage,
            columnName: "lockId",
            fallbackOwnerId: null,
            ...auth,
        })).toBe(true);
    });
});

describe("BA-S005 server-rendered entity metadata", () => {
    const permissions = [
        Permission.login,
        Permission.view_events,
        Permission.view_events_nonpublic,
        Permission.access_file_landing_page,
        Permission.view_songs,
        Permission.view_users_basic_info,
        Permission.visibility_members,
    ];
    const actor = createAuthorizationTestUser("normal", { id: 100, permissions });
    const membersVisibilityId = actor.role!.permissions.find(
        entry => entry.permission.name === Permission.visibility_members,
    )!.permissionId;

    const cases = [
        {
            delegate: "event",
            permission: Permission.view_events_nonpublic,
            table: db3.xEvent,
            row: { id: 1, name: "Private event", isDeleted: false, createdByUserId: null, visiblePermissionId: membersVisibilityId },
        },
        {
            delegate: "file",
            permission: Permission.access_file_landing_page,
            table: db3.xFile,
            row: { id: 2, fileLeafName: "private.pdf", isDeleted: false, uploadedByUserId: null, visiblePermissionId: membersVisibilityId },
        },
        {
            delegate: "song",
            permission: Permission.view_songs,
            table: db3.xSong,
            row: { id: 3, name: "Private song", isDeleted: false, createdByUserId: null, visiblePermissionId: membersVisibilityId },
        },
        {
            delegate: "user",
            permission: Permission.view_users_basic_info,
            table: db3.xUser,
            row: { ...createAuthorizationTestUser("normal", { id: 4 }), isDeleted: false },
        },
    ] as const;

    beforeEach(() => {
        vi.restoreAllMocks();
        authorizationTestDb.reset({ user: [actor] });
    });

    it.each(cases)("applies the $delegate DB3 row policy before loading its title", async testCase => {
        authorizationTestDb.getDelegate(testCase.delegate).reset(
            testCase.delegate === "user" ? [actor, testCase.row] : [testCase.row],
        );
        const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions });

        const result = await loadAuthorizedPageEntity({
            ctx,
            permission: testCase.permission,
            table: testCase.table,
            id: testCase.row.id,
            load: where => authorizationTestDb.getDelegate(testCase.delegate).findFirst({ where }),
        });

        expect(result).toEqual(testCase.row);
    });

    it("returns the same empty result for hidden, deleted, and missing rows", async () => {
        const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions });
        const songDelegate = authorizationTestDb.getDelegate("song");
        const load = where => songDelegate.findFirst({ where });
        const baseArgs = {
            ctx,
            permission: Permission.view_songs,
            table: db3.xSong,
            id: 3,
            load,
        };

        songDelegate.reset([{ id: 3, name: "Hidden", isDeleted: false, createdByUserId: null, visiblePermissionId: 999_999 }]);
        await expect(loadAuthorizedPageEntity(baseArgs)).resolves.toBeNull();

        songDelegate.reset([{ id: 3, name: "Deleted", isDeleted: true, createdByUserId: null, visiblePermissionId: membersVisibilityId }]);
        await expect(loadAuthorizedPageEntity(baseArgs)).resolves.toBeNull();

        songDelegate.reset([]);
        await expect(loadAuthorizedPageEntity(baseArgs)).resolves.toBeNull();
    });

    it("uses fresh page grants and stops before the entity lookup when they were revoked", async () => {
        const databaseActor = createAuthorizationTestUser("normal", {
            id: actor.id,
            permissions: [Permission.login],
        });
        authorizationTestDb.reset({ user: [databaseActor] });
        const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions });
        const songLookup = vi.spyOn(authorizationTestDb.getDelegate("song"), "findFirst");

        await expect(loadAuthorizedPageEntity({
            ctx,
            permission: Permission.view_songs,
            table: db3.xSong,
            id: 3,
            load: where => authorizationTestDb.getDelegate("song").findFirst({ where }),
        })).resolves.toBeNull();

        expect(songLookup).not.toHaveBeenCalled();
    });
});

describe("BA-S005 telemetry identity and diagnostic route grants", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        authorizationTestDb.reset({ action: [] });
    });

    it("replaces a client-supplied telemetry identity with the fresh authenticated actor", async () => {
        const actor = createAuthorizationTestUser("normal", { id: 300 });
        authorizationTestDb.reset({ user: [actor], action: [] });
        const { ctx } = createAuthorizationPersona("normal", { id: actor.id });

        await recordAuthenticatedClientAction({
            feature: ActivityFeature.song_view,
            userId: 999,
            songId: 3,
        }, ctx);

        expect(authorizationTestDb.snapshot("action")).toEqual([
            expect.objectContaining({ userId: actor.id, feature: ActivityFeature.song_view }),
        ]);
    });

    it("records anonymous telemetry without accepting a claimed user identity", async () => {
        const { ctx } = createAuthorizationPersona("public");

        await recordAuthenticatedClientAction({
            feature: ActivityFeature.song_view,
            userId: 999,
        }, ctx);

        expect(authorizationTestDb.snapshot("action")).toEqual([
            expect.objectContaining({ userId: null, feature: ActivityFeature.song_view }),
        ]);
    });

    it("uses the fresh database actor for server-side page grants", async () => {
        const sysadmin = createAuthorizationTestUser("sysadmin", { id: 400 });
        authorizationTestDb.reset({ user: [sysadmin] });
        const { ctx } = createAuthorizationPersona("sysadmin", { id: sysadmin.id });
        await expect(isAuthorizedForServerPage(ctx, Permission.sysadmin)).resolves.toBe(true);

        const revokedActor = createAuthorizationTestUser("normal", { id: sysadmin.id });
        authorizationTestDb.reset({ user: [revokedActor] });
        // A new request still carries the old session grants, but reloads the actor.
        const { ctx: nextRequest } = createAuthorizationPersona("sysadmin", { id: sysadmin.id });
        await expect(isAuthorizedForServerPage(nextRequest, Permission.sysadmin)).resolves.toBe(false);
    });
});


describe("administrative wiki revision editing", () => {
    it("invalidates drafts of the page currently displaying the edited revision", async () => {
        const updateMany = vi.fn().mockResolvedValue({ count: 1 });
        await CallMutateEventHooks({
            tableNameOrSpecialMutationKey: "WikiPageRevision",
            model: { id: 42, content: "Administrative correction" },
            db: { wikiPage: { updateMany } } as any,
        });
        expect(updateMany).toHaveBeenCalledWith({
            where: { currentRevisionId: 42 }, data: { contentVersion: { increment: 1 } },
        });
    });
});
