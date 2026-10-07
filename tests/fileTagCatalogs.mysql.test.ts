import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma, PrismaClient } from "@prisma/client";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser, type CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { initializeAccessControl } from "src/setup/accessControl";
import { generatePublicId } from "src/server/publicId";
import { xBandFileTag, bandFileTagView, xGlobalFileTag, globalFileTagView } from "src/core/db3/shared/entities/file/fileTagCatalogs";
import { FileTagSignificance } from "src/core/db3/shared/schema/prismArgs";
import { loadDashboardCatalogs } from "src/core/db3/server/db3DashboardCatalogs";
import { fileTagDashboardView, createDashboardReferenceStore } from "src/core/db3/shared/references/dashboardReferences";
import { createCommandRowServices } from "src/core/db3/server/db3CommandCore";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { queryView } from "src/core/db3/server/db3QueryCore";
import { executeCatalogCrud } from "./support/db3CatalogFixture";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

const text = (value: string, localeTag = "en-US") => ({ kind: "set", stringPublicId: null, localeTag, value });
const readSnapshot = (tx: Prisma.TransactionClient, auth: CMServerAuthorization) =>
    bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });
const authorize = (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture, index = 0) =>
    loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(fixture.bands[index]!.publicId));

describe.skipIf(!settingsMysqlTestUrl)("file tag catalogs on MariaDB", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasources: { db: { url: settingsMysqlTestUrl } } } : undefined);
    beforeAll(() => initializeAccessControl(database), 30_000);
    afterAll(() => database.$disconnect());
    const withFixture = (work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) =>
        withSettingsMysqlFixture(database, async (tx, fixture) => {
            const member = await tx.bandUser.findUniqueOrThrow({ where: { bandId_userId: { bandId: fixture.bands[0]!.id, userId: fixture.user.id } } });
            const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.admin_files } });
            await tx.bandRolePermission.createMany({ data: { publicId: generatePublicId(), bandRoleId: member.bandRoleId!, permissionId: permission.id }, skipDuplicates: true });
            await work(tx, fixture);
        });

    async function authorizeOtherManager(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
        const member = await tx.bandUser.findUniqueOrThrow({ where: { bandId_userId: { bandId: fixture.bands[0]!.id, userId: fixture.user.id } } });
        await tx.bandUser.update({ where: { bandId_userId: { bandId: fixture.bands[1]!.id, userId: fixture.user.id } }, data: { bandRoleId: member.bandRoleId } });
        const other = await authorize(tx, fixture, 1);
        expect(other.hasPermission(Permission.admin_files)).toBe(true);
        return other;
    }

    async function catalogManager(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
        const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.manage_global_catalogs } });
        const role = await tx.globalRole.create({ data: {
            publicId: generatePublicId(),
            name: { create: { publicId: generatePublicId(), values: { create: { publicId: generatePublicId(), localeId: fixture.englishId, indexedValue: "File tag manager" } } } },
            permissions: { create: { publicId: generatePublicId(), permissionId: permission.id } },
        } });
        const user = await tx.user.create({ data: { publicId: generatePublicId(), name: "File tag manager", email: "files@test.invalid", globalRoleId: role.id } });
        return { role, auth: await loadAuthorizationForUser(user, tx) };
    }

    it("limits shared behavior and translations to fresh platform catalog grants", () => withFixture(async (tx, fixture) => {
        const manager = await catalogManager(tx, fixture);
        const global = await executeCatalogCrud(tx, manager.auth, globalFileTagView, {
            name: text("Score"), description: text("**Score**"), significance: FileTagSignificance.Partition,
        });
        const read = async (routeLocale = "en-US") => (await queryView({ view: globalFileTagView, routeLocale, filter: {}, cmdbQueryContext: "shared file tags" }, manager.auth, await readSnapshot(tx, manager.auth))).items[0]!;
        const initial = await read();
        expect(initial).toMatchObject({ name: "Score", significance: "Partition" });
        expect(initial).not.toHaveProperty("id");
        expect(initial).not.toHaveProperty("nameId");
        await executeCatalogCrud(tx, manager.auth, globalFileTagView, { name: { ...text("Partition", "fr-BE"), stringPublicId: initial.nameStringPublicId } }, global.identity);
        expect(await read("fr-BE")).toMatchObject({ name: "Partition" });
        expect(await read()).toMatchObject({ name: "Score" });
        const bandAuth = await authorize(tx, fixture);
        await expect(executeCatalogCrud(tx, bandAuth, globalFileTagView, { significance: "Recording" }, global.identity)).rejects.toThrow();
        await expect(executeCatalogCrud(tx, manager.auth, globalFileTagView, { significance: "invalid" }, global.identity)).rejects.toThrow();
        await tx.globalRolePermission.deleteMany({ where: { globalRoleId: manager.role.id } });
        await expect(executeCatalogCrud(tx, manager.auth, globalFileTagView, { significance: "Recording" }, global.identity)).rejects.toThrow();
        expect(await tx.globalFileTag.findUniqueOrThrow({ where: { publicId: String(global.identity) } })).toMatchObject({ significance: "Partition" });
    }));

    it("resolves band overrides, blanks and inheritance while keeping behavior global", () => withFixture(async (tx, fixture) => {
        const manager = await catalogManager(tx, fixture);
        const global = await executeCatalogCrud(tx, manager.auth, globalFileTagView, {
            name: text("Score"), description: text("Shared details"), color: "blue", sortOrder: 7, significance: "Partition",
        });
        const auth = await authorize(tx, fixture), other = await authorize(tx, fixture, 1);
        const rows = createCommandRowServices(auth, tx);
        const opted = await rows.optIn(xBandFileTag, String(global.identity));
        expect((await rows.optIn(xBandFileTag, String(global.identity))).publicId).toBe(opted.publicId);
        const read = async () => (await queryView({ view: bandFileTagView, routeLocale: "fr-BE", filter: {}, cmdbQueryContext: "band file tags" }, auth, await readSnapshot(tx, auth))).items[0]!;
        expect(await read()).toMatchObject({ name: "Score", color: "blue", sortOrder: 7, significance: "Partition" });
        await executeCatalogCrud(tx, auth, bandFileTagView, { name: text("Partition locale", "fr-BE"), color: "red", sortOrder: 0 }, opted.publicId);
        const translated = await read();
        expect((await queryView({ view: bandFileTagView, routeLocale: "fr-BE", filter: { quickFilterValues: ["partition", "locale"] }, cmdbQueryContext: "localized tag search" }, auth, await readSnapshot(tx, auth))).items)
            .toHaveLength(1);
        expect((await queryView({ view: bandFileTagView, routeLocale: "en-US", filter: { quickFilterValues: ["score"] }, cmdbQueryContext: "band override suppresses global label" }, auth, await readSnapshot(tx, auth))).items)
            .toEqual([]);
        expect(translated).toMatchObject({ name: "Partition locale", color: "red", sortOrder: 0, significance: "Partition" });
        await executeCatalogCrud(tx, auth, bandFileTagView, { name: { ...text("", "fr-BE"), stringPublicId: translated.nameStringPublicId } }, opted.publicId);
        expect(await read()).toMatchObject({ name: "", nameResolution: { reason: "exact" } });
        await executeCatalogCrud(tx, auth, bandFileTagView, { name: { kind: "inherit", stringPublicId: translated.nameStringPublicId }, color: null, sortOrder: null }, opted.publicId);
        expect(await read()).toMatchObject({ name: "Score", color: "blue", sortOrder: 7 });
        await expect(executeCatalogCrud(tx, auth, bandFileTagView, { significance: "Recording" }, opted.publicId)).rejects.toThrow();
        await executeCatalogCrud(tx, manager.auth, globalFileTagView, { significance: "Recording" }, global.identity);
        const catalogs = await loadDashboardCatalogs(await readSnapshot(tx, auth), auth, { routeLocale: "en-US" });
        expect(fileTagDashboardView.hydrate(catalogs.fileTag[0]!, createDashboardReferenceStore()))
            .toMatchObject({ name: "Score", color: { id: "blue" }, significance: "Recording" });
        expect((await loadDashboardCatalogs(await readSnapshot(tx, other), other, {})).fileTag).toEqual([]);
        const local = await executeCatalogCrud(tx, auth, bandFileTagView, { name: text("Custom") });
        expect((await queryView({ view: bandFileTagView, filter: { publicIds: [xBandFileTag.parseIdentity(local.identity)] }, cmdbQueryContext: "local behavior" }, auth, await readSnapshot(tx, auth))).items[0])
            .toMatchObject({ significance: null });
        await expect(executeCatalogCrud(tx, auth, bandFileTagView, { name: { kind: "inherit", stringPublicId: null } }, local.identity)).rejects.toThrow();
    }));

    it("retains hidden file assignments, restricts shared deletion and scopes band deletion", () => withFixture(async (tx, fixture) => {
        const manager = await catalogManager(tx, fixture);
        const global = await executeCatalogCrud(tx, manager.auth, globalFileTagView, { name: text("Score"), description: text(""), significance: "Partition" });
        const auth = await authorize(tx, fixture), other = await authorizeOtherManager(tx, fixture);
        const opted = await createCommandRowServices(auth, tx).optIn(xBandFileTag, String(global.identity));
        const tag = await tx.bandFileTag.findUniqueOrThrow({ where: { publicId: opted.publicId } });
        const file = await tx.file.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[0]!.id,
            fileLeafName: "score.pdf", storedLeafName: "score.pdf", description: "", uploadedAt: new Date() } });
        await tx.bandFileTagAssignment.create({ data: { publicId: generatePublicId(), fileId: file.id, bandFileTagId: tag.id } });
        await executeCatalogCrud(tx, auth, bandFileTagView, { isHidden: true }, opted.publicId);
        expect(await tx.bandFileTagAssignment.count({ where: { bandFileTagId: tag.id } })).toBe(1);
        expect((await loadDashboardCatalogs(await readSnapshot(tx, auth), auth, {})).fileTag[0])
            .toMatchObject({ publicId: opted.publicId, isHidden: true, significance: "Partition" });
        const member = await tx.bandUser.findUniqueOrThrow({ where: { bandId_userId: { bandId: fixture.bands[0]!.id, userId: fixture.user.id } } });
        // Roleless members cannot pick hidden tags, while the band manager can still resolve references.
        await tx.bandUser.updateMany({ where: { bandId: fixture.bands[0]!.id, userId: fixture.user.id }, data: { bandRoleId: null } });
        const roleless = await authorize(tx, fixture);
        expect((await loadDashboardCatalogs(await readSnapshot(tx, roleless), roleless, {})).fileTag).toEqual([]);
        await expect(createCommandRowServices(other, tx).delete(xBandFileTag, opted.publicId, "hard")).rejects.toThrow();
        await expect(createCommandRowServices(manager.auth, tx).delete(xGlobalFileTag, xGlobalFileTag.parseIdentity(global.identity), "hard")).rejects.toThrow();
        await expect(createCommandRowServices(await auth.refresh(tx), tx).delete(xBandFileTag, opted.publicId, "hard")).rejects.toThrow();
        await tx.bandUser.update({ where: { id: member.id }, data: { bandRoleId: member.bandRoleId } });
        await createCommandRowServices(await auth.refresh(tx), tx).delete(xBandFileTag, opted.publicId, "hard");
        expect(await tx.bandFileTagAssignment.count({ where: { bandFileTagId: tag.id } })).toBe(0);
        expect(await tx.file.count({ where: { id: file.id } })).toBe(1);
        await createCommandRowServices(manager.auth, tx).delete(xGlobalFileTag, xGlobalFileTag.parseIdentity(global.identity), "hard");
        expect(await tx.globalFileTag.count({ where: { publicId: String(global.identity) } })).toBe(0);
    }));

    it("rejects band spoofing, foreign identities, global relinking and revoked band grants", () => withFixture(async (tx, fixture) => {
        const auth = await authorize(tx, fixture), other = await authorizeOtherManager(tx, fixture);
        const created = await executeCatalogCrud(tx, auth, bandFileTagView, { name: text("Local") });
        await expect(executeCatalogCrud(tx, auth, bandFileTagView, { bandId: fixture.bands[1]!.publicId }, created.identity)).rejects.toThrow();
        await expect(executeCatalogCrud(tx, auth, bandFileTagView, { globalFileTag: generatePublicId() }, created.identity)).rejects.toThrow();
        await expect(executeCatalogCrud(tx, other, bandFileTagView, { name: text("Stolen") }, created.identity)).rejects.toThrow();
        expect((await queryView({ view: bandFileTagView, filter: { publicIds: [xBandFileTag.parseIdentity(created.identity)] }, cmdbQueryContext: "other band" }, other, await readSnapshot(tx, other))).items).toEqual([]);
        await tx.bandUser.updateMany({ where: { bandId: fixture.bands[0]!.id, userId: fixture.user.id }, data: { bandRoleId: null } });
        await expect(executeCatalogCrud(tx, auth, bandFileTagView, { color: "red" }, created.identity)).rejects.toThrow();
        expect(await tx.bandFileTag.findUniqueOrThrow({ where: { publicId: String(created.identity) } })).toMatchObject({ bandId: fixture.bands[0]!.id, color: null });
    }));
});
