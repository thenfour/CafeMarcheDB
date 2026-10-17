import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, expectTypeOf, it } from "vitest";
import { isPermission, Permission } from "shared/permissions";
import { CmdbRouteRegistry } from "src/route/cmdbRoutes";
import { gMenuSections } from "src/core/components/dashboard/StaticMenuItems";
import { kStaticLocalizedStringRegistry } from "src/locale/shared/staticLocalizedStringRegistry";

function pageFiles(directory: string): string[] {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            return entry.name === "api" ? [] : pageFiles(absolute);
        }
        if (!/\.(tsx|ts)$/.test(entry.name) || ["_app.tsx", "_document.tsx"].includes(entry.name)) {
            return [];
        }
        return [absolute];
    });
}

function pagePattern(file: string, root: string): string {
    return "/" + path.relative(root, file).replaceAll(path.sep, "/").replace(/\.(tsx|ts)$/, "").replace(/(^|\/)index$/, "");
}

describe("page route registry", () => {
    it("covers Next page patterns and preserves literal pattern types", () => {
        const root = path.join(process.cwd(), "src/pages");
        expect(CmdbRouteRegistry.allPatterns.slice().sort()).toEqual([...new Set([...pageFiles(root).map(file => pagePattern(file, root)), "/_error"])].sort());
        expectTypeOf(CmdbRouteRegistry.routeByKey("bandSong").nextPattern).toEqualTypeOf<"/backstage/song/[...id_slug_tab]">();
    });
    it("gives every page its own registry identity, including platform wrappers", () => {
        const root = path.join(process.cwd(), "src/pages");
        for (const file of pageFiles(root)) {
            const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
            const exported = source.statements.find(ts.isExportAssignment);
            if (!exported || !ts.isIdentifier(exported.expression)) {
                throw new Error(`Page must retain a named default export for Blitz: ${file}`);
            }
            const registration = source.statements.filter(ts.isExpressionStatement)
                .map(statement => statement.expression)
                .filter(ts.isCallExpression)
                .find(call => call.expression.getText(source) === "defineCmdbPage"
                    && call.arguments[1]?.getText(source) === exported.expression.getText(source));
            if (!registration) {
                throw new Error(`Page must register its exported component: ${file}`);
            }
            const key = registration.arguments[0];
            if (!key || !ts.isStringLiteral(key) || !CmdbRouteRegistry.isRouteKey(key.text)) {
                throw new Error(`Page must declare a registry key: ${file}`);
            }
            expect(CmdbRouteRegistry.routeByKey(key.text).nextPattern, file).toBe(pagePattern(file, root));
        }
    });
    it("maps patterns to semantic keys and exactly one permission", () => {
        for (const pattern of CmdbRouteRegistry.allPatterns) {
            const route = CmdbRouteRegistry.requireRouteByPattern(pattern);
            expect(CmdbRouteRegistry.routeByKey(route.key)).toBe(route);
            expect(isPermission(route.permission)).toBe(true);
            expect(route).not.toHaveProperty("scope");
            expect(route).not.toHaveProperty("caption");
        }
        expect(CmdbRouteRegistry.requireRouteByPattern("/backstage/settings/")).toBe(CmdbRouteRegistry.routeByKey("bandSettings"));
        for (const unknown of ["/unknown", "constructor", "__proto__", "toString"]) {
            expect(() => CmdbRouteRegistry.requireRouteByPattern(unknown)).toThrow();
        }
        expect(CmdbRouteRegistry.routeByKey("bandUser").permission).toBe(Permission.login);
        expect(CmdbRouteRegistry.routeByKey("platformUser").permission).toBe(Permission.manage_global_users);
    });
    it("derives menu destinations and permissions from semantic keys", () => {
        for (const link of gMenuSections.flatMap(section => section.groups.flatMap(group => group.links))) {
            const route = CmdbRouteRegistry.routeByKey(link.routeKey);
            expect(link.path).toBe(route.nextPattern);
            expect(link.permission).toBe(route.permission);
            expect(kStaticLocalizedStringRegistry[link.captionKey].format).toBe("plain");
        }
    });
});
