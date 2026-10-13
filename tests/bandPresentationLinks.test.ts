import { describe, expect, it } from "vitest";
import { parsePublicId } from "shared/publicId";
import { portalHref } from "src/route/portalRouting";

const context = { bandPublicId: parsePublicId<"Band">("Band000000000001"), routeLocale: "fr-BE" };

describe("portal navigation context", () => {
    it("preserves a destination's query and hash while replacing its band and language", () => {
        expect(portalHref("/backstage/users?page=2&bandPublicId=Band000000000002#members", context, { kind: "platform" }))
            .toBe("/fr-BE/b/Band000000000001/backstage/users?page=2#members");
    });
    it("clears old selection when navigating in platform context", () => {
        expect(portalHref("/backstage?bandPublicId=Band000000000001&routeLocale=fr-BE#home", {}, { kind: "platform" })).toBe("/backstage#home");
    });
    it.each(["https://example.test/docs?lang=en#help", "//example.test/docs", "mailto:admin@example.test"])("leaves external destinations intact: %s", path => {
        expect(portalHref(path, context, { kind: "platform" })).toBe(path);
    });
});
