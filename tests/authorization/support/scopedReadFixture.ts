import { gPermissionRegistry, getPermissionDefinition, Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import type { AuthorizationTestUser } from "./authorizationFixtures";

export const readFixtureBandId = parsePublicId<"Band">("FixtureBand00001");
export const readFixtureMembershipId = (userId: number) => `Member${String(userId).padStart(10, "0")}`;

/** Persist current account/membership grants; session fixtures are identity hints only. */
export function scopedReadFixture(actors: readonly { readonly user: AuthorizationTestUser; readonly permissions: readonly Permission[] }[]) {
    const permissionId = (name: string) => gPermissionRegistry.findIndex(item => item.key === name) + 1;
    return {
        user: actors.map(({ user }) => ({
            id: user.id, publicId: user.publicId, name: user.name, email: user.email, phone: user.phone,
            createdAt: user.createdAt, cssClass: user.cssClass, isSysAdmin: user.isSysAdmin,
            isDeleted: user.isDeleted, mergedIntoUserId: null, globalRoleId: user.globalRoleId,
        })),
        band: [{ id: 1, publicId: readFixtureBandId, isDeleted: false }],
        permission: gPermissionRegistry.map((item, index) => ({
            id: index + 1, publicId: `ReadPerm${String(index + 1).padStart(8, "0")}`, name: item.key, isDeleted: false,
        })),
        globalRole: [{ id: 900000, isPublicRole: true, isDeleted: false }, ...actors.map(({ user }) => ({
            id: user.globalRoleId!, publicId: user.globalRole!.publicId, isDeleted: false, isSysAdminRole: user.globalRole!.permissions.some(grant => grant.permission.name === Permission.sysadmin),
        }))],
        globalRolePermission: [
            { id: 0, globalRoleId: 900000, permissionId: permissionId(Permission.public) },
            ...actors.flatMap(({ user }) => user.globalRole!.permissions.map((grant, index) => ({
                id: user.id * 1000 + index, globalRoleId: user.globalRoleId!, permissionId: permissionId(grant.permission.name),
            }))),
        ],
        bandRole: [{ id: 0, publicId: "PublicRole000001", isDeleted: false, isPublicRole: true, isRoleForNewUsers: false }, ...actors.map(({ user }) => ({
            id: user.id, publicId: `BandRole${String(user.id).padStart(8, "0")}`,
            isDeleted: false, isPublicRole: false, isRoleForNewUsers: false,
        }))],
        bandRolePermission: actors.flatMap(({ user, permissions }) => permissions.filter(name => getPermissionDefinition(name).scope === "band").map((name, index) => ({
            id: user.id * 1000 + index, bandRoleId: user.id, permissionId: permissionId(name),
        }))),
        bandUser: actors.map(({ user }) => ({
            id: user.id, publicId: readFixtureMembershipId(user.id), bandId: 1, userId: user.id,
            bandRoleId: user.id, isDeleted: false, createdAt: new Date("2026-10-01T00:00:00Z"),
        })),
    };
}
