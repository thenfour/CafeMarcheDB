#!/usr/bin/env node

/**
 * Builds CafeMarcheDB for a release without publishing it.
 *
 * Intended for the GitHub Actions release workflow and developers reproducing
 * that workflow. Run it from the repository root inside the image defined by
 * scripts/release/Dockerfile, not on a deployed Uberspace instance.
 *
 * Usage:
 *   node scripts/build.mjs [--help] [--allow-dirty]
 *  
 * Output: .next/, including .next/cmdb-build.json with release provenance.
 * The checkout must be clean; product and version come from package.json.

docker run --rm `
  --volume "${PWD}:/workspace" `
  --env DATABASE_URL=mysql://build:build@127.0.0.1:3306/cmdb_build `
  --env SESSION_SECRET_KEY=cmdb-build-placeholder-not-a-runtime-secret `
  --env CMDB_BASE_URL=http://localhost:10455 `
  --env FILE_UPLOAD_PATH=/tmp/cmdb-build-uploads `
  --env NODE_OPTIONS=--max-old-space-size=5632 `
  cmdb-release node scripts/build.mjs


*/

import fs from "node:fs"
import path from "node:path"
import { parseArgs } from "node:util"
import { getRepoRoot, log, run, git, sh, ensureClean } from "./lib/release-utils.mjs"
import { readJson, writeJson, isMain, reportError } from "./lib/release-files.mjs"
import { releaseIdentity, RELEASE_SCHEMA_VERSION, readRuntime, assertBuildRuntime } from "./lib/release-model.mjs"

const REPO_ROOT = getRepoRoot(import.meta.url)

function sourceRef() {
    const ref = process.env.GITHUB_REF || git(["symbolic-ref", "HEAD"], REPO_ROOT)
    if (!ref.startsWith("refs/heads/")) throw new Error("Release builds must select a branch.")
    return ref
}

export async function main() {
    const { values } = parseArgs({ options: { help: { type: "boolean" } } })
    if (values.help) {
        console.log("Usage: node scripts/build.mjs [--help] [--allow-dirty]\nBuild a clean checkout using scripts/release/Dockerfile. Produces .next/cmdb-build.json.")
        return
    }
    const allowDirty = values["allow-dirty"] || false

    const started = Date.now()
    ensureClean(REPO_ROOT, !allowDirty)
    const identity = releaseIdentity(readJson(path.join(REPO_ROOT, "package.json")))
    const commit = git(["rev-parse", "HEAD"], REPO_ROOT)
    const ref = sourceRef()
    const runtime = readRuntime(sh("yarn", ["--version"], { cwd: REPO_ROOT }))
    assertBuildRuntime(runtime)
    log("build", `${identity.product}/${identity.version} ${ref} ${commit}`)

    // Fixed path under the repository; a failed build must not leave old build evidence.
    const buildDirectory = path.join(REPO_ROOT, ".next")
    fs.rmSync(buildDirectory, { recursive: true, force: true })
    await run("yarn", ["install", "--frozen-lockfile", "--non-interactive"], { cwd: REPO_ROOT })
    await run("yarn", ["blitz", "prisma", "generate"], { cwd: REPO_ROOT })
    await run("yarn", ["build"], { cwd: REPO_ROOT })
    if (!allowDirty) {
        ensureClean(REPO_ROOT, false)
    }
    if (git(["rev-parse", "HEAD"], REPO_ROOT) !== commit) {
        throw new Error("Source commit changed while building.");
    }
    if (!fs.existsSync(path.join(buildDirectory, "BUILD_ID"))) throw new Error("Build did not produce .next/BUILD_ID.")
    writeJson(path.join(buildDirectory, "cmdb-build.json"), {
        schemaVersion: RELEASE_SCHEMA_VERSION,
        ...identity,
        commit,
        sourceRef: ref,
        builtAt: new Date().toISOString(),
        dirty: false,
        runtime,
    })
    log("done", `Build completed in ${((Date.now() - started) / 1000).toFixed(1)}s.`)
}

if (isMain(import.meta.url)) main().catch(reportError)
