import { PrismaClient, type Prisma } from "@prisma/client";
import type { AuthenticatedCtx } from "blitz";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import * as authorization from "src/auth/server/serverAuthorization";
import { initializeAccessControl } from "src/setup/accessControl";
import { generatePublicId } from "src/server/publicId";
import { xBandUser } from "src/core/db3/shared/entities/user/bandUser";
import { bandMemberRecoveryQuery, bandUserLifecycleCommand, type BandUserLifecycleEdit } from "src/core/db3/shared/entities/user/bandUserLifecycle";
import { bandUserIdentityView } from "src/core/db3/shared/entities/user/bandUserProfile";
import { createCommandRowServices, executeDB3Command } from "src/core/db3/server/db3CommandCore";
import { getDB3CommandHandler } from "src/core/db3/server/db3CommandRegistry";
import { setBandUserActive } from "src/core/db3/server/commands/bandUserLifecycleCommand";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { DB3PaginatedQueryCore, queryView } from "src/core/db3/server/db3QueryCore";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";
import { loadDefaultAccountRole } from "src/auth/server/accountRoleDefaults";

async function createRole(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture, grants: readonly string[]) {
    const permissions = await tx.permission.findMany({ where: { name: { in: [...grants] } } });
    return tx.bandRole.create({ data: {
        publicId: generatePublicId(),
        name: { create: { publicId: generatePublicId(), values: { create: { publicId: generatePublicId(), localeId: fixture.englishId, indexedValue: "Lifecycle role" } } } },
        bandRolePermissions: { create: permissions.map(permission => ({ publicId: generatePublicId(), permissionId: permission.id })) },
    } });
}

async function prepare(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture, grants: readonly Permission[] = [Permission.deactivate_users, Permission.recover_users, Permission.assign_user_roles]) {
    const publicRole = await tx.bandRole.findFirstOrThrow({ where: { isPublicRole: true, isDeleted: false },
        include: { bandRolePermissions: { include: { permission: true } } } });
    // The actor's configured role explicitly includes the grants it may delegate to roleless members.
    const publicGrants = publicRole.bandRolePermissions.map(entry => entry.permission.name);
    const role = await createRole(tx, fixture, [Permission.view_users_basic_info, ...publicGrants, ...grants]);
    const member = await tx.bandUser.update({ where: { bandId_userId: { bandId: fixture.bands[0]!.id, userId: fixture.user.id } }, data: { bandRoleId: role.id } });
    const bandId = parsePublicId<"Band">(fixture.bands[0]!.publicId);
    const auth = await authorization.loadAuthorizationForUser(fixture.user, tx, bandId);
    const admin = await authorization.loadAuthorizationForUser(fixture.admin, tx, bandId);
    const edit = (membershipId: string, action: BandUserLifecycleEdit["action"], acknowledgeContinuityRisk = false) => setBandUserActive(tx, auth, {
        membershipId: xBandUser.parseIdentity(membershipId), action, acknowledgeContinuityRisk,
    });
    return { role, member, auth, admin, edit, bandId };
}

async function createTarget(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture, bandRoleId: number | null, isDeleted = false, name = "Target") {
    const accountRole = await loadDefaultAccountRole(tx);
    const user = await tx.user.create({ data: { publicId: generatePublicId(), name, email: `${generatePublicId()}@lifecycle.test.invalid`, globalRoleId: accountRole.id } });
    const member = await tx.bandUser.create({ data: { publicId: generatePublicId(), userId: user.id, bandId: fixture.bands[0]!.id, bandRoleId, isDeleted } });
    return { user, member };
}

describe.skipIf(!settingsMysqlTestUrl)("membership lifecycle on MariaDB", () => {
    const database = settingsMysqlTestUrl ? new PrismaClient({ datasourceUrl: settingsMysqlTestUrl }) : null;
    beforeAll(() => initializeAccessControl(database!), 30_000);
    afterAll(() => database?.$disconnect());
    afterEach(() => { vi.restoreAllMocks(); });
    const withFixture = (work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) => withSettingsMysqlFixture(database!, work);

    it("changes only membership status, retaining roles, assignments, preferences, sessions and the other band", () => withFixture(async (tx, fixture) => {
        const context = await prepare(tx, fixture);
        const target = await createTarget(tx, fixture, context.role.id);
        const other = await tx.bandUser.create({ data: { publicId: generatePublicId(), userId: target.user.id, bandId: fixture.bands[1]!.id } });
        const group = await tx.bandInstrumentFunctionalGroup.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[0]!.id } });
        const instrument = await tx.bandInstrument.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[0]!.id, functionalGroupId: group.id } });
        const tag = await tx.bandUserTag.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[0]!.id } });
        const assignment = await tx.bandUserInstrument.create({ data: { publicId: generatePublicId(), bandUserId: target.member.id, bandInstrumentId: instrument.id, isPrimary: true } });
        const tagAssignment = await tx.bandUserTagAssignment.create({ data: { publicId: generatePublicId(), bandUserId: target.member.id, bandUserTagId: tag.id } });
        const setting = await tx.bandUserSetting.create({ data: { bandUserId: target.member.id, name: "test.retained", value: false } });
        const signIn = await tx.userSignInMethod.create({ data: { publicId: generatePublicId(), userId: target.user.id, type: "email", identifier: target.user.email } });
        const session = await tx.session.create({ data: { userId: target.user.id, expiresAt: new Date("2030-01-01"), handle: generatePublicId(), hashedSessionToken: generatePublicId(), antiCSRFToken: generatePublicId() } });
        expect(await context.edit(target.member.publicId, "deactivate")).toMatchObject({ status: "saved", isDeleted: true });
        expect(await tx.bandUser.findUniqueOrThrow({ where: { id: target.member.id } })).toMatchObject({ bandRoleId: context.role.id, isDeleted: true, updatedByUserId: fixture.user.id });
        expect(await tx.user.findUniqueOrThrow({ where: { id: target.user.id } })).toEqual(target.user);
        expect(await tx.bandUser.findUniqueOrThrow({ where: { id: other.id } })).toEqual(other);
        expect(await tx.bandUserInstrument.findUniqueOrThrow({ where: { id: assignment.id } })).toEqual(assignment);
        expect(await tx.bandUserTagAssignment.findUniqueOrThrow({ where: { id: tagAssignment.id } })).toEqual(tagAssignment);
        expect(await tx.bandUserSetting.findUniqueOrThrow({ where: { id: setting.id } })).toEqual(setting);
        expect(await tx.userSignInMethod.findUniqueOrThrow({ where: { id: signIn.id } })).toEqual(signIn);
        expect(await tx.session.findUniqueOrThrow({ where: { id: session.id } })).toEqual(session);
        const inactiveAuth = await authorization.loadAuthorizationForUser(target.user, tx, context.bandId);
        expect(inactiveAuth.membership).toBeNull();
        expect(inactiveAuth.hasPermission(Permission.deactivate_users)).toBe(false);
        expect(inactiveAuth.hasPermission(Permission.login)).toBe(true);
        await context.edit(target.member.publicId, "reactivate");
        expect((await inactiveAuth.refresh(tx)).hasPermission(Permission.deactivate_users)).toBe(true);
        const audits = await tx.change.findMany({ where: { table: "bandUser", recordId: target.member.id } });
        expect(audits).toHaveLength(2);
        expect(JSON.parse(audits[0]!.oldValues!)).toEqual({ isDeleted: false });
        expect(JSON.parse(audits[0]!.newValues!)).toEqual({ isDeleted: true });
        await context.edit(target.member.publicId, "reactivate");
        expect(await tx.change.count()).toBe(2);
    }));

    it("uses generic recovery search/count/paging without leaking other bands, active memberships or deleted/merged people", () => withFixture(async (tx, fixture) => {
        const context = await prepare(tx, fixture);
        const first = await createTarget(tx, fixture, null, true, "Alice one");
        await createTarget(tx, fixture, null, true, "Alice two");
        await createTarget(tx, fixture, null, false, "Alice active");
        const deleted = await createTarget(tx, fixture, null, true, "Alice deleted");
        const merged = await createTarget(tx, fixture, null, true, "Alice merged");
        const foreign = await createTarget(tx, fixture, null, true, "Alice foreign");
        await tx.user.update({ where: { id: deleted.user.id }, data: { isDeleted: true } });
        await tx.user.update({ where: { id: merged.user.id }, data: { mergedIntoUserId: fixture.user.id } });
        await tx.bandUser.update({ where: { id: foreign.member.id }, data: { bandId: fixture.bands[1]!.id } });
        const snapshot = await bindDB3ReadSnapshot(tx, context.auth, { isolationLevel: "Serializable" });
        const input = { ...bandMemberRecoveryQuery("alice", 0, { bandPublicId: context.bandId }), take: 1 };
        const page = await DB3PaginatedQueryCore(input, context.auth, snapshot);
        expect(page).toMatchObject({ count: 2, hasMore: true });
        expect(page.items).toMatchObject([{ publicId: first.member.publicId, isDeleted: true }]);
        expect(JSON.stringify(page.items)).not.toMatch(/"(?:id|bandId|globalRoleId|email|phone|hashedPassword)":/);
        const next = await DB3PaginatedQueryCore({ ...input, skip: 1 }, context.auth, snapshot);
        expect(next.items[0]!.publicId).not.toBe(first.member.publicId);
        expect(next).toMatchObject({ count: 2, hasMore: false });
        const active = await queryView({ view: bandUserIdentityView, filter: {}, includeDeleted: true, cmdbQueryContext: "active default" }, context.auth, snapshot);
        expect(active.items.some(row => row.publicId === first.member.publicId)).toBe(false);
        expect((await DB3PaginatedQueryCore({ ...input, includeDeleted: false }, context.auth, snapshot)).count).toBe(0);
        await expect(DB3PaginatedQueryCore({ ...input, filter: { tableParams: { membershipStatus: "forged" } } }, context.auth, snapshot)).rejects.toThrow();
    }));

    it.each([Permission.deactivate_users, Permission.recover_users, Permission.manage_users])("keeps deactivation, recovery and ordinary management authority separate: %s", grant => withFixture(async (tx, fixture) => {
        const context = await prepare(tx, fixture, [grant]);
        const active = await createTarget(tx, fixture, null);
        const inactive = await createTarget(tx, fixture, null, true);
        if (grant === Permission.deactivate_users) {
            expect(await context.edit(active.member.publicId, "deactivate")).toMatchObject({ status: "saved" });
        } else {
            await expect(context.edit(active.member.publicId, "deactivate")).rejects.toThrow(Permission.deactivate_users);
        }
        if (grant === Permission.recover_users) {
            expect(await context.edit(inactive.member.publicId, "reactivate")).toMatchObject({ status: "saved" });
        } else {
            await expect(context.edit(inactive.member.publicId, "reactivate")).rejects.toThrow(Permission.recover_users);
            const snapshot = await bindDB3ReadSnapshot(tx, context.auth, { isolationLevel: "Serializable" });
            await expect(DB3PaginatedQueryCore(bandMemberRecoveryQuery("", 0, { bandPublicId: context.bandId }), context.auth, snapshot)).rejects.toThrow();
        }
    }));

    it("requires explicit band ownership and active, unmerged shared accounts for both actions", () => withFixture(async (tx, fixture) => {
        const context = await prepare(tx, fixture);
        const target = await createTarget(tx, fixture, null);
        const foreign = await tx.bandUser.findUniqueOrThrow({ where: { bandId_userId: { bandId: fixture.bands[1]!.id, userId: fixture.user.id } } });
        for (const action of ["deactivate", "reactivate"] satisfies BandUserLifecycleEdit["action"][]) {
            await expect(context.edit(foreign.publicId, action)).rejects.toThrow("cannot change status");
            await expect(context.edit(generatePublicId(), action)).rejects.toThrow("cannot change status");
            for (const state of [{ isDeleted: true }, { isDeleted: false, mergedIntoUserId: fixture.user.id }]) {
                await tx.user.update({ where: { id: target.user.id }, data: state });
                await expect(context.edit(target.member.publicId, action)).rejects.toThrow("cannot change status");
            }
        }
        const platform = await authorization.loadAuthorizationForUser(fixture.admin, tx);
        await expect(setBandUserActive(tx, platform, { membershipId: xBandUser.parseIdentity(context.member.publicId), action: "deactivate", acknowledgeContinuityRisk: true })).rejects.toThrow();
    }));

    it("requires delegation over the selected stored or Public role before deactivation or recovery", () => withFixture(async (tx, fixture) => {
        const context = await prepare(tx, fixture);
        const elevatedRole = await createRole(tx, fixture, [Permission.admin_events]);
        const target = await createTarget(tx, fixture, elevatedRole.id);
        await expect(context.edit(target.member.publicId, "deactivate", true)).rejects.toThrow("delegation authority");
        await tx.bandUser.update({ where: { id: target.member.id }, data: { isDeleted: true } });
        await expect(context.edit(target.member.publicId, "reactivate")).rejects.toThrow("delegation authority");
        const pending = await tx.bandRole.findFirstOrThrow({ where: { isPublicRole: true, isDeleted: false } });
        await tx.bandRolePermission.deleteMany({ where: { bandRoleId: pending.id } });
        const privilege = await tx.permission.findUniqueOrThrow({ where: { name: Permission.admin_events } });
        await tx.bandRolePermission.create({ data: { publicId: generatePublicId(), bandRoleId: pending.id, permissionId: privilege.id } });
        await tx.bandUser.update({ where: { id: target.member.id }, data: { bandRoleId: null } });
        await expect(context.edit(target.member.publicId, "reactivate")).rejects.toThrow("delegation authority");
        expect(await setBandUserActive(tx, context.admin, { membershipId: xBandUser.parseIdentity(target.member.publicId), action: "reactivate", acknowledgeContinuityRisk: false })).toMatchObject({ status: "saved" });
    }));

    it("rejects unknown/platform stored grants while ignoring deleted grants", () => withFixture(async (tx, fixture) => {
        const context = await prepare(tx, fixture);
        const role = await createRole(tx, fixture, [Permission.manage_global_users]);
        const target = await createTarget(tx, fixture, role.id, true);
        await expect(context.edit(target.member.publicId, "reactivate")).rejects.toThrow("delegation authority");
        await tx.bandRolePermission.deleteMany({ where: { bandRoleId: role.id } });
        const unknown = await tx.permission.create({ data: { publicId: generatePublicId(), name: "unknown_lifecycle_grant" } });
        await tx.bandRolePermission.create({ data: { publicId: generatePublicId(), bandRoleId: role.id, permissionId: unknown.id } });
        await expect(context.edit(target.member.publicId, "reactivate")).rejects.toThrow("delegation authority");
        await tx.permission.update({ where: { id: unknown.id }, data: { isDeleted: true } });
        expect(await context.edit(target.member.publicId, "reactivate")).toMatchObject({ status: "saved" });
    }));

    it("confirms loss of the last ordinary administrator and immediately removes that band's grants only", () => withFixture(async (tx, fixture) => {
        const context = await prepare(tx, fixture);
        const other = await tx.bandUser.update({ where: { bandId_userId: { bandId: fixture.bands[1]!.id, userId: fixture.user.id } }, data: { bandRoleId: context.role.id } });
        const result = await context.edit(context.member.publicId, "deactivate");
        expect(result).toMatchObject({ status: "confirmationRequired", permissions: [Permission.deactivate_users, Permission.assign_user_roles] });
        expect(await tx.change.count()).toBe(0);
        expect(await tx.bandUser.findUniqueOrThrow({ where: { id: context.member.id } })).toMatchObject({ isDeleted: false });
        expect(await context.edit(context.member.publicId, "deactivate", true)).toMatchObject({ status: "saved" });
        const fresh = await context.auth.refresh(tx);
        expect(fresh.membership).toBeNull();
        expect(fresh.hasPermission(Permission.recover_users)).toBe(false);
        const secondBand = await authorization.loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(fixture.bands[1]!.publicId));
        expect(secondBand.membership?.id).toBe(other.id);
        expect(secondBand.hasPermission(Permission.recover_users)).toBe(true);
        await expect(setBandUserActive(tx, fresh, { membershipId: xBandUser.parseIdentity(context.member.publicId), action: "reactivate", acknowledgeContinuityRisk: false })).rejects.toThrow(Permission.recover_users);
    }));

    it("counts only active same-band ordinary members for continuity", () => withFixture(async (tx, fixture) => {
        const context = await prepare(tx, fixture);
        const backup = await createTarget(tx, fixture, context.role.id);
        await tx.bandUser.update({ where: { id: backup.member.id }, data: { bandId: fixture.bands[1]!.id } });
        expect(await context.edit(context.member.publicId, "deactivate")).toMatchObject({ status: "confirmationRequired" });
        await tx.bandUser.update({ where: { id: backup.member.id }, data: { bandId: fixture.bands[0]!.id, isDeleted: true } });
        expect(await context.edit(context.member.publicId, "deactivate")).toMatchObject({ status: "confirmationRequired" });
        await tx.bandUser.update({ where: { id: backup.member.id }, data: { isDeleted: false } });
        for (const state of [{ isDeleted: true }, { isDeleted: false, mergedIntoUserId: fixture.user.id }]) {
            await tx.user.update({ where: { id: backup.user.id }, data: state });
            expect(await context.edit(context.member.publicId, "deactivate")).toMatchObject({ status: "confirmationRequired" });
        }
        const sysadminRole = await tx.globalRole.findFirstOrThrow({ where: { isSysAdminRole: true } });
        await tx.user.update({ where: { id: backup.user.id }, data: { mergedIntoUserId: null, globalRoleId: sysadminRole.id } });
        expect(await context.edit(context.member.publicId, "deactivate")).toMatchObject({ status: "confirmationRequired" });
        await tx.user.update({ where: { id: backup.user.id }, data: { globalRoleId: null } });
        expect(await context.edit(context.member.publicId, "deactivate")).toMatchObject({ status: "saved" });
    }));

    it("does not treat a platform Sysadmin's own membership as an ordinary continuity holder", () => withFixture(async (tx, fixture) => {
        const context = await prepare(tx, fixture);
        const sysadminRole = await tx.globalRole.findFirstOrThrow({ where: { isSysAdminRole: true } });
        await tx.user.update({ where: { id: fixture.user.id }, data: { globalRoleId: sysadminRole.id } });
        expect(await context.edit(context.member.publicId, "deactivate")).toMatchObject({ status: "saved" });
    }));

    it("does not report losing capabilities that remain available through the public role", () => withFixture(async (tx, fixture) => {
        const context = await prepare(tx, fixture, [Permission.deactivate_users]);
        const role = await tx.bandRole.findFirstOrThrow({ where: { isPublicRole: true, isDeleted: false } });
        const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.deactivate_users } });
        await tx.bandRolePermission.create({ data: { publicId: generatePublicId(), bandRoleId: role.id, permissionId: permission.id } });
        expect(await context.edit(context.member.publicId, "deactivate")).toMatchObject({ status: "saved" });
        expect((await context.auth.refresh(tx)).hasPermission(Permission.deactivate_users)).toBe(true);
    }));

    it.each(["deactivate", "reactivate"] satisfies BandUserLifecycleEdit["action"][])("refreshes grants inside %s command execution and rejects generic lifecycle writes/deletes", action => withFixture(async (tx, fixture) => {
        const context = await prepare(tx, fixture);
        const target = await createTarget(tx, fixture, null, action === "reactivate");
        const services = createCommandRowServices(context.auth, tx);
        await expect(services.update(xBandUser, xBandUser.parseIdentity(target.member.publicId), { isDeleted: true })).rejects.toThrow();
        await expect(services.delete(xBandUser, xBandUser.parseIdentity(target.member.publicId))).rejects.toThrow();
        const permission = action === "deactivate" ? Permission.deactivate_users : Permission.recover_users;
        await tx.bandRolePermission.deleteMany({ where: { bandRoleId: context.role.id, permission: { name: permission } } });
        vi.spyOn(authorization, "loadAuthorization").mockResolvedValue(context.auth);
        // The outer loader is mocked; command refresh reads the actual transaction's grants.
        const ctx = { session: {} } as AuthenticatedCtx;
        await expect(executeDB3Command({ commandID: bandUserLifecycleCommand.commandID,
            payload: { membershipId: target.member.publicId, action, acknowledgeContinuityRisk: true } },
        getDB3CommandHandler(bandUserLifecycleCommand.commandID), ctx, tx, context.bandId)).rejects.toThrow(permission);
        expect(await tx.bandUser.findUniqueOrThrow({ where: { id: target.member.id } })).toMatchObject({ isDeleted: target.member.isDeleted });
        expect(await tx.change.count()).toBe(0);
    }));

    it("keeps membership state and audit changes in the caller's transaction", async () => {
        const auditsBefore = await database!.change.count();
        const membersBefore = await database!.bandUser.count();
        await withFixture(async (tx, fixture) => {
            const context = await prepare(tx, fixture);
            const target = await createTarget(tx, fixture, null);
            vi.spyOn(authorization, "loadAuthorization").mockResolvedValue(context.auth);
            // Only the outer session loader is mocked; execution refreshes and writes through the real transaction.
            const ctx = { session: {} } as AuthenticatedCtx;
            const result = await executeDB3Command({ commandID: bandUserLifecycleCommand.commandID,
                payload: { membershipId: target.member.publicId, action: "deactivate", acknowledgeContinuityRisk: false } },
            getDB3CommandHandler(bandUserLifecycleCommand.commandID), ctx, tx, context.bandId);
            expect(result).toMatchObject({ status: "saved", isDeleted: true });
            expect(await tx.bandUser.findUniqueOrThrow({ where: { id: target.member.id } })).toMatchObject({ isDeleted: true });
            expect(await tx.change.count()).toBe(auditsBefore + 1);
        });
        expect(await database!.change.count()).toBe(auditsBefore);
        expect(await database!.bandUser.count()).toBe(membersBefore);
    });
});
