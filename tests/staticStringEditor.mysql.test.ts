import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { CreateChangeContext } from "src/auth/server/activityLog";
import { initializeAccessControl } from "src/setup/accessControl";
import { writeStaticString, loadStaticStringEditor } from "src/locale/server/staticStringEditor";
import { loadLocalizationCatalog } from "src/locale/server/localization";
import type { StaticStringTarget, StaticStringWrite } from "src/locale/shared/staticStringEdit";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";
import { songTransactionRoot } from "./support/songWorkflowMysqlFixture";

describe.skipIf(!settingsMysqlTestUrl)("registered translation editor on MariaDB", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasources: { db: { url: settingsMysqlTestUrl } } } : undefined);
    beforeAll(() => initializeAccessControl(database), 30_000);
    afterAll(() => database.$disconnect());
    const withFixture = (work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) =>
        withSettingsMysqlFixture(database, work);
    const target = (fixture: SettingsMysqlFixture, overrides: Partial<StaticStringTarget> = {}): StaticStringTarget => ({
        key: "GlobalWikiPage_Markdown", scope: "band", localeTag: "fr-BE",
        bandPublicId: parsePublicId<"Band">(fixture.bands[0]!.publicId), ...overrides,
    });
    async function write(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture, command: StaticStringWrite) {
        const auth = await loadAuthorizationForUser(fixture.user, tx, command.target.bandPublicId);
        await writeStaticString(tx, auth, command, CreateChangeContext("native translation"));
    }
    it("keeps resolved global content separate from an exact override and a stored blank", () => withFixture(async (tx, fixture) => {
        const globalTarget = target(fixture, { scope: "global", bandPublicId: null });
        const platform = await loadAuthorizationForUser(fixture.admin, tx);
        await writeStaticString(tx, platform, { target: globalTarget, operation: { kind: "set", value: "Global French" } }, CreateChangeContext("global"));
        const auth = await loadAuthorizationForUser(fixture.user, tx, target(fixture).bandPublicId);
        expect(await loadStaticStringEditor(tx, auth, target(fixture))).toEqual({ value: null, canSet: true });
        expect((await loadLocalizationCatalog(tx, auth, { routeLocale: "fr-BE" })).strings.GlobalWikiPage_Markdown.value).toBe("Global French");
        await write(tx, fixture, { target: target(fixture), operation: { kind: "set", value: "" } });
        const stored = await tx.bandStaticLocalizedStringValue.findFirstOrThrow({ where: { bandId: fixture.bands[0]!.id, stringKey: globalTarget.key } });
        expect(stored).toMatchObject({ indexedValue: null, blobValue: "", localeId: fixture.frenchId, updatedByUserId: fixture.user.id });
        expect((await loadLocalizationCatalog(tx, auth, { routeLocale: "fr-BE" })).strings.GlobalWikiPage_Markdown.value).toBe("");
        await write(tx, fixture, { target: target(fixture), operation: { kind: "reset" } });
        expect((await loadLocalizationCatalog(tx, auth, { routeLocale: "fr-BE" })).strings.GlobalWikiPage_Markdown.value).toBe("Global French");
    }));
    it("preserves other languages, band rows and platform rows when saving or resetting", () => withFixture(async (tx, fixture) => {
        const first = target(fixture);
        const platform = await loadAuthorizationForUser(fixture.admin, tx, first.bandPublicId);
        const second = target(fixture, { bandPublicId: parsePublicId<"Band">(fixture.bands[1]!.publicId) });
        for (const [writeTarget, value] of [[first, "French"], [target(fixture, { localeTag: "nl-BE" }), "Dutch"], [second, "Other band"]] as const) {
            const auth = await loadAuthorizationForUser(fixture.admin, tx, writeTarget.bandPublicId);
            await writeStaticString(tx, auth, { target: writeTarget, operation: { kind: "set", value } }, CreateChangeContext("scopes"));
        }
        await writeStaticString(tx, platform, { target: first, operation: { kind: "reset" } }, CreateChangeContext("reset one"));
        expect(await tx.bandStaticLocalizedStringValue.findMany({ orderBy: { id: "asc" } })).toMatchObject([
            { bandId: fixture.bands[0]!.id, localeId: fixture.dutchId, blobValue: "Dutch" },
            { bandId: fixture.bands[1]!.id, localeId: fixture.frenchId, blobValue: "Other band" },
        ]);
    }));
    it("stores long Markdown and indexed plain text with native unique updates and person audits", () => withFixture(async (tx, fixture) => {
        const markdown = "**é**\n".repeat(1000);
        const first = target(fixture);
        const commands: StaticStringWrite[] = [
            { target: first, operation: { kind: "set", value: markdown } },
            { target: first, operation: { kind: "set", value: markdown } },
            { target: { ...first, key: "common.action.ok" }, operation: { kind: "set", value: "Oui" } },
            { target: first, operation: { kind: "set", value: "updated" } },
            { target: first, operation: { kind: "reset" } },
        ];
        for (const command of commands) {
            await write(tx, fixture, command);
        }
        expect(await tx.bandStaticLocalizedStringValue.findMany()).toMatchObject([{ indexedValue: "Oui", blobValue: null }]);
        const audits = await tx.change.findMany({ where: { table: "BandStaticLocalizedStringValue" }, orderBy: { id: "asc" } });
        expect(audits).toHaveLength(4);
        expect(audits.every(audit => audit.userId === fixture.user.id)).toBe(true);
        expect(audits[0]?.newValues).toContain(markdown.replace(/\n/g, "\\n"));
    }));
    it("freshly rejects band and platform writers after grant revocation without changing stored text", () => withFixture(async (tx, fixture) => {
        const first = target(fixture);
        const command: StaticStringWrite = { target: first, operation: { kind: "set", value: "before" } };
        const stale = await loadAuthorizationForUser(fixture.user, tx, first.bandPublicId);
        await writeStaticString(tx, stale, command, CreateChangeContext("before"));
        const membership = await tx.bandUser.findFirstOrThrow({ where: { userId: fixture.user.id, bandId: fixture.bands[0]!.id } });
        const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.manage_band_localization } });
        await tx.bandRolePermission.deleteMany({ where: { bandRoleId: membership.bandRoleId!, permissionId: permission.id } });
        const fresh = await stale.refresh(tx);
        await expect(writeStaticString(tx, fresh, { ...command, operation: { kind: "set", value: "after" } }, CreateChangeContext("after"))).rejects.toThrow();
        await expect(loadStaticStringEditor(tx, fresh, first)).rejects.toThrow();
        expect((await tx.bandStaticLocalizedStringValue.findFirstOrThrow()).blobValue).toBe("before");
        const admin = await tx.user.findUniqueOrThrow({ where: { id: fixture.admin.id } });
        const platform = await loadAuthorizationForUser(fixture.admin, tx);
        await tx.globalRole.update({ where: { id: admin.globalRoleId! }, data: { isSysAdminRole: false } });
        const globalPermission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.manage_global_localization } });
        await tx.globalRolePermission.deleteMany({ where: { globalRoleId: admin.globalRoleId!, permissionId: globalPermission.id } });
        await expect(writeStaticString(tx, await platform.refresh(tx), { target: { ...first, scope: "global", bandPublicId: null },
            operation: { kind: "set", value: "global denied" } }, CreateChangeContext("revoked"))).rejects.toThrow();
    }));
    it("rejects another band's grants and forged target ownership", () => withFixture(async (tx, fixture) => {
        const second = target(fixture, { bandPublicId: parsePublicId<"Band">(fixture.bands[1]!.publicId) });
        await expect(write(tx, fixture, { target: second, operation: { kind: "set", value: "wrong" } })).rejects.toThrow();
        const firstAuth = await loadAuthorizationForUser(fixture.user, tx, target(fixture).bandPublicId);
        await expect(loadStaticStringEditor(tx, firstAuth, second)).rejects.toThrow();
        expect(await tx.bandStaticLocalizedStringValue.count()).toBe(0);
    }));
    it("prevents disabled-locale writes and lets their stored override be removed", () => withFixture(async (tx, fixture) => {
        const first = target(fixture);
        await write(tx, fixture, { target: first, operation: { kind: "set", value: "French" } });
        await tx.bandLocale.delete({ where: { bandId_localeId: { bandId: fixture.bands[0]!.id, localeId: fixture.frenchId } } });
        const auth = await loadAuthorizationForUser(fixture.user, tx, first.bandPublicId);
        expect(await loadStaticStringEditor(tx, auth, first)).toEqual({ value: "French", canSet: false });
        await expect(write(tx, fixture, { target: first, operation: { kind: "set", value: "after" } })).rejects.toThrow();
        await tx.locale.update({ where: { id: fixture.frenchId }, data: { isDeleted: true } });
        await write(tx, fixture, { target: first, operation: { kind: "reset" } });
        expect(await tx.bandStaticLocalizedStringValue.count()).toBe(0);
    }));
    it("rolls back translations and audits together when a transaction fails after writing", () => withFixture(async (tx, fixture) => {
        const root = songTransactionRoot(tx);
        await expect(root.$transaction(async writeTx => {
            await write(writeTx, fixture, { target: target(fixture), operation: { kind: "set", value: "rolled back" } });
            throw new Error("commit failed");
        }, { isolationLevel: "Serializable" })).rejects.toThrow("commit failed");
        expect(await tx.bandStaticLocalizedStringValue.count()).toBe(0);
        expect(await tx.change.count({ where: { table: "BandStaticLocalizedStringValue" } })).toBe(0);
    }));
});
