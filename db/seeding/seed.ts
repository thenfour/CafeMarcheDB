import { SecurePassword } from "@blitzjs/auth/secure-password";
import type { Prisma, PrismaClient } from "@prisma/client";
import path from "path";
import { initializeAccessControl } from "../../src/setup/accessControl";
import { seedPlatformCatalogs } from "./catalogs";
import { seedBand } from "./bands";
import { defaultSeedingConfig, distributeSeedCount, validateSeedingConfig, type SeedingConfig } from "./config";
import type { SeedLocale } from "./localization";
import type { SeedingState } from "./base";
import { developmentPassword, seedPeople } from "./people";
import { seedSongs } from "./songs";
import { seedEvents } from "./events";
import { seedWikiPages } from "./wikiPageSeeding";
import { seedActivity } from "./activitySeeding";
import { seedBandSampleFiles } from "./files";

async function requireFreshSeedDatabase(db: Prisma.TransactionClient): Promise<void> {
    const counts = await Promise.all([db.user.count(), db.song.count(), db.event.count(), db.file.count(), db.wikiPage.count(),
        db.menuLink.count(), db.customLink.count(), db.globalInstrument.count(), db.globalSongTag.count(), db.globalFileTag.count(),
        db.globalEventTag.count(), db.globalUserTag.count(), db.globalWikiPageTag.count()]);
    if (counts.some(count => count !== 0)) {
        throw new Error("Development seeding requires a fresh database. Reset the database before seeding.");
    }
}

export interface DevelopmentSeedOptions {
    config: Readonly<SeedingConfig>;
    now: Date;
    assetDirectory: string;
}

export async function seedDevelopmentDatabase(database: PrismaClient, options: DevelopmentSeedOptions): Promise<void> {
    if (process.env.NODE_ENV === "production") {
        throw new Error("Development sample data cannot be seeded in production mode.");
    }
    validateSeedingConfig(options.config);
    if (!Number.isFinite(options.now.valueOf()) || !path.isAbsolute(options.assetDirectory)) {
        throw new Error("Seeding requires a valid reference time and an absolute upload directory.");
    }
    await database.$transaction(requireFreshSeedDatabase);
    await initializeAccessControl(database);
    const hashedPassword = await SecurePassword.hash(developmentPassword);
    await database.$transaction(async db => {
        await requireFreshSeedDatabase(db);
        const locales = new Map<SeedLocale, number>();
        for (const tag of ["en-US", "fr-BE", "nl-BE"] as const) {
            locales.set(tag, (await db.locale.findUniqueOrThrow({ where: { ietfTag: tag } })).id);
        }
        const platform = await seedPlatformCatalogs(db, locales);
        const people = await seedPeople(db, options.config, hashedPassword);
        const roles = new Map((await db.bandRole.findMany({ where: { isDeleted: false }, include: {
            name: { include: { values: { where: { localeId: locales.get("en-US")! } } } },
        } })).map(role => [role.name.values[0]!.indexedValue!, role.id]));
        for (const required of ["Band Admin", "Normal Users", "Limited Users"]) {
            if (!roles.has(required)) {
                throw new Error(`Missing initialized seed role: ${required}.`);
            }
        }
        const visibilityPermissionIds = (await db.permission.findMany({ where: { isVisibility: true } })).map(permission => permission.id);
        for (let index = 0; index < options.config.bands; index++) {
            const band = await seedBand(db, platform, people, locales, roles, options.config.bands, index);
            const state: SeedingState = { db, ...options, locales, platform, band, visibilityPermissionIds };
            const songs = await seedSongs(state, distributeSeedCount(options.config.songCount, options.config.bands, index));
            await seedBandSampleFiles(state, songs[0]?.id ?? null);
            const pages = await seedWikiPages(state, distributeSeedCount(options.config.wikiPageCount, options.config.bands, index));
            const events = await seedEvents(state, songs);
            await seedActivity(state, songs, events, pages);
            console.log(`Seeded ${band.title}: ${band.members.length} members, ${songs.length} songs, ${events.length} events.`);
        }
    }, { isolationLevel: "Serializable", timeout: 600_000 });
    console.log(`Development login: admin@demo.invalid, shared@demo.invalid, manager1@demo.invalid, member1-1@demo.invalid. Password: ${developmentPassword}`);
}

export async function runDatabaseSeed(database: PrismaClient): Promise<void> {
    if (process.env.NODE_ENV === "production") {
        await initializeAccessControl(database);
        return;
    }
    const uploads = process.env.FILE_UPLOAD_PATH;
    if (!uploads) {
        throw new Error("Configure FILE_UPLOAD_PATH for the normal development server before resetting the database.");
    }
    await seedDevelopmentDatabase(database, { config: defaultSeedingConfig, now: new Date(), assetDirectory: path.resolve(uploads) });
}
