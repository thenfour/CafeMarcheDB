import test from "node:test"
import assert from "node:assert/strict"
import {
    releaseIdentity, identityForVersion, identityFromTag, validateVersion, artifactNames,
    assertBuildRuntime, assertDeploymentRuntime, RELEASE_RUNTIME, validateManifest,
    selectReleaseAssets, assertArchiveEntries,
} from "../lib/release-model.mjs"
import { ownerRepoFromOrigin } from "../lib/github-releases.mjs"

test("package metadata owns identity; product versions are independent", () => {
    assert.deepEqual(releaseIdentity({ version: "3.0.0", cmdb: { product: "cafemarche" } }), {
        product: "cafemarche", version: "3.0.0", tag: "cafemarche-v3.0.0",
    })
    assert.equal(identityForVersion("single-band", "3.0.0").tag, "single-band-v3.0.0")
    assert.equal(identityFromTag("single-band-v3.0.0", "cafemarche"), null)
    assert.equal(identityFromTag("v2.03", "cafemarche"), null)
    assert.throws(() => releaseIdentity({ version: "3.0.0" }), /Unknown product/)
    assert.throws(() => identityForVersion("../other", "3.0.0"), /Unknown product/)
})

test("SemVer accepts release/prerelease/build identifiers and rejects legacy or unsafe versions", () => {
    for (const version of ["3.0.0", "0.0.0", "3.1.0-rc.1", "3.1.0-0", "3.1.0+build.01", "3.1.0-beta.2+linux"]) {
        assert.equal(validateVersion(version), version)
    }
    for (const version of ["v2.03", "3.0", "03.0.0", "3.00.0", "3.0.0-01", "3.0.0-rc.01", "3.0.0-", "3.0.0+", "../3.0.0", "3.0.0\n", null]) {
        assert.throws(() => validateVersion(version), /Invalid package version/)
    }
})

test("build runtime matches glibc 2.17 and deployment permits compatible Node patch updates", () => {
    assertBuildRuntime(RELEASE_RUNTIME)
    for (const update of [{ os: "win32" }, { arch: "arm64" }, { glibc: "2.28" }, { node: "22.0.0" }, { yarn: "4.0.0" }]) {
        assert.throws(() => assertBuildRuntime({ ...RELEASE_RUNTIME, ...update }), /Release build requires/)
    }
    assertDeploymentRuntime(RELEASE_RUNTIME, { ...RELEASE_RUNTIME, glibc: "2.28", node: "18.20.9" })
    for (const update of [{ os: "win32" }, { arch: "arm64" }, { glibc: "2.9" }, { glibc: undefined }, { node: "18.19.0" }, { node: "20.0.0" }]) {
        assert.throws(() => assertDeploymentRuntime(RELEASE_RUNTIME, { ...RELEASE_RUNTIME, ...update }), /incompatible/)
    }
})

test("manifest requires full provenance and pairs assets by exact product/version", () => {
    const identity = identityForVersion("cafemarche", "3.0.0")
    const names = artifactNames(identity)
    const manifest = {
        schemaVersion: 1, ...identity, commit: "a".repeat(40), sourceRef: "refs/heads/main",
        builtAt: "2026-09-09T12:00:00Z", dirty: false, runtime: RELEASE_RUNTIME,
        artifact: { name: names.archive, sha256: "b".repeat(64) },
    }
    validateManifest(manifest, identity)
    assert.throws(() => validateManifest({ ...manifest, commit: "abc1234" }, identity), /full commit/)
    assert.throws(() => validateManifest({ ...manifest, product: "single-band" }, identity), /identity mismatch/)
    assert.throws(() => validateManifest({ ...manifest, dirty: true }, identity), /clean checkout/)
    assert.throws(() => validateManifest({ ...manifest, sourceRef: "HEAD" }, identity), /branch ref/)
    const assets = Object.values(names).map((name, id) => ({ id, name, state: "uploaded" }))
    const release = { assets: [{ id: 99, name: "unrelated.tar.gz", state: "uploaded" }, ...assets] }
    assert.equal(selectReleaseAssets(release, identity).archive.name, names.archive)
    assert.throws(() => selectReleaseAssets({ assets: assets.slice(1) }, identity), /exactly one/)
    assert.throws(() => selectReleaseAssets({ assets: [...assets, assets[0]] }, identity), /exactly one/)
})

test("archive validation rejects paths and links that escape the build directory", () => {
    assertArchiveEntries("./.next/\n./.next/BUILD_ID\n", "drwxr-xr-x directory\n-rw-r--r-- file\n")
    for (const names of ["../file", "/.next/file", "./.next/../../file", "./.next\\file", "./package.json", ""]) {
        assert.throws(() => assertArchiveEntries(names, "-rw-r--r-- file"), /only paths/)
    }
    for (const kind of ["l", "h", "p", "b"]) {
        assert.throws(() => assertArchiveEntries("./.next/file", `${kind}rwxrwxrwx link`), /regular files/)
    }
})

test("GitHub origin parsing supports HTTPS and SSH without leaking a .git suffix", () => {
    for (const origin of ["https://github.com/thenfour/CafeMarcheDB.git", "git@github.com:thenfour/CafeMarcheDB.git", "ssh://git@github.com/thenfour/CafeMarcheDB"]) {
        assert.equal(ownerRepoFromOrigin(origin), "thenfour/CafeMarcheDB")
    }
    assert.throws(() => ownerRepoFromOrigin("https://example.com/repo.git"), /GitHub repository/)
    assert.throws(() => ownerRepoFromOrigin("https://notgithub.com/owner/repo.git"), /GitHub repository/)
})
