import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser, type CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { DB3PaginatedQueryCore, queryView } from "src/core/db3/server/db3QueryCore";
import { platformUserEditorView } from "src/core/db3/shared/entities/user/platformUser";
import { userIdentitySummaryView } from "src/core/db3/shared/entities/user/userViews";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl } from "src/setup/accessControl";
import { readUserManagementCapabilities } from "src/auth/server/userManagementCapabilitiesRead";
import { executeCatalogCrud } from "./support/db3CatalogFixture";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

describe.skipIf(!settingsMysqlTestUrl)("platform accounts on MariaDB", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasources: { db: { url: settingsMysqlTestUrl } } } : undefined);
    beforeAll(() => initializeAccessControl(database), 30_000);
    afterAll(() => database.$disconnect());

    async function accountManager(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture,
        grants: readonly Permission[] = [Permission.manage_global_users]) {
        const permissions = await tx.permission.findMany({ where: { name: { in: [...grants] } } });
        const role = await tx.globalRole.create({ data: {
            publicId: generatePublicId(),
            name: { create: { publicId: generatePublicId(), values: { create: { publicId: generatePublicId(), localeId: fixture.englishId, indexedValue: "Account manager" } } } },
            permissions: { create: permissions.map(permission => ({ publicId: generatePublicId(), permissionId: permission.id })) },
        } });
        const user = await tx.user.create({ data: { publicId: generatePublicId(), name: "Account manager", email: "manager@test.invalid", globalRoleId: role.id } });
        return { user, role, auth: await loadAuthorizationForUser(user, tx) };
    }

    const snapshot = (tx: Prisma.TransactionClient, auth: CMServerAuthorization) => bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });

    it("reads account capabilities with fresh platform authority, independently of band profile grants", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const manager = await accountManager(tx, fixture);
        const person = await tx.user.findUniqueOrThrow({ where: { id: fixture.user.id }, select: { publicId: true } });
        const target = parsePublicId<"User">(person.publicId);
        expect(manager.auth.hasPermission(Permission.view_users_basic_info)).toBe(false);
        const result = await readUserManagementCapabilities(await snapshot(tx, manager.auth), manager.auth, target, {});
        // Account management alone does not authorize merging either membership's grants.
        expect(result).toMatchObject({ canAssignRole: true, canMerge: false, mergedIntoUserId: null });
        expect(JSON.stringify(result)).not.toMatch(/"(?:id|email|phone)":/);
        const admin = await loadAuthorizationForUser(fixture.admin, tx);
        expect(await readUserManagementCapabilities(await snapshot(tx, admin), admin, target, {}))
            .toMatchObject({ canManageSignInMethods: true, canResetPassword: true, canMerge: true });
        const bandMember = await loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(fixture.bands[0]!.publicId));
        expect(await readUserManagementCapabilities(await snapshot(tx, bandMember), bandMember, target, {}))
            .toMatchObject({ canDeactivate: false, canReactivate: false, canImpersonate: false });
        await tx.globalRolePermission.deleteMany({ where: { globalRoleId: manager.role.id } });
        expect(await readUserManagementCapabilities(await snapshot(tx, manager.auth), manager.auth, target, {}))
            .toMatchObject({ canDeactivate: false, canReactivate: false, canImpersonate: false });
    }));

    it("returns dedicated impersonation capabilities without global account management and observes grant revocation", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const actor = await accountManager(tx, fixture, [Permission.impersonate_user]);
        const target = parsePublicId<"User">((await tx.user.findUniqueOrThrow({ where: { id: fixture.user.id } })).publicId);
        expect(actor.auth.hasPermission(Permission.manage_global_users)).toBe(false);
        expect(await readUserManagementCapabilities(await snapshot(tx, actor.auth), actor.auth, target, {}))
            .toMatchObject({ canImpersonate: true, canDeactivate: false, canResetPassword: false });
        expect(await readUserManagementCapabilities(await snapshot(tx, actor.auth), actor.auth, parsePublicId<"User">(actor.user.publicId), {}))
            .toMatchObject({ canImpersonate: false });
        await tx.globalRolePermission.deleteMany({ where: { globalRoleId: actor.role.id } });
        expect(await readUserManagementCapabilities(await snapshot(tx, actor.auth), actor.auth, target, {}))
            .toMatchObject({ canImpersonate: false });
    }));

    it("evaluates deleted targets without imposing recovery-read permissions", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const manager = await accountManager(tx, fixture);
        const person = await tx.user.update({ where: { id: fixture.user.id }, data: { isDeleted: true } });
        expect(manager.auth.hasPermission(Permission.recover_users)).toBe(false);
        expect(await readUserManagementCapabilities(await snapshot(tx, manager.auth), manager.auth, parsePublicId<"User">(person.publicId), {}))
            .toMatchObject({ canReactivate: true, canDeactivate: false, canImpersonate: false });
    }));

    it.each(["account", "merged"])("rejects %s revocation for account capabilities", reason => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const manager = await accountManager(tx, fixture);
        const context = await snapshot(tx, manager.auth);
        const person = await tx.user.findUniqueOrThrow({ where: { id: fixture.user.id }, select: { publicId: true } });
        await tx.user.update({ where: { id: manager.user.id }, data: reason === "account" ? { isDeleted: true } : { mergedIntoUserId: fixture.admin.id } });
        await expect(readUserManagementCapabilities(context, manager.auth, parsePublicId<"User">(person.publicId), {})).rejects.toThrow();
    }));

    it("reads sign-in summaries without a band and withholds them from ordinary account managers", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const person = await tx.user.findUniqueOrThrow({ where: { id: fixture.user.id } });
        await tx.userSignInMethod.create({ data: {
            publicId: generatePublicId(), userId: person.id, type: "google", identifier: generatePublicId(), displayId: "person@test.invalid",
        } });
        const input = { view: userIdentitySummaryView, filter: { publicIds: [parsePublicId<"User">(person.publicId)] }, cmdbQueryContext: "platform sign-in summary" };
        const admin = await loadAuthorizationForUser(fixture.admin, tx);
        expect(admin.band).toBeNull();
        expect((await queryView(input, admin, await snapshot(tx, admin))).items).toEqual([
            { publicId: person.publicId, signInMethods: [{ type: "google", displayId: "person@test.invalid" }] },
        ]);
        const manager = await accountManager(tx, fixture);
        expect((await queryView(input, manager.auth, await snapshot(tx, manager.auth))).items).toEqual([{ publicId: person.publicId }]);
        await tx.user.update({ where: { id: fixture.admin.id }, data: { isSysAdmin: false, globalRoleId: null } });
        await expect(queryView(input, admin, await snapshot(tx, admin))).rejects.toThrow();
    }));

    it("reads and searches shared contacts without band grants, with stable sorting and public identities", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const manager = await accountManager(tx, fixture);
        expect(manager.auth.band).toBeNull();
        expect(manager.auth.hasPermission(Permission.view_users_basic_info)).toBe(false);
        expect(manager.auth.hasPermission(Permission.view_user_contact_info)).toBe(false);
        await tx.user.update({ where: { id: fixture.user.id }, data: { name: "Platform Target Alpha", phone: "+32 123" } });
        const second = await tx.user.create({ data: { publicId: generatePublicId(), name: "Platform Target Beta", email: "beta@test.invalid" } });
        const table = { tableID: platformUserEditorView.tableID, tableName: platformUserEditorView.tableName, viewID: platformUserEditorView.viewID };
        const result = await DB3PaginatedQueryCore({ table, filter: { quickFilterValues: ["Platform Target"] },
            orderBy: { name: "asc" }, skip: 0, take: 1, cmdbQueryContext: "platform search" }, manager.auth, await snapshot(tx, manager.auth));
        expect(result.count).toBe(2);
        expect(result.items).toHaveLength(1);
        expect(result.items[0]).toMatchObject({ name: "Platform Target Alpha", email: "settings@test.invalid", phone: "+32 123", isDeleted: false, isSysAdmin: false });
        expect(result.items[0]).not.toHaveProperty("id");
        expect(result.items[0]).not.toHaveProperty("globalRoleId");
        expect(result.items[0]).not.toHaveProperty("hashedPassword");
        const next = await DB3PaginatedQueryCore({ table, filter: { quickFilterValues: ["Platform Target"] },
            orderBy: { name: "asc" }, skip: 1, take: 1, cmdbQueryContext: "platform next page" }, manager.auth, await snapshot(tx, manager.auth));
        expect(next.items.map(item => item.publicId)).toEqual([second.publicId]);
        await expect(queryView({ view: platformUserEditorView, filter: { pks: [fixture.user.id] }, cmdbQueryContext: "private identity" },
            manager.auth, await snapshot(tx, manager.auth))).rejects.toThrow();
    }));

    it("creates a shared person with database-owned security defaults and edits ordinary person fields", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const { auth } = await accountManager(tx, fixture);
        const created = await executeCatalogCrud(tx, auth, platformUserEditorView, { name: "New account", email: "new@test.invalid", phone: null, cssClass: null });
        const user = await tx.user.findUniqueOrThrow({ where: { publicId: String(created.identity) } });
        expect(user).toMatchObject({ name: "New account", isDeleted: false, isSysAdmin: false, globalRoleId: null });
        expect(await tx.userSignInMethod.count({ where: { userId: user.id } })).toBe(0);
        expect(await tx.bandUser.count({ where: { userId: user.id } })).toBe(0);
        await executeCatalogCrud(tx, auth, platformUserEditorView, { name: "Edited account", phone: "+32 123", cssClass: "account" }, created.identity);
        expect(await tx.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({ name: "Edited account", phone: "+32 123", cssClass: "account" });
        expect(await tx.change.count({ where: { table: "User", recordId: user.id } })).toBe(2);
        await expect(executeCatalogCrud(tx, auth, platformUserEditorView, { email: "changed@test.invalid" }, created.identity)).rejects.toThrow();
        const admin = await loadAuthorizationForUser(fixture.admin, tx);
        await executeCatalogCrud(tx, admin, platformUserEditorView, { email: "corrected@test.invalid" }, created.identity);
        expect(await tx.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({ email: "corrected@test.invalid" });
    }));

    it("rejects band managers, roleless members and account owners on reads and writes", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const target = await tx.user.findUniqueOrThrow({ where: { id: fixture.user.id } });
        for (const band of [null, ...fixture.bands]) {
            const auth = await loadAuthorizationForUser(fixture.user, tx, band ? parsePublicId<"Band">(band.publicId) : null);
            await expect(queryView({ view: platformUserEditorView, filter: {}, cmdbQueryContext: "band denied" }, auth, await snapshot(tx, auth))).rejects.toThrow();
            await expect(executeCatalogCrud(tx, auth, platformUserEditorView, { name: "Not allowed" }, parsePublicId<"User">(target.publicId))).rejects.toThrow();
            await expect(executeCatalogCrud(tx, auth, platformUserEditorView, { name: "Not allowed", email: "denied@test.invalid" })).rejects.toThrow();
        }
        expect(await tx.user.findUniqueOrThrow({ where: { id: target.id } })).toMatchObject({ name: target.name });
    }));

    it("rejects crafted security, credential, identity and membership fields without changing the account", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const auth = await loadAuthorizationForUser(fixture.admin, tx);
        const user = await tx.user.findUniqueOrThrow({ where: { id: fixture.user.id } });
        const identity = parsePublicId<"User">(user.publicId);
        const attempts = [
            { isDeleted: true }, { isSysAdmin: true }, { createdAt: new Date("2000-01-01") },
            { hashedPassword: "crafted" }, { globalRoleId: 1 }, { bandId: fixture.bands[0]!.id },
            { instruments: [] }, { tags: [] }, { signInMethods: [] }, { id: 42 }, { publicId: generatePublicId() },
        ];
        for (const patch of attempts) {
            await expect(executeCatalogCrud(tx, auth, platformUserEditorView, patch, identity)).rejects.toThrow();
            await expect(executeCatalogCrud(tx, auth, platformUserEditorView, { name: "Crafted", email: "crafted@test.invalid", ...patch })).rejects.toThrow();
        }
        expect(await tx.user.findUniqueOrThrow({ where: { id: user.id } })).toEqual(user);
        expect(await tx.user.count({ where: { email: "crafted@test.invalid" } })).toBe(0);
    }));

    it("uses fresh platform grants for both snapshot reads and generated writes", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const manager = await accountManager(tx, fixture);
        const context = await snapshot(tx, manager.auth);
        await tx.globalRolePermission.deleteMany({ where: { globalRoleId: manager.role.id } });
        await expect(queryView({ view: platformUserEditorView, filter: {}, cmdbQueryContext: "revoked platform read" }, manager.auth, context)).rejects.toThrow();
        await expect(executeCatalogCrud(tx, manager.auth, platformUserEditorView, { name: "Revoked" }, parsePublicId<"User">(manager.user.publicId))).rejects.toThrow();
    }));

    it("hides deleted accounts by default and permits explicit platform inspection", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const { auth } = await accountManager(tx, fixture);
        const deleted = await tx.user.create({ data: { publicId: generatePublicId(), name: "Deleted account", email: "deleted@test.invalid", isDeleted: true } });
        const input = { view: platformUserEditorView, filter: { publicIds: [parsePublicId<"User">(deleted.publicId)] }, cmdbQueryContext: "deleted platform account" };
        expect((await queryView(input, auth, await snapshot(tx, auth))).items).toEqual([]);
        expect((await queryView({ ...input, includeDeleted: true }, auth, await snapshot(tx, auth))).items).toMatchObject([{ publicId: deleted.publicId, isDeleted: true }]);
    }));
});
