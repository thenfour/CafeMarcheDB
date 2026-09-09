#!/usr/bin/env node

/**
 * Packages a completed release build and optionally publishes it to GitHub.
 *
 * Intended for the GitHub Actions release workflow. A developer can also run
 * it inside the release container after build.mjs to inspect the package. Run
 * it from the repository root in the same clean checkout that produced .next/.
 *
 * Usage: node scripts/package-release.mjs
 *        node scripts/package-release.mjs --package-only
 * The first command publishes and requires GITHUB_TOKEN or GH_TOKEN. The safe
 * --package-only form only writes the archive, checksum and manifest to dist/.
 */

import fs from "node:fs"
import path from "node:path"
import { parseArgs } from "node:util"
import { getRepoRoot, log, git, run, sh, ensureClean, loadEnvFiles } from "./lib/release-utils.mjs"
import { readJson, writeJson, sha256File, isMain, reportError } from "./lib/release-files.mjs"
import { releaseIdentity, artifactNames, validateBuildRecord, assertArchiveEntries } from "./lib/release-model.mjs"
import { createGitHubClient, ownerRepoFromOrigin, publishRelease } from "./lib/github-releases.mjs"

const REPO_ROOT = getRepoRoot(import.meta.url)

function assertPackagePaths(directory, root = directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (directory === root && entry.name === "cache") continue
        const filePath = path.join(directory, entry.name)
        if (entry.isSymbolicLink() || !(entry.isDirectory() || entry.isFile())) throw new Error(`Cannot package special file ${filePath}.`)
        if (entry.isDirectory()) assertPackagePaths(filePath, root)
    }
}

export async function packageArtifact(repoRoot = REPO_ROOT) {
    ensureClean(repoRoot, false)
    const identity = releaseIdentity(readJson(path.join(repoRoot, "package.json")))
    const build = validateBuildRecord(readJson(path.join(repoRoot, ".next", "cmdb-build.json")), identity)
    if (build.commit !== git(["rev-parse", "HEAD"], repoRoot)) throw new Error("Build belongs to a different commit. Rebuild this checkout.")
    if (!fs.existsSync(path.join(repoRoot, ".next", "BUILD_ID"))) throw new Error("Missing .next/BUILD_ID.")
    assertPackagePaths(path.join(repoRoot, ".next"))
    const dist = path.join(repoRoot, "dist")
    fs.mkdirSync(dist, { recursive: true })
    const names = artifactNames(identity)
    // Runtime dependencies remain target-native; caches are not release assets.
    await run("tar", ["--exclude=./.next/cache", "-czf", `dist/${names.archive}`, "./.next"], { cwd: repoRoot })
    const archivePath = path.join(dist, names.archive)
    assertArchiveEntries(sh("tar", ["-tzf", archivePath]), sh("tar", ["-tvzf", archivePath]))
    const checksum = await sha256File(archivePath)
    fs.writeFileSync(path.join(dist, names.checksum), `${checksum}  ${names.archive}\n`)
    const manifest = { ...build, artifact: { name: names.archive, sha256: checksum } }
    writeJson(path.join(dist, names.manifest), manifest)
    return { manifest, dist }
}

export async function main() {
    const { values } = parseArgs({ options: { "package-only": { type: "boolean" }, help: { type: "boolean" } } })
    if (values.help) {
        console.log("Usage: node scripts/package-release.mjs [--package-only]\nPublish the built package.json product/version. --package-only writes dist/ without contacting GitHub.")
        return
    }
    loadEnvFiles([path.join(REPO_ROOT, ".env.release.local"), path.join(REPO_ROOT, ".env.release")])
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
    if (!values["package-only"] && !token) throw new Error("GITHUB_TOKEN (or GH_TOKEN) is required to publish.")
    const { manifest, dist } = await packageArtifact()
    log("pack", `${manifest.product}/${manifest.version} (${manifest.commit})`)
    if (values["package-only"]) return
    const ownerRepo = ownerRepoFromOrigin(git(["remote", "get-url", "origin"], REPO_ROOT))
    const release = await publishRelease(createGitHubClient(ownerRepo, token), manifest, dist)
    log("done", `Published ${release.html_url}`)
}

if (isMain(import.meta.url)) main().catch(reportError)
