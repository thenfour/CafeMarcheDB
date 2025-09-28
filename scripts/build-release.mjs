#!/usr/bin/env node

/**
 * Build for release
 * - Confirms current git state (branch, commit, date) and reports if the tree is dirty
 * - Runs yarn install (frozen) + prisma client generate + blitz build
 * - Leaves the workspace ready for packaging
 *
 * Usage: node scripts/build-release.mjs [--allow-dirty] [--no-color]
 */

import { spawn, spawnSync } from "node:child_process"
import { promisify } from "node:util"
import { fileURLToPath } from "node:url"
import path from "node:path"
import process from "node:process"
import os from "node:os"
import { setTimeout as sleep } from "node:timers/promises"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, "..")

const args = new Set(process.argv.slice(2))
const ALLOW_DIRTY = args.has("--allow-dirty") || process.env.ALLOW_DIRTY === "1"
const USE_COLOR = !args.has("--no-color") && process.stdout.isTTY

const c = USE_COLOR
    ? {
        dim: (s) => `\x1b[2m${s}\x1b[0m`,
        green: (s) => `\x1b[32m${s}\x1b[0m`,
        red: (s) => `\x1b[31m${s}\x1b[0m`,
        cyan: (s) => `\x1b[36m${s}\x1b[0m`,
        yellow: (s) => `\x1b[33m${s}\x1b[0m`,
        bold: (s) => `\x1b[1m${s}\x1b[0m`,
    }
    : { dim: (s) => s, green: (s) => s, red: (s) => s, cyan: (s) => s, yellow: (s) => s, bold: (s) => s }

function log(section, message = "") {
    const stamp = new Date().toISOString()
    const label = c.bold(c.cyan(`[${section}]`))
    process.stdout.write(`${label} ${message ? message + " " : ""}${c.dim(`(${stamp})`)}\n`)
}

async function run(cmd, args, opts = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, args, {
            cwd: REPO_ROOT,
            stdio: "inherit",
            // On Windows, use a shell so yarn.cmd/npm.cmd resolve from PATH
            shell: process.platform === "win32",
            env: process.env,
            ...opts,
        })
        child.on("error", reject)
        child.on("exit", (code) => {
            if (code === 0) return resolve()
            reject(new Error(`${cmd} ${args.join(" ")} exited with code ${code}`))
        })
    })
}

async function git(args) {
    const res = spawnSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" })
    if (res.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${res.stderr || res.stdout}`)
    return res.stdout.trim()
}

async function checkGitState() {
    const branch = await git(["rev-parse", "--abbrev-ref", "HEAD"]) // may be 'HEAD' in detached state
    const commit = await git(["rev-parse", "--short", "HEAD"])
    const date = await git(["show", "-s", "--format=%ci", "HEAD"]) // commit date
    const statusPorcelain = await git(["status", "--porcelain"]) // empty if clean

    log("git", `branch=${branch} commit=${commit} date=${date}`)
    if (statusPorcelain) {
        const lines = statusPorcelain.split(/\r?\n/).filter(Boolean)
        log("git", c.yellow(`working tree has ${lines.length} modified/untracked file(s)`))
        if (!ALLOW_DIRTY) {
            throw new Error(
                "Working tree is dirty. Commit or stash changes, or pass --allow-dirty to proceed."
            )
        }
    } else {
        log("git", c.green("working tree clean"))
    }
}

function ensureYarnAvailable() {
    // Verify yarn is reachable and log version
    const res = spawnSync("yarn", ["--version"], {
        cwd: REPO_ROOT,
        encoding: "utf8",
        shell: process.platform === "win32",
    })
    if (res.status === 0) {
        const v = (res.stdout || "").trim()
        log("env", `yarn=${v || "<unknown>"}`)
        return
    }
    const msg = [
        "'yarn' was not found on PATH.",
        "Install Yarn Classic and ensure it is on PATH, then re-run:",
        process.platform === "win32" ? "- Windows: npm install -g yarn" : "- Linux/macOS: npm install -g yarn",
    ].join("\n")
    throw new Error(msg)
}

async function main() {
    const started = Date.now()
    log("env", `node=${process.version} platform=${process.platform} arch=${process.arch}`)
    log("task", "Build for release starting…")

    await checkGitState()

    // Install dependencies
    ensureYarnAvailable()
    log("step", "yarn install --frozen-lockfile")
    await run("yarn", ["install", "--frozen-lockfile"]) // Yarn Classic; if using Berry, switch to --immutable

    // Prisma client generate via Blitz
    log("step", "yarn blitz prisma generate")
    await run("yarn", ["blitz", "prisma", "generate"]) // requires network access to binaries.prisma.sh

    // Build the app
    log("step", "yarn build (blitz build)")
    await run("yarn", ["build"]) // delegates to package.json script

    const elapsed = ((Date.now() - started) / 1000).toFixed(1)
    log("done", c.green(`Build completed in ${elapsed}s. Ready for packaging.`))
}

main().catch((err) => {
    process.stderr.write(c.red(`Error: ${err.message || err}`) + "\n")
    process.exit(1)
})
