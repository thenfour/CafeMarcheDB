import { gPermissionRegistry, Permission } from "shared/permissions";
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
            isDeleted: user.isDeleted, mergedIntoUserId: null, globalRoleId: null,
        })),
        band: [{ id: 1, publicId: readFixtureBandId, isDeleted: false }],
        permission: gPermissionRegistry.map((item, index) => ({
            id: index + 1, publicId: `ReadPerm${String(index + 1).padStart(8, "0")}`, name: item.key, isDeleted: false,
        })),
        globalRole: [{ id: 1, publicId: "GlobalRole000001", isSysAdminRole: true, isDeleted: false }],
        globalRolePermission: gPermissionRegistry.filter(item => item.key !== Permission.never_grant).map((item, index) => ({
            id: index + 1, globalRoleId: 1, permissionId: permissionId(item.key),
        })),
        bandRole: [{ id: 0, publicId: "PublicRole000001", isDeleted: false, isPublicRole: true, isRoleForNewUsers: false }, ...actors.map(({ user }) => ({
            id: user.id, publicId: `BandRole${String(user.id).padStart(8, "0")}`,
            isDeleted: false, isPublicRole: false, isRoleForNewUsers: false,
        }))],
        bandRolePermission: [{ id: 0, bandRoleId: 0, permissionId: permissionId(Permission.public) }, ...actors.flatMap(({ user, permissions }) => permissions.map((name, index) => ({
            id: user.id * 1000 + index, bandRoleId: user.id, permissionId: permissionId(name),
        })))],
        bandUser: actors.map(({ user }) => ({
            id: user.id, publicId: readFixtureMembershipId(user.id), bandId: 1, userId: user.id,
            bandRoleId: user.id, isDeleted: false, createdAt: new Date("2026-10-01T00:00:00Z"),
        })),
    };
}
