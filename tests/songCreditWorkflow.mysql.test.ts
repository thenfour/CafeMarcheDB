import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { bandPersonReferenceView, songCreditEditorView, songDetailView, xSongCredit } from "src/core/db3/db3";
import { createCommandRowServices } from "src/core/db3/server/db3CommandCore";
import { getDB3CommandHandler } from "src/core/db3/server/db3CommandRegistry";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { DB3PaginatedQueryCore, queryView } from "src/core/db3/server/db3QueryCore";
import { loadSharedCatalogs } from "src/core/db3/server/db3DashboardCatalogs";
import { createDashboardReferenceStore, registerDashboardReferences, songCreditTypeDashboardView } from "src/core/db3/shared/references/dashboardReferences";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl } from "src/setup/accessControl";
import { readMemberSongCredits } from "src/core/db3/server/memberSongCredits";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";
import { prepareSongs } from "./support/songWorkflowMysqlFixture";

async function prepare(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
    const c = await prepareSongs(tx, fixture);
    const profileGrant = await tx.permission.findUniqueOrThrow({ where: { name: Permission.view_users_basic_info } });
    await tx.bandRolePermission.create({ data: { publicId: generatePublicId(), bandRoleId: c.role.id, permissionId: profileGrant.id } });
    const auth = await c.auth.refresh(tx);
    const name = await c.text("Composer", "Compositeur");
    await tx.dynamicLocalizedStringValue.create({ data: { publicId: generatePublicId(), stringId: name.id, localeId: fixture.dutchId, indexedValue: "Componist" } });
    const description = await c.text("Credit", "Auteur");
    const type = await tx.songCreditType.create({ data: { publicId: generatePublicId(), nameId: name.id, descriptionId: description.id } });
    const person = await tx.user.create({ data: { publicId: generatePublicId(), email: "composer@test.invalid", name: "Credited person",
        bandUsersByUser: { create: { publicId: generatePublicId(), bandId: c.band.id } } } });
    const foreignPerson = await tx.user.create({ data: { publicId: generatePublicId(), email: "foreign-composer@test.invalid", name: "Other band's person",
        bandUsersByUser: { create: { publicId: generatePublicId(), bandId: fixture.bands[1]!.id } } } });
    const dto = songCreditEditorView.crud.operations.create.command.parseDto({ songId: c.target.songId,
        userId: parsePublicId<"User">(person.publicId), typeId: parsePublicId<"SongCreditType">(type.publicId), year: "2026–27", comment: "**Arranged**" });
    const write = (commandID: string, payload: unknown) => c.root.$transaction(async transaction => {
        const fresh = await auth.refresh(transaction);
        const handler = getDB3CommandHandler(commandID);
        return handler.execute(handler.command.parseDto(payload), {
            authorization: fresh, transaction, rowServices: createCommandRowServices(fresh, transaction),
        });
    }, { isolationLevel: "Serializable" });
    const create = (patch: Partial<typeof dto> = {}) => write(songCreditEditorView.crud.operations.create.command.commandID, { ...dto, ...patch });
    const read = async (locale = "fr-BE") => queryView({ view: songCreditEditorView, bandPublicId: c.target.bandPublicId,
        routeLocale: locale, filter: {}, cmdbQueryContext: "song credit editor" }, auth, await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" }));
    return { ...c, auth, type, name, person, foreignPerson, dto, write, create, read };
}

describe.skipIf(!settingsMysqlTestUrl)("Song credit authoring on MariaDB", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasourceUrl: settingsMysqlTestUrl } : undefined);
    beforeAll(() => initializeAccessControl(database), 30_000);
    afterAll(() => database.$disconnect());
    const run = (work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) => withSettingsMysqlFixture(database, work);

    it("creates, edits and hard-deletes through generated commands with public identities and audits", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const created = songCreditEditorView.crud.operations.create.command.parseResult(await c.create());
        const credit = await tx.songCredit.findUniqueOrThrow({ where: { publicId: created.identity } });
        expect(credit).toMatchObject({ userId: c.person.id, songId: c.songs[0]!.id, typeId: c.type.id, year: "2026–27", comment: "**Arranged**" });
        const read = await c.read();
        expect(read.items).toMatchObject([{ publicId: created.identity, userId: c.person.publicId, songId: c.target.songId, typeId: c.type.publicId }]);
        expect(JSON.stringify(read.items)).not.toMatch(/"(?:id|bandId|email|phone|nameId)":/);
        await c.write(songCreditEditorView.crud.operations.update.command.commandID, { identity: created.identity, patch: { userId: null, year: "", comment: "" } });
        expect((await c.read()).items).toMatchObject([{ userId: null, year: "", comment: "" }]);
        await c.write(songCreditEditorView.crud.operations.delete.command.commandID, { identity: created.identity });
        expect(await tx.songCredit.count({ where: { id: credit.id } })).toBe(0);
        expect(await tx.change.findMany({ where: { table: "SongCredit", recordId: credit.id }, select: { action: true } })).toEqual([
            { action: "insert" }, { action: "update" }, { action: "delete" },
        ]);
    }));

    it("uses active band people and localized type references in grids and Song detail", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        await c.create();
        const snapshot = await bindDB3ReadSnapshot(tx, c.auth, { isolationLevel: "Serializable" });
        const people = await queryView({ view: bandPersonReferenceView, filter: {}, cmdbQueryContext: "credit person picker" }, c.auth, snapshot);
        expect(people.items.map(person => person.publicId)).toEqual(expect.arrayContaining([c.person.publicId, c.args.userId]));
        expect(people.items.map(person => person.publicId)).not.toContain(c.foreignPerson.publicId);
        expect(JSON.stringify(people.items)).not.toMatch(/"(?:id|email|phone|globalRoleId)":/);
        for (const [locale, expected] of [["fr-BE", "Compositeur"], ["nl-BE", "Componist"]]) {
            const catalogs = await loadSharedCatalogs(snapshot, c.auth, { routeLocale: locale });
            const references = createDashboardReferenceStore();
            registerDashboardReferences(references, { songCreditType: catalogs.songCreditType.map(type => songCreditTypeDashboardView.hydrate(type, references)) });
            const credit = (await c.read(locale)).items[0]!;
            expect(songCreditEditorView.hydrate(credit, references).type?.name).toBe(expected);
            const detail = await queryView({ view: songDetailView, filter: { tableParams: { songId: c.target.songId } }, routeLocale: locale, cmdbQueryContext: "credit detail" }, c.auth, snapshot);
            const nestedCredit = songCreditEditorView.parseDto({ ...detail.items[0]!.credits![0], song: credit.song });
            expect(songCreditEditorView.hydrate(nestedCredit, references).type?.name).toBe(expected);
        }
        await tx.bandDynamicLocalizedStringValue.create({ data: { publicId: generatePublicId(), bandId: c.band.id, stringId: c.name.id, localeId: fixture.frenchId, indexedValue: "" } });
        expect((await loadSharedCatalogs(snapshot, c.auth, { routeLocale: "fr-BE" })).songCreditType.find(type => type.publicId === c.type.publicId)?.name).toBe("");
        const page = await DB3PaginatedQueryCore({ table: { tableID: xSongCredit.tableID, tableName: xSongCredit.tableName, viewID: songCreditEditorView.viewID },
            filter: {}, orderBy: undefined, skip: 0, take: 10, cmdbQueryContext: "credit grid" }, c.auth, snapshot);
        expect(page.count).toBe(1);
        await expect(queryView({ view: bandPersonReferenceView, filter: {}, cmdbQueryContext: "platform person picker" },
            await loadAuthorizationForUser(fixture.admin, tx), await bindDB3ReadSnapshot(tx, await loadAuthorizationForUser(fixture.admin, tx), { isolationLevel: "Serializable" }))).rejects.toThrow();
    }));

    it("reads profile credits with visible Song metadata, public references and an active selected-band person", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const grant = await tx.permission.findUniqueOrThrow({ where: { name: Permission.manage_users } });
        await tx.bandRolePermission.create({ data: { publicId: generatePublicId(), bandRoleId: c.role.id, permissionId: grant.id } });
        await c.create();
        const input = { bandPublicId: c.target.bandPublicId, userId: c.dto.userId!, take: 100, routeLocale: "fr-BE" };
        const read = () => readMemberSongCredits(c.root, c.auth, input);
        expect((await read()).songCredits).toMatchObject([{ userId: c.dto.userId, songId: c.target.songId, typeId: c.dto.typeId,
            song: { publicId: c.target.songId, name: "Alpha", introducedYear: 2026 } }]);
        expect(JSON.stringify(await read())).not.toMatch(/"(?:id|userId|songId|typeId)":\d/);
        for (const song of await tx.song.findMany({ where: { bandId: c.band.id, name: { contains: "secret" } } })) {
            await tx.songCredit.create({ data: { publicId: generatePublicId(), songId: song.id, userId: c.person.id,
                typeId: c.type.id, year: "hidden", comment: "hidden" } });
        }
        expect((await read()).songCredits).toHaveLength(1);
        await tx.songCredit.create({ data: { publicId: generatePublicId(), songId: c.foreign.id, userId: c.person.id, typeId: c.type.id, year: "foreign", comment: "foreign" } });
        expect((await read()).songCredits).toHaveLength(1);
        await expect(readMemberSongCredits(c.root, c.auth, { ...input, bandPublicId: parsePublicId<"Band">(fixture.bands[1]!.publicId) })).rejects.toThrow();
        await expect(readMemberSongCredits(c.root, c.auth, { ...input, userId: parsePublicId<"User">(c.foreignPerson.publicId) })).rejects.toThrow();
        await tx.bandUser.update({ where: { bandId_userId: { bandId: c.band.id, userId: c.person.id } }, data: { isDeleted: true } });
        await expect(read()).rejects.toThrow();
        await tx.bandUser.update({ where: { bandId_userId: { bandId: c.band.id, userId: c.person.id } }, data: { isDeleted: false } });
        for (const state of [{ isDeleted: true }, { mergedIntoUserId: fixture.admin.id }]) {
            await tx.user.update({ where: { id: c.person.id }, data: { isDeleted: false, mergedIntoUserId: null, ...state } });
            await expect(read()).rejects.toThrow();
        }
    }));

    it.each(["management", "songs", "basic", "membership", "account", "merged", "band"])("rechecks %s authority before reading profile credits", reason => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const grant = await tx.permission.findUniqueOrThrow({ where: { name: Permission.manage_users } });
        await tx.bandRolePermission.create({ data: { publicId: generatePublicId(), bandRoleId: c.role.id, permissionId: grant.id } });
        await c.create();
        const auth = await c.auth.refresh(tx);
        const input = { bandPublicId: c.target.bandPublicId, userId: c.dto.userId!, take: 100 };
        expect((await readMemberSongCredits(c.root, auth, input)).songCredits).toHaveLength(1);
        const revoked = { management: Permission.manage_users, songs: Permission.view_songs, basic: Permission.view_users_basic_info };
        if (reason === "management" || reason === "songs" || reason === "basic") {
            await tx.bandRolePermission.deleteMany({ where: { bandRoleId: c.role.id, permission: { name: revoked[reason] } } });
        } else if (reason === "membership") {
            await tx.bandUser.update({ where: { id: c.member.id }, data: { isDeleted: true } });
        } else if (reason === "band") {
            await tx.band.update({ where: { id: c.band.id }, data: { isDeleted: true } });
        } else {
            await tx.user.update({ where: { id: fixture.user.id }, data: reason === "merged" ? { mergedIntoUserId: fixture.admin.id } : { isDeleted: true } });
        }
        await expect(readMemberSongCredits(c.root, auth, input)).rejects.toThrow();
    }));

    it("rejects foreign, inactive and merged people, inaccessible Songs and forged type identities without writes", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const created = songCreditEditorView.crud.operations.create.command.parseResult(await c.create());
        const update = (patch: object) => c.write(songCreditEditorView.crud.operations.update.command.commandID, { identity: created.identity, patch });
        const count = await tx.change.count();
        for (const patch of [{ userId: c.foreignPerson.publicId }, { songId: c.foreign.publicId }, { typeId: generatePublicId() }, { bandId: fixture.bands[1]!.id }, { userId: c.person.id }]) {
            await expect(update({ comment: "Must roll back", ...patch })).rejects.toThrow();
        }
        for (const data of [{ isDeleted: true }, { mergedIntoUserId: fixture.admin.id }]) {
            await tx.user.update({ where: { id: c.foreignPerson.id }, data: { isDeleted: false, mergedIntoUserId: null, ...data } });
            await tx.bandUser.upsert({ where: { bandId_userId: { bandId: c.band.id, userId: c.foreignPerson.id } }, create: { publicId: generatePublicId(), bandId: c.band.id, userId: c.foreignPerson.id }, update: {} });
            await expect(update({ userId: c.foreignPerson.publicId })).rejects.toThrow();
        }
        for (const song of await tx.song.findMany({ where: { bandId: c.band.id, name: { contains: "secret" } } })) {
            await expect(update({ songId: song.publicId })).rejects.toThrow();
        }
        expect((await tx.songCredit.findUniqueOrThrow({ where: { publicId: created.identity } })).comment).toBe("**Arranged**");
        expect(await tx.change.count()).toBe(count);
        await tx.bandUser.update({ where: { bandId_userId: { bandId: c.band.id, userId: c.person.id } }, data: { isDeleted: true } });
        expect((await c.read()).items).toEqual([]);
        expect((await queryView({ view: songDetailView, filter: { tableParams: { songId: c.target.songId } }, cmdbQueryContext: "inactive credit" }, c.auth,
            await bindDB3ReadSnapshot(tx, c.auth, { isolationLevel: "Serializable" }))).items[0]!.credits).toEqual([]);
    }));

    it.each(["grant", "manageOnly", "membership", "account", "merged", "band"])("rechecks %s revocation and keeps second-band authority independent", reason => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const created = songCreditEditorView.crud.operations.create.command.parseResult(await c.create({ userId: c.args.userId }));
        const secondRole = await tx.bandRole.create({ data: { publicId: generatePublicId(), nameId: c.role.nameId,
            bandRolePermissions: { create: (await tx.bandRolePermission.findMany({ where: { bandRoleId: c.role.id } })).map(grant => ({ publicId: generatePublicId(), permissionId: grant.permissionId })) },
        } });
        await tx.bandUser.update({ where: { bandId_userId: { bandId: fixture.bands[1]!.id, userId: fixture.user.id } }, data: { bandRoleId: secondRole.id } });
        const otherAuth = await loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(fixture.bands[1]!.publicId));
        if (reason === "grant") {
            await tx.bandUser.update({ where: { id: c.member.id }, data: { bandRoleId: null } });
        } else if (reason === "manageOnly") {
            await tx.bandRolePermission.deleteMany({ where: { bandRoleId: c.role.id, permission: { name: Permission.manage_songs } } });
        } else if (reason === "membership") {
            await tx.bandUser.update({ where: { id: c.member.id }, data: { isDeleted: true } });
        } else if (reason === "band") {
            await tx.band.update({ where: { id: c.band.id }, data: { isDeleted: true } });
        } else {
            await tx.user.update({ where: { id: fixture.user.id }, data: reason === "merged" ? { mergedIntoUserId: fixture.admin.id } : { isDeleted: true } });
        }
        if (reason === "manageOnly") {
            expect((await c.read()).items).toHaveLength(1);
        } else {
            await expect(c.read()).rejects.toThrow();
        }
        await expect(c.create()).rejects.toThrow();
        await expect(c.write(songCreditEditorView.crud.operations.update.command.commandID, { identity: created.identity, patch: { comment: "denied" } })).rejects.toThrow();
        await expect(c.write(songCreditEditorView.crud.operations.delete.command.commandID, { identity: created.identity })).rejects.toThrow();
        expect((await tx.songCredit.findUniqueOrThrow({ where: { publicId: created.identity } })).comment).toBe("**Arranged**");
        if (["grant", "manageOnly", "membership", "band"].includes(reason)) {
            const other = await otherAuth.refresh(tx);
            const row = await createCommandRowServices(other, tx).insert(xSongCredit, { ...c.dto, userId: c.args.userId, songId: parsePublicId<"Song">(c.foreign.publicId) });
            expect(row.songId).toBe(c.foreign.id);
            await expect(createCommandRowServices(other, tx).delete(xSongCredit, created.identity, "hard")).rejects.toThrow();
        }
    }));

    it.each(["create", "update", "delete"])("rolls back %s when audit persistence fails", operation => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const created = songCreditEditorView.crud.operations.create.command.parseResult(await c.create());
        const before = await tx.songCredit.findMany();
        const changes = await tx.change.count();
        const audit = vi.spyOn(tx.change, "create").mockRejectedValueOnce(new Error("Audit unavailable"));
        try {
            const payload = operation === "create" ? c.dto : operation === "update" ? { identity: created.identity, patch: { comment: "failed" } } : { identity: created.identity };
            await expect(c.write(songCreditEditorView.crud.operations[operation].command.commandID, payload)).rejects.toThrow("Audit unavailable");
        } finally {
            audit.mockRestore();
        }
        expect(await tx.songCredit.findMany()).toEqual(before);
        expect(await tx.change.count()).toBe(changes);
    }));
});
