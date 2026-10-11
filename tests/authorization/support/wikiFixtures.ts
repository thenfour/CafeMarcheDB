import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { vi } from "vitest";
import { selectPrismaTestRow } from "tests/support/prismaSelection";
import type { DB3ReadSelectionArgs } from "src/core/db3/shared/core/db3ReadSelection";
import { authorizationPermissionId, type AuthorizationTestUser } from "./authorizationFixtures";
import { authorizationTestDb } from "./inMemoryPrisma";

export const wikiFixtureBand = parsePublicId<"Band">("FixtureBand00001");

/** Wiki resolver tests use real selected-band grants rather than the retired User.role relation. */
export function seedWikiAuthorization(user: AuthorizationTestUser) {
    authorizationTestDb.getDelegate("user").reset([{ ...user, globalRoleId: null, mergedIntoUserId: null }]);
    const grants = user.permissions.map((name, index) => ({
        id: index + 1, permission: {
            id: authorizationPermissionId(name), name,
            publicId: `TestPerm${String(authorizationPermissionId(name)).padStart(8, "0")}`,
            isDeleted: false,
        },
    }));
    authorizationTestDb.getDelegate("permission").reset(grants.map(grant => ({
        ...grant.permission, isDeleted: false,
        significance: grant.permission.name === Permission.visibility_members ? "Visibility_Members" : null,
    })));
    authorizationTestDb.getDelegate("band").reset([{ id: 1, publicId: wikiFixtureBand, isDeleted: false }]);
    authorizationTestDb.getDelegate("bandUser").reset([{
        id: 1, publicId: "FixtureMember001", bandId: 1, userId: user.id, bandRoleId: 1, isDeleted: false,
    }]);
    authorizationTestDb.getDelegate("bandRole").reset([{
        id: 1, isDeleted: false, isPublicRole: false, isRoleForNewUsers: false,
    }]);
    authorizationTestDb.getDelegate("bandRolePermission").reset(grants.map(grant => ({
        id: grant.id, bandRoleId: 1, permissionId: grant.permission.id,
    })));
}

/** Parent ownership support must obey Prisma selects, without returning a recursive page graph. */
export function useWikiPrismaSelections() {
    for (const table of ["wikiPage", "wikiPageRevision"]) {
        const delegate = authorizationTestDb.getDelegate(table);
        const findMany = delegate.findMany.bind(delegate);
        const create = delegate.create.bind(delegate);
        const update = delegate.update.bind(delegate);
        // These two delegates share the runtime selection shape, while their fixture rows stay heterogeneous.
        const project = (row: { id: number }, args: unknown) => {
            const selection = args as DB3ReadSelectionArgs; // The intercepted Prisma methods supply the selection contract.
            return selection.select ? { ...selectPrismaTestRow(row, selection), id: row.id } : row;
        };
        vi.spyOn(delegate, "findMany").mockImplementation(async (args = {}) =>
            (await findMany(args)).map(row => project(row, args)));
        vi.spyOn(delegate, "create").mockImplementation(async args => project(await create(args), args));
        vi.spyOn(delegate, "update").mockImplementation(async args => project(await update(args), args));
    }
}
