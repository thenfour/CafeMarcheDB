import { PrismaClient, type Prisma, type BandUser, type BandInstrument, type File } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl } from "src/setup/accessControl";
import { loadDashboardCatalogs } from "src/core/db3/server/db3DashboardCatalogs";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { projectDB3ModelPublicIds } from "src/core/db3/server/db3PublicIds";
import { queryView } from "src/core/db3/server/db3QueryCore";
import { createCommandRowServices } from "src/core/db3/server/db3CommandCore";
import { fileCardSelection, fileDetailSelection, fileDetailView, fileEditorSelection } from "src/core/db3/shared/entities/file/fileViews";
import { fileSearchSelection } from "src/core/db3/shared/entities/file/fileSearchView";
import { xFile } from "src/core/db3/shared/schema/file";
import { FileArgs, FileInstrumentTagArgs, FileInstrumentTagNaturalOrderBy, FileUserTagArgs, FileUserTagNaturalOrderBy } from "src/core/db3/shared/schema/prismArgs";
import { createDashboardReferenceStore, instrumentDashboardView, instrumentFunctionalGroupDashboardView, registerDashboardReferences } from "src/core/db3/shared/references/dashboardReferences";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

interface SeededFileAssociations {
    band: SettingsMysqlFixture["bands"][number];
    member: BandUser;
    instrument: BandInstrument;
    file: File;
}

async function seedFileAssociations(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
    const text = (value: string) => ({ create: { publicId: generatePublicId(), values: { create: {
        publicId: generatePublicId(), localeId: fixture.englishId, indexedValue: value,
    } } } });
    const globalGroup = await tx.globalInstrumentFunctionalGroup.create({ data: {
        publicId: generatePublicId(), name: text("Brass"), description: text(""), sortOrder: 1,
    } });
    const globalInstrument = await tx.globalInstrument.create({ data: {
        publicId: generatePublicId(), name: text("Trumpet"), description: text(""), sortOrder: 1,
        functionalGroup: { connect: { id: globalGroup.id } },
    } });
    const role = await tx.bandUser.findUniqueOrThrow({ where: { bandId_userId: {
        bandId: fixture.bands[0]!.id, userId: fixture.user.id,
    } } });
    const result: SeededFileAssociations[] = [];
    for (const [index, band] of fixture.bands.entries()) {
        const member = await tx.bandUser.update({ where: { bandId_userId: { bandId: band.id, userId: fixture.user.id } },
            data: { bandRoleId: role.bandRoleId } });
        const group = await tx.bandInstrumentFunctionalGroup.create({ data: {
            publicId: generatePublicId(), bandId: band.id, globalFunctionalGroupId: globalGroup.id,
        } });
        const instrument = await tx.bandInstrument.create({ data: {
            publicId: generatePublicId(), bandId: band.id, globalInstrumentId: globalInstrument.id, functionalGroupId: group.id,
        } });
        const name = await tx.dynamicLocalizedString.create({ data: { publicId: generatePublicId(), bandValues: { create: {
            publicId: generatePublicId(), bandId: band.id, localeId: fixture.frenchId, indexedValue: index === 0 ? "Trompette" : "",
        } } } });
        await tx.bandInstrument.update({ where: { id: instrument.id }, data: { nameId: name.id } });
        const file = await tx.file.create({ data: {
            publicId: generatePublicId(), bandId: band.id, uploadedByUserId: fixture.user.id, uploadedAt: new Date(),
            fileLeafName: "score.pdf", storedLeafName: generatePublicId(), description: "",
            taggedUsers: { create: { publicId: generatePublicId(), bandUserId: member.id } },
            taggedInstruments: { create: { publicId: generatePublicId(), bandInstrumentId: instrument.id } },
        } });
        result.push({ band, member, instrument, file });
    }
    return result;
}

describe.skipIf(!settingsMysqlTestUrl)("File association payloads on MariaDB", () => {
    const database = settingsMysqlTestUrl ? new PrismaClient({ datasources: { db: { url: settingsMysqlTestUrl } } }) : null;
    beforeAll(async () => {
        if (database) {
            await initializeAccessControl(database);
        }
    });
    afterAll(async () => {
        await database?.$disconnect();
    });
    const withFixture = (work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) => {
        if (!database) {
            throw new Error("A private File payload database is required.");
        }
        return withSettingsMysqlFixture(database, work);
    };

    it("executes search/card/detail/editor and association selections against the target schema", () => withFixture(async (tx, fixture) => {
        const [seed] = await seedFileAssociations(tx, fixture);
        if (!seed) {
            throw new Error("File fixture was not created.");
        }
        const auth = await loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(seed.band.publicId));
        const rows = await Promise.all([
            tx.file.findUniqueOrThrow({ ...fileSearchSelection, where: { id: seed.file.id } }),
            tx.file.findUniqueOrThrow({ ...fileCardSelection, where: { id: seed.file.id } }),
            tx.file.findUniqueOrThrow({ ...fileDetailSelection, where: { id: seed.file.id } }),
            tx.file.findUniqueOrThrow({ ...fileEditorSelection, where: { id: seed.file.id } }),
        ]);
        for (const row of rows) {
            // This tests payload conversion only; general File row authorization remains disabled.
            const projected = projectDB3ModelPublicIds(xFile, row, auth);
            expect(projected.taggedInstruments).toMatchObject([{ bandInstrumentId: seed.instrument.publicId }]);
            expect(projected.taggedInstruments[0]).not.toHaveProperty("instrumentId");
            if (projected.taggedUsers) {
                expect(projected.taggedUsers).toMatchObject([{ bandUser: { publicId: seed.member.publicId } }]);
                expect(projected.taggedUsers[0]).not.toHaveProperty("userId");
            }
            expect(projected.uploadedByUser).not.toHaveProperty("id");
        }
        const payload = await tx.file.findUniqueOrThrow({ ...FileArgs, where: { id: seed.file.id } });
        expect(payload.taggedUsers[0]?.bandUser.userId).toBe(fixture.user.id);
        expect(payload.taggedInstruments[0]?.bandInstrument.publicId).toBe(seed.instrument.publicId);
        expect(await tx.fileUserTag.findMany({ ...FileUserTagArgs, orderBy: FileUserTagNaturalOrderBy, where: { fileId: seed.file.id } }))
            .toMatchObject([{ bandUserId: seed.member.id }]);
        expect(await tx.fileInstrumentTag.findMany({ ...FileInstrumentTagArgs, orderBy: FileInstrumentTagNaturalOrderBy, where: { fileId: seed.file.id } }))
            .toMatchObject([{ bandInstrumentId: seed.instrument.id }]);
    }));

    it.each(["en-US", "fr-BE"])("hydrates distinct memberships and band-first instrument labels in %s", routeLocale => withFixture(async (tx, fixture) => {
        const seeds = await seedFileAssociations(tx, fixture);
        const person = await tx.user.findUniqueOrThrow({ where: { id: fixture.user.id } });
        const memberships = new Set<string>();
        for (const [index, seed] of seeds.entries()) {
            const auth = await loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(seed.band.publicId));
            const snapshot = await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });
            const catalogs = await loadDashboardCatalogs(snapshot, auth, { routeLocale });
            const references = createDashboardReferenceStore();
            registerDashboardReferences(references, { instrumentFunctionalGroup: catalogs.instrumentFunctionalGroup.map(dto =>
                instrumentFunctionalGroupDashboardView.hydrate(dto, references)) });
            registerDashboardReferences(references, { instrument: catalogs.instrument.map(dto => instrumentDashboardView.hydrate(dto, references)) });
            const row = await tx.file.findUniqueOrThrow({ ...fileDetailSelection, where: { id: seed.file.id } });
            const dto = fileDetailView.parseDto(projectDB3ModelPublicIds(xFile, row, auth));
            const client = fileDetailView.hydrate(dto, references);
            const member = client.taggedUsers?.[0]?.bandUser;
            expect(member).toMatchObject({ publicId: seed.member.publicId, user: { name: "Shared settings person" } });
            expect(member?.user.publicId).toBe(person.publicId);
            if (!member) {
                throw new Error("File membership was not projected.");
            }
            memberships.add(member.publicId);
            expect(client.taggedInstruments?.[0]?.bandInstrument).toMatchObject({
                publicId: seed.instrument.publicId, name: index === 0 ? "Trompette" : "",
            });
            expect(dto.taggedInstruments?.[0]).not.toHaveProperty("bandInstrument");
            expect(dto.taggedUsers?.[0]?.bandUser).not.toHaveProperty("userId");
            expect(dto).not.toHaveProperty("bandId");
            for (const other of seeds.filter(item => item.band.id !== seed.band.id)) {
                expect(references.get(instrumentDashboardView.entity, parsePublicId<"Instrument">(other.instrument.publicId))).toBeUndefined();
            }
        }
        expect(memberships.size).toBe(2);
    }));

    it("keeps undeclared File queries and row writes guarded for members and platform administrators", () => withFixture(async (tx, fixture) => {
        const [seed] = await seedFileAssociations(tx, fixture);
        if (!seed) {
            throw new Error("File fixture was not created.");
        }
        for (const actor of [fixture.user, fixture.admin]) {
            const auth = await loadAuthorizationForUser(actor, tx, parsePublicId<"Band">(seed.band.publicId));
            const snapshot = await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });
            await expect(queryView({ view: fileDetailView, filter: {}, cmdbQueryContext: "deferred File payload" }, auth, snapshot)).rejects.toThrow();
            const rows = createCommandRowServices(auth, tx);
            await expect(rows.insert(xFile, {})).rejects.toThrow();
            await expect(rows.update(xFile, parsePublicId<"File">(seed.file.publicId), { description: "unauthorized change" })).rejects.toThrow();
            expect(await tx.file.findUniqueOrThrow({ where: { id: seed.file.id } })).toMatchObject({ description: "" });
        }
        expect(await tx.change.count({ where: { userId: fixture.user.id } })).toBe(0);
    }));
});
