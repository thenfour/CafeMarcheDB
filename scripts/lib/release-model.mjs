/**
 * Defines and validates the shared release contract: product/version identity,
 * artifact names, manifests and the Uberspace-compatible runtime profile.
 *
 * Internal module used by the build, publishing and deployment scripts. Human
 * operators do not run this file directly. Package metadata is authoritative;
 * Git tags are derived storage keys.
 */

export const PRODUCTS = ["cafemarche", "single-band", "multi-tenant"]
export const RELEASE_SCHEMA_VERSION = 1
export const RELEASE_RUNTIME = Object.freeze({
    profile: "uberspace7-node18",
    os: "linux",
    arch: "x64",
    glibc: "2.17",
    node: "18.20.8",
    yarn: "1.22.22",
})

// SemVer: 3.0.0, 3.1.0-rc.1, 3.1.0+build.2. Numeric identifiers cannot have leading zeroes.
const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/
const COMMIT_PATTERN = /^[0-9a-f]{40}$/
const CHECKSUM_PATTERN = /^[0-9a-f]{64}$/

export function validateProduct(product) {
    if (!PRODUCTS.includes(product)) throw new Error(`Unknown product ${product}. Expected ${PRODUCTS.join(", ")}.`)
    return product
}

export function validateVersion(version) {
    if (typeof version !== "string" || !VERSION_PATTERN.test(version)) {
        throw new Error(`Invalid package version ${version}. Use SemVer, for example 3.0.0 or 3.1.0-rc.1.`)
    }
    return version
}

export function releaseIdentity(packageJson) {
    const product = validateProduct(packageJson.cmdb?.product)
    const version = validateVersion(packageJson.version)
    return { product, version, tag: `${product}-v${version}` }
}

export function identityForVersion(product, version) {
    return releaseIdentity({ cmdb: { product }, version })
}

export function identityFromTag(tag, product) {
    const prefix = `${validateProduct(product)}-v`
    if (typeof tag !== "string" || !tag.startsWith(prefix)) return null
    try { return identityForVersion(product, tag.slice(prefix.length)) } catch { return null }
}

export function artifactNames(identity) {
    const base = `cmdb_${identity.product}_${identity.version}`
    return { archive: `${base}.tar.gz`, checksum: `${base}.tar.gz.sha256`, manifest: `${base}.manifest.json` }
}

export function assertSameIdentity(actual, expected) {
    if (actual.product !== expected.product || actual.version !== expected.version || actual.tag !== expected.tag) {
        throw new Error(`Release identity mismatch: expected ${expected.product}/${expected.version}.`)
    }
}

export function readRuntime(yarn) {
    return {
        profile: RELEASE_RUNTIME.profile,
        os: process.platform,
        arch: process.arch,
        glibc: process.report.getReport().header.glibcVersionRuntime,
        node: process.versions.node,
        yarn,
    }
}

export function assertBuildRuntime(runtime) {
    for (const [key, value] of Object.entries(RELEASE_RUNTIME)) {
        if (runtime[key] !== value) throw new Error(`Release build requires ${key}=${value}; found ${runtime[key]}. Use scripts/release/Dockerfile.`)
    }
}

function versionAtLeast(actual, minimum) {
    const left = actual.split(".").map(Number)
    const right = minimum.split(".").map(Number)
    for (let index = 0; index < Math.max(left.length, right.length); index++) {
        const difference = (left[index] || 0) - (right[index] || 0)
        if (difference) return difference > 0
    }
    return true
}

export function assertDeploymentRuntime(buildRuntime, actual) {
    assertBuildRuntime(buildRuntime)
    const compatible = actual.os === buildRuntime.os && actual.arch === buildRuntime.arch
        && typeof actual.glibc === "string" && versionAtLeast(actual.glibc, buildRuntime.glibc)
        && actual.node.split(".")[0] === buildRuntime.node.split(".")[0]
        && versionAtLeast(actual.node, buildRuntime.node) && actual.yarn === buildRuntime.yarn
    if (!compatible) throw new Error(`Host runtime is incompatible with ${buildRuntime.profile}: ${JSON.stringify(actual)}`)
}

export function validateBuildRecord(record, identity) {
    if (record?.schemaVersion !== RELEASE_SCHEMA_VERSION) throw new Error("Unsupported build manifest schema.")
    assertSameIdentity(record, identity)
    if (!COMMIT_PATTERN.test(record.commit)) throw new Error("Build manifest requires a full commit SHA.")
    if (typeof record.sourceRef !== "string" || !record.sourceRef.startsWith("refs/heads/")) {
        throw new Error("Build manifest requires its source branch ref.")
    }
    if (record.dirty !== false) throw new Error("A release must be built from a clean checkout.")
    if (typeof record.builtAt !== "string" || !Number.isFinite(Date.parse(record.builtAt))) throw new Error("Invalid build date.")
    assertBuildRuntime(record.runtime)
    return record
}

export function validateManifest(manifest, identity) {
    validateBuildRecord(manifest, identity)
    if (manifest.artifact?.name !== artifactNames(identity).archive || !CHECKSUM_PATTERN.test(manifest.artifact?.sha256)) {
        throw new Error("Invalid release artifact name or checksum.")
    }
    return manifest
}

export function assertManifestMatchesBuild(manifest, build) {
    validateBuildRecord(build, manifest)
    for (const key of ["commit", "sourceRef", "builtAt"]) {
        if (build[key] !== manifest[key]) throw new Error(`Archive build metadata does not match release ${key}.`)
    }
}

export function selectReleaseAssets(release, identity) {
    const selected = {}
    for (const [kind, name] of Object.entries(artifactNames(identity))) {
        const matches = release.assets.filter((asset) => asset.name === name && asset.state === "uploaded")
        if (matches.length !== 1) throw new Error(`Release ${identity.tag} requires exactly one uploaded ${name}.`)
        selected[kind] = matches[0]
    }
    return selected
}

export function assertArchiveEntries(names, details) {
    const entries = names.trim().split(/\r?\n/)
    if (!entries.length || entries.some((name) => {
        const relative = name.replace(/^\.\//, "")
        return !(relative === ".next" || relative.startsWith(".next/"))
            || relative.split("/").includes("..") || relative.includes("\\")
    })) throw new Error("Release archive must contain only paths beneath .next/.")
    // Symlinks and hard links can escape the extraction directory even with safe entry names.
    if (details.trim().split(/\r?\n/).some((entry) => !["-", "d"].includes(entry[0]))) {
        throw new Error("Release archive may contain only regular files and directories.")
    }
}
