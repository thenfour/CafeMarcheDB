import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { initializeAccessControl } from "src/setup/accessControl";
import { generatePublicId } from "src/server/publicId";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { readSetlistSong } from "src/core/db3/server/setlistSongRead";
import { createCommandRowServices } from "src/core/db3/server/db3CommandCore";
import { xSong } from "src/core/db3/shared/schema/song";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

async function seedLookup(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
    const band = fixture.bands[0]!;
    const visibility = await tx.permission.findUniqueOrThrow({ where: { name: Permission.visibility_members } });
    const file = await tx.file.create({ data: {
        publicId: generatePublicId(), bandId: band.id, uploadedByUserId: fixture.user.id,
        fileLeafName: "existing.mp3", storedLeafName: "existing.mp3", uploadedAt: new Date(), description: "",
        visiblePermissionId: visibility.id,
    } });
    const song = await tx.song.create({ data: {
        publicId: generatePublicId(), bandId: band.id, name: "Lookup tune", aliases: "Alias", description: "",
        startBPM: 100, endBPM: 120, lengthSeconds: 180, introducedYear: 2025,
        visiblePermissionId: visibility.id, createdByUserId: fixture.user.id, pinnedRecordingId: file.id,
    } });
    const tag = await tx.bandSongTag.create({ data: { publicId: generatePublicId(), bandId: band.id } });
    const association = await tx.bandSongTagAssociation.create({ data: {
        publicId: generatePublicId(), songId: song.id, bandSongTagId: tag.id,
    } });
    const bandPublicId = parsePublicId<"Band">(band.publicId);
    const auth = await loadAuthorizationForUser(fixture.user, tx, bandPublicId);
    const snapshot = await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });
    const args = { bandPublicId, id: parsePublicId<"Song">(song.publicId) };
    return { auth, snapshot, args, song, tag, association, file, visibility };
}

describe.skipIf(!settingsMysqlTestUrl)("band-scoped setlist song lookup on MariaDB", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasources: { db: { url: settingsMysqlTestUrl } } } : undefined);
    beforeAll(() => initializeAccessControl(database), 30_000);
    afterAll(() => database.$disconnect());
    const withFixture = (work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) =>
        withSettingsMysqlFixture(database, work);

    it("returns complete setlist details and public references without internal IDs or authorization support", () => withFixture(async (tx, fixture) => {
        const c = await seedLookup(tx, fixture);
        const result = await readSetlistSong(c.snapshot, c.auth, c.args);
        expect(result).toEqual({ matchingItem: {
            publicId: c.song.publicId, name: "Lookup tune", aliases: "Alias", startBPM: 100, endBPM: 120,
            lengthSeconds: 180, introducedYear: 2025, pinnedRecordingId: c.file.publicId,
            tags: [{ publicId: c.association.publicId, songId: c.song.publicId, bandSongTagId: c.tag.publicId }],
        } });
    }));

    it("omits hidden and foreign-band tags even for administrators", () => withFixture(async (tx, fixture) => {
        const c = await seedLookup(tx, fixture);
        for (const data of [{ bandId: fixture.bands[0]!.id, isHidden: true }, { bandId: fixture.bands[1]!.id }]) {
            const tag = await tx.bandSongTag.create({ data: { publicId: generatePublicId(), ...data } });
            await tx.bandSongTagAssociation.create({ data: { publicId: generatePublicId(), songId: c.song.id, bandSongTagId: tag.id } });
        }
        expect((await readSetlistSong(c.snapshot, c.auth, c.args)).matchingItem?.tags).toEqual([
            { publicId: c.association.publicId, songId: c.song.publicId, bandSongTagId: c.tag.publicId },
        ]);
    }));

    it("returns null for another band, a missing ID and deleted songs", () => withFixture(async (tx, fixture) => {
        const c = await seedLookup(tx, fixture);
        expect(await readSetlistSong(c.snapshot, c.auth, { ...c.args, id: generatePublicId<"Song">() })).toEqual({ matchingItem: null });
        await tx.song.update({ where: { id: c.song.id }, data: { bandId: fixture.bands[1]!.id } });
        expect(await readSetlistSong(c.snapshot, c.auth, c.args)).toEqual({ matchingItem: null });
        await tx.song.update({ where: { id: c.song.id }, data: { bandId: fixture.bands[0]!.id, isDeleted: true } });
        expect(await readSetlistSong(c.snapshot, c.auth, c.args)).toEqual({ matchingItem: null });
    }));

    it("keeps private song access owner-only and honors the exact requested identity", () => withFixture(async (tx, fixture) => {
        const c = await seedLookup(tx, fixture);
        await tx.song.update({ where: { id: c.song.id }, data: { visiblePermissionId: null } });
        expect((await readSetlistSong(c.snapshot, c.auth, c.args)).matchingItem?.publicId).toBe(c.song.publicId);
        await tx.song.update({ where: { id: c.song.id }, data: { createdByUserId: fixture.admin.id } });
        expect(await readSetlistSong(c.snapshot, c.auth, c.args)).toEqual({ matchingItem: null });
    }));

    it("requires the song's visibility grant in addition to view_songs", () => withFixture(async (tx, fixture) => {
        const c = await seedLookup(tx, fixture);
        const member = await tx.bandUser.findUniqueOrThrow({ where: { bandId_userId: { bandId: fixture.bands[0]!.id, userId: fixture.user.id } } });
        await tx.bandRolePermission.deleteMany({ where: { bandRoleId: member.bandRoleId!, permissionId: c.visibility.id } });
        expect(await readSetlistSong(c.snapshot, c.auth, c.args)).toEqual({ matchingItem: null });
    }));

    it("checks pinned File visibility, deletion and ownership independently without hiding the song", () => withFixture(async (tx, fixture) => {
        const c = await seedLookup(tx, fixture);
        const fileStates: Prisma.FileUpdateInput[] = [
            { isDeleted: true },
            { isDeleted: false, band: { connect: { id: fixture.bands[1]!.id } } },
            { band: { connect: { id: fixture.bands[0]!.id } }, visiblePermission: { disconnect: true }, uploadedByUser: { connect: { id: fixture.admin.id } } },
        ];
        for (const data of fileStates) {
            await tx.file.update({ where: { id: c.file.id }, data });
            expect((await readSetlistSong(c.snapshot, c.auth, c.args)).matchingItem).toMatchObject({ publicId: c.song.publicId, pinnedRecordingId: null });
        }
        await tx.file.update({ where: { id: c.file.id }, data: { uploadedByUserId: fixture.user.id } });
        expect((await readSetlistSong(c.snapshot, c.auth, c.args)).matchingItem?.pinnedRecordingId).toBe(c.file.publicId);
        const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.visibility_editors } });
        await tx.file.update({ where: { id: c.file.id }, data: { visiblePermissionId: permission.id } });
        const member = await tx.bandUser.findUniqueOrThrow({ where: { bandId_userId: { bandId: fixture.bands[0]!.id, userId: fixture.user.id } } });
        await tx.bandRolePermission.deleteMany({ where: { bandRoleId: member.bandRoleId!, permissionId: permission.id } });
        expect((await readSetlistSong(c.snapshot, c.auth, c.args)).matchingItem?.pinnedRecordingId).toBeNull();
    }));

    it("refreshes grants and membership before reading, including empty selections", () => withFixture(async (tx, fixture) => {
        const c = await seedLookup(tx, fixture);
        expect(await readSetlistSong(c.snapshot, c.auth, { ...c.args, id: null })).toEqual({ matchingItem: null });
        await tx.bandUser.update({ where: { bandId_userId: { bandId: fixture.bands[0]!.id, userId: fixture.user.id } }, data: { bandRoleId: null } });
        await expect(readSetlistSong(c.snapshot, c.auth, c.args)).rejects.toThrow();
        await expect(readSetlistSong(c.snapshot, c.auth, { ...c.args, id: null })).rejects.toThrow();
    }));

    it.each(["deleted", "merged"] as const)("rejects a %s account from an earlier authorization snapshot", state => withFixture(async (tx, fixture) => {
        const c = await seedLookup(tx, fixture);
        await tx.user.update({ where: { id: fixture.user.id }, data: state === "deleted" ? { isDeleted: true } : { mergedIntoUserId: fixture.admin.id } });
        await expect(readSetlistSong(c.snapshot, c.auth, c.args)).rejects.toThrow();
    }));

    it("requires matching explicit band context and authentication, even for platform administrators", () => withFixture(async (tx, fixture) => {
        const c = await seedLookup(tx, fixture);
        await expect(readSetlistSong(c.snapshot, c.auth, { ...c.args, bandPublicId: parsePublicId<"Band">(fixture.bands[1]!.publicId) })).rejects.toThrow("selected band");
        for (const user of [null, fixture.admin]) {
            const auth = await loadAuthorizationForUser(user, tx);
            const snapshot = await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });
            await expect(readSetlistSong(snapshot, auth, c.args)).rejects.toThrow();
        }
        await expect(createCommandRowServices(c.auth, tx).insert(xSong, {})).rejects.toThrow();
    }));
});
