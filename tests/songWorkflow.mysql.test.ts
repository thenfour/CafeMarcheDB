import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { QuickSearchItemType } from "shared/quickFilter";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { createCommandRowServices } from "src/core/db3/server/db3CommandCore";
import { queryView } from "src/core/db3/server/db3QueryCore";
import { readSongDetailPage } from "src/core/db3/server/songDetailPage";
import { updateSongBasicFields, updateSongPinnedRecording, UpdateSongBasicFieldsSchema } from "src/core/db3/server/songEditing";
import { GetSearchResultsCore } from "src/core/db3/server/searchServerCore";
import { getQuickSearchResults } from "src/core/db3/server/quickSearchServerCore";
import { songDetailView, songEditorView, xSong } from "src/core/db3/db3";
import { DiscreteCriterionFilterType as Behavior } from "src/core/db3/shared/apiTypes";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl } from "src/setup/accessControl";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

import { prepareSongs } from "./support/songWorkflowMysqlFixture";

describe.skipIf(!settingsMysqlTestUrl)("restored song workflows on MariaDB", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasourceUrl: settingsMysqlTestUrl } : undefined);
    beforeAll(async () => { vi.stubEnv("CMDB_BASE_URL", "https://song.test.invalid"); await initializeAccessControl(database); }, 30_000);
    afterAll(async () => { vi.unstubAllEnvs(); await database.$disconnect(); });
    const run = (work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) => withSettingsMysqlFixture(database, work);

    it("preserves visible rows, counts, inherited facets and public transport in each band", () => run(async (tx, fixture) => {
        const c = await prepareSongs(tx, fixture);
        const result = await c.search();
        expect(result.results.map(song => song.name)).toEqual(["Alpha", "Bravo", "Charlie", "Delta"]);
        expect(result.rowCount).toBe(4);
        expect(result.facets[0]!.items).toEqual([
            expect.objectContaining({ id: null, rowCount: 1 }),
            expect.objectContaining({ id: c.secondTag.publicId, label: "March", rowCount: 2 }),
            expect.objectContaining({ id: c.firstTag.publicId, label: "Concert", color: "green", rowCount: 2 }),
        ]);
        expect(result.results[3]!.tags).toEqual([]);
        expect(JSON.stringify(result.results)).not.toMatch(/"(?:id|bandId|userId|email|phone|nameId)":/);
        await tx.bandUser.update({ where: { bandId_userId: { bandId: fixture.bands[1]!.id, userId: fixture.user.id } }, data: { bandRoleId: c.role.id } });
        const otherBand = parsePublicId<"Band">(fixture.bands[1]!.publicId);
        const auth = await loadAuthorizationForUser(fixture.user, tx, otherBand);
        const other = await GetSearchResultsCore(c.query({ bandPublicId: otherBand }), auth, await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" }));
        expect(other.results.map(song => song.publicId)).toEqual([c.foreign.publicId]);
        expect(other.facets[0]!.items.map(item => item.id)).not.toContain(c.firstTag.publicId);
    }));

    it.each([
        { behavior: Behavior.hasSomeOf, indexes: [0], names: ["Alpha", "Charlie"] },
        { behavior: Behavior.hasAllOf, indexes: [0, 1], names: ["Charlie"] },
        { behavior: Behavior.doesntHaveAnyOf, indexes: [0], names: ["Bravo", "Delta"] },
        { behavior: Behavior.doesntHaveAllOf, indexes: [0, 1], names: ["Alpha", "Bravo", "Delta"] },
        { behavior: Behavior.hasAny, indexes: [], names: ["Alpha", "Bravo", "Charlie"] },
        { behavior: Behavior.hasNone, indexes: [], names: ["Delta"] },
        { behavior: Behavior.alwaysMatch, indexes: [], names: ["Alpha", "Bravo", "Charlie", "Delta"] },
    ])("preserves tag operator $behavior", ({ behavior, indexes, names }) => run(async (tx, fixture) => {
        const c = await prepareSongs(tx, fixture);
        const result = await c.search({ discreteCriteria: [{ db3Column: "tags", behavior, options: indexes.map(index => [c.firstTag, c.secondTag][index]!.publicId) }] });
        expect(result.results.map(song => song.name)).toEqual(names);
        expect(result.rowCount).toBe(names.length);
    }));

    it("retains authored text, stable sorting and paging, and localized blanks", () => run(async (tx, fixture) => {
        const c = await prepareSongs(tx, fixture);
        expect((await c.search({ quickFilter: "harbour waltz" })).results.map(song => song.name)).toEqual(["Alpha", "Charlie"]);
        const first = await c.search({ take: 2, sort: [{ db3Column: "startBPM", direction: "desc" }] });
        const next = await c.search({ offset: 2, take: 2, sort: [{ db3Column: "startBPM", direction: "desc" }] });
        expect([...first.results, ...next.results].map(song => song.name)).toEqual(["Delta", "Charlie", "Bravo", "Alpha"]);
        expect(first.rowCount).toBe(4);
        const blank = await c.text("Local name", "");
        await tx.bandSongTag.update({ where: { id: c.firstTag.id }, data: { nameId: blank.id } });
        const result = await c.search({ routeLocale: "fr-BE" });
        expect(result.facets[0]!.items.find(item => item.id === c.firstTag.publicId)).toMatchObject({ label: "", tooltip: "Description francaise" });
        for (const tag of [c.hiddenTag, c.foreignTag]) {
            await expect(c.search({ discreteCriteria: [{ db3Column: "tags", behavior: Behavior.hasAllOf, options: [tag.publicId] }] })).rejects.toThrow();
        }
    }));

    it("retains picker grammar, weighted relevance, public identities and contextual links", () => run(async (tx, fixture) => {
        const c = await prepareSongs(tx, fixture);
        const results = await c.quick("s:harbour waltz");
        expect(results.map(result => result.id)).toEqual([c.songs[0]!.publicId, c.songs[2]!.publicId]);
        expect(results[0]!.matchStrength).toBeGreaterThan(results[1]!.matchStrength);
        expect(results[0]!.absoluteUri).toContain(`bandPublicId=${c.target.bandPublicId}`);
        expect(results[0]!.absoluteUri).toContain("routeLocale=fr-BE");
        expect(results[0]!.name).toContain("(2026)");
        expect(await c.quick("event:Alpha")).toEqual([]);
        expect(await c.quick("#Concert")).toEqual([]);
        expect((await c.quick("song:Alpha #Concert")).map(result => result.id)).toEqual([c.songs[0]!.publicId]);
        expect((await c.quick(c.songs[0]!.publicId)).map(result => result.id)).toEqual([c.songs[0]!.publicId]);
        expect(await c.quick("secret")).toEqual([]);
        await tx.song.createMany({ data: Array.from({ length: 20 }, (_, index) => ({ publicId: generatePublicId(), bandId: c.band.id, name: `Repeated ${index}`, aliases: "", description: "", visiblePermissionId: c.visibility.id })) });
        expect(await c.quick("Repeated")).toHaveLength(15);
    }));

    it("creates songs with their owner/band, edits fields/tags/description and writes audits", () => run(async (tx, fixture) => {
        const c = await prepareSongs(tx, fixture);
        const services = createCommandRowServices(c.auth, tx);
        const dto = songEditorView.crud.operations.create.command.parseDto({ name: "Created", aliases: "", description: "", visiblePermissionId: parsePublicId<"Permission">(c.visibility.publicId) });
        const created = await services.insert(xSong, dto);
        expect(created).toMatchObject({ bandId: c.band.id, createdByUserId: fixture.user.id });
        const update = songEditorView.crud.operations.update.command.parseDto({ identity: c.target.songId, patch: {
            name: "Renamed", startBPM: 123, tags: [parsePublicId<"SongTag">(c.secondTag.publicId)],
        } });
        await services.update(xSong, update.identity, update.patch);
        await updateSongBasicFields(c.root, c.auth, { ...c.target, description: "Saved markdown" });
        const stored = await tx.song.findUniqueOrThrow({ where: { id: c.songs[0]!.id }, include: { tags: true } });
        expect(stored).toMatchObject({ name: "Renamed", startBPM: 123, description: "Saved markdown", tags: [{ bandSongTagId: c.secondTag.id }] });
        expect(await tx.change.count({ where: { table: "Song", recordId: stored.id } })).toBeGreaterThan(0);
        for (const tag of [c.hiddenTag, c.foreignTag]) {
            await expect(c.root.$transaction(async transaction => createCommandRowServices(await c.auth.refresh(transaction), transaction).update(xSong, c.target.songId,
                { name: "Must roll back", tags: [parsePublicId<"SongTag">(tag.publicId)] }), { isolationLevel: "Serializable" })).rejects.toThrow();
        }
        expect((await tx.song.findUniqueOrThrow({ where: { id: stored.id } })).name).toBe("Renamed");
    }));

    it("shows the song independently of hidden/deleted/foreign recordings and validates pin writes", () => run(async (tx, fixture) => {
        const c = await prepareSongs(tx, fixture);
        const read = async () => queryView({ view: songDetailView, bandPublicId: c.target.bandPublicId, filter: { tableParams: { songId: c.target.songId } }, cmdbQueryContext: "song detail native" }, c.auth, await c.snapshot());
        expect((await read()).items[0]!.pinnedRecordingId).toBe(c.file.publicId);
        for (const data of [{ visiblePermissionId: null, uploadedByUserId: fixture.admin.id }, { isDeleted: true }, { bandId: fixture.bands[1]!.id }]) {
            await tx.file.update({ where: { id: c.file.id }, data: { isDeleted: false, bandId: c.band.id, uploadedByUserId: fixture.user.id, visiblePermissionId: c.visibility.id, ...data } });
            const detail = (await read()).items[0]!;
            expect(detail.publicId).toBe(c.target.songId);
            expect(detail.pinnedRecordingId).toBeNull();
            expect(detail.taggedFiles).toEqual([]);
            await expect(updateSongPinnedRecording(c.root, c.auth, { ...c.target, fileId: parsePublicId<"File">(c.file.publicId) })).rejects.toThrow();
        }
        await tx.file.update({ where: { id: c.file.id }, data: { isDeleted: false, bandId: c.band.id, uploadedByUserId: fixture.user.id, visiblePermissionId: c.visibility.id } });
        await updateSongPinnedRecording(c.root, c.auth, { ...c.target, fileId: null });
        expect((await tx.song.findUniqueOrThrow({ where: { id: c.songs[0]!.id } })).pinnedRecordingId).toBeNull();
        await updateSongPinnedRecording(c.root, c.auth, { ...c.target, fileId: parsePublicId<"File">(c.file.publicId) });
        expect((await read()).items[0]!.pinnedRecordingId).toBe(c.file.publicId);
    }));

    it("returns 404 metadata for private/deleted/foreign songs and permits explicit platform scope", () => run(async (tx, fixture) => {
        const c = await prepareSongs(tx, fixture);
        const read = async (songId = c.target.songId) => readSongDetailPage(await c.snapshot(), c.auth, { bandPublicId: c.target.bandPublicId }, songId);
        expect(await read()).toMatchObject({ title: "Alpha", songId: c.target.songId });
        expect(await read(parsePublicId<"Song">(c.foreign.publicId))).toBeNull();
        await tx.song.update({ where: { id: c.songs[0]!.id }, data: { visiblePermissionId: null, createdByUserId: fixture.admin.id } });
        expect(await read()).toBeNull();
        await tx.song.update({ where: { id: c.songs[0]!.id }, data: { visiblePermissionId: c.visibility.id, isDeleted: true } });
        expect(await read()).toBeNull();
        await tx.song.update({ where: { id: c.songs[0]!.id }, data: { isDeleted: false } });
        const platform = await loadAuthorizationForUser(fixture.admin, tx, c.target.bandPublicId);
        const snapshot = await bindDB3ReadSnapshot(tx, platform, { isolationLevel: "Serializable" });
        expect((await GetSearchResultsCore(c.query(), platform, snapshot)).results).toHaveLength(5);
        await updateSongBasicFields(c.root, platform, { ...c.target, description: "Platform edit" });
    }));

    it.each(["roleless", "inactive", "deleted", "merged", "anonymous", "unscoped", "outsider", "revoked", "mismatched"])(
        "rejects %s searches, metadata and writes using fresh authorization", kind => run(async (tx, fixture) => {
            const c = await prepareSongs(tx, fixture);
            let auth = c.auth;
            if (kind === "roleless" || kind === "inactive") {
                await tx.bandUser.update({ where: { id: c.member.id }, data: kind === "roleless" ? { bandRoleId: null } : { isDeleted: true } });
            } else if (kind === "deleted" || kind === "merged") {
                await tx.user.update({ where: { id: fixture.user.id }, data: kind === "deleted" ? { isDeleted: true } : { mergedIntoUserId: fixture.admin.id } });
            } else if (kind === "revoked") {
                const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.view_songs } });
                await tx.bandRolePermission.deleteMany({ where: { bandRoleId: c.role.id, permissionId: permission.id } });
            } else if (["anonymous", "unscoped", "outsider"].includes(kind)) {
                const outsider = kind === "outsider" ? await tx.user.create({ data: { publicId: generatePublicId(), name: "Outsider", email: "outside@song.test.invalid" } }) : null;
                auth = await loadAuthorizationForUser(kind === "anonymous" ? null : outsider ?? fixture.user, tx, kind === "unscoped" ? undefined : c.target.bandPublicId);
            }
            const bandPublicId = kind === "mismatched" ? parsePublicId<"Band">(fixture.bands[1]!.publicId) : c.target.bandPublicId;
            const snapshot = await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });
            await expect(GetSearchResultsCore(c.query({ bandPublicId }), auth, snapshot)).rejects.toThrow();
            await expect(getQuickSearchResults({ bandPublicId, keyword: "Alpha", allowedItemTypes: [QuickSearchItemType.song] }, auth, snapshot)).rejects.toThrow();
            expect(await readSongDetailPage(snapshot, auth, { bandPublicId }, c.target.songId)).toBeNull();
            await expect(updateSongBasicFields(c.root, auth, { ...c.target, bandPublicId, description: "Denied" })).rejects.toThrow();
            expect((await tx.song.findUniqueOrThrow({ where: { id: c.songs[0]!.id } })).description).toBe("Song description");
        }),
    );

    it("rejects numeric identities, undeclared fields and missing bands before writing", () => {
        for (const input of [{ songId: 1 }, { songId: "FixtureSong00001", description: "Hi" },
            { bandPublicId: "FixtureBand00001", songId: "FixtureSong00001", bandId: 1 }]) {
            expect(() => UpdateSongBasicFieldsSchema.parse(input)).toThrow();
        }
    });
});
