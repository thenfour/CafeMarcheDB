import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { isPublicId, PUBLIC_ID_PLACEHOLDER_PREFIX, type InstrumentPublicId } from "shared/publicId";
import { db3Server } from "src/core/db3/server/db3Server";
import { xInstrument } from "src/core/db3/shared/schema/instrument";
import { xSetting } from "src/core/db3/shared/db3schema";
import type { xTable } from "src/core/db3/shared/db3core";
import { generatePublicId, repairPublicIdPlaceholders, type PublicIdRepairDelegate } from "src/server/publicId";

class InMemoryPublicIdDelegate implements PublicIdRepairDelegate {
    constructor(public rows: Array<{ id: number, publicId: string }>) { }

    async findMany(args: any) {
        return this.rows
            .filter(row => row.publicId.startsWith(args.where.publicId.startsWith))
            .sort((a, b) => a.id - b.id)
            .slice(0, args.take)
            .map(row => ({ ...row }));
    }

    async updateMany(args: any) {
        // P2002 = "Unique constraint failed on the {constraint}"
        if (this.rows.some(row => row.publicId === args.data.publicId)) {
            throw { code: "P2002", meta: { target: ["publicId"] } };
        }
        const row = this.rows.find(candidate => (
            candidate.id === args.where.id && candidate.publicId === args.where.publicId
        ));
        if (!row) return { count: 0 };
        row.publicId = args.data.publicId;
        return { count: 1 };
    }

    async count(args: any) {
        return this.rows.filter(row => row.publicId.startsWith(args.where.publicId.startsWith)).length;
    }
}

describe("public IDs", () => {
    it("generates 96-bit base64url identifiers with the transport contract's exact shape", () => {
        const values = Array.from({ length: 1_000 }, () => generatePublicId());
        expect(new Set(values).size).toBe(values.length);
        expect(values.every(value => value.length === 16 && isPublicId(value))).toBe(true);
        expect(isPublicId(`${PUBLIC_ID_PLACEHOLDER_PREFIX}000000000000001`)).toBe(false);
    });

    it("binds server generation to the table's identity contract", () => {
        const value = db3Server.table(xInstrument).generatePublicId();
        const runtimeOnlyLegacyTable: xTable = xSetting;

        expectTypeOf(value).toEqualTypeOf<InstrumentPublicId>();
        expect(xInstrument.isIdentity(value)).toBe(true);
        expect(() => db3Server.table(runtimeOnlyLegacyTable).generatePublicId())
            .toThrow("Table Setting does not use public IDs.");
    });

    it("repairs migration placeholders safely across concurrent startup attempts and retries collisions", async () => {
        const delegate = new InMemoryPublicIdDelegate([
            { id: 1, publicId: "~000000000000001" },
            { id: 2, publicId: "~000000000000002" },
            { id: 3, publicId: "alreadyPublic001" },
        ]);
        const candidates = ["alreadyPublic001", "replacement00001", "replacement00002", "replacement00003"];
        const generate = () => candidates.shift() || generatePublicId();

        await Promise.all([
            repairPublicIdPlaceholders({ delegate, modelName: "TestModel", generate }),
            repairPublicIdPlaceholders({ delegate, modelName: "TestModel", generate }),
        ]);

        expect(delegate.rows.find(row => row.id === 3)?.publicId).toBe("alreadyPublic001");
        expect(delegate.rows.every(row => isPublicId(row.publicId))).toBe(true);
        expect(new Set(delegate.rows.map(row => row.publicId)).size).toBe(delegate.rows.length);
    });

    it("retries only public-ID collisions and preserves typed creation results", async () => {
        const table = db3Server.table(xInstrument);
        const collision = { code: "P2002", meta: { target: "Instrument_publicId_key" } };
        const create = vi.fn(async (publicId: InstrumentPublicId) => ({ publicId, name: "Instrument" }))
            .mockRejectedValueOnce(collision);
        const result = await table.createWithPublicId(create);
        expectTypeOf(result).toEqualTypeOf<{ publicId: InstrumentPublicId; name: string }>();
        expect(create).toHaveBeenCalledTimes(2);
        expect(create.mock.calls[0]![0]).not.toBe(create.mock.calls[1]![0]);
        expect(result.publicId).toBe(create.mock.calls[1]![0]);

        const domainConflict = { code: "P2002", meta: { target: ["name"] } };
        create.mockClear().mockRejectedValue(domainConflict);
        await expect(table.createWithPublicId(create)).rejects.toBe(domainConflict);
        expect(create).toHaveBeenCalledTimes(1);

        create.mockClear().mockRejectedValue(collision);
        await expect(table.createWithPublicId(create)).rejects.toThrow("Unable to generate a unique public ID");
        expect(create).toHaveBeenCalledTimes(8);
    });
});
