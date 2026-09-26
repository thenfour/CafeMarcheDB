import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

const { relevanceQuery } = vi.hoisted(() => ({ relevanceQuery: vi.fn() }));
vi.mock("db", async () => {
    const { authorizationTestDb } = await import("./support/inMemoryPrisma");
    return {
        ...await vi.importActual<typeof import("@prisma/client")>("@prisma/client"),
        default: new Proxy(authorizationTestDb, {
            // Only raw relevance selection is stubbed; subsequent DB3 reads use real policy.
            get: (database, key) => key === "$queryRaw" ? relevanceQuery : Reflect.get(database, key),
        }),
    };
});

import getDashboardData from "src/auth/queries/getDashboardData";
import db3Query from "src/core/db3/queries/db3queries";
import db3PaginatedQuery from "src/core/db3/queries/db3paginatedQueries";
import * as db3 from "src/core/db3/db3";
import type { CMDBTableFilterModel } from "src/core/db3/shared/apiTypes";
import { queryView } from "src/core/db3/server/db3QueryCore";
import { validateDB3QueryRequest } from "src/core/db3/server/db3RequestValidation";
import { loadAuthorization } from "src/auth/server/requestAuthorization";
import { PermissionSet } from "src/auth/shared/PermissionSet";
import { Permission } from "shared/permissions";
import type { EventPublicId } from "shared/publicId";
import { eventPublicId } from "../support/eventResponseFixtures";
import { userPublicId } from "../support/userFixtures";
import { createAuthorizationTestContext, createAuthorizationTestUser } from "./support/authorizationFixtures";
import { authorizationTestDb } from "./support/inMemoryPrisma";
import { invokeResolver } from "./support/resolverHarness";

const now = new Date("2026-09-26T12:00:00Z");
const event = {
    id: 100, publicId: eventPublicId(100), name: "Rehearsal", revision: 1,
    createdAt: now, createdByUserId: 42, isDeleted: false, visiblePermissionId: null,
    locationDescription: "", locationURL: "", typeId: null, statusId: null,
    relevanceClassOverride: null, segmentBehavior: "Sets", expectedAttendanceUserTagId: null,
    startsAt: new Date("2026-09-26T11:30:00Z"), endDateTime: new Date("2026-09-26T12:30:00Z"),
    durationMillis: BigInt(3_600_000), isAllDay: false,
    descriptionWikiPageId: null, descriptionWikiPage: null, expectedAttendanceUserTag: null,
    type: null, status: null, visiblePermission: null,
    tags: [], fileTags: [], songLists: [], responses: [], segments: [],
};
const upcoming = {
    ...event, id: 101, publicId: eventPublicId(101),
    startsAt: new Date("2026-09-27T12:00:00Z"), endDateTime: new Date("2026-09-27T13:00:00Z"),
};
const privateEvent = { ...event, id: 102, publicId: eventPublicId(102), createdByUserId: 999 };
const deletedEvent = { ...event, id: 103, publicId: eventPublicId(103), isDeleted: true };
const request = (filter: CMDBTableFilterModel): db3.QueryRequestInput => ({
    table: { tableID: "Event", tableName: "Event", viewID: db3.eventSearchView.viewID },
    filter, orderBy: undefined, cmdbQueryContext: "dashboard-relevant-events-test",
});

beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    relevanceQuery.mockReset().mockResolvedValue([]);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe.each(["normal", "sysadmin"] as const)("dashboard public identities for %s", persona => {
    function seedActor(cancelledStatusIds: number[] = []) {
        const user = createAuthorizationTestUser(persona, persona === "normal" ? {
            id: 42, permissions: [Permission.always_grant, Permission.public, Permission.login, Permission.view_events, Permission.view_events_nonpublic],
        } : { id: 42 });
        authorizationTestDb.reset({
            user: [user],
            role: [{ ...user.role!, isPublicRole: false, isSysAdminRole: persona === "sysadmin",
                isRoleForNewUsers: false, description: "", sortOrder: 1, color: null, significance: null }],
            event: [event, upcoming, privateEvent, deletedEvent],
            eventStatus: cancelledStatusIds.map(id => ({ id, significance: db3.EventStatusSignificance.Cancelled, isDeleted: true })),
        });
        return createAuthorizationTestContext(user);
    }

    it("returns name-only grants and relevance-ranked public IDs that the Event view can fetch", async () => {
        const ctx = seedActor();
        relevanceQuery.mockResolvedValue([upcoming, event].map(row => ({
            publicId: row.publicId, startsAt: row.startsAt, endDateTime: row.endDateTime,
            durationMillis: row.durationMillis, isAllDay: row.isAllDay, relevanceClassOverride: row.relevanceClassOverride,
        })));
        const dto = await invokeResolver(getDashboardData, {}, ctx);
        expect(dto).not.toHaveProperty("effectivePermissionIds");
        expect(new PermissionSet(dto.effectivePermissionNames).includesName(Permission.login)).toBe(true);
        expectTypeOf(dto.relevantEventIds).toEqualTypeOf<EventPublicId[]>();
        expect(dto.relevantEventIds).toEqual([event.publicId, upcoming.publicId]);
        expect(relevanceQuery.mock.calls[0]![0].sql).toMatch(/SELECT\s+e\.publicId,/);
        expect(relevanceQuery.mock.calls[0]![0].sql).not.toMatch(/e\.id\b/);
        expect(relevanceQuery.mock.calls[0]![0].sql).not.toMatch(/NOT IN\s*\(\s*\)/);
        const authorization = await loadAuthorization(ctx.session);
        expect(relevanceQuery.mock.calls[0]![0].sql)
            .toContain(`e.visiblePermissionId IN (${authorization.effectivePermissions.ids.join(",")})`);

        const result = await invokeResolver(db3Query, request({ publicIds: dto.relevantEventIds }), ctx);
        expect(result.items.map(item => item.publicId).sort()).toEqual([...dto.relevantEventIds].sort());
        expect(result.items.every(item => !("id" in item))).toBe(true);

        // Possession of another public ID still cannot bypass private/deleted row policy.
        const restricted = await invokeResolver(db3Query, request({ publicIds: [privateEvent.publicId, deletedEvent.publicId] }), ctx);
        expect(restricted.items).toEqual([]);
    });

    it("preserves empty relevance without broadening the follow-up query", async () => {
        const ctx = seedActor();
        const dto = await invokeResolver(getDashboardData, {}, ctx);
        expect(dto.relevantEventIds).toEqual([]);
        expect((await invokeResolver(db3Query, request({ publicIds: dto.relevantEventIds }), ctx)).items).toEqual([]);
    });

    it("uses retired cancelled statuses when selecting relevant events", async () => {
        await invokeResolver(getDashboardData, {}, seedActor([51, 52]));
        expect(relevanceQuery.mock.calls[0]![0].sql).toContain("e.statusId NOT IN (51, 52)");
    });

    it.each([
        { pks: [event.id] },
        { pks: [] },
        { pks: [event.id], publicIds: [event.publicId] },
        { items: [{ field: "id", operator: "equals", value: event.id }] },
    ] satisfies CMDBTableFilterModel[])("rejects numeric targeting before database execution: %j", async filter => {
        const ctx = seedActor();
        const find = vi.spyOn(authorizationTestDb.getDelegate("event"), "findMany");
        const count = vi.spyOn(authorizationTestDb.getDelegate("event"), "count");
        await expect(invokeResolver(db3Query, request(filter), ctx)).rejects.toThrow("queries require public identity");
        await expect(invokeResolver(db3PaginatedQuery, { ...request(filter), skip: 0, take: 10 }, ctx))
            .rejects.toThrow("queries require public identity");
        expect(find).not.toHaveBeenCalled();
        expect(count).not.toHaveBeenCalled();
    });

    it("retains explicitly trusted natural-key reads on the server", async () => {
        const ctx = seedActor();
        const result = await queryView({
            view: db3.eventSearchView, filter: {}, orderBy: undefined, cmdbQueryContext: "trusted-event-read",
        }, await loadAuthorization(ctx.session), undefined, { trustedNaturalPrimaryKeys: [event.id] });
        expect(result.items.map(row => row.publicId)).toEqual([event.publicId]);
    });
});

it("rejects natural targeting for every migrated table while retaining legacy-table queries", () => {
    for (const table of Object.values(db3.gAllTables).filter(table => !!table.publicIdMember)) {
        const input = { ...request({ pks: [1] }), table: { tableID: table.tableID, tableName: table.tableName } };
        expect(() => validateDB3QueryRequest(input)).toThrow("queries require public identity");
        expect(() => validateDB3QueryRequest({ ...input, filter: { items: [{ field: table.pkMember, operator: "equals", value: 1 }] } }))
            .toThrow("queries require public identity");
    }
    expect(() => validateDB3QueryRequest({ ...request({ publicIds: [userPublicId(1)] }), table: { tableID: "User", tableName: "User" } })).not.toThrow();
});
