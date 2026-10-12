import { describe, expect, it } from "vitest";
import { AuditDetailInputSchema } from "src/core/db3/shared/audit/auditContracts";
import { parseAuditSnapshot } from "src/core/db3/shared/audit/auditSnapshot";

describe("historical audit snapshots", () => {
    it("retains stored IDs, credentials, session values and nested setlists", () => {
        const value = { id: 9, bandId: 5, publicId: "SongPublic000001", name: "Retained", nested: [
            { calendarFeedToken: "old-token", hashedPassword: "old-hash", sessionHandle: "old-session" },
        ], songs: [{ id: 7, songId: 8, sortOrder: 2, subtitle: "Encore" }] };
        expect(parseAuditSnapshot(JSON.stringify(value))).toEqual(value);
    });
    it.each(["{\"password\":\"secret", "undefined", "[1,"])("displays malformed stored JSON as the original text %s", value => {
        expect(parseAuditSnapshot(value)).toBe(value);
    });
    it.each([null, "null"])("preserves null snapshots %j", value => expect(parseAuditSnapshot(value)).toBeNull());
    it.each([{ tableName: "User", pk: 1 }, { changeId: 1, tableName: "User" }, { changeId: -1 }, { changeId: 1.5 }, { changeId: Number.MAX_SAFE_INTEGER + 1 }])("accepts only safe audit identities and presentation input %j", value => {
        expect(AuditDetailInputSchema.safeParse(value).success).toBe(false);
    });
});
