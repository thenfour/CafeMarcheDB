import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const compatibilityAPIs = [
    "defineLegacyCrudView",
    "defineLegacyTableClientSpec",
    "defineLegacyDynamicTableClientSpec",
    "bindLegacyTableClientSpecToView",
    "useLegacyTableRenderContext",
] as const;

type CompatibilityAPI = typeof compatibilityAPIs[number];

type MigrationCategory =
    | "generic-infrastructure"
    | "named-view-candidate"
    | "render-only-editor"
    | "runtime-dynamic-query"
    | "table-only-query";

interface InventoryEntry {
    api: CompatibilityAPI;
    category: MigrationCategory;
    count: number;
}

// This is a deletion inventory, not an extension registry. New entries are not
// allowed. When a caller is migrated, remove or reduce its entry here.
const compatibilitySites: Record<string, InventoryEntry[]> = {
    "src/core/components/dashboard/MenuLinkComponents.tsx": [
        { api: "defineLegacyDynamicTableClientSpec", category: "runtime-dynamic-query", count: 1 },
        { api: "useLegacyTableRenderContext", category: "runtime-dynamic-query", count: 1 },
    ],
    "src/core/components/event/EventComponents.tsx": [
        { api: "defineLegacyTableClientSpec", category: "render-only-editor", count: 2 },
        { api: "useLegacyTableRenderContext", category: "render-only-editor", count: 2 },
    ],
    "src/core/components/event/EventComponentsBase.tsx": [
        { api: "defineLegacyTableClientSpec", category: "table-only-query", count: 1 },
        { api: "useLegacyTableRenderContext", category: "table-only-query", count: 1 },
    ],
    "src/core/components/event/NewEventComponents.tsx": [
        { api: "defineLegacyTableClientSpec", category: "render-only-editor", count: 2 },
        { api: "useLegacyTableRenderContext", category: "render-only-editor", count: 2 },
    ],
    "src/core/components/EventSongListComponents.tsx": [
        { api: "defineLegacyTableClientSpec", category: "render-only-editor", count: 1 },
        { api: "useLegacyTableRenderContext", category: "render-only-editor", count: 1 },
    ],
    "src/core/components/SearchableNameColumnClient.tsx": [
        { api: "defineLegacyDynamicTableClientSpec", category: "runtime-dynamic-query", count: 1 },
        { api: "useLegacyTableRenderContext", category: "runtime-dynamic-query", count: 1 },
    ],
    "src/core/db3/components/DB3AssociationMatrix.tsx": [
        { api: "useLegacyTableRenderContext", category: "generic-infrastructure", count: 2 },
    ],
    "src/core/db3/components/DB3ClientBasicFields.tsx": [
        { api: "defineLegacyDynamicTableClientSpec", category: "generic-infrastructure", count: 1 },
        { api: "useLegacyTableRenderContext", category: "generic-infrastructure", count: 1 },
    ],
    "src/core/db3/components/db3DataGrid.tsx": [
        { api: "useLegacyTableRenderContext", category: "generic-infrastructure", count: 1 },
    ],
    "src/pages/backstage/adminLogs.tsx": [
        { api: "defineLegacyTableClientSpec", category: "table-only-query", count: 1 },
    ],
    "src/pages/backstage/event/[...id_slug_tab].tsx": [
        { api: "defineLegacyTableClientSpec", category: "named-view-candidate", count: 1 },
        { api: "useLegacyTableRenderContext", category: "named-view-candidate", count: 1 },
    ],
    "src/pages/backstage/eventImport.tsx": [
        { api: "defineLegacyTableClientSpec", category: "render-only-editor", count: 2 },
        { api: "useLegacyTableRenderContext", category: "render-only-editor", count: 2 },
    ],
    "src/pages/backstage/frontpageEvents.tsx": [
        { api: "defineLegacyTableClientSpec", category: "named-view-candidate", count: 1 },
        { api: "useLegacyTableRenderContext", category: "named-view-candidate", count: 1 },
    ],
    "src/pages/backstage/rolePermissions.tsx": [
        { api: "defineLegacyTableClientSpec", category: "table-only-query", count: 2 },
    ],
};

const retiredDefinitionNames = new Set<string>([
    "bindLegacyTableClientSpecToView",
    "defineLegacyCrudView",
]);

function listSourceFiles(directory: string): string[] {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const absolutePath = path.join(directory, entry.name);
        if (entry.isDirectory()) return listSourceFiles(absolutePath);
        return /\.tsx?$/.test(entry.name) ? [absolutePath] : [];
    });
}

function increment(counts: Record<string, number>, relativePath: string): void {
    counts[relativePath] = (counts[relativePath] ?? 0) + 1;
}

function getCalledName(node: ts.CallExpression): string | undefined {
    if (ts.isIdentifier(node.expression)) return node.expression.text;
    if (ts.isPropertyAccessExpression(node.expression)) return node.expression.name.text;
    return undefined;
}

function expectedCounts(): Record<CompatibilityAPI, Record<string, number>> {
    const counts = Object.fromEntries(
        compatibilityAPIs.map(api => [api, {}]),
    ) as Record<CompatibilityAPI, Record<string, number>>;

    Object.entries(compatibilitySites).forEach(([relativePath, entries]) => {
        entries.forEach(entry => {
            if (counts[entry.api][relativePath] !== undefined) {
                throw new Error(`Duplicate compatibility inventory entry for ${entry.api} in ${relativePath}.`);
            }
            counts[entry.api][relativePath] = entry.count;
        });
    });
    return counts;
}

function collectCompatibilityUsage() {
    const root = process.cwd();
    const compatibilityAPISet = new Set<string>(compatibilityAPIs);
    const callSites = Object.fromEntries(
        compatibilityAPIs.map(api => [api, {}]),
    ) as Record<CompatibilityAPI, Record<string, number>>;
    const retiredDefinitionSites: string[] = [];

    for (const absolutePath of listSourceFiles(path.join(root, "src"))) {
        const relativePath = path.relative(root, absolutePath).replaceAll("\\", "/");
        const source = ts.createSourceFile(
            relativePath,
            fs.readFileSync(absolutePath, "utf8"),
            ts.ScriptTarget.Latest,
            true,
            absolutePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
        );

        const visit = (node: ts.Node): void => {
            if (ts.isCallExpression(node)) {
                const calledName = getCalledName(node);
                if (calledName && compatibilityAPISet.has(calledName)) {
                    increment(callSites[calledName as CompatibilityAPI], relativePath);
                }
            }

            if (ts.isFunctionDeclaration(node)
                && node.name
                && retiredDefinitionNames.has(node.name.text)) {
                retiredDefinitionSites.push(relativePath);
            }

            ts.forEachChild(node, visit);
        };
        visit(source);
    }

    return { callSites, retiredDefinitionSites };
}

describe("legacy DB3 read compatibility inventory", () => {
    it("documents every remaining compatibility call by migration category", () => {
        expect(collectCompatibilityUsage().callSites).toEqual(expectedCounts());
    });

    it("keeps zero-consumer compatibility functions retired", () => {
        expect(collectCompatibilityUsage().retiredDefinitionSites).toEqual([]);
    });
});
