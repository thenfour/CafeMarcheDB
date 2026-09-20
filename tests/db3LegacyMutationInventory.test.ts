import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

type LegacyWriterCategory =
    | "transport-infrastructure"
    | "ordinary-grid"
    | "lookup-grid"
    | "entity-detail"
    | "nested-row"
    | "relationship"
    | "collection-editor"
    | "workflow"
    | "legacy-helper";

interface InventoryEntry {
    category: LegacyWriterCategory;
    count: number;
}

// This is a deletion inventory, not an extension registry. A new entry means
// new dependency on the transport being retired and must not be added. Migrate
// the caller to a CRUD-enabled view or named command instead.
const legacyMutationCapabilitySites: Record<string, InventoryEntry> = {
    "src/core/components/CustomLinksComponents.tsx": { category: "collection-editor", count: 1 },
    "src/core/components/dashboard/MenuLinkComponents.tsx": { category: "collection-editor", count: 1 },
    "src/core/components/song/NewSongComponents.tsx": { category: "workflow", count: 1 },
    "src/core/components/song/SongComponents.tsx": { category: "nested-row", count: 1 },
    "src/core/components/user/UserInstruments.tsx": { category: "relationship", count: 1 },
    "src/core/components/wiki/WikiComponents.tsx": { category: "entity-detail", count: 1 },
    "src/core/db3/components/DB3ClientBasicFields.tsx": { category: "legacy-helper", count: 2 },
    "src/core/db3/components/DB3ClientCore.tsx": { category: "transport-infrastructure", count: 1 },
    "src/core/db3/components/db3DataGrid.tsx": { category: "transport-infrastructure", count: 1 },
    "src/core/db3/components/db3NewObjectDialog.tsx": { category: "legacy-helper", count: 1 },
    "src/pages/backstage/event/[...id_slug_tab].tsx": { category: "entity-detail", count: 1 },
    "src/pages/backstage/frontpagegallery.tsx": { category: "workflow", count: 1 },
    "src/pages/backstage/profile.tsx": { category: "entity-detail", count: 1 },
    "src/pages/backstage/setlistPlanner.tsx": { category: "workflow", count: 1 },
    "src/pages/backstage/song/[...id_slug_tab].tsx": { category: "entity-detail", count: 1 },
    "src/pages/backstage/user/[...id_slug_tab].tsx": { category: "entity-detail", count: 1 },
};

const legacyMutationCallSites: Record<string, InventoryEntry> = {
    "src/core/components/CustomLinksComponents.tsx": { category: "collection-editor", count: 3 },
    "src/core/components/SongFileComponents.tsx": { category: "relationship", count: 2 },
    "src/core/components/dashboard/MenuLinkComponents.tsx": { category: "collection-editor", count: 3 },
    "src/core/components/event/EventComponents.tsx": { category: "entity-detail", count: 2 },
    "src/core/components/event/EventSegmentComponents.tsx": { category: "nested-row", count: 4 },
    "src/core/components/setlistPlan/SetlistPlanGroupComponents.tsx": { category: "nested-row", count: 3 },
    "src/core/components/song/NewSongComponents.tsx": { category: "workflow", count: 1 },
    "src/core/components/song/SongComponents.tsx": { category: "nested-row", count: 5 },
    "src/core/components/user/UserAdminPanel.tsx": { category: "entity-detail", count: 1 },
    "src/core/components/user/UserDetail.tsx": { category: "entity-detail", count: 1 },
    "src/core/components/user/UserInstruments.tsx": { category: "relationship", count: 1 },
    "src/core/components/wiki/WikiComponents.tsx": { category: "entity-detail", count: 1 },
    "src/core/db3/components/db3DataGrid.tsx": { category: "transport-infrastructure", count: 3 },
    "src/core/db3/components/useDB3SelectionSource.tsx": { category: "legacy-helper", count: 1 },
    "src/pages/backstage/file/[...id_slug_tab].tsx": { category: "entity-detail", count: 2 },
    "src/pages/backstage/frontpagegallery.tsx": { category: "workflow", count: 5 },
    "src/pages/backstage/profile.tsx": { category: "entity-detail", count: 1 },
};

const legacyGridSites: Record<string, LegacyWriterCategory> = {
    "src/pages/backstage/adminUsers.tsx": "ordinary-grid",
    "src/pages/backstage/editEventAttendances.tsx": "nested-row",
    "src/pages/backstage/editEvents.tsx": "ordinary-grid",
    "src/pages/backstage/editEventSegments.tsx": "nested-row",
    "src/pages/backstage/editFiles.tsx": "ordinary-grid",
    "src/pages/backstage/editSongCredits.tsx": "nested-row",
    "src/pages/backstage/editSongs.tsx": "ordinary-grid",
    "src/pages/backstage/instruments.tsx": "ordinary-grid",
    "src/pages/backstage/roles.tsx": "ordinary-grid",
    "src/pages/backstage/userInstruments.tsx": "relationship",
};

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

function inventoryCounts(entries: Record<string, InventoryEntry>): Record<string, number> {
    return Object.fromEntries(Object.entries(entries).map(([file, entry]) => [file, entry.count]));
}

function isTrueJsxAttribute(attribute: ts.JsxAttribute): boolean {
    if (!attribute.initializer) return true;
    return ts.isJsxExpression(attribute.initializer)
        && attribute.initializer.expression?.kind === ts.SyntaxKind.TrueKeyword;
}

function getJsxAttributeName(attribute: ts.JsxAttribute): string | undefined {
    return ts.isIdentifier(attribute.name) ? attribute.name.text : undefined;
}

function collectLegacyMutationUsage() {
    const root = process.cwd();
    const capabilitySites: Record<string, number> = {};
    const callSites: Record<string, number> = {};
    const gridSites: Record<string, LegacyWriterCategory> = {};
    const invalidGridSites: string[] = [];

    for (const absolutePath of listSourceFiles(path.join(root, "src"))) {
        const relativePath = path.relative(root, absolutePath).replaceAll("\\", "/");
        const source = ts.createSourceFile(
            relativePath,
            fs.readFileSync(absolutePath, "utf8"),
            ts.ScriptTarget.Latest,
            true,
            absolutePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
        );
        const gridComponentNames = new Set(["DB3EditGrid"]);

        for (const statement of source.statements) {
            if (!ts.isImportDeclaration(statement)
                || !ts.isStringLiteral(statement.moduleSpecifier)
                || !statement.moduleSpecifier.text.endsWith("db3DataGrid")) continue;
            const bindings = statement.importClause?.namedBindings;
            if (!bindings || !ts.isNamedImports(bindings)) continue;
            for (const element of bindings.elements) {
                if ((element.propertyName ?? element.name).text === "DB3EditGrid") {
                    gridComponentNames.add(element.name.text);
                }
            }
        }

        const visit = (node: ts.Node): void => {
            if (ts.isPropertyAccessExpression(node)
                && node.name.text === "Mutation"
                && ((ts.isIdentifier(node.expression) && node.expression.text === "xTableClientCaps")
                    || (ts.isPropertyAccessExpression(node.expression)
                        && node.expression.name.text === "xTableClientCaps"))) {
                increment(capabilitySites, relativePath);
            }

            if (ts.isCallExpression(node)
                && ts.isPropertyAccessExpression(node.expression)
                && ["doInsertMutation", "doUpdateMutation", "doDeleteMutation"]
                    .includes(node.expression.name.text)) {
                increment(callSites, relativePath);
            }

            if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node))
                && ts.isIdentifier(node.tagName)
                && gridComponentNames.has(node.tagName.text)) {
                const attributes = node.attributes.properties
                    .filter(ts.isJsxAttribute);
                const hasView = attributes.some(attribute => getJsxAttributeName(attribute) === "view");
                const readOnly = attributes.some(attribute =>
                    getJsxAttributeName(attribute) === "readOnly" && isTrueJsxAttribute(attribute));
                if (!hasView && !readOnly) {
                    const hasLegacyOptIn = attributes.some(attribute =>
                        getJsxAttributeName(attribute) === "legacyMutationTransport"
                        && isTrueJsxAttribute(attribute));
                    if (!hasLegacyOptIn) invalidGridSites.push(relativePath);
                    gridSites[relativePath] = legacyGridSites[relativePath] ?? "ordinary-grid";
                }
            }

            ts.forEachChild(node, visit);
        };
        visit(source);
    }

    return { capabilitySites, callSites, gridSites, invalidGridSites };
}

describe("legacy TableClient mutation inventory", () => {
    it("rejects new mutation capability and method consumers", () => {
        const usage = collectLegacyMutationUsage();
        expect(usage.capabilitySites).toEqual(inventoryCounts(legacyMutationCapabilitySites));
        expect(usage.callSites).toEqual(inventoryCounts(legacyMutationCallSites));
    });

    it("requires every writable legacy grid to be an explicit inventoried opt-in", () => {
        const usage = collectLegacyMutationUsage();
        expect(usage.invalidGridSites).toEqual([]);
        expect(usage.gridSites).toEqual(legacyGridSites);
    });
});
