#!/usr/bin/env node

/**
 * Package and publish a release artifact to GitHub Releases.
 *
 * Assumes you have already built for release.
 *
 * Flow:
 * - Verify git is clean
 * - Show current branch/commit and latest tag + commits since
 * - Require that HEAD is exactly on a tag (version tag)
 * - Create dist/cmdb_<tag>_<shortsha>.tar.gz from files_to_deploy.txt + a .sha256 checksum
 * - Write a small manifest.json alongside
 * - Create or reuse a GitHub Release for the tag and upload assets
 * - Move a rolling tag (default: `latest`) to point at this version and push it
 * - Print release page URL and direct download URL(s)
 *
 * Requirements:
 * - Node 18+
 * - tar available in PATH (Linux/macOS recommended)
 * - env GITHUB_TOKEN (or GH_TOKEN) with repo scope
 */

import { spawnSync } from "node:child_process"
import readline from "node:readline/promises"
import { stdin as input, stdout as output } from "node:process"
import path from "node:path"
import fs from "node:fs"
import crypto from "node:crypto"
import { getRepoRoot, log, sh, git, ensureClean, tagInfo, loadEnvFiles } from "./lib/release-utils.mjs"

const REPO_ROOT = getRepoRoot(import.meta.url)
// Initialize local env file for convenience on first run
const ENV_RELEASE = path.join(REPO_ROOT, ".env.release")
const ENV_LOCAL = path.join(REPO_ROOT, ".env.release.local")
try {
    if (!fs.existsSync(ENV_LOCAL) && fs.existsSync(ENV_RELEASE)) {
        fs.copyFileSync(ENV_RELEASE, ENV_LOCAL)
        log("env", "Initialized .env.release.local from .env.release — set GITHUB_TOKEN before publishing.")
    }
} catch (e) {
    log("env", `Failed to initialize .env.release.local: ${e.message || e}`)
}
loadEnvFiles([
    path.join(REPO_ROOT, ".env.release"),
    path.join(REPO_ROOT, ".env.release.local"),
])

const args = new Set(process.argv.slice(2))
const ALLOW_DIRTY = args.has("--allow-dirty") || process.env.ALLOW_DIRTY === "1"

const DIST_DIR = path.join(REPO_ROOT, "dist")
const FILES_LIST = path.join(REPO_ROOT, "files_to_deploy.txt")
const ROLLING_TAG = process.env.ROLLING_TAG || "latest" // "latest published" pointer

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ""

function getOwnerRepo() {
    const url = sh("git", ["remote", "get-url", "origin"], { cwd: REPO_ROOT }) || ""
    const m = url.match(/github\.com[:/](.+?)(?:\.git)?$/)
    if (!m) throw new Error("origin is not a GitHub repo or cannot parse owner/repo")
    return m[1]
}

function shortSha() { return sh("git", ["rev-parse", "--short", "HEAD"], { cwd: REPO_ROOT }) || "" }
function currentBranch() { return sh("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: REPO_ROOT }) || "HEAD" }
function commitDate() { return sh("git", ["show", "-s", "--format=%ci", "HEAD"], { cwd: REPO_ROOT }) || "" }

function readFilesList(listPath) {
    if (!fs.existsSync(listPath)) {
        throw new Error(`Missing files list: ${path.relative(REPO_ROOT, listPath)}`)
    }
    let text = fs.readFileSync(listPath, "utf8")
    // Strip BOM if present
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)
    let entries = text
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((s) => s && !s.startsWith("#"))
        .map((s) => s.replace(/^\.?\/+/, "")) // drop leading ./ or /
        .map((s) => s.replace(/\\/g, "/")) // normalize backslashes to forward slashes for tar
    // Ensure entries are unique, non-empty, and prefixed with ./ for tar
    entries = Array.from(new Set(entries)).filter(Boolean).map((e) => (e.startsWith("./") ? e : `./${e}`))
    return entries
}

function validateEntries(entries) {
    const missing = []
    for (const e of entries) {
        const p = path.join(REPO_ROOT, e)
        if (!fs.existsSync(p)) missing.push(e)
    }
    if (missing.length) {
        throw new Error(
            `Missing paths listed in files_to_deploy.txt:\n  - ${missing.join("\n  - ")}\n` +
            `Ensure your build created them (e.g., .next/) and the list is correct.`
        )
    }
}

function makeTarball(basename, entries) {
    fs.mkdirSync(DIST_DIR, { recursive: true })
    const tarName = `${basename}.tar.gz`
    const tarPath = path.join(DIST_DIR, tarName)
    log("pack", `Creating ${path.relative(REPO_ROOT, tarPath)} from ${path.relative(REPO_ROOT, FILES_LIST)}`)
    // Use cwd=REPO_ROOT and a relative output path to avoid Windows drive-letter issues with tar
    const tarRel = path.relative(REPO_ROOT, tarPath).replace(/\\/g, "/")
    const args = ["-czf", tarRel, ...entries]
    log("pack", `Entries (${entries.length}): ${entries.slice(0, 5).join(", ")}${entries.length > 5 ? ", ..." : ""}`)
    const res = spawnSync("tar", args, {
        cwd: REPO_ROOT,
        stdio: ["ignore", "inherit", "inherit"],
        shell: process.platform === "win32",
    })
    if (res.status !== 0) throw new Error(`tar failed (args: ${args.join(" ")})`)
    return tarPath
}

function sha256File(filePath) {
    const buf = fs.readFileSync(filePath)
    const hash = crypto.createHash("sha256").update(buf).digest("hex")
    const out = `${hash}  ${path.basename(filePath)}`
    const sumPath = `${filePath}.sha256`
    fs.writeFileSync(sumPath, out + "\n")
    return sumPath
}

async function githubApi(method, url, body) {
    const headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "cmdb-package-release",
    }
    if (token) headers["Authorization"] = `Bearer ${token}`
    const res = await fetch(url, {
        method,
        headers: {
            ...headers,
            ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
        const t = await res.text()
        throw new Error(`GitHub API ${method} ${url} -> ${res.status} ${t}`)
    }
    return res.json()
}

async function ensureRelease(ownerRepo, tag, prerelease = false) {
    // Try get-by-tag, else create
    const base = `https://api.github.com/repos/${ownerRepo}/releases`
    try {
        return await githubApi("GET", `${base}/tags/${encodeURIComponent(tag)}`)
    } catch {
        return await githubApi("POST", base, {
            tag_name: tag,
            name: tag,
            prerelease: !!prerelease,
            generate_release_notes: true,
        })
    }
}

async function uploadAsset(uploadUrl, filePath) {
    const url = uploadUrl.split("{", 1)[0] + `?name=${encodeURIComponent(path.basename(filePath))}`
    const headers = {
        "Content-Type": "application/octet-stream",
        "User-Agent": "cmdb-package-release",
    }
    if (token) headers["Authorization"] = `Bearer ${token}`
    const data = fs.readFileSync(filePath)
    const res = await fetch(url, { method: "POST", headers, body: data })
    if (!res.ok) {
        const t = await res.text()
        throw new Error(`Upload failed for ${path.basename(filePath)}: ${res.status} ${t}`)
    }
}

function moveRollingTag(versionTag) {
    if (!ROLLING_TAG) return
    // tag ROLLING_TAG to point at versionTag (same commit), force push
    sh("git", ["tag", "-f", ROLLING_TAG, versionTag])
    sh("git", ["push", "-f", "origin", `refs/tags/${ROLLING_TAG}`])
}

// Ensure the current HEAD has an annotated tag; if not, interactively prompt to create and push one.
async function ensureHeadTagOrPrompt(currentTag) {
    if (currentTag) return currentTag

    log("git", "HEAD is not on a tag. You can create one now or press Enter to cancel.")

    const rl = readline.createInterface({ input, output })
    const raw = await rl.question("Enter a new tag name to create and push (empty to cancel): ")
    let proposed = (raw || "").trim()

    if (!proposed) {
        rl.close()
        log("git", "No tag entered. Exiting without packaging.")
        process.exit(0)
    }

    // Sanitize: strip refs/tags/, replace spaces, allow only [A-Za-z0-9._-]
    proposed = proposed.replace(/^refs\/tags\//, "").replace(/\s+/g, "-")
    proposed = proposed.replace(/[^A-Za-z0-9._-]/g, "-")
    proposed = proposed.replace(/-+/g, "-")
    proposed = proposed.replace(/^-+/, "").replace(/-+$/, "")

    if (!proposed) {
        rl.close()
        log("git", "Tag name became empty after sanitization. Exiting.")
        process.exit(1)
    }

    // Show what will run and confirm
    const cmd1 = `git tag ${proposed} `
    const cmd2 = `git push origin ${proposed}`
    log("git", `About to run:\n  ${cmd1}\n  ${cmd2}`)
    const confirm = (await rl.question("Proceed? (y/N): ")).trim().toLowerCase()
    rl.close()
    if (confirm !== "y" && confirm !== "yes") {
        log("git", "Cancelled by user. Exiting.")
        process.exit(0)
    }

    // Create and push the tag
    try {
        sh("git", ["tag", proposed], { cwd: REPO_ROOT })
    } catch (e) {
        throw new Error(`Failed to create tag '${proposed}': ${e.message || e}`)
    }
    try {
        sh("git", ["push", "origin", proposed], { cwd: REPO_ROOT })
    } catch (e) {
        throw new Error(`Failed to push tag '${proposed}' to origin: ${e.message || e}`)
    }
    log("git", `Created and pushed tag ${proposed}`)
    return proposed
}

async function main() {
    log("task", "Package and publish release")

    // Git state
    ensureClean(REPO_ROOT, ALLOW_DIRTY)
    const branch = currentBranch()
    const _ti = tagInfo(REPO_ROOT)
    let tag = _ti.headTag
    const { latest, commitsSince } = _ti
    const short = shortSha()
    const cdate = commitDate()

    log("git", `branch=${branch} tag=${tag || "<none>"} commit=${short} date=${cdate}`)
    log("git", `latestTag=${latest || "<none>"} commitsSince=${commitsSince ?? "<n/a>"}`)

    tag = await ensureHeadTagOrPrompt(tag)

    // Prepare names and manifest
    const baseName = `cmdb_${tag}_${short}`
    const entries = readFilesList(FILES_LIST)
    validateEntries(entries)
    const tarPath = makeTarball(baseName, entries)
    const sumPath = sha256File(tarPath)

    const yarnVersion = (() => {
        const res = spawnSync("yarn", ["--version"], { shell: process.platform === "win32", encoding: "utf8" })
        return res.status === 0 ? (res.stdout || "").trim() : ""
    })()

    const manifest = {
        name: path.basename(tarPath),
        tag,
        commit: short,
        builtAt: new Date().toISOString(),
        node: process.version,
        yarn: yarnVersion,
        os: process.platform,
        arch: process.arch,
        artifactShape: "skinny",
        filesList: path.basename(FILES_LIST),
    }
    const manifestPath = path.join(DIST_DIR, `${baseName}.manifest.json`)
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n")
    log("pack", `Wrote manifest ${path.relative(REPO_ROOT, manifestPath)}`)

    if (!token) {
        throw new Error("GITHUB_TOKEN (or GH_TOKEN) is required to create/upload the release")
    }

    const ownerRepo = getOwnerRepo()
    const release = await ensureRelease(ownerRepo, tag, false)
    const uploadUrl = release.upload_url
    if (!uploadUrl) throw new Error("No upload_url in release payload")

    // Upload assets
    await uploadAsset(uploadUrl, tarPath)
    await uploadAsset(uploadUrl, sumPath)
    await uploadAsset(uploadUrl, manifestPath)

    // Move rolling tag pointer
    moveRollingTag(tag)

    // Display URLs
    const releaseHtmlUrl = release.html_url || `https://github.com/${ownerRepo}/releases/tag/${encodeURIComponent(tag)}`
    const assetName = path.basename(tarPath)
    const downloadUrl = `https://github.com/${ownerRepo}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(assetName)}`
    log("done", `Release: ${releaseHtmlUrl}`)
    log("done", `Artifact: ${downloadUrl}`)
    log("done", `Checksum: ${downloadUrl}.sha256 (or see assets list)`) // conventional
}

main().catch((err) => {
    process.stderr.write(`Error: ${err.message || err}\n`)
    process.exit(1)
})
