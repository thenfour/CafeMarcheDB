#!/usr/bin/env node

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

export function sh(cmd, args = [], { cwd = process.cwd(), shell = process.platform === "win32" } = {}) {
    const res = spawnSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell })
    if (res.status !== 0) {
        const msg = (res.stderr || res.stdout || `command failed: ${cmd} ${args.join(" ")}`).trim()
        throw new Error(msg)
    }
    return res.stdout.trim()
}

export function run(cmd, args = [], { cwd = process.cwd(), shell = process.platform === "win32" } = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, args, { cwd, stdio: "inherit", shell })
        child.on("error", reject)
        child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} exited with code ${code}`))))
    })
}

export function git(args, repoRoot = process.cwd()) {
    return sh("git", args, { cwd: repoRoot })
}

export function ensureClean(repoRoot, ALLOW_DIRTY) {
    const p = git(["status", "--porcelain"], repoRoot)
    if (ALLOW_DIRTY) return;
    if (p.trim().length) {
        const lines = p.split(/\r?\n/).filter(Boolean).length
        throw new Error(`Working tree has ${lines} modified/untracked file(s). Commit or stash first.`)
    }
}

export function gitInfo(repoRoot = process.cwd()) {
    const branch = git(["rev-parse", "--abbrev-ref", "HEAD"], repoRoot) || "HEAD"
    const short = git(["rev-parse", "--short", "HEAD"], repoRoot)
    const cdate = git(["show", "-s", "--format=%ci", "HEAD"], repoRoot)
    return { branch, short, cdate }
}

export function tagInfo(repoRoot = process.cwd()) {
    let headTag = ""
    try { headTag = git(["describe", "--tags", "--exact-match"], repoRoot) } catch { }
    let latest = ""
    try { latest = git(["describe", "--tags", "--abbrev=0"], repoRoot) } catch { }
    let desc = ""
    try { desc = git(["describe", "--tags", "--long"], repoRoot) } catch { }
    const m = desc && /-(\d+)-g[0-9a-f]+$/.exec(desc)
    const commitsSince = m ? m[1] : undefined
    return { headTag, latest, desc, commitsSince }
}

export function ensureYarnAvailable(repoRoot = process.cwd()) {
    const res = spawnSync("yarn", ["--version"], { cwd: repoRoot, encoding: "utf8", shell: process.platform === "win32" })
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
