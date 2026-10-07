const path = require("node:path")
const { inspectRestoration } = require("./lib/migration-restoration.cjs")

const mode = process.argv[2]
if (!["status", "verify", "complete"].includes(mode) || process.argv.length !== 3) {
  console.error("Usage: node scripts/check-migration-restoration.cjs <status|verify|complete>")
  process.exit(1)
}

try {
  const { features, references, deferredTestFiles } = inspectRestoration(path.resolve(__dirname, ".."))
  const pending = features.filter(feature => feature.status === "pending")
  console.log(`[migration] Preservation verified: ${references.length} source references; ${deferredTestFiles.length} deferred test specifications.`)
  console.log(`[migration] ${pending.length} features await restoration.`)
  if (mode === "status") {
    for (const feature of pending) {
      const count = references.filter(reference => reference.featureId === feature.id).length
      console.log(`  ${feature.id}: ${count} ${count === 1 ? "reference" : "references"} — ${feature.restore}`)
    }
  }
  if (mode === "complete" && pending.length !== 0) {
    console.error("[migration] Completion blocked. Restore each feature with verification evidence, or record explicit user approval to retire it.")
    process.exitCode = 1
  }
} catch (error) {
  console.error(`[migration] ${error.message}`)
  process.exitCode = 1
}
