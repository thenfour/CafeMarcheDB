import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isDeferredTestFile, readRestorationReferences, verifyRestorationManifest } from "../scripts/lib/migration-restoration.cjs";

type RestorationManifest = Parameters<typeof verifyRestorationManifest>[0];
type RestorationFeature = RestorationManifest["features"][number];

const sourceLocation = `${"a".repeat(40)}:tests/original.test.ts:1-3`;
const originalLines = ["/* Existing block comment. */", "const view = <div>{value}</div>;", ""];
const sha256 = createHash("sha256").update(originalLines.join("\n")).digest("hex");
const file = "tests/preserved.test.tsx";

function referenceBlock(): string {
    return [
        "// MIGRATION_RESTORE: example-feature",
        `// Source: ${sourceLocation}`,
        "// Reason: Its storage model was removed.",
        "// Restore: Adapt the workflow to band ownership.",
        "// Verification: Run its behavioral tests and browser workflow.",
        `// SHA256: ${sha256}`,
        "// MIGRATION_REFERENCE_BEGIN",
        ...originalLines.map(line => line ? `// ${line}` : "//"),
        "// MIGRATION_REFERENCE_END",
        "",
    ].join("\n");
}

function deferredSpecification(activeSource = "export {};"): string {
    return `// MIGRATION_DEFERRED_TEST\n${activeSource}\n${referenceBlock()}`;
}

function pendingFeature(): RestorationFeature {
    return {
        id: "example-feature",
        status: "pending",
        reason: "Its storage model was removed.",
        restore: "Adapt the workflow to band ownership.",
        verification: "Run its behavioral tests and browser workflow.",
        evidence: [],
    };
}

function pendingManifest(): RestorationManifest {
    return { features: [pendingFeature()], references: [{ file, featureId: "example-feature", source: sourceLocation, sha256 }] };
}

describe("migration source preservation", () => {
    it("round trips JSX, nested comments and blank source lines without executing them", () => {
        expect(readRestorationReferences(referenceBlock(), file)).toEqual(pendingManifest().references);
        expect(readRestorationReferences(`\uFEFF${referenceBlock().replaceAll("\n", "\r\n")}`, file))
            .toEqual(pendingManifest().references);
    });

    it.each([
        ["changed source", (source: string) => source.replace("<div>", "<span>"), "checksum changed"],
        ["uncommented source", (source: string) => source.replace("// const view", "const view"), "only line comments"],
        ["missing end", (source: string) => source.replace("// MIGRATION_REFERENCE_END", ""), "only line comments"],
        ["wrong range", (source: string) => source.replace(":1-3", ":1-4"), "source length"],
        ["abbreviated commit", (source: string) => source.replace("a".repeat(40), "abcdef1"), "full commit"],
        ["missing criterion", (source: string) => source.replace("// Restore: Adapt the workflow to band ownership.", "// Restore: "), "Missing Restore"],
    ])("rejects %s", (_name, damage, message) => {
        expect(() => readRestorationReferences(damage(referenceBlock()), file)).toThrow(message);
    });

    it.each(["// MIGRATION_REFERENCE_BEGIN", "// MIGRATION_REFERENCE_END"])("rejects an orphan %s", delimiter => {
        expect(() => readRestorationReferences(delimiter, file)).toThrow("Orphan");
    });

    it("recognizes only wholly inert deferred test files", () => {
        expect(isDeferredTestFile(deferredSpecification(), file)).toBe(true);
        expect(isDeferredTestFile(deferredSpecification().replaceAll("\n", "\r\n"), file)).toBe(true);
        expect(isDeferredTestFile(referenceBlock(), file)).toBe(false);
        expect(isDeferredTestFile(`\uFEFF${deferredSpecification()}`, file)).toBe(true);
    });

    it.each([
        'import "./side-effect"; export {};',
        'export {} from "./side-effect";',
        'export {}; it("silently hidden test", () => {});',
        'export {}; const malformed = ;',
    ])("does not let a deferred marker hide executable or malformed code: %s", executable => {
        expect(() => isDeferredTestFile(deferredSpecification(executable), file)).toThrow("only comments and export {}");
    });

    it("rejects a deferred test file whose specification was deleted", () => {
        expect(() => isDeferredTestFile("// MIGRATION_DEFERRED_TEST\nexport {};", file)).toThrow("needs preserved source");
    });
});

describe("migration restoration accountability", () => {
    it("accepts intact pending references", () => {
        expect(() => verifyRestorationManifest(pendingManifest(), readRestorationReferences(referenceBlock(), file))).not.toThrow();
    });

    it("detects a deleted file or reference block through the independent inventory", () => {
        expect(() => verifyRestorationManifest(pendingManifest(), [])).toThrow("Missing restoration reference");
    });

    it("detects a changed reference even if its local checksum was updated", () => {
        const changed = pendingManifest().references.map(reference => ({ ...reference, sha256: "b".repeat(64) }));
        expect(() => verifyRestorationManifest(pendingManifest(), changed)).toThrow("Unregistered or changed");
    });

    it("rejects unregistered and duplicate blocks", () => {
        const references = pendingManifest().references;
        expect(() => verifyRestorationManifest({ ...pendingManifest(), references: [] }, references)).toThrow("Unregistered");
        expect(() => verifyRestorationManifest(pendingManifest(), [...references, ...references])).toThrow("Unregistered");
    });

    it("does not let a pending feature disappear by deleting its inventory entries", () => {
        expect(() => verifyRestorationManifest({ features: [pendingFeature()], references: [] }, [])).toThrow("no preserved source");
    });

    it("requires verification evidence before closing a feature", () => {
        const feature: RestorationFeature = { ...pendingFeature(), status: "restored" };
        expect(() => verifyRestorationManifest({ features: [feature], references: [] }, [])).toThrow("recorded evidence");
        expect(() => verifyRestorationManifest({
            features: [{ ...feature, evidence: ["Focused tests and built-browser checks recorded at the restoration commit."] }], references: [],
        }, [])).not.toThrow();
    });

    it("requires removal of reference blocks before declaring a feature restored", () => {
        const manifest = pendingManifest();
        expect(() => verifyRestorationManifest({
            ...manifest,
            features: [{ ...pendingFeature(), status: "restored", evidence: ["Verified."] }],
        }, manifest.references)).toThrow("removal of its reference blocks");
    });

    it("requires an explicit approval record before retirement", () => {
        const retired: RestorationFeature = { ...pendingFeature(), status: "retired", evidence: ["Retirement decision recorded."] };
        expect(() => verifyRestorationManifest({ features: [retired], references: [] }, [])).toThrow("explicit user approval");
        expect(() => verifyRestorationManifest({
            features: [{ ...retired, retirementApproval: "User approved retiring this example feature in the review." }], references: [],
        }, [])).not.toThrow();
    });
});
