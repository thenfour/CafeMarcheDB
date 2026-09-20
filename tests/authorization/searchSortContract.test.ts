import { describe, expect, it } from "vitest";
import * as db3 from "@db3/db3";
import { processSearchSortModel } from "@db3/server/searchServerCore";
import { ZGetSearchResultsInput } from "@db3/shared/apiTypes";

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
});
