import type { Ctx } from "blitz";
import type * as PrismaModule from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parsePublicId } from "shared/publicId";
const load = vi.hoisted(() => vi.fn());
const read = vi.hoisted(() => vi.fn());
vi.mock("db", async () => ({ ...await vi.importActual<typeof PrismaModule>("@prisma/client"), default: { owner: "database" } }));
vi.mock("src/auth/server/serverAuthorization", () => ({ loadAuthorization: load }));
vi.mock("src/core/db3/server/eventImport", () => ({ readEventImportPreview: read }));
import database from "db";
import getImportEventData from "src/core/db3/queries/getImportEventData";

// Only session forwarding is exercised; the loader and snapshot owner are mocked.
const context = { session: { handle: "import request" } } as unknown as Ctx;
const input = { bandPublicId: parsePublicId<"Band">("ImportBand000001"), text: "Gig\ncarl", config: "y2026", routeLocale: "fr-BE", browserLanguages: ["nl-BE"] };
beforeEach(() => { load.mockReset(); read.mockReset(); });
describe("import preview RPC boundary", () => {
    it("forwards strict public presentation inputs through the fresh authorization and existing preview owner", async () => {
        const authorization = { actor: "fresh principal" };
        const result = { preview: "read-only" };
        load.mockResolvedValue(authorization); read.mockResolvedValue(result);
        expect(await getImportEventData(input, context)).toEqual(result);
        expect(load).toHaveBeenCalledWith(context.session, input.bandPublicId);
        expect(read).toHaveBeenCalledWith(database, authorization, input);
    });
    it("rejects legacy, missing, extra or malformed inputs before session/data reads", async () => {
        for (const value of [{ text: "", config: "" }, { ...input, bandPublicId: 1 }, { ...input, bandId: 1 }, { ...input, config: {} }, null]) {
            // The untyped transport can submit values that the typed client cannot construct.
            await expect(Reflect.apply(getImportEventData, undefined, [value, context])).rejects.toThrow();
        }
        expect(load).not.toHaveBeenCalled(); expect(read).not.toHaveBeenCalled();
    });
    it("propagates preview authorization failure without returning a partial preview", async () => {
        load.mockResolvedValue({ actor: "revoked" }); read.mockRejectedValue(new Error("Denied"));
        await expect(getImportEventData(input, context)).rejects.toThrow("Denied");
    });
});
