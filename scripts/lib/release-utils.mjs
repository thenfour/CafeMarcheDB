#!/usr/bin/env node

/**
 * Shared process, Git, environment-file and logging helpers for release tools.
 *
 * Internal module used on developer machines, in the release container and on
 * deployed instances. Human operators should run build.mjs,
 * package-release.mjs, upgrade.mjs or test-release.mjs instead.
 */

import { spawn, spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import path from "node:path"
import fs from "node:fs"

export function getRepoRoot(fromMetaUrl) {
    const __filename = fileURLToPath(fromMetaUrl)
    const __dirname = path.dirname(__filename)
    return path.resolve(__dirname, "..")
}

const USE_COLOR = process.stdout.isTTY
const color = USE_COLOR
    ? {
        dim: (s) => `\x1b[2m${s}\x1b[0m`,
        green: (s) => `\x1b[32m${s}\x1b[0m`,
        red: (s) => `\x1b[31m${s}\x1b[0m`,
        cyan: (s) => `\x1b[36m${s}\x1b[0m`,
        yellow: (s) => `\x1b[33m${s}\x1b[0m`,
        bold: (s) => `\x1b[1m${s}\x1b[0m`,
    }
    : { dim: (s) => s, green: (s) => s, red: (s) => s, cyan: (s) => s, yellow: (s) => s, bold: (s) => s }

export function log(section, message = "") {
    const stamp = new Date().toISOString()
    const label = color.bold(color.cyan(`[${section}]`))
    process.stdout.write(`${label} ${message ? message + " " : ""}${color.dim(`(${stamp})`)}\n`)
}

function needsShell(cmd) {
    return process.platform === "win32" && ["yarn", "npm", "blitz"].includes(cmd)
}

export function sh(cmd, args = [], { cwd = process.cwd(), shell = needsShell(cmd) } = {}) {
    // Tar inventories can exceed child_process's default 1 MB output limit.
    const res = spawnSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell, maxBuffer: 16 * 1024 * 1024 })
    if (res.error) throw res.error
    if (res.status !== 0) {
        const msg = (res.stderr || res.stdout || `command failed: ${cmd} ${args.join(" ")}`).trim()
        throw new Error(msg)
    }
    return res.stdout.trim()
}

export function run(cmd, args = [], { cwd = process.cwd(), shell = needsShell(cmd) } = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, args, { cwd, stdio: "inherit", shell })
        child.on("error", reject)
        child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} exited with code ${code}`))))
    })
}

export function git(args, repoRoot = process.cwd()) {
    return sh("git", args, { cwd: repoRoot })
}

// returns boolean
export function isClean(repoRoot) {
    const p = git(["status", "--porcelain"], repoRoot)
    const isDirty = p.trim().length > 0
    return !isDirty
}

// throws when not clean (if ALLOW_DIRTY is false)
export function ensureClean(repoRoot, ALLOW_DIRTY) {
    if (ALLOW_DIRTY) return;
    const localIsClean = isClean(repoRoot);
    if (!localIsClean) {
        throw new Error(`Working tree has modified/untracked content. Commit or stash first.`);
    }
    return "clean"
}

export function loadEnvFiles(paths) {
    for (const p of paths) {
        try {
            if (!p || !fs.existsSync(p)) continue
            const text = fs.readFileSync(p, "utf8")
            for (const line of text.split(/\r?\n/)) {
                const trimmed = line.trim()
                if (!trimmed || trimmed.startsWith("#")) continue
                const eq = trimmed.indexOf("=")
                if (eq === -1) continue
                const key = trimmed.slice(0, eq).trim()
                const val = trimmed.slice(eq + 1).trim()
                if (!(key in process.env)) process.env[key] = val
            }
        } catch {
            // ignore
        }
    }
}

// Initialize a local env override file by copying the base if the local file is missing
export function ensureLocalEnvPair(basePath, localPath, logSection = "env") {
    try {
        if (!fs.existsSync(localPath) && fs.existsSync(basePath)) {
            fs.copyFileSync(basePath, localPath)
            log(logSection, `Initialized ${path.basename(localPath)} from ${path.basename(basePath)} — update secrets as needed.`)
        }
    } catch (e) {
        log(logSection, `Failed to initialize ${path.basename(localPath)}: ${e.message || e}`)
    }
}
