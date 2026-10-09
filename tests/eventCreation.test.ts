import { describe, expect, it } from "vitest";
import { parsePublicId } from "shared/publicId";
import { ZinsertEventArgs, type TinsertEventArgs } from "src/core/db3/shared/apiTypes";
import { GenericIntegerField } from "src/core/db3/shared/columnTypes/genericInteger";
import { createAuthContextMap_GrantAll } from "src/core/db3/shared/db3core";
import { xEvent } from "src/core/db3/db3";

const args: TinsertEventArgs = {
    bandPublicId: parsePublicId<"Band">("CreationBand0001"),
    event: { name: "Concert", locationDescription: null, typeId: null, statusId: null, tags: [], expectedAttendanceUserTagId: null, visiblePermissionId: null },
    segment: { name: "", description: "", startsAt: null, durationMillis: 0, isAllDay: true },
};

describe("event creation transport", () => {
    it("offers tag choices before a new event has a server-generated identity", () => {
        const tags = xEvent.getColumn("tags");
        if (!tags) {
            throw new Error("Event tags must use the shared association field.");
        }
        const tagId = parsePublicId<"EventTag">("CreationTag00001");
        const tag = { publicId: tagId };
        const draft = tags.createMockAssociation({}, tag);
        expect(draft).not.toHaveProperty("eventId");
        expect(draft).not.toHaveProperty("publicId");
        expect(tags.getForeignIdentity(draft)).toBe(tagId);
        const eventId = parsePublicId<"Event">("CreationEvent001");
        expect(tags.createMockAssociation({ publicId: eventId }, tag)).toMatchObject({ eventId });
        expect(() => tags.createMockAssociation({ publicId: 42 }, tag)).toThrow();
    });
    it("validates BigInt-backed durations without applying Prisma Int's range", () => {
        const field = new GenericIntegerField({ columnName: "durationMillis", allowNull: false, readTransportType: "bigint", authMap: createAuthContextMap_GrantAll() });
        for (const value of [3_000_000_000, BigInt(3_000_000_000), "3000000000"]) {
            expect(field.ValidateAndParse({ row: { durationMillis: value }, mode: "new" })).toMatchObject({ result: "success", values: { durationMillis: 3_000_000_000 } });
        }
        for (const value of [1.5, Infinity, Number.MAX_SAFE_INTEGER + 1, BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1)]) {
            expect(field.ValidateAndParse({ row: { durationMillis: value }, mode: "new" }).result).toBe("error");
        }
    });
    it("accepts undated events and precise durations beyond a 32-bit integer", () => {
        expect(ZinsertEventArgs.parse(args)).toEqual(args);
        expect(ZinsertEventArgs.parse({ ...args, segment: { ...args.segment, durationMillis: 3_000_000_000 } }).segment.durationMillis).toBe(3_000_000_000);
    });
    it.each([
        { ...args, bandPublicId: undefined }, { ...args, bandPublicId: 1 }, { ...args, bandId: 1 },
        { ...args, event: { ...args.event, bandId: 1 } }, { ...args, event: { ...args.event, publicId: "CreationEvent001" } },
        { ...args, event: { ...args.event, typeId: 1 } }, { ...args, event: { ...args.event, name: " " } },
        { ...args, segment: { ...args.segment, durationMillis: -1 } }, { ...args, segment: { ...args.segment, durationMillis: 1.5 } },
        { ...args, segment: { ...args.segment, durationMillis: Number.MAX_SAFE_INTEGER + 1 } },
        { ...args, segment: { ...args.segment, eventId: "CreationEvent001" } },
        { ...args, songList: [{ songId: 1, comment: "" }] },
        { ...args, responses: [{ userId: "CreationUser0001", attendanceId: 1 }] },
    ])("rejects missing context, forged ownership, natural identities and invalid values (%#)", input => {
        expect(() => ZinsertEventArgs.parse(input)).toThrow();
    });
    it("rejects duplicate initial answers but retains repeated songs in a setlist", () => {
        const response = { userId: "CreationUser0001", attendanceId: "CreationAttend01" };
        expect(() => ZinsertEventArgs.parse({ ...args, responses: [response, response] })).toThrow("one initial response");
        const song = { songId: "CreationSong0001", comment: "Reprise" };
        expect(ZinsertEventArgs.parse({ ...args, songList: [song, song] }).songList).toHaveLength(2);
    });
});
