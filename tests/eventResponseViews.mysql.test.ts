import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { DB3QueryAuthorizationError, queryView } from "src/core/db3/server/db3QueryCore";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { eventUserResponseView, eventSegmentUserResponseView } from "src/core/db3/shared/entities/event/eventViews";
import { eventParticipantView } from "src/core/db3/shared/entities/user/eventParticipant";
import { userTagEventSearchView } from "src/core/db3/shared/entities/user/userTagViews";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl } from "src/setup/accessControl";
import { prepareEventAttendanceFixture, responseGrants } from "./support/eventAttendanceMysqlFixture";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

async function seedResponses(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
    const seed = await prepareEventAttendanceFixture(tx, fixture, [
        ...responseGrants, Permission.view_events, Permission.view_users_basic_info,
    ]);
    await seed.write({ instrumentId: parsePublicId<"Instrument">(seed.instrument.publicId), comment: "Bring a stand", segmentResponses: seed.answers });
    return seed;
}

async function readResponses(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture, index = 0) {
    const auth = await loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(fixture.bands[index]!.publicId));
    const snapshot = await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });
    const events = await queryView({ view: eventUserResponseView, filter: {}, cmdbQueryContext: "response fixture" }, auth, snapshot);
    const segments = await queryView({ view: eventSegmentUserResponseView, filter: {}, cmdbQueryContext: "segment response fixture" }, auth, snapshot);
    return { events: events.items, segments: segments.items };
}

describe.skipIf(!settingsMysqlTestUrl)("event response views on migrated MariaDB data", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasources: { db: { url: settingsMysqlTestUrl } } } : undefined);
    beforeAll(async () => {
        vi.stubEnv("CMDB_BASE_URL", "http://localhost:32695");
        await initializeAccessControl(database);
    }, 30_000);
    afterAll(async () => { await database.$disconnect(); vi.unstubAllEnvs(); });

    it("projects membership, parent, instrument and attendance public identities independently of the person", () =>
        withSettingsMysqlFixture(database, async (tx, fixture) => {
            const seed = await seedResponses(tx, fixture);
            const result = await readResponses(tx, fixture);
            expect(result.events).toHaveLength(1);
            expect(result.events[0]).toMatchObject({ bandUserId: seed.member.publicId, eventId: seed.event.publicId,
                bandInstrumentId: seed.instrument.publicId, userComment: "Bring a stand", revision: 1 });
            expect(result.segments).toHaveLength(2);
            for (const response of result.segments) {
                expect(response).toMatchObject({ bandUserId: seed.member.publicId, attendanceId: seed.attendance.publicId,
                    createdByUserId: seed.person.publicId, updatedByUserId: seed.person.publicId });
            }
            expect(JSON.stringify(result)).not.toMatch(/"(?:id|userId|instrumentId|bandId|email|phone|hashedPassword)":/);
            expect(result.events[0]?.bandUserId).not.toBe(seed.person.publicId);
        }));

    it("keeps the same person's responses separate in two bands and rejects corrupt parent/member/instrument links", () =>
        withSettingsMysqlFixture(database, async (tx, fixture) => {
            const seed = await seedResponses(tx, fixture);
            const secondMember = await tx.bandUser.update({ where: { bandId_userId: { bandId: fixture.bands[1]!.id, userId: fixture.user.id } }, data: { bandRoleId: seed.role.id } });
            const otherEvent = await tx.event.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[1]!.id, name: "Other concert", revision: 1, createdByUserId: fixture.user.id } });
            await tx.eventUserResponse.create({ data: { publicId: generatePublicId(), eventId: otherEvent.id, bandUserId: secondMember.id, userComment: "Other band" } });
            expect((await readResponses(tx, fixture, 1)).events.map(row => row.bandUserId)).toEqual([secondMember.publicId]);
            expect((await readResponses(tx, fixture)).events.map(row => row.bandUserId)).toEqual([seed.member.publicId]);
            await tx.eventUserResponse.create({ data: { publicId: generatePublicId(), eventId: seed.event.id, bandUserId: secondMember.id } });
            await tx.eventSegmentUserResponse.create({ data: { publicId: generatePublicId(), eventSegmentId: seed.event.segments[0]!.id, bandUserId: secondMember.id } });
            expect((await readResponses(tx, fixture, 1)).segments).toEqual([]);
            expect((await readResponses(tx, fixture)).events).toHaveLength(1);
            const otherGroup = await tx.bandInstrumentFunctionalGroup.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[1]!.id } });
            const otherInstrument = await tx.bandInstrument.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[1]!.id, functionalGroupId: otherGroup.id } });
            await tx.eventUserResponse.updateMany({ where: { bandUserId: seed.member.id }, data: { bandInstrumentId: otherInstrument.id } });
            expect((await readResponses(tx, fixture)).events).toEqual([]);
        }));

    it("requires visible, undeleted parent events for both response readers", () =>
        withSettingsMysqlFixture(database, async (tx, fixture) => {
            const seed = await seedResponses(tx, fixture);
            await tx.event.update({ where: { id: seed.event.id }, data: { visiblePermissionId: null, createdByUserId: fixture.admin.id } });
            expect(await readResponses(tx, fixture)).toEqual({ events: [], segments: [] });
            await tx.event.update({ where: { id: seed.event.id }, data: { createdByUserId: fixture.user.id } });
            expect((await readResponses(tx, fixture)).events).toHaveLength(1);
            await tx.event.update({ where: { id: seed.event.id }, data: { isDeleted: true } });
            expect(await readResponses(tx, fixture)).toEqual({ events: [], segments: [] });
        }));

    it("retains hidden instruments and historical membership response identities", () =>
        withSettingsMysqlFixture(database, async (tx, fixture) => {
            const seed = await seedResponses(tx, fixture);
            const former = await tx.user.create({ data: { publicId: generatePublicId(), name: "Former member", email: "former-response@test.invalid" } });
            const membership = await tx.bandUser.create({ data: { publicId: generatePublicId(), bandId: seed.band.id, userId: former.id, isDeleted: true } });
            await tx.eventUserResponse.create({ data: { publicId: generatePublicId(), eventId: seed.event.id, bandUserId: membership.id, bandInstrumentId: seed.instrument.id } });
            await tx.bandInstrument.update({ where: { id: seed.instrument.id }, data: { isHidden: true } });
            const result = await readResponses(tx, fixture);
            expect(result.events.map(row => row.bandUserId)).toContain(membership.publicId);
            expect(result.events.map(row => row.bandInstrumentId)).toEqual([seed.instrument.publicId, seed.instrument.publicId]);
        }));

    it("refreshes grant and membership state, and rejects platform reads without band selection", () =>
        withSettingsMysqlFixture(database, async (tx, fixture) => {
            const seed = await seedResponses(tx, fixture);
            const snapshot = await bindDB3ReadSnapshot(tx, seed.auth, { isolationLevel: "Serializable" });
            const read = () => queryView({ view: eventUserResponseView, filter: {}, cmdbQueryContext: "stale response grants" }, seed.auth, snapshot);
            expect((await read()).items).toHaveLength(1);
            const grants = await tx.permission.findMany({ where: { name: { in: [Permission.view_events, Permission.view_events_nonpublic] } } });
            await tx.bandRolePermission.deleteMany({ where: { bandRoleId: seed.role.id, permissionId: { in: grants.map(grant => grant.id) } } });
            await expect(read()).rejects.toThrow(DB3QueryAuthorizationError);
            await tx.bandUser.update({ where: { id: seed.member.id }, data: { isDeleted: true } });
            await expect(read()).rejects.toThrow(DB3QueryAuthorizationError);
            const platform = await loadAuthorizationForUser(fixture.admin, tx);
            const platformSnapshot = await bindDB3ReadSnapshot(tx, platform, { isolationLevel: "Serializable" });
            await expect(queryView({ view: eventUserResponseView, filter: {}, cmdbQueryContext: "unscoped responses" }, platform, platformSnapshot)).rejects.toThrow();
        }));

    it("reads invitation assignments and participant filters as membership identities with active same-band policy", () =>
        withSettingsMysqlFixture(database, async (tx, fixture) => {
            const seed = await seedResponses(tx, fixture);
            const secondMember = await tx.bandUser.findUniqueOrThrow({ where: { bandId_userId: { bandId: fixture.bands[1]!.id, userId: fixture.user.id } } });
            const tag = await tx.bandUserTag.create({ data: { publicId: generatePublicId(), bandId: seed.band.id } });
            await tx.bandUserTagAssignment.createMany({ data: [seed.member, secondMember].map(member => ({ publicId: generatePublicId(), bandUserId: member.id, bandUserTagId: tag.id })) });
            const snapshot = await bindDB3ReadSnapshot(tx, seed.auth, { isolationLevel: "Serializable" });
            const invitation = await queryView({ view: userTagEventSearchView, filter: { tableParams: { ids: [parsePublicId<"UserTag">(tag.publicId)] } }, cmdbQueryContext: "invitation members" }, seed.auth, snapshot);
            expect(invitation.items).toEqual([{ publicId: tag.publicId, bandUserTagAssignments: [{ bandUserId: seed.member.publicId }] }]);
            for (const membershipIds of [[], [secondMember.publicId], [generatePublicId()]]) {
                const result = await queryView({ view: eventParticipantView, filter: { tableParams: { membershipIds } }, cmdbQueryContext: "participant member filter" }, seed.auth, snapshot);
                expect(result.items).toEqual([]);
            }
            const participant = await queryView({ view: eventParticipantView, filter: { tableParams: { membershipIds: [seed.member.publicId] } }, cmdbQueryContext: "participant member filter" }, seed.auth, snapshot);
            expect(participant.items.map(row => row.publicId)).toEqual([seed.member.publicId]);
            const empty = await queryView({ view: userTagEventSearchView, filter: { tableParams: { ids: [] } }, cmdbQueryContext: "empty invitation tags" }, seed.auth, snapshot);
            expect(empty.items).toEqual([]);
            const otherTag = await tx.bandUserTag.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[1]!.id } });
            await tx.bandUserTagAssignment.create({ data: { publicId: generatePublicId(), bandUserId: secondMember.id, bandUserTagId: otherTag.id } });
            const roleless = await loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(fixture.bands[1]!.publicId));
            const rolelessSnapshot = await bindDB3ReadSnapshot(tx, roleless, { isolationLevel: "Serializable" });
            const ownInvitation = await queryView({ view: userTagEventSearchView,
                filter: { tableParams: { ids: [parsePublicId<"UserTag">(otherTag.publicId)] } }, cmdbQueryContext: "roleless invitation" }, roleless, rolelessSnapshot);
            expect(ownInvitation.items).toEqual([{ publicId: otherTag.publicId, bandUserTagAssignments: [{ bandUserId: secondMember.publicId }] }]);
        }));
});
