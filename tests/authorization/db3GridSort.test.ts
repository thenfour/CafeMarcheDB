import { describe, expect, it, vi } from "vitest";
import * as db3 from "@db3/db3";
import { gridSortModelFromPrismaOrderBy } from "@db3/components/db3GridSort";
import { DB3QueryAuthorizationError, queryView } from "@db3/server/db3QueryCore";
import { ServerPermissionSet } from "src/auth/server/ServerPermissionSet";
import { Permission } from "shared/permissions";
import { songPublicId } from "tests/support/songFixtures";
import { testServerAuthorization } from "tests/support/serverAuthorization";

const authorization = (...names: Permission[]) => testServerAuthorization(
    { id: 501 },
    new ServerPermissionSet(names.map((name, index) => ({ id: index + 1, name }))),
);
const bandAdmin = authorization(Permission.login, Permission.admin_songs, Permission.view_songs);

describe("DB3 grid default sorting", () => {
    it.each([null, songPublicId(7)])("allows the song credit editor query with songId=%s", async songId => {
        const findMany = vi.fn(async (_args: unknown) => []);
        const findSongs = vi.fn(async () => [{ id: 7, publicId: songPublicId(7) }]);
        // This query fixture implements only the delegates used by the editor and its song filter.
        const database = { SongCredit: { findMany }, Song: { findMany: findSongs } } as unknown as Parameters<typeof queryView>[2];
        const sortModel = gridSortModelFromPrismaOrderBy(db3.xSongCredit, bandAdmin);
        const input = {
            view: db3.songCreditEditorView,
            filter: { items: [], tableParams: { songId } },
            orderBy: undefined,
            cmdbQueryContext: "song-credit-grid-sort-regression",
        };

        expect(bandAdmin.hasPermission(Permission.sysadmin)).toBe(false);
        expect(sortModel).toEqual([]);
        await expect(queryView(input, bandAdmin, database)).resolves.toMatchObject({ items: [] });
        expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
            orderBy: db3.xSongCredit.naturalOrderBy,
        }));
        if (songId !== null) {
            expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
                where: expect.objectContaining({ AND: expect.arrayContaining([{ songId: { equals: 7 } }]) }),
            }));
        }

        findMany.mockClear();
        // Keep client-supplied natural-ID sorting restricted at the server boundary.
        await expect(queryView({ ...input, orderBy: { id: "asc" } }, bandAdmin, database))
            .rejects.toBeInstanceOf(DB3QueryAuthorizationError);
        expect(findMany).not.toHaveBeenCalled();
    });

    it("preserves natural-ID sorting for sysadmins", () => {
        expect(gridSortModelFromPrismaOrderBy(db3.xSongCredit, authorization(Permission.sysadmin)))
            .toEqual([{ field: "id", sort: "asc" }]);
    });

    it("preserves readable natural sorting for delegated song administrators", () => {
        expect(gridSortModelFromPrismaOrderBy(db3.xSongTag, bandAdmin))
            .toEqual([{ field: "sortOrder", sort: "asc" }]);
    });

    it("rejects an editor query when song viewing is not granted", async () => {
        const findMany = vi.fn(async () => []);
        // The rejected query must never reach its delegate.
        const database = { SongCredit: { findMany } } as unknown as Parameters<typeof queryView>[2];
        await expect(queryView({
            view: db3.songCreditEditorView,
            filter: { items: [], tableParams: { songId: null } },
            orderBy: undefined,
            cmdbQueryContext: "song-credit-grid-missing-view-permission",
        }, authorization(Permission.login, Permission.admin_songs), database))
            .rejects.toBeInstanceOf(DB3QueryAuthorizationError);
        expect(findMany).not.toHaveBeenCalled();
    });
});
