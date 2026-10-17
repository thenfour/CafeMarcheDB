import type { BlitzPage } from "@blitzjs/next";
import { describe, expect, expectTypeOf, it } from "vitest";
import { defineCmdbPage, requirePageRouteKey } from "src/route/cmdbPage";

describe("page route metadata", () => {
    it("preserves the component, required props, and static page hooks", () => {
        const Page = Object.assign((_props: { eventId: string }) => null, {
            getLayout: (page: JSX.Element) => page,
            getInitialProps: async () => ({ eventId: "VgZu46IcAJqE1Gci" }),
            authenticate: true,
        });
        const registered = defineCmdbPage("bandEvent", Page);

        expect(registered).toBe(Page);
        expect(registered.getLayout).toBe(Page.getLayout);
        expect(registered.getInitialProps).toBe(Page.getInitialProps);
        expect(registered.authenticate).toBe(true);
        expect(requirePageRouteKey(registered)).toBe("bandEvent");
        expectTypeOf(registered.routeKey).toEqualTypeOf<"bandEvent">();
        expectTypeOf(registered).parameter(0).toEqualTypeOf<{ eventId: string }>();
    });

    it("accepts Blitz page declarations without weakening their required props", () => {
        const Page: BlitzPage<{ eventId: string }> = () => null;
        const registered = defineCmdbPage("bandEvent", Page);
        expect(requirePageRouteKey(registered)).toBe("bandEvent");
    });

    it.each([undefined, null, () => null, {}, { routeKey: "unknown" }, { routeKey: "constructor" },
        { routeKey: "__proto__" }, { routeKey: "toString" }, { routeKey: null }])(
        "rejects missing or invalid metadata before page data loads: %s", component => {
            expect(() => requirePageRouteKey(component)).toThrow();
        },
    );
});
