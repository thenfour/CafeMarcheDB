import { describe, expect, it } from "vitest";
import { parsePublicId } from "shared/publicId";
import { customLinkClientDestination, customLinkHref } from "src/core/db3/shared/entities/customLink/customLinkUrl";

describe("custom link presentation URLs", () => {
    it("puts explicit ownership on copied, preview and opened URLs while preserving nested slugs", () => {
        expect(customLinkHref("/folder/MyPage/", parsePublicId<"Band">("Band000000000007")))
            .toBe("/folder/MyPage?bandPublicId=Band000000000007");
    });

    it.each(["https://target.test/path", "https://target.test/path#old"])("forwards the browser hash as one fragment: %s", destination => {
        expect(customLinkClientDestination(destination, "#new", true)).toBe("https://target.test/path#new");
    });

    it("keeps the destination fragment when forwarding is disabled or the incoming hash is empty", () => {
        const destination = "https://target.test/path#old";
        expect(customLinkClientDestination(destination, "#new", false)).toBe(destination);
        expect(customLinkClientDestination(destination, "", true)).toBe(destination);
    });
});
