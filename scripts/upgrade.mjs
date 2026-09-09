#!/usr/bin/env node

/**
 * Installs a published CafeMarcheDB release on one deployed instance.
 *
 * Intended for the human operator of a Uberspace deployment. Run it from the
 * deployed repository checkout, where .env.deploy.local, application settings,
 * Git access, MySQL credentials and the Supervisor service are configured.
 *
 * Usage: node scripts/upgrade.mjs
 *        node scripts/upgrade.mjs --version 3.0.0
 *        node scripts/upgrade.mjs --version 3.0.0 --dry-run
 * A dry run only downloads and verifies. Installation always asks for explicit
 * confirmation, then stops the service, backs up the database, installs the
 * selected commit and build, applies migrations, and starts the service.
 */

import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import readline from "node:readline/promises"
import { parseArgs } from "node:util"
import { getRepoRoot, log, git, sh, ensureClean, loadEnvFiles, ensureLocalEnvPair } from "./lib/release-utils.mjs"
import { readJson, isMain, reportError } from "./lib/release-files.mjs"
import { releaseIdentity, identityForVersion, identityFromTag, readRuntime } from "./lib/release-model.mjs"
import { createGitHubClient, ownerRepoFromOrigin } from "./lib/github-releases.mjs"
import { prepareRelease, fetchReleaseSource, installPreparedRelease, withDeploymentLock } from "./lib/deploy-release.mjs"

const REPO_ROOT = getRepoRoot(import.meta.url)

export function deploymentConfig(repoRoot = REPO_ROOT, environment = process.env) {
    const identity = releaseIdentity(readJson(path.join(repoRoot, "package.json")))
    const backup = environment.BACKUP_DIR || "~/backups"
    const config = {
        product: identity.product,
        service: environment.SERVICE || "cmdb",
        database: environment.DB_NAME || "tenfour_cmdb",
        backupDirectory: backup.startsWith("~/") ? path.join(os.homedir(), backup.slice(2)) : path.resolve(backup),
        releasesToShow: Number(environment.RELEASES_TO_SHOW || "10"),
    }
    if (!/^[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(config.database)) throw new Error("DB_NAME must be a simple database name.")
    if (!/^[A-Za-z0-9_][A-Za-z0-9_.:-]*$/.test(config.service)) throw new Error("SERVICE must be a Supervisor service name.")
    if (!Number.isInteger(config.releasesToShow) || config.releasesToShow < 1) throw new Error("RELEASES_TO_SHOW must be a positive integer.")
    return config
}

async function ask(question) {
    if (!process.stdin.isTTY) throw new Error("Deployment requires an interactive terminal. Use --dry-run for unattended inspection.")
    const prompt = readline.createInterface({ input: process.stdin, output: process.stdout })
    try { return (await prompt.question(question)).trim() } finally { prompt.close() }
}

async function selectRelease(client, config, version) {
    if (version) {
        const identity = identityForVersion(config.product, version)
        const release = await client.findRelease(identity.tag)
        if (!release || release.draft) throw new Error(`No published release for ${config.product}/${version}.`)
        return { release, identity }
    }
    const releases = await client.listProductReleases(config.product, config.releasesToShow)
    if (!releases.length) throw new Error(`No releases for ${config.product}. Legacy v2.xx releases use the previous upgrade script.`)
    releases.forEach((release, index) => {
        const identity = identityFromTag(release.tag_name, config.product)
        console.log(`[${index}] ${identity.product}/${identity.version}  ${release.published_at}${release.prerelease ? "  prerelease" : ""}`)
    })
    const answer = await ask("Select release index (empty cancels): ")
    if (answer === "") return null
    if (!/^\d+$/.test(answer) || !releases[Number(answer)]) throw new Error("Invalid selection.")
    const release = releases[Number(answer)]
    return { release, identity: identityFromTag(release.tag_name, config.product) }
}

function showInstalledVersion() {
    const statePath = path.join(REPO_ROOT, ".cmdb-deployment.json")
    if (!fs.existsSync(statePath)) { log("installed", "No deployment record yet (legacy or fresh installation)."); return }
    const installed = readJson(statePath)
    log("installed", `${installed.product}/${installed.version} ${installed.commit} status=${installed.status}`)
}

export async function main() {
    const { values } = parseArgs({ options: { version: { type: "string" }, "dry-run": { type: "boolean" }, help: { type: "boolean" } } })
    if (values.help) {
        console.log("Usage: node scripts/upgrade.mjs [--version 3.0.0] [--dry-run]\nProduct comes from package.json; target settings come from .env.deploy.local.\n--dry-run downloads and verifies a release without changing the checkout, service or database.\nInstallation always requires interactive confirmation.")
        return
    }
    const baseEnv = path.join(REPO_ROOT, ".env.deploy")
    const localEnv = path.join(REPO_ROOT, ".env.deploy.local")
    if (!values["dry-run"]) ensureLocalEnvPair(baseEnv, localEnv, "deploy")
    loadEnvFiles([localEnv, baseEnv])
    const config = deploymentConfig()
    ensureClean(REPO_ROOT, false)
    const runtime = readRuntime(sh("yarn", ["--version"], { cwd: REPO_ROOT }))
    const ownerRepo = ownerRepoFromOrigin(git(["remote", "get-url", "origin"], REPO_ROOT))
    const client = createGitHubClient(ownerRepo, process.env.GITHUB_TOKEN || process.env.GH_TOKEN)
    log("target", `${config.product} service=${config.service} database=${config.database}`)
    showInstalledVersion()
    const selection = await selectRelease(client, config, values.version)
    if (!selection) { log("cancel", "No release selected."); return }

    const workDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "cmdb-upgrade-"))
    try {
        const prepared = await prepareRelease(client, selection.release, selection.identity, runtime, workDirectory)
        const { manifest } = prepared
        log("release", `${manifest.product}/${manifest.version} from ${manifest.sourceRef}`)
        log("source", manifest.commit)
        log("verified", "Runtime, source identity, tag, checksum and build metadata match.")
        if (values["dry-run"]) { log("done", "Dry run complete; checkout, service and database unchanged."); return }
        const confirmation = `${manifest.product}/${manifest.version}`
        console.log("Installation applies this release's database migrations; it does not reverse existing migrations.")
        if (await ask(`Type ${confirmation} to install (empty cancels): `) !== confirmation) { log("cancel", "Installation cancelled."); return }
        await withDeploymentLock(REPO_ROOT, async () => {
            await fetchReleaseSource(REPO_ROOT, manifest)
            await installPreparedRelease(REPO_ROOT, config, prepared)
        })
    } finally {
        // This directory is created above with a fixed prefix under os.tmpdir().
        fs.rmSync(workDirectory, { recursive: true, force: true })
    }
}

if (isMain(import.meta.url)) main().catch(reportError)
