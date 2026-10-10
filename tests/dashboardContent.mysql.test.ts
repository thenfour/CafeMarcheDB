import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { loadDashboardData } from "src/core/db3/server/db3DashboardData";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { hydrateDashboardData } from "src/core/db3/shared/references/dashboardData";
import { menuLinkListView } from "src/core/db3/shared/entities/menuLink/menuLinkViews";
import { xMenuLink } from "src/core/db3/shared/schema/menuLink";
import { GetWikiPageCore } from "src/core/wiki/server/getWikiPageCore";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl } from "src/setup/accessControl";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

async function prepare(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
    const bandPublicId = parsePublicId<"Band">(fixture.bands[0]!.publicId);
    const auth = await loadAuthorizationForUser(fixture.user, tx, bandPublicId);
    const publicPermission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.public } });
    const members = await tx.permission.findUniqueOrThrow({ where: { name: Permission.visibility_members } });
    const member = await tx.bandUser.findFirstOrThrow({ where: { userId: fixture.user.id, bandId: fixture.bands[0]!.id } });
    const name = await tx.dynamicLocalizedString.create({ data: {
        publicId: generatePublicId(), values: { create: [
            { publicId: generatePublicId(), localeId: fixture.englishId, indexedValue: "Scores" },
            { publicId: generatePublicId(), localeId: fixture.frenchId, indexedValue: "Partitions" },
            { publicId: generatePublicId(), localeId: fixture.dutchId, indexedValue: "Partituren" },
        ] },
    } });
    async function menu(index: number, sortOrder: number, permissionId: number | null = members.id) {
        return tx.menuLink.create({ data: {
            publicId: generatePublicId(), bandId: fixture.bands[index]!.id, captionId: name.id,
            sortOrder, applicationPage: "Resources", groupName: "scores", groupCssClass: "", itemCssClass: "score-link",
            linkType: "Wiki", wikiSlug: "special/announcements", createdByUserId: fixture.admin.id, visiblePermissionId: permissionId,
        } });
    }
    const first = await menu(0, 5);
    const publicLink = await menu(0, 1, publicPermission.id);
    const privateLink = await menu(0, 3, null);
    const foreign = await menu(1, 0);
    async function announcements(index: number, permissionId: number | null = members.id) {
        const page = await tx.wikiPage.create({ data: {
            publicId: generatePublicId(), bandId: fixture.bands[index]!.id, slug: "special/announcements", namespace: "special",
            createdByUserId: fixture.admin.id, visiblePermissionId: permissionId,
        } });
        const revision = await tx.wikiPageRevision.create({ data: {
            publicId: generatePublicId(), wikiPageId: page.id, name: "Announcements", content: "Band " + index + " announcement",
        } });
        return tx.wikiPage.update({ where: { id: page.id }, data: { currentRevisionId: revision.id } });
    }
    const pages = await Promise.all([announcements(0), announcements(1)]);
    const context = () => bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });
    const read = async (routeLocale?: string, browserLanguages?: string[]) => loadDashboardData(await context(), auth, { bandPublicId, routeLocale, browserLanguages });
    const wiki = async () => GetWikiPageCore({ canonicalWikiSlug: "special/announcements", authorization: auth,
        database: await context(), clientBaseContentVersion: 0, clientBaseRevisionId: null, clientLockId: null });
    return { auth, bandPublicId, first, publicLink, privateLink, foreign, name, member, pages, read, wiki };
}

describe.skipIf(!settingsMysqlTestUrl)("dashboard Wiki and custom navigation on MariaDB", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasourceUrl: settingsMysqlTestUrl } : undefined);
    beforeAll(() => initializeAccessControl(database), 30_000);
    afterAll(() => database.$disconnect());
    afterEach(() => { vi.restoreAllMocks(); });
    const run = (work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) => withSettingsMysqlFixture(database, work);

    it("delivers selected-band ordered public menu DTOs and hydrates references once without altering the payload", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const hydrate = vi.spyOn(menuLinkListView, "hydrate");
        const dto = await c.read("fr-BE");
        expect(dto.dynMenuLinks.map(link => link.publicId)).toEqual([c.publicLink.publicId, c.first.publicId]);
        expect(dto.dynMenuLinks.map(link => link.caption)).toEqual(["Partitions", "Partitions"]);
        expect(JSON.stringify(dto.dynMenuLinks)).not.toMatch(/"(?:id|bandId|captionId)":/);
        expect(dto.dynMenuLinks[0]!.createdByUserId).toBe((await tx.user.findUniqueOrThrow({ where: { id: fixture.admin.id } })).publicId);
        expect(dto.dynMenuLinks[0]).not.toHaveProperty("visiblePermission");
        expect(dto).not.toHaveProperty("referenceStore");
        expect(hydrate).not.toHaveBeenCalled();
        const original = JSON.stringify(dto);
        const client = hydrateDashboardData(dto);
        expect(hydrate).toHaveBeenCalledTimes(2);
        expect(client.dynMenuLinks[0]!.visiblePermission).toBe(client.permission.find(permission => permission.publicId === client.dynMenuLinks[0]!.visiblePermissionId));
        expect(client.dynMenuLinks[0]!.caption.value).toBe("Partitions");
        expect(JSON.stringify(dto)).toBe(original);
        expect((await c.wiki()).wikiPage?.currentRevision?.content).toBe("Band 0 announcement");
    }));

    it("does not read menu or Wiki tables without explicit band selection, including platform context", () => run(async (tx, fixture) => {
        await prepare(tx, fixture);
        const menu = vi.spyOn(tx.menuLink, "findMany");
        const wiki = vi.spyOn(tx.wikiPage, "findMany");
        for (const person of [fixture.user, fixture.admin]) {
            const auth = await loadAuthorizationForUser(person, tx);
            const dto = await loadDashboardData(await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" }), auth, {});
            expect(dto.dynMenuLinks).toEqual([]);
            expect(dto.relevantEventIds).toEqual([]);
        }
        expect(menu).not.toHaveBeenCalled();
        expect(wiki).not.toHaveBeenCalled();
    }));

    it("resolves band-first blanks and ordered preferences independently across shared-person contexts", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        await tx.bandDynamicLocalizedStringValue.create({ data: {
            publicId: generatePublicId(), bandId: fixture.bands[0]!.id, stringId: c.name.id, localeId: fixture.frenchId, indexedValue: "",
        } });
        expect((await c.read("fr-BE", ["nl-BE"])).dynMenuLinks.map(link => link.caption)).toEqual(["", ""]);
        expect((await c.read(undefined, ["nl-BE"])).dynMenuLinks[0]!.caption).toBe("");
        await tx.bandDynamicLocalizedStringValue.deleteMany({ where: { bandId: fixture.bands[0]!.id, stringId: c.name.id } });
        expect((await c.read(undefined, ["nl-BE", "en-US"])).dynMenuLinks[0]!.caption).toBe("Partituren");
        expect((await c.read(undefined, ["en-US", "nl-BE"])).dynMenuLinks[0]!.caption).toBe("Scores");
        const old = hydrateDashboardData(await c.read("fr-BE"));
        const otherId = parsePublicId<"Band">(fixture.bands[1]!.publicId);
        const platform = await loadAuthorizationForUser(fixture.admin, tx, otherId);
        const other = hydrateDashboardData(await loadDashboardData(await bindDB3ReadSnapshot(tx, platform, { isolationLevel: "Serializable" }), platform, { bandPublicId: otherId, routeLocale: "nl-BE" }));
        expect(other.dynMenuLinks.map(link => link.publicId)).toEqual([c.foreign.publicId]);
        expect(other.dynMenuLinks[0]!.caption.value).toBe("Partituren");
        expect(other.referenceStore).not.toBe(old.referenceStore);
        expect(other.referenceStore.get(xMenuLink, xMenuLink.parseIdentity(c.first.publicId))).toBeUndefined();
    }));

    it.each(["revoked-visibility", "roleless", "outsider", "inactive-member", "deleted-person", "merged-person"] as const)(
        "refreshes %s before delivering member-only links or announcements", kind => run(async (tx, fixture) => {
            const c = await prepare(tx, fixture);
            if (kind === "revoked-visibility") {
                const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.visibility_members } });
                await tx.bandRolePermission.deleteMany({ where: { bandRoleId: c.member.bandRoleId!, permissionId: permission.id } });
            }
            if (kind === "roleless") { await tx.bandUser.update({ where: { id: c.member.id }, data: { bandRoleId: null } }); }
            if (kind === "outsider") { await tx.bandUser.delete({ where: { id: c.member.id } }); }
            if (kind === "inactive-member") { await tx.bandUser.update({ where: { id: c.member.id }, data: { isDeleted: true } }); }
            if (kind === "deleted-person") { await tx.user.update({ where: { id: fixture.user.id }, data: { isDeleted: true } }); }
            if (kind === "merged-person") { await tx.user.update({ where: { id: fixture.user.id }, data: { mergedIntoUserId: fixture.admin.id } }); }
            const dto = await c.read("fr-BE");
            expect(dto.dynMenuLinks.map(link => link.publicId)).toEqual([c.publicLink.publicId]);
            if (kind === "deleted-person" || kind === "merged-person") {
                await expect(c.wiki()).rejects.toThrow();
            } else {
                expect((await c.wiki()).wikiPage).toBeNull();
            }
        }));

    it("serves only public menu links to anonymous band context and never reads announcement content during bootstrap", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const auth = await loadAuthorizationForUser(null, tx, c.bandPublicId);
        const read = await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });
        const wikiRead = vi.spyOn(tx.wikiPage, "findMany");
        const dto = await loadDashboardData(read, auth, { bandPublicId: c.bandPublicId });
        expect(dto.dynMenuLinks.map(link => link.publicId)).toEqual([c.publicLink.publicId]);
        expect(wikiRead).not.toHaveBeenCalled();
        await expect(GetWikiPageCore({ canonicalWikiSlug: "special/announcements", authorization: auth, database: read,
            clientBaseContentVersion: 0, clientBaseRevisionId: null, clientLockId: null })).rejects.toThrow();
    }));

    it("rejects mismatched or deleted selected bands before returning menu data", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const context = await bindDB3ReadSnapshot(tx, c.auth, { isolationLevel: "Serializable" });
        await expect(loadDashboardData(context, c.auth, { bandPublicId: parsePublicId<"Band">(fixture.bands[1]!.publicId) })).rejects.toThrow();
        await tx.band.update({ where: { id: fixture.bands[0]!.id }, data: { isDeleted: true } });
        await expect(c.read()).rejects.toThrow();
    }));

    it("retains the public menu grant independently of customize_menu and rejects unavailable required references", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const customize = await tx.permission.findUniqueOrThrow({ where: { name: Permission.customize_menu } });
        await tx.bandRolePermission.deleteMany({ where: { bandRoleId: c.member.bandRoleId!, permissionId: customize.id } });
        const dto = await c.read();
        expect(dto.dynMenuLinks).toHaveLength(2);
        expect(dto.authorization.effectivePermissionNames).not.toContain(Permission.customize_menu);
        expect(() => hydrateDashboardData({ ...dto, permission: [] })).toThrow(/not available/);
    }));
});
