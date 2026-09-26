import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("db", async () => {
    const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
    const { authorizationTestDb } = await import("./support/inMemoryPrisma");
    return { ...prisma, default: authorizationTestDb };
});

import * as db3 from "@db3/db3";
import executeCommand from "@db3/mutations/executeDB3Command";
import query from "@db3/queries/db3queries";
import updateGenericSortOrder from "@db3/mutations/updateGenericSortOrder";
import insertEvent from "@db3/mutations/insertEvent";
import { createActionRecord } from "@db3/server/recordActionServer";
import { ActivityFeature, ZTRecordActionArgs } from "src/core/components/featureReports/activityTracking";
import { projectFeatureReportDetailItem, projectGeneralActivityReportDetailItem } from "src/core/components/featureReports/activityReportTypes";
import { Permission } from "shared/permissions";
import { isPublicId } from "shared/publicId";
import { listPublicId, listSongPublicId, listDividerPublicId } from "../support/eventSongListFixtures";
import { eventPublicId } from "../support/eventResponseFixtures";
import { songPublicId } from "../support/songFixtures";
import { createAuthorizationPersona, createAuthorizationTestUser } from "./support/authorizationFixtures";
import { authorizationTestDb } from "./support/inMemoryPrisma";
import { forgeDb3Query } from "./support/db3RequestBuilders";
import { invokeResolver } from "./support/resolverHarness";

const permissions = [Permission.login, Permission.manage_events, Permission.admin_events, Permission.edit_public_homepage, Permission.view_events_nonpublic, Permission.view_songs];
const actor = createAuthorizationTestUser("normal", { id: 93, permissions });
const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions });
const event = {
    id: 100, publicId: eventPublicId(100), name: "Concert", locationDescription: "", isDeleted: false, createdByUserId: null,
    visiblePermissionId: 920_002, revision: 1, calendarInputHash: "unchanged",
    startsAt: null, segments: [],
};
const parentFields = {
    eventId: event.publicId, name: "First set", description: "", sortOrder: 0,
    isActuallyPlayed: false, isOrdered: true,
};
const dividerFields = {
    subtitle: "Break", sortOrder: 1, color: null, isInterruption: true,
    isSong: false, subtitleIfSong: null, lengthSeconds: null, textStyle: null,
};
const song = {
    id: 300, publicId: songPublicId(300), name: "Tune", description: "", aliases: "", isDeleted: false,
    visiblePermissionId: 920_002, createdByUserId: null, tags: [],
    lengthSeconds: 120, startBPM: null, endBPM: null, pinnedRecordingId: null,
};

function reset(overrides: Parameters<typeof authorizationTestDb.reset>[0] = {}) {
    authorizationTestDb.reset({
        user: [actor], event: [event], song: [song],
        eventSongList: [{ id: 50, publicId: listPublicId(50), ...parentFields, eventId: event.id }],
        eventSongListSong: [{ id: 501, publicId: listSongPublicId(501), eventSongListId: 50, songId: 300, sortOrder: 0, subtitle: "Intro" }],
        eventSongListDivider: [{ id: 601, publicId: listDividerPublicId(601), eventSongListId: 50, ...dividerFields }],
        change: [], action: [], setting: [], eventSegment: [], eventStatus: [],
        ...overrides,
    });
}
const save = (payload: unknown) => invokeResolver(executeCommand, {
    commandID: db3.saveEventSongListCommand.commandID, payload,
}, ctx);
const updatePayload = {
    ...parentFields, publicId: listPublicId(50),
    songs: [{ publicId: listSongPublicId(501), songId: songPublicId(300), sortOrder: 0, subtitle: "Edited" }],
    dividers: [{ publicId: listDividerPublicId(601), ...dividerFields }],
};

describe("Event setlist public identities", () => {
    beforeEach(() => { vi.restoreAllMocks(); reset(); });

    it("projects public parent and child identity through a named view", async () => {
        const result = await invokeResolver(query, forgeDb3Query("EventSongList", {
            table: { tableID: "EventSongList", tableName: "EventSongList", viewID: db3.eventSongListDetailView.viewID },
            filter: { items: [], publicIds: [listPublicId(50)] },
        }), ctx);
        const dto = db3.eventSongListDetailView.parseDto(result.items[0]);
        expect(dto).toMatchObject({
            publicId: listPublicId(50),
            songs: [{ publicId: listSongPublicId(501), eventSongListId: listPublicId(50) }],
            dividers: [{ publicId: listDividerPublicId(601), eventSongListId: listPublicId(50) }],
        });
        expect(dto).not.toHaveProperty("id");
        expect(dto.songs?.[0]).not.toHaveProperty("id");
        expect(dto.dividers?.[0]).not.toHaveProperty("id");
        expect(db3.hydrateEventSongListDetailDto(dto).content?.stats.songCount).toBe(1);
    });

    it("keeps existing row identities while inserting mixed new children into an undated event", async () => {
        await save({
            ...updatePayload,
            songs: [...updatePayload.songs, { songId: songPublicId(300), sortOrder: 2, subtitle: "Reprise" }],
            dividers: [...updatePayload.dividers, { ...dividerFields, sortOrder: 3 }],
        });
        expect(authorizationTestDb.snapshot("event")[0]?.calendarInputHash).not.toBe("unchanged");
        for (const { table, persistedId } of [
            { table: "eventSongListSong", persistedId: listSongPublicId(501) },
            { table: "eventSongListDivider", persistedId: listDividerPublicId(601) },
        ]) {
            const rows = authorizationTestDb.snapshot(table);
            expect(rows).toHaveLength(2);
            expect(rows[0]!.publicId).toBe(persistedId);
            expect(isPublicId(rows[1]!.publicId)).toBe(true);
            expect(rows[1]!.publicId).not.toBe(persistedId);
            expect(rows.every(row => row.eventSongListId === 50)).toBe(true);
        }
    });

    it("generates parent and item public IDs for the initial setlist created with an Event", async () => {
        await invokeResolver(insertEvent, {
            event: {
                name: "New concert", locationDescription: "", typeId: null, statusId: null,
                tags: [], expectedAttendanceUserTagId: null, visiblePermissionId: null,
            },
            segment: { name: "First set", description: "", startsAt: null, durationMillis: 0, isAllDay: true },
            songList: [{ songId: songPublicId(300), comment: "Intro" }],
        }, ctx);
        const list = authorizationTestDb.snapshot("eventSongList").find(row => row.id !== 50)!;
        const item = authorizationTestDb.snapshot("eventSongListSong").find(row => row.eventSongListId === list.id)!;
        expect(isPublicId(list.publicId)).toBe(true);
        expect(isPublicId(item.publicId)).toBe(true);
    });

    it.each(["duplicate", "foreign", "unknown"])("rejects %s child IDs and rolls back parent and audit changes", async kind => {
        const before = authorizationTestDb.snapshot("eventSongList");
        const foreign = { id: 502, publicId: listSongPublicId(502), eventSongListId: 51, songId: 300, sortOrder: 0, subtitle: "Other" };
        await authorizationTestDb.getDelegate("eventSongListSong").create({ data: foreign });
        const songs = kind === "duplicate"
            ? [updatePayload.songs[0], updatePayload.songs[0]]
            : [{ ...updatePayload.songs[0], publicId: listSongPublicId(kind === "foreign" ? 502 : 999) }];
        await expect(save({ ...updatePayload, name: "Must roll back", songs })).rejects.toThrow(
            kind === "duplicate" ? "Duplicate persisted IDs" : "does not belong to this setlist",
        );
        expect(authorizationTestDb.snapshot("eventSongList")).toEqual(before);
        expect(authorizationTestDb.snapshot("change")).toEqual([]);
    });

    it("rolls back child deletions and hooks if a later insert fails", async () => {
        const before = ["eventSongList", "eventSongListSong", "eventSongListDivider", "event"].map(table => ({
            table, rows: authorizationTestDb.snapshot(table),
        }));
        vi.spyOn(authorizationTestDb.getDelegate("eventSongListDivider"), "create").mockRejectedValueOnce(new Error("storage failed"));
        await expect(save({ ...updatePayload, songs: [], dividers: [dividerFields] })).rejects.toThrow("storage failed");
        for (const snapshot of before) expect(authorizationTestDb.snapshot(snapshot.table)).toEqual(snapshot.rows);
        expect(authorizationTestDb.snapshot("change")).toEqual([]);
    });

    it("rejects numeric targets and item identities at every write boundary", async () => {
        for (const payload of [
            { ...updatePayload, publicId: 50 },
            { ...updatePayload, id: 50 },
            { ...updatePayload, songs: [{ ...updatePayload.songs[0], publicId: 501 }] },
            { ...updatePayload, dividers: [{ ...dividerFields, id: 601 }] },
        ]) await expect(save(payload)).rejects.toThrow();
        expect(() => db3.deleteEventSongListCommand.parseDto({ publicId: 50 })).toThrow();
        expect(() => db3.reorderEventSongListsCommand.parseDto({ eventId: event.publicId, movingItemId: 50, newPositionItemId: 50, scopeRowIds: [50] })).toThrow();
        await expect(invokeResolver(updateGenericSortOrder, {
            tableID: "EventSongList", tableName: "EventSongList", movingItemId: 50,
            newPositionItemId: 50, scopeRowIds: [50], groupByColumn: "eventId", groupValue: 100,
        }, ctx)).rejects.toThrow("reorder command");
    });

    it("keeps hidden parents inaccessible through reads and all commands", async () => {
        reset({ event: [{ ...event, visiblePermissionId: 999, createdByUserId: 999 }] });
        const result = await invokeResolver(query, forgeDb3Query("EventSongList", {
            table: { tableID: "EventSongList", tableName: "EventSongList", viewID: db3.eventSongListDetailView.viewID },
            filter: { items: [], publicIds: [listPublicId(50)] },
        }), ctx);
        expect(result.items).toEqual([]);
        await expect(save(updatePayload)).rejects.toThrow();
        await expect(invokeResolver(executeCommand, {
            commandID: db3.deleteEventSongListCommand.commandID, payload: { publicId: listPublicId(50) },
        }, ctx)).rejects.toThrow();
        await expect(invokeResolver(executeCommand, {
            commandID: db3.reorderEventSongListsCommand.commandID,
            payload: { eventId: event.publicId, movingItemId: listPublicId(50), newPositionItemId: listPublicId(50), scopeRowIds: [listPublicId(50)] },
        }, ctx)).rejects.toThrow();
        expect(authorizationTestDb.snapshot("change")).toEqual([]);
    });

    it("rejects hidden songs before updating a visible list", async () => {
        reset({ song: [{ ...song, visiblePermissionId: 999, createdByUserId: 999 }] });
        await expect(save(updatePayload)).rejects.toThrow();
        expect(authorizationTestDb.snapshot("change")).toEqual([]);
    });

    it("preserves gaps and leaves out-of-scope lists untouched during reorder", async () => {
        reset({ eventSongList: [
            { ...parentFields, eventId: event.id, id: 50, publicId: listPublicId(50), sortOrder: 2 },
            { ...parentFields, eventId: event.id, id: 51, publicId: listPublicId(51), sortOrder: 8 },
            { ...parentFields, eventId: event.id, id: 52, publicId: listPublicId(52), sortOrder: 5 },
        ] });
        await invokeResolver(executeCommand, {
            commandID: db3.reorderEventSongListsCommand.commandID,
            payload: { eventId: event.publicId, movingItemId: listPublicId(50), newPositionItemId: listPublicId(51), scopeRowIds: [listPublicId(50), listPublicId(51)] },
        }, ctx);
        expect(authorizationTestDb.snapshot("eventSongList").map(row => row.sortOrder)).toEqual([8, 2, 5]);
    });

    it("records public telemetry references as natural foreign keys only on the server", async () => {
        const input = { feature: ActivityFeature.setlist_edit, eventSongListId: listPublicId(50), isClient: true };
        expect(() => ZTRecordActionArgs.parse({ ...input, eventSongListId: 50 })).toThrow();
        await createActionRecord(input);
        expect(authorizationTestDb.snapshot("action")[0]?.eventSongListId).toBe(50);
    });
    it("projects report and CSV setlist references without natural row identity", () => {
        const evidence = {
            id: 900, createdAt: new Date(), feature: ActivityFeature.setlist_edit, isClient: true,
            uri: null, queryText: null, context: null, pointerType: null,
            screenWidth: null, screenHeight: null, deviceClass: null, browserName: null,
            operatingSystem: null, language: null, locale: null, timezone: null,
            user: null, userId: null, instrument: null, instrumentId: null, event: null,
            eventId: null, song: null, songId: null, file: null, fileId: null,
            wikiPage: null, wikiPageId: null, eventSegment: null, eventSegmentId: null,
            attendance: null, attendanceId: null, customLink: null, customLinkId: null,
            frontpageGalleryItem: null, frontpageGalleryItemId: null,
            menuLink: null, menuLinkId: null, setlistPlan: null, setlistPlanId: null,
            songCreditType: null, songCreditTypeId: null, eventSongListId: 50,
            eventSongList: { id: 50, publicId: listPublicId(50), name: "First set", eventId: 100, event: { publicId: event.publicId } },
        };
        const detail = projectFeatureReportDetailItem(evidence);
        const general = projectGeneralActivityReportDetailItem(evidence, null);
        for (const result of [detail, general]) {
            expect(result.eventSongListId).toBe(listPublicId(50));
            expect(result.eventSongList).toEqual({ publicId: listPublicId(50), name: "First set", eventId: event.publicId });
            expect(result.id).toBe(900); // Action keeps its ledger identity.
        }
    });

});
