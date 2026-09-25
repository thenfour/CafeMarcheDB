import { segmentPublicId, segmentResponsePublicId, eventResponsePublicId } from "../support/eventResponseFixtures";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("db", async () => ({
    ...await vi.importActual<typeof import("@prisma/client")>("@prisma/client"),
    default: (await import("./support/inMemoryPrisma")).authorizationTestDb,
}));
vi.mock("src/blitz-server", () => ({ api: (handler: unknown) => handler }));

import * as db3 from "@db3/db3";
import type { TinsertEventArgs, TupdateUserEventAttendanceMutationArgs } from "@db3/shared/apiTypes";
import executeCommand from "@db3/mutations/executeDB3Command";
import insertEvent from "@db3/mutations/insertEvent";
import updateAttendance from "@db3/mutations/updateUserEventAttendanceMutation";
import query from "@db3/queries/db3queries";
import getUserEventAttendance from "@db3/queries/getUserEventAttendance";
import getImportEventData from "@db3/queries/getImportEventData";
import { createActionRecord } from "@db3/server/recordActionServer";
import attendanceApi from "src/pages/api/event/getUserAttendance";
import { ActivityFeature, ZTRecordActionArgs } from "src/core/components/featureReports/activityTracking";
import { projectFeatureReportDetailItem, projectGeneralActivityReportDetailItem } from "src/core/components/featureReports/activityReportTypes";
import { Permission } from "shared/permissions";
import { isPublicId, parsePublicId, type EventAttendancePublicId } from "shared/publicId";
import { attendancePublicId } from "../support/eventAttendanceFixtures";
import { createAuthorizationPersona, createAuthorizationTestUser } from "./support/authorizationFixtures";
import { authorizationTestDb } from "./support/inMemoryPrisma";
import { forgeDb3Query } from "./support/db3RequestBuilders";
import { invokeResolver } from "./support/resolverHarness";

const permissions = [Permission.login, Permission.admin_events, Permission.manage_events,
    Permission.view_events_nonpublic, Permission.respond_to_events, Permission.change_others_event_responses, Permission.edit_public_homepage, Permission.visibility_members];
const actor = createAuthorizationTestUser("normal", { id: 93, permissions });
let { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions });
const statusId = parsePublicId<"EventStatus">("AttendStatus0001");
const attendanceFields = {
    text: "Going", personalText: "I am going", pastText: "Went", pastPersonalText: "I went",
    strength: 100, isActive: true, isDeleted: false, sortOrder: 0, description: "", iconName: null, color: null,
};
const attendance = { id: 2, publicId: attendancePublicId(2), ...attendanceFields };
const event = {
    id: 100, name: "Concert", locationDescription: "", locationURL: "", isDeleted: false, createdByUserId: null,
    visiblePermissionId: 920_002, revision: 1, calendarInputHash: "unchanged",
    startsAt: new Date("2099-01-01T12:00:00Z"), durationMillis: BigInt(3600000), isAllDay: false,
    responses: [], tags: [], songLists: [],
};
const segment = {
    id: 101, publicId: segmentPublicId(101), eventId: event.id, name: "First set", startsAt: event.startsAt,
    durationMillis: event.durationMillis, isAllDay: false, dateTimeVersion: 1, statusId: 8,
};
const response = {
    id: 201, publicId: segmentResponsePublicId(201), eventSegmentId: segment.id, userId: actor.id, attendanceId: attendance.id,
    createdByUserId: actor.id, updatedByUserId: actor.id, createdAt: new Date(), updatedAt: new Date(),
};
function reset(overrides: Parameters<typeof authorizationTestDb.reset>[0] = {}) {
    ctx = createAuthorizationPersona("normal", { id: actor.id, permissions }).ctx;
    authorizationTestDb.reset({
        user: [actor], event: [event], eventSegment: [segment], eventAttendance: [attendance],
        eventStatus: [{ id: 8, publicId: statusId, isDeleted: false, significance: null }],
        eventSegmentUserResponse: [response], eventUserResponse: [], change: [], action: [], setting: [],
        ...overrides,
    });
}
const operations = db3.eventAttendanceEditorView.crud.operations;
const command = (commandID: string, payload: unknown) => invokeResolver(executeCommand, { commandID, payload }, ctx);
const changeResponse = (attendanceId: EventAttendancePublicId | null) =>
    invokeResolver(updateAttendance, { eventId: event.id, userId: actor.id, segmentResponses: { [segment.publicId]: { attendanceId } } }, ctx);

describe("EventAttendance public identities", () => {
    beforeEach(() => { vi.restoreAllMocks(); vi.stubEnv("CMDB_BASE_URL", "https://band.test"); reset(); });
    afterEach(() => { vi.unstubAllEnvs(); });

    it("generates public identities for CRUD and preserves numeric audit keys and soft deletion", async () => {
        const created = operations.create.command.parseResult(await command(operations.create.command.commandID, { ...attendanceFields, text: "Maybe" }));
        expect(isPublicId(created.identity)).toBe(true);
        expect(created).not.toHaveProperty("id");
        expect(await command(operations.update.command.commandID, {
            identity: attendance.publicId, patch: { text: "Attending" },
        })).toEqual({ identity: attendance.publicId });
        expect(await command(operations.delete.command.commandID, { identity: attendance.publicId }))
            .toEqual({ identity: attendance.publicId });
        expect(authorizationTestDb.snapshot("eventAttendance")[0]).toMatchObject({ id: 2, text: "Attending", isDeleted: true });
        expect(authorizationTestDb.snapshot("change")).toEqual(expect.arrayContaining([
            expect.objectContaining({ table: "EventAttendance", recordId: 2 }),
        ]));
    });

    it("rejects numeric query and command identities", async () => {
        await expect(invokeResolver(query, forgeDb3Query("EventAttendance", {
            filter: { items: [], pks: [2] },
        }), ctx)).rejects.toThrow();
        await expect(command(operations.update.command.commandID, { identity: 2, patch: { text: "Forged" } })).rejects.toThrow();
        await expect(command(operations.delete.command.commandID, { identity: 2 })).rejects.toThrow();
        expect(authorizationTestDb.snapshot("change")).toEqual([]);
    });

    it("retains admin and recovery permissions with public targets", async () => {
        reset({ user: [createAuthorizationTestUser("normal", { id: actor.id, permissions: [Permission.login, Permission.respond_to_events] })] });
        await expect(command(operations.update.command.commandID, { identity: attendance.publicId, patch: { text: "Forged" } })).rejects.toThrow();
        reset({ eventAttendance: [{ ...attendance, isDeleted: true }] });
        await expect(command(operations.update.command.commandID, { identity: attendance.publicId, patch: { isDeleted: false } })).rejects.toThrow();
        expect(authorizationTestDb.snapshot("change")).toEqual([]);
    });

    it("projects attendance references in legacy and named Event graphs", async () => {
        for (const table of [
            { tableID: db3.xEventVerbose.tableID, tableName: "Event" },
            { tableID: db3.xEvent.tableID, tableName: "Event", viewID: db3.eventSearchView.viewID },
        ]) {
            const result = await invokeResolver(query, forgeDb3Query(table.tableID, { table }), ctx);
            expect(result.items[0]!.segments[0].responses[0]).toMatchObject({
                publicId: response.publicId, attendanceId: attendance.publicId,
            });
            expect(result.items[0]!.segments[0].responses[0]).not.toHaveProperty("id");
            expect(result.items[0]!.segments[0]).toMatchObject({ publicId: segment.publicId });
            expect(result.items[0]!.segments[0]).not.toHaveProperty("id");
            expect(result.items[0]!.segments[0].responses[0].attendance?.id).toBeUndefined();
        }
    });

    it("treats the current public choice idempotently and allows clearing it", async () => {
        reset({ eventUserResponse: [{ id: 202, publicId: eventResponsePublicId(202), eventId: event.id, userId: actor.id, revision: 1, userComment: "" }] });
        expect(await changeResponse(attendance.publicId)).toMatchObject({ segmentResponses: { [segment.publicId]: { attendanceId: attendance.publicId } } });
        expect(authorizationTestDb.snapshot("change")).toEqual([]);
        await changeResponse(null);
        expect(authorizationTestDb.snapshot("eventSegmentUserResponse")[0]?.attendanceId).toBeNull();
        await changeResponse(attendance.publicId);
        expect(authorizationTestDb.snapshot("eventSegmentUserResponse")[0]?.attendanceId).toBe(2);
    });

    it("resolves a shared choice once for several segments", async () => {
        reset({ eventSegment: [segment, { ...segment, id: 102, publicId: segmentPublicId(102) }], eventSegmentUserResponse: [] });
        const lookup = vi.spyOn(authorizationTestDb.getDelegate("eventAttendance"), "findMany");
        await invokeResolver(updateAttendance, { eventId: event.id, userId: actor.id,
            segmentResponses: { [segment.publicId]: { attendanceId: attendance.publicId }, [segmentPublicId(102)]: { attendanceId: attendance.publicId } },
        }, ctx);
        expect(lookup).toHaveBeenCalledTimes(1);
        expect(authorizationTestDb.snapshot("eventSegmentUserResponse").map(row => row.attendanceId)).toEqual([2, 2]);
    });

    it.each(["numeric", "unknown", "deleted"])("rejects a %s choice before any response write", async kind => {
        reset({
            eventSegment: [segment, { ...segment, id: 102, publicId: segmentPublicId(102) }],
            eventAttendance: [attendance, { ...attendance, id: 3, publicId: attendancePublicId(3), isDeleted: true }],
            eventSegmentUserResponse: [],
        });
        const create = vi.spyOn(authorizationTestDb.getDelegate("eventSegmentUserResponse"), "create");
        const badChoice = kind === "numeric" ? 2 : attendancePublicId(kind === "deleted" ? 3 : 999);
        // Forged transport data deliberately bypasses the branded client type.
        await expect(invokeResolver(updateAttendance, {
            eventId: event.id, userId: actor.id, comment: "Must not be saved",
            segmentResponses: { [segment.publicId]: { attendanceId: attendance.publicId }, [segmentPublicId(102)]: { attendanceId: badChoice } },
        } as unknown as TupdateUserEventAttendanceMutationArgs, ctx)).rejects.toThrow();
        expect(create).not.toHaveBeenCalled();
        expect(authorizationTestDb.snapshot("eventUserResponse")).toEqual([]);
        expect(authorizationTestDb.snapshot("change")).toEqual([]);
    });

    it("projects user attendance report references", async () => {
        const result = await invokeResolver(getUserEventAttendance, { userId: actor.id, take: 100 }, ctx);
        expect(result.events[0]!.segments[0]).toMatchObject({ attendanceId: attendance.publicId, statusId });
    });

    it("projects attendance and status references in the HTTP API and completes the request", async () => {
        const json = vi.fn();
        // The API wrapper is replaced above; the handler only consumes query, status/json, and context.
        const handler = attendanceApi as unknown as (req: { query: { userId: string; eventId: string } },
            res: { status: (code: number) => { json: typeof json } }, context: typeof ctx) => Promise<void>;
        const status = vi.fn(() => ({ json }));
        await handler({ query: { userId: String(actor.id), eventId: String(event.id) } }, { status }, ctx);
        expect(status).toHaveBeenCalledWith(200);
        expect(json).toHaveBeenCalledWith(expect.objectContaining({
            segmentResponses: [expect.objectContaining({ attendanceId: attendance.publicId, statusId })],
        }));
    });

    it("resolves initial event response choices and rolls back event creation for invalid choices", async () => {
        const input: TinsertEventArgs = {
            event: { name: "New concert", locationDescription: "", typeId: null, statusId: null,
                tags: [], expectedAttendanceUserTagId: null, visiblePermissionId: null },
            segment: { name: "First set", description: "", startsAt: null, durationMillis: 0, isAllDay: true },
            responses: [{ userId: actor.id, attendanceId: attendance.publicId }],
        };
        const created = await invokeResolver(insertEvent, input, ctx);
        expect(isPublicId(created.segment.publicId)).toBe(true);
        expect(created.segment).not.toHaveProperty("id");
        expect(authorizationTestDb.snapshot("eventSegmentUserResponse").every(row => isPublicId(row.publicId))).toBe(true);
        expect(authorizationTestDb.snapshot("eventSegmentUserResponse")[1]?.attendanceId).toBe(2);
        const before = ["event", "eventSegment", "eventSegmentUserResponse", "change"].map(table => ({ table, rows: authorizationTestDb.snapshot(table) }));
        for (const invalid of [2, attendancePublicId(999)]) {
            // This asserts that a forged numeric choice fails the server boundary too.
            await expect(invokeResolver(insertEvent, { ...input, responses: [{ userId: actor.id, attendanceId: invalid }] } as unknown as TinsertEventArgs, ctx)).rejects.toThrow();
            for (const snapshot of before) expect(authorizationTestDb.snapshot(snapshot.table)).toEqual(snapshot.rows);
        }
    });

    it("returns public response choices from import preview", async () => {
        const admin = createAuthorizationTestUser("sysadmin", { id: 94 });
        reset({ user: [admin, { ...actor, name: "carl" }],
            eventStatus: [{ id: 8, publicId: statusId, isDeleted: false, significance: db3.EventStatusSignificance.FinalConfirmation }],
            eventAttendance: [attendance,
            { ...attendance, id: 3, publicId: attendancePublicId(3), strength: 0 }],
        });
        const { ctx: adminCtx } = createAuthorizationPersona("sysadmin", { id: admin.id });
        const result = await invokeResolver(getImportEventData, { config: "", text: "Gig\ncarl" }, adminCtx);
        expect(result.responses).toEqual([expect.objectContaining({ userId: actor.id, attendanceId: attendance.publicId })]);
    });

    it("stores telemetry references as numeric foreign keys and projects report and CSV references as public", async () => {
        const input = { feature: ActivityFeature.attendance_response, attendanceId: attendance.publicId, isClient: true };
        expect(() => ZTRecordActionArgs.parse({ ...input, attendanceId: 2 })).toThrow();
        await createActionRecord(input);
        expect(authorizationTestDb.snapshot("action")[0]?.attendanceId).toBe(2);
        const evidence = {
            id: 900, createdAt: new Date(), feature: ActivityFeature.attendance_response, isClient: true,
            uri: null, queryText: null, context: null, pointerType: null, screenWidth: null, screenHeight: null,
            deviceClass: null, browserName: null, operatingSystem: null, language: null, locale: null, timezone: null,
            user: null, userId: null, instrument: null, instrumentId: null, event: null, eventId: null,
            song: null, songId: null, file: null, fileId: null, wikiPage: null, wikiPageId: null,
            eventSegment: null, eventSegmentId: null, attendance, attendanceId: attendance.id,
            customLink: null, customLinkId: null, frontpageGalleryItem: null, frontpageGalleryItemId: null,
            menuLink: null, menuLinkId: null, setlistPlan: null, setlistPlanId: null, songCreditType: null,
            songCreditTypeId: null, eventSongList: null, eventSongListId: null,
        };
        for (const report of [projectFeatureReportDetailItem(evidence), projectGeneralActivityReportDetailItem(evidence, null)]) {
            expect(report).toMatchObject({ id: 900, attendanceId: attendance.publicId, attendance: { publicId: attendance.publicId } });
            expect(report.attendance).not.toHaveProperty("id");
        }
    });
});
