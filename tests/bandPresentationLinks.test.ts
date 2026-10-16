import { describe, expect, it } from "vitest";
import { parsePublicId } from "shared/publicId";
import { portalHref } from "src/route/portalRouting";

const context = { bandPublicId: parsePublicId<"Band">("Band000000000001"), routeLocale: "fr-BE" };

describe("portal navigation context", () => {
    it("preserves a destination's query and hash with explicit band and language parameters", () => {
        expect(portalHref("/backstage/users?page=2&bandPublicId=Band000000000002#members", context, { kind: "multiBand" }))
            .toBe("/fr-BE/b/Band000000000001/users?page=2&bandPublicId=Band000000000002#members");
    });
    it("keeps application query parameters independent of platform routing", () => {
        expect(portalHref("/platform?bandPublicId=Band000000000001&routeLocale=fr-BE#home", {}, { kind: "multiBand" })).toBe("/platform?bandPublicId=Band000000000001&routeLocale=fr-BE#home");
    });
    it.each(["https://example.test/docs?lang=en#help", "//example.test/docs", "mailto:admin@example.test"])("leaves external destinations intact: %s", path => {
        expect(portalHref(path, context, { kind: "multiBand" })).toBe(path);
    });
});
