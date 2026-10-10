import { PrismaClient } from "@prisma/client";
import { SecurePassword } from "@blitzjs/auth/secure-password";
import { spawnSync } from "child_process";
import { readFile } from "fs/promises";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { demoId, demoPassword } from "../db/seeding/demo/config";

const testUrl = process.env.DEMO_TEST_DATABASE_URL;
if (testUrl) {
    const target = new URL(testUrl);
    if (!["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) || !/^\/cmdb_demo_test_[a-f0-9]+$/.test(target.pathname)) {
        throw new Error("Demo integration tests require a disposable local cmdb_demo_test_<hex> database.");
    }
}

describe.skipIf(!testUrl)("demo reset and generators on MySQL", () => {
    const database = new PrismaClient(testUrl ? { datasourceUrl: testUrl } : undefined);
    const assetDirectory = testUrl ? path.resolve("temp/demo-assets", new URL(testUrl).pathname.slice(1)) : "";
    function reset(args: string[] = []) {
        const result = spawnSync(process.execPath, ["scripts/demo.cjs", "reset", "--date=2026-10-08", ...args], {
            env: { ...process.env, DEMO_DATABASE_URL: testUrl, NODE_ENV: "test" }, encoding: "utf8", windowsHide: true, timeout: 120_000,
        });
        if (result.status !== 0) {
            throw new Error(`Demo reset failed: ${result.error?.message ?? result.stderr}`);
        }
    }
    beforeAll(() => reset(), 120_000);
    afterAll(() => database.$disconnect());

    it("creates authenticated people with genuinely different band memberships and grants", async () => {
        const shared = await database.user.findUniqueOrThrow({ where: { publicId: demoId({ seed: 104 }, "person:shared") },
            include: { signInMethods: true, bandUsersByUser: { include: { bandRole: { include: { bandRolePermissions: { include: { permission: true } } } } } } } });
        expect(shared.globalRoleId).toBeNull();
        expect(shared.signInMethods[0]?.identifier).toBe("shared@demo.invalid");
        expect(await SecurePassword.verify(shared.hashedPassword!, demoPassword)).toBe(SecurePassword.VALID);
        const canManage = shared.bandUsersByUser.map(member => member.bandRole!.bandRolePermissions.some(grant => grant.permission.name === "manage_users"));
        expect(canManage.filter(Boolean)).toHaveLength(1);
        expect(shared.bandUsersByUser).toHaveLength(2);
        expect(await database.bandUser.count()).toBe(16);
        const ordinary = await database.user.findFirstOrThrow({ where: { email: "member1-1@demo.invalid" }, include: { bandUsersByUser: true } });
        expect(ordinary.bandUsersByUser).toHaveLength(1);
    });

    it("keeps translations, enabled locales, overrides and intentional blanks distinct", async () => {
        const river = await database.band.findUniqueOrThrow({ where: { publicId: demoId({ seed: 104 }, "band:1") } });
        const harbour = await database.band.findUniqueOrThrow({ where: { publicId: demoId({ seed: 104 }, "band:2") } });
        expect(await database.bandLocale.count({ where: { bandId: river.id } })).toBe(3);
        expect(await database.bandLocale.count({ where: { bandId: harbour.id } })).toBe(2);
        const blank = await database.bandDynamicLocalizedStringValue.findUniqueOrThrow({ where: { publicId: demoId({ seed: 104 }, "band:1:description-blank-fr") } });
        expect(blank.blobValue).toBe("");
        expect(await database.bandDynamicLocalizedStringValue.count({ where: { bandId: harbour.id } })).toBe(0);
        const drums = await database.globalInstrument.findUniqueOrThrow({ where: { publicId: demoId({ seed: 104 }, "instrument:drums") },
            include: { name: { include: { values: { include: { locale: true } } } } } });
        expect(drums.name.values.map(value => value.locale.ietfTag).sort()).toEqual(["en-US", "fr-BE"]);
    });

    it("keeps event responses, instruments, setlists and files inside their band", async () => {
        const now = new Date("2026-10-08T12:00:00Z");
        const events = await database.event.findMany({ include: { segments: true, descriptionWikiPage: true, responses: { include: { bandUser: true, bandInstrument: true } },
            songLists: { include: { songs: { include: { song: true } } } } } });
        expect(events).toHaveLength(10);
        for (const event of events) {
            expect(event.createdAt <= now && event.createdAt <= event.startsAt!).toBe(true);
            expect(event.endDateTime!.getTime() - event.startsAt!.getTime()).toBe(Number(event.durationMillis));
            expect(event.segments[0]?.dateTimeVersion).toBe(2);
            expect(event.descriptionWikiPage).toMatchObject({ bandId: event.bandId, namespace: "EventDescription", slug: `EventDescription/${event.publicId}` });
            expect(event.responses).toHaveLength(8);
            expect(event.responses.every(response => response.bandUser.bandId === event.bandId && response.bandInstrument!.bandId === event.bandId)).toBe(true);
            expect(event.songLists[0]?.songs.every(item => item.song.bandId === event.bandId)).toBe(true);
        }
        expect(await database.eventSegmentUserResponse.count({ where: { attendanceId: null } })).toBe(10);
        const files = await database.file.findMany({ include: { taggedSongs: { include: { song: true } } } });
        expect(files).toHaveLength(4);
        expect(await database.customLink.count({ where: { redirectType: "ServeFile", fileId: { not: null } } })).toBe(4);
        for (const file of files) {
            expect(file.uploadedAt <= now).toBe(true);
            const data = await readFile(path.join(assetDirectory, file.storedLeafName));
            expect(data.length).toBe(file.sizeBytes);
            expect(file.taggedSongs.every(link => link.song.bandId === file.bandId)).toBe(true);
        }
    });

    it("seeds different account and band join dates with chronological wiki history", async () => {
        const now = new Date("2026-10-08T12:00:00Z");
        const users = await database.user.findMany();
        const members = await database.bandUser.findMany({ include: { user: true, band: true } });
        expect(new Set(users.map(user => user.createdAt.valueOf())).size).toBe(users.length);
        expect(new Set(members.map(member => member.createdAt.valueOf())).size).toBe(members.length);
        for (const member of members) {
            expect(member.user.createdAt < member.createdAt && member.band.createdAt <= member.createdAt && member.createdAt <= now).toBe(true);
        }
        const sharedMemberships = members.filter(member => member.user.email === "shared@demo.invalid");
        expect(sharedMemberships[0]?.createdAt).not.toEqual(sharedMemberships[1]?.createdAt);
        for (const page of await database.wikiPage.findMany({ include: { revisions: true } })) {
            expect(page.revisions.every(revision => page.createdAt && page.createdAt <= revision.createdAt && revision.createdAt <= now)).toBe(true);
        }
        expect((await database.action.findMany()).every(action => action.createdAt <= now)).toBe(true);
        const responses = await database.eventSegmentUserResponse.findMany({ include: { bandUser: true, eventSegment: { include: { event: true } } } });
        expect(responses.every(response => response.createdAt >= response.bandUser.createdAt
            && response.createdAt >= response.eventSegment.event.createdAt && response.createdAt <= now)).toBe(true);
    });

    it("repeats a reset with the same identities and removes manual edits", async () => {
        const before = await database.song.findMany({ select: { publicId: true, name: true, startBPM: true }, orderBy: { publicId: "asc" } });
        const beforeMembers = await database.bandUser.findMany({ select: { publicId: true, createdAt: true }, orderBy: { publicId: "asc" } });
        const beforeUsers = await database.user.findMany({ select: { publicId: true, createdAt: true }, orderBy: { publicId: "asc" } });
        await database.song.update({ where: { publicId: before[0]!.publicId }, data: { name: "Manual test edit" } });
        reset();
        expect(await database.song.findMany({ select: { publicId: true, name: true, startBPM: true }, orderBy: { publicId: "asc" } })).toEqual(before);
        expect(await database.bandUser.findMany({ select: { publicId: true, createdAt: true }, orderBy: { publicId: "asc" } })).toEqual(beforeMembers);
        expect(await database.user.findMany({ select: { publicId: true, createdAt: true }, orderBy: { publicId: "asc" } })).toEqual(beforeUsers);
    }, 120_000);

    it("leaves populated data intact when options or database selection are rejected", async () => {
        const before = await database.bandUser.count();
        for (const [args, sameApplication] of [["--bands=0", false], ["--bands=2", true]] as const) {
            const result = spawnSync(process.execPath, ["scripts/demo.cjs", "reset", args], {
                env: { ...process.env, DEMO_DATABASE_URL: testUrl, NODE_ENV: "test", ...(sameApplication ? { DATABASE_URL: testUrl } : {}) },
                encoding: "utf8", windowsHide: true, timeout: 30_000,
            });
            expect(result.status).toBe(1);
            expect(await database.bandUser.count()).toBe(before);
        }
    }, 60_000);

    it("honors custom counts, seed, languages and zero-song/event configurations", async () => {
        reset(["--bands=3", "--members-per-band=3", "--songs-per-band=0", "--events-per-band=0", "--locales=en-US,nl-BE", "--seed=42"]);
        expect(await database.band.count()).toBe(3);
        expect(await database.bandUser.count()).toBe(9);
        expect(await database.song.count()).toBe(0);
        expect(await database.event.count()).toBe(0);
        expect(await database.file.count()).toBe(6);
        expect(await database.wikiPage.count()).toBe(6);
        expect(await database.band.findUnique({ where: { publicId: demoId({ seed: 42 }, "band:3") } })).not.toBeNull();
    }, 120_000);
});
