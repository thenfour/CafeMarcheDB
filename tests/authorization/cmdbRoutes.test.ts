import fs from "node:fs";
import path from "node:path";
import { isPermission, Permission } from "shared/permissions";
import { gMenuSections } from "src/core/components/dashboard/StaticMenuItems";
import { kStaticLocalizedStringRegistry } from "src/locale/shared/staticLocalizedStringRegistry";
import { CmdbRoutes } from "src/route/cmdbRoutes";
import { describe, expect, expectTypeOf, it } from "vitest";

function discoverPagePatterns(directory: string, pagesRoot: string): string[] {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const absolutePath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            return entry.name === "api" ? [] : discoverPagePatterns(absolutePath, pagesRoot);
        }
        if (!/\.(tsx|ts)$/.test(entry.name) || ["_app.tsx", "_document.tsx"].includes(entry.name)) {
            return [];
        }
        const relativePath = path.relative(pagesRoot, absolutePath)
            .replaceAll(path.sep, "/")
            .replace(/\.(tsx|ts)$/, "")
            .replace(/(^|\/)index$/, "");
        return [`/${relativePath}`];
    });
}

describe("CMDB page route registry", () => {
    it("covers all page routes with no stale entries, including the framework error page", () => {
        const pagesRoot = path.join(process.cwd(), "src/pages");
        const pagePatterns = new Set([...discoverPagePatterns(pagesRoot, pagesRoot), "/_error"]);
        expect(CmdbRoutes.routes.slice().sort()).toEqual([...pagePatterns].sort());
    });

    it("owns page identity and one permission, leaving scope and captions to callers", () => {
        for (const route of Object.values(CmdbRoutes.registry)) {
            expect(route.key).toBe(route.nextPattern);
            expect(isPermission(route.permission)).toBe(true);
            expect(route).not.toHaveProperty("scope");
            expect(route).not.toHaveProperty("caption");
            expect(route).not.toHaveProperty("unscopedPermission");
        }
        expectTypeOf(CmdbRoutes.routeByKey("/backstage/settings").nextPattern)
            .toEqualTypeOf<"/backstage/settings">();
    });

    it("normalizes trailing slashes and rejects unknown and inherited keys", () => {
        expect(CmdbRoutes.requireRouteByPattern("/backstage/settings/")).toBe(CmdbRoutes.routeByKey("/backstage/settings"));
        expect(CmdbRoutes.requireRouteByPattern("/")).toBe(CmdbRoutes.routeByKey("/"));
        for (const key of ["/not-registered", "constructor", "toString", "__proto__"]) {
            expect(CmdbRoutes.isRouteKey(key)).toBe(false);
            expect(() => CmdbRoutes.requireRouteKey(key)).toThrow("Invalid route key");
        }
    });

    it("retains public tools, protected administration and roleless member profiles", () => {
        expect(CmdbRoutes.routeByKey("/backstage/editSongCreditTypes").permission).toBe(Permission.manage_global_catalogs);
        expect(CmdbRoutes.routeByKey("/backstage/practice-tools").permission).toBe(Permission.practice_tools_use);
        expect(CmdbRoutes.routeByKey("/backstage/roles").permission).toBe(Permission.sysadmin);
        expect(CmdbRoutes.routeByKey("/backstage/user/[...id_slug_tab]").permission).toBe(Permission.login);
        expect(CmdbRoutes.routeByKey("/backstage/platform-user/[...id_slug_tab]").permission).toBe(Permission.manage_global_users);
    });
});

describe("static route menus", () => {
    it("derives every path and permission from the registry and owns localized caption keys", () => {
        const links = gMenuSections.flatMap(section => section.groups.flatMap(group => group.links));
        expect(new Set(links.map(link => link.routeKey)).size).toBe(links.length);
        for (const link of links) {
            const route = CmdbRoutes.routeByKey(link.routeKey);
            expect(link.path).toBe(route.nextPattern);
            expect(link.permission).toBe(route.permission);
            expect(kStaticLocalizedStringRegistry[link.captionKey].format).toBe("plain");
            expect(link).not.toHaveProperty("linkCaption");
        }
    });
});
