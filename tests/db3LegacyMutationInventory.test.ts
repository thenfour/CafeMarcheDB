import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

type LegacyWriterCategory =
    | "transport-infrastructure"
    | "workflow"
    | "legacy-helper";

interface InventoryEntry {
    category: LegacyWriterCategory;
    count: number;
}

// This is a deletion inventory, not an extension registry. A new entry means
// new dependency on the transport being retired and must not be added. Migrate
// the caller to a CRUD-enabled view or named command instead.
const legacyMutationCapabilitySites: Record<string, InventoryEntry> = {};

const legacyMutationCallSites: Record<string, InventoryEntry> = {};

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
                    invalidGridSites.push(relativePath);
                }
            }

            ts.forEachChild(node, visit);
        };
        visit(source);
    }

    return { capabilitySites, callSites, invalidGridSites };
}

describe("retired TableClient mutation transport", () => {
    it("has no mutation capability or method consumers", () => {
        const usage = collectLegacyMutationUsage();
        expect(usage.capabilitySites).toEqual(inventoryCounts(legacyMutationCapabilitySites));
        expect(usage.callSites).toEqual(inventoryCounts(legacyMutationCallSites));
    });

    it("requires every writable grid to supply a command-backed CRUD view", () => {
        const usage = collectLegacyMutationUsage();
        expect(usage.invalidGridSites).toEqual([]);
    });
});
