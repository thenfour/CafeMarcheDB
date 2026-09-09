import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { packageArtifact } from "../package-release.mjs"
import { deploymentConfig } from "../upgrade.mjs"
import { git, run, sh } from "../lib/release-utils.mjs"
import { writeJson, readJson } from "../lib/release-files.mjs"
import { releaseIdentity, artifactNames, RELEASE_RUNTIME } from "../lib/release-model.mjs"
import { prepareRelease, fetchReleaseSource, installPreparedRelease, verifyDownloadedArchive, withDeploymentLock } from "../lib/deploy-release.mjs"

function workspace(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "cmdb-release-test-"))
    t.after(() => {
        assert.equal(path.dirname(root), path.resolve(os.tmpdir()))
        assert.ok(path.basename(root).startsWith("cmdb-release-test-"))
        fs.rmSync(root, { recursive: true, force: true })
    })
    return root
}

function createRepository(root) {
    const repo = path.join(root, "source")
    fs.mkdirSync(repo)
    git(["init", "-b", "main"], repo)
    git(["config", "user.name", "Release tests"], repo)
    git(["config", "user.email", "release-tests@example.invalid"], repo)
    git(["config", "core.autocrlf", "false"], repo)
    fs.writeFileSync(path.join(repo, ".gitignore"), ".next/\ndist/\n.env.local\n.cmdb-deployment.json*\n.cmdb-deployment.lock\n")
    writeJson(path.join(repo, "package.json"), { version: "3.0.0", cmdb: { product: "cafemarche" } })
    fs.writeFileSync(path.join(repo, "source.txt"), "selected version")
    git(["add", "."], repo)
    git(["commit", "-m", "release source"], repo)
    const identity = releaseIdentity(readJson(path.join(repo, "package.json")))
    const build = {
        schemaVersion: 1, ...identity, commit: git(["rev-parse", "HEAD"], repo),
        sourceRef: "refs/heads/main", builtAt: "2026-09-09T12:00:00Z", dirty: false, runtime: RELEASE_RUNTIME,
    }
    fs.mkdirSync(path.join(repo, ".next", "cache"), { recursive: true })
    fs.writeFileSync(path.join(repo, ".next", "BUILD_ID"), "selected-build")
    fs.writeFileSync(path.join(repo, ".next", "cache", "large-cache"), "not for deployment")
    writeJson(path.join(repo, ".next", "cmdb-build.json"), build)
    git(["tag", identity.tag], repo)
    return { repo, build, identity }
}

function artifactClient(packaged) {
    const { manifest, dist } = packaged
    const assets = Object.values(artifactNames(manifest)).map((name, id) => ({ id, name, state: "uploaded" }))
    const release = { tag_name: manifest.tag, draft: false, assets }
    const client = {
        downloadAsset: async (asset, destination) => fs.copyFileSync(path.join(dist, asset.name), destination),
        tagCommit: async () => manifest.commit,
        packageAtCommit: async () => ({ version: manifest.version, cmdb: { product: manifest.product } }),
    }
    return { release, client }
}

test("target product follows package.json despite stale environment overrides", (t) => {
    const { repo } = createRepository(workspace(t))
    const environment = { PRODUCT: "stale-product", SERVICE: "band-service", DB_NAME: "band_database" }
    for (const product of ["cafemarche", "single-band", "multi-tenant"]) {
        writeJson(path.join(repo, "package.json"), { version: "3.0.0", cmdb: { product } })
        const config = deploymentConfig(repo, environment)
        assert.equal(config.product, product)
        assert.equal(config.service, "band-service")
        assert.equal(config.database, "band_database")
    }
})

test("target requires package product metadata even when PRODUCT exists in the environment", (t) => {
    const { repo } = createRepository(workspace(t))
    writeJson(path.join(repo, "package.json"), { version: "3.0.0" })
    assert.throws(() => deploymentConfig(repo, { PRODUCT: "cafemarche" }), /Unknown product/)
})

test("real packaging and dry-run preparation verify artifacts without changing source", async (t) => {
    const root = workspace(t)
    const { repo, identity, build } = createRepository(root)
    const packaged = await packageArtifact(repo)
    const { client, release } = artifactClient(packaged)
    const staging = path.join(root, "stage")
    fs.mkdirSync(staging)
    const prepared = await prepareRelease(client, release, identity, RELEASE_RUNTIME, staging)
    assert.equal(prepared.manifest.commit, build.commit)
    assert.equal(fs.readFileSync(path.join(prepared.buildDirectory, "BUILD_ID"), "utf8"), "selected-build")
    assert.equal(fs.existsSync(path.join(prepared.buildDirectory, "cache")), false)
    assert.equal(git(["status", "--porcelain"], repo), "")
    assert.equal(git(["rev-parse", "HEAD"], repo), build.commit)
    assert.equal(fs.existsSync(path.join(repo, ".cmdb-deployment.json")), false)
})

test("packaging rejects stale source commits and dirty worktrees", async (t) => {
    const { repo } = createRepository(workspace(t))
    fs.writeFileSync(path.join(repo, "source.txt"), "new source")
    await assert.rejects(() => packageArtifact(repo), /Working tree/)
    git(["add", "source.txt"], repo)
    git(["commit", "-m", "later source without rebuild"], repo)
    await assert.rejects(() => packageArtifact(repo), /different commit/)
})

test("corrupt downloads and mismatched source identity fail during preparation", async (t) => {
    const root = workspace(t)
    const { repo, identity } = createRepository(root)
    const packaged = await packageArtifact(repo)
    const { manifest, dist } = packaged
    const names = artifactNames(manifest)
    fs.appendFileSync(path.join(dist, names.archive), "corrupt")
    await assert.rejects(() => verifyDownloadedArchive(path.join(dist, names.archive), path.join(dist, names.checksum), manifest), /checksum mismatch/)
    const { client, release } = artifactClient(packaged)
    const staging = path.join(root, "stage")
    fs.mkdirSync(staging)
    client.packageAtCommit = async () => ({ version: "3.0.0", cmdb: { product: "single-band" } })
    await assert.rejects(() => prepareRelease(client, release, identity, RELEASE_RUNTIME, staging), /identity mismatch/)
})

async function installationFixture(t) {
    const root = workspace(t)
    const { repo, build, identity } = createRepository(root)
    const packaged = await packageArtifact(repo)
    const { client, release } = artifactClient(packaged)
    const staging = path.join(root, "stage")
    fs.mkdirSync(staging)
    const prepared = await prepareRelease(client, release, identity, RELEASE_RUNTIME, staging)
    // The target tracks a newer branch. Selecting 3.0.0 must install its own source.
    writeJson(path.join(repo, "package.json"), { version: "3.1.0", cmdb: { product: "cafemarche" } })
    fs.writeFileSync(path.join(repo, "source.txt"), "newer branch source")
    git(["add", "."], repo)
    git(["commit", "-m", "newer branch"], repo)
    const target = path.join(root, "target")
    await run("git", ["clone", repo, target])
    fs.mkdirSync(path.join(target, ".next"))
    fs.writeFileSync(path.join(target, ".next", "BUILD_ID"), "old-installed-build")
    fs.writeFileSync(path.join(target, ".next", "stale.js"), "old chunk")
    fs.writeFileSync(path.join(target, ".env.local"), "TARGET_SETTING=preserved\n")
    return { root, target, prepared, build, config: {
        product: "cafemarche", service: "cmdb-test", database: "cmdb_test", backupDirectory: path.join(root, "backups"),
    } }
}

function deploymentCommands(fixture, calls, failMigrations = false) {
    return {
        git,
        run: async (command, args, options) => {
            calls.push([command, ...args])
            if (command === "git") return run(command, args, options)
            if (command === "mysqldump") fs.writeFileSync(args.at(-1), "test database backup")
            if (command === "yarn") {
                assert.equal(git(["rev-parse", "HEAD"], fixture.target), fixture.build.commit)
                if (failMigrations && args.includes("migrate")) throw new Error("migration failed")
            }
        },
    }
}

test("installation uses selected source before dependencies and replaces stale build files", async (t) => {
    const fixture = await installationFixture(t)
    await fetchReleaseSource(fixture.target, fixture.prepared.manifest)
    const calls = []
    await installPreparedRelease(fixture.target, fixture.config, fixture.prepared, deploymentCommands(fixture, calls))
    assert.deepEqual(calls.slice(0, 4).map((call) => call[0]), ["supervisorctl", "mysqldump", "git", "yarn"])
    assert.deepEqual(calls.at(-1), ["supervisorctl", "start", "cmdb-test"])
    assert.equal(fs.readFileSync(path.join(fixture.target, "source.txt"), "utf8"), "selected version")
    assert.equal(fs.existsSync(path.join(fixture.target, ".next", "stale.js")), false)
    assert.equal(fs.readFileSync(path.join(fixture.target, ".env.local"), "utf8"), "TARGET_SETTING=preserved\n")
    const state = readJson(path.join(fixture.target, ".cmdb-deployment.json"))
    assert.equal(state.status, "running")
    assert.equal(state.version, "3.0.0")
    assert.equal(state.commit, fixture.build.commit)
    assert.ok(fs.existsSync(path.join(state.recoveryDirectory, "previous-next", "stale.js")))
    assert.equal(git(["status", "--porcelain"], fixture.target), "")
})

test("migration failure records recovery details without blindly restarting the service", async (t) => {
    const fixture = await installationFixture(t)
    await fetchReleaseSource(fixture.target, fixture.prepared.manifest)
    const calls = []
    await assert.rejects(() => installPreparedRelease(fixture.target, fixture.config, fixture.prepared, deploymentCommands(fixture, calls, true)), /migration failed/)
    assert.equal(calls.some((call) => call[0] === "supervisorctl" && call[1] === "start"), false)
    const state = readJson(path.join(fixture.target, ".cmdb-deployment.json"))
    assert.equal(state.status, "failed")
    assert.ok(fs.existsSync(state.backupPath))
    assert.ok(fs.existsSync(path.join(state.recoveryDirectory, "previous-next")))
})

test("dirty target refuses installation before stopping the service", async (t) => {
    const fixture = await installationFixture(t)
    fs.writeFileSync(path.join(fixture.target, "source.txt"), "operator change")
    const calls = []
    await assert.rejects(() => installPreparedRelease(fixture.target, fixture.config, fixture.prepared, deploymentCommands(fixture, calls)), /Working tree/)
    assert.equal(calls.length, 0)
})

test("deployment lock prevents overlapping upgrades and is released after failure", async (t) => {
    const directory = workspace(t)
    await assert.rejects(() => withDeploymentLock(directory, async () => {
        await assert.rejects(() => withDeploymentLock(directory, async () => assert.fail("overlapping deployment")), /Another deployment/)
        throw new Error("test failure")
    }), /test failure/)
    assert.equal(fs.existsSync(path.join(directory, ".cmdb-deployment.lock")), false)
    assert.equal(await withDeploymentLock(directory, async () => "next deployment"), "next deployment")
})
