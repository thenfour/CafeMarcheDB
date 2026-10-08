import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma, PrismaClient } from "@prisma/client";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser, type CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { initializeAccessControl } from "src/setup/accessControl";
import { generatePublicId } from "src/server/publicId";
import { bindDB3ReadSnapshot, type DB3ReadContext } from "src/core/db3/server/db3ReadExecution";
import { queryTable, queryView } from "src/core/db3/server/db3QueryCore";
import { wikiPageApiView, wikiPageRevisionContributionView, wikiPageRevisionDetailView, wikiPageRevisionHistoryView, wikiPageEditorView } from "src/core/db3/shared/entities/wiki/wikiViews";
import { xWikiPage, xWikiPageCurrentRevision, xWikiPageRevision } from "src/core/db3/shared/schema/wiki";
import { acquireWikiLock, saveWikiPage } from "src/core/wiki/server/wikiPageEditing";
import { clearWikiLock, deleteWikiPageRevision, rebuildWikiRevisionStats, releaseWikiLock, renewWikiLock, setWikiVisibility } from "src/core/wiki/server/wikiPageAdministration";
import { GetWikiPageCore } from "src/core/wiki/server/getWikiPageCore";
import { ZTAcquireLockOnWikiPageArgs, ZTUpdateWikiPageArgs, ZTGetWikiPageArgs, ZTSetWikiPageVisibilityArgs } from "src/core/wiki/shared/wikiUtils";
import { createCommandRowServices } from "src/core/db3/server/db3CommandCore";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";
import { executeCatalogCrud } from "./support/db3CatalogFixture";

const snapshot = (tx: Prisma.TransactionClient, auth: CMServerAuthorization) =>
    bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });

describe.skipIf(!settingsMysqlTestUrl)("band wiki pages on MariaDB", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasources: { db: { url: settingsMysqlTestUrl } } } : undefined);
    beforeAll(() => initializeAccessControl(database), 30_000);
    afterAll(() => database.$disconnect());
    const withFixture = (work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) =>
        withSettingsMysqlFixture(database, work);

    async function authorize(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture, bandIndex = 0) {
        const bandPublicId = parsePublicId<"Band">(fixture.bands[bandIndex]!.publicId);
        const auth = await loadAuthorizationForUser(fixture.user, tx, bandPublicId);
        return { auth, context: await snapshot(tx, auth), bandPublicId };
    }
    const acquireArgs = (context: DB3ReadContext, slug = "handbook", lockId: string = generatePublicId()) => ({
        bandPublicId: parsePublicId<"Band">(context.authorization.requireBand().publicId),
        canonicalWikiPath: slug, lockId, baseRevisionId: null, baseContentVersion: 0,
    });
    async function rawPage(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture, bandIndex: number,
        slug = "handbook", creatorId = fixture.user.id, visiblePermissionId: number | null = null) {
        return tx.wikiPage.create({ data: {
            publicId: generatePublicId(), bandId: fixture.bands[bandIndex]!.id,
            slug, createdByUserId: creatorId, visiblePermissionId,
        } });
    }
    async function read(context: DB3ReadContext, slug = "handbook") {
        return GetWikiPageCore({
            canonicalWikiSlug: slug, authorization: context.authorization, database: context,
            clientBaseContentVersion: 0, clientBaseRevisionId: null, clientLockId: null,
        });
    }

    it("reads current content without granting history, including selected-band and visibility boundaries", () => withFixture(async (tx, fixture) => {
        const members = await tx.permission.findUniqueOrThrow({ where: { name: Permission.visibility_members } });
        const membership = await tx.bandUser.findFirstOrThrow({ where: { userId: fixture.user.id, bandId: fixture.bands[0]!.id } });
        const history = await tx.permission.findUniqueOrThrow({ where: { name: Permission.view_wiki_page_revisions } });
        await tx.bandRolePermission.deleteMany({ where: { bandRoleId: membership.bandRoleId!, permissionId: history.id } });
        const page = await rawPage(tx, fixture, 0, "handbook", fixture.admin.id, members.id);
        const previous = await tx.wikiPageRevision.create({ data: {
            publicId: generatePublicId(), wikiPageId: page.id, name: "Old title", content: "Previous content",
        } });
        const current = await tx.wikiPageRevision.create({ data: {
            publicId: generatePublicId(), wikiPageId: page.id, name: "Current title", content: "Published content",
        } });
        await tx.wikiPage.update({ where: { id: page.id }, data: { currentRevisionId: current.id } });
        const { context, auth } = await authorize(tx, fixture);
        expect(auth.hasPermission(Permission.view_wiki_page_revisions)).toBe(false);
        expect((await read(context)).wikiPage?.currentRevision).toMatchObject({ publicId: current.publicId, content: "Published content" });
        const currentRows = await queryTable({ table: xWikiPageCurrentRevision, filter: {}, orderBy: undefined, cmdbQueryContext: "current wiki fixture" }, auth, context);
        expect(currentRows.items.map(row => row.publicId)).toEqual([current.publicId]);
        await expect(queryView({ view: wikiPageRevisionDetailView, filter: { publicIds: [xWikiPageRevision.parseIdentity(previous.publicId)] }, cmdbQueryContext: "history denied" }, auth, context)).rejects.toThrow();
        const historyRows = await queryView({ view: wikiPageRevisionHistoryView, filter: { publicIds: [xWikiPage.parseIdentity(page.publicId)] }, cmdbQueryContext: "history denied" }, auth, context);
        expect(historyRows.items[0]).not.toHaveProperty("revisions");
        await tx.wikiPage.update({ where: { id: page.id }, data: { visiblePermissionId: null } });
        expect((await read(context)).wikiPage).toBeNull();
        expect((await queryTable({ table: xWikiPageCurrentRevision, filter: {}, orderBy: undefined, cmdbQueryContext: "private current wiki" }, auth, context)).items).toEqual([]);
        await tx.wikiPage.update({ where: { id: page.id }, data: { bandId: fixture.bands[1]!.id, visiblePermissionId: members.id } });
        expect((await read(context)).wikiPage).toBeNull();
        expect((await queryTable({ table: xWikiPageCurrentRevision, filter: {}, orderBy: undefined, cmdbQueryContext: "foreign current wiki" }, auth, context)).items).toEqual([]);
    }));

    it("creates owned pages with Members visibility, saves/consolidates content and returns public revisions", () => withFixture(async (tx, fixture) => {
        const { context } = await authorize(tx, fixture);
        const args = acquireArgs(context);
        const locked = await acquireWikiLock(context, args);
        expect(locked.isLockedInThisContext).toBe(true);
        const row = await tx.wikiPage.findUniqueOrThrow({ where: { publicId: locked.currentPage!.publicId } });
        const members = await tx.permission.findUniqueOrThrow({ where: { name: Permission.visibility_members } });
        expect(row).toMatchObject({ bandId: fixture.bands[0]!.id, createdByUserId: fixture.user.id, visiblePermissionId: members.id });
        const saved = await saveWikiPage(context, { ...args, title: "Handbook", content: "First draft" });
        expect(saved.outcome).toBe("success");
        expect(saved.currentPage?.contentVersion).toBe(1);
        const consolidated = await saveWikiPage(context, {
            ...args, title: "Handbook", content: "Updated draft", baseContentVersion: 1,
            baseRevisionId: saved.currentPage!.currentRevision!.publicId,
        });
        expect(consolidated.currentPage?.contentVersion).toBe(2);
        expect(consolidated.currentPage?.currentRevision?.publicId).toBe(saved.currentPage?.currentRevision?.publicId);
        expect(await tx.wikiPageRevision.count({ where: { wikiPageId: row.id } })).toBe(1);
        expect(await tx.change.count({ where: { table: "wikiPageRevision", userId: fixture.user.id } })).toBe(2);
        const page = (await read(context)).wikiPage!;
        expect(page.currentRevision?.content).toBe("Updated draft");
        expect(page).not.toHaveProperty("id");
        expect(page).not.toHaveProperty("bandId");
        expect(page.currentRevision).not.toHaveProperty("id");
        expect(page.lockedByUser?.publicId).toBe(context.authorization.userPublicId);
        const history = await queryView({ cmdbQueryContext: "wiki native fixture", view: wikiPageRevisionHistoryView, filter: { publicIds: [page.publicId] } }, context.authorization, context);
        expect(history.items[0]?.revisions).toHaveLength(1);
        const contributions = await queryView({ cmdbQueryContext: "wiki contributions fixture", view: wikiPageRevisionContributionView,
            filter: { tableParams: { userId: context.authorization.requireUser().userPublicId } } }, context.authorization, context);
        expect(contributions.items[0]?.wikiPage?.publicId).toBe(page.publicId);
    }));

    it("keeps identical slugs, leases and creators independent across two bands", () => withFixture(async (tx, fixture) => {
        const first = await authorize(tx, fixture);
        const membership = await tx.bandUser.findUniqueOrThrow({ where: { bandId_userId: { bandId: fixture.bands[0]!.id, userId: fixture.user.id } } });
        await tx.bandUser.updateMany({ where: { bandId: fixture.bands[1]!.id }, data: { bandRoleId: membership.bandRoleId } });
        const second = await authorize(tx, fixture, 1);
        const args = acquireArgs(first.context, "same-slug", "same-editor-token");
        const a = await acquireWikiLock(first.context, args);
        const b = await acquireWikiLock(second.context, { ...args, bandPublicId: second.bandPublicId });
        expect(a.currentPage?.publicId).not.toBe(b.currentPage?.publicId);
        await releaseWikiLock(first.context, args);
        const bRow = await tx.wikiPage.findUniqueOrThrow({ where: { publicId: b.currentPage!.publicId } });
        expect(bRow.lockId).toBe(args.lockId);
        expect((await read(first.context, "same-slug")).wikiPage?.lockId).toBeNull();
        expect((await read(second.context, "same-slug")).wikiPage?.publicId).toBe(bRow.publicId);
        const foreignId = xWikiPage.parseIdentity(bRow.publicId);
        expect((await queryView({ cmdbQueryContext: "wiki native fixture", view: wikiPageApiView, filter: { publicIds: [foreignId] } }, first.auth, first.context)).items).toEqual([]);
        await expect(createCommandRowServices(first.auth, tx).update(xWikiPage, foreignId, { slug: "forged" })).rejects.toThrow();
    }));

    it("retains private-page visibility and never recreates an unreadable slug", () => withFixture(async (tx, fixture) => {
        const { context } = await authorize(tx, fixture);
        const hidden = await rawPage(tx, fixture, 0, "private", fixture.admin.id);
        const revision = await tx.wikiPageRevision.create({ data: { publicId: generatePublicId(), wikiPageId: hidden.id, name: "Secret", content: "Hidden content" } });
        expect((await read(context, "private")).wikiPage).toBeNull();
        await expect(acquireWikiLock(context, acquireArgs(context, "private"))).rejects.toThrow();
        await expect(clearWikiLock(context, { ...acquireArgs(context, "private") })).rejects.toThrow();
        await expect(setWikiVisibility(context, { ...acquireArgs(context, "private"), visiblePermissionId: null })).rejects.toThrow();
        expect((await queryView({ cmdbQueryContext: "wiki native fixture", view: wikiPageRevisionDetailView, filter: { publicIds: [xWikiPageRevision.parseIdentity(revision.publicId)] } }, context.authorization, context)).items).toEqual([]);
        await expect(deleteWikiPageRevision(context, xWikiPageRevision.parseIdentity(revision.publicId))).rejects.toThrow();
        expect(await tx.wikiPage.count({ where: { slug: "private" } })).toBe(1);
        const own = await rawPage(tx, fixture, 0, "own-private");
        expect((await read(context, "own-private")).wikiPage?.publicId).toBe(own.publicId);
    }));

    it("requires band context and fresh grants, and rejects forged ownership and transport keys", () => withFixture(async (tx, fixture) => {
        const { context, auth } = await authorize(tx, fixture);
        const args = acquireArgs(context);
        expect(ZTAcquireLockOnWikiPageArgs.safeParse({ ...args, bandId: fixture.bands[1]!.id }).success).toBe(false);
        expect(ZTUpdateWikiPageArgs.safeParse({ ...args, title: "Title", content: "Text", createdByUserId: fixture.admin.id }).success).toBe(false);
        expect(ZTGetWikiPageArgs.safeParse({ canonicalWikiPath: "test", lockId: null, baseRevisionId: null, baseContentVersion: 0 }).success).toBe(false);
        expect(ZTSetWikiPageVisibilityArgs.safeParse({ bandPublicId: args.bandPublicId,
            canonicalWikiPath: args.canonicalWikiPath, visiblePermissionId: 1 }).success).toBe(false);
        const platform = await loadAuthorizationForUser(fixture.admin, tx);
        await expect(acquireWikiLock(await snapshot(tx, platform), args)).rejects.toThrow("band context");
        const locked = await acquireWikiLock(context, args);
        const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.edit_wiki_pages } });
        await tx.bandRolePermission.deleteMany({ where: { permissionId: permission.id } });
        const fresh = await snapshot(tx, auth);
        await expect(saveWikiPage(fresh, { ...args, title: "Revoked", content: "Text" })).rejects.toThrow("edit_wiki_pages");
        await expect(renewWikiLock(fresh, args)).rejects.toThrow("edit_wiki_pages");
        await expect(releaseWikiLock(fresh, args)).rejects.toThrow("edit_wiki_pages");
        expect(await tx.wikiPageRevision.count({ where: { wikiPageId: (await tx.wikiPage.findUniqueOrThrow({ where: { publicId: locked.currentPage!.publicId } })).id } })).toBe(0);
    }));

    it("preserves lease takeover, expiry and immutable draft-base checks", () => withFixture(async (tx, fixture) => {
        const { context } = await authorize(tx, fixture);
        const args = acquireArgs(context);
        const locked = await acquireWikiLock(context, args);
        const save = { ...args, title: "Title", content: "One" };
        const first = await saveWikiPage(context, save);
        expect((await saveWikiPage(context, save)).outcome).toBe("revisionConflict");
        const freshBase = { ...args, baseContentVersion: 1, baseRevisionId: first.currentPage!.currentRevision!.publicId };
        expect((await acquireWikiLock(context, { ...freshBase, lockId: "second-editor" })).outcome).toBe("lockConflict");
        expect((await acquireWikiLock(context, { ...freshBase, lockId: "second-editor", takeOverLockId: args.lockId })).outcome).toBe("success");
        await releaseWikiLock(context, args);
        expect((await read(context)).wikiPage?.lockId).toBe("second-editor");
        expect((await saveWikiPage(context, { ...save, ...freshBase })).outcome).toBe("lockConflict");
        await tx.wikiPage.update({ where: { publicId: locked.currentPage!.publicId }, data: { lockExpiresAt: new Date(0) } });
        expect(await renewWikiLock(context, { ...args, lockId: "second-editor" })).toBe(false);
        expect((await saveWikiPage(context, { ...save, ...freshBase, lockId: "second-editor" })).outcome).toBe("lockConflict");
    }));

    it("changes visibility with public references and clears only an authorized selected-band lock", () => withFixture(async (tx, fixture) => {
        const { context, auth } = await authorize(tx, fixture);
        const args = acquireArgs(context);
        const locked = await acquireWikiLock(context, args);
        const foreign = await rawPage(tx, fixture, 1);
        await tx.wikiPage.update({ where: { id: foreign.id }, data: { lockId: "foreign" } });
        const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.visibility_public } });
        await setWikiVisibility(context, { ...args, visiblePermissionId: parsePublicId<"Permission">(permission.publicId) });
        expect((await read(context)).wikiPage?.visiblePermissionId).toBe(permission.publicId);
        await clearWikiLock(context, args);
        expect((await read(context)).wikiPage?.lockId).toBeNull();
        expect((await tx.wikiPage.findUniqueOrThrow({ where: { id: foreign.id } })).lockId).toBe("foreign");
        const adminGrant = await tx.permission.findUniqueOrThrow({ where: { name: Permission.admin_wiki_pages } });
        await tx.bandRolePermission.deleteMany({ where: { permissionId: adminGrant.id } });
        await expect(clearWikiLock(await snapshot(tx, auth), args)).rejects.toThrow("admin_wiki_pages");
        expect(await tx.change.count({ where: { table: "WikiPage", recordId: (await tx.wikiPage.findUniqueOrThrow({ where: { publicId: locked.currentPage!.publicId } })).id } })).toBeGreaterThan(0);
    }));

    it("binds event-description creation and save to visible same-band events", () => withFixture(async (tx, fixture) => {
        const { context } = await authorize(tx, fixture);
        const members = await tx.permission.findUniqueOrThrow({ where: { name: Permission.visibility_members } });
        const event = await tx.event.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[0]!.id, name: "Concert", revision: 0, visiblePermissionId: members.id } });
        const foreign = await tx.event.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[1]!.id, name: "Foreign concert", revision: 0, createdByUserId: fixture.user.id } });
        const privateEvent = await tx.event.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[0]!.id, name: "Private concert", revision: 0, createdByUserId: fixture.admin.id } });
        for (const forbidden of [foreign, privateEvent]) {
            await expect(acquireWikiLock(context, acquireArgs(context, `EventDescription/${forbidden.publicId}`))).rejects.toThrow();
        }
        expect(await tx.wikiPage.count()).toBe(0);
        const args = acquireArgs(context, `EventDescription/${event.publicId}`);
        const locked = await acquireWikiLock(context, args);
        await saveWikiPage(context, { ...args, title: "Ignored display title", content: "Concert notes" });
        const linked = await tx.event.findUniqueOrThrow({ where: { id: event.id } });
        const page = await tx.wikiPage.findUniqueOrThrow({ where: { publicId: locked.currentPage!.publicId } });
        expect(linked.descriptionWikiPageId).toBe(page.id);
        expect((await read(context, args.canonicalWikiPath)).wikiPage?.currentRevision?.name).toBe("Concert");
        expect(page.visiblePermissionId).toBe(members.id);
    }));

    it("scopes revision maintenance and deletion, and protects current revisions", () => withFixture(async (tx, fixture) => {
        const { context } = await authorize(tx, fixture);
        const own = await rawPage(tx, fixture, 0);
        const foreign = await rawPage(tx, fixture, 1);
        const old = await tx.wikiPageRevision.create({ data: { publicId: generatePublicId(), wikiPageId: own.id, name: "Old", content: "Old", createdAt: new Date("2026-01-01") } });
        const current = await tx.wikiPageRevision.create({ data: { publicId: generatePublicId(), wikiPageId: own.id, name: "Current", content: "New", createdAt: new Date("2026-02-01") } });
        const other = await tx.wikiPageRevision.create({ data: { publicId: generatePublicId(), wikiPageId: foreign.id, name: "Foreign", content: "Secret" } });
        await tx.wikiPage.update({ where: { id: own.id }, data: { currentRevisionId: current.id } });
        await rebuildWikiRevisionStats(context);
        expect((await tx.wikiPageRevision.findUniqueOrThrow({ where: { id: current.id } })).sizeChars).toBe(3);
        expect((await tx.wikiPageRevision.findUniqueOrThrow({ where: { id: other.id } })).sizeChars).toBeNull();
        await expect(deleteWikiPageRevision(context, xWikiPageRevision.parseIdentity(other.publicId))).rejects.toThrow();
        await expect(deleteWikiPageRevision(context, xWikiPageRevision.parseIdentity(current.publicId))).rejects.toThrow("current wiki page revision");
        await deleteWikiPageRevision(context, xWikiPageRevision.parseIdentity(old.publicId));
        expect(await tx.wikiPageRevision.count({ where: { id: old.id } })).toBe(0);
    }));

    it("edits page tags through the shared band catalog and rejects foreign references", () => withFixture(async (tx, fixture) => {
        const { context, auth } = await authorize(tx, fixture);
        const own = await rawPage(tx, fixture, 0);
        const string = await tx.dynamicLocalizedString.create({ data: { publicId: generatePublicId(), values: { create: { publicId: generatePublicId(), localeId: fixture.englishId, indexedValue: "Policy" } } } });
        const tag = await tx.bandWikiPageTag.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[0]!.id, nameId: string.id } });
        const other = await tx.bandWikiPageTag.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[1]!.id, nameId: string.id } });
        await executeCatalogCrud(tx, auth, wikiPageEditorView, { tags: [tag.publicId] }, xWikiPage.parseIdentity(own.publicId));
        const dto = (await queryView({ cmdbQueryContext: "wiki native fixture", view: wikiPageEditorView, filter: { publicIds: [xWikiPage.parseIdentity(own.publicId)] } }, auth, context)).items[0]!;
        expect(dto.tags?.[0]?.bandWikiPageTagId).toBe(tag.publicId);
        await expect(executeCatalogCrud(tx, auth, wikiPageEditorView, { tags: [other.publicId] }, xWikiPage.parseIdentity(own.publicId))).rejects.toThrow();
        expect(await tx.wikiPageTagAssignment.count({ where: { wikiPageId: own.id } })).toBe(1);
    }));
});
