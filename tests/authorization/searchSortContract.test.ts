import { describe, expect, it, vi } from "vitest";
import * as db3 from "@db3/db3";
import { processSearchSortModel, resolveSearchDiscreteCriteria } from "@db3/server/searchServerCore";
import { DiscreteCriterionFilterType, ZGetSearchResultsInput } from "@db3/shared/apiTypes";
import { ServerPermissionSet } from "src/auth/server/ServerPermissionSet";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";

describe("search sort contract", () => {
    it("requires a semantic sort and does not append database identity", () => {
        const args = ZGetSearchResultsInput.parse({
            tableID: db3.xSong.tableID,
            viewID: db3.songSearchView.viewID,
            offset: 0,
            take: 20,
            sort: [{ db3Column: "name", direction: "asc" }],
            quickFilter: "",
            discreteCriteria: [],
        });

        const sort = processSearchSortModel(db3.xSong, args);
        expect(sort.select.map(item => item.expression)).toEqual(["P.name"]);
        expect(sort.select.some(item => /\.id\b/i.test(item.expression))).toBe(false);
        expect(() => ZGetSearchResultsInput.parse({ ...args, sort: [] })).toThrow();
    });

    it("resolves public facet options in one batch and keeps public identities in facet results", async () => {
        const firstPublicId = parsePublicId<"SongTag">("AbCdEfGhIjKlMn01");
        const secondPublicId = parsePublicId<"SongTag">("AbCdEfGhIjKlMn02");
        const findMany = vi.fn(async () => [
            { id: 20, publicId: firstPublicId },
            { id: 21, publicId: secondPublicId },
        ]);
        // The search authorization path only needs an authenticated user ID here.
        const publicData = db3.createDB3Authorization({ id: 100 } as any, new ServerPermissionSet([
            { id: 1, name: Permission.always_grant },
            { id: 2, name: Permission.login },
            { id: 3, name: Permission.view_songs },
        ]));
        const criterion = {
            db3Column: "tags",
            behavior: DiscreteCriterionFilterType.hasAllOf,
            options: [firstPublicId, secondPublicId],
        };

        const resolved = await resolveSearchDiscreteCriteria(
            db3.xSong,
            [criterion],
            publicData,
            { SongTag: { findMany } } as any, // Focused delegate double for the identity target.
        );

        expect(findMany).toHaveBeenCalledOnce();
        expect(resolved[0]?.options).toEqual([20, 21]);
        const tagsColumn = db3.xSong.getColumn("tags")!;
        expect(tagsColumn.SqlGetDiscreteCriterionElements(resolved[0]!, "P")?.whereAnd)
            .toContain("mt.tagId = 20");

        const facet = tagsColumn.SqlGetFacetInfoQuery(
            {} as any, // The tag facet SQL does not inspect the current-user payload.
            "select 1 id",
            "select 1 id",
            criterion,
        )!;
        expect(facet.sql).toContain("FT.publicId AS id");
        expect(facet.transformResult({
            id: firstPublicId,
            label: "March",
            color: null,
            iconName: null,
            tooltip: null,
            rowCount: BigInt(2),
        })).toMatchObject({ id: firstPublicId, rowCount: 2 });

        const optionless = await resolveSearchDiscreteCriteria(
            db3.xSong,
            [{
                db3Column: "tags",
                behavior: DiscreteCriterionFilterType.hasAny,
                options: ["stale-client-selection"],
            }],
            publicData,
            { SongTag: { findMany } } as any, // No lookup should occur for an optionless behavior.
        );
        expect(optionless[0]?.options).toEqual([]);
        expect(findMany).toHaveBeenCalledOnce();
    });

    it("uses WikiPageTag public identities for wiki search facets", async () => {
        const publicId = parsePublicId<"WikiPageTag">("WikiTagPublic001");
        const findMany = vi.fn(async () => [{ id: 31, publicId }]);
        // The focused authorization path only reads the authenticated user ID.
        const publicData = db3.createDB3Authorization({ id: 100 } as any, new ServerPermissionSet([
            { id: 1, name: Permission.always_grant },
            { id: 2, name: Permission.login },
            { id: 3, name: Permission.view_wiki_pages },
        ]));
        const criterion = {
            db3Column: "tags",
            behavior: DiscreteCriterionFilterType.hasAllOf,
            options: [publicId],
        };

        const resolved = await resolveSearchDiscreteCriteria(
            db3.xWikiPage,
            [criterion],
            publicData,
            { WikiPageTag: { findMany } } as any, // Focused identity-target delegate.
        );

        expect(resolved[0]?.options).toEqual([31]);
        expect(db3.xWikiPage.fields.tags.SqlGetFacetInfoQuery(
            {} as any, // The tag facet SQL does not inspect the current-user payload.
            "select 1 id",
            "select 1 id",
            criterion,
        )?.sql).toContain("FT.publicId AS id");
    });
});
