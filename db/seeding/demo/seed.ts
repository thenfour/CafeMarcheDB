import { PrismaClient, type Prisma } from "@prisma/client";
import { SecurePassword } from "@blitzjs/auth/secure-password";
import { initializeAccessControl } from "../../../src/setup/accessControl";
import { demoPassword, resolveDemoDatabaseUrl, type DemoConfig, type DemoLocale } from "./config";
import { createDemoContext } from "./context";
import { seedDemoCatalogs } from "./catalogs";
import { createDemoPerson, seedDemoBand, seedDemoShellTranslations } from "./bands";
import { seedDemoEvents, seedDemoSongs, seedDemoWiki } from "./content";
import { writeDemoAssets } from "./assets";

async function replaceEmptyMigrationScaffold(db: Prisma.TransactionClient): Promise<void> {
    const counts = await Promise.all([db.user.count(), db.song.count(), db.event.count(), db.file.count(), db.wikiPage.count(),
        db.menuLink.count(), db.globalInstrument.count(), db.customLink.count()]);
    if (counts.some(count => count !== 0)) {
        throw new Error("Demo seeding requires an empty database. Use yarn demo:reset.");
    }
    // Historical migrations create an empty Café Marché band even on a fresh database.
    // This explicit demo reset replaces that scaffold, never migrated application content.
    await db.bandLocale.deleteMany();
    await db.bandSetting.deleteMany();
    await db.bandStaticLocalizedStringValue.deleteMany();
    await db.bandDynamicLocalizedStringValue.deleteMany();
    await db.band.deleteMany();
}

async function loadDemoRoles(db: Prisma.TransactionClient, englishId: number): Promise<Map<string, number>> {
    const roles = await db.bandRole.findMany({ include: { name: { include: { values: { where: { localeId: englishId } } } } } });
    const result = new Map(roles.map(role => [role.name.values[0]?.indexedValue ?? "", role.id]));
    for (const required of ["Band Admin", "Normal Users", "Limited Users"]) {
        if (!result.has(required)) {
            throw new Error(`Missing initialized demo role: ${required}.`);
        }
    }
    return result;
}

export async function seedDemoDatabase(databaseUrl: string, config: DemoConfig, assetDirectory: string): Promise<void> {
    const target = resolveDemoDatabaseUrl(undefined, databaseUrl);
    const database = new PrismaClient({ datasourceUrl: target.toString() });
    try {
        await initializeAccessControl(database);
        const hashedPassword = await SecurePassword.hash(demoPassword);
        const assets = await writeDemoAssets(assetDirectory, config);
        await database.$transaction(async db => {
            await replaceEmptyMigrationScaffold(db);
            const locales = new Map<DemoLocale, number>();
            for (const tag of config.locales) {
                const row = await db.locale.findUniqueOrThrow({ where: { ietfTag: tag } });
                locales.set(tag, row.id);
            }
            const c = createDemoContext(db, config, locales);
            const roles = await loadDemoRoles(db, locales.get("en-US")!);
            const sysadmin = await db.globalRole.findFirstOrThrow({ where: { isSysAdminRole: true, isDeleted: false } });
            await createDemoPerson(c, "platform", "Demo Platform Administrator", "admin@demo.invalid", hashedPassword, sysadmin.id);
            const shared = await createDemoPerson(c, "shared", "Alex Shared", "shared@demo.invalid", hashedPassword);
            await seedDemoShellTranslations(c);
            const catalogs = await seedDemoCatalogs(c);
            const visibility = await db.permission.findUniqueOrThrow({ where: { name: "visibility_members" } });
            for (let index = 0; index < config.bands; index++) {
                const band = { ...await seedDemoBand(c, index, catalogs, shared, hashedPassword, roles), memberVisibilityId: visibility.id };
                const { songs } = await seedDemoSongs(c, band, catalogs, assets);
                await seedDemoWiki(c, band);
                await seedDemoEvents(c, band, catalogs, songs);
            }
        }, { isolationLevel: "Serializable", timeout: 180_000 });
    } finally {
        await database.$disconnect();
    }
}
