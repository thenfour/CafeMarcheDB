import type { Prisma, PrismaClient } from "@prisma/client";
import { DefaultRolePermissionAssignments } from "shared/defaultRolePermissionAssignments";
import { generatePublicId } from "src/server/publicId";

export const settingsMysqlTestUrl = process.env.CMDB_PHASE2_TEST_DATABASE_URL;
if (settingsMysqlTestUrl) {
    const url = new URL(settingsMysqlTestUrl);
    if (url.hostname !== "127.0.0.1" || !["32691", "32693", "32694", "32695"].includes(url.port)
        || !/^\/lsmb_phase2_[a-f0-9]+$/.test(url.pathname)) throw new Error("Settings tests require a private disposable database.");
}

export interface SettingsMysqlFixture {
    readonly user: { id: number };
    readonly admin: { id: number };
    readonly bands: Array<{ id: number; publicId: string }>;
    readonly englishId: number;
    readonly frenchId: number;
    readonly dutchId: number;
}

/** Real memberships and scope grants; every test's writes roll back together. */
export async function withSettingsMysqlFixture(database: PrismaClient,
    work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>,
): Promise<void> {
    const rollback = new Error("Rollback settings fixture");
    try {
        await database.$transaction(async tx => {
            const locales = await tx.locale.findMany();
            const englishId = locales.find(locale => locale.ietfTag === "en-US")!.id;
            const frenchId = locales.find(locale => locale.ietfTag === "fr-BE")!.id;
            const dutchId = locales.find(locale => locale.ietfTag === "nl-BE")!.id;
            // Migrated databases preserve their grants. Fixture authority must not depend on them.
            const fixtureGrants = DefaultRolePermissionAssignments.filter(([role]) => role === "Band Admin").map(([, permission]) => permission);
            const permissions = await tx.permission.findMany({ where: { name: { in: fixtureGrants }, isDeleted: false } });
            if (permissions.length !== new Set(fixtureGrants).size) {
                throw new Error("Settings fixture permissions must be initialized first.");
            }
            const role = await tx.bandRole.create({ data: {
                publicId: generatePublicId(),
                name: { create: { publicId: generatePublicId(), values: { create: {
                    publicId: generatePublicId(), localeId: englishId, indexedValue: "Settings fixture role",
                } } } },
                bandRolePermissions: { create: permissions.map(permission => ({ publicId: generatePublicId(), permissionId: permission.id })) },
            } });
            const globalRole = await tx.globalRole.findFirstOrThrow({ where: { isSysAdminRole: true } });
            const accountRole = await tx.globalRole.findFirstOrThrow({ where: { isRoleForNewUsers: true, isDeleted: false } });
            const user = await tx.user.create({ data: { publicId: generatePublicId<"User">(), name: "Shared settings person", email: "settings@test.invalid", globalRoleId: accountRole.id } });
            const admin = await tx.user.create({ data: { publicId: generatePublicId<"User">(), name: "Platform fixture", email: "platform@test.invalid", globalRoleId: globalRole.id } });
            const bands: SettingsMysqlFixture["bands"] = [];
            for (let index = 0; index < 2; index++) {
                const name = await tx.dynamicLocalizedString.create({ data: { publicId: generatePublicId<"DynamicLocalizedString">() } });
                const band = await tx.band.create({ data: { publicId: generatePublicId<"Band">(), nameId: name.id,
                    locales: { create: locales.map(locale => ({ localeId: locale.id })) } } });
                await tx.bandUser.create({ data: { publicId: generatePublicId<"BandUser">(), userId: user.id, bandId: band.id, bandRoleId: index === 0 ? role.id : null } });
                bands.push(band);
            }
            await work(tx, { user, admin, bands, englishId, frenchId, dutchId });
            throw rollback;
        }, { isolationLevel: "Serializable", timeout: 60_000 });
    } catch (error) { if (error !== rollback) throw error; }
}
