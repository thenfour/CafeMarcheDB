import { PrismaClient } from "@prisma/client";
import { SecurePassword } from "@blitzjs/auth/secure-password";
import { spawnSync } from "child_process";
import { readFile } from "fs/promises";
import path from "path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { defaultSeedingConfig } from "../db/seeding/config";
import { runDatabaseSeed, seedDevelopmentDatabase } from "../db/seeding/seed";
import { developmentPassword } from "../db/seeding/people";
import { calculateEventDateBoundsUpdatePatch } from "../src/server/dateTime";
import { getBandDateTimeFields } from "../shared/dateTimePolicy";

const testUrl = process.env.DEVELOPMENT_SEED_TEST_DATABASE_URL;
if (testUrl) {
    const target = new URL(testUrl);
    if (target.protocol !== "mysql:" || !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)
        || !/^\/cmdb_seed_test_[a-f0-9]+$/.test(target.pathname)) {
        throw new Error("Seed integration tests require a disposable local cmdb_seed_test_<hex> database.");
    }
}

describe.skipIf(!testUrl)("restored development seeding on MySQL", () => {
    const database = new PrismaClient(testUrl ? { datasourceUrl: testUrl } : undefined);
    const assetDirectory = path.resolve("temp/seed-test-assets", testUrl ? new URL(testUrl).pathname.slice(1) : "unused");
    const now = new Date("2026-10-09T12:00:00Z");
    const config = { ...defaultSeedingConfig, userCount: 16, songCount: 12, wikiPageCount: 4, monthsBeforeNow: 2, monthsAfterNow: 1 };
    function resetDatabase(): void {
        const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "reset", "--force", "--skip-generate", "--skip-seed"], {
            env: { ...process.env, DATABASE_URL: testUrl, NODE_ENV: "test" }, encoding: "utf8", windowsHide: true, timeout: 120_000,
        });
        if (result.status !== 0) {
            throw new Error(`Seed test reset failed: ${result.error?.message ?? result.stderr}`);
        }
    }
    beforeAll(async () => {
        resetDatabase();
        await seedDevelopmentDatabase(database, { config, now, assetDirectory });
    }, 180_000);
    afterAll(() => database.$disconnect());

    it("retains the full fixed catalogs and real catalog inheritance", async () => {
        expect(await database.globalInstrument.count()).toBe(23);
        expect(await database.globalInstrumentFunctionalGroup.count()).toBe(23);
        expect(await database.globalSongTag.count()).toBe(7);
        expect(await database.eventType.count()).toBe(4);
        expect(await database.eventStatus.count()).toBe(5);
        expect(await database.eventAttendance.count()).toBe(4);
        expect(await database.songCreditType.count()).toBe(3);
        expect(await database.globalWikiPageTag.count()).toBe(6);
        const instruments = await database.bandInstrument.findMany({ include: { functionalGroup: true, globalInstrument: true } });
        expect(instruments.filter(row => row.globalInstrumentId !== null)).toHaveLength(46);
        expect(instruments.filter(row => row.globalInstrumentId === null)).toHaveLength(2);
        for (const instrument of instruments) {
            expect(instrument.functionalGroup.bandId).toBe(instrument.bandId);
            if (instrument.globalInstrumentId !== null) {
                expect(instrument.nameId).toBeNull();
                expect(instrument.descriptionId).toBeNull();
                expect(instrument.sortOrder).toBeNull();
            }
        }
        const overrides = await database.bandDynamicLocalizedStringValue.findMany({ include: { string: { include: { values: true } } } });
        expect(overrides.some(row => row.indexedValue === "Cornet de la fanfare" && row.string.values.some(value => value.indexedValue === "Trumpet"))).toBe(true);
        expect(overrides.some(row => row.blobValue === "")).toBe(true);
        const locales = await database.band.findMany({ include: { locales: true } });
        expect(locales.map(band => band.locales.length).sort()).toEqual([2, 3]);
    });

    it("creates the original special users and working demo sign-ins across bands", async () => {
        expect(await database.user.count()).toBe(config.userCount);
        expect(await database.song.count()).toBe(config.songCount);
        const shared = await database.user.findFirstOrThrow({ where: { email: "shared@demo.invalid" }, include: { bandUsersByUser: true, signInMethods: true } });
        expect(shared.bandUsersByUser).toHaveLength(2);
        expect(new Set(shared.bandUsersByUser.map(member => member.bandRoleId)).size).toBe(2);
        expect(shared.signInMethods.some(method => method.type === "email" && method.identifier === shared.email)).toBe(true);
        expect(await SecurePassword.verify(shared.hashedPassword!, developmentPassword)).toBe(SecurePassword.VALID);
        for (const email of ["carlco@gmail.com", "peter@gmail.com", "guido@gmail.com"]) {
            const special = await database.user.findFirstOrThrow({ where: { email }, include: { globalRole: true, signInMethods: true } });
            expect(special.globalRole?.isSysAdminRole).toBe(true);
            expect(special.signInMethods.some(method => method.identifier === `GOOGLE_FIRST_TIME_INSTALL_USER_EMAIL:${email}`)).toBe(true);
        }
        for (const email of ["member1-1@demo.invalid", "member2-1@demo.invalid"]) {
            const member = await database.user.findFirstOrThrow({ where: { email }, include: { bandUsersByUser: true } });
            expect(member.bandUsersByUser).toHaveLength(1);
        }
    });

    it("keeps event bounds, local rehearsal times and response/setlist ownership valid", async () => {
        const cancelled = (await database.eventStatus.findMany({ where: { significance: "Cancelled" } })).map(status => status.id);
        const events = await database.event.findMany({ include: { segments: true, responses: { include: { bandUser: true, bandInstrument: true } },
            songLists: { include: { songs: { include: { song: true } } } }, descriptionWikiPage: true } });
        expect(events.length).toBeGreaterThan(30);
        for (const event of events) {
            expect(event.createdAt <= now).toBe(true);
            if (event.startsAt) {
                expect(event.createdAt <= event.startsAt).toBe(true);
            }
            const bounds = await calculateEventDateBoundsUpdatePatch(database, event.id, cancelled);
            expect(event).toMatchObject({ ...bounds, durationMillis: BigInt(bounds.durationMillis) });
            expect(event.segments.every(segment => segment.dateTimeVersion === 2)).toBe(true);
            expect(event.responses.every(response => response.bandUser.bandId === event.bandId && (!response.bandInstrument || response.bandInstrument.bandId === event.bandId))).toBe(true);
            expect(event.songLists.every(list => list.songs.every(item => item.song.bandId === event.bandId))).toBe(true);
            if (event.name === "Rehearsal") {
                expect(getBandDateTimeFields(event.segments[0]!.startsAt!, "Europe/Brussels").time).toMatch(/^20:00/);
            }
            if (event.descriptionWikiPage) {
                expect(event.descriptionWikiPage).toMatchObject({ bandId: event.bandId, slug: `EventDescription/${event.publicId}`, namespace: "EventDescription" });
            }
        }
        const attendance = await database.eventSegmentUserResponse.findMany({ include: { bandUser: true, eventSegment: { include: { event: true } } } });
        expect(attendance.every(response => response.bandUser.bandId === response.eventSegment.event.bandId)).toBe(true);
        expect(attendance.every(response => response.createdAt >= response.bandUser.createdAt
            && response.createdAt >= response.eventSegment.event.createdAt && response.createdAt <= now)).toBe(true);
    });

    it("writes real file bytes and coherent wiki/activity references", async () => {
        const files = await database.file.findMany({ include: { taggedSongs: { include: { song: true } }, taggedEvents: { include: { event: true } } } });
        expect(files.length).toBeGreaterThan(4);
        for (const file of files) {
            expect(file.uploadedAt <= now).toBe(true);
            if (file.fileCreatedAt) {
                expect(file.fileCreatedAt <= file.uploadedAt).toBe(true);
            }
            expect((await readFile(path.join(assetDirectory, file.storedLeafName))).length).toBe(file.sizeBytes);
            expect(file.taggedSongs.every(link => link.song.bandId === file.bandId)).toBe(true);
            expect(file.taggedEvents.every(link => link.event.bandId === file.bandId)).toBe(true);
        }
        const pages = await database.wikiPage.findMany({ include: { currentRevision: true, revisions: true } });
        for (const page of pages) {
            expect(page.createdAt).not.toBeNull();
            expect(page.revisions.every(revision => page.createdAt && page.createdAt <= revision.createdAt && revision.createdAt <= now)).toBe(true);
            expect(page.currentRevision?.wikiPageId).toBe(page.id);
            expect(page.currentRevision!.createdAt.valueOf()).toBe(Math.max(...page.revisions.map(revision => revision.createdAt.valueOf())));
        }
        const actions = await database.action.findMany({ include: { event: true, song: true, wikiPage: true } });
        expect(actions.length).toBeGreaterThan(100);
        for (const action of actions) {
            expect(action.createdAt <= now).toBe(true);
            expect(!action.event || action.event.bandId === action.bandId).toBe(true);
            expect(!action.song || action.song.bandId === action.bandId).toBe(true);
            expect(!action.wikiPage || action.wikiPage.bandId === action.bandId).toBe(true);
        }
    });

    it("varies account, membership and content dates while preserving their chronology", async () => {
        const users = await database.user.findMany();
        const members = await database.bandUser.findMany({ include: { user: true, band: true } });
        const events = await database.event.findMany();
        expect(new Set(users.map(user => user.createdAt.valueOf())).size).toBe(users.length);
        expect(new Set(members.map(member => member.createdAt.valueOf())).size).toBe(members.length);
        expect(new Set(events.map(event => event.createdAt.valueOf())).size).toBe(events.length);
        for (const member of members) {
            expect(member.user.createdAt <= member.createdAt && member.band.createdAt <= member.createdAt && member.createdAt <= now).toBe(true);
        }
        for (const event of events) {
            expect(event.createdAt <= now).toBe(true);
            const creator = members.find(member => member.bandId === event.bandId && member.userId === event.createdByUserId);
            expect(creator && creator.createdAt <= event.createdAt).toBe(true);
        }
    });

    it("rejects reseeding a populated database before modifying its content", async () => {
        const before = await database.file.count();
        await expect(seedDevelopmentDatabase(database, { config, now, assetDirectory })).rejects.toThrow("fresh database");
        expect(await database.file.count()).toBe(before);
        expect(await database.user.count()).toBe(config.userCount);
    });

    it("keeps production seeding limited to access-control foundations", async () => {
        vi.stubEnv("NODE_ENV", "production");
        try {
            await expect(seedDevelopmentDatabase(database, { config, now, assetDirectory })).rejects.toThrow("production");
            await runDatabaseSeed(database);
            expect(await database.user.count()).toBe(config.userCount);
            expect(await database.song.count()).toBe(config.songCount);
        } finally {
            vi.unstubAllEnvs();
        }
    });

    it("supports three bands with empty song/event/wiki content pools", async () => {
        resetDatabase();
        await seedDevelopmentDatabase(database, { assetDirectory, now, config: {
            ...config, bands: 3, songCount: 0, wikiPageCount: 0, monthsBeforeNow: 0, monthsAfterNow: 0,
        } });
        expect(await database.band.count()).toBe(3);
        expect(await database.user.count()).toBe(config.userCount);
        expect(await database.song.count()).toBe(0);
        expect(await database.event.count()).toBe(0);
        expect(await database.file.count()).toBe(6);
        expect(await database.wikiPage.count()).toBe(8);
        expect(await database.customLink.count()).toBe(6);
    }, 120_000);
});
