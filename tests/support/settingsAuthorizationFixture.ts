import type { Prisma } from "@prisma/client";
import { Permission, gPermissionRegistry } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { createAuthorizationTestContext, createAuthorizationTestUser } from "../authorization/support/authorizationFixtures";
import { authorizationTestDb } from "../authorization/support/inMemoryPrisma";

// This fake implements the transaction and delegates used by settings and presentation.
export const settingsTestDatabase = authorizationTestDb as unknown as Prisma.TransactionClient;
// Narrow the fake's dynamic delegate index so Vitest can type its real transaction method.
export const settingsTransactionFixture = authorizationTestDb as unknown as {
    transaction(work: () => Promise<unknown>): Promise<unknown>;
};
export const firstSettingsBand = parsePublicId<"Band">("Band000000000001");
export const secondSettingsBand = parsePublicId<"Band">("Band000000000002");
export const settingsOwnerId = 42;
export const otherSettingsUserId = 43;
export const settingsAdminId = 44;

export function settingsTestContext(userId: number | null = settingsOwnerId, permissions: Permission[] = []) {
    return createAuthorizationTestContext(userId === null ? null : createAuthorizationTestUser("normal", {
        id: userId, isSysAdmin: false, permissions,
    }));
}

export function settingsPermissionId(key: Permission): number {
    return gPermissionRegistry.findIndex(definition => definition.key === key) + 1;
}

export function setSettingsBandPermissions(permissions: readonly Permission[]): void {
    authorizationTestDb.getDelegate("bandRolePermission").reset(permissions.map((permission, index) => ({
        id: index + 1, bandRoleId: 11, permissionId: settingsPermissionId(permission),
    })));
}

export function resetSettingsAuthorizationFixture(): void {
    authorizationTestDb.reset({
        user: [settingsOwnerId, otherSettingsUserId, settingsAdminId].map(id => ({
            id, publicId: `User${String(id).padStart(12, "0")}`, globalRoleId: id === settingsAdminId ? 30 : 2,
            isDeleted: false, mergedIntoUserId: null, isSysAdmin: false,
        })),
        band: [1, 2].map(id => ({ id, publicId: `Band00000000000${id}`, isDeleted: false })),
        bandUser: [1, 2].map(id => ({
            id, publicId: `Member000000000${id}`, bandId: id, userId: settingsOwnerId,
            bandRoleId: id + 10, isDeleted: false,
        })),
        bandRole: [{ id: 1, isPublicRole: true, isDeleted: false }, { id: 11, isDeleted: false }, { id: 12, isDeleted: false }],
        globalRole: [
            { id: 1, isPublicRole: true, isRoleForNewUsers: false, isSysAdminRole: false, isDeleted: false },
            { id: 2, isPublicRole: false, isRoleForNewUsers: true, isSysAdminRole: false, isDeleted: false },
            { id: 30, isPublicRole: false, isRoleForNewUsers: false, isSysAdminRole: true, isDeleted: false },
        ],
        permission: gPermissionRegistry.map((definition, index) => ({ id: index + 1, name: definition.key, isDeleted: false })),
        globalRolePermission: [
            { roleId: 1, permissions: [Permission.always_grant, Permission.public, Permission.practice_tools_use] },
            { roleId: 2, permissions: [Permission.always_grant, Permission.public, Permission.practice_tools_use, Permission.login] },
            { roleId: 30, permissions: [Permission.manage_global_settings, Permission.sysadmin, Permission.login, Permission.global_band_admin] },
        ].flatMap(({ roleId, permissions }) => permissions.map((permission, index) => ({
            id: roleId * 100 + index, globalRoleId: roleId, permissionId: settingsPermissionId(permission),
        }))),
        locale: ["en-US", "fr-BE", "nl-BE"].map((ietfTag, index) => ({
            id: index + 1, publicId: `Locale000000000${index + 1}`, ietfTag, isDeleted: false,
        })),
        bandLocale: [1, 2].flatMap(bandId => [1, 2, 3].map(localeId => ({ id: bandId * 10 + localeId, bandId, localeId }))),
        userSetting: [{ id: 1, userId: otherSettingsUserId, name: "calendar.showDeclinedEvents", value: false }],
    });
    setSettingsBandPermissions([Permission.manage_site_branding, Permission.manage_band_settings]);
}
