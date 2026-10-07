import { PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { ServerPermissionSet } from "src/auth/server/ServerPermissionSet";
import { prepareDB3FieldWrites } from "src/core/db3/server/db3FieldWrites";
import { xBandSongTag } from "src/core/db3/shared/entities/song/bandSongTagViews";

afterEach(() => { vi.restoreAllMocks(); });

describe("DB3 transactional field writes", () => {
    it("dispatches extension writes through any field while preserving ordinary scalar writes", async () => {
        const auth = new CMServerAuthorization(null, new ServerPermissionSet([]));
        const database = new PrismaClient();
        const existing = { nameId: 19, globalSongTagId: 7 };
        const write = vi.spyOn(xBandSongTag.fields.group, "applyTransactionalWrite").mockResolvedValue({
            values: { group: "prepared group" }, removeMembers: [],
        });
        expect(await prepareDB3FieldWrites(xBandSongTag, { group: "submitted group", color: "blue" }, existing, auth, database))
            .toEqual({ group: "prepared group", color: "blue" });
        expect(write).toHaveBeenCalledWith({
            value: "submitted group", existingRow: existing, hasInheritedSource: true,
            writeLocalizedString: expect.any(Function),
        });
        expect(await prepareDB3FieldWrites(xBandSongTag, { color: null }, existing, auth, database)).toEqual({ color: null });
        expect(write).toHaveBeenCalledOnce();
    });

    it("lets the localized field own its scalar-FK transformation and inherit precondition", async () => {
        const writeLocalizedString = vi.fn(async () => 25);
        const edit = { kind: "set", localeTag: "fr-BE", stringPublicId: null, value: "Concert" };
        expect(await xBandSongTag.fields.name.applyTransactionalWrite({
            value: edit, existingRow: { nameId: 19 }, hasInheritedSource: false, writeLocalizedString,
        })).toEqual({ values: { nameId: 25 }, removeMembers: ["name"] });
        expect(writeLocalizedString).toHaveBeenCalledWith(19, "PlainText", edit, "band");
        await expect(xBandSongTag.fields.name.applyTransactionalWrite({
            value: { kind: "inherit", stringPublicId: "StringIdentity01" }, existingRow: { nameId: 19 },
            hasInheritedSource: false, writeLocalizedString,
        })).rejects.toThrow("Custom entries have no global value to inherit");
        expect(writeLocalizedString).toHaveBeenCalledOnce();
    });
});
