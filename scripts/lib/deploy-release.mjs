/**
 * Verifies, prepares and installs one selected release on a deployment target.
 *
 * Internal module used by upgrade.mjs; do not run it directly. Its installation
 * functions mutate the checkout, stop/start Supervisor and apply database
 * migrations only after upgrade.mjs has obtained human confirmation.
 */

import fs from "node:fs"
import path from "node:path"
import { git, run, sh, ensureClean, log } from "./release-utils.mjs"
import { readJson, writeJson, sha256File } from "./release-files.mjs"
import {
    releaseIdentity, assertSameIdentity, artifactNames, selectReleaseAssets, validateManifest,
    assertDeploymentRuntime, assertManifestMatchesBuild, assertArchiveEntries,
} from "./release-model.mjs"

export async function prepareRelease(client, release, identity, runtime, workDirectory) {
    if (release.draft || release.tag_name !== identity.tag) throw new Error("Select a published release for this product/version.")
    const assets = selectReleaseAssets(release, identity)
    const names = artifactNames(identity)
    const manifestPath = path.join(workDirectory, names.manifest)
    await client.downloadAsset(assets.manifest, manifestPath)
    const manifest = validateManifest(readJson(manifestPath), identity)
    assertDeploymentRuntime(manifest.runtime, runtime)
    if (await client.tagCommit(identity.tag) !== manifest.commit) throw new Error("Release tag does not match the manifest commit.")
    assertSameIdentity(releaseIdentity(await client.packageAtCommit(manifest.commit)), identity)

    const archivePath = path.join(workDirectory, names.archive)
    const checksumPath = path.join(workDirectory, names.checksum)
    await client.downloadAsset(assets.checksum, checksumPath)
    await client.downloadAsset(assets.archive, archivePath)
    await verifyDownloadedArchive(archivePath, checksumPath, manifest)

    const extractionDirectory = path.join(workDirectory, "unpacked")
    fs.mkdirSync(extractionDirectory)
    await run("tar", ["-xzf", archivePath, "-C", extractionDirectory, "--no-same-owner", "--no-same-permissions"])
    const buildDirectory = path.join(extractionDirectory, ".next")
    assertManifestMatchesBuild(manifest, readJson(path.join(buildDirectory, "cmdb-build.json")))
    if (!fs.existsSync(path.join(buildDirectory, "BUILD_ID"))) throw new Error("Release archive has no Next.js BUILD_ID.")
    return { manifest, buildDirectory }
}

export async function verifyDownloadedArchive(archivePath, checksumPath, manifest) {
    const expectedLine = `${manifest.artifact.sha256}  ${manifest.artifact.name}`
    if (fs.readFileSync(checksumPath, "utf8").trim() !== expectedLine) throw new Error("Checksum file does not match the release manifest.")
    if (await sha256File(archivePath) !== manifest.artifact.sha256) throw new Error("Downloaded archive checksum mismatch.")
    assertArchiveEntries(sh("tar", ["-tzf", archivePath]), sh("tar", ["-tvzf", archivePath]))
}

export async function fetchReleaseSource(repoRoot, manifest) {
    ensureClean(repoRoot, false)
    // Fetch the selected immutable tag, regardless of the checkout's current branch.
    const reference = `refs/tags/${manifest.tag}`
    await run("git", ["fetch", "--no-tags", "origin", `${reference}:${reference}`], { cwd: repoRoot })
    const commit = git(["rev-parse", `${reference}^{commit}`], repoRoot)
    if (commit !== manifest.commit) throw new Error("Fetched source does not match the selected release.")
    const packageJson = JSON.parse(git(["show", `${commit}:package.json`], repoRoot))
    assertSameIdentity(releaseIdentity(packageJson), manifest)
}

function writeDeploymentState(repoRoot, state) {
    const statePath = path.join(repoRoot, ".cmdb-deployment.json")
    const temporaryPath = `${statePath}.tmp`
    writeJson(temporaryPath, state)
    fs.renameSync(temporaryPath, statePath)
}

export async function withDeploymentLock(repoRoot, action) {
    const lockPath = path.join(repoRoot, ".cmdb-deployment.lock")
    let descriptor
    try { descriptor = fs.openSync(lockPath, "wx") }
    catch (error) {
        if (error.code === "EEXIST") throw new Error(`Another deployment holds ${lockPath}. After a crash, check for a running upgrade process before removing this file.`)
        throw error
    }
    try {
        fs.writeFileSync(descriptor, `${process.pid}\n`)
        return await action()
    } finally {
        fs.closeSync(descriptor)
        fs.unlinkSync(lockPath)
    }
}

export async function installPreparedRelease(repoRoot, config, prepared, commands = { run, git }) {
    const { manifest, buildDirectory } = prepared
    ensureClean(repoRoot, false)
    const previousCheckoutCommit = commands.git(["rev-parse", "HEAD"], repoRoot)
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    fs.mkdirSync(config.backupDirectory, { recursive: true })
    const backupPath = path.join(config.backupDirectory, `${config.database}_${manifest.tag}_${timestamp}.sql`)
    const recoveryDirectory = path.join(repoRoot, "dist", `upgrade-${timestamp}`)
    fs.mkdirSync(recoveryDirectory, { recursive: true })
    const state = {
        status: "installing", product: manifest.product, version: manifest.version,
        commit: manifest.commit, sourceRef: manifest.sourceRef, runtime: manifest.runtime,
        artifact: manifest.artifact, previousCheckoutCommit, backupPath, recoveryDirectory,
        startedAt: new Date().toISOString(),
    }
    const execute = (command, args) => commands.run(command, args, { cwd: repoRoot })

    log("svc", `Stopping ${config.service}`)
    await execute("supervisorctl", ["stop", config.service])
    try {
        writeDeploymentState(repoRoot, state)
        log("db", `Backing up to ${backupPath}`)
        await execute("mysqldump", ["--single-transaction", "--routines", "--triggers", config.database, "-r", backupPath])
        await execute("git", ["checkout", "--detach", manifest.commit])
        await execute("yarn", ["install", "--frozen-lockfile", "--non-interactive"])

        const installedBuild = path.join(repoRoot, ".next")
        if (fs.existsSync(installedBuild)) fs.renameSync(installedBuild, path.join(recoveryDirectory, "previous-next"))
        fs.cpSync(buildDirectory, installedBuild, { recursive: true, errorOnExist: true, force: false })
        await execute("yarn", ["blitz", "prisma", "generate"])
        await execute("yarn", ["blitz", "prisma", "migrate", "deploy"])
        await execute("supervisorctl", ["start", config.service])
        writeDeploymentState(repoRoot, { ...state, status: "running", installedAt: new Date().toISOString() })
    } catch (error) {
        // Source, dependencies or migrations may already have changed. Restarting blindly
        // could serve a mixture of releases; leave recovery to an explicit operator action.
        writeDeploymentState(repoRoot, { ...state, status: "failed", error: error.message })
        throw new Error(`Deployment failed: ${error.message}\nInspect supervisor status before recovery. Backup: ${backupPath}\nPrevious build: ${recoveryDirectory}`)
    }
    log("done", `Installed ${manifest.product}/${manifest.version} (${manifest.commit}).`)
}
