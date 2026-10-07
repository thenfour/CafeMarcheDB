import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { DB3QueryAuthorizationError, queryView } from "src/core/db3/server/db3QueryCore";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { loadDashboardData } from "src/core/db3/server/db3DashboardData";
import { eventParticipantFromMembership, eventParticipantView } from "src/core/db3/shared/entities/user/eventParticipant";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl } from "src/setup/accessControl";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

async function seedParticipant(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture, index: number) {
    const band = fixture.bands[index]!;
    const member = await tx.bandUser.findUniqueOrThrow({ where: { bandId_userId: { bandId: band.id, userId: fixture.user.id } } });
    const group = await tx.bandInstrumentFunctionalGroup.create({ data: { publicId: generatePublicId(), bandId: band.id } });
    const instrument = await tx.bandInstrument.create({ data: { publicId: generatePublicId(), bandId: band.id, functionalGroupId: group.id } });
    const tag = await tx.bandUserTag.create({ data: { publicId: generatePublicId(), bandId: band.id } });
    await tx.bandUserInstrument.create({ data: { publicId: generatePublicId(), bandUserId: member.id, bandInstrumentId: instrument.id, isPrimary: true } });
    await tx.bandUserTagAssignment.create({ data: { publicId: generatePublicId(), bandUserId: member.id, bandUserTagId: tag.id } });
    return { member, instrument, tag };
}

async function readParticipants(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture, index: number, personPublicIds?: string[]) {
    const auth = await loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(fixture.bands[index]!.publicId));
    const snapshot = await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });
    return queryView({ view: eventParticipantView,
        filter: { tableParams: personPublicIds === undefined ? {} : { personPublicIds } },
        cmdbQueryContext: "event participant fixture" }, auth, snapshot);
}

describe.skipIf(!settingsMysqlTestUrl)("event participants on migrated MariaDB data", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasources: { db: { url: settingsMysqlTestUrl } } } : undefined);
    beforeAll(() => initializeAccessControl(database), 30_000);
    afterAll(() => database.$disconnect());

    it("keeps the same person's membership, instruments and tags separate in two bands, including a roleless owner", () =>
        withSettingsMysqlFixture(database, async (tx, fixture) => {
            const seeds = [await seedParticipant(tx, fixture, 0), await seedParticipant(tx, fixture, 1)];
            const person = await tx.user.update({ where: { id: fixture.user.id }, data: { cssClass: "performer" } });
            for (const [index, seed] of seeds.entries()) {
                const result = await readParticipants(tx, fixture, index, [person.publicId]);
                expect(result.items).toHaveLength(1);
                const participant = eventParticipantFromMembership(result.items[0]!);
                expect(participant).toMatchObject({ publicId: person.publicId, membershipId: seed.member.publicId, name: person.name, cssClass: "performer" });
                expect(participant?.bandUserInstruments.map(row => row.bandInstrumentId)).toEqual([seed.instrument.publicId]);
                expect(participant?.bandUserTagAssignments.map(row => row.bandUserTagId)).toEqual([seed.tag.publicId]);
                expect(JSON.stringify(result.items)).not.toMatch(/"(?:id|bandId|bandUserId|email|phone|hashedPassword|calendarFeedToken)":/);
                const auth = await loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(fixture.bands[index]!.publicId));
                const snapshot = await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });
                const dashboard = await loadDashboardData(snapshot, auth, { bandPublicId: parsePublicId<"Band">(fixture.bands[index]!.publicId) });
                expect(eventParticipantFromMembership(dashboard.currentMembership)).toEqual(participant);
            }
        }));

    it("treats empty, unknown and other-band person lists as empty and validates public identities", () =>
        withSettingsMysqlFixture(database, async (tx, fixture) => {
            await seedParticipant(tx, fixture, 0);
            const outsider = await tx.user.create({ data: { publicId: generatePublicId(), name: "Other band only", email: "other-band@test.invalid" } });
            await tx.bandUser.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[1]!.id, userId: outsider.id } });
            for (const ids of [[], [generatePublicId()], [outsider.publicId]]) {
                expect((await readParticipants(tx, fixture, 0, ids)).items).toEqual([]);
            }
            await expect(readParticipants(tx, fixture, 0, ["invalid"])).rejects.toThrow();
        }));

    it("retains hidden assignment history while excluding corrupt cross-band associations", () =>
        withSettingsMysqlFixture(database, async (tx, fixture) => {
            const first = await seedParticipant(tx, fixture, 0);
            const second = await seedParticipant(tx, fixture, 1);
            await tx.bandInstrument.update({ where: { id: first.instrument.id }, data: { isHidden: true } });
            await tx.bandUserTag.update({ where: { id: first.tag.id }, data: { isHidden: true } });
            // Direct fixture writes reproduce historic corruption that membership commands reject.
            await tx.bandUserInstrument.create({ data: { publicId: generatePublicId(), bandUserId: first.member.id, bandInstrumentId: second.instrument.id } });
            await tx.bandUserTagAssignment.create({ data: { publicId: generatePublicId(), bandUserId: first.member.id, bandUserTagId: second.tag.id } });
            const result = await readParticipants(tx, fixture, 0);
            const participant = eventParticipantFromMembership(result.items[0]!);
            expect(participant?.bandUserInstruments.map(row => row.bandInstrumentId)).toEqual([first.instrument.publicId]);
            expect(participant?.bandUserTagAssignments.map(row => row.bandUserTagId)).toEqual([first.tag.publicId]);
        }));

    it("refreshes grants and active membership instead of retaining a previously visible participant", () =>
        withSettingsMysqlFixture(database, async (tx, fixture) => {
            const seed = await seedParticipant(tx, fixture, 0);
            const other = await tx.user.create({ data: { publicId: generatePublicId(), name: "Other participant", email: "participant@test.invalid" } });
            await tx.bandUser.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[0]!.id, userId: other.id } });
            const auth = await loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(fixture.bands[0]!.publicId));
            const snapshot = await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });
            const read = () => queryView({ view: eventParticipantView, filter: { tableParams: { personPublicIds: [other.publicId] } }, cmdbQueryContext: "participant revocation" }, auth, snapshot);
            expect((await read()).items).toHaveLength(1);
            const basic = await tx.permission.findUniqueOrThrow({ where: { name: Permission.view_users_basic_info } });
            await tx.bandRolePermission.deleteMany({ where: { bandRoleId: seed.member.bandRoleId!, permissionId: basic.id } });
            expect((await read()).items).toEqual([]);
            await tx.bandUser.update({ where: { id: seed.member.id }, data: { isDeleted: true } });
            expect((await readParticipants(tx, fixture, 0)).items).toEqual([]);
        }));

    it("omits inactive or merged people and requires an explicit band context", () =>
        withSettingsMysqlFixture(database, async (tx, fixture) => {
            const seed = await seedParticipant(tx, fixture, 0);
            await tx.bandUser.update({ where: { id: seed.member.id }, data: { isDeleted: true } });
            expect((await readParticipants(tx, fixture, 0)).items).toEqual([]);
            await tx.bandUser.update({ where: { id: seed.member.id }, data: { isDeleted: false } });
            await tx.user.update({ where: { id: fixture.user.id }, data: { mergedIntoUserId: fixture.admin.id } });
            await expect(readParticipants(tx, fixture, 0)).rejects.toThrow(DB3QueryAuthorizationError);
            await tx.user.update({ where: { id: fixture.user.id }, data: { mergedIntoUserId: null, isDeleted: true } });
            await expect(readParticipants(tx, fixture, 0)).rejects.toThrow(DB3QueryAuthorizationError);
            const platform = await loadAuthorizationForUser(fixture.admin, tx);
            const snapshot = await bindDB3ReadSnapshot(tx, platform, { isolationLevel: "Serializable" });
            await expect(queryView({ view: eventParticipantView, filter: {}, cmdbQueryContext: "platform participants" }, platform, snapshot)).rejects.toThrow();
        }));
});
