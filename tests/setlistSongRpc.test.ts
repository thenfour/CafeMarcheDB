import type * as PrismaClientModule from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parsePublicId } from "shared/publicId";
import { createAuthorizationTestContext, createAuthorizationTestUser } from "./authorization/support/authorizationFixtures";
import { invokeResolver } from "./authorization/support/resolverHarness";

const lookup = vi.hoisted(() => ({ authorize: vi.fn(), read: vi.fn(), database: {}, authorization: {} }));
vi.mock("db", async () => ({
    ...await vi.importActual<typeof PrismaClientModule>("@prisma/client"), default: lookup.database,
}));
vi.mock("src/auth/server/serverAuthorization", () => ({ loadAuthorization: lookup.authorize }));
vi.mock("src/core/db3/server/setlistSongRead", () => ({ readSetlistSong: lookup.read }));

import getFilteredSongs from "src/core/db3/queries/getFilteredSongs";

const bandPublicId = parsePublicId<"Band">("Band000000000001");
const songId = parsePublicId<"Song">("Song000000000001");
const ctx = createAuthorizationTestContext(createAuthorizationTestUser("normal"));

describe("band-scoped song lookup RPC", () => {
    beforeEach(() => {
        lookup.authorize.mockReset().mockResolvedValue(lookup.authorization);
        lookup.read.mockReset().mockResolvedValue({ matchingItem: null });
    });

    it.each([{}, { id: songId }, { bandPublicId: 42, id: songId }, { bandPublicId, id: 42 }])("validates explicit public identities before authorization for %j", async input => {
        await expect(invokeResolver(getFilteredSongs, input, ctx)).rejects.toThrow();
        expect(lookup.authorize).not.toHaveBeenCalled();
        expect(lookup.read).not.toHaveBeenCalled();
    });

    it.each([songId, null])("forwards the selected band and request %s to the snapshot reader", async id => {
        const args = { bandPublicId, id };
        await expect(invokeResolver(getFilteredSongs, args, ctx)).resolves.toEqual({ matchingItem: null });
        expect(lookup.authorize).toHaveBeenCalledWith(ctx.session, bandPublicId);
        expect(lookup.read).toHaveBeenCalledWith(lookup.database, lookup.authorization, args);
    });

    it("does not start the read after authorization fails", async () => {
        lookup.authorize.mockRejectedValue(new Error("Unavailable band"));
        await expect(invokeResolver(getFilteredSongs, { bandPublicId, id: songId }, ctx)).rejects.toThrow("Unavailable band");
        expect(lookup.read).not.toHaveBeenCalled();
    });
});
