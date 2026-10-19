import { gPermissionRegistry, Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { vi } from "vitest";
import { selectPrismaTestRow } from "tests/support/prismaSelection";
import type { DB3ReadSelectionArgs } from "src/core/db3/shared/core/db3ReadSelection";
import { authorizationPermissionId, testPublicRolePermissions, type AuthorizationTestUser } from "./authorizationFixtures";
import { authorizationTestDb } from "./inMemoryPrisma";
import { createAuthorizationSeed } from "./authorizationSeed";

export const wikiFixtureBand = parsePublicId<"Band">("FixtureBand00001");

/** Wiki resolver tests use real selected-band grants rather than the retired User.role relation. */
export function seedWikiAuthorization(user: AuthorizationTestUser) {
    const permissions = gPermissionRegistry.map(definition => ({
        id: authorizationPermissionId(definition.key), name: definition.key,
        publicId: `TestPerm${String(authorizationPermissionId(definition.key)).padStart(8, "0")}`,
        isDeleted: false, significance: definition.key === Permission.visibility_members ? "Visibility_Members" : null,
    }));
    const authorization = createAuthorizationSeed([user], testPublicRolePermissions, permissions);
    for (const [table, rows] of Object.entries(authorization)) {
        authorizationTestDb.getDelegate(table).reset(rows);
    }
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
