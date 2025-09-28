#!/usr/bin/env node

/**
 * Upgrade script (server-side) to install a published release artifact.
 *
 * Flow:
 * - Load .env.deploy and .env.deploy.local
 * - List latest N releases from GitHub and let the user select one (or provide --tag/--url later)
 * - Download artifact (.tar.gz) and .sha256 to /tmp/cmdb-deploy/<tag>/
 * - Verify checksum
 * - Run upgrade steps:
 *   - supervisorctl stop <SERVICE>
 *   - mysqldump backup to BACKUP_DIR
 *   - git pull (existing convention)
 *   - yarn install --frozen-lockfile
 *   - tar -xzf artifact into repo root
 *   - blitz prisma generate
 *   - blitz prisma migrate deploy
 *   - supervisorctl start <SERVICE>
 */

import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import os from "node:os"
import readline from "node:readline/promises"
import { stdin as input, stdout as output } from "node:process"
import { getRepoRoot, log, sh, run, loadEnvFiles, ensureLocalEnvPair } from "./lib/release-utils.mjs"

const REPO_ROOT = getRepoRoot(import.meta.url)
const ENV_DEPLOY = path.join(REPO_ROOT, ".env.deploy")
const ENV_DEPLOY_LOCAL = path.join(REPO_ROOT, ".env.deploy.local")

// Initialize local env override if missing
ensureLocalEnvPair(ENV_DEPLOY, ENV_DEPLOY_LOCAL, "deploy")
// Precedence: process.env > .env.deploy.local > .env.deploy
loadEnvFiles([ENV_DEPLOY_LOCAL, ENV_DEPLOY])

const SERVICE = process.env.SERVICE || "cmdb"
const DB_NAME = process.env.DB_NAME || "tenfour_cmdb"
const BACKUP_DIR = expandHome(process.env.BACKUP_DIR || "~/backups")
const RELEASES_TO_SHOW = parseInt(process.env.RELEASES_TO_SHOW || "10", 10)
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ""

function expandHome(p) {
    if (!p) return p
    if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2))
    return p
}

function ownerRepoFromGit() {
    const url = sh("git", ["remote", "get-url", "origin"], { cwd: REPO_ROOT }) || ""
    const m = url.match(/github\.com[:/](.+?)(?:\.git)?$/)
    if (!m) throw new Error("origin is not a GitHub repo or cannot parse owner/repo")
    return m[1]
}

async function ghApi(method, url, body) {
    const headers = {
        Accept: "application/vnd.github+json",
        "User-Agent": "cmdb-upgrade",
    }
    if (token) headers["Authorization"] = `Bearer ${token}`
    const res = await fetch(url, {
        method,
        headers: { ...headers, ...(body ? { "Content-Type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
        const t = await res.text()
        throw new Error(`GitHub API ${method} ${url} -> ${res.status} ${t}`)
    }
    return res.json()
}

async function listReleases(ownerRepo, limit = 10) {
    const url = `https://api.github.com/repos/${ownerRepo}/releases?per_page=${limit}`
    const arr = await ghApi("GET", url)
    // Filter out drafts and prereleases; sort by published_at desc
    return arr
        .filter((r) => !r.draft && !r.prerelease)
        .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))
}

function pickAsset(release) {
    // Prefer .tar.gz; also capture .sha256
    const tar = release.assets.find((a) => a.name.endsWith(".tar.gz"))
    const sum = release.assets.find((a) => a.name.endsWith(".tar.gz.sha256") || a.name.endsWith(".sha256"))
    if (!tar) throw new Error(`No .tar.gz asset found for tag ${release.tag_name}`)
    if (!sum) throw new Error(`No .sha256 asset found for tag ${release.tag_name}`)
    return { tar, sum }
}

async function download(url, destPath) {
    const headers = { "User-Agent": "cmdb-upgrade" }
    if (token) headers["Authorization"] = `Bearer ${token}`
    const res = await fetch(url, { headers })
    if (!res.ok) {
        const t = await res.text()
        throw new Error(`Download failed ${url} -> ${res.status} ${t}`)
    }
    const buf = Buffer.from(await res.arrayBuffer())
    fs.mkdirSync(path.dirname(destPath), { recursive: true })
    fs.writeFileSync(destPath, buf)
}

function verifySha256(filePath, shaFilePath) {
    const wantLine = fs.readFileSync(shaFilePath, "utf8").split(/\r?\n/).find(Boolean) || ""
    const want = wantLine.split(/\s+/)[0]
    const got = crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex")
    if (!want || want.toLowerCase() !== got.toLowerCase()) {
        throw new Error(`Checksum mismatch for ${path.basename(filePath)}\n  expected: ${want}\n  actual:   ${got}`)
    }
}

async function upgradeWithArtifact(artifactPath, releaseTag) {
    // Stop service
    log("svc", `Stopping ${SERVICE}`)
    await run("supervisorctl", ["stop", SERVICE], { cwd: REPO_ROOT })

    try {
        // Backup DB
        fs.mkdirSync(BACKUP_DIR, { recursive: true })
        const ts = new Date().toISOString().replace(/[:T]/g, "-").replace(/\..+$/, "")
        const outSql = path.join(BACKUP_DIR, `${DB_NAME}_${releaseTag}_${ts}.sql`)
        log("db", `Backup ${DB_NAME} -> ${outSql}`)
        await run("mysqldump", ["--single-transaction", "--routines", "--triggers", DB_NAME, "-r", outSql], { cwd: REPO_ROOT })

        // Git pull (conform to existing procedure)
        log("git", "Pull latest")
        await run("git", ["pull", "--ff-only"], { cwd: REPO_ROOT })

        // Dependencies
        log("deps", "yarn install --frozen-lockfile")
        await run("yarn", ["install", "--frozen-lockfile"], { cwd: REPO_ROOT, shell: process.platform === "win32" })

        // Extract
        log("pack", `Extract ${path.basename(artifactPath)} -> repo root`)
        await run("tar", ["-xzf", artifactPath, "-C", REPO_ROOT], { cwd: REPO_ROOT })

        // Prisma / Blitz
        log("prisma", "blitz prisma generate")
        await run("blitz", ["prisma", "generate"], { cwd: REPO_ROOT, shell: process.platform === "win32" })
        log("prisma", "blitz prisma migrate deploy")
        await run("blitz", ["prisma", "migrate", "deploy"], { cwd: REPO_ROOT, shell: process.platform === "win32" })

    } catch (e) {
        // Attempt to start service back to reduce downtime on failure
        try { await run("supervisorctl", ["start", SERVICE], { cwd: REPO_ROOT }) } catch { }
        throw e
    }

    // Start service
    log("svc", `Starting ${SERVICE}`)
    await run("supervisorctl", ["start", SERVICE], { cwd: REPO_ROOT })
}

async function main() {
    log("task", "Upgrade (server-side)")
    const ownerRepo = ownerRepoFromGit()

    // Display effective config for confirmation
    const tokenSet = token ? "yes" : "no"
    log("cfg", `repo=${ownerRepo}`)
    log("cfg", `SERVICE=${SERVICE}`)
    log("cfg", `DB_NAME=${DB_NAME}`)
    log("cfg", `BACKUP_DIR=${BACKUP_DIR}`)
    log("cfg", `RELEASES_TO_SHOW=${RELEASES_TO_SHOW}`)
    log("cfg", `GITHUB_TOKEN set=${tokenSet}`)
    log("cfg", `cwd=${REPO_ROOT}`)
    log("cfg", `node=${process.version}`)

    if (!token) {
        throw new Error("GITHUB_TOKEN (or GH_TOKEN) is required on the server to list/download releases")
    }

    // List releases
    const list = await listReleases(ownerRepo, RELEASES_TO_SHOW)
    if (!list.length) throw new Error("No releases found")
    log("rel", `Showing latest ${Math.min(list.length, RELEASES_TO_SHOW)} releases:`)
    list.slice(0, RELEASES_TO_SHOW).forEach((r, i) => {
        const when = r.published_at || r.created_at || ""
        const star = i === 0 ? "* " : "  "
        const { tar } = pickAsset(r)
        process.stdout.write(`${star}[${i}] ${r.tag_name}  ${when}  (${tar.name})\n`)
    })

    // Prompt selection
    const rl = readline.createInterface({ input, output })
    let idxStr = await rl.question(`Select release index [0-${Math.min(list.length, RELEASES_TO_SHOW) - 1}] (default 0): `)
    rl.close()
    idxStr = (idxStr || "").trim()
    const idx = idxStr === "" ? 0 : Number(idxStr)
    if (!Number.isInteger(idx) || idx < 0 || idx >= Math.min(list.length, RELEASES_TO_SHOW)) {
        throw new Error("Invalid selection")
    }

    const release = list[idx]
    const { tar, sum } = pickAsset(release)
    const tag = release.tag_name

    // Download
    const workDir = path.join(os.tmpdir(), "cmdb-deploy", tag)
    const tarPath = path.join(workDir, tar.name)
    const sumPath = path.join(workDir, sum.name)
    log("dl", `Downloading ${tar.name}`)
    await download(tar.browser_download_url, tarPath)
    log("dl", `Downloading ${sum.name}`)
    await download(sum.browser_download_url, sumPath)

    // Verify
    log("dl", "Verifying checksum")
    verifySha256(tarPath, sumPath)

    // Upgrade steps
    await upgradeWithArtifact(tarPath, tag)

    log("done", `Upgrade to ${tag} complete`)
}

main().catch((err) => {
    process.stderr.write(`Error: ${err.message || err}\n`)
    process.exit(1)
})
