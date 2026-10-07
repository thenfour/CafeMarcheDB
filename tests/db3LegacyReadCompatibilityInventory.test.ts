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
    "src/core/components/event/NewEventComponents.tsx": [
        { api: "defineLegacyTableClientSpec", category: "render-only-editor", count: 2 },
        { api: "useLegacyTableRenderContext", category: "render-only-editor", count: 2 },
    ],
    "src/core/components/SearchableNameColumnClient.tsx": [
        { api: "defineLegacyDynamicTableClientSpec", category: "runtime-dynamic-query", count: 1 },
        { api: "useLegacyTableRenderContext", category: "runtime-dynamic-query", count: 1 },
    ],
    "src/core/db3/components/DB3ClientBasicFields.tsx": [
        { api: "defineLegacyDynamicTableClientSpec", category: "generic-infrastructure", count: 1 },
        { api: "useLegacyTableRenderContext", category: "generic-infrastructure", count: 1 },
    ],
    "src/core/db3/components/db3DataGrid.tsx": [
        { api: "useLegacyTableRenderContext", category: "generic-infrastructure", count: 1 },
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

// MIGRATION_RESTORE: audit-log
// Source: 6ee055895a049d6f105d775b4e2e563542f34d32:tests/db3LegacyReadCompatibilityInventory.test.ts:55-57
// Reason: Legacy audit readers and JSON rendering lack scoped ownership and target-schema references.
// Restore: Restore protected audit browsing, filters, historical JSON/detail links and clipboard/Markdown inspection with explicit platform/band authorization, fresh snapshots, localized references and redaction; retain immutable audit recording.
// Verification: Reactivate preserved audit specifications; test sysadmin/member/anonymous access, two bands, deleted references, revoked grants, redaction, filters, JSON inspection and built-browser navigation.
// SHA256: 721d445d5a5ce99c9e4d920e4a760bb52f6976d7411eb5feb8f6e16a6176f6c6
// MIGRATION_REFERENCE_BEGIN
//     "src/pages/backstage/adminLogs.tsx": [
//         { api: "defineLegacyTableClientSpec", category: "table-only-query", count: 1 },
//     ],
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: event-import
// Source: ced31f2c6595be33520214fe5e23a75cc8148b3a:tests/db3LegacyReadCompatibilityInventory.test.ts:55-58
// Reason: Experimental import preview uses global person/song lookups, obsolete invitation tags and an unscoped authorization/time-zone boundary; its editor depends on unfinished event/song contracts.
// Restore: Restore text/config parsing, band-owned defaults, visible song and membership matching, editable preview, explicit save and saved-event history with strict public inputs, fresh snapshot authorization, localized references and band scheduling through the migrated creation transaction.
// Verification: Reactivate preserved preview/identity/authorization specifications; test supported dates and year overrides, comments/repeated songs, ambiguous or missing matches, two bands, inactive members/catalogs, hidden songs, grant revocation, preview edits and saves in the built browser.
// SHA256: 44a41f081f7d08485da974f7cc053d7fba37aacd0b46ed4920b74da161a50338
// MIGRATION_REFERENCE_BEGIN
//     "src/pages/backstage/eventImport.tsx": [
//         { api: "defineLegacyTableClientSpec", category: "render-only-editor", count: 2 },
//         { api: "useLegacyTableRenderContext", category: "render-only-editor", count: 2 },
//     ],
// MIGRATION_REFERENCE_END
