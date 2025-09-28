#!/usr/bin/env node

/**
 * Build for release
 * - Confirms current git state (branch, commit, date) and reports if the tree is dirty
 * - Runs yarn install (frozen) + prisma client generate + blitz build
 * - Leaves the workspace ready for packaging
 *
 * Usage: node scripts/build-release.mjs [--allow-dirty]
 */

import { getRepoRoot, log, run, git, ensureYarnAvailable } from "./lib/release-utils.mjs"
import process from "node:process"

const REPO_ROOT = getRepoRoot(import.meta.url)
const args = new Set(process.argv.slice(2))
const ALLOW_DIRTY = args.has("--allow-dirty") || process.env.ALLOW_DIRTY === "1"

async function checkGitState() {
    const branch = git(["rev-parse", "--abbrev-ref", "HEAD"], REPO_ROOT) // may be 'HEAD' in detached state
    const commit = git(["rev-parse", "--short", "HEAD"], REPO_ROOT)
    const date = git(["show", "-s", "--format=%ci", "HEAD"], REPO_ROOT) // commit date
    const statusPorcelain = git(["status", "--porcelain"], REPO_ROOT) // empty if clean

    log("git", `branch=${branch} commit=${commit} date=${date}`)
    if (statusPorcelain) {
        const lines = statusPorcelain.split(/\r?\n/).filter(Boolean)
        log("git", `working tree has ${lines.length} modified/untracked file(s)`)
        if (!ALLOW_DIRTY) {
            throw new Error("Working tree is dirty. Commit or stash changes, or pass --allow-dirty to proceed.")
        }
    } else {
        log("git", "working tree clean")
    }
}

async function main() {
    const started = Date.now()
    log("env", `node=${process.version} platform=${process.platform} arch=${process.arch}`)
    log("task", "Build for release starting…")

    await checkGitState()

    ensureYarnAvailable(REPO_ROOT)
    log("step", "yarn install --frozen-lockfile")
    await run("yarn", ["install", "--frozen-lockfile"], { cwd: REPO_ROOT })

    log("step", "yarn blitz prisma generate")
    await run("yarn", ["blitz", "prisma", "generate"], { cwd: REPO_ROOT })

    log("step", "yarn build (blitz build)")
    await run("yarn", ["build"], { cwd: REPO_ROOT })

    const elapsed = ((Date.now() - started) / 1000).toFixed(1)
    log("done", `Build completed in ${elapsed}s. Ready for packaging.`)
}

main().catch((err) => {
    console.error(`Error: ${err.message || err}`)
    process.exit(1)
})
