import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
    backstageRouteRegistry,
} from "../../src/auth/shared/backstageRoutes";
import { Permission } from "../../shared/permissions";
import { gMenuSections } from "../../src/core/components/dashboard/StaticMenuItems";

function discoverBackstagePagePatterns(directory: string): string[] {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const absolutePath = path.join(directory, entry.name);
        if (entry.isDirectory()) return discoverBackstagePagePatterns(absolutePath);
        if (!entry.name.endsWith(".tsx")) return [];

        const relativePath = path.relative(path.join(process.cwd(), "src/pages"), absolutePath)
            .replaceAll(path.sep, "/")
            .replace(/\.tsx$/, "")
            .replace(/\/index$/, "");
        return [`/${relativePath}`];
    });
}

describe("backstage route authorization registry", () => {
    it("registers every backstage page exactly once and has no stale entries", () => {
        const pagePatterns = discoverBackstagePagePatterns(path.join(process.cwd(), "src/pages/backstage")).sort();
        const registeredPatterns = backstageRouteRegistry
            .filter(route => route.pattern.startsWith("/backstage"))
            .map(route => route.pattern).sort();

        expect(new Set(registeredPatterns).size).toBe(registeredPatterns.length);
        expect(registeredPatterns).toEqual(pagePatterns);
    });

    it("uses unique stable keys", () => {
        const keys = backstageRouteRegistry.map(route => route.key);
        expect(new Set(keys).size).toBe(keys.length);
    });

    it("uses registry-derived metadata for every requested drawer route", () => {
        const menuLinks = gMenuSections.flatMap(section =>
            section.groups.flatMap(group => group.links.filter(link => link.routeKey)));

        expect(new Set(menuLinks.map(link => link.routeKey)).size).toBe(menuLinks.length);
        for (const link of menuLinks) {
            const route = backstageRouteRegistry.find(candidate => candidate.key === link.routeKey)!;
            expect(link).toEqual(expect.objectContaining({
                path: route.pattern,
                linkCaption: route.caption,
                permission: route.permission,
            }));
        }
    });

    it("expresses public, sysadmin, and contained routes with ordinary permissions", () => {
        const permissionFor = (key: string) => backstageRouteRegistry.find(route => route.key === key)?.permission;
        expect(permissionFor("practiceTools")).toBe(Permission.practice_tools_use);
        expect(permissionFor("roles")).toBe(Permission.sysadmin);
    });
});
