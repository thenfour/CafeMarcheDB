const fs = require("node:fs")
const path = require("node:path")
const { createHash } = require("node:crypto")
const ts = require("typescript")

/** @typedef {{ id: string, status: "pending" | "restored" | "retired", reason: string, restore: string, verification: string, evidence: string[], retirementApproval?: string }} RestorationFeature */
/** @typedef {{ file: string, featureId: string, source: string, sha256: string }} RestorationReference */
/** @typedef {{ features: RestorationFeature[], references: RestorationReference[] }} RestorationManifest */

const deferredTestMarker = "// MIGRATION_DEFERRED_TEST"
const referenceStart = "// MIGRATION_REFERENCE_BEGIN"
const referenceEnd = "// MIGRATION_REFERENCE_END"
const manifestPath = "docs/localization-multitenancy/feature-restoration.json"

/** @param {string} file @param {number} line @param {string} message @returns {never} */
function fail(file, line, message) {
  throw new Error(`${file}:${line}: ${message}`)
}

/**
 * Read dedicated line comments, so archived JSX and nested comments stay inert.
 * @param {string} source @param {string} file
 */
function readRestorationReferences(source, file) {
  const lines = source.replace(/^\uFEFF/, "").split(/\r?\n/)
  /** @type {RestorationReference[]} */
  const references = []
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].startsWith("// MIGRATION_RESTORE:")) {
      if (lines[index] === referenceStart || lines[index] === referenceEnd) {
        fail(file, index + 1, "Orphan migration reference delimiter.")
      }
      continue
    }
    const feature = /^\/\/ MIGRATION_RESTORE: ([a-z][a-z0-9-]*)$/.exec(lines[index])
    if (!feature) {
      fail(file, index + 1, "Invalid restoration feature ID.")
    }
    const headers = ["Source", "Reason", "Restore", "Verification", "SHA256"]
    const values = headers.map((header, offset) => {
      const line = lines[index + offset + 1]
      const prefix = `// ${header}: `
      if (!line?.startsWith(prefix) || line.length === prefix.length) {
        fail(file, index + offset + 2, `Missing ${header} header.`)
      }
      return line.slice(prefix.length)
    })
    const sourceLocation = /^([a-f0-9]{40}):([^:]+):(\d+)-(\d+)$/.exec(values[0])
    if (!sourceLocation || Number(sourceLocation[3]) < 1 || Number(sourceLocation[4]) < Number(sourceLocation[3])) {
      fail(file, index + 2, "Source must identify a full commit, path, and valid line range.")
    }
    index += headers.length + 1
    if (lines[index] !== referenceStart) {
      fail(file, index + 1, "Missing migration reference start.")
    }
    const body = []
    for (index += 1; index < lines.length && lines[index] !== referenceEnd; index += 1) {
      if (lines[index] === "//") {
        body.push("")
      } else if (lines[index].startsWith("// ")) {
        body.push(lines[index].slice(3))
      } else {
        fail(file, index + 1, "Preserved source must contain only line comments.")
      }
    }
    if (lines[index] !== referenceEnd) {
      fail(file, index + 1, "Missing migration reference end.")
    }
    const expectedLines = Number(sourceLocation[4]) - Number(sourceLocation[3]) + 1
    if (body.length !== expectedLines) {
      fail(file, index + 1, "Preserved source length differs from its source range.")
    }
    const sha256 = createHash("sha256").update(body.join("\n")).digest("hex")
    if (sha256 !== values[4]) {
      fail(file, index + 1, "Preserved source checksum changed.")
    }
    references.push({ file, featureId: feature[1], source: values[0], sha256 })
  }
  return references
}

/**
 * A marker cannot hide live tests: only the empty module export is allowed.
 * @param {string} source @param {string} file
 */
function isDeferredTestFile(source, file) {
  const firstLine = source.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0]
  if (firstLine !== deferredTestMarker) {
    return false
  }
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const statement = parsed.statements[0]
  const emptyModule = parsed.statements.length === 1 && statement
    && ts.isExportDeclaration(statement) && !statement.moduleSpecifier
    && statement.exportClause && ts.isNamedExports(statement.exportClause)
    && statement.exportClause.elements.length === 0
  if (parsed.parseDiagnostics.length !== 0 || !emptyModule) {
    fail(file, 1, "A deferred test specification must contain only comments and export {}.")
  }
  if (readRestorationReferences(source, file).length === 0) {
    fail(file, 1, "A deferred test specification needs preserved source.")
  }
  return true
}

/** @param {RestorationReference} reference */
function referenceKey(reference) {
  return `${reference.file}\0${reference.featureId}\0${reference.source}`
}

/** @param {RestorationManifest} manifest @param {RestorationReference[]} references */
function verifyRestorationManifest(manifest, references) {
  /** @type {Map<string, RestorationFeature>} */
  const features = new Map()
  for (const feature of manifest.features) {
    if (features.has(feature.id) || !/^[a-z][a-z0-9-]*$/.test(feature.id)
      || !["pending", "restored", "retired"].includes(feature.status)
      || !feature.reason?.trim() || !feature.restore?.trim() || !feature.verification?.trim()
      || !Array.isArray(feature.evidence)) {
      throw new Error(`Invalid restoration feature: ${feature.id}.`)
    }
    features.set(feature.id, feature)
  }
  /** @type {Map<string, RestorationReference>} */
  const expected = new Map()
  for (const reference of manifest.references) {
    const key = referenceKey(reference)
    if (expected.has(key) || !features.has(reference.featureId)) {
      throw new Error(`Duplicate reference or unknown feature: ${reference.file}.`)
    }
    expected.set(key, reference)
  }
  const found = new Set()
  for (const reference of references) {
    const key = referenceKey(reference)
    if (found.has(key) || expected.get(key)?.sha256 !== reference.sha256) {
      throw new Error(`Unregistered or changed restoration reference: ${reference.file}.`)
    }
    found.add(key)
  }
  for (const [key, reference] of expected) {
    if (!found.has(key)) {
      throw new Error(`Missing restoration reference: ${reference.file} (${reference.featureId}).`)
    }
  }
  for (const feature of features.values()) {
    const hasReferences = references.some(reference => reference.featureId === feature.id)
    if (feature.status === "pending" && !hasReferences) {
      throw new Error(`Pending feature has no preserved source: ${feature.id}.`)
    }
    if (feature.status !== "pending" && (hasReferences || feature.evidence.length === 0
      || feature.evidence.some(entry => typeof entry !== "string" || !entry.trim()))) {
      throw new Error(`Closing ${feature.id} requires recorded evidence and removal of its reference blocks.`)
    }
    if (feature.status === "retired" && !feature.retirementApproval?.trim()) {
      throw new Error(`Retiring ${feature.id} requires a record of explicit user approval.`)
    }
  }
}

/** @param {string} root @param {string} directory @returns {string[]} */
function findSourceFiles(root, directory) {
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(entry => {
    const relative = `${directory}/${entry.name}`
    if (entry.isDirectory()) {
      return findSourceFiles(root, relative)
    }
    return entry.isFile() && /\.tsx?$/.test(entry.name) ? [relative] : []
  })
}

/** @param {string} root */
function inspectRestoration(root) {
  /** @type {RestorationManifest} */
  const manifest = JSON.parse(fs.readFileSync(path.join(root, manifestPath), "utf8"))
  /** @type {RestorationReference[]} */
  const references = []
  /** @type {string[]} */
  const deferredTestFiles = []
  for (const file of ["src", "shared", "db", "tests"].flatMap(directory => findSourceFiles(root, directory)).sort()) {
    const source = fs.readFileSync(path.join(root, file), "utf8")
    references.push(...readRestorationReferences(source, file))
    if (/\.test\.tsx?$/.test(file) && isDeferredTestFile(source, file)) {
      deferredTestFiles.push(file)
    }
  }
  verifyRestorationManifest(manifest, references)
  return { features: manifest.features, references, deferredTestFiles }
}

module.exports = { inspectRestoration, isDeferredTestFile, readRestorationReferences, verifyRestorationManifest }
