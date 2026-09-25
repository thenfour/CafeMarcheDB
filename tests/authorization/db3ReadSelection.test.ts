import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("db", async () => {
    const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
    const { authorizationTestDb } = await import("./support/inMemoryPrisma");
    return { ...prisma, default: authorizationTestDb };
});

import * as db3 from "src/core/db3/db3";
import { db3Server } from "src/core/db3/server/db3Server";
import { queryTable, queryHydratedView } from "src/core/db3/server/db3QueryCore";
import { authorizeAndProjectDB3ViewModel } from "src/core/db3/server/db3PublicIds";
import type { TransactionalPrismaClient } from "src/core/db3/shared/apiTypes";
import type { DB3ReadSelectionArgs } from "src/core/db3/shared/core/db3ReadSelection";
import { getRequestAuthorization } from "src/auth/server/requestAuthorization";
import { Permission } from "shared/permissions";
import { eventPublicId, segmentPublicId } from "../support/eventResponseFixtures";
import { selectPrismaTestRow } from "../support/prismaSelection";
import { createAuthorizationPersona } from "./support/authorizationFixtures";
import { authorizationTestDb } from "./support/inMemoryPrisma";

afterEach(() => { vi.restoreAllMocks(); });

const event = {
    id: 100, publicId: eventPublicId(100), name: "Rehearsal", revision: 1,
    createdAt: new Date("2026-09-25T12:00:00Z"), createdByUserId: 93,
    isDeleted: false, visiblePermissionId: null,
    locationDescription: "", locationURL: "", typeId: null, statusId: null,
    relevanceClassOverride: null, segmentBehavior: "Sets", expectedAttendanceUserTagId: null,
    startsAt: new Date("2026-09-26T12:00:00Z"), durationMillis: BigInt(3_600_000), isAllDay: false,
    frontpageVisible: false, frontpageDate: "", frontpageTime: "", frontpageDetails: "",
    frontpageTitle: null, frontpageLocation: null, frontpageLocationURI: null, frontpageTags: null,
    frontpageDate_nl: null, frontpageTime_nl: null, frontpageDetails_nl: null,
    frontpageTitle_nl: null, frontpageLocation_nl: null, frontpageLocationURI_nl: null, frontpageTags_nl: null,
    frontpageDate_fr: null, frontpageTime_fr: null, frontpageDetails_fr: null,
    frontpageTitle_fr: null, frontpageLocation_fr: null, frontpageLocationURI_fr: null, frontpageTags_fr: null,
    descriptionWikiPageId: null, descriptionWikiPage: null, expectedAttendanceUserTag: null,
    type: null, status: null, visiblePermission: null,
    tags: [], fileTags: [], songLists: [], responses: [],
};
const segment = {
    id: 101, publicId: segmentPublicId(101), eventId: event.id, name: "Main set", description: "",
    startsAt: event.startsAt, durationMillis: event.durationMillis, isAllDay: false,
    statusId: null, status: null, uid: "segment-uid", responses: [],
};

function strictEventDatabase() {
    const delegate = authorizationTestDb.getDelegate("event");
    const findMany = vi.fn(async (args: DB3ReadSelectionArgs) => {
        const rows = await delegate.findMany({ ...args, select: args.select ?? undefined, include: args.include ?? undefined });
        return rows.map(row => selectPrismaTestRow(row, args));
    });
    // The query only uses Event; the real test delegate handles filtering and
    // relations, then our projector enforces Prisma's explicit select shape.
    const database = { Event: { findMany } } as unknown as TransactionalPrismaClient;
    return { database, findMany };
}

describe("DB3 read execution dependencies", () => {
    it.each(["normal", "sysadmin"] as const)("hydrates Event_Detail with public parent references for %s", async persona => {
        const actor = createAuthorizationPersona(persona, {
            id: 93, permissions: [Permission.login, Permission.view_events_nonpublic, Permission.respond_to_events],
        });
        authorizationTestDb.reset({ user: [actor.user!], event: [event], eventSegment: [segment] });
        const { database, findMany } = strictEventDatabase();
        const result = await queryHydratedView({
            view: db3.eventDetailView, filter: { items: [], publicIds: [event.publicId] },
            orderBy: undefined, cmdbQueryContext: "event-detail-dependency-test",
        }, await getRequestAuthorization(actor.ctx.session), db3.createDashboardReferenceStore(), database);

        expect(result.items).toHaveLength(1);
        expect(result.items[0]!.segments[0]).toMatchObject({
            publicId: segment.publicId, eventId: event.publicId,
        });
        expect(result.items[0]).not.toHaveProperty("id");
        expect(result.items[0]!.segments[0]).not.toHaveProperty("id");
        expect(result.items[0]!.segments[0]).not.toHaveProperty("event");
        expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
            select: expect.objectContaining({
                segments: expect.objectContaining({
                    select: expect.objectContaining({
                        event: { select: { publicId: true, createdByUserId: true, visiblePermissionId: true, isDeleted: true } },
                    }),
                }),
            }),
        }));
    });

    it("returns Event_Search rows in SQL order without exposing the execution-only natural key", async () => {
        const actor = createAuthorizationPersona("normal", {
            id: 93, permissions: [Permission.login, Permission.view_events_nonpublic],
        });
        const second = { ...event, id: 102, publicId: eventPublicId(102) };
        authorizationTestDb.reset({ user: [actor.user!], event: [event, second] });
        const { database, findMany } = strictEventDatabase();
        const input = {
            table: { tableID: "Event", tableName: "Event", viewID: db3.eventSearchView.viewID },
            filter: { items: [] }, orderBy: undefined, cmdbQueryContext: "event-search-order-test",
        };
        const auth = await getRequestAuthorization(actor.ctx.session);
        const result = await queryTable(input, auth, database, {
            orderedPrimaryKeys: [102, 999, 100], trustedNaturalPrimaryKeys: [102, 999, 100],
        });
        expect(result.items.map(item => item.publicId)).toEqual([second.publicId, event.publicId]);
        expect(result.items.every(item => !("id" in item))).toBe(true);
        expect(findMany.mock.calls[0]![0].select?.id).toBe(true);

        await queryTable(input, auth, database);
        expect(findMany.mock.calls[1]![0].select?.id).toBeUndefined();

        // A broken delegate must fail clearly rather than turn existing rows into [].
        findMany.mockResolvedValueOnce([{ publicId: event.publicId }]);
        await expect(queryTable(input, auth, database, { orderedPrimaryKeys: [100] }))
            .rejects.toThrow("missing required primary key 'id'");
    });

    it("preserves include/default selects and trims only added support fields", () => {
        const include = { include: { segments: { select: { publicId: true, event: { select: { publicId: true } } } } } };
        const before = structuredClone(include);
        const plan = db3Server.table(db3.xEvent).prepareReadSelection(include, ["id"]);
        expect(plan.selection).not.toHaveProperty("select");
        expect(plan.selection).toMatchObject({ include: { segments: { select: { event: { select: {
            publicId: true, createdByUserId: true, visiblePermissionId: true, isDeleted: true,
        } } } } } });
        expect(include).toEqual(before);
        expect(plan.stripSupportFields({ ...event, segments: [{ ...segment, event }] })).toMatchObject({
            id: event.id, segments: [{ event: { publicId: event.publicId } }],
        });
        const normalized = plan.stripSupportFields({ segments: [{ event: {
            publicId: event.publicId, createdByUserId: 93, visiblePermissionId: null, isDeleted: false,
        } }] });
        expect(normalized).toStrictEqual({ segments: [{ event: { publicId: event.publicId } }] });
        expect(plan.stripSupportFields({ segments: [{ event: null }] })).toStrictEqual({ segments: [{ event: null }] });
        expect(plan.stripSupportFields({ segments: [] })).toStrictEqual({ segments: [] });

        const implicit = {};
        expect(db3Server.table(db3.xEvent).prepareReadSelection(implicit, ["id"]).selection).toBe(implicit);
        const scalarPlan = db3Server.table(db3.xSong).prepareReadSelection({ select: { name: true, id: false } }, ["id"]);
        expect(scalarPlan.selection.select).toMatchObject({ id: true, createdByUserId: true, visiblePermissionId: true, isDeleted: true });
        expect(scalarPlan.stripSupportFields({ id: 10, name: "Song", createdByUserId: 93, visiblePermissionId: null, isDeleted: false }))
            .toEqual({ name: "Song" });
    });

    it("does not expose added ordering or authorization fields through a legacy selected read", async () => {
        const actor = createAuthorizationPersona("normal", { id: 93, permissions: [Permission.login, Permission.view_songs] });
        authorizationTestDb.reset({ user: [actor.user!] });
        vi.spyOn(db3.xSong, "getSelectionArgs").mockReturnValue({ select: { name: true, id: false } });
        const findMany = vi.fn(async (args: DB3ReadSelectionArgs) => [selectPrismaTestRow({
            id: 10, name: "Song", createdByUserId: 93, visiblePermissionId: null, isDeleted: false,
        }, args)]);
        // This test exercises only the dynamically selected Song read delegate.
        const database = { Song: { findMany } } as unknown as TransactionalPrismaClient;
        const result = await queryTable({
            table: { tableID: "Song", tableName: "Song" }, filter: { items: [] },
            orderBy: undefined, cmdbQueryContext: "legacy-selected-read-test",
        }, await getRequestAuthorization(actor.ctx.session), database, { orderedPrimaryKeys: [10] });
        expect(result.items).toStrictEqual([{ name: "Song" }]);
        expect(findMany.mock.calls[0]![0].select).toEqual({
            name: true, id: true, createdByUserId: true, visiblePermissionId: true, isDeleted: true,
        });
    });

    it.each(["createdByUserId", "visiblePermissionId", "isDeleted"])("diagnoses missing %s before authorization", member => {
        const { schemaAuthorization } = createAuthorizationPersona("sysadmin");
        const partial = { ...event, [member]: undefined };
        expect(() => authorizeAndProjectDB3ViewModel(db3.xEvent, partial, schemaAuthorization, "missing-policy-test"))
            .toThrow(`Event.${member}' is missing required authorization data`);
    });

    it.each(["private", "deleted", "visible"])("keeps projection-only target authorization for a %s Event", visibility => {
        const { schemaAuthorization } = createAuthorizationPersona("normal", {
            id: 93, permissions: [Permission.login, Permission.view_events_nonpublic],
        });
        const derived = db3.deriveViewContract(db3.xEventSegment, {
            select: { publicId: true, eventId: true },
        });
        const parent = { ...event, createdByUserId: visibility === "private" ? 999 : 93, isDeleted: visibility === "deleted" };
        const fetched = selectPrismaTestRow({ ...segment, event: parent }, derived.prismaSelection);
        const projected = authorizeAndProjectDB3ViewModel(db3.xEventSegment, fetched, schemaAuthorization, "parent-policy-test");
        const dto = derived.dtoSchema.parse(projected);
        expect(dto).toEqual(visibility === "visible"
            ? { publicId: segment.publicId, eventId: event.publicId }
            : { publicId: segment.publicId });
    });
});
