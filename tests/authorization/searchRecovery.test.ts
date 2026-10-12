import { describe, expect, it } from "vitest";
import * as db3 from "src/core/db3/db3";
import { GetSearchResultsCore } from "src/core/db3/server/searchServerCore";
import { ZGetSearchResultsInput } from "src/core/db3/shared/apiTypes";
import { ApplicationFeatureUnavailableError } from "src/core/shared/applicationRecovery";
import { createAuthorizationPersona } from "./support/authorizationFixtures";

describe("restored event/song/file search recovery boundary", () => {
    it("keeps event recovery unavailable even to platform administrators", () => {
        const { schemaAuthorization } = createAuthorizationPersona("sysadmin");
        expect(db3.xEvent.getSearchCapabilities(schemaAuthorization)).toEqual({ includeDeleted: false });
    });
    it("validates booleans and bounded integer paging at the request boundary", () => {
        const args = { tableID: "Event", offset: 0, take: 20, quickFilter: "", sort: [{ db3Column: "name", direction: "asc" }], discreteCriteria: [] };
        expect(ZGetSearchResultsInput.parse({ ...args, includeDeleted: true }).includeDeleted).toBe(true);
        expect(() => ZGetSearchResultsInput.parse({ ...args, includeDeleted: "true" })).toThrow();
        for (const offset of [-1, 0.5, Infinity]) {
            expect(() => ZGetSearchResultsInput.parse({ ...args, offset })).toThrow();
        }
    });
    it.each(["User"])("keeps %s deferred before starting a snapshot", async tableID => {
        await expect(GetSearchResultsCore({ tableID, offset: 0, take: 20, quickFilter: "", sort: [], discreteCriteria: [] },
            createAuthorizationPersona("sysadmin").schemaAuthorization)).rejects.toThrow(ApplicationFeatureUnavailableError);
    });
});
