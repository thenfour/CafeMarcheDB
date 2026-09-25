import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("db", async () => {
    const { authorizationTestDb } = await import("./support/inMemoryPrisma");
    return {
        ...await vi.importActual<typeof import("@prisma/client")>("@prisma/client"),
        default: new Proxy(authorizationTestDb, {
            get(target, property) {
                const value = Reflect.get(target, property);
                if (!forbidOuterWrites || typeof value !== "object" || value === null) return value;
                return new Proxy(value, {
                    get(delegate, method) {
                        if (["create", "createMany", "update", "updateMany", "delete", "deleteMany"].includes(String(method))) {
                            return () => { throw new Error("Write escaped the transaction"); };
                        }
                        return Reflect.get(delegate, method);
                    },
                });
            },
        }),
    };
});

import * as db3 from "@db3/db3";
import executeCommand from "@db3/mutations/executeDB3Command";
import query from "@db3/queries/db3queries";
import copyResponses from "@db3/mutations/copyEventSegmentResponses";
import clearResponses from "@db3/mutations/clearEventSegmentResponses";
import updateAttendance from "@db3/mutations/updateUserEventAttendanceMutation";
import { createActionRecord } from "@db3/server/recordActionServer";
import { ActivityFeature, ZTRecordActionArgs } from "src/core/components/featureReports/activityTracking";
import { projectFeatureReportDetailItem, projectGeneralActivityReportDetailItem } from "src/core/components/featureReports/activityReportTypes";
import { isPublicId } from "shared/publicId";
import { Permission } from "shared/permissions";
import { eventPublicId, segmentPublicId, segmentResponsePublicId, eventResponsePublicId } from "../support/eventResponseFixtures";
import { attendancePublicId } from "../support/eventAttendanceFixtures";
import { createAuthorizationPersona, createAuthorizationTestUser } from "./support/authorizationFixtures";
import { authorizationTestDb } from "./support/inMemoryPrisma";
import { forgeDb3Query } from "./support/db3RequestBuilders";
import { invokeResolver } from "./support/resolverHarness";

let forbidOuterWrites = false;
const permissions = [Permission.login, Permission.manage_events, Permission.admin_events, Permission.view_events_nonpublic,
    Permission.respond_to_events, Permission.change_others_event_responses];
const actor = createAuthorizationTestUser("normal", { id: 93, permissions });
let { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions });
const event = { id: 100, publicId: eventPublicId(100), name: "Concert", locationDescription: "", locationURL: "", isDeleted: false,
    createdByUserId: null, visiblePermissionId: 920_002, revision: 1, calendarInputHash: "old", startsAt: null };
const segment = (id: number, eventId = event.id) => ({ id, publicId: segmentPublicId(id), eventId, name: `Set ${id}`,
    description: "", startsAt: null, durationMillis: BigInt(0), isAllDay: false, statusId: null,
    dateTimeVersion: 1, uid: `calendar-segment-${id}` });
const response = (id: number, segmentId: number, userId: number) => ({ id, publicId: segmentResponsePublicId(id),
    eventSegmentId: segmentId, userId, attendanceId: 2, createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"),
    createdByUserId: actor.id, updatedByUserId: actor.id });
const eventResponse = { id: 301, publicId: eventResponsePublicId(301), eventId: event.id, userId: actor.id,
    instrumentId: null, userComment: "hello", isInvited: true, revision: 1 };
function reset(overrides: Parameters<typeof authorizationTestDb.reset>[0] = {}) {
    ctx = createAuthorizationPersona("normal", { id: actor.id, permissions }).ctx;
    authorizationTestDb.reset({ user: [actor], event: [event], eventSegment: [segment(1), segment(2)],
        eventSegmentUserResponse: [response(11, 1, actor.id), response(12, 1, 94), response(21, 2, 95)],
        eventUserResponse: [eventResponse], eventAttendance: [{ id: 2, publicId: attendancePublicId(2), isDeleted: false }],
        eventStatus: [], setting: [], change: [], action: [], ...overrides });
}
const copy = () => invokeResolver(copyResponses, { fromEventSegmentId: segmentPublicId(1), toEventSegmentId: segmentPublicId(2) }, ctx);
const clear = () => invokeResolver(clearResponses, { eventSegmentId: segmentPublicId(2) }, ctx);
const operations = db3.eventSegmentEditorView.crud.operations;
const command = (commandID: string, payload: unknown) => invokeResolver(executeCommand, { commandID, payload }, ctx);
const snapshots = () => ["event", "eventSegment", "eventSegmentUserResponse", "eventUserResponse", "change"]
    .map(table => authorizationTestDb.snapshot(table));

describe("Event segment and response public identities", () => {
    beforeEach(() => { vi.restoreAllMocks(); forbidOuterWrites = false; vi.stubEnv("CMDB_BASE_URL", "https://band.test"); reset(); });
    afterEach(() => { forbidOuterWrites = false; vi.unstubAllEnvs(); });

    it("generates segment identities for CRUD while audit keys stay numeric", async () => {
        const created = operations.create.command.parseResult(await command(operations.create.command.commandID, {
            eventId: event.publicId, name: "Third set", description: "", startsAt: null, durationMillis: BigInt(0), isAllDay: false,
        }));
        expect(isPublicId(created.identity)).toBe(true);
        expect(await command(operations.update.command.commandID, { identity: created.identity, patch: { name: "Encore" } }))
            .toEqual({ identity: created.identity });
        expect(await command(operations.delete.command.commandID, { identity: created.identity })).toEqual({ identity: created.identity });
        expect(authorizationTestDb.snapshot("eventSegment")).toHaveLength(2);
        expect(authorizationTestDb.snapshot("change")).toEqual(expect.arrayContaining([
            expect.objectContaining({ table: "EventSegment", recordId: 3 }),
        ]));
    });

    it("projects the standalone segment and both response views", async () => {
        for (const view of [db3.eventSegmentEditorView, db3.eventSegmentUserResponseView, db3.eventUserResponseView]) {
            const result = await invokeResolver(query, forgeDb3Query(view.entity.tableID, {
                table: { tableID: view.entity.tableID, tableName: view.entity.tableName, viewID: view.viewID },
            }), ctx);
            expect(result.items.length).toBeGreaterThan(0);
            for (const row of result.items) {
                expect(isPublicId(row.publicId)).toBe(true);
                expect(row).not.toHaveProperty("id");
                view.parseDto(row);
                if ("eventSegmentId" in row) expect(isPublicId(row.eventSegmentId)).toBe(true);
            }
        }
    });

    it.each(["hidden", "deleted"])("excludes children of a %s event from direct queries and mutations", async kind => {
        reset({ event: [{ ...event, isDeleted: kind === "deleted", visiblePermissionId: null }] });
        for (const table of ["EventSegment", "EventSegmentUserResponse", "EventUserResponse"]) {
            expect((await invokeResolver(query, forgeDb3Query(table), ctx)).items).toEqual([]);
        }
        const before = snapshots();
        await expect(copy()).rejects.toThrow();
        await expect(clear()).rejects.toThrow();
        await expect(command(operations.update.command.commandID, { identity: segmentPublicId(1), patch: { name: "Hidden" } })).rejects.toThrow();
        expect(snapshots()).toEqual(before);
    });

    it("rejects numeric identities at query, CRUD, copy, and clear boundaries", async () => {
        const before = snapshots();
        for (const table of ["EventSegment", "EventSegmentUserResponse", "EventUserResponse"]) {
            await expect(invokeResolver(query, forgeDb3Query(table, { filter: { items: [], pks: [1] } }), ctx)).rejects.toThrow();
        }
        await expect(command(operations.update.command.commandID, { identity: 1, patch: { name: "Bad" } })).rejects.toThrow();
        // Deliberately forged transport values test server validation, independent of branded client types.
        await expect(invokeResolver(copyResponses, { fromEventSegmentId: 1, toEventSegmentId: 2 } as never, ctx)).rejects.toThrow();
        await expect(invokeResolver(clearResponses, { eventSegmentId: 2 } as never, ctx)).rejects.toThrow();
        expect(snapshots()).toEqual(before);
    });

    it.each(["numeric", "malformed", "unknown", "other-event"])("rejects %s attendance map keys before writing", async kind => {
        reset({ eventSegment: [segment(1), segment(2, 999)] });
        const badKey = kind === "numeric" ? "2" : kind === "malformed" ? "bad" : segmentPublicId(kind === "unknown" ? 999 : 2);
        const before = snapshots();
        const create = vi.spyOn(authorizationTestDb.getDelegate("eventSegmentUserResponse"), "create");
        await expect(invokeResolver(updateAttendance, { eventId: event.publicId, userId: actor.id, comment: "Must not save",
            segmentResponses: { [segmentPublicId(1)]: { attendanceId: null }, [badKey]: { attendanceId: null } },
        }, ctx)).rejects.toThrow();
        expect(create).not.toHaveBeenCalled();
        expect(snapshots()).toEqual(before);
    });

    it("assigns public IDs when creating both response kinds", async () => {
        reset({ eventUserResponse: [], eventSegmentUserResponse: [] });
        await invokeResolver(updateAttendance, { eventId: event.publicId, userId: actor.id, comment: "New response",
            segmentResponses: { [segmentPublicId(1)]: { attendanceId: attendancePublicId(2) } } }, ctx);
        for (const table of ["eventUserResponse", "eventSegmentUserResponse"]) {
            expect(isPublicId(authorizationTestDb.snapshot(table)[0]!.publicId)).toBe(true);
        }
        expect(authorizationTestDb.snapshot("eventSegmentUserResponse")[0]).toMatchObject({ eventSegmentId: 1, attendanceId: 2 });
    });

    it("copies fresh response identities and clears only the target using transaction delegates", async () => {
        forbidOuterWrites = true;
        await copy();
        const rows = authorizationTestDb.snapshot("eventSegmentUserResponse");
        const target = rows.filter(row => row.eventSegmentId === 2);
        expect(target.map(row => row.userId)).toEqual([actor.id, 94]);
        expect(target.every(row => isPublicId(row.publicId))).toBe(true);
        expect(new Set(rows.map(row => row.publicId)).size).toBe(4);
        expect(target.some(row => row.publicId === segmentResponsePublicId(21))).toBe(false);
        await clear();
        expect(authorizationTestDb.snapshot("eventSegmentUserResponse")).toEqual([response(11, 1, actor.id), response(12, 1, 94)]);
        expect(authorizationTestDb.snapshot("change")).toEqual(expect.arrayContaining([
            expect.objectContaining({ table: "EventSegmentUserResponse", recordId: 2 }),
        ]));
    });

    it("rejects self-copy, cross-event copy, unknown targets, and revoked admin permission", async () => {
        await expect(invokeResolver(copyResponses, { fromEventSegmentId: segmentPublicId(1), toEventSegmentId: segmentPublicId(1) }, ctx)).rejects.toThrow();
        reset({ event: [event, { ...event, id: 999 }], eventSegment: [segment(1), segment(2, 999)] });
        await expect(copy()).rejects.toThrow("same event");
        reset({ eventSegment: [segment(1)] });
        await expect(copy()).rejects.toThrow("not found");
        await expect(clear()).rejects.toThrow("not found");
        const revokedActor = createAuthorizationTestUser("normal", { id: actor.id, permissions: [Permission.login] });
        reset({ user: [revokedActor] });
        ctx = createAuthorizationPersona("normal", { id: actor.id, permissions: [Permission.login] }).ctx;
        await expect(copy()).rejects.toThrow();
        await expect(clear()).rejects.toThrow();
        expect(authorizationTestDb.snapshot("change")).toEqual([]);
    });

    it.each(["copy-create", "copy-hook", "copy-audit", "clear-hook", "clear-audit"])("rolls back %s failure", async point => {
        forbidOuterWrites = true;
        const before = snapshots();
        if (point.endsWith("create")) {
            const delegate = authorizationTestDb.getDelegate("eventSegmentUserResponse");
            const create = delegate.create.bind(delegate);
            vi.spyOn(delegate, "create").mockImplementationOnce(create).mockRejectedValueOnce(new Error("Injected failure"));
        } else {
            const delegate = authorizationTestDb.getDelegate(point.endsWith("hook") ? "event" : "change");
            vi.spyOn(delegate, point.endsWith("hook") ? "update" : "create").mockRejectedValueOnce(new Error("Injected failure"));
        }
        await expect(point.startsWith("copy") ? copy() : clear()).rejects.toThrow("Injected failure");
        expect(snapshots()).toEqual(before);
    });

    it("resolves telemetry to natural keys and projects public report references", async () => {
        const input = { feature: ActivityFeature.attendance_response, eventSegmentId: segmentPublicId(1), isClient: true };
        expect(() => ZTRecordActionArgs.parse({ ...input, eventSegmentId: 1 })).toThrow();
        await createActionRecord(input);
        expect(authorizationTestDb.snapshot("action")[0]?.eventSegmentId).toBe(1);
        const evidence = { id: 900, createdAt: new Date(), feature: input.feature, isClient: true,
            uri: null, queryText: null, context: null, pointerType: null, screenWidth: null, screenHeight: null,
            deviceClass: null, browserName: null, operatingSystem: null, language: null, locale: null, timezone: null,
            user: null, userId: null, instrument: null, instrumentId: null, event: null, eventId: null,
            song: null, songId: null, file: null, fileId: null, wikiPage: null, wikiPageId: null,
            eventSegment: { ...segment(1), event: { publicId: event.publicId } }, eventSegmentId: 1, attendance: null, attendanceId: null,
            customLink: null, customLinkId: null, frontpageGalleryItem: null, frontpageGalleryItemId: null,
            menuLink: null, menuLinkId: null, setlistPlan: null, setlistPlanId: null, songCreditType: null,
            songCreditTypeId: null, eventSongList: null, eventSongListId: null };
        for (const report of [projectFeatureReportDetailItem(evidence), projectGeneralActivityReportDetailItem(evidence, null)]) {
            expect(report.eventSegmentId).toBe(segmentPublicId(1));
            expect(report.eventSegment).toMatchObject({ publicId: segmentPublicId(1), eventId: event.publicId });
            expect(report.eventSegment).not.toHaveProperty("id");
        }
    });
});
