import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { gPermissionRegistry, Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { writeAccountAdministratorRole, writeAccountRole } from "src/auth/server/accountRoleWrite";
import { writeRoleDesignation } from "src/auth/server/roleDesignationWrite";
import { loadAuthorizationForUser, type CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { readUserManagementCapabilities } from "src/auth/server/userManagementCapabilitiesRead";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { createCommandRowServices } from "src/core/db3/server/db3CommandCore";
import { getDB3CommandHandler } from "src/core/db3/server/db3CommandRegistry";
import { queryView } from "src/core/db3/server/db3QueryCore";
import { bandRoleEditorView, globalRoleEditorView, xGlobalRole } from "src/core/db3/shared/entities/user/roleViews";
import { xBandRole } from "src/core/db3/shared/entities/user/bandRoleViews";
import { permissionBandRoleChoicesView, permissionBandRoleMatrixView, permissionEditorView, permissionGlobalRoleChoicesView, permissionGlobalRoleMatrixView } from "src/core/db3/shared/entities/user/permissionViews";
import { setBandRolePermissionCommand, setGlobalRolePermissionCommand } from "src/core/db3/shared/entities/user/rolePermissionCommands";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl, synchronizePermissions } from "src/setup/accessControl";
import { executeCatalogCrud } from "./support/db3CatalogFixture";
import { userEditorView } from "src/core/db3/shared/entities/user/userViews";
import { platformUserEditorView } from "src/core/db3/shared/entities/user/platformUser";
import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import { loadPlatformSysadminWhere } from "src/auth/server/principalPredicates";
import { bandRoleChoicesView } from "src/core/db3/shared/entities/user/bandRoleViews";
import { assignBandUserRole } from "src/core/db3/server/commands/bandUserRoleCommand";
import { setBandUserActive } from "src/core/db3/server/commands/bandUserLifecycleCommand";
import { canDelegateBandRoleGrants } from "src/auth/shared/bandRolePolicy";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

async function createGlobalRole(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture, names: readonly Permission[] = []) {
    const grants = await tx.permission.findMany({ where: { name: { in: [...names] } } });
    return tx.globalRole.create({ data: { publicId: generatePublicId(), name: { create: { publicId: generatePublicId(),
        values: { create: { publicId: generatePublicId(), localeId: fixture.englishId, indexedValue: "Global role fixture" } } } },
        permissions: { create: grants.map(permission => ({ publicId: generatePublicId(), permissionId: permission.id })) },
    } });
}
const snapshot = (tx: Prisma.TransactionClient, auth: CMServerAuthorization) => bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });

describe.skipIf(!settingsMysqlTestUrl)("role administration on MariaDB", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasourceUrl: settingsMysqlTestUrl } : undefined);
    beforeAll(() => initializeAccessControl(database), 30_000);
    afterAll(() => database.$disconnect());
    const run = (work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) => withSettingsMysqlFixture(database, work);

    it("lets an explicit global band administrator choose, assign and recover ordinary roles across bands without membership", () => run(async (tx, fixture) => {
        const globalRole = await createGlobalRole(tx, fixture, [Permission.login, Permission.public, Permission.always_grant, Permission.global_band_admin]);
        const operator = await tx.user.create({ data: { publicId: generatePublicId(), name: "Band operator", email: "band-operator@test.invalid", globalRoleId: globalRole.id } });
        const permissions = await tx.permission.findMany({ where: { name: { in: [Permission.manage_events, Permission.assign_user_roles, Permission.deactivate_users, Permission.recover_users] } } });
        const role = await tx.bandRole.create({ data: { publicId: generatePublicId(), nameId: (await tx.bandRole.findFirstOrThrow()).nameId,
            bandRolePermissions: { create: permissions.map(permission => ({ publicId: generatePublicId(), permissionId: permission.id })) } } });
        const globalPermission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.manage_global_users } });
        const malformed = await tx.bandRole.create({ data: { publicId: generatePublicId(), nameId: role.nameId,
            bandRolePermissions: { create: { publicId: generatePublicId(), permissionId: globalPermission.id } } } });
        const unscoped = await loadAuthorizationForUser(operator, tx, null);
        expect(canDelegateBandRoleGrants(unscoped, [Permission.manage_events])).toBe(false);
        for (const band of fixture.bands) {
            const auth = await loadAuthorizationForUser(operator, tx, parsePublicId<"Band">(band.publicId));
            expect(auth.membership).toBeNull();
            expect(auth.hasPermission(Permission.sysadmin)).toBe(false);
            expect(auth.hasPermission(Permission.assign_user_roles)).toBe(false);
            expect(auth.hasPermission(Permission.manage_events)).toBe(false);
            const choices = await queryView({ view: bandRoleChoicesView, filter: {}, cmdbQueryContext: "global band role choices" }, auth, await snapshot(tx, auth));
            expect(choices.items.map(choice => choice.publicId)).toContain(role.publicId);
            expect(choices.items.map(choice => choice.publicId)).not.toContain(malformed.publicId);
            const member = await tx.bandUser.findUniqueOrThrow({ where: { bandId_userId: { bandId: band.id, userId: fixture.user.id } } });
            const membershipId = parsePublicId<"BandUser">(member.publicId);
            await expect(assignBandUserRole(tx, auth, { membershipId, roleId: xBandRole.parseIdentity(malformed.publicId), acknowledgeContinuityRisk: true }))
                .rejects.toThrow("delegation authority");
            expect(await assignBandUserRole(tx, auth, { membershipId, roleId: xBandRole.parseIdentity(role.publicId), acknowledgeContinuityRisk: true }))
                .toMatchObject({ status: "saved" });
            expect(await setBandUserActive(tx, auth, { membershipId, action: "deactivate", acknowledgeContinuityRisk: false }))
                .toMatchObject({ status: "confirmationRequired" });
            expect(await setBandUserActive(tx, auth, { membershipId, action: "deactivate", acknowledgeContinuityRisk: true }))
                .toMatchObject({ status: "saved" });
            expect(await setBandUserActive(tx, auth, { membershipId, action: "reactivate", acknowledgeContinuityRisk: false }))
                .toMatchObject({ status: "saved" });
        }
        expect(await tx.bandUser.count({ where: { userId: operator.id } })).toBe(0);
    }));

    it.each(["global", "band"] as const)("offers only active known %s permissions in role choices and the matrix", scope => run(async (tx, fixture) => {
        const auth = await loadAuthorizationForUser(fixture.admin, tx, null);
        const retired = scope === "global" ? Permission.manage_bands : Permission.manage_events;
        await tx.permission.update({ where: { name: retired }, data: { isDeleted: true } });
        const unknown = await tx.permission.create({ data: { publicId: generatePublicId(), name: "unknown_role_matrix_permission" } });
        const choices = scope === "global" ? permissionGlobalRoleChoicesView : permissionBandRoleChoicesView;
        const matrix = scope === "global" ? permissionGlobalRoleMatrixView : permissionBandRoleMatrixView;
        const expected = new Set(gPermissionRegistry.filter(definition => definition.scope === scope
            && definition.key !== Permission.never_grant && definition.key !== retired).map(definition => definition.key));
        for (const view of [choices, matrix]) {
            const result = await queryView({ view, filter: {}, cmdbQueryContext: "scope-specific role permissions" }, auth, await snapshot(tx, auth));
            expect(new Set(result.items.map(row => row.name))).toEqual(expected);
        }
        await expect(queryView({ view: permissionEditorView, filter: { publicIds: [parsePublicId<"Permission">(unknown.publicId)] },
            cmdbQueryContext: "unsynchronized permission row" }, auth, await snapshot(tx, auth))).rejects.toThrow("unrecognized option");
        await synchronizePermissions(tx, fixture.englishId);
        const editor = await queryView({ view: permissionEditorView, filter: { publicIds: [parsePublicId<"Permission">(unknown.publicId)] },
            cmdbQueryContext: "synchronized permission registry" }, auth, await snapshot(tx, auth));
        expect(editor.items).toEqual([]);
    }));

    it.each([userEditorView, platformUserEditorView])("assigns the configured account default during $viewID creation", view => run(async (tx, fixture) => {
        const auth = await loadAuthorizationForUser(fixture.admin, tx, null);
        const defaultRole = await tx.globalRole.findFirstOrThrow({ where: { isRoleForNewUsers: true, isDeleted: false } });
        // Generating Update must preserve the explicit Create lifecycle handler.
        getDB3CommandHandler(view.crud.operations.update.command.commandID);
        const created = await executeCatalogCrud(tx, auth, view, { name: "Created account", email: "created@test.invalid" });
        const person = await tx.user.findUniqueOrThrow({ where: { publicId: String(created.identity) } });
        expect(person.globalRoleId).toBe(defaultRole.id);
        await tx.globalRole.updateMany({ data: { isRoleForNewUsers: false } });
        await expect(executeCatalogCrud(tx, auth, view, { name: "Missing default", email: "missing-default@test.invalid" }))
            .rejects.toThrow("exactly one active role for new accounts");
        expect(await tx.user.count({ where: { email: "missing-default@test.invalid" } })).toBe(0);
        expect((await loadAuthorizationForUser(person, tx, null)).hasPermission(Permission.login)).toBe(true);
    }));

    it("edits global Permission metadata through its original CRUD owner while leaving grants unchanged", () => run(async (tx, fixture) => {
        const auth = await loadAuthorizationForUser(fixture.admin, tx, null);
        const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.manage_events } });
        const description = permission.descriptionId === null ? null : await tx.dynamicLocalizedString.findUniqueOrThrow({ where: { id: permission.descriptionId } });
        const before = await tx.bandRolePermission.findMany();
        await executeCatalogCrud(tx, auth, permissionEditorView, { description: { kind: "set", stringPublicId: description?.publicId ?? null,
            localeTag: "fr-BE", value: "Description de permission" }, color: "red" }, parsePublicId<"Permission">(permission.publicId));
        const read = await queryView({ view: permissionEditorView, filter: { publicIds: [parsePublicId<"Permission">(permission.publicId)] },
            routeLocale: "fr-BE", cmdbQueryContext: "permission editor" }, auth, await snapshot(tx, auth));
        expect(read.items[0]).toMatchObject({ color: "red", description: "Description de permission" });
        expect(await tx.bandRolePermission.findMany()).toEqual(before);
        expect(await tx.change.count({ where: { table: "Permission", recordId: permission.id } })).toBe(1);
        const manager = await loadAuthorizationForUser(fixture.user, tx, null);
        await expect(executeCatalogCrud(tx, manager, permissionEditorView, { color: "blue" }, parsePublicId<"Permission">(permission.publicId))).rejects.toThrow();
    }));

    it.each(["public", "newUsers"] as const)("repairs missing/duplicate %s band designations atomically and audits the definition changes", designation => run(async (tx, fixture) => {
        const auth = await loadAuthorizationForUser(fixture.admin, tx);
        const flag = designation === "public" ? "isPublicRole" : "isRoleForNewUsers";
        const globals = await tx.globalRole.findMany();
        const otherMembership = await tx.bandUser.findMany({ where: { userId: fixture.user.id } });
        await tx.bandRole.updateMany({ data: { [flag]: true } });
        const selected = await tx.bandRole.findFirstOrThrow({ where: { isDeleted: false } });
        const count = await tx.bandRole.count({ where: { id: { not: selected.id } } });
        const edit = { scope: "band", designation, roleId: xBandRole.parseIdentity(selected.publicId) } as const;
        await writeRoleDesignation(tx, auth, edit);
        expect(await tx.bandRole.findMany({ where: { [flag]: true } })).toMatchObject([{ id: selected.id }]);
        const audits = await tx.change.findMany({ where: { context: "setRoleDesignation" } });
        expect(audits).toHaveLength(count);
        expect(new Set(audits.map(audit => audit.operationId)).size).toBe(1);
        expect(audits.every(audit => audit.table === "BandRole" && audit.userId === fixture.admin.id)).toBe(true);
        const auditCount = await tx.change.count();
        await writeRoleDesignation(tx, auth, edit);
        expect(await tx.change.count()).toBe(auditCount);
        await tx.bandRole.updateMany({ data: { [flag]: false } });
        await writeRoleDesignation(tx, auth, edit);
        expect(await tx.bandRole.count({ where: { [flag]: true } })).toBe(1);
        expect(await tx.globalRole.findMany()).toEqual(globals);
        expect(await tx.bandUser.findMany({ where: { userId: fixture.user.id } })).toEqual(otherMembership);
    }));

    it.each(["public", "newUsers"] as const)("repairs missing/duplicate %s global designations without reassigning accounts", designation => run(async (tx, fixture) => {
        const auth = await loadAuthorizationForUser(fixture.admin, tx);
        const flag = designation === "public" ? "isPublicRole" : "isRoleForNewUsers";
        const selected = await createGlobalRole(tx, fixture, [Permission.public]);
        const people = await tx.user.findMany();
        await tx.globalRole.updateMany({ data: { [flag]: true } });
        const edit = { scope: "global", designation, roleId: xGlobalRole.parseIdentity(selected.publicId) } as const;
        await writeRoleDesignation(tx, auth, edit);
        expect(await tx.globalRole.findMany({ where: { [flag]: true } })).toMatchObject([{ id: selected.id }]);
        const auditCount = await tx.change.count();
        await writeRoleDesignation(tx, auth, edit);
        expect(await tx.change.count()).toBe(auditCount);
        await tx.globalRole.updateMany({ data: { [flag]: false } });
        await writeRoleDesignation(tx, auth, edit);
        expect(await tx.globalRole.count({ where: { [flag]: true } })).toBe(1);
        expect(await tx.user.findMany()).toEqual(people);
    }));

    it("keeps unselected band configuration out of global authorization and supports designation repairs", () => run(async (tx, fixture) => {
        await tx.bandRole.updateMany({ data: { isPublicRole: true } });
        const admin = await loadAuthorizationForUser(fixture.admin, tx, null);
        expect(admin.hasPermission(Permission.sysadmin)).toBe(true);
        expect(admin.bandPermissions.names).toEqual([]);
        const anonymous = await loadAuthorizationForUser(null, tx, null);
        expect(anonymous.bandPermissions.names).toEqual([]);
        expect(anonymous.hasPermission(Permission.public)).toBe(true);
        await expect(loadAuthorizationForUser(fixture.admin, tx, parsePublicId<"Band">(fixture.bands[0]!.publicId)))
            .rejects.toThrow("exactly one active Band Public");
        const selected = await tx.bandRole.findFirstOrThrow({ where: { isDeleted: false } });
        await writeRoleDesignation(tx, admin, { scope: "band", designation: "public", roleId: xBandRole.parseIdentity(selected.publicId) });
        expect((await loadAuthorizationForUser(fixture.admin, tx, parsePublicId<"Band">(fixture.bands[0]!.publicId))).hasPermission(Permission.sysadmin)).toBe(true);
    }));

    it("repairs duplicate Sysadmin designations without changing assigned authority or using account flags", () => run(async (tx, fixture) => {
        const selected = await createGlobalRole(tx, fixture, [Permission.sysadmin, Permission.login, Permission.global_band_admin]);
        await tx.globalRole.updateMany({ data: { isSysAdminRole: true } });
        await tx.user.update({ where: { id: fixture.user.id }, data: { isSysAdmin: true } });
        expect((await loadAuthorizationForUser(fixture.user, tx, null)).hasPermission(Permission.sysadmin)).toBe(false);
        const admin = await loadAuthorizationForUser(fixture.admin, tx, null);
        await writeRoleDesignation(tx, admin, { scope: "global", designation: "sysadmin", roleId: xGlobalRole.parseIdentity(selected.publicId) });
        expect((await loadAuthorizationForUser(fixture.user, tx, null)).hasPermission(Permission.sysadmin)).toBe(false);
    }));

    it("repairs the global Sysadmin designation without changing sessions or band defaults", () => run(async (tx, fixture) => {
        const auth = await loadAuthorizationForUser(fixture.admin, tx);
        const selected = await createGlobalRole(tx, fixture, [Permission.sysadmin, Permission.login, Permission.global_band_admin]);
        const bandRoles = await tx.bandRole.findMany();
        const session = await tx.session.create({ data: { userId: fixture.admin.id, handle: generatePublicId(), hashedSessionToken: generatePublicId(), antiCSRFToken: generatePublicId(), expiresAt: new Date("2099-01-01") } });
        await writeRoleDesignation(tx, auth, { scope: "global", designation: "sysadmin", roleId: xGlobalRole.parseIdentity(selected.publicId) });
        expect(await tx.globalRole.findMany({ where: { isSysAdminRole: true } })).toMatchObject([{ id: selected.id }]);
        expect(await tx.session.findUnique({ where: { id: session.id } })).toEqual(session);
        expect(await tx.bandRole.findMany()).toEqual(bandRoles);
        const audits = await tx.change.findMany({ where: { context: "setRoleDesignation" } });
        expect(audits).toHaveLength(2);
        expect(new Set(audits.map(audit => audit.operationId)).size).toBe(1);
    }));

    it.each([{ grants: [] }, { grants: [Permission.sysadmin] }, { grants: [Permission.login] }])("rejects an incomplete designated Sysadmin grant set: $grants", ({ grants }) => run(async (tx, fixture) => {
        const auth = await loadAuthorizationForUser(fixture.admin, tx);
        const selected = await createGlobalRole(tx, fixture, grants);
        const before = await tx.globalRole.findMany();
        await expect(writeRoleDesignation(tx, auth, { scope: "global", designation: "sysadmin", roleId: xGlobalRole.parseIdentity(selected.publicId) })).rejects.toThrow("sysadmin and login");
        expect(await tx.globalRole.findMany()).toEqual(before);
        expect(await tx.change.count()).toBe(0);
    }));

    it.each(["band manager", "revoked", "deleted", "merged"])("requires current global authority for designation: %s", reason => run(async (tx, fixture) => {
        const auth = await loadAuthorizationForUser(reason === "band manager" ? fixture.user : fixture.admin, tx,
            reason === "band manager" ? parsePublicId<"Band">(fixture.bands[0]!.publicId) : null);
        const selected = await tx.bandRole.findFirstOrThrow();
        if (reason === "revoked") {
            await tx.globalRolePermission.deleteMany({ where: { permission: { name: Permission.sysadmin } } });
        } else if (reason === "deleted" || reason === "merged") {
            await tx.user.update({ where: { id: fixture.admin.id }, data: reason === "deleted" ? { isDeleted: true } : { mergedIntoUserId: fixture.user.id } });
        }
        await expect(writeRoleDesignation(tx, auth, { scope: "band", designation: "public", roleId: xBandRole.parseIdentity(selected.publicId) })).rejects.toThrow();
        expect(await tx.change.count()).toBe(0);
    }));

    it.each(["missing", "deleted", "other scope"])("rejects unavailable designation targets: %s", reason => run(async (tx, fixture) => {
        const auth = await loadAuthorizationForUser(fixture.admin, tx);
        const selected = await tx.bandRole.findFirstOrThrow();
        if (reason === "deleted") {
            await tx.bandRole.update({ where: { id: selected.id }, data: { isDeleted: true } });
        }
        const identity = reason === "missing" ? generatePublicId() : reason === "other scope"
            ? (await tx.globalRole.findFirstOrThrow()).publicId : selected.publicId;
        await expect(writeRoleDesignation(tx, auth, { scope: "band", designation: "public", roleId: xBandRole.parseIdentity(identity) })).rejects.toThrow();
        expect(await tx.change.count()).toBe(0);
    }));

    it.each(["global", "band"] as const)("creates unassigned %s definitions through the existing CRUD owner and edits localized metadata", scope => run(async (tx, fixture) => {
        const auth = await loadAuthorizationForUser(fixture.admin, tx);
        const view = scope === "global" ? globalRoleEditorView : bandRoleEditorView;
        const name = { kind: "set", stringPublicId: null, localeTag: "fr-BE", value: "Gestionnaires" };
        const created = await executeCatalogCrud(tx, auth, view, { name, color: "red", sortOrder: 42 });
        const role = scope === "global" ? await tx.globalRole.findUniqueOrThrow({ where: { publicId: String(created.identity) } })
            : await tx.bandRole.findUniqueOrThrow({ where: { publicId: String(created.identity) } });
        expect(role).toMatchObject({ isPublicRole: false, isRoleForNewUsers: false });
        const labels = await queryView({ view, filter: { publicIds: [view.entity.parseIdentity(created.identity)] }, routeLocale: "fr-BE", cmdbQueryContext: "role editor" }, auth, await snapshot(tx, auth));
        expect(labels.items[0]).toMatchObject({ name: "Gestionnaires", color: "red", sortOrder: 42 });
        expect(JSON.stringify(labels.items)).not.toMatch(/"(?:id|nameId|descriptionId|bandId)":/);
        await expect(executeCatalogCrud(tx, auth, view, { isPublicRole: true }, created.identity)).rejects.toThrow();
    }));

    it.each(["global", "band"] as const)("uses the same audited, idempotent grant writer for the %s matrix and role editor", scope => run(async (tx, fixture) => {
        const auth = await loadAuthorizationForUser(fixture.admin, tx);
        const role = scope === "global" ? await createGlobalRole(tx, fixture)
            : await tx.bandRole.create({ data: { publicId: generatePublicId(), nameId: (await tx.bandRole.findFirstOrThrow()).nameId } });
        const permission = await tx.permission.findUniqueOrThrow({ where: { name: scope === "global" ? Permission.manage_bands : Permission.manage_events } });
        const command = scope === "global" ? setGlobalRolePermissionCommand : setBandRolePermissionCommand;
        const handler = getDB3CommandHandler(command.commandID);
        const edit = { localIdentity: parsePublicId<"Permission">(permission.publicId), foreignIdentity: scope === "global" ? xGlobalRole.parseIdentity(role.publicId) : xBandRole.parseIdentity(role.publicId), isAssociated: true };
        const context = { authorization: auth, transaction: tx, rowServices: createCommandRowServices(auth, tx) };
        await handler.execute(command.parseDto(edit), context);
        const count = await tx.change.count();
        expect(count).toBe(1);
        await handler.execute(command.parseDto(edit), context);
        expect(await tx.change.count()).toBe(count);
        const view = scope === "global" ? permissionGlobalRoleMatrixView : permissionBandRoleMatrixView;
        const result = await queryView({ view, filter: { publicIds: [edit.localIdentity] }, routeLocale: "fr-BE", cmdbQueryContext: "role matrix" }, auth, await snapshot(tx, auth));
        expect(JSON.stringify(result.items)).toContain(role.publicId);
        expect(JSON.stringify(result.items)).not.toMatch(/"(?:id|roleId|permissionId|bandId)":\d/);
        await handler.execute(command.parseDto({ ...edit, isAssociated: false }), context);
        expect(await tx.change.count()).toBe(2);
    }));

    it.each(["global", "band"] as const)("resolves shared %s role labels per band without leaking overrides or explicit blanks", scope => run(async (tx, fixture) => {
        const role = scope === "global" ? await createGlobalRole(tx, fixture)
            : await tx.bandRole.findFirstOrThrow({ where: { isDeleted: false, isPublicRole: false } });
        const view = scope === "global" ? globalRoleEditorView : bandRoleEditorView;
        const identity = view.entity.parseIdentity(role.publicId);
        await tx.dynamicLocalizedStringValue.create({ data:
            { publicId: generatePublicId(), stringId: role.nameId, localeId: fixture.frenchId, indexedValue: "Rôle partagé" } });
        await tx.bandDynamicLocalizedStringValue.createMany({ data: [
            { publicId: generatePublicId(), stringId: role.nameId, localeId: fixture.frenchId, bandId: fixture.bands[0]!.id, indexedValue: "" },
            { publicId: generatePublicId(), stringId: role.nameId, localeId: fixture.dutchId, bandId: fixture.bands[1]!.id, indexedValue: "Beheerders" },
        ] });
        // Band-first resolution exhausts its values before considering global translations.
        for (const [index, language, expected] of [[0, "fr-BE", ""], [1, "nl-BE", "Beheerders"], [1, "fr-BE", "Beheerders"]] as const) {
            const auth = await loadAuthorizationForUser(fixture.admin, tx, parsePublicId<"Band">(fixture.bands[index]!.publicId));
            const result = await queryView({ view, filter: { publicIds: [identity] }, routeLocale: language,
                browserLanguages: [index ? "fr-BE" : "nl-BE"], cmdbQueryContext: "shared role labels" }, auth, await snapshot(tx, auth));
            expect(result.items[0]).toMatchObject({ publicId: role.publicId, name: expected });
        }
        const platform = await loadAuthorizationForUser(fixture.admin, tx, null);
        const unscoped = await queryView({ view, filter: { publicIds: [identity] }, routeLocale: "fr-BE", cmdbQueryContext: "global role label" },
            platform, await snapshot(tx, platform));
        expect(unscoped.items[0]).toMatchObject({ name: "Rôle partagé" });
    }));

    it.each(["global", "band"] as const)("rechecks current Sysadmin grants at %s editor and matrix request boundaries", scope => run(async (tx, fixture) => {
        const auth = await loadAuthorizationForUser(fixture.admin, tx, null);
        const role = scope === "global" ? await createGlobalRole(tx, fixture)
            : await tx.bandRole.findFirstOrThrow({ where: { isDeleted: false } });
        const view = scope === "global" ? globalRoleEditorView : bandRoleEditorView;
        const command = scope === "global" ? setGlobalRolePermissionCommand : setBandRolePermissionCommand;
        const identity = view.entity.parseIdentity(role.publicId);
        const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.manage_events } });
        await tx.globalRolePermission.deleteMany({ where: { permission: { name: Permission.sysadmin } } });
        await expect(executeCatalogCrud(tx, auth, view, { sortOrder: 999 }, identity)).rejects.toThrow();
        const fresh = await auth.refresh(tx);
        await expect(getDB3CommandHandler(command.commandID).execute(command.parseDto({ localIdentity: permission.publicId,
            foreignIdentity: role.publicId, isAssociated: true }), { authorization: fresh, transaction: tx, rowServices: createCommandRowServices(fresh, tx) })).rejects.toThrow();
        expect(await tx.change.count()).toBe(0);
        expect((scope === "global" ? await tx.globalRole.findUniqueOrThrow({ where: { id: role.id } })
            : await tx.bandRole.findUniqueOrThrow({ where: { id: role.id } })).sortOrder).toBe(role.sortOrder);
    }));

    it.each([Permission.sysadmin, Permission.manage_global_users, Permission.never_grant, Permission.impersonate_user])("rejects protected platform grant %s on band definitions", permissionName => run(async (tx, fixture) => {
        const auth = await loadAuthorizationForUser(fixture.admin, tx);
        const role = await tx.bandRole.findFirstOrThrow();
        const permission = await tx.permission.findUniqueOrThrow({ where: { name: permissionName } });
        await expect(executeCatalogCrud(tx, auth, bandRoleEditorView, { bandRolePermissions: [permission.publicId] }, xBandRole.parseIdentity(role.publicId))).rejects.toThrow();
        expect(await tx.change.count()).toBe(0);
    }));

    it.each([Permission.manage_events, Permission.view_files, Permission.visibility_public])("rejects band grant %s on global definitions", permissionName => run(async (tx, fixture) => {
        const auth = await loadAuthorizationForUser(fixture.admin, tx);
        const role = await createGlobalRole(tx, fixture);
        const permission = await tx.permission.findUniqueOrThrow({ where: { name: permissionName } });
        await expect(executeCatalogCrud(tx, auth, globalRoleEditorView, { permissions: [permission.publicId] }, xGlobalRole.parseIdentity(role.publicId))).rejects.toThrow();
        expect(await tx.change.count()).toBe(0);
    }));

    it.each([Permission.sysadmin, Permission.login])("preserves required %s in the designated global role through both grant paths", permissionName => run(async (tx, fixture) => {
        const auth = await loadAuthorizationForUser(fixture.admin, tx);
        const role = await tx.globalRole.findFirstOrThrow({ where: { isSysAdminRole: true } });
        const grants = await tx.globalRolePermission.findMany({ where: { globalRoleId: role.id, permission: { name: { not: permissionName } } }, include: { permission: true } });
        const identity = xGlobalRole.parseIdentity(role.publicId);
        await expect(executeCatalogCrud(tx, auth, globalRoleEditorView, { permissions: grants.map(grant => grant.permission.publicId) }, identity)).rejects.toThrow("must retain");
        const permission = await tx.permission.findUniqueOrThrow({ where: { name: permissionName } });
        const handler = getDB3CommandHandler(setGlobalRolePermissionCommand.commandID);
        await expect(handler.execute({ localIdentity: parsePublicId<"Permission">(permission.publicId), foreignIdentity: identity, isAssociated: false },
            { authorization: auth, transaction: tx, rowServices: createCommandRowServices(auth, tx) })).rejects.toThrow("must retain");
        expect(await tx.change.count()).toBe(0);
    }));

    it("allows revoking band administration independently from the designated Sysadmin role", () => run(async (tx, fixture) => {
        const auth = await loadAuthorizationForUser(fixture.admin, tx);
        const role = await tx.globalRole.findFirstOrThrow({ where: { isSysAdminRole: true } });
        const grants = await tx.globalRolePermission.findMany({ where: { globalRoleId: role.id,
            permission: { name: { not: Permission.global_band_admin } } }, include: { permission: true } });
        await executeCatalogCrud(tx, auth, globalRoleEditorView,
            { permissions: grants.map(grant => grant.permission.publicId) }, xGlobalRole.parseIdentity(role.publicId));
        const platform = await auth.refresh(tx);
        expect(platform.hasPermission(Permission.sysadmin)).toBe(true);
        expect(platform.hasPermission(Permission.manage_bands)).toBe(true);
        expect(platform.hasPermission(Permission.global_band_admin)).toBe(false);
        const selectedBand = await loadAuthorizationForUser(fixture.admin, tx, parsePublicId<"Band">(fixture.bands[0]!.publicId));
        expect(selectedBand.hasPermission(BandPermission.manage_events)).toBe(false);
    }));

    it("classifies unassigned accounts through explicit Global Public Sysadmin grants without inheriting them into assigned roles", () => run(async (tx, fixture) => {
        const roleless = await tx.user.create({ data: { publicId: generatePublicId(), name: "Unassigned account", email: "roleless@test.invalid" } });
        await tx.user.update({ where: { id: fixture.user.id }, data: { isSysAdmin: true } });
        const namesBefore = await tx.user.findMany({ where: await loadPlatformSysadminWhere(tx), select: { id: true } });
        expect(namesBefore.map(person => person.id)).not.toContain(roleless.id);
        const publicRole = await tx.globalRole.findFirstOrThrow({ where: { isPublicRole: true, isDeleted: false } });
        const sysadmin = await tx.permission.findUniqueOrThrow({ where: { name: Permission.sysadmin } });
        await tx.globalRolePermission.create({ data: { publicId: generatePublicId(), globalRoleId: publicRole.id, permissionId: sysadmin.id } });
        const administrators = await tx.user.findMany({ where: await loadPlatformSysadminWhere(tx), select: { id: true } });
        expect(administrators.map(person => person.id)).toContain(roleless.id);
        expect(administrators.map(person => person.id)).toContain(fixture.admin.id);
        expect(administrators.map(person => person.id)).not.toContain(fixture.user.id);
        expect((await loadAuthorizationForUser(roleless, tx)).hasPermission(Permission.sysadmin)).toBe(true);
        expect((await loadAuthorizationForUser(fixture.user, tx)).hasPermission(Permission.sysadmin)).toBe(false);
    }));

    it("assigns and clears shared account roles without changing either membership or sessions", () => run(async (tx, fixture) => {
        const auth = await loadAuthorizationForUser(fixture.admin, tx);
        const person = await tx.user.findUniqueOrThrow({ where: { id: fixture.user.id } });
        const memberships = await tx.bandUser.findMany({ where: { userId: person.id } });
        const session = await tx.session.create({ data: { userId: person.id, handle: generatePublicId(), hashedSessionToken: generatePublicId(),
            antiCSRFToken: generatePublicId(), expiresAt: new Date("2099-01-01") } });
        const role = await createGlobalRole(tx, fixture);
        const edit = { userId: parsePublicId<"User">(person.publicId), roleId: xGlobalRole.parseIdentity(role.publicId), acknowledgeContinuityRisk: false };
        await writeAccountRole(tx, auth, edit);
        expect(await tx.user.findUniqueOrThrow({ where: { id: person.id } })).toMatchObject({ globalRoleId: role.id });
        await writeAccountRole(tx, auth, edit);
        expect(await tx.change.count()).toBe(1);
        await writeAccountRole(tx, auth, { ...edit, roleId: null });
        expect(await tx.user.findUniqueOrThrow({ where: { id: person.id } })).toMatchObject({ globalRoleId: null });
        expect(await tx.bandUser.findMany({ where: { userId: person.id } })).toEqual(memberships);
        expect(await tx.session.findUnique({ where: { id: session.id } })).toEqual(session);
        expect(await tx.change.findMany()).toMatchObject([{ table: "User", recordId: person.id }, { table: "User", recordId: person.id }]);
    }));

    it("assigns and removes the administrator role explicitly while keeping the display flag synchronized", () => run(async (tx, fixture) => {
        const auth = await loadAuthorizationForUser(fixture.admin, tx);
        const person = await tx.user.findUniqueOrThrow({ where: { id: fixture.user.id } });
        const userId = parsePublicId<"User">(person.publicId);
        const memberships = await tx.bandUser.findMany({ where: { userId: person.id } });
        await writeAccountAdministratorRole(tx, auth, { userId, isSysAdmin: true });
        expect((await loadAuthorizationForUser(person, tx, null)).hasPermission(Permission.sysadmin)).toBe(true);
        expect(await tx.user.findUniqueOrThrow({ where: { id: person.id } })).toMatchObject({ isSysAdmin: true });
        await writeAccountAdministratorRole(tx, auth, { userId, isSysAdmin: false });
        const ordinaryRole = await tx.globalRole.findFirstOrThrow({ where: { isRoleForNewUsers: true, isDeleted: false } });
        expect(await tx.user.findUniqueOrThrow({ where: { id: person.id } })).toMatchObject({ globalRoleId: ordinaryRole.id, isSysAdmin: false });
        expect((await loadAuthorizationForUser(person, tx, null)).hasPermission(Permission.sysadmin)).toBe(false);
        expect(await tx.bandUser.findMany({ where: { userId: person.id } })).toEqual(memberships);
    }));

    it("confirms losing the final ordinary global management holder and excludes role-carried Sysadmins", () => run(async (tx, fixture) => {
        const auth = await loadAuthorizationForUser(fixture.admin, tx);
        const role = await createGlobalRole(tx, fixture, [Permission.manage_global_users]);
        const person = await tx.user.update({ where: { id: fixture.user.id }, data: { globalRoleId: role.id } });
        const edit = { userId: parsePublicId<"User">(person.publicId), roleId: null, acknowledgeContinuityRisk: false };
        await expect(writeAccountRole(tx, auth, edit)).rejects.toThrow("CONTINUITY_ACKNOWLEDGEMENT_REQUIRED");
        expect(await tx.change.count()).toBe(0);
        await writeAccountRole(tx, auth, { ...edit, acknowledgeContinuityRisk: true });
        expect(await tx.change.count()).toBe(1);
    }));

    it("returns authorized localized global role choices with fresh delegation limits", () => run(async (tx, fixture) => {
        const role = await createGlobalRole(tx, fixture, [Permission.manage_global_users, Permission.login]);
        const safe = await createGlobalRole(tx, fixture, [Permission.login]);
        await tx.user.update({ where: { id: fixture.user.id }, data: { globalRoleId: safe.id } });
        const operator = await tx.user.create({ data: { publicId: generatePublicId(), name: "Global operator", email: "role-operator@test.invalid", globalRoleId: role.id } });
        const auth = await loadAuthorizationForUser(operator, tx);
        const target = parsePublicId<"User">((await tx.user.findUniqueOrThrow({ where: { id: fixture.user.id } })).publicId);
        await tx.dynamicLocalizedStringValue.create({ data: { publicId: generatePublicId(), stringId: safe.nameId, localeId: fixture.frenchId, indexedValue: "" } });
        const result = await readUserManagementCapabilities(await snapshot(tx, auth), auth, target, { routeLocale: "fr-BE", browserLanguages: ["nl-BE"] });
        expect(result.canAssignRole).toBe(true);
        expect(result.assignableRoles).toContainEqual(expect.objectContaining({ publicId: safe.publicId, name: "" }));
        expect(result.assignableRoles.some(choice => choice.publicId === role.publicId)).toBe(false);
        await tx.globalRolePermission.deleteMany({ where: { globalRoleId: role.id, permission: { name: Permission.manage_global_users } } });
        expect((await readUserManagementCapabilities(await snapshot(tx, auth), auth, target, {})).canAssignRole).toBe(false);
        await expect(writeAccountRole(tx, auth, { userId: target, roleId: xGlobalRole.parseIdentity(safe.publicId), acknowledgeContinuityRisk: true })).rejects.toThrow();
    }));

    it.each(["band manager", "deleted target", "merged target", "missing role", "deleted role", "protected role"])("rejects unsafe global account role assignment: %s", reason => run(async (tx, fixture) => {
        const role = await createGlobalRole(tx, fixture);
        const operatorRole = await createGlobalRole(tx, fixture, [Permission.manage_global_users]);
        const operator = await tx.user.create({ data: { publicId: generatePublicId(), name: "Account role operator", email: "account-role@test.invalid", globalRoleId: operatorRole.id } });
        const actor = reason === "band manager" ? fixture.user : reason === "protected role" ? operator : fixture.admin;
        const auth = await loadAuthorizationForUser(actor, tx, reason === "band manager" ? parsePublicId<"Band">(fixture.bands[0]!.publicId) : null);
        const person = await tx.user.findUniqueOrThrow({ where: { id: fixture.user.id } });
        if (reason === "deleted target" || reason === "merged target") {
            await tx.user.update({ where: { id: person.id }, data: reason === "deleted target" ? { isDeleted: true } : { mergedIntoUserId: fixture.admin.id } });
        }
        if (reason === "deleted role") {
            await tx.globalRole.update({ where: { id: role.id }, data: { isDeleted: true } });
        }
        const desired = reason === "missing role" ? generatePublicId() : reason === "protected role" ? (await tx.globalRole.findFirstOrThrow({ where: { isSysAdminRole: true } })).publicId : role.publicId;
        await expect(writeAccountRole(tx, auth, { userId: parsePublicId<"User">(person.publicId), roleId: xGlobalRole.parseIdentity(desired), acknowledgeContinuityRisk: true })).rejects.toThrow();
        expect(await tx.change.count()).toBe(0);
    }));
});
