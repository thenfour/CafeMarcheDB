import { PrismaClient, type Prisma } from "@prisma/client";
import type { AuthenticatedCtx } from "blitz";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import * as authorization from "src/auth/server/serverAuthorization";
import { initializeAccessControl } from "src/setup/accessControl";
import { generatePublicId } from "src/server/publicId";
import { xBandUser } from "src/core/db3/shared/entities/user/bandUser";
import { bandUserRoleCommand, bandUserRolesView, type BandUserRoleEdit } from "src/core/db3/shared/entities/user/bandUserRoles";
import { bandRoleChoicesView, bandRoleListView, xBandRole } from "src/core/db3/shared/entities/user/bandRoleViews";
import { executeDB3Command, createCommandRowServices } from "src/core/db3/server/db3CommandCore";
import { getDB3CommandHandler } from "src/core/db3/server/db3CommandRegistry";
import { assignBandUserRole } from "src/core/db3/server/commands/bandUserRoleCommand";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { DB3PaginatedQueryCore, queryView } from "src/core/db3/server/db3QueryCore";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

async function createRole(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture, name: string, grants: readonly string[] = []) {
    const permissionRows = await tx.permission.findMany({ where: { name: { in: [...grants] } } });
    return tx.bandRole.create({ data: {
        publicId: generatePublicId(),
        name: { create: { publicId: generatePublicId(), values: { create: { publicId: generatePublicId(), localeId: fixture.englishId, indexedValue: name } } } },
        bandRolePermissions: { create: permissionRows.map(permission => ({ publicId: generatePublicId(), permissionId: permission.id })) },
    } });
}

async function prepare(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture, grants: readonly Permission[] = []) {
    const role = await createRole(tx, fixture, "Role manager", [Permission.assign_user_roles, Permission.view_users_basic_info, ...grants]);
    const member = await tx.bandUser.update({ where: { bandId_userId: { bandId: fixture.bands[0]!.id, userId: fixture.user.id } }, data: { bandRoleId: role.id } });
    const auth = await authorization.loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(fixture.bands[0]!.publicId));
    const edit = async (rolePublicId: string | null, acknowledged = false, membershipPublicId = member.publicId) => assignBandUserRole(tx, await auth.refresh(tx), {
        membershipId: xBandUser.parseIdentity(membershipPublicId), roleId: rolePublicId === null ? null : xBandRole.parseIdentity(rolePublicId), acknowledgeContinuityRisk: acknowledged,
    });
    const read = async () => queryView({ view: bandUserRolesView, filter: {}, cmdbQueryContext: "membership roles fixture" }, auth,
        await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" }));
    return { role, member, auth, edit, read };
}

describe.skipIf(!settingsMysqlTestUrl)("membership role assignments on MariaDB", () => {
    const database = settingsMysqlTestUrl ? new PrismaClient({ datasources: { db: { url: settingsMysqlTestUrl } } }) : null;
    beforeAll(() => initializeAccessControl(database!), 30_000);
    afterAll(() => database?.$disconnect());
    afterEach(() => { vi.restoreAllMocks(); });
    const withFixture = (work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) => withSettingsMysqlFixture(database!, work);

    it("changes only the selected membership and audits once without altering the shared account", () => withFixture(async (tx, fixture) => {
        const context = await prepare(tx, fixture);
        const desired = await createRole(tx, fixture, "Another manager", [Permission.assign_user_roles, Permission.view_users_basic_info]);
        const beforePerson = await tx.user.findUniqueOrThrow({ where: { id: fixture.user.id } });
        const beforeOther = await tx.bandUser.findUniqueOrThrow({ where: { bandId_userId: { bandId: fixture.bands[1]!.id, userId: fixture.user.id } } });
        expect(await context.edit(desired.publicId)).toMatchObject({ status: "saved", roleId: desired.publicId });
        const changed = await tx.bandUser.findUniqueOrThrow({ where: { id: context.member.id } });
        expect(changed).toMatchObject({ bandRoleId: desired.id, updatedByUserId: fixture.user.id });
        expect(await tx.user.findUniqueOrThrow({ where: { id: fixture.user.id } })).toEqual(beforePerson);
        expect(await tx.bandUser.findUniqueOrThrow({ where: { id: beforeOther.id } })).toEqual(beforeOther);
        const audits = await tx.change.findMany({ where: { table: "bandUser", recordId: context.member.id } });
        expect(audits).toHaveLength(1);
        expect(JSON.parse(audits[0]!.newValues!)).toMatchObject({ bandRoleId: desired.id });
        const count = await tx.change.count();
        await context.edit(desired.publicId);
        expect(await tx.change.count()).toBe(count);
        expect((await context.read()).items).toMatchObject([{ bandRoleId: desired.publicId }]);
        expect(JSON.stringify((await context.read()).items)).not.toMatch(/"(?:id|bandId|bandRolePermissions|globalRoleId)":/);
    }));

    it("confirms loss of the last ordinary band role manager before writing", () => withFixture(async (tx, fixture) => {
        const context = await prepare(tx, fixture);
        const role = await createRole(tx, fixture, "Member");
        const count = await tx.change.count();
        expect(await context.edit(role.publicId)).toMatchObject({ status: "confirmationRequired", permissions: [Permission.assign_user_roles] });
        expect(await tx.bandUser.findUniqueOrThrow({ where: { id: context.member.id } })).toMatchObject({ bandRoleId: context.role.id });
        expect(await tx.change.count()).toBe(count);
        expect(await context.edit(role.publicId, true)).toMatchObject({ status: "saved" });
        expect((await context.auth.refresh(tx)).hasPermission(Permission.assign_user_roles)).toBe(false);
    }));

    it("counts only active same-band ordinary members for continuity", () => withFixture(async (tx, fixture) => {
        const context = await prepare(tx, fixture);
        const desired = await createRole(tx, fixture, "Member");
        const other = await tx.user.create({ data: { publicId: generatePublicId(), name: "Backup", email: "role-backup@test.invalid" } });
        const backup = await tx.bandUser.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[1]!.id, userId: other.id, bandRoleId: context.role.id } });
        expect(await context.edit(desired.publicId)).toMatchObject({ status: "confirmationRequired" });
        await tx.bandUser.update({ where: { id: backup.id }, data: { bandId: context.member.bandId } });
        for (const personState of [{ isDeleted: true }, { isDeleted: false, mergedIntoUserId: fixture.user.id }, { mergedIntoUserId: null, isSysAdmin: true }]) {
            await tx.user.update({ where: { id: other.id }, data: personState });
            expect(await context.edit(desired.publicId)).toMatchObject({ status: "confirmationRequired" });
        }
        await tx.user.update({ where: { id: other.id }, data: { isSysAdmin: false } });
        await tx.bandUser.update({ where: { id: backup.id }, data: { isDeleted: true } });
        expect(await context.edit(desired.publicId)).toMatchObject({ status: "confirmationRequired" });
        await tx.bandUser.update({ where: { id: backup.id }, data: { isDeleted: false } });
        expect(await context.edit(desired.publicId)).toMatchObject({ status: "saved" });
    }));

    it("does not count a Sysadmin's membership as an ordinary continuity holder", () => withFixture(async (tx, fixture) => {
        const context = await prepare(tx, fixture);
        const desired = await createRole(tx, fixture, "Member");
        await tx.user.update({ where: { id: fixture.user.id }, data: { isSysAdmin: true } });
        expect(await context.edit(desired.publicId)).toMatchObject({ status: "saved" });
    }));

    it("uses new-member defaults when clearing a role and rejects escalation through null", () => withFixture(async (tx, fixture) => {
        const context = await prepare(tx, fixture);
        const pending = await tx.bandRole.findFirstOrThrow({ where: { isRoleForNewUsers: true, isDeleted: false } });
        await tx.bandRolePermission.deleteMany({ where: { bandRoleId: pending.id } });
        const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.impersonate_user } });
        await tx.bandRolePermission.create({ data: { publicId: generatePublicId(), bandRoleId: pending.id, permissionId: permission.id } });
        await expect(context.edit(null, true)).rejects.toThrow("delegation authority");
        await tx.bandRolePermission.deleteMany({ where: { bandRoleId: pending.id } });
        expect(await context.edit(null)).toMatchObject({ status: "confirmationRequired" });
        expect(await context.edit(null, true)).toMatchObject({ status: "saved", roleId: null });
        expect(await tx.bandUser.findUniqueOrThrow({ where: { id: context.member.id } })).toMatchObject({ bandRoleId: null });
    }));

    it("checks target and desired grants, excludes deleted grants, and supports platform administration", () => withFixture(async (tx, fixture) => {
        const context = await prepare(tx, fixture);
        const elevated = await createRole(tx, fixture, "Elevated", [Permission.admin_events]);
        await expect(context.edit(elevated.publicId, true)).rejects.toThrow("delegation authority");
        await tx.bandUser.update({ where: { id: context.member.id }, data: { bandRoleId: elevated.id } });
        await expect(assignBandUserRole(tx, context.auth, { membershipId: xBandUser.parseIdentity(context.member.publicId), roleId: xBandRole.parseIdentity(context.role.publicId), acknowledgeContinuityRisk: true })).rejects.toThrow("delegation authority");
        const admin = await authorization.loadAuthorizationForUser(fixture.admin, tx, parsePublicId<"Band">(fixture.bands[0]!.publicId));
        await assignBandUserRole(tx, admin, { membershipId: xBandUser.parseIdentity(context.member.publicId), roleId: xBandRole.parseIdentity(context.role.publicId), acknowledgeContinuityRisk: true });
        const malformed = await createRole(tx, fixture, "Platform grant", [Permission.manage_global_users]);
        await expect(context.edit(malformed.publicId, true)).rejects.toThrow("delegation authority");
        const permission = await tx.permission.create({ data: { publicId: generatePublicId(), name: "unknown_role_capability" } });
        await tx.bandRolePermission.create({ data: { publicId: generatePublicId(), bandRoleId: malformed.id, permissionId: permission.id } });
        await tx.bandRolePermission.deleteMany({ where: { bandRoleId: malformed.id, permission: { name: Permission.manage_global_users } } });
        await expect(context.edit(malformed.publicId, true)).rejects.toThrow("delegation authority");
        await tx.permission.update({ where: { id: permission.id }, data: { isDeleted: true } });
        expect(await context.edit(malformed.publicId, true)).toMatchObject({ status: "saved" });
    }));

    it("rejects foreign/inactive memberships, merged people and missing/deleted roles", () => withFixture(async (tx, fixture) => {
        const context = await prepare(tx, fixture);
        const desired = await createRole(tx, fixture, "Member");
        const other = await tx.bandUser.findUniqueOrThrow({ where: { bandId_userId: { bandId: fixture.bands[1]!.id, userId: fixture.user.id } } });
        await expect(context.edit(desired.publicId, true, other.publicId)).rejects.toThrow("cannot be edited");
        await expect(context.edit(generatePublicId(), true)).rejects.toThrow();
        await tx.bandRole.update({ where: { id: desired.id }, data: { isDeleted: true } });
        await expect(context.edit(desired.publicId, true)).rejects.toThrow();
        await tx.bandRole.update({ where: { id: desired.id }, data: { isDeleted: false } });
        await tx.bandUser.update({ where: { id: context.member.id }, data: { isDeleted: true } });
        await expect(assignBandUserRole(tx, context.auth, { membershipId: xBandUser.parseIdentity(context.member.publicId), roleId: null, acknowledgeContinuityRisk: true })).rejects.toThrow("cannot be edited");
        await tx.bandUser.update({ where: { id: context.member.id }, data: { isDeleted: false } });
        for (const state of [{ isDeleted: true }, { isDeleted: false, mergedIntoUserId: fixture.admin.id }]) {
            await tx.user.update({ where: { id: fixture.user.id }, data: state });
            await expect(assignBandUserRole(tx, context.auth, { membershipId: xBandUser.parseIdentity(context.member.publicId), roleId: null, acknowledgeContinuityRisk: true })).rejects.toThrow("cannot be edited");
        }
    }));

    it("refreshes stale command grants in the write transaction and requires an explicit band", () => withFixture(async (tx, fixture) => {
        const context = await prepare(tx, fixture);
        const desired = await createRole(tx, fixture, "Member");
        const payload: BandUserRoleEdit = { membershipId: xBandUser.parseIdentity(context.member.publicId), roleId: xBandRole.parseIdentity(desired.publicId), acknowledgeContinuityRisk: true };
        const platform = await authorization.loadAuthorizationForUser(fixture.admin, tx);
        await expect(assignBandUserRole(tx, platform, payload)).rejects.toThrow();
        await tx.bandRolePermission.deleteMany({ where: { bandRoleId: context.role.id, permission: { name: Permission.assign_user_roles } } });
        vi.spyOn(authorization, "loadAuthorization").mockResolvedValue(context.auth);
        // This endpoint test forwards only session to the mocked outer loader; refresh uses the real transaction.
        const ctx = { session: {} } as AuthenticatedCtx;
        await expect(executeDB3Command({ commandID: bandUserRoleCommand.commandID, payload }, getDB3CommandHandler(bandUserRoleCommand.commandID), ctx, tx,
            parsePublicId<"Band">(fixture.bands[0]!.publicId))).rejects.toThrow(Permission.assign_user_roles);
        expect(await tx.bandUser.findUniqueOrThrow({ where: { id: context.member.id } })).toMatchObject({ bandRoleId: context.role.id });
    }));

    it("does not treat member management, self ownership, or another band's grants as role authority", () => withFixture(async (tx, fixture) => {
        const context = await prepare(tx, fixture);
        const desired = await createRole(tx, fixture, "Member");
        const payload: BandUserRoleEdit = { membershipId: xBandUser.parseIdentity(context.member.publicId), roleId: xBandRole.parseIdentity(desired.publicId), acknowledgeContinuityRisk: true };
        const otherBand = await authorization.loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(fixture.bands[1]!.publicId));
        await expect(assignBandUserRole(tx, otherBand, payload)).rejects.toThrow(Permission.assign_user_roles);
        const manager = await createRole(tx, fixture, "Membership manager", [Permission.manage_users, Permission.view_users_basic_info]);
        await tx.bandUser.update({ where: { id: context.member.id }, data: { bandRoleId: manager.id } });
        await expect(context.edit(desired.publicId, true)).rejects.toThrow(Permission.assign_user_roles);
        await tx.bandUser.update({ where: { id: context.member.id }, data: { bandRoleId: null } });
        const owner = await context.auth.refresh(tx);
        const result = await queryView({ view: bandUserRolesView, filter: {}, cmdbQueryContext: "roleless owner" }, owner,
            await bindDB3ReadSnapshot(tx, owner, { isolationLevel: "Serializable" }));
        expect(result.items).toMatchObject([{ publicId: context.member.publicId, bandRoleId: null }]);
        await expect(assignBandUserRole(tx, owner, payload)).rejects.toThrow(Permission.assign_user_roles);
        await expect(queryView({ view: bandRoleChoicesView, filter: {}, cmdbQueryContext: "denied role choices" }, owner,
            await bindDB3ReadSnapshot(tx, owner, { isolationLevel: "Serializable" }))).rejects.toThrow(Permission.assign_user_roles);
    }));

    it("reads localized shared role labels with the ordinary DB3 query policy and filters choices by delegation", () => withFixture(async (tx, fixture) => {
        const context = await prepare(tx, fixture);
        const role = await createRole(tx, fixture, "Managers", [Permission.assign_user_roles]);
        const protectedRole = await createRole(tx, fixture, "Outside envelope", [Permission.impersonate_user]);
        await tx.dynamicLocalizedStringValue.create({ data: { publicId: generatePublicId(), stringId: role.nameId, localeId: fixture.dutchId, indexedValue: "Beheerders" } });
        await tx.bandDynamicLocalizedStringValue.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[0]!.id, stringId: role.nameId, localeId: fixture.frenchId, indexedValue: "Gestionnaires" } });
        const snapshot = () => bindDB3ReadSnapshot(tx, context.auth, { isolationLevel: "Serializable" });
        const result = await queryView({ view: bandRoleListView, filter: { publicIds: [xBandRole.parseIdentity(role.publicId)], quickFilterValues: ["Gestion"] },
            browserLanguages: ["nl-BE"], cmdbQueryContext: "localized role list" }, context.auth, await snapshot());
        expect(result.items).toMatchObject([{ publicId: role.publicId, name: "Gestionnaires", nameResolution: { scope: "band", localeTag: "fr-BE" } }]);
        const otherBand = await authorization.loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(fixture.bands[1]!.publicId));
        const otherLabels = await queryView({ view: bandRoleListView, filter: { publicIds: [xBandRole.parseIdentity(role.publicId)] },
            browserLanguages: ["nl-BE"], cmdbQueryContext: "other band role labels" }, otherBand,
            await bindDB3ReadSnapshot(tx, otherBand, { isolationLevel: "Serializable" }));
        expect(otherLabels.items).toMatchObject([{ name: "Beheerders", nameResolution: { scope: "global", localeTag: "nl-BE" } }]);
        const page = await DB3PaginatedQueryCore({ table: { tableID: bandRoleListView.tableID, tableName: bandRoleListView.tableName, viewID: bandRoleListView.viewID },
            filter: { publicIds: [role.publicId], quickFilterValues: ["Beheerders"] }, browserLanguages: ["nl-BE"], orderBy: { name: "asc" }, skip: 0, take: 1,
            cmdbQueryContext: "effective role search" }, context.auth, await snapshot());
        expect(page.count).toBe(0);
        const choices = await queryView({ view: bandRoleChoicesView, filter: {}, cmdbQueryContext: "assignable role list" }, context.auth, await snapshot());
        expect(choices.items.map(item => item.publicId)).toContain(role.publicId);
        expect(choices.items.map(item => item.publicId)).not.toContain(protectedRole.publicId);
        expect(JSON.stringify(choices.items)).not.toMatch(/"(?:id|nameId|permission|bandRolePermissions)":/);
        await expect(createCommandRowServices(context.auth, tx).update(xBandRole, xBandRole.parseIdentity(role.publicId), { name: "Forbidden" })).rejects.toThrow();
        await expect(createCommandRowServices(context.auth, tx).update(xBandUser, xBandUser.parseIdentity(context.member.publicId), { bandRoleId: role.publicId })).rejects.toThrow();
    }));

    it("rolls back membership and audit changes together", async () => {
        const before = await database!.change.count();
        await withFixture(async (tx, fixture) => {
            const context = await prepare(tx, fixture);
            const desired = await createRole(tx, fixture, "Another manager", [Permission.assign_user_roles]);
            await context.edit(desired.publicId);
            expect(await tx.change.count()).toBe(before + 1);
        });
        expect(await database!.change.count()).toBe(before);
    });
});
