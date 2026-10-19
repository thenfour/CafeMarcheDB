import { gPermissionRegistry, getPermissionDefinition, Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { testPublicRolePermissions, type AuthorizationTestUser } from "./authorizationFixtures";
import { authorizationTestDb, type Seed, type TestRow } from "./inMemoryPrisma";

export const authorizationBandId = parsePublicId<"Band">("FixtureBand00001");
export const authorizationAccountRoleId = 900_004;
const accountPermissions = [Permission.always_grant, Permission.public, Permission.practice_tools_use, Permission.login];

// The scenarios seed heterogeneous Prisma tables; user grants retain their typed persona contract.
type AuthorizationFixtureSeed = Seed & { user?: Array<AuthorizationTestUser & { hashedPassword?: string | null }> };

export function createAuthorizationSeed(users: readonly AuthorizationTestUser[], publicPermissions: readonly Permission[],
    permissionRows: readonly TestRow[],
) {
    const permissionId = (name: Permission) => {
        const row = permissionRows.find(row => row.name === name);
        if (!row) {
            throw new Error(`Authorization fixture is missing permission '${name}'.`);
        }
        return row.id;
    };
    return {
        user: users.map(({ permissions: _permissions, globalRole: _globalRole, ...user }) => user),
        band: [{ id: 1, publicId: authorizationBandId, isDeleted: false }],
        locale: [{ id: 1, publicId: "EnglishLocale001", ietfTag: "en-US", sortOrder: 1, isDeleted: false }],
        bandLocale: [{ id: 1, bandId: 1, localeId: 1, sortOrder: 1 }],
        bandSetting: [{ id: 1, publicId: "BandTimeZone0001", bandId: 1, name: "dateTime.bandTimeZone", value: "Europe/Brussels" }],
        permission: [...permissionRows],
        globalRole: [{ id: 900_003, publicId: "PublicGlobal0001", name: "Global Public", description: null, color: null, sortOrder: 0,
            isPublicRole: true, isRoleForNewUsers: false, isSysAdminRole: false, isDeleted: false },
            { id: authorizationAccountRoleId, publicId: "AccountRole00001", name: "Accounts", description: null, color: null, sortOrder: 10,
                isRoleForNewUsers: true, isPublicRole: false, isSysAdminRole: false, isDeleted: false },
            { id: 900_002, publicId: "SysadminRole0001", name: "Sysadmin", description: null, color: null, sortOrder: 0,
            isRoleForNewUsers: false, isPublicRole: false, isDeleted: false, isSysAdminRole: true },
            ...users.flatMap(user => user.globalRole ? [{ id: user.globalRole.id, publicId: user.globalRole.publicId,
                name: user.globalRole.name, description: null, color: null, sortOrder: 0,
                isRoleForNewUsers: false, isPublicRole: false, isDeleted: false, isSysAdminRole: false }] : [])],
        globalRolePermission: [
            ...accountPermissions.map((name, index) => ({
                id: 940_000 + index, globalRoleId: authorizationAccountRoleId, permissionId: permissionId(name),
            })),
            ...publicPermissions.filter(name => getPermissionDefinition(name).scope === "global").map((name, index) => ({
                id: 920_000 + index, globalRoleId: 900_003, permissionId: permissionId(name),
            })),
            ...Object.values(Permission).filter(name => name !== Permission.never_grant && getPermissionDefinition(name).scope === "global").map((name, index) => ({
                id: 930_000 + index, globalRoleId: 900_002, permissionId: permissionId(name),
            })),
            ...users.flatMap(user => user.globalRole?.permissions.map(grant => ({ id: grant.id, globalRoleId: grant.globalRoleId,
                permissionId: permissionId(grant.permission.name) })) ?? []),
        ],
        bandRole: [{ id: 900_001, publicId: "PublicBandRole01", name: "Band Public", description: null, color: null, sortOrder: 0,
            isDeleted: false, isPublicRole: true, isRoleForNewUsers: false },
            ...users.map(user => ({ id: user.id, publicId: `BandRole${String(user.id).padStart(8, "0")}`,
                isDeleted: false, isPublicRole: false, isRoleForNewUsers: false }))],
        bandRolePermission: [
            ...publicPermissions.filter(name => getPermissionDefinition(name).scope === "band").map((name, index) => ({ id: 910_000 + index, bandRoleId: 900_001, permissionId: permissionId(name) })),
            ...users.flatMap(user => user.permissions.filter(name => getPermissionDefinition(name).scope === "band")
                .map((name, index) => ({ id: user.id * 1000 + index, bandRoleId: user.id, permissionId: permissionId(name) }))),
        ],
        bandUser: users.map(user => ({ id: user.id, publicId: `Member${String(user.id).padStart(10, "0")}`,
            bandId: 1, userId: user.id, bandRoleId: user.id, isDeleted: false })),
    };
}

/** Request tests use this explicit account/band fixture; the Prisma double supplies no authorization defaults. */
export function resetAuthorizationDatabase(seed: AuthorizationFixtureSeed = {}) {
    const { user = [], permission = [], ...scenario } = seed;
    // Scenario metadata overrides a registry definition by name. Persisted grants use that row's real ID.
    const permissionRows = [
        ...gPermissionRegistry.filter(definition => !permission.some(row => row.name === definition.key)).map(definition => ({
            id: gPermissionRegistry.indexOf(definition) + 1,
            publicId: `TestPerm${String(gPermissionRegistry.indexOf(definition) + 1).padStart(8, "0")}`, name: definition.key, isDeleted: false,
            description: definition.description, sortOrder: definition.sortOrder, isVisibility: definition.isVisibility,
            color: definition.presentation?.color ?? null, iconName: definition.presentation?.iconName ?? null,
            significance: definition.presentation?.significance ?? null,
        })),
        ...permission.map(row => ({ isDeleted: false, ...row })),
    ];
    authorizationTestDb.reset({ ...createAuthorizationSeed(user, testPublicRolePermissions, permissionRows), ...scenario });
}
